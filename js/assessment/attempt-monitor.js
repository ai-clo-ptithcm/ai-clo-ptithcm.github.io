/* AI-CLO PTITHCM — frontend-only attempt monitoring. */
(() => {
  "use strict";

  const POLL_MS = 500;
  const LEAVE_GRACE_MS = 1200;
  const SUPPRESS_MS = 900;
  const STRONG_WARNING_COUNT = 3;
  const LONG_AWAY_MS = 15000;
  const STORAGE_PREFIX = "aiclo:attempt-monitor:";

  let activeAttemptId = null;
  let missingSince = 0;
  let awayStartedAt = null;
  let incidentOpen = false;
  let suppressUntil = 0;
  let requestedFullscreen = false;
  let panel = null;
  let returnOverlay = null;

  const page = () => document.querySelector(".student-attempt-page[data-attempt-id]");
  const fullscreenTarget = () => document.querySelector("#app") || document.documentElement;
  const storageKey = (attemptId) => `${STORAGE_PREFIX}${attemptId}`;

  function readState(attemptId) {
    try {
      const raw = JSON.parse(sessionStorage.getItem(storageKey(attemptId)) || "null");
      return raw && typeof raw === "object"
        ? {
            violations: Number(raw.violations || 0),
            totalAwayMs: Number(raw.totalAwayMs || 0),
            events: Array.isArray(raw.events) ? raw.events.slice(-30) : [],
          }
        : { violations: 0, totalAwayMs: 0, events: [] };
    } catch {
      return { violations: 0, totalAwayMs: 0, events: [] };
    }
  }

  function writeState(attemptId, state) {
    try {
      sessionStorage.setItem(
        storageKey(attemptId),
        JSON.stringify({
          violations: Number(state.violations || 0),
          totalAwayMs: Number(state.totalAwayMs || 0),
          events: (state.events || []).slice(-30),
          updatedAt: Date.now(),
        }),
      );
    } catch {}
  }

  function formatAway(ms) {
    const sec = Math.max(0, Math.round(Number(ms || 0) / 1000));
    if (sec < 60) return `${sec} giây`;
    return `${Math.floor(sec / 60)} phút ${sec % 60} giây`;
  }

  function reasonText(reason) {
    if (reason === "tab_hidden") return "chuyển sang tab khác";
    if (reason === "fullscreen_exit") return "thoát chế độ toàn màn hình";
    return "rời cửa sổ làm bài";
  }

  function lastIncident(state) {
    return Array.isArray(state?.events) && state.events.length
      ? state.events[state.events.length - 1]
      : null;
  }

  function isStrongWarning(state, incident = lastIncident(state)) {
    return Number(state?.violations || 0) >= STRONG_WARNING_COUNT ||
      Number(incident?.durationMs || 0) >= LONG_AWAY_MS;
  }

  function removeReturnOverlay() {
    if (returnOverlay?.isConnected) returnOverlay.remove();
    returnOverlay = null;
  }

  function ensureAttemptFullscreenButton() {
    const current = page();
    if (!current) return null;
    const head = current.querySelector(".student-attempt-page-head");
    if (!head) return null;
    let button = head.querySelector("#attemptPageFullscreen");
    if (!button) {
      button = document.createElement("button");
      button.id = "attemptPageFullscreen";
      button.type = "button";
      button.className = "secondary compact attempt-fullscreen-button";
      button.addEventListener("click", () => requestFullscreen());
      head.appendChild(button);
    }
    const active = !!document.fullscreenElement;
    button.textContent = active ? "✓ Đang toàn màn hình" : "⛶ Mở toàn màn hình";
    button.disabled = active;
    button.setAttribute("aria-pressed", String(active));
    button.title = active
      ? "Đang ở chế độ toàn màn hình. Nhấn Esc để thoát."
      : "Mở giao diện làm bài ở chế độ toàn màn hình";
    return button;
  }

  function showReturnOverlay(state, incident) {
    const current = page();
    if (!current || !activeAttemptId || !incident) return;
    removeReturnOverlay();
    const duration = Number(incident.durationMs || 0);
    const strong = isStrongWarning(state, incident);
    const overlay = document.createElement("div");
    overlay.className = `attempt-return-overlay${strong ? " strong" : ""}`;
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-labelledby", "attemptReturnTitle");
    overlay.innerHTML = `
      <div class="attempt-return-card">
        <div class="attempt-return-icon" aria-hidden="true">${strong ? "!" : "↩"}</div>
        <small>${strong ? "CẢNH BÁO PHIÊN LÀM BÀI" : "ĐÃ GHI NHẬN RỜI MÀN HÌNH"}</small>
        <h3 id="attemptReturnTitle">Bạn vừa quay lại bài làm</h3>
        <p>Hệ thống ghi nhận bạn vừa ${reasonText(incident.type)}.</p>
        <div class="attempt-return-stats">
          <span><small>Thời gian rời</small><b>${formatAway(duration)}</b></span>
          <span><small>Số lần đã ghi nhận</small><b>${Number(state.violations || 0)}</b></span>
        </div>
        <p class="attempt-return-note">Đồng hồ làm bài vẫn tiếp tục chạy. Câu đang làm và đáp án đã chọn được giữ nguyên.</p>
        ${strong ? '<p class="attempt-return-alert">Phiên làm bài đã có mức cảnh báo cao do rời màn hình nhiều lần hoặc trong thời gian dài.</p>' : ""}
        <div class="attempt-return-actions">
          <button type="button" class="secondary" data-attempt-return-continue>Tiếp tục làm bài</button>
          <button type="button" class="primary" data-attempt-return-fullscreen>${document.fullscreenElement ? "Tiếp tục làm bài" : "Tiếp tục và bật toàn màn hình"}</button>
        </div>
      </div>
    `;
    (document.querySelector("#app") || document.body).appendChild(overlay);
    returnOverlay = overlay;

    const dismiss = () => {
      removeReturnOverlay();
      renderPanel();
      page()?.querySelector('input[name="v122LiveAnswer"]:checked')?.focus?.({ preventScroll: true });
    };
    overlay.querySelector("[data-attempt-return-continue]")?.addEventListener("click", dismiss);
    overlay.querySelector("[data-attempt-return-fullscreen]")?.addEventListener("click", async () => {
      if (document.fullscreenElement || await requestFullscreen()) dismiss();
    });
    requestAnimationFrame(() =>
      overlay.querySelector("[data-attempt-return-fullscreen]")?.focus?.({ preventScroll: true }),
    );
  }

  function ensurePanel() {
    if (panel?.isConnected) return panel;
    const sidebar = document.querySelector("#app > aside");
    if (!sidebar) return null;
    panel = document.createElement("section");
    panel.id = "attemptMonitorPanel";
    panel.className = "attempt-monitor";
    panel.hidden = true;
    panel.setAttribute("aria-live", "polite");
    panel.innerHTML = `
      <div class="attempt-monitor-head">
        <span class="attempt-monitor-dot" aria-hidden="true"></span>
        <div><b>Giám sát phiên làm bài</b><small id="attemptMonitorText">Đang theo dõi việc rời màn hình trên thiết bị này.</small></div>
      </div>
      <div class="attempt-monitor-stats">
        <span><small>Rời màn hình</small><b id="attemptMonitorCount">0</b></span>
        <span><small>Tổng thời gian</small><b id="attemptMonitorAway">0 giây</b></span>
      </div>
      <button id="attemptMonitorFullscreen" type="button" class="secondary compact">Bật toàn màn hình</button>
    `;
    const foot = sidebar.querySelector(".aside-foot");
    if (foot) sidebar.insertBefore(panel, foot);
    else sidebar.appendChild(panel);
    panel.querySelector("#attemptMonitorFullscreen")?.addEventListener("click", () => requestFullscreen());
    return panel;
  }

  function renderPanel(message = "") {
    if (!activeAttemptId) return;
    ensureAttemptFullscreenButton();
    const box = ensurePanel();
    if (!box) return;
    const state = readState(activeAttemptId);
    const strong = isStrongWarning(state);
    const persistentMessage = strong
      ? `Cảnh báo: phiên làm bài đã rời màn hình ${state.violations} lần.`
      : "";
    const displayMessage = message || persistentMessage;
    box.hidden = false;
    box.classList.toggle("warning", !!displayMessage);
    const text = box.querySelector("#attemptMonitorText");
    const count = box.querySelector("#attemptMonitorCount");
    const away = box.querySelector("#attemptMonitorAway");
    const fullscreen = box.querySelector("#attemptMonitorFullscreen");
    if (text)
      text.textContent =
        displayMessage ||
        (document.fullscreenElement
          ? "Đang toàn màn hình. Hệ thống sẽ cảnh báo khi bạn rời tab hoặc cửa sổ."
          : "Bạn đang ngoài chế độ toàn màn hình. Có thể bật lại bên dưới.");
    if (count) count.textContent = String(state.violations || 0);
    if (away) {
      const liveAway = awayStartedAt ? Date.now() - awayStartedAt : 0;
      away.textContent = formatAway((state.totalAwayMs || 0) + liveAway);
    }
    if (fullscreen) {
      fullscreen.hidden = !!document.fullscreenElement;
      fullscreen.disabled = !!document.fullscreenElement;
    }
  }

  function activate(attemptId) {
    if (!attemptId) return;
    if (String(activeAttemptId) === String(attemptId)) {
      renderPanel();
      return;
    }
    removeReturnOverlay();
    activeAttemptId = String(attemptId);
    missingSince = 0;
    awayStartedAt = null;
    incidentOpen = false;
    renderPanel();
  }

  async function exitRequestedFullscreen() {
    if (!requestedFullscreen || !document.fullscreenElement || !document.exitFullscreen) return;
    suppressUntil = Date.now() + SUPPRESS_MS;
    try {
      await document.exitFullscreen();
    } catch {}
  }

  async function deactivate() {
    if (!activeAttemptId) return;
    endAway({ showOverlay: false });
    removeReturnOverlay();
    activeAttemptId = null;
    missingSince = 0;
    incidentOpen = false;
    awayStartedAt = null;
    if (panel) panel.hidden = true;
    await exitRequestedFullscreen();
    requestedFullscreen = false;
  }

  function startAway(reason) {
    if (!activeAttemptId || Date.now() < suppressUntil || incidentOpen) return;
    incidentOpen = true;
    awayStartedAt = Date.now();
    const state = readState(activeAttemptId);
    state.violations += 1;
    state.events.push({ type: reason, at: new Date().toISOString() });
    writeState(activeAttemptId, state);
    renderPanel(`Cảnh báo: bạn vừa rời màn hình (${state.violations} lần).`);
  }

  function endAway({ showOverlay = true } = {}) {
    if (!activeAttemptId || !incidentOpen) return;
    const state = readState(activeAttemptId);
    const duration = awayStartedAt ? Math.max(0, Date.now() - awayStartedAt) : 0;
    state.totalAwayMs += duration;
    let incident = null;
    if (state.events.length) {
      incident = state.events[state.events.length - 1];
      if (incident && !incident.durationMs) incident.durationMs = duration;
    }
    writeState(activeAttemptId, state);
    incidentOpen = false;
    awayStartedAt = null;
    renderPanel();
    if (showOverlay && incident) showReturnOverlay(state, incident);
  }

  async function requestFullscreen() {
    if (!activeAttemptId || !page()) return false;
    if (document.fullscreenElement) {
      renderPanel();
      return true;
    }
    const target = fullscreenTarget();
    if (!target?.requestFullscreen) {
      renderPanel("Trình duyệt này không hỗ trợ toàn màn hình từ trang web.");
      return false;
    }
    suppressUntil = Date.now() + SUPPRESS_MS;
    try {
      await target.requestFullscreen();
      requestedFullscreen = true;
      renderPanel();
      return true;
    } catch (error) {
      console.warn("AI-CLO attempt fullscreen", error);
      renderPanel("Không thể bật toàn màn hình. Hãy thử lại bằng nút Mở toàn màn hình trên bài làm.");
      return false;
    }
  }

  document.addEventListener("visibilitychange", () => {
    if (!activeAttemptId) return;
    if (document.hidden) startAway("tab_hidden");
    else if (document.hasFocus()) endAway();
  });

  window.addEventListener("blur", () => {
    if (!activeAttemptId) return;
    window.setTimeout(() => {
      if (!activeAttemptId || Date.now() < suppressUntil) return;
      startAway(document.hidden ? "tab_hidden" : "window_blur");
    }, 80);
  });

  window.addEventListener("focus", () => {
    if (!activeAttemptId || document.hidden) return;
    endAway();
  });

  document.addEventListener("fullscreenchange", () => {
    ensureAttemptFullscreenButton();
    if (!activeAttemptId) return;
    if (!document.fullscreenElement && requestedFullscreen && Date.now() >= suppressUntil) {
      window.setTimeout(() => {
        if (!activeAttemptId || incidentOpen || Date.now() < suppressUntil) return;
        if (document.hidden) {
          startAway("tab_hidden");
          return;
        }
        startAway("fullscreen_exit");
        window.setTimeout(() => {
          if (document.hasFocus() && !document.hidden) endAway();
        }, 250);
      }, 150);
    }
    renderPanel();
  });

  window.setInterval(() => {
    const current = page();
    if (current) {
      missingSince = 0;
      activate(current.dataset.attemptId || "unknown");
      ensureAttemptFullscreenButton();
      renderPanel();
      return;
    }
    if (!activeAttemptId) return;
    if (!missingSince) {
      missingSince = Date.now();
      return;
    }
    if (Date.now() - missingSince >= LEAVE_GRACE_MS) deactivate();
  }, POLL_MS);

  window.AICLO_ATTEMPT_MONITOR = Object.freeze({
    version: "frontend-only-4",
    activeAttemptId: () => activeAttemptId,
    snapshot: () => (activeAttemptId ? readState(activeAttemptId) : null),
    requestFullscreen,
  });
})();
