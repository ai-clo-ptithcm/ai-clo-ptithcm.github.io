import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type Scope = "attempt" | "student" | "class" | "exam";
type GeminiAttempt = { model: string; status: number; message?: string };

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
const score = (correct: number, total: number) => total ? Math.round(correct * 1000 / total) / 100 : 0;
const DEFAULT_MODELS = ["gemini-3.7-flash", "gemini-3.6-flash", "gemini-3.5-flash", "gemini-3.5-flash-lite"];

function configuredModels() {
  const raw = Deno.env.get("GEMINI_MODELS") || Deno.env.get("GEMINI_MODEL") || "";
  return [...new Set([...raw.split(",").map(x => x.trim()).filter(Boolean), ...DEFAULT_MODELS])];
}
function retryable(status: number, message: string) {
  return status === 404 || status === 408 || status === 429 || status >= 500 || /quota|rate limit|resource exhausted|not found|unavailable|overloaded|temporar/i.test(message);
}
async function callGemini(apiKey: string, body: unknown): Promise<{ data: any; model: string; attempts: GeminiAttempt[] }> {
  const attempts: GeminiAttempt[] = []; let lastMessage = "Gemini không thể xử lý yêu cầu.";
  for (const model of configuredModels()) {
    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
        method: "POST", headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey }, body: JSON.stringify(body),
      });
      const data = await response.json().catch(() => ({}));
      const message = data?.error?.message || `Gemini API HTTP ${response.status}`;
      attempts.push({ model, status: response.status, message: response.ok ? undefined : message });
      if (response.ok) return { data, model, attempts };
      lastMessage = message; if (!retryable(response.status, message)) break;
    } catch (error) {
      lastMessage = error instanceof Error ? error.message : String(error); attempts.push({ model, status: 0, message: lastMessage });
    }
  }
  throw new Error(`${lastMessage} (đã thử: ${attempts.map(x => x.model).join(" → ")})`);
}
async function digest(text: string) {
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization") || "";
    const url = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const geminiKey = Deno.env.get("GEMINI_API_KEY");
    if (!geminiKey) return json({ success: false, error: "Chưa cấu hình GEMINI_API_KEY cho Edge Function." }, 500);

    const userClient = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } });
    const admin = createClient(url, serviceKey);
    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData.user) return json({ success: false, error: "Phiên đăng nhập không hợp lệ." }, 401);
    const userId = userData.user.id;
    const body = await req.json();
    const subjectId = String(body.subject_id || "");
    const scope = body.scope as Scope;
    const attemptId = body.attempt_id ? String(body.attempt_id) : null;
    const examId = body.exam_id ? String(body.exam_id) : null;
    let studentId = body.student_id ? String(body.student_id) : null;
    if (!subjectId || !["attempt", "student", "class", "exam"].includes(scope)) return json({ success: false, error: "Thiếu subject_id hoặc scope không hợp lệ." }, 400);

    const { data: profile } = await admin.from("profiles").select("id,role,full_name,mssv").eq("id", userId).single();
    const { data: membership } = await admin.from("subject_members").select("role").eq("subject_id", subjectId).eq("user_id", userId).maybeSingle();
    const isAdmin = profile?.role === "admin";
    const mayAnalyzeOthers = isAdmin || ["teacher", "lecturer", "giangvien"].includes(profile?.role || "") || ["teacher", "lecturer", "giangvien"].includes(membership?.role || "");
    if (!isAdmin && !membership) return json({ success: false, error: "Bạn không thuộc học phần này." }, 403);
    if ((scope === "class" || scope === "exam") && !mayAnalyzeOthers) return json({ success: false, error: "Chỉ giảng viên được dùng phạm vi phân tích này." }, 403);
    if (scope === "student" && !studentId) studentId = userId;
    if (scope === "student" && studentId !== userId && !mayAnalyzeOthers) return json({ success: false, error: "Không có quyền phân tích sinh viên khác." }, 403);

    const { data: exams, error: examError } = await admin.from("exams").select("id,title,score_policy,counts_toward_grade,allow_ai_feedback").eq("subject_id", subjectId);
    if (examError) throw examError;
    const allExams = exams || [], allExamIds = allExams.map(x => x.id);
    if (scope === "exam" && (!examId || !allExamIds.includes(examId))) return json({ success: false, error: "Không tìm thấy bài kiểm tra trong học phần." }, 404);

    let attempts: any[] = [];
    if (scope === "class" || scope === "student") {
      let query = admin.from("assessment_effective_attempts").select("id,exam_id,student_id,attempt_number,score,submitted_at,score_policy").eq("subject_id", subjectId);
      if (scope === "student") query = query.eq("student_id", studentId);
      const { data, error } = await query;
      if (error) throw error;
      attempts = data || [];
    } else if (scope === "exam") {
      const { data, error } = await admin.from("exam_attempts").select("id,exam_id,student_id,attempt_number,score,submitted_at").eq("exam_id", examId).not("submitted_at", "is", null);
      if (error) throw error;
      attempts = data || [];
    } else {
      if (!attemptId) return json({ success: false, error: "Thiếu attempt_id." }, 400);
      const { data, error } = await admin.from("exam_attempts").select("id,exam_id,student_id,attempt_number,score,submitted_at").eq("id", attemptId).not("submitted_at", "is", null).maybeSingle();
      if (error) throw error;
      if (!data || !allExamIds.includes(data.exam_id)) return json({ success: false, error: "Không tìm thấy lượt làm đã nộp trong học phần." }, 404);
      const attemptExam = allExams.find(x => x.id === data.exam_id);
      if (attemptExam?.allow_ai_feedback === false) return json({ success: false, error: "Bài kiểm tra này không cho phép AI nhận xét." }, 403);
      attempts = [data]; studentId = data.student_id;
      if (studentId !== userId && !mayAnalyzeOthers) return json({ success: false, error: "Không có quyền phân tích lượt làm này." }, 403);
    }
    if (!attempts.length) return json({ success: false, error: "Chưa có dữ liệu bài làm để phân tích." }, 400);

    const attemptIds = attempts.map(x => x.id);
    const [{ data: answers, error: ansError }, { data: attemptQuestions, error: aqError }] = await Promise.all([
      admin.from("student_answers").select("attempt_id,question_id,is_correct,selected_option").in("attempt_id", attemptIds),
      admin.from("attempt_questions").select("attempt_id,question_id,clo_code,chapter_name,topic_name,content,correct_answer").in("attempt_id", attemptIds),
    ]);
    if (ansError) throw ansError; if (aqError) throw aqError;
    const answerMap = new Map((answers || []).map((a: any) => [`${a.attempt_id}|${a.question_id}`, a]));

    const aggregate = (getKey: (q: any) => string | null) => {
      const m = new Map<string, { correct: number; total: number }>();
      for (const q of attemptQuestions || []) {
        const key = getKey(q); if (!key) continue;
        const a = answerMap.get(`${q.attempt_id}|${q.question_id}`) as any;
        const x = m.get(key) || { correct: 0, total: 0 }; x.total++; if (a?.is_correct === true) x.correct++; m.set(key, x);
      }
      return [...m.entries()].map(([name, x]) => ({ name, correct: x.correct, total: x.total, score: score(x.correct, x.total) }));
    };
    const cloMetrics = aggregate((q: any) => q.clo_code || null);
    const chapterMetrics = aggregate((q: any) => q.chapter_name || null);
    const topicMetrics = aggregate((q: any) => q.topic_name || null).sort((a,b)=>a.score-b.score).slice(0,8);

    const questionMap = new Map<string, { content: string; clo: string | null; correct: number; total: number; choices: Record<string, number> }>();
    for (const q of attemptQuestions || []) {
      const a = answerMap.get(`${q.attempt_id}|${q.question_id}`) as any;
      const key = String(q.question_id);
      const item = questionMap.get(key) || { content: q.content || "", clo: q.clo_code || null, correct: 0, total: 0, choices: {} };
      item.total++; if (a?.is_correct === true) item.correct++;
      const choice = String(a?.selected_option || "Không chọn"); item.choices[choice] = (item.choices[choice] || 0) + 1; questionMap.set(key, item);
    }
    const difficultQuestions = [...questionMap.values()].map(x => ({ content: x.content, clo: x.clo, correct_rate: x.total ? Math.round(x.correct * 1000 / x.total) / 10 : 0, responses: x.total, selected_options: x.choices })).sort((a,b)=>a.correct_rate-b.correct_rate).slice(0,8);
    let avgScore = 0;
    if (scope === "class" || scope === "student") {
      const byStudentExam = new Map<string, { studentId: string; scores: number[] }>();
      for (const a of attempts) {
        const key = `${a.student_id}|${a.exam_id}`;
        const g = byStudentExam.get(key) || { studentId: a.student_id, scores: [] };
        g.scores.push(Number(a.score || 0)); byStudentExam.set(key, g);
      }
      const byStudent = new Map<string, number[]>();
      for (const g of byStudentExam.values()) {
        const examScore = g.scores.reduce((s, x) => s + x, 0) / g.scores.length;
        const rows = byStudent.get(g.studentId) || []; rows.push(examScore); byStudent.set(g.studentId, rows);
      }
      const studentAverages = [...byStudent.values()].map(rows => rows.reduce((s, x) => s + x, 0) / rows.length);
      avgScore = studentAverages.length ? Math.round(studentAverages.reduce((s, x) => s + x, 0) * 100 / studentAverages.length) / 100 : 0;
    } else {
      avgScore = Math.round(attempts.reduce((s, a) => s + Number(a.score || 0), 0) * 100 / attempts.length) / 100;
    }

    let studentInfo: any = null;
    if (studentId) { const { data } = await admin.from("profiles").select("full_name,mssv").eq("id", studentId).maybeSingle(); studentInfo = data; }
    const exam = scope === "exam" ? allExams.find(x => x.id === examId) : null;
    const metrics = {
      scope, subject_id: subjectId, exam_id: scope === "exam" ? examId : null, exam_title: exam?.title || null,
      student: studentInfo, attempts: attempts.length, average_score: avgScore, clos: cloMetrics, chapters: chapterMetrics,
      topics: topicMetrics, difficult_questions: scope === "exam" ? difficultQuestions : [], latest_submission: attempts.map(a=>a.submitted_at).sort().at(-1),
      official_scope: scope === "class" || scope === "student" ? "assessment_effective_attempts" : "all_submitted_attempts",
    };
    const fingerprint = await digest(JSON.stringify(metrics));
    const { data: cached } = await admin.from("assessment_ai_feedback").select("analysis,generated_at").eq("subject_id", subjectId).eq("scope", scope).eq("source_fingerprint", fingerprint).limit(1);
    if (cached?.length) return json({ success: true, cached: true, analysis: cached[0].analysis, generated_at: cached[0].generated_at });

    const scopeText = scope === "class" ? "cả lớp" : scope === "exam" ? "một bài kiểm tra cụ thể của cả lớp" : scope === "student" ? "một sinh viên theo kết quả CLO chính thức" : "một lượt làm bài kiểm tra";
    const prompt = `Bạn là trợ lý hỗ trợ giảng viên đại học phân tích kết quả học tập theo CLO. Hãy phân tích ${scopeText} từ DỮ LIỆU THỐNG KÊ đã chấm tự động bên dưới. Không tự chấm lại, không suy đoán ngoài dữ liệu. Viết tiếng Việt ngắn gọn, cụ thể, tập trung CLO/chương/chủ đề cần cải thiện. Không dùng lời khen chung chung.\n\nDữ liệu:\n${JSON.stringify(metrics)}\n\nTrả về JSON đúng cấu trúc: {"summary":"2-4 câu", "strengths":["..."], "needs_improvement":["..."], "recommendations":["..."]}. Mỗi mảng tối đa 4 ý.`;
    const geminiCall = await callGemini(geminiKey, { contents: [{ role: "user", parts: [{ text: prompt }] }], generationConfig: { responseMimeType: "application/json" } });
    const raw = (geminiCall.data?.candidates?.[0]?.content?.parts || []).map((p: any) => p.text || "").join("").trim();
    let analysis: any;
    try { analysis = JSON.parse(raw.replace(/^```json\s*/i, "").replace(/```$/i, "").trim()); }
    catch { analysis = { summary: raw || "Gemini không trả về nội dung hợp lệ.", strengths: [], needs_improvement: [], recommendations: [] }; }

    await admin.from("assessment_ai_feedback").insert({ subject_id: subjectId, requested_by: userId, scope, student_id: studentId, attempt_id: scope === "attempt" ? attemptId : null, exam_id: scope === "exam" ? examId : null, source_fingerprint: fingerprint, analysis });
    return json({ success: true, cached: false, analysis, model: geminiCall.model });
  } catch (e) {
    console.error(e);
    return json({ success: false, error: e instanceof Error ? e.message : "Lỗi không xác định." }, 500);
  }
});
