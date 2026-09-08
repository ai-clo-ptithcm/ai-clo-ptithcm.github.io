/* AI-CLO PTITHCM V12.6.35 — monitored student attempt + resilient mobile/iOS Live telemetry. */
(() => {
  "use strict";

  const POLL_MS = 500;
  const HEARTBEAT_MS = 5000;
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
  let liveStateAvailable = null;
  let incidentSyncAvailable = null;
  let lastHeartbeatAt = 0;
  let legacyServerEventId = null;
  let legacyServerEventPromise = null;
  let missingCheckBusy = false;
  let flushBusy = false;

  const page = () => document.querySelector(".student-attempt-page[data-attempt-id]");
  const fullscreenTarget = () => document.querySelector("#app") || document.documentElement;
  const storageKey = (attemptId) => `${STORAGE_PREFIX}${attemptId}`;
  const liveDb = () => (typeof db !== "undefined" && db?.rpc ? db : null);

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

  function makeClientEventId() {
    try {
      if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
    } catch {}
    return `${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
  }

  function formatAway(ms) {
    const sec = Math.max(0, Math.round(Number(ms || 0) / 1000));
    if (sec < 60) return `${sec} giây`;
    return `${Math.floor(sec / 60)} phút ${sec % 60} giây`;
  }

  function reasonText(reason) {
    if (reason === "tab_hidden") return "chuyển sang tab khác";
    if (reason === "fullscreen_exit") return "thoát chế độ toàn màn hình";
    if (reason === "app_navigation") return "rời trang làm bài trong AI-CLO";
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

  function missingRpc(error, names) {
    const text = `${error?.message || ""} ${error?.details || ""} ${error?.hint || ""}`;
    return names.some((name) => text.includes(name)) || /PGRST202|schema cache/i.test(text);
  }

  async function callRpc(name, args) {
    const client = liveDb();
    if (!client) return { data: null, error: new Error("Supabase chưa sẵn sàng") };
    try {
      const result = await client.rpc(name, args);
      if (result.error) throw result.error;
      return { data: result.data, error: null };
    } catch (error) {
      return { data: null, error };
    }
  }

  function progressSnapshot() {
    const current = page();
    const buttons = current ? [...current.querySelectorAll(".question-jump [data-v122-jump]")] : [];
    const answered = [];
    let currentQuestion = null;
    buttons.forEach((button, index) => {
      const number = index + 1;
      if (button.classList.contains("answered")) answered.push(number);
      if (button.classList.contains("current")) currentQuestion = number;
    });
    return {
      currentQuestion,
      answered,
      total: buttons.length,
      fullscreen: !!document.fullscreenElement,
      visible: !document.hidden,
    };
  }

  async function sendHeartbeat(force = false) {
    if (!activeAttemptId || !page() || liveStateAvailable === false) return;
    const now = Date.now();
    if (!force && now - lastHeartbeatAt < HEARTBEAT_MS) return;
    lastHeartbeatAt = now;
    const snap = progressSnapshot();
    const { error } = await callRpc("update_attempt_live_state", {
      p_attempt_id: activeAttemptId,
      p_current_question_number: snap.currentQuestion,
      p_answered_numbers: snap.answered,
      p_total_questions: snap.total,
      p_fullscreen_active: snap.fullscreen,
      p_page_visible: snap.visible,
    });
    if (!error) liveStateAvailable = true;
    else if (missingRpc(error, ["update_attempt_live_state"])) liveStateAvailable = false;
    else console.warn("AI-CLO Live telemetry · update_attempt_live_state", error);
  }

  function legacyStartServerEvent(attemptId, reason) {
    if (!attemptId) return;
    legacyServerEventId = null;
    legacyServerEventPromise = callRpc("start_attempt_monitor_event", {
      p_attempt_id: attemptId,
      p_event_type: reason,
    }).then((result) => {
      legacyServerEventId = result?.data || null;
      return legacyServerEventId;
    });
  }

  function legacyFinishServerEvent() {
    const promise = legacyServerEventId
      ? Promise.resolve(legacyServerEventId)
      : legacyServerEventPromise;
    legacyServerEventId = null;
    legacyServerEventPromise = null;
    if (!promise) return;
    promise.then(async (id) => {
      if (!id) return;
      await callRpc("finish_attempt_monitor_event", { p_event_id: id });
      sendHeartbeat(true);
    });
  }

  async function syncIncident(attemptId, incident, completed = false) {
    if (!attemptId || !incident || incidentSyncAvailable === false) return false;
    if (!incident.clientId) incident.clientId = makeClientEventId();
    const startedAt = incident.at || new Date().toISOString();
    const endedAt = completed
      ? (incident.endedAt || new Date(Date.parse(startedAt) + Math.max(0, Number(incident.durationMs || 0))).toISOString())
      : null;
    const { error } = await callRpc("sync_attempt_monitor_event", {
      p_attempt_id: attemptId,
      p_client_event_id: incident.clientId,
      p_event_type: incident.type,
      p_started_at: startedAt,
      p_ended_at: endedAt,
    });
    if (!error) {
      incidentSyncAvailable = true;
      if (completed) incident.syncedAt = new Date().toISOString();
      return true;
    }
    if (missingRpc(error, ["sync_attempt_monitor_event"])) {
      incidentSyncAvailable = false;
      return false;
    }
    console.warn("AI-CLO Live telemetry · sync_attempt_monitor_event", error);
    return false;
  }

  async function flushPendingEvents(attemptId = activeAttemptId) {
    if (!attemptId || flushBusy || incidentSyncAvailable === false) return;
    flushBusy = true;
    try {
      const state = readState(attemptId);
      let changed = false;
      for (const incident of state.events || []) {
        if (!incident?.clientId || incident.syncedAt || incident.durationMs == null) continue;
        const ok = await syncIncident(attemptId, incident, true);
        if (ok) changed = true;
        if (incidentSyncAvailable === false) break;
      }
      if (changed) writeState(attemptId, state);
    } finally {
      flushBusy = false;
    }
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
      flushPendingEvents();
      sendHeartbeat(true);
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
      sendHeartbeat();
      return;
    }
    removeReturnOverlay();
    activeAttemptId = String(attemptId);
    missingSince = 0;
    awayStartedAt = null;
    incidentOpen = false;
    legacyServerEventId = null;
    legacyServerEventPromise = null;
    lastHeartbeatAt = 0;
    renderPanel();
    flushPendingEvents(activeAttemptId);
    sendHeartbeat(true);
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
    const attemptId = activeAttemptId;
    endAway({ showOverlay: false });
    await flushPendingEvents(attemptId);
    removeReturnOverlay();
    activeAttemptId = null;
    missingSince = 0;
    incidentOpen = false;
    awayStartedAt = null;
    legacyServerEventId = null;
    legacyServerEventPromise = null;
    lastHeartbeatAt = 0;
    if (panel) panel.hidden = true;
    await exitRequestedFullscreen();
    requestedFullscreen = false;
  }

  function startAway(reason) {
    if (!activeAttemptId || Date.now() < suppressUntil || incidentOpen) return;
    const attemptId = activeAttemptId;
    incidentOpen = true;
    awayStartedAt = Date.now();
    const state = readState(attemptId);
    const incident = {
      clientId: makeClientEventId(),
      type: reason,
      at: new Date(awayStartedAt).toISOString(),
    };
    state.violations += 1;
    state.events.push(incident);
    writeState(attemptId, state);
    syncIncident(attemptId, incident, false).then((ok) => {
      if (!ok && incidentSyncAvailable === false) legacyStartServerEvent(attemptId, reason);
    });
    renderPanel(`Cảnh báo: bạn vừa rời màn hình (${state.violations} lần).`);
  }

  function endAway({ showOverlay = true } = {}) {
    if (!activeAttemptId || !incidentOpen) return;
    const attemptId = activeAttemptId;
    const state = readState(attemptId);
    const duration = awayStartedAt ? Math.max(0, Date.now() - awayStartedAt) : 0;
    state.totalAwayMs += duration;
    let incident = lastIncident(state);
    if (incident) {
      incident.durationMs = duration;
      incident.endedAt = new Date().toISOString();
    }
    writeState(attemptId, state);
    incidentOpen = false;
    awayStartedAt = null;
    if (incident) {
      syncIncident(attemptId, incident, true).then((ok) => {
        if (ok) {
          const latest = readState(attemptId);
          const matched = latest.events.find((x) => x.clientId === incident.clientId);
          if (matched) matched.syncedAt = incident.syncedAt || new Date().toISOString();
          writeState(attemptId, latest);
        } else if (incidentSyncAvailable === false) legacyFinishServerEvent();
      });
    }
    flushPendingEvents(attemptId);
    renderPanel();
    if (showOverlay && incident) showReturnOverlay(state, incident);
  }

  async function requestFullscreen() {
    if (!activeAttemptId || !page()) return false;
    if (document.fullscreenElement) {
      renderPanel();
      sendHeartbeat(true);
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
      sendHeartbeat(true);
      return true;
    } catch (error) {
      console.warn("AI-CLO attempt fullscreen", error);
      renderPanel("Không thể bật toàn màn hình. Hãy thử lại bằng nút Mở toàn màn hình trên bài làm.");
      return false;
    }
  }

  function resumeFromMobileBackground() {
    if (!activeAttemptId || document.hidden) return;
    window.setTimeout(() => {
      if (!activeAttemptId || document.hidden) return;
      endAway();
      flushPendingEvents();
      sendHeartbeat(true);
    }, 60);
  }

  document.addEventListener("visibilitychange", () => {
    if (!activeAttemptId) return;
    if (document.hidden) startAway("tab_hidden");
    else resumeFromMobileBackground();
  });

  window.addEventListener("pagehide", () => {
    if (!activeAttemptId || Date.now() < suppressUntil) return;
    startAway(document.hidden ? "tab_hidden" : "window_blur");
  });

  window.addEventListener("pageshow", () => resumeFromMobileBackground());

  window.addEventListener("blur", () => {
    if (!activeAttemptId) return;
    window.setTimeout(() => {
      if (!activeAttemptId || Date.now() < suppressUntil) return;
      startAway(document.hidden ? "tab_hidden" : "window_blur");
    }, 80);
  });

  window.addEventListener("focus", () => resumeFromMobileBackground());

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
          if (!document.hidden) endAway();
        }, 250);
      }, 150);
    } else sendHeartbeat(true);
    renderPanel();
  });

  async function reconcileMissingPage() {
    if (!activeAttemptId || missingCheckBusy) return;
    missingCheckBusy = true;
    try {
      const client = liveDb();
      if (!client) return deactivate();
      const { data, error } = await client.rpc("get_exam_attempt_payload", { p_attempt_id: activeAttemptId });
      if (error) throw error;
      if (data?.submitted_at) return deactivate();
      if (!incidentOpen) startAway("app_navigation");
      window.setTimeout(() => deactivate(), 180);
    } catch (error) {
      console.warn("AI-CLO attempt exit reconcile", error);
      deactivate();
    } finally {
      missingCheckBusy = false;
    }
  }

  window.setInterval(() => {
    const current = page();
    if (current) {
      missingSince = 0;
      activate(current.dataset.attemptId || "unknown");
      ensureAttemptFullscreenButton();
      renderPanel();
      sendHeartbeat();
      return;
    }
    if (!activeAttemptId) return;
    if (!missingSince) {
      missingSince = Date.now();
      return;
    }
    if (Date.now() - missingSince >= LEAVE_GRACE_MS) reconcileMissingPage();
  }, POLL_MS);

  window.AICLO_ATTEMPT_MONITOR = Object.freeze({
    version: "12.6.35",
    activeAttemptId: () => activeAttemptId,
    snapshot: () => (activeAttemptId ? readState(activeAttemptId) : null),
    requestFullscreen,
    syncLive: () => {
      flushPendingEvents();
      return sendHeartbeat(true);
    },
  });
})();
