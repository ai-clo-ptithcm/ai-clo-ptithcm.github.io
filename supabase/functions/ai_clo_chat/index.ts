// ============================================================
// Supabase Edge Function: ai_clo_chat
// AI-CLO PTITHCM - V10.7.2
//
// Model: gemini-3.5-flash-lite
// Secret: GEMINI_LIVE_API_KEY
//
// Chức năng:
// - Chat text công khai cho AI-CLO
// - Streaming phản hồi
// - Chỉ giữ tối đa 4 lượt hội thoại gần nhất
// - Đọc knowledge từ GitHub
// - Cache knowledge 5 phút
// - Chỉ đưa tối đa 3 topic liên quan cho Gemini
// - maxOutputTokens = 400
// ============================================================

const MODEL = "gemini-3.5-flash-lite";

const MAX_HISTORY_MESSAGES = 8; // 4 lượt user + model
const MAX_TOPICS = 3;
const MAX_OUTPUT_TOKENS = 400;

const KNOWLEDGE_CACHE_MS = 5 * 60 * 1000;

// Ưu tiên main sau khi merge.
// Trong thời gian chưa merge, URL V10.7.2 giúp kiểm tra trước.
const KNOWLEDGE_URLS = [
  "https://raw.githubusercontent.com/ai-clo-ptithcm/ai-clo-ptithcm.github.io/main/data/ai-clo-knowledge.json",
  "https://raw.githubusercontent.com/ai-clo-ptithcm/ai-clo-ptithcm.github.io/V10.7.2/data/ai-clo-knowledge.json",
];

const ALLOWED_ORIGINS = new Set([
  "https://ai-clo-ptithcm.github.io",
  "http://localhost:5500",
  "http://127.0.0.1:5500",
]);

// System prompt cố ý ngắn để tiết kiệm input token.
const SYSTEM_PROMPT = `
Bạn là trợ lý AI-CLO PTITHCM.
Trả lời ngắn gọn, tự nhiên bằng tiếng Việt về AI-CLO, CLO và cách sử dụng hệ thống.
Chỉ dùng thông tin được cung cấp. Không bịa dữ liệu.
Nếu câu hỏi ngoài phạm vi AI-CLO, hãy nói ngắn gọn rằng bạn chỉ hỗ trợ về AI-CLO.
`.trim();

type KnowledgeTopic = {
  id?: string;
  title?: string;
  keywords?: string[];
  content?: string;
};

type KnowledgeData = {
  version?: string;
  language?: string;
  updated?: string;
  rules?: {
    scope?: string;
    dynamic_data?: string;
    style?: string;
  };
  topics?: KnowledgeTopic[];
};

type ChatHistoryItem = {
  role: "user" | "model";
  text: string;
};

// ============================================================
// Cache module-level
// Edge Function instance còn sống thì cache sẽ được tái sử dụng.
// ============================================================

let knowledgeCache: {
  data: KnowledgeData | null;
  loadedAt: number;
} = {
  data: null,
  loadedAt: 0,
};

// ============================================================
// Helpers
// ============================================================

function getCorsHeaders(origin: string | null) {
  const allowed =
    origin && ALLOWED_ORIGINS.has(origin)
      ? origin
      : "https://ai-clo-ptithcm.github.io";

  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Headers":
      "content-type, authorization, apikey, x-client-info",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
}

function jsonResponse(
  data: unknown,
  status: number,
  origin: string | null,
) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...getCorsHeaders(origin),
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

function cleanText(
  value: unknown,
  maxLength: number,
): string {
  if (typeof value !== "string") return "";

  return value
    .replace(/\u0000/g, "")
    .trim()
    .slice(0, maxLength);
}

// Chuẩn hóa để tìm từ khóa tiếng Việt dễ hơn.
function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9\s.-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(value: string): string[] {
  return normalizeText(value)
    .split(/\s+/)
    .filter((word) => word.length >= 2);
}

// ============================================================
// Knowledge loader
// ============================================================

async function fetchKnowledgeFromGitHub(): Promise<KnowledgeData | null> {
  for (const url of KNOWLEDGE_URLS) {
    try {
      const response = await fetch(url, {
        method: "GET",
        headers: {
          Accept: "application/json",
        },
        cache: "no-store",
      });

      if (!response.ok) {
        console.warn(
          "Knowledge fetch failed:",
          response.status,
          url,
        );
        continue;
      }

      const data = await response.json();

      if (
        !data ||
        !Array.isArray(data.topics)
      ) {
        console.warn(
          "Knowledge JSON không đúng cấu trúc:",
          url,
        );
        continue;
      }

      console.log(
        `Knowledge loaded: ${data.topics.length} topics`,
      );

      return data as KnowledgeData;
    } catch (error) {
      console.warn(
        "Knowledge fetch error:",
        url,
        error,
      );
    }
  }

  return null;
}

async function getKnowledge(): Promise<KnowledgeData> {
  const now = Date.now();

  if (
    knowledgeCache.data &&
    now - knowledgeCache.loadedAt < KNOWLEDGE_CACHE_MS
  ) {
    return knowledgeCache.data;
  }

  const fresh = await fetchKnowledgeFromGitHub();

  if (fresh) {
    knowledgeCache = {
      data: fresh,
      loadedAt: now,
    };

    return fresh;
  }

  // Nếu GitHub tạm lỗi nhưng cache cũ vẫn có,
  // tiếp tục dùng cache cũ.
  if (knowledgeCache.data) {
    console.warn(
      "Dùng knowledge cache cũ vì GitHub tạm lỗi.",
    );

    return knowledgeCache.data;
  }

  // Fallback tối thiểu để chat không chết hoàn toàn.
  return {
    version: "fallback",
    rules: {
      scope:
        "Chỉ trả lời về AI-CLO PTITHCM và cách sử dụng hệ thống.",
      dynamic_data:
        "Không tự bịa dữ liệu hoặc thông tin chưa được cung cấp.",
      style:
        "Trả lời ngắn gọn, rõ ràng bằng tiếng Việt.",
    },
    topics: [
      {
        id: "overview",
        title: "AI-CLO PTITHCM",
        keywords: [
          "ai-clo",
          "hệ thống",
          "giới thiệu",
          "clo",
        ],
        content:
          "AI-CLO PTITHCM là hệ thống ứng dụng trí tuệ nhân tạo hỗ trợ đánh giá sinh viên theo chuẩn đầu ra học phần.",
      },
    ],
  };
}

// ============================================================
// Chọn topic liên quan
// Không gọi AI cho bước retrieval -> không tốn Gemini token.
// ============================================================

function scoreTopic(
  question: string,
  topic: KnowledgeTopic,
): number {
  const normalizedQuestion = normalizeText(question);
  const questionTokens = new Set(
    tokenize(question),
  );

  let score = 0;

  const keywords = Array.isArray(topic.keywords)
    ? topic.keywords
    : [];

  for (const keyword of keywords) {
    const normalizedKeyword = normalizeText(keyword);

    if (!normalizedKeyword) continue;

    // Match cả cụm từ -> trọng số cao.
    if (
      normalizedQuestion.includes(normalizedKeyword)
    ) {
      score += normalizedKeyword.includes(" ")
        ? 8
        : 5;
    }

    // Match token -> bổ sung điểm.
    for (const token of tokenize(keyword)) {
      if (questionTokens.has(token)) {
        score += 1;
      }
    }
  }

  // Có thể match nhẹ theo title.
  if (topic.title) {
    const title = normalizeText(topic.title);

    if (
      title &&
      normalizedQuestion.includes(title)
    ) {
      score += 5;
    }
  }

  return score;
}

function selectRelevantTopics(
  question: string,
  knowledge: KnowledgeData,
): KnowledgeTopic[] {
  const topics = Array.isArray(knowledge.topics)
    ? knowledge.topics
    : [];

  const scored = topics
    .map((topic) => ({
      topic,
      score: scoreTopic(question, topic),
    }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);

  if (scored.length > 0) {
    return scored
      .slice(0, MAX_TOPICS)
      .map((item) => item.topic);
  }

  // Nếu câu hỏi chung chung không match rõ,
  // chỉ lấy overview để tránh gửi toàn bộ knowledge.
  const overview = topics.find(
    (topic) => topic.id === "overview",
  );

  return overview ? [overview] : [];
}

// ============================================================
// Tạo context rất ngắn cho Gemini
// ============================================================

function buildKnowledgeContext(
  knowledge: KnowledgeData,
  topics: KnowledgeTopic[],
): string {
  const parts: string[] = [];

  if (knowledge.rules?.dynamic_data) {
    parts.push(
      `Nguyên tắc: ${knowledge.rules.dynamic_data}`,
    );
  }

  if (knowledge.rules?.style) {
    parts.push(
      `Cách trả lời: ${knowledge.rules.style}`,
    );
  }

  for (const topic of topics) {
    if (!topic.content) continue;

    parts.push(
      `[${topic.title || topic.id || "Thông tin"}]\n${topic.content}`,
    );
  }

  // Chặn context quá lớn nếu file GitHub sau này phình ra.
  return parts
    .join("\n\n")
    .slice(0, 5000);
}

// ============================================================
// Chuẩn hóa history
// ============================================================

function buildHistory(
  rawHistory: unknown,
): ChatHistoryItem[] {
  if (!Array.isArray(rawHistory)) {
    return [];
  }

  const selected = rawHistory.slice(
    -MAX_HISTORY_MESSAGES,
  );

  const result: ChatHistoryItem[] = [];

  for (const item of selected) {
    if (!item || typeof item !== "object") {
      continue;
    }

    const role =
      item.role === "user"
        ? "user"
        : item.role === "model"
        ? "model"
        : null;

    if (!role) continue;

    // Giới hạn từng message lịch sử.
    const text = cleanText(item.text, 900);

    if (!text) continue;

    result.push({
      role,
      text,
    });
  }

  return result;
}

// ============================================================
// Chuyển history sang Gemini contents
// ============================================================

function buildGeminiContents(
  history: ChatHistoryItem[],
  message: string,
  knowledgeContext: string,
) {
  const contents: Array<{
    role: "user" | "model";
    parts: Array<{ text: string }>;
  }> = [];

  for (const item of history) {
    contents.push({
      role: item.role,
      parts: [
        {
          text: item.text,
        },
      ],
    });
  }

  // Knowledge chỉ chèn vào câu hỏi hiện tại.
  // Không đưa vào history để tránh lặp token.
  let currentMessage = message;

  if (knowledgeContext) {
    currentMessage =
      `THÔNG TIN THAM KHẢO:\n${knowledgeContext}\n\n` +
      `CÂU HỎI:\n${message}`;
  }

  contents.push({
    role: "user",
    parts: [
      {
        text: currentMessage,
      },
    ],
  });

  return contents;
}

// ============================================================
// SSE Gemini -> plain text streaming cho browser
// ============================================================

function createGeminiTextStream(
  geminiBody: ReadableStream<Uint8Array>,
): ReadableStream<Uint8Array> {
  const reader = geminiBody.getReader();

  const decoder = new TextDecoder();
  const encoder = new TextEncoder();

  let buffer = "";

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      function processEvent(event: string) {
        const lines = event.split("\n");

        for (const line of lines) {
          if (!line.startsWith("data:")) {
            continue;
          }

          const raw = line
            .slice(5)
            .trim();

          if (
            !raw ||
            raw === "[DONE]"
          ) {
            continue;
          }

          try {
            const payload = JSON.parse(raw);

            const parts =
              payload?.candidates?.[0]
                ?.content?.parts ?? [];

            for (const part of parts) {
              if (
                typeof part?.text === "string" &&
                part.text.length > 0
              ) {
                controller.enqueue(
                  encoder.encode(part.text),
                );
              }
            }
          } catch (error) {
            console.warn(
              "Không parse được Gemini SSE:",
              error,
            );
          }
        }
      }

      try {
        while (true) {
          const {
            value,
            done,
          } = await reader.read();

          if (done) break;

          buffer += decoder.decode(
            value,
            {
              stream: true,
            },
          );

          // Gemini thường dùng CRLF.
          buffer = buffer.replace(
            /\r\n/g,
            "\n",
          );

          let boundary = -1;

          while (
            (boundary =
              buffer.indexOf("\n\n")) >= 0
          ) {
            const event = buffer.slice(
              0,
              boundary,
            );

            buffer = buffer.slice(
              boundary + 2,
            );

            if (event.trim()) {
              processEvent(event);
            }
          }
        }

        buffer += decoder.decode();

        if (buffer.trim()) {
          processEvent(buffer);
        }

        controller.close();
      } catch (error) {
        console.error(
          "Gemini stream error:",
          error,
        );

        try {
          controller.error(error);
        } catch {
          // stream đã đóng
        }
      } finally {
        try {
          reader.releaseLock();
        } catch {
          // ignore
        }
      }
    },

    async cancel() {
      try {
        await reader.cancel();
      } catch {
        // Browser đóng chat giữa chừng.
      }
    },
  });
}

// ============================================================
// Main Edge Function
// ============================================================

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");

  // --------------------------------------------------------
  // CORS
  // --------------------------------------------------------

  if (
    origin &&
    !ALLOWED_ORIGINS.has(origin)
  ) {
    return jsonResponse(
      {
        ok: false,
        error: "Origin không được phép.",
      },
      403,
      origin,
    );
  }

  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: getCorsHeaders(origin),
    });
  }

  if (req.method !== "POST") {
    return jsonResponse(
      {
        ok: false,
        error: "Chỉ hỗ trợ phương thức POST.",
      },
      405,
      origin,
    );
  }

  try {
    // ------------------------------------------------------
    // API key
    // ------------------------------------------------------

    const apiKey =
      Deno.env.get("GEMINI_LIVE_API_KEY");

    if (!apiKey) {
      return jsonResponse(
        {
          ok: false,
          error:
            "Chưa cấu hình GEMINI_LIVE_API_KEY.",
        },
        500,
        origin,
      );
    }

    // ------------------------------------------------------
    // Request body
    // ------------------------------------------------------

    let requestBody: any;

    try {
      requestBody = await req.json();
    } catch {
      return jsonResponse(
        {
          ok: false,
          error:
            "Dữ liệu gửi lên không hợp lệ.",
        },
        400,
        origin,
      );
    }

    // Frontend cũng giới hạn 600.
    const message = cleanText(
      requestBody?.message,
      600,
    );

    if (!message) {
      return jsonResponse(
        {
          ok: false,
          error:
            "Vui lòng nhập câu hỏi.",
        },
        400,
        origin,
      );
    }

    // ------------------------------------------------------
    // History
    // ------------------------------------------------------

    const history = buildHistory(
      requestBody?.history,
    );

    // ------------------------------------------------------
    // Knowledge
    // ------------------------------------------------------

    const knowledge =
      await getKnowledge();

    const selectedTopics =
      selectRelevantTopics(
        message,
        knowledge,
      );

    const knowledgeContext =
      buildKnowledgeContext(
        knowledge,
        selectedTopics,
      );

    console.log(
      "AI-CLO topics:",
      selectedTopics.map(
        (topic) => topic.id,
      ),
    );

    // ------------------------------------------------------
    // Gemini contents
    // ------------------------------------------------------

    const contents =
      buildGeminiContents(
        history,
        message,
        knowledgeContext,
      );

    // ------------------------------------------------------
    // Gemini streaming API
    // ------------------------------------------------------

    const geminiUrl =
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:streamGenerateContent?alt=sse`;

    const geminiResponse =
      await fetch(geminiUrl, {
        method: "POST",

        headers: {
          "Content-Type":
            "application/json",

          "x-goog-api-key":
            apiKey,
        },

        body: JSON.stringify({
          systemInstruction: {
            parts: [
              {
                text: SYSTEM_PROMPT,
              },
            ],
          },

          contents,

          generationConfig: {
            maxOutputTokens:
              MAX_OUTPUT_TOKENS,

            temperature: 0.4,
          },
        }),
      });

    // ------------------------------------------------------
    // Gemini error
    // ------------------------------------------------------

    if (
      !geminiResponse.ok ||
      !geminiResponse.body
    ) {
      const errorText =
        await geminiResponse.text();

      console.error(
        "Gemini API error:",
        geminiResponse.status,
        errorText,
      );

      return jsonResponse(
        {
          ok: false,
          error:
            "Không thể nhận phản hồi từ AI-CLO.",
          detail:
            `Gemini HTTP ${geminiResponse.status}`,
        },
        502,
        origin,
      );
    }

    // ------------------------------------------------------
    // Convert Gemini SSE -> plain text stream
    // ------------------------------------------------------

    const outputStream =
      createGeminiTextStream(
        geminiResponse.body,
      );

    return new Response(
      outputStream,
      {
        status: 200,

        headers: {
          ...getCorsHeaders(origin),

          "Content-Type":
            "text/plain; charset=utf-8",

          "Cache-Control":
            "no-store, no-cache, must-revalidate",

          "X-Content-Type-Options":
            "nosniff",
        },
      },
    );
  } catch (error) {
    console.error(
      "ai_clo_chat error:",
      error,
    );

    return jsonResponse(
      {
        ok: false,
        error:
          "AI-CLO Chat gặp lỗi.",

        detail:
          error instanceof Error
            ? error.message
            : String(error),
      },
      500,
      origin,
    );
  }
});
