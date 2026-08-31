// Supabase Edge Function: analyze-student-clo
// Secret required: GEMINI_API_KEY
// V10.5.2: multi-model fallback + quota/timeout protection.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "npm:@supabase/server@1";

type RequestBody = {
  subject_id?: string;
};

type CloRecord = {
  id: string;
  code: string;
  description: string | null;
};

type ThinkingLevel = "minimal" | "low" | "medium" | "high";

type GeminiModelConfig = {
  id: string;
  timeoutMs: number;
  thinkingLevel: ThinkingLevel;
};

const GEMINI_MODELS: GeminiModelConfig[] = [
  { id: "gemini-3.6-flash", timeoutMs: 30_000, thinkingLevel: "low" },
  { id: "gemini-3.7-flash", timeoutMs: 26_000, thinkingLevel: "low" },
  { id: "gemini-3.5-flash-lite", timeoutMs: 20_000, thinkingLevel: "minimal" },
];

function scoreLevel(score: number) {
  if (score < 4) return { level: "M0", status: "Chưa đạt" };
  if (score < 5.5) return { level: "M1", status: "Đạt mức cơ bản" };
  if (score < 7) return { level: "M2", status: "Đạt mức trung bình" };
  if (score < 8.5) return { level: "M3", status: "Đạt mức khá" };
  return { level: "M4", status: "Đạt mức tốt" };
}

function confidenceLabel(total: number) {
  if (total < 5) return "Chưa đủ dữ liệu";
  if (total < 15) return "Tham khảo";
  return "Tương đối ổn định";
}

function jsonResponse(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers":
        "authorization, x-client-info, apikey, content-type",
    },
  });
}

function parseGeminiJson(text: string) {
  const cleaned = text
    .trim()
    .replace(/^\`\`\`(?:json)?\s*/i, "")
    .replace(/\s*\`\`\`$/, "");
  return JSON.parse(cleaned);
}

class GeminiCallError extends Error {
  code: string;
  model: string;
  status?: number;
  retryable: boolean;

  constructor(options: {
    message: string;
    code: string;
    model: string;
    status?: number;
    retryable?: boolean;
  }) {
    super(options.message);
    this.name = "GeminiCallError";
    this.code = options.code;
    this.model = options.model;
    this.status = options.status;
    this.retryable = options.retryable ?? false;
  }
}

function safeJsonParse(text: string): any | null {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function classifyHttpError(model: string, status: number, data: any) {
  const message =
    data?.error?.message || data?.message || `Gemini API trả về HTTP ${status}.`;

  if (status === 429) {
    return new GeminiCallError({
      message,
      code: "AI_QUOTA_EXCEEDED",
      model,
      status,
      retryable: true,
    });
  }

  if (status === 404) {
    return new GeminiCallError({
      message,
      code: "AI_MODEL_UNAVAILABLE",
      model,
      status,
      retryable: true,
    });
  }

  if ([408, 409, 500, 502, 503, 504].includes(status)) {
    return new GeminiCallError({
      message,
      code: "AI_TEMPORARILY_UNAVAILABLE",
      model,
      status,
      retryable: true,
    });
  }

  return new GeminiCallError({
    message,
    code: "AI_REQUEST_REJECTED",
    model,
    status,
    retryable: false,
  });
}

function responseSchema() {
  return {
    type: "object",
    additionalProperties: false,
    required: [
      "summary",
      "strengths",
      "needs_improvement",
      "next_actions",
      "clo_feedback",
      "disclaimer",
    ],
    properties: {
      summary: { type: "string" },
      strengths: { type: "array", items: { type: "string" } },
      needs_improvement: { type: "array", items: { type: "string" } },
      next_actions: { type: "array", items: { type: "string" } },
      clo_feedback: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: [
            "clo_code",
            "score",
            "level",
            "status",
            "confidence",
            "comment",
            "recommendation",
          ],
          properties: {
            clo_code: { type: "string" },
            score: { type: "number" },
            level: { type: "string" },
            status: { type: "string" },
            confidence: { type: "string" },
            comment: { type: "string" },
            recommendation: { type: "string" },
          },
        },
      },
      disclaimer: { type: "string" },
    },
  };
}

async function callGeminiModel(options: {
  model: GeminiModelConfig;
  apiKey: string;
  prompt: string;
}) {
  const { model, apiKey, prompt } = options;
  const controller = new AbortController();
  const startedAt = Date.now();
  const timer = setTimeout(() => controller.abort(), model.timeoutMs);

  try {
    console.info(
      `[analyze-student-clo] Gemini start model=${model.id} timeout=${model.timeoutMs}ms`,
    );

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model.id}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        signal: controller.signal,
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: {
            thinkingConfig: { thinkingLevel: model.thinkingLevel },
            responseMimeType: "application/json",
            responseJsonSchema: responseSchema(),
            maxOutputTokens: 5_000,
          },
        }),
      },
    );

    const rawPayload = await response.text();
    const payload = rawPayload ? safeJsonParse(rawPayload) : null;

    console.info(
      `[analyze-student-clo] Gemini end model=${model.id} status=${response.status} elapsed=${Date.now() - startedAt}ms`,
    );

    if (!response.ok) {
      throw classifyHttpError(model.id, response.status, payload);
    }

    if (!payload) {
      throw new GeminiCallError({
        message: "Gemini trả về dữ liệu không hợp lệ.",
        code: "AI_BAD_RESPONSE",
        model: model.id,
        retryable: true,
      });
    }

    const responseText = (payload?.candidates?.[0]?.content?.parts ?? [])
      .map((part: { text?: string }) => part.text ?? "")
      .join("")
      .trim();

    if (!responseText) {
      throw new GeminiCallError({
        message: "Gemini trả về nội dung rỗng.",
        code: "AI_EMPTY_RESPONSE",
        model: model.id,
        retryable: true,
      });
    }

    let analysis: any;
    try {
      analysis = parseGeminiJson(responseText);
    } catch {
      throw new GeminiCallError({
        message: "Gemini trả về JSON không hợp lệ.",
        code: "AI_BAD_RESPONSE",
        model: model.id,
        retryable: true,
      });
    }

    return { model: model.id, analysis };
  } catch (error) {
    if (error instanceof GeminiCallError) throw error;

    if (error instanceof DOMException && error.name === "AbortError") {
      throw new GeminiCallError({
        message: `Mô hình ${model.id} phản hồi quá lâu.`,
        code: "AI_TIMEOUT",
        model: model.id,
        retryable: true,
      });
    }

    throw new GeminiCallError({
      message: error instanceof Error ? error.message : "Không thể kết nối Gemini API.",
      code: "AI_NETWORK_ERROR",
      model: model.id,
      retryable: true,
    });
  } finally {
    clearTimeout(timer);
  }
}

async function analyzeWithFallback(apiKey: string, prompt: string) {
  let lastError: GeminiCallError | null = null;

  for (let i = 0; i < GEMINI_MODELS.length; i++) {
    const model = GEMINI_MODELS[i];

    try {
      return await callGeminiModel({ model, apiKey, prompt });
    } catch (error) {
      const geminiError =
        error instanceof GeminiCallError
          ? error
          : new GeminiCallError({
              message: error instanceof Error ? error.message : "Lỗi Gemini không xác định.",
              code: "AI_UNKNOWN_ERROR",
              model: model.id,
              retryable: false,
            });

      lastError = geminiError;
      console.warn(
        `[analyze-student-clo] model=${model.id} failed code=${geminiError.code} status=${geminiError.status ?? "-"}`,
      );

      const hasNext = i < GEMINI_MODELS.length - 1;
      if (!geminiError.retryable || !hasNext) throw geminiError;

      // Không sleep theo Retry-After. Chuyển model ngay để tránh WallClockTime.
      console.info(
        `[analyze-student-clo] fallback ${model.id} -> ${GEMINI_MODELS[i + 1].id}`,
      );
    }
  }

  throw lastError ?? new Error("Không có mô hình Gemini khả dụng.");
}

function friendlyAiMessage(error: GeminiCallError) {
  switch (error.code) {
    case "AI_QUOTA_EXCEEDED":
      return "Các mô hình AI hiện đã đạt giới hạn sử dụng. Vui lòng thử lại sau.";
    case "AI_TIMEOUT":
      return "Dịch vụ AI phản hồi quá lâu. Vui lòng thử lại sau ít phút.";
    case "AI_MODEL_UNAVAILABLE":
    case "AI_TEMPORARILY_UNAVAILABLE":
    case "AI_NETWORK_ERROR":
      return "Dịch vụ AI hiện tạm thời chưa sẵn sàng. Vui lòng thử lại sau.";
    case "AI_BAD_RESPONSE":
    case "AI_EMPTY_RESPONSE":
      return "AI chưa tạo được nhận xét hợp lệ. Vui lòng thử lại.";
    default:
      return error.message || "Không thể tạo nhận xét CLO.";
  }
}

console.info("analyze-student-clo V10.5.2 started");

export default {
  fetch: withSupabase(
    { auth: ["publishable", "secret"] },
    async (req, ctx) => {
      if (req.method === "OPTIONS") return jsonResponse({ ok: true });
      if (req.method !== "POST") {
        return jsonResponse({ error: "Chỉ hỗ trợ phương thức POST." }, 405);
      }

      try {
        const userId = ctx.claims?.sub;
        if (!userId) return jsonResponse({ error: "Bạn chưa đăng nhập." }, 401);

        const body = (await req.json()) as RequestBody;
        const subjectId = body.subject_id?.trim();
        if (!subjectId) return jsonResponse({ error: "Thiếu subject_id." }, 400);

        const admin = ctx.supabaseAdmin;

        const { data: profile, error: profileError } = await admin
          .from("profiles")
          .select("id, role, is_active")
          .eq("id", userId)
          .maybeSingle();

        if (profileError) throw profileError;
        if (!profile || profile.role !== "student") {
          return jsonResponse(
            { error: "Chức năng nhận xét CLO chỉ dành cho sinh viên." },
            403,
          );
        }
        if (profile.is_active === false) {
          return jsonResponse({ error: "Tài khoản đang bị khóa." }, 403);
        }

        const { data: membership, error: membershipError } = await admin
          .from("subject_members")
          .select("subject_id, role")
          .eq("subject_id", subjectId)
          .eq("user_id", userId)
          .eq("role", "student")
          .maybeSingle();

        if (membershipError) throw membershipError;
        if (!membership) {
          return jsonResponse({ error: "Bạn không thuộc học phần này." }, 403);
        }

        const [subjectResult, closResult, examsResult] = await Promise.all([
          admin
            .from("subjects")
            .select("id, name, semester, academic_year")
            .eq("id", subjectId)
            .single(),
          admin
            .from("clos")
            .select("id, code, description")
            .eq("subject_id", subjectId)
            .order("code"),
          admin.from("exams").select("id").eq("subject_id", subjectId),
        ]);

        if (subjectResult.error) throw subjectResult.error;
        if (closResult.error) throw closResult.error;
        if (examsResult.error) throw examsResult.error;

        const subject = subjectResult.data;
        const clos = closResult.data;
        const exams = examsResult.data;

        if (!clos?.length) {
          return jsonResponse({ error: "Học phần chưa có CLO để phân tích." }, 409);
        }

        const examIds = (exams ?? []).map((exam: any) => exam.id);
        if (!examIds.length) {
          return jsonResponse({ error: "Học phần chưa có bài thi đã tạo." }, 409);
        }

        const { data: attempts, error: attemptsError } = await admin
          .from("exam_attempts")
          .select("id, exam_id, attempt_number, submitted_at, score")
          .eq("student_id", userId)
          .in("exam_id", examIds)
          .not("submitted_at", "is", null)
          .order("submitted_at", { ascending: true });

        if (attemptsError) throw attemptsError;
        if (!attempts?.length) {
          return jsonResponse(
            { error: "Bạn chưa có bài làm đã nộp trong học phần này để Gemini nhận xét." },
            409,
          );
        }

        const attemptIds = attempts.map((attempt: any) => attempt.id);
        const latestSubmittedAt = attempts[attempts.length - 1].submitted_at as string;

        const { data: cached, error: cachedError } = await admin
          .from("student_clo_ai_feedback")
          .select("analysis, source_attempt_count, source_last_submitted_at, generated_at")
          .eq("student_id", userId)
          .eq("subject_id", subjectId)
          .maybeSingle();

        if (cachedError) throw cachedError;
        if (
          cached &&
          cached.source_attempt_count === attempts.length &&
          cached.source_last_submitted_at === latestSubmittedAt
        ) {
          return jsonResponse({
            success: true,
            cached: true,
            generated_at: cached.generated_at,
            analysis: cached.analysis,
          });
        }

        const { data: answers, error: answersError } = await admin
          .from("student_answers")
          .select("attempt_id, question_id, is_correct")
          .in("attempt_id", attemptIds);

        if (answersError) throw answersError;
        if (!answers?.length) {
          return jsonResponse({ error: "Các bài đã nộp chưa có dữ liệu câu trả lời." }, 409);
        }

        const questionIds = [
          ...new Set(answers.map((answer: any) => answer.question_id)),
        ];
        const { data: questions, error: questionsError } = await admin
          .from("questions")
          .select("id, clo_id, topic_id, chapter_id")
          .in("id", questionIds);

        if (questionsError) throw questionsError;

        const topicIds = [
          ...new Set(
            (questions ?? [])
              .map((question: any) => question.topic_id)
              .filter((id: any): id is string => Boolean(id)),
          ),
        ];
        const chapterIds = [
          ...new Set(
            (questions ?? [])
              .map((question: any) => question.chapter_id)
              .filter((id: any): id is string => Boolean(id)),
          ),
        ];

        const [topicsResult, chaptersResult] = await Promise.all([
          topicIds.length
            ? admin.from("topics").select("id, name, chapter_id").in("id", topicIds)
            : Promise.resolve({ data: [], error: null }),
          chapterIds.length
            ? admin.from("chapters").select("id, name").in("id", chapterIds)
            : Promise.resolve({ data: [], error: null }),
        ]);

        if (topicsResult.error) throw topicsResult.error;
        if (chaptersResult.error) throw chaptersResult.error;

        const topics = topicsResult.data ?? [];
        const chapters = chaptersResult.data ?? [];

        const questionById = new Map(
          (questions ?? []).map((question: any) => [question.id, question]),
        );
        const topicById = new Map(
          topics.map((topic: any) => [topic.id, topic]),
        );
        const chapterById = new Map(
          chapters.map((chapter: any) => [chapter.id, chapter]),
        );

        const cloCounters = new Map<string, { total: number; correct: number }>();
        const topicCounters = new Map<
          string,
          { total: number; correct: number; topic_name: string; chapter_name: string }
        >();

        for (const answer of answers as any[]) {
          const question: any = questionById.get(answer.question_id);
          if (!question) continue;

          if (question.clo_id) {
            const counter = cloCounters.get(question.clo_id) ?? { total: 0, correct: 0 };
            counter.total += 1;
            if (answer.is_correct) counter.correct += 1;
            cloCounters.set(question.clo_id, counter);
          }

          if (question.topic_id) {
            const topic: any = topicById.get(question.topic_id);
            const chapterId = topic?.chapter_id ?? question.chapter_id;
            const chapter: any = chapterById.get(chapterId);
            const counter = topicCounters.get(question.topic_id) ?? {
              total: 0,
              correct: 0,
              topic_name: topic?.name ?? "Chủ đề chưa đặt tên",
              chapter_name: chapter?.name ?? "Chương chưa xác định",
            };
            counter.total += 1;
            if (answer.is_correct) counter.correct += 1;
            topicCounters.set(question.topic_id, counter);
          }
        }

        const cloMetrics = (clos as CloRecord[]).map((clo) => {
          const counter = cloCounters.get(clo.id) ?? { total: 0, correct: 0 };
          const score = counter.total > 0
            ? Number(((counter.correct * 10) / counter.total).toFixed(2))
            : 0;
          return {
            clo_code: clo.code,
            clo_description: clo.description,
            total_questions: counter.total,
            correct_answers: counter.correct,
            score,
            ...scoreLevel(score),
            confidence: confidenceLabel(counter.total),
          };
        });

        const topicMetrics = [...topicCounters.values()]
          .map((topic) => ({
            ...topic,
            score: Number(((topic.correct * 10) / topic.total).toFixed(2)),
          }))
          .sort((a, b) => a.score - b.score || b.total - a.total);

        const evidence = {
          subject: {
            name: subject.name,
            semester: subject.semester,
            academic_year: subject.academic_year,
          },
          assessment_scale: {
            pass_threshold: 4,
            levels: [
              "M0: dưới 4, chưa đạt",
              "M1: từ 4 đến dưới 5.5",
              "M2: từ 5.5 đến dưới 7",
              "M3: từ 7 đến dưới 8.5",
              "M4: từ 8.5 đến 10",
            ],
          },
          submitted_attempt_count: attempts.length,
          clo_metrics: cloMetrics,
          topic_metrics: topicMetrics,
        };

        const prompt = `Bạn là trợ lý học tập đại học. Hãy nhận xét mức độ đạt CLO
của một sinh viên dựa DUY NHẤT trên dữ liệu tổng hợp bên dưới.

Quy tắc bắt buộc:
- Không tự tạo thêm điểm số, bài làm, kiến thức hay thông tin cá nhân.
- Phân biệt rõ "điểm thấp" với "chưa đủ dữ liệu"; CLO có dưới 5 câu chỉ được nhận xét dè dặt.
- Điểm từ 4 trở lên được xem là đạt CLO cá nhân.
- Nhận xét ngắn gọn, cụ thể, tích cực nhưng trung thực.
- Nêu điểm mạnh, nội dung cần củng cố và 3-5 hành động học tập tiếp theo.
- Nhận xét từng CLO; khuyến nghị phải bám vào các chủ đề có dữ liệu.
- Không thay đổi điểm và không tuyên bố đây là kết luận chính thức.
- Toàn bộ nội dung bằng tiếng Việt.
- Chỉ trả về một JSON hợp lệ, không dùng Markdown.

Dữ liệu:
${JSON.stringify(evidence)}`;

        const apiKey = Deno.env.get("GEMINI_API_KEY");
        if (!apiKey) {
          return jsonResponse({ error: "Chưa cấu hình secret GEMINI_API_KEY." }, 500);
        }

        let aiResult: { model: string; analysis: any };
        try {
          aiResult = await analyzeWithFallback(apiKey, prompt);
        } catch (error) {
          if (error instanceof GeminiCallError) {
            console.error("analyze-student-clo AI error:", error);
            return jsonResponse(
              { error: friendlyAiMessage(error), code: error.code },
              500,
            );
          }
          throw error;
        }

        const analysis = {
          ...aiResult.analysis,
          metrics: {
            attempt_count: attempts.length,
            last_submitted_at: latestSubmittedAt,
            clos: cloMetrics,
            topics: topicMetrics,
          },
        };
        const now = new Date().toISOString();

        const { error: saveError } = await admin
          .from("student_clo_ai_feedback")
          .upsert(
            {
              student_id: userId,
              subject_id: subjectId,
              analysis,
              source_attempt_count: attempts.length,
              source_last_submitted_at: latestSubmittedAt,
              model: aiResult.model,
              generated_at: now,
              updated_at: now,
            },
            { onConflict: "student_id,subject_id" },
          );

        if (saveError) throw saveError;

        return jsonResponse({
          success: true,
          cached: false,
          generated_at: now,
          model: aiResult.model,
          analysis,
        });
      } catch (error) {
        console.error("analyze-student-clo error:", error);
        return jsonResponse(
          {
            error: error instanceof Error ? error.message : "Không thể tạo nhận xét CLO.",
          },
          500,
        );
      }
    },
  ),
};
