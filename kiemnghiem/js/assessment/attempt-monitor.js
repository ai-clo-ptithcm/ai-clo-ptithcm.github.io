/* AI-CLO PTITHCM — frontend-only attempt monitoring for staging. */
(() => {
  "use strict";

  const POLL_MS = 500;
  const LEAVE_GRACE_MS = 1200;
  const SUPPRESS_MS = 900;
  const STORAGE_PREFIX = "aiclo:attempt-monitor:";

  let activeAttemptId = null;
  let missingSince = 0;
  let awayStartedAt = null;
  let incidentOpen = false;
  let suppressUntil = 0;
  let requestedFullscreen = false;
  let overlay = null;

  const page = () => document.querySelector(".student-attempt-page[data-attempt-id]");
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

  function ensureOverlay() {
    if (overlay?.isConnected) return overlay;
    overlay = document.createElement("aside");
    overlay.id = "attemptMonitorOverlay";
    overlay.className = "attempt-monitor";
    overlay.hidden = true;
    overlay.setAttribute("aria-live", "polite");
    overlay.innerHTML = `
      <div class="attempt-monitor-main">
        <span class="attempt-monitor-dot" aria-hidden="true"></span>
        <div><b>Giám sát phiên làm bài</b><small id="attemptMonitorText">Đang theo dõi việc rời màn hình trên thiết bị này.</small></div>
      </div>
      <div class="attempt-monitor-stats">
        <span><small>Rời màn hình</small><b id="attemptMonitorCount">0</b></span>
        <span><small>Tổng thời gian</small><b id="attemptMonitorAway">0 giây</b></span>
      </div>
      <button id="attemptMonitorFullscreen" type="button" class="secondary compact">Bật toàn màn hình</button>
    `;
    document.body.appendChild(overlay);
    overlay.querySelector("#attemptMonitorFullscreen")?.addEventListener("click", requestFullscreen);
    return overlay;
  }

  function renderOverlay(message = "") {
    if (!activeAttemptId) return;
    const box = ensureOverlay();
    const state = readState(activeAttemptId);
    box.hidden = false;
    box.classList.toggle("warning", !!message);
    const text = box.querySelector("#attemptMonitorText");
    const count = box.querySelector("#attemptMonitorCount");
    const away = box.querySelector("#attemptMonitorAway");
    const fullscreen = box.querySelector("#attemptMonitorFullscreen");
    if (text)
      text.textContent =
        message ||
        (document.fullscreenElement
          ? "Đang ở chế độ toàn màn hình. Hệ thống sẽ cảnh báo khi rời màn hình."
          : "Nên bật toàn màn hình. Hệ thống sẽ cảnh báo khi bạn rời tab hoặc cửa sổ.");
    if (count) count.textContent = String(state.violations || 0);
    if (away) {
      const liveAway = awayStartedAt ? Date.now() - awayStartedAt : 0;
      away.textContent = formatAway((state.totalAwayMs || 0) + liveAway);
    }
    if (fullscreen) {
      fullscreen.textContent = document.fullscreenElement ? "Đang toàn màn hình" : "Bật toàn màn hình";
      fullscreen.disabled = !!document.fullscreenElement;
    }
  }

  function activate(attemptId) {
    if (!attemptId) return;
    if (String(activeAttemptId) === String(attemptId)) {
      renderOverlay();
      return;
    }
    activeAttemptId = String(attemptId);
    missingSince = 0;
    awayStartedAt = null;
    incidentOpen = false;
    requestedFullscreen = false;
    renderOverlay();
  }

  async function deactivate() {
    if (!activeAttemptId) return;
    endAway();
    activeAttemptId = null;
    missingSince = 0;
    incidentOpen = false;
    awayStartedAt = null;
    if (overlay) overlay.hidden = true;
    if (requestedFullscreen && document.fullscreenElement && document.exitFullscreen) {
      suppressUntil = Date.now() + SUPPRESS_MS;
      try {
        await document.exitFullscreen();
      } catch {}
    }
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
    renderOverlay(`Cảnh báo: bạn vừa rời màn hình làm bài (${state.violations} lần).`);
  }

  function endAway() {
    if (!activeAttemptId || !incidentOpen) return;
    const state = readState(activeAttemptId);
    const duration = awayStartedAt ? Math.max(0, Date.now() - awayStartedAt) : 0;
    state.totalAwayMs += duration;
    if (state.events.length) {
      const last = state.events[state.events.length - 1];
      if (last && !last.durationMs) last.durationMs = duration;
    }
    writeState(activeAttemptId, state);
    incidentOpen = false;
    awayStartedAt = null;
    renderOverlay();
  }

  async function requestFullscreen() {
    if (!activeAttemptId || document.fullscreenElement) return;
    const target = document.documentElement;
    if (!target.requestFullscreen) {
      renderOverlay("Trình duyệt này không hỗ trợ chế độ toàn màn hình từ trang web.");
      return;
    }
    suppressUntil = Date.now() + SUPPRESS_MS;
    try {
      await target.requestFullscreen();
      requestedFullscreen = true;
      renderOverlay();
    } catch {
      renderOverlay("Không thể bật toàn màn hình. Bạn có thể tiếp tục làm bài nhưng hệ thống vẫn theo dõi việc rời màn hình.");
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
    if (!activeAttemptId) return;
    if (!document.fullscreenElement && requestedFullscreen && Date.now() >= suppressUntil) {
      startAway("fullscreen_exit");
      window.setTimeout(() => {
        if (document.hasFocus() && !document.hidden) endAway();
      }, 250);
    }
    renderOverlay();
  });

  window.setInterval(() => {
    const current = page();
    if (current) {
      missingSince = 0;
      activate(current.dataset.attemptId || "unknown");
      renderOverlay();
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
    version: "frontend-only-1",
    activeAttemptId: () => activeAttemptId,
    snapshot: () => (activeAttemptId ? readState(activeAttemptId) : null),
    requestFullscreen,
  });
})();
