(() => {
  const CHAT_URL = "https://rraooqedkpyhokattwdz.supabase.co/functions/v1/ai_clo_chat";
  const MAX_HISTORY_MESSAGES = 8; // 4 lượt gần nhất (user + model)
  const history = [];
  let sending = false;
  let activeController = null;

  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => [...root.querySelectorAll(s)];

  function ensurePanel() {
    if ($("#aiChatBackdrop")) return;
    const node = document.createElement("div");
    node.id = "aiChatBackdrop";
    node.className = "ai-chat-backdrop";
    node.hidden = true;
    node.innerHTML = `
      <section class="ai-chat-panel" role="dialog" aria-modal="true" aria-labelledby="aiChatTitle">
        <header class="ai-chat-head">
          <div class="ai-chat-icon" aria-hidden="true">💬</div>
          <div class="ai-chat-title"><small>AI-CLO ASSISTANT</small><h2 id="aiChatTitle">Hỏi AI-CLO</h2></div>
          <button class="ai-chat-close" type="button" aria-label="Đóng">×</button>
        </header>
        <div class="ai-chat-body">
          <p class="ai-chat-intro">Hỏi về AI-CLO PTITHCM, chức năng của hệ thống hoặc cách sử dụng.</p>
          <div class="ai-chat-messages" aria-live="polite">
            <div class="ai-chat-message ai">Xin chào! Tôi là trợ lý AI-CLO. Bạn muốn tìm hiểu điều gì về hệ thống?</div>
          </div>
          <div class="ai-chat-hints">
            <button type="button" class="ai-chat-hint">Giới thiệu hệ thống</button>
            <button type="button" class="ai-chat-hint">AI hỗ trợ những gì?</button>
            <button type="button" class="ai-chat-hint">Cách sử dụng Chấm thi CLO?</button>
          </div>
          <form class="ai-chat-form">
            <textarea class="ai-chat-input" rows="1" maxlength="600" placeholder="Nhập câu hỏi..." aria-label="Nhập câu hỏi cho AI-CLO"></textarea>
            <button class="ai-chat-send" type="submit">Gửi</button>
          </form>
          <p class="ai-chat-note">AI chỉ trả lời về AI-CLO và hướng dẫn sử dụng. Không nhập thông tin cá nhân hoặc dữ liệu nhạy cảm.</p>
        </div>
      </section>`;
    document.body.appendChild(node);

    $(".ai-chat-close", node).addEventListener("click", closePanel);
    node.addEventListener("click", (e) => { if (e.target === node) closePanel(); });
    $(".ai-chat-form", node).addEventListener("submit", (e) => {
      e.preventDefault();
      const input = $(".ai-chat-input", node);
      const text = input.value.trim();
      if (!text) return;
      input.value = "";
      void ask(text);
    });
    $$(".ai-chat-hint", node).forEach((btn) => btn.addEventListener("click", () => void ask(btn.textContent.trim())));
    $(".ai-chat-input", node).addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        const text = e.currentTarget.value.trim();
        if (!text) return;
        e.currentTarget.value = "";
        void ask(text);
      }
    });
  }

  function openPanel() {
    ensurePanel();
    $("#aiChatBackdrop").hidden = false;
    document.documentElement.style.overflow = "hidden";
    setTimeout(() => $(".ai-chat-input")?.focus(), 30);
  }

  function closePanel() {
    if (activeController) activeController.abort();
    activeController = null;
    setSending(false);
    const panel = $("#aiChatBackdrop");
    if (panel) panel.hidden = true;
    document.documentElement.style.overflow = "";
  }

  function addMessage(role, text, extraClass = "") {
    const host = $(".ai-chat-messages");
    if (!host) return null;
    const item = document.createElement("div");
    item.className = `ai-chat-message ${role}${extraClass ? ` ${extraClass}` : ""}`;
    item.textContent = text;
    host.appendChild(item);
    host.scrollTop = host.scrollHeight;
    return item;
  }

  function setSending(value) {
    sending = value;
    const send = $(".ai-chat-send");
    const input = $(".ai-chat-input");
    if (send) { send.disabled = value; send.textContent = value ? "Đang trả lời…" : "Gửi"; }
    if (input) input.disabled = value;
  }

  function recentHistory() {
    return history.slice(-MAX_HISTORY_MESSAGES);
  }

  async function readStream(response, target) {
    if (!response.body) throw new Error("Trình duyệt không nhận được luồng phản hồi.");
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fullText = "";

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      if (!chunk) continue;
      fullText += chunk;
      if (target) {
        target.classList.remove("pending");
        target.textContent = fullText;
        const host = $(".ai-chat-messages");
        if (host) host.scrollTop = host.scrollHeight;
      }
    }

    fullText += decoder.decode();
    return fullText.trim();
  }

  async function ask(text) {
    if (sending || !text) return;

    // Chỉ gửi lịch sử trước câu hỏi hiện tại; tối đa 4 lượt gần nhất.
    const context = recentHistory();
    addMessage("user", text);
    const pending = addMessage("ai", "AI-CLO đang trả lời…", "pending");
    setSending(true);
    activeController = new AbortController();

    try {
      const response = await fetch(CHAT_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, history: context }),
        cache: "no-store",
        signal: activeController.signal,
      });

      const contentType = response.headers.get("content-type") || "";
      if (!response.ok || contentType.includes("application/json")) {
        const data = await response.json().catch(() => ({}));
        if (!response.ok || data.ok === false) {
          throw new Error(data.detail || data.error || `Không thể kết nối AI-CLO (${response.status}).`);
        }
        const reply = String(data.reply || "").trim();
        if (!reply) throw new Error("AI-CLO chưa trả về nội dung.");
        if (pending) { pending.classList.remove("pending"); pending.textContent = reply; }
        history.push({ role: "user", text }, { role: "model", text: reply });
      } else {
        const reply = await readStream(response, pending);
        if (!reply) throw new Error("AI-CLO chưa trả về nội dung.");
        history.push({ role: "user", text }, { role: "model", text: reply });
      }

      if (history.length > MAX_HISTORY_MESSAGES) {
        history.splice(0, history.length - MAX_HISTORY_MESSAGES);
      }
    } catch (error) {
      if (error?.name === "AbortError") return;
      if (pending) {
        pending.classList.remove("pending");
        pending.textContent = error?.message || "Không thể nhận phản hồi từ AI-CLO. Vui lòng thử lại.";
      }
    } finally {
      activeController = null;
      setSending(false);
      $(".ai-chat-input")?.focus();
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    ensurePanel();
    $$(".public-ai-button").forEach((btn) => btn.addEventListener("click", openPanel));
  });
})();
