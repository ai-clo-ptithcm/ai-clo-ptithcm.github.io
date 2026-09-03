import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "npm:@supabase/server@^1";

type ThinkingLevel = "minimal" | "low" | "medium" | "high";
type ModelConfig = { id: string; timeoutMs: number; thinkingLevel: ThinkingLevel };
type RequestPayload = {
  subject_id: string;
  chapter_id: string;
  topic_id?: string | null;
  clo_id: string;
  count?: number;
  additional_requirements?: string;
  avoid_duplicates?: boolean;
  question_scope?: "practice" | "secure_exam" | "both";
};

const MODELS: ModelConfig[] = [
  { id: "gemini-3.6-flash", timeoutMs: 50_000, thinkingLevel: "low" },
  { id: "gemini-3.5-flash-lite", timeoutMs: 30_000, thinkingLevel: "minimal" },
];

const jsonError = (error: string, status = 400, code?: string) =>
  Response.json({ success: false, error, ...(code ? { code } : {}) }, { status });
const jsonAiError = (error: string, code: string) =>
  Response.json({ success: false, error, code });

class GeminiCallError extends Error {
  code: string;
  model: string;
  status?: number;
  retryable: boolean;
  constructor(opts: { message: string; code: string; model: string; status?: number; retryable?: boolean }) {
    super(opts.message);
    this.name = "GeminiCallError";
    this.code = opts.code;
    this.model = opts.model;
    this.status = opts.status;
    this.retryable = opts.retryable ?? false;
  }
}

function createSchema(count: number, topicCount: number) {
  return {
    type: "object",
    additionalProperties: false,
    required: ["questions"],
    properties: {
      questions: {
        type: "array",
        minItems: count,
        maxItems: count,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["topic_index", "content", "option_a", "option_b", "option_c", "option_d", "correct_answer", "explanation"],
          properties: {
            topic_index: { type: "integer", minimum: 1, maximum: topicCount },
            content: { type: "string" },
            option_a: { type: "string" },
            option_b: { type: "string" },
            option_c: { type: "string" },
            option_d: { type: "string" },
            correct_answer: { type: "string", enum: ["A", "B", "C", "D"] },
            explanation: { type: "string" },
          },
        },
      },
    },
  };
}

function cloGuidance(code: string) {
  switch (String(code || "").toUpperCase()) {
    case "CLO1":
      return `CLO1 đánh giá mức độ nắm vững kiến thức và lý thuyết. Tập trung vào khái niệm, định nghĩa, định lý, tính chất, điều kiện áp dụng, ý nghĩa và nhận biết mệnh đề. Không biến tất cả câu CLO1 thành phép tính dài.`;
    case "CLO2":
      return `CLO2 đánh giá khả năng thực hiện tính toán và áp dụng tương đối trực tiếp công thức, định lý hoặc quy trình tính toán thông dụng.`;
    case "CLO3":
      return `CLO3 đánh giá khả năng phân tích và lựa chọn phương pháp: nhận dạng dạng toán, phân tích giả thiết, chọn định lý/phương pháp, kết hợp nhiều bước hoặc chia trường hợp. Không bắt buộc là bài toán thực tế.`;
    default:
      return "Bám sát mô tả CLO do giảng viên cung cấp.";
  }
}

function compactQuestion(value: unknown, maxLength = 260) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, maxLength);
}
function safeJson(text: string) { try { return JSON.parse(text); } catch { return null; } }

function classifyHttp(model: string, status: number, data: any) {
  const message = data?.error?.message || data?.message || `Gemini API trả về HTTP ${status}.`;
  if (status === 429) return new GeminiCallError({ message, code: "AI_QUOTA_EXCEEDED", model, status, retryable: true });
  if (status === 404) return new GeminiCallError({ message, code: "AI_MODEL_UNAVAILABLE", model, status, retryable: true });
  if ([408, 409, 500, 502, 503, 504].includes(status)) return new GeminiCallError({ message, code: "AI_TEMPORARILY_UNAVAILABLE", model, status, retryable: true });
  return new GeminiCallError({ message, code: "AI_REQUEST_REJECTED", model, status, retryable: false });
}

async function callModel(model: ModelConfig, apiKey: string, prompt: string, schema: Record<string, unknown>) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), model.timeoutMs);
  const started = Date.now();
  try {
    console.info(`[generate-questions] start model=${model.id} avoid-context request`);
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model.id}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      signal: controller.signal,
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          thinkingConfig: { thinkingLevel: model.thinkingLevel },
          responseMimeType: "application/json",
          responseJsonSchema: schema,
          maxOutputTokens: 12_000,
        },
      }),
    });
    const raw = await response.text();
    const data = raw ? safeJson(raw) : null;
    console.info(`[generate-questions] end model=${model.id} status=${response.status} elapsed=${Date.now() - started}ms`);
    if (!response.ok) throw classifyHttp(model.id, response.status, data);
    if (!data) throw new GeminiCallError({ message: "Gemini trả về dữ liệu không hợp lệ.", code: "AI_BAD_RESPONSE", model: model.id, retryable: true });
    return { model: model.id, data };
  } catch (error) {
    if (error instanceof GeminiCallError) throw error;
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new GeminiCallError({ message: `Mô hình ${model.id} phản hồi quá lâu.`, code: "AI_TIMEOUT", model: model.id, retryable: true });
    }
    throw new GeminiCallError({ message: error instanceof Error ? error.message : "Không thể kết nối Gemini API.", code: "AI_NETWORK_ERROR", model: model.id, retryable: true });
  } finally { clearTimeout(timeout); }
}

function extractQuestions(model: string, data: any, expected: number) {
  const text = (data?.candidates?.[0]?.content?.parts || []).map((p: any) => p?.text || "").join("").trim();
  if (!text) throw new GeminiCallError({ message: "Gemini không trả về nội dung câu hỏi.", code: "AI_EMPTY_RESPONSE", model, retryable: true });
  const parsed = safeJson(text);
  if (!parsed || !Array.isArray(parsed.questions)) throw new GeminiCallError({ message: "Kết quả Gemini không đúng cấu trúc JSON.", code: "AI_BAD_RESPONSE", model, retryable: true });
  if (parsed.questions.length !== expected) throw new GeminiCallError({ message: `Gemini tạo ${parsed.questions.length}/${expected} câu.`, code: "AI_INCOMPLETE_RESPONSE", model, retryable: true });
  return parsed.questions;
}

async function generateWithFallback(apiKey: string, prompt: string, schema: Record<string, unknown>, expected: number) {
  let last: GeminiCallError | null = null;
  for (let i = 0; i < MODELS.length; i++) {
    try {
      const result = await callModel(MODELS[i], apiKey, prompt, schema);
      return { model: result.model, questions: extractQuestions(result.model, result.data, expected) };
    } catch (error) {
      const e = error instanceof GeminiCallError ? error : new GeminiCallError({ message: String(error), code: "AI_UNKNOWN_ERROR", model: MODELS[i].id });
      last = e;
      console.warn(`[generate-questions] model=${e.model} failed code=${e.code} retryable=${e.retryable}`);
      if (!e.retryable || i === MODELS.length - 1) throw e;
    }
  }
  throw last || new GeminiCallError({ message: "Không có mô hình AI khả dụng.", code: "AI_UNAVAILABLE", model: "unknown" });
}

function friendly(error: GeminiCallError) {
  if (error.code === "AI_QUOTA_EXCEEDED") return "Các mô hình AI hiện đã đạt giới hạn sử dụng. Vui lòng thử lại sau.";
  if (error.code === "AI_TIMEOUT") return "Dịch vụ AI phản hồi quá lâu. Vui lòng thử lại sau ít phút.";
  if (["AI_MODEL_UNAVAILABLE", "AI_TEMPORARILY_UNAVAILABLE", "AI_NETWORK_ERROR"].includes(error.code)) return "Dịch vụ AI hiện tạm thời chưa sẵn sàng. Vui lòng thử lại sau.";
  if (["AI_BAD_RESPONSE", "AI_EMPTY_RESPONSE", "AI_INCOMPLETE_RESPONSE"].includes(error.code)) return "AI chưa tạo được bộ câu hỏi hoàn chỉnh. Vui lòng thử lại.";
  return error.message || "Hiện chưa thể tạo câu hỏi bằng AI.";
}

export default {
  fetch: withSupabase({ auth: "user" }, async (req, ctx) => {
    let batchId: string | null = null;
    try {
      if (req.method !== "POST") return jsonError("Chỉ hỗ trợ phương thức POST.", 405);
      const body: RequestPayload = await req.json();
      const subjectId = body.subject_id, chapterId = body.chapter_id, topicId = body.topic_id || null, cloId = body.clo_id;
      const count = Math.min(Math.max(Number(body.count) || 5, 1), 10);
      const additional = String(body.additional_requirements || "").trim().slice(0, 4000);
      const avoidDuplicates = body.avoid_duplicates !== false;
      const requestedScope = ["practice", "secure_exam", "both"].includes(String(body.question_scope)) ? body.question_scope : "practice";
      if (!subjectId || !chapterId || !cloId) return jsonError("Thiếu học phần, chương hoặc CLO.");

      const userId = ctx.userClaims?.sub || ctx.userClaims?.id;
      if (!userId) return jsonError("Không xác định được người dùng.", 401);
      const { data: profile, error: profileError } = await ctx.supabase.from("profiles").select("id,role").eq("id", userId).single();
      if (profileError || !profile) return jsonError("Không tìm thấy hồ sơ người dùng.", 403);
      if (profile.role !== "admin") {
        const { data: membership, error } = await ctx.supabase.from("subject_members").select("id,role").eq("subject_id", subjectId).eq("user_id", userId).in("role", ["teacher", "lecturer", "giangvien"]).maybeSingle();
        if (error || !membership) return jsonError("Bạn không có quyền tạo câu hỏi cho học phần này.", 403);
      }

      const subjectResult = await ctx.supabase.from("subjects").select("id,name,semester,academic_year,question_bank_id").eq("id", subjectId).single();
      if (subjectResult.error || !subjectResult.data?.question_bank_id) return jsonError("Học phần chưa được gán ngân hàng câu hỏi.");
      const bankId = subjectResult.data.question_bank_id;
      const [chapterResult, cloResult] = await Promise.all([
        ctx.supabase.from("chapters").select("id,question_bank_id,name,order_index").eq("id", chapterId).eq("question_bank_id", bankId).single(),
        ctx.supabase.from("clos").select("id,question_bank_id,code,description").eq("id", cloId).eq("question_bank_id", bankId).single(),
      ]);
      if (chapterResult.error || cloResult.error) return jsonError("Học phần, chương hoặc CLO không hợp lệ.");
      const subject = subjectResult.data, chapter = chapterResult.data, clo = cloResult.data;

      let selectedTopic: any = null;
      let topics: any[] = [];
      if (topicId) {
        const { data, error } = await ctx.supabase.from("topics").select("id,chapter_id,name,order_index").eq("id", topicId).eq("chapter_id", chapterId).single();
        if (error || !data) return jsonError("Chủ đề không thuộc chương đã chọn.");
        selectedTopic = data; topics = [data];
      } else {
        const { data, error } = await ctx.supabase.from("topics").select("id,name,order_index").eq("chapter_id", chapterId).order("order_index");
        if (error) return jsonError("Không thể đọc danh sách chủ đề.");
        topics = data || [];
      }
      if (!topics.length) return jsonError("Chương này chưa có chủ đề. Hãy tạo ít nhất một chủ đề trước khi sinh câu hỏi.");

      let avoidanceQuestions: string[] = [];
      if (avoidDuplicates) {
        let existingQuery = ctx.supabase.from("questions").select("id,content").eq("question_bank_id", bankId).eq("chapter_id", chapterId).eq("clo_id", cloId).neq("approval_status", "archived").order("updated_at", { ascending: false }).limit(80);
        if (topicId) existingQuery = existingQuery.eq("topic_id", topicId);
        const { data, error } = await existingQuery;
        if (error) console.warn("generate-questions: cannot load duplicate context", error.message);
        avoidanceQuestions = (data || []).map((x: any) => compactQuestion(x.content)).filter(Boolean);
      }

      const avoidanceContext = avoidDuplicates
        ? (avoidanceQuestions.length
          ? `Các câu đã có trong ngân hàng cùng phạm vi (chỉ dùng để tránh trùng):\n${avoidanceQuestions.map((x, i) => `${i + 1}. ${x}`).join("\n")}\nKhông sao chép, diễn đạt lại gần như nguyên văn, chỉ đổi số liệu/tên biến hoặc hoán đổi phương án. Câu mới phải khác cả cấu trúc hỏi, dữ kiện chính và hướng giải.`
          : "Ngân hàng chưa có câu cùng phạm vi; các câu trong phiên vẫn phải khác nhau rõ ràng.")
        : "Giảng viên đã tắt đối chiếu ngân hàng trước khi sinh. Không có nội dung câu hỏi cũ nào được đưa vào ngữ cảnh AI. Các câu trong chính phiên này vẫn phải khác nhau rõ ràng.";

      const { data: batch, error: batchError } = await ctx.supabase.from("ai_generation_batches").insert({
        subject_id: subjectId, chapter_id: chapterId, topic_id: topicId, clo_id: cloId,
        created_by: userId, requested_count: count, generated_count: 0, model: MODELS[0].id,
        additional_requirements: additional || null, status: "generating",
      }).select("id").single();
      if (batchError || !batch) throw new Error(batchError?.message || "Không thể tạo phiên sinh câu hỏi.");
      batchId = batch.id;

      const topicText = topicId
        ? `Danh sách chủ đề:\n1. ${selectedTopic?.name}\nChỉ tạo câu hỏi thuộc chủ đề này. Mọi topic_index bằng 1.`
        : `Tạo câu hỏi trong phạm vi toàn bộ chương.\nCác chủ đề:\n${topics.map((t, i) => `${i + 1}. ${t.name}`).join("\n")}\nPhân bố tương đối hợp lý giữa các chủ đề.`;

      const prompt = `Bạn là trợ lý chuyên môn hỗ trợ giảng viên đại học xây dựng ngân hàng câu hỏi trắc nghiệm.\n\nHãy tạo chính xác ${count} câu hỏi.\nHọc phần: ${subject.name}\nHọc kỳ: ${subject.semester}\nNăm học: ${subject.academic_year}\nChương: ${chapter.name}\nCLO: ${clo.code}\nMô tả CLO: ${clo.description}\nHướng dẫn CLO: ${cloGuidance(clo.code)}\n\nPhạm vi nội dung:\n${topicText}\n\nKiểm soát trùng lặp:\n${avoidanceContext}\n\nYêu cầu bắt buộc:\n1. Mỗi câu có đúng bốn phương án A, B, C, D.\n2. Chỉ có đúng một đáp án đúng.\n3. Nội dung thuộc đúng chương và CLO.\n4. Phương án nhiễu hợp lý.\n5. Các câu trong cùng phiên khác nhau về cấu trúc hỏi, dữ kiện chính và hướng giải.\n6. Không dùng “tất cả đều đúng/sai”.\n7. Công thức toán học viết LaTeX trong $...$.\n8. Lời giải đủ rõ nhưng gọn.\n9. Không đề cập câu hỏi được tạo bởi AI.\n10. Không tự tạo hoặc thay đổi CLO.\n11. Trả đúng JSON schema.\n12. topic_index là số thứ tự chủ đề phù hợp nhất.\n\nYêu cầu bổ sung của giảng viên:\n${additional || "Không có."}`;

      const apiKey = Deno.env.get("GEMINI_API_KEY");
      if (!apiKey) throw new Error("Chưa cấu hình GEMINI_API_KEY.");
      const aiResult = await generateWithFallback(apiKey, prompt, createSchema(count, topics.length), count);

      const draftRows = aiResult.questions.map((question: any, index: number) => {
        const topicIndex = Math.min(Math.max(Number(question.topic_index) || 1, 1), topics.length);
        const assignedTopic = topics[topicIndex - 1];
        return {
          batch_id: batchId, topic_id: assignedTopic.id, order_index: index + 1,
          content: question.content,
          options: { A: question.option_a, B: question.option_b, C: question.option_c, D: question.option_d },
          correct_answer: question.correct_answer, explanation: question.explanation, review_status: "pending",
        };
      });
      const { data: drafts, error: draftsError } = await ctx.supabase.from("ai_question_drafts").insert(draftRows).select("*").order("order_index");
      if (draftsError) throw new Error(draftsError.message);
      const { error: updateError } = await ctx.supabase.from("ai_generation_batches").update({ generated_count: drafts.length, model: aiResult.model, status: "reviewing", error_message: null, updated_at: new Date().toISOString() }).eq("id", batchId);
      if (updateError) throw new Error(updateError.message);

      return Response.json({
        success: true, batch_id: batchId, model: aiResult.model, total: drafts.length,
        context: { subject, chapter, selected_topic: selectedTopic, topics, clo, duplicate_avoidance_enabled: avoidDuplicates, duplicate_avoidance_count: avoidanceQuestions.length, question_scope: requestedScope },
        questions: drafts,
      });
    } catch (error) {
      console.error("generate-questions error", error);
      const message = error instanceof Error ? error.message : String(error);
      if (batchId) {
        try { await ctx.supabase.from("ai_generation_batches").update({ status: "failed", error_message: message, updated_at: new Date().toISOString(), completed_at: new Date().toISOString() }).eq("id", batchId); } catch (_) {}
      }
      if (error instanceof GeminiCallError) return jsonAiError(friendly(error), error.code);
      return jsonError(message || "Có lỗi khi tạo câu hỏi.", 500);
    }
  }),
};
