// V10.2: Gemini fallback self-contained for Supabase Dashboard deployment
type GeminiAttempt = { model: string; status: number; message?: string };

const DEFAULT_MODELS = [
  "gemini-3.7-flash",
  "gemini-3.6-flash",
  "gemini-3.5-flash",
  "gemini-3.5-flash-lite",
];

function configuredModels() {
  const raw = Deno.env.get("GEMINI_MODELS") || Deno.env.get("GEMINI_MODEL") || "";
  const configured = raw.split(",").map(x => x.trim()).filter(Boolean);
  return [...new Set([...configured, ...DEFAULT_MODELS])];
}

function retryable(status: number, message: string) {
  return status === 404 || status === 408 || status === 429 || status >= 500 ||
    /quota|rate limit|resource exhausted|not found|unavailable|overloaded|temporar/i.test(message);
}

async function callGemini(
  apiKey: string,
  body: unknown,
): Promise<{ data: any; model: string; attempts: GeminiAttempt[] }> {
  const attempts: GeminiAttempt[] = [];
  let lastMessage = "Gemini không thể xử lý yêu cầu.";

  for (const model of configuredModels()) {
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": apiKey,
          },
          body: JSON.stringify(body),
        },
      );
      const data = await response.json().catch(() => ({}));
      const message = data?.error?.message || `Gemini API HTTP ${response.status}`;
      attempts.push({ model, status: response.status, message: response.ok ? undefined : message });
      if (response.ok) return { data, model, attempts };
      lastMessage = message;
      if (!retryable(response.status, message)) break;
    } catch (error) {
      lastMessage = error instanceof Error ? error.message : String(error);
      attempts.push({ model, status: 0, message: lastMessage });
    }
  }

  throw new Error(`${lastMessage} (đã thử: ${attempts.map(x => x.model).join(" → ")})`);
}

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
const score = (correct: number, total: number) => total ? Math.round(correct * 1000 / total) / 100 : 0;
const digest = async (text: string) => {
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, "0")).join("");
};

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
    const subjectId = body.subject_id as string;
    const scope = body.scope as "attempt" | "student" | "class";
    const attemptId = body.attempt_id as string | null;
    let studentId = (body.student_id as string | null) || null;
    if (!subjectId || !["attempt", "student", "class"].includes(scope)) return json({ success: false, error: "Thiếu subject_id hoặc scope không hợp lệ." }, 400);

    const { data: profile } = await admin.from("profiles").select("id,role,full_name,mssv").eq("id", userId).single();
    const isAdmin = profile?.role === "admin";
    const isTeacher = ["teacher", "lecturer", "giangvien"].includes(profile?.role || "");
    const { data: membership } = await admin.from("subject_members").select("role").eq("subject_id", subjectId).eq("user_id", userId).maybeSingle();
    if (!isAdmin && !membership) return json({ success: false, error: "Bạn không thuộc học phần này." }, 403);
    const mayAnalyzeOthers = isAdmin || isTeacher || membership?.role === "teacher";
    if (scope === "class" && !mayAnalyzeOthers) return json({ success: false, error: "Chỉ giảng viên được phân tích cả lớp." }, 403);
    if (scope === "student" && !studentId) studentId = userId;
    if (scope === "student" && studentId !== userId && !mayAnalyzeOthers) return json({ success: false, error: "Không có quyền phân tích sinh viên khác." }, 403);

    const { data: exams, error: examError } = await admin.from("exams").select("id,title").eq("subject_id", subjectId);
    if (examError) throw examError;
    const examIds = (exams || []).map(x => x.id);
    let attempts: any[] = [];
    if (examIds.length) {
      let query = admin.from("exam_attempts").select("id,exam_id,student_id,attempt_number,score,submitted_at").in("exam_id", examIds).not("submitted_at", "is", null);
      if (scope === "attempt") query = query.eq("id", attemptId);
      if (scope === "student") query = query.eq("student_id", studentId);
      const { data, error } = await query;
      if (error) throw error;
      attempts = data || [];
    }
    if (scope === "attempt") {
      if (!attemptId || attempts.length !== 1) return json({ success: false, error: "Không tìm thấy lượt làm bài đã nộp." }, 404);
      studentId = attempts[0].student_id;
      if (studentId !== userId && !mayAnalyzeOthers) return json({ success: false, error: "Không có quyền phân tích lượt làm này." }, 403);
    }
    if (!attempts.length) return json({ success: false, error: "Chưa có dữ liệu bài làm để phân tích." }, 400);

    const attemptIds = attempts.map(x => x.id);
    const { data: answers, error: ansError } = await admin.from("student_answers").select("attempt_id,question_id,is_correct").in("attempt_id", attemptIds);
    if (ansError) throw ansError;
    // V9.1: dùng snapshot của từng lượt làm thay vì đọc metadata hiện tại trong ngân hàng câu hỏi.
    // Nhờ vậy nhận xét AI không thay đổi nếu giảng viên chỉnh câu/chương/chủ đề sau này.
    const { data: attemptQuestions, error: aqError } = await admin.from("attempt_questions")
      .select("attempt_id,question_id,clo_code,chapter_name,topic_name")
      .in("attempt_id", attemptIds);
    if (aqError) throw aqError;
    const metaMap = new Map((attemptQuestions || []).map((x: any) => [`${x.attempt_id}|${x.question_id}`, x]));
    const aggregate = (getKey: (q: any) => string | null) => {
      const m = new Map<string, { correct: number; total: number }>();
      for (const a of answers || []) {
        const q = metaMap.get(`${(a as any).attempt_id}|${(a as any).question_id}`); if (!q) continue;
        const key = getKey(q); if (!key) continue;
        const x = m.get(key) || { correct: 0, total: 0 }; x.total++; if ((a as any).is_correct) x.correct++; m.set(key, x);
      }
      return [...m.entries()].map(([name, x]) => ({ name, correct: x.correct, total: x.total, score: score(x.correct, x.total) }));
    };
    const cloMetrics = aggregate((q: any) => q.clo_code || null);
    const chapterMetrics = aggregate((q: any) => q.chapter_name || null);
    const topicMetrics = aggregate((q: any) => q.topic_name || null).sort((a,b)=>a.score-b.score).slice(0,8);
    const avgScore = Math.round(attempts.reduce((s, a) => s + Number(a.score || 0), 0) * 100 / attempts.length) / 100;
    let studentInfo: any = null;
    if (studentId) {
      const { data } = await admin.from("profiles").select("full_name,mssv").eq("id", studentId).maybeSingle(); studentInfo = data;
    }
    const metrics = { scope, subject_id: subjectId, student: studentInfo, attempts: attempts.length, average_score: avgScore, clos: cloMetrics, chapters: chapterMetrics, topics: topicMetrics, latest_submission: attempts.map(a=>a.submitted_at).sort().at(-1) };
    const fingerprint = await digest(JSON.stringify(metrics));

    let cacheQuery = admin.from("assessment_ai_feedback").select("analysis,generated_at").eq("subject_id", subjectId).eq("scope", scope).eq("source_fingerprint", fingerprint).limit(1);
    const { data: cached } = await cacheQuery;
    if (cached?.length) return json({ success: true, cached: true, analysis: cached[0].analysis, generated_at: cached[0].generated_at });

    const scopeText = scope === "class" ? "cả lớp" : scope === "student" ? "một sinh viên qua nhiều bài kiểm tra" : "một lượt làm bài kiểm tra";
    const prompt = `Bạn là trợ lý hỗ trợ giảng viên đại học phân tích kết quả học tập theo CLO. Hãy phân tích ${scopeText} từ DỮ LIỆU THỐNG KÊ đã chấm tự động bên dưới. Không tự chấm lại, không suy đoán ngoài dữ liệu. Viết tiếng Việt ngắn gọn, cụ thể, tập trung CLO/chương/chủ đề cần cải thiện. Không dùng lời khen chung chung.\n\nDữ liệu:\n${JSON.stringify(metrics)}\n\nTrả về JSON đúng cấu trúc: {"summary":"2-4 câu", "strengths":["..."], "needs_improvement":["..."], "recommendations":["..."]}. Mỗi mảng tối đa 4 ý.`;
    const geminiCall = await callGemini(geminiKey, {
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: "application/json" }
    });
    const geminiJson = geminiCall.data;
    const raw = (geminiJson?.candidates?.[0]?.content?.parts || []).map((p: any) => p.text || "").join("").trim();
    let analysis: any;
    try { analysis = JSON.parse(raw.replace(/^```json\s*/i, "").replace(/```$/i, "").trim()); }
    catch { analysis = { summary: raw || "Gemini không trả về nội dung hợp lệ.", strengths: [], needs_improvement: [], recommendations: [] }; }

    await admin.from("assessment_ai_feedback").insert({ subject_id: subjectId, requested_by: userId, scope, student_id: studentId, attempt_id: scope === "attempt" ? attemptId : null, source_fingerprint: fingerprint, analysis });
    return json({ success: true, cached: false, analysis, model: geminiCall.model });
  } catch (e) {
    console.error(e);
    return json({ success: false, error: e instanceof Error ? e.message : "Lỗi không xác định." }, 500);
  }
});
