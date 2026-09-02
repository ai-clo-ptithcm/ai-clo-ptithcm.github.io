(() => {
  const CHAT_URL = "https://rraooqedkpyhokattwdz.supabase.co/functions/v1/ai_clo_chat";
  const MAX_HISTORY_MESSAGES = 8;
  const history = [];
  let sending = false;
  let activeController = null;
  let appContext = null;

  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => [...root.querySelectorAll(s)];
  const ROLE_LABELS = { admin: "Quản trị viên", teacher: "Giảng viên", lecturer: "Giảng viên", giangvien: "Giảng viên", student: "Sinh viên" };

  function setupPublicNav() {
    const header = $(".public-nav");
    const nav = header?.querySelector(".public-nav-links");
    const ai = header?.querySelector(".public-ai-button");
    if (!header || !nav || !ai || header.dataset.unifiedNav === "1") return;
    const links = [...nav.querySelectorAll("a")];
    const home = nav.querySelector(".public-home-link");
    const guide = links.find((a) => a.getAttribute("href")?.includes("huong-dan"));
    const system = nav.querySelector(".public-system-link");
    links.filter((a) => a.getAttribute("href")?.includes("gioi-thieu")).forEach((a) => a.remove());
    if (home) { home.textContent = "Trang chủ"; home.setAttribute("aria-label", "Trang chủ"); home.title = "Trang chủ"; }
    if (guide) guide.textContent = "Hướng dẫn AI-CLO";
    const actions = document.createElement("div");
    actions.className = "public-nav-actions";
    actions.append(ai);
    if (system) actions.append(system);
    header.append(actions);
    header.classList.add("public-nav-unified");
    header.dataset.unifiedNav = "1";
    if (!$("#publicNavUnifiedStyle")) {
      const style = document.createElement("style");
      style.id = "publicNavUnifiedStyle";
      style.textContent = `
        .public-nav.public-nav-unified{display:grid!important;grid-template-columns:minmax(0,1fr) auto!important;grid-template-areas:'links actions'!important;align-items:center!important;gap:18px!important}
        .public-nav-unified .public-nav-links{grid-area:links!important;margin:0!important;display:flex!important;align-items:center!important;gap:22px!important;min-width:0!important;overflow:visible!important;padding:0!important}
        .public-nav-unified .public-nav-links a{font-size:14px!important;line-height:1.2!important}
        .public-nav-unified .public-home-link{display:inline-flex!important;width:auto!important;height:auto!important;border-radius:0!important;background:transparent!important;font-size:14px!important;padding:0!important}
        .public-nav-unified .public-nav-actions{grid-area:actions;display:grid;grid-template-columns:auto auto;gap:10px;align-items:center}
        .public-nav-unified .public-nav-actions .public-ai-button,.public-nav-unified .public-nav-actions .public-system-link{min-height:42px;display:inline-flex!important;align-items:center;justify-content:center;border-radius:12px!important;padding:0 15px!important;font-weight:800!important;white-space:nowrap;text-decoration:none}
        .public-nav-unified .public-nav-actions .public-ai-button{border:1px solid #a98bc7!important;background:#f5effc!important;color:#60358a!important}
        .public-nav-unified .public-nav-actions .public-ai-button:hover{background:#ede2f8!important;border-color:#8f6bb5!important}
        .public-nav-unified .public-nav-actions .public-system-link{border:1px solid #a61d2d!important;background:#a61d2d!important;color:#fff!important}
        @media(max-width:760px){
          body.v107-public{padding-top:96px!important}
          .public-nav.public-nav-unified{height:96px!important;min-height:96px!important;padding:5px 14px!important;grid-template-columns:1fr!important;grid-template-rows:34px 42px!important;grid-template-areas:'links' 'actions'!important;gap:4px!important}
          .public-nav-unified .public-nav-links{width:100%!important;display:grid!important;grid-template-columns:.85fr 1.45fr 1.1fr!important;gap:5px!important;align-items:center!important}
          .public-nav-unified .public-nav-links a{min-width:0!important;text-align:center!important;font-size:12.5px!important;padding:3px 2px!important;white-space:nowrap!important}
          .public-nav-unified .public-home-link{justify-content:center!important}
          .public-nav-unified .public-nav-actions{width:100%;grid-template-columns:1fr 1fr;gap:9px}
          .public-nav-unified .public-nav-actions .public-ai-button,.public-nav-unified .public-nav-actions .public-system-link{width:100%!important;min-height:40px!important;padding:0 10px!important;font-size:14px!important}
        }
      `;
      document.head.append(style);
    }
  }

  function ensurePanel() {
    if ($("#aiChatBackdrop")) return;
    const node = document.createElement("div");
    node.id = "aiChatBackdrop";
    node.className = "ai-chat-backdrop";
    node.hidden = true;
    node.innerHTML = `
      <section class="ai-chat-panel" role="dialog" aria-modal="true" aria-labelledby="aiChatTitle">
        <header class="ai-chat-head">
          <div class="ai-chat-icon" aria-hidden="true">✦</div>
          <div class="ai-chat-title"><small>AI-CLO</small><h2 id="aiChatTitle">Hỏi AI-CLO</h2></div>
          <button class="ai-chat-close" type="button" aria-label="Đóng">×</button>
        </header>
        <div class="ai-chat-body">
          <p class="ai-chat-intro">Hỏi nhanh về hệ thống, học phần, CLO và cách sử dụng.</p>
          <div class="ai-chat-context" id="aiChatContext" hidden></div>
          <div class="ai-chat-messages" aria-live="polite">
            <div class="ai-chat-message ai">Xin chào! Bạn muốn hỏi gì về AI-CLO?</div>
          </div>
          <div class="ai-chat-hints" aria-label="Gợi ý câu hỏi">
            <button type="button" class="ai-chat-hint">Hệ thống hoạt động thế nào?</button>
            <button type="button" class="ai-chat-hint">Cách thêm câu hỏi?</button>
            <button type="button" class="ai-chat-hint">Cách xem kết quả CLO?</button>
          </div>
          <form class="ai-chat-form">
            <textarea class="ai-chat-input" rows="1" maxlength="600" placeholder="Nhập câu hỏi..." aria-label="Nhập câu hỏi cho AI-CLO"></textarea>
            <button class="ai-chat-send" type="submit">Gửi</button>
          </form>
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

  function renderContext() {
    const box = $("#aiChatContext");
    if (!box) return;
    if (!appContext) { box.hidden = true; box.textContent = ""; return; }
    const bits = [];
    if (appContext.role) bits.push(ROLE_LABELS[appContext.role] || appContext.role);
    if (appContext.subject) bits.push(appContext.subject);
    box.textContent = bits.length ? `Ngữ cảnh: ${bits.join(" · ")}` : "";
    box.hidden = !bits.length;
  }

  function openPanel(context = null) {
    ensurePanel();
    appContext = context && typeof context === "object" ? {
      role: String(context.role || "").slice(0, 30),
      view: String(context.view || "").slice(0, 40),
      space: String(context.space || "").slice(0, 20),
      subject: String(context.subject || "").slice(0, 120),
    } : null;
    renderContext();
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

  function recentHistory() { return history.slice(-MAX_HISTORY_MESSAGES); }

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
    const context = recentHistory();
    addMessage("user", text);
    const pending = addMessage("ai", "AI-CLO đang trả lời…", "pending");
    setSending(true);
    activeController = new AbortController();
    try {
      const response = await fetch(CHAT_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, history: context, context: appContext }),
        cache: "no-store",
        signal: activeController.signal,
      });
      const contentType = response.headers.get("content-type") || "";
      if (!response.ok || contentType.includes("application/json")) {
        const data = await response.json().catch(() => ({}));
        if (!response.ok || data.ok === false) throw new Error(data.detail || data.error || `Không thể kết nối AI-CLO (${response.status}).`);
        const reply = String(data.reply || "").trim();
        if (!reply) throw new Error("AI-CLO chưa trả về nội dung.");
        if (pending) { pending.classList.remove("pending"); pending.textContent = reply; }
        history.push({ role: "user", text }, { role: "model", text: reply });
      } else {
        const reply = await readStream(response, pending);
        if (!reply) throw new Error("AI-CLO chưa trả về nội dung.");
        history.push({ role: "user", text }, { role: "model", text: reply });
      }
      if (history.length > MAX_HISTORY_MESSAGES) history.splice(0, history.length - MAX_HISTORY_MESSAGES);
    } catch (error) {
      if (error?.name === "AbortError") return;
      if (pending) { pending.classList.remove("pending"); pending.textContent = error?.message || "Không thể nhận phản hồi từ AI-CLO. Vui lòng thử lại."; }
    } finally {
      activeController = null;
      setSending(false);
      $(".ai-chat-input")?.focus();
    }
  }

  window.AICLO_CHAT = { open: openPanel, close: closePanel, ask };
  document.addEventListener("DOMContentLoaded", () => {
    setupPublicNav();
    ensurePanel();
    $$(".public-ai-button").forEach((btn) => btn.addEventListener("click", () => openPanel()));
  });
})();
