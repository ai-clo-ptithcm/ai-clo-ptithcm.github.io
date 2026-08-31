import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "npm:@supabase/server@^1";
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


interface RequestPayload {
  subject_id: string;
  chapter_id: string;
  topic_id?: string | null;
  clo_id: string;
  count?: number;
  additional_requirements?: string;
}

function jsonError(message: string, status = 400) {
  return Response.json(
    {
      success: false,
      error: message
    },
    { status }
  );
}

function createQuestionSchema(
  count: number,
  topicCount: number
) {
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
          required: [
            "topic_index",
            "content",
            "option_a",
            "option_b",
            "option_c",
            "option_d",
            "correct_answer",
            "explanation"
          ],
          properties: {
            topic_index: {
  type: "integer",
  minimum: 1,
  maximum: topicCount,
  description:
    "Số thứ tự của chủ đề phù hợp nhất trong danh sách chủ đề được cung cấp."
},
            content: {
              type: "string",
              description: "Nội dung câu hỏi trắc nghiệm."
            },
            option_a: {
              type: "string",
              description: "Phương án A."
            },
            option_b: {
              type: "string",
              description: "Phương án B."
            },
            option_c: {
              type: "string",
              description: "Phương án C."
            },
            option_d: {
              type: "string",
              description: "Phương án D."
            },
            correct_answer: {
              type: "string",
              enum: ["A", "B", "C", "D"]
            },
            explanation: {
              type: "string",
              description: "Lời giải hoặc giải thích đáp án."
            }
          }
        }
      }
    }
  };
}

function getCloGuidance(code: string) {
  switch (code.toUpperCase()) {
    case "CLO1":
      return `
CLO1 đánh giá mức độ nắm vững kiến thức và lý thuyết.

Câu hỏi nên tập trung vào:
- Khái niệm, định nghĩa, định lý và tính chất.
- Điều kiện áp dụng của định lý hoặc công thức.
- Ý nghĩa của các khái niệm toán học.
- Nhận biết mệnh đề đúng hoặc sai.
- Hiểu kết luận lý thuyết qua ví dụ đơn giản.

Không biến tất cả câu CLO1 thành các phép tính dài.
      `.trim();

    case "CLO2":
      return `
CLO2 đánh giá khả năng thực hiện tính toán.

Câu hỏi nên tập trung vào:
- Áp dụng công thức hoặc định lý tương đối trực tiếp.
- Thực hiện đúng các bước tính toán.
- Tính giới hạn, đạo hàm, vi phân, tích phân hoặc chuỗi.
- Xét hội tụ bằng một tiêu chuẩn phù hợp khi dạng toán đã rõ.
- Kết quả có thể tìm được bằng một quy trình tính toán thông dụng.
      `.trim();

    case "CLO3":
      return `
CLO3 đánh giá khả năng phân tích và lựa chọn phương pháp.

Câu hỏi nên yêu cầu một hoặc nhiều yếu tố:
- Nhận dạng dạng toán trước khi giải.
- Phân tích giả thiết và điều kiện.
- Lựa chọn định lý hoặc phương pháp thích hợp.
- Kết hợp nhiều kiến thức hoặc nhiều bước tính toán.
- Chia trường hợp hoặc xử lý biến đổi không trực tiếp.

CLO3 không bắt buộc phải là bài toán thực tế hoặc chuyên ngành.
      `.trim();

    default:
      return "Bám sát mô tả CLO do giảng viên cung cấp.";
  }
}

export default {
  fetch: withSupabase(
    { auth: "user" },

    async (req, ctx) => {
      let batchId: string | null = null;

      try {
        if (req.method !== "POST") {
          return jsonError(
            "Chỉ hỗ trợ phương thức POST.",
            405
          );
        }

        const body: RequestPayload = await req.json();

        const subjectId = body.subject_id;
        const chapterId = body.chapter_id;
        const topicId = body.topic_id || null;
        const cloId = body.clo_id;

        const count = Math.min(
          Math.max(Number(body.count) || 5, 1),
          10
        );

        const additionalRequirements =
          String(body.additional_requirements || "").trim();

        if (!subjectId || !chapterId || !cloId) {
          return jsonError(
            "Thiếu học phần, chương hoặc CLO."
          );
        }

        const userId =
          ctx.userClaims?.sub ||
          ctx.userClaims?.id;

        if (!userId) {
          return jsonError(
            "Không xác định được người dùng.",
            401
          );
        }

        /*
         * Kiểm tra hồ sơ và vai trò người dùng.
         */
        const {
          data: profile,
          error: profileError
        } = await ctx.supabase
          .from("profiles")
          .select("id, full_name, role")
          .eq("id", userId)
          .single();

        if (profileError || !profile) {
          return jsonError(
            "Không tìm thấy hồ sơ người dùng.",
            403
          );
        }

        const isAdmin = profile.role === "admin";

        if (!isAdmin) {
          const {
            data: membership,
            error: membershipError
          } = await ctx.supabase
            .from("subject_members")
            .select("id, role")
            .eq("subject_id", subjectId)
            .eq("user_id", userId)
            .in("role", [
              "teacher",
              "lecturer",
              "giangvien"
            ])
            .maybeSingle();

          if (membershipError || !membership) {
            return jsonError(
              "Bạn không có quyền tạo câu hỏi cho học phần này.",
              403
            );
          }
        }

        /*
         * Đọc học phần, chương và CLO.
         */
        const [
          subjectResult,
          chapterResult,
          cloResult
        ] = await Promise.all([
          ctx.supabase
            .from("subjects")
            .select("id, name, semester, academic_year")
            .eq("id", subjectId)
            .single(),

          ctx.supabase
            .from("chapters")
            .select("id, subject_id, name, order_index")
            .eq("id", chapterId)
            .eq("subject_id", subjectId)
            .single(),

          ctx.supabase
            .from("clos")
            .select("id, subject_id, code, description")
            .eq("id", cloId)
            .eq("subject_id", subjectId)
            .single()
        ]);

        if (
          subjectResult.error ||
          chapterResult.error ||
          cloResult.error
        ) {
          return jsonError(
            "Học phần, chương hoặc CLO không hợp lệ."
          );
        }

        const subject = subjectResult.data;
        const chapter = chapterResult.data;
        const clo = cloResult.data;

        /*
         * Nếu có topic_id: chỉ lấy chủ đề được chọn.
         * Nếu topic_id rỗng: lấy tất cả chủ đề trong chương.
         */
        let selectedTopic = null;
        let topics: Array<{
          id: string;
          name: string;
          order_index: number;
        }> = [];

        if (topicId) {
          const {
            data: topic,
            error: topicError
          } = await ctx.supabase
            .from("topics")
            .select("id, chapter_id, name, order_index")
            .eq("id", topicId)
            .eq("chapter_id", chapterId)
            .single();

          if (topicError || !topic) {
            return jsonError(
              "Chủ đề không thuộc chương đã chọn."
            );
          }

          selectedTopic = topic;
          topics = [topic];
        } else {
          const {
            data: chapterTopics,
            error: topicsError
          } = await ctx.supabase
            .from("topics")
            .select("id, name, order_index")
            .eq("chapter_id", chapterId)
            .order("order_index");

          if (topicsError) {
            return jsonError(
              "Không thể đọc danh sách chủ đề."
            );
          }

          topics = chapterTopics || [];
        }

if (topics.length === 0) {
  return jsonError(
    "Chương này chưa có chủ đề. Hãy tạo ít nhất một chủ đề trước khi sinh câu hỏi."
  );
}
        const geminiModel = "auto";
        /*
         * Tạo bản ghi lưu lần yêu cầu Gemini.
         */
        const {
          data: batch,
          error: batchError
        } = await ctx.supabase
          .from("ai_generation_batches")
          .insert({
            subject_id: subjectId,
            chapter_id: chapterId,
            topic_id: topicId,
            clo_id: cloId,
            created_by: userId,
            requested_count: count,
            generated_count: 0,
            model: geminiModel,
            additional_requirements:
              additionalRequirements || null,
            status: "generating"
          })
          .select("id")
          .single();

        if (batchError || !batch) {
          throw new Error(
            batchError?.message ||
            "Không thể tạo phiên sinh câu hỏi."
          );
        }

        batchId = batch.id;

        const topicDescription = topicId
          ? `
Danh sách chủ đề:
1. ${selectedTopic?.name}

Chỉ tạo câu hỏi thuộc chủ đề này.
Mọi câu hỏi đều có topic_index bằng 1.
  `.trim()
          : topics.length > 0
            ? `
Tạo câu hỏi trong phạm vi toàn bộ chương.

Các chủ đề của chương:
${topics
  .map(
    (topic, index) =>
      `${index + 1}. ${topic.name}`
  )
  .join("\n")}

Phân bố câu hỏi tương đối hợp lý giữa các chủ đề.
Không bắt buộc mỗi chủ đề đều phải có câu hỏi.
              `.trim()
            : `
Tạo câu hỏi trong phạm vi toàn bộ chương.
Chương này chưa được chia thành các chủ đề nhỏ.
              `.trim();

        const prompt = `
Bạn là trợ lý chuyên môn hỗ trợ giảng viên đại học
xây dựng ngân hàng câu hỏi trắc nghiệm.

Hãy tạo chính xác ${count} câu hỏi với thông tin sau:

Học phần: ${subject.name}
Học kỳ: ${subject.semester}
Năm học: ${subject.academic_year}
Chương: ${chapter.name}
CLO: ${clo.code}

Mô tả đầy đủ của CLO:
${clo.description}

Hướng dẫn phân loại CLO:
${getCloGuidance(clo.code)}

Phạm vi nội dung:
${topicDescription}

Yêu cầu bắt buộc:

1. Mỗi câu có đúng bốn phương án A, B, C, D.
2. Chỉ có đúng một đáp án đúng.
3. Nội dung phải thuộc đúng chương và phù hợp với CLO.
4. Phương án nhiễu phải hợp lý và không quá dễ loại.
5. Không tạo các câu hỏi trùng nhau.
6. Không dùng phương án "tất cả đều đúng",
   "tất cả đều sai" hoặc các cách diễn đạt tương tự.
7. Công thức toán học phải viết bằng LaTeX
   và đặt trong dấu $...$.
8. Lời giải phải đủ rõ để giảng viên kiểm tra.
9. Không đề cập rằng câu hỏi được tạo bởi AI.
10. Không tự tạo CLO hoặc thay đổi phạm vi CLO.
11. Trả kết quả đúng cấu trúc JSON được yêu cầu.
12. Với mỗi câu, trường topic_index phải là số thứ tự
    của chủ đề phù hợp nhất trong danh sách chủ đề.
13. Nếu chỉ có một chủ đề thì topic_index luôn bằng 1.

Yêu cầu bổ sung của giảng viên:
${additionalRequirements || "Không có."}
        `.trim();

        const apiKey = Deno.env.get("GEMINI_API_KEY");

        if (!apiKey) {
          throw new Error(
            "Chưa cấu hình GEMINI_API_KEY."
          );
        }

        const geminiCall = await callGemini(apiKey, {
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: {
            responseMimeType: "application/json",
            responseJsonSchema: createQuestionSchema(count, topics.length)
          }
        });
        const geminiData = geminiCall.data;
        const actualModel = geminiCall.model;
        await ctx.supabase.from("ai_generation_batches")
          .update({ model: actualModel, updated_at: new Date().toISOString() })
          .eq("id", batchId);

        const generatedText =
          geminiData?.candidates?.[0]?.content
            ?.parts?.[0]?.text;

        if (!generatedText) {
          throw new Error(
            "Gemini không trả về nội dung câu hỏi."
          );
        }

        let generated;

        try {
          generated = JSON.parse(generatedText);
        } catch {
          throw new Error(
            "Kết quả Gemini không phải JSON hợp lệ."
          );
        }

        if (
          !Array.isArray(generated.questions) ||
          generated.questions.length === 0
        ) {
          throw new Error(
            "Gemini không tạo được câu hỏi phù hợp."
          );
        }

        /*
         * Lưu các câu vào bảng chờ giảng viên duyệt.
         */
        const draftRows = generated.questions.map(
  (
    question: Record<string, unknown>,
    index: number
  ) => {
    const requestedTopicIndex =
      Number(question.topic_index) || 1;

    const safeTopicIndex = Math.min(
      Math.max(requestedTopicIndex, 1),
      topics.length
    );

    const assignedTopic =
      topics[safeTopicIndex - 1];

    return {
      batch_id: batchId,
      topic_id: assignedTopic.id,
      order_index: index + 1,
      content: question.content,
      options: {
        A: question.option_a,
        B: question.option_b,
        C: question.option_c,
        D: question.option_d
      },
      correct_answer: question.correct_answer,
      explanation: question.explanation,
      review_status: "pending"
    };
  }
);

        const {
          data: drafts,
          error: draftsError
        } = await ctx.supabase
          .from("ai_question_drafts")
          .insert(draftRows)
          .select("*")
          .order("order_index");

        if (draftsError) {
          throw new Error(draftsError.message);
        }

        const {
          error: updateBatchError
        } = await ctx.supabase
          .from("ai_generation_batches")
          .update({
            generated_count: drafts.length,
            status: "reviewing",
            updated_at: new Date().toISOString()
          })
          .eq("id", batchId);

        if (updateBatchError) {
          throw new Error(updateBatchError.message);
        }

        return Response.json({
          success: true,
          batch_id: batchId,
          model: actualModel,
          total: drafts.length,
          context: {
            subject,
            chapter,
            selected_topic: selectedTopic,
            topics,
            clo
          },
          questions: drafts
        });
      } catch (error) {
        console.error("generate-questions error:", error);

        if (batchId) {
          await ctx.supabase
            .from("ai_generation_batches")
            .update({
              status: "failed",
              error_message:
                error instanceof Error
                  ? error.message
                  : String(error),
              updated_at: new Date().toISOString(),
              completed_at: new Date().toISOString()
            })
            .eq("id", batchId);
        }

        return jsonError(
          error instanceof Error
            ? error.message
            : "Có lỗi khi tạo câu hỏi.",
          500
        );
      }
    }
  )
} satisfies Deno.ServeDefaultExport;
