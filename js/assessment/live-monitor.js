/* AI-CLO PTITHCM V12.6.34 — Teacher Live monitoring for online assessments. */
(() => {
  "use strict";
  window.AICLO_ASSESSMENT_MODULES = window.AICLO_ASSESSMENT_MODULES || {};

  window.AICLO_ASSESSMENT_MODULES.createLiveMonitorModule = function createLiveMonitorModule(ctx) {
    const {
      db, getAssessmentRoot, fetchExamById, openExamDetail, escapeHtml, formatDateTime,
      notify, showError, qs, qsa, openDrawer
    } = ctx;
    if (!db || !getAssessmentRoot || !fetchExamById || !openExamDetail || !escapeHtml || !formatDateTime || !qs || !qsa) {
      throw new Error("Assessment Live Monitor dependencies are incomplete");
    }

    const REFRESH_MS = 5000;
    const DISCONNECTED_MS = 20000;
    const STRONG_WARNING_COUNT = 3;
    const STRONG_AWAY_MS = 15000;
    let refreshTimer = null;
    let liveExamId = null;
    let lastRows = [];

    const nowMs = () => Date.now();
    const parseMs = (value) => {
      const n = Date.parse(value || "");
      return Number.isFinite(n) ? n : null;
    };
    const fmtSeconds = (value) => {
      if (value == null) return "Không giới hạn";
      const sec = Math.max(0, Math.floor(Number(value) || 0));
      const min = Math.floor(sec / 60);
      return `${String(min).padStart(2, "0")}:${String(sec % 60).padStart(2, "0")}`;
    };
    const fmtAway = (ms) => {
      const sec = Math.max(0, Math.round(Number(ms || 0) / 1000));
      if (sec < 60) return `${sec} giây`;
      return `${Math.floor(sec / 60)} phút ${sec % 60} giây`;
    };
    const effectiveAwayMs = (row) => {
      const base = Number(row?.total_away_ms || 0);
      const start = parseMs(row?.away_started_at);
      return base + (start ? Math.max(0, nowMs() - start) : 0);
    };
    const secondsSince = (value) => {
      const t = parseMs(value);
      return t == null ? null : Math.max(0, Math.floor((nowMs() - t) / 1000));
    };
    const activityText = (row) => {
      if (!row.last_seen_at) return "Chưa có tín hiệu";
      const sec = secondsSince(row.last_seen_at);
      if (sec == null) return "—";
      if (sec < 3) return "Vừa cập nhật";
      if (sec < 60) return `${sec} giây trước`;
      return `${Math.floor(sec / 60)} phút trước`;
    };
    const eventLabel = (type) => ({
      tab_hidden: "Chuyển sang tab khác",
      fullscreen_exit: "Thoát toàn màn hình",
      window_blur: "Rời cửa sổ làm bài",
      app_navigation: "Rời trang làm bài trong AI-CLO",
    })[type] || type || "Sự kiện";

    function rowState(row) {
      if (row.submitted_at) return { code: "submitted", label: "Đã nộp", className: "green" };
      if (Number(row.remaining_seconds) === 0) return { code: "expired", label: "Hết giờ", className: "red" };
      const since = secondsSince(row.last_seen_at);
      if (since == null) return { code: "waiting", label: "Chưa có tín hiệu", className: "" };
      if (since * 1000 > DISCONNECTED_MS) return { code: "disconnected", label: "Mất kết nối", className: "red" };
      const awayMs = effectiveAwayMs(row);
      if (Number(row.violations || 0) >= STRONG_WARNING_COUNT || awayMs >= STRONG_AWAY_MS)
        return { code: "warning", label: "Cảnh báo", className: "red" };
      if (row.away_reason || row.page_visible === false)
        return { code: "away", label: "Rời màn hình", className: "yellow" };
      return { code: "active", label: "Đang làm", className: "green" };
    }

    function stopRefresh() {
      if (refreshTimer) clearInterval(refreshTimer);
      refreshTimer = null;
      liveExamId = null;
    }

    async function fetchSnapshot(examId) {
      const { data, error } = await db.rpc("get_exam_live_snapshot", { p_exam_id: examId });
      if (error) throw error;
      return data || [];
    }

    async function fetchEvents(examId) {
      const { data, error } = await db.rpc("get_exam_monitor_events", { p_exam_id: examId });
      if (error) throw error;
      return data || [];
    }

    function backendUnavailable(error) {
      const text = `${error?.message || ""} ${error?.details || ""} ${error?.hint || ""}`;
      return /get_exam_live_snapshot|get_exam_monitor_events|PGRST202|schema cache/i.test(text);
    }

    function detailTitleRow(page, examId) {
      if (!page || !examId) return null;
      const head = page.querySelector(":scope > .subpage-head > div");
      const title = head?.querySelector(":scope > h3");
      if (!head || !title) return null;
      let row = head.querySelector(":scope > .assessment-detail-title-row");
      if (!row) {
        row = document.createElement("div");
        row.className = "assessment-detail-title-row";
        title.before(row);
        row.appendChild(title);
      }
      let button = row.querySelector("#aicloLiveButton");
      if (!button) {
        button = document.createElement("button");
        button.id = "aicloLiveButton";
        button.type = "button";
        button.className = "aiclo-live-entry";
        button.innerHTML = '<span class="aiclo-live-dot" aria-hidden="true"></span><b>AI-CLO</b><span>|</span><strong>LIVE</strong>';
        row.appendChild(button);
      }
      button.onclick = () => openExamLive(examId);
      page.classList.add("has-live-entry");
      return button;
    }

    function attachDetailButton(page, examId) {
      stopRefresh();
      return detailTitleRow(page, examId);
    }

    function progressNumbers(row) {
      const arr = Array.isArray(row.answered_numbers) ? row.answered_numbers : [];
      return new Set(arr.map(Number).filter(Number.isFinite));
    }

    function progressMapHtml(row) {
      const total = Math.max(0, Number(row.total_questions || 0));
      const answered = progressNumbers(row);
      if (!total) return '<p class="hint">Chưa có dữ liệu tiến độ câu hỏi.</p>';
      return `<div class="aiclo-live-question-map">${Array.from({ length: total }, (_, i) => {
        const n = i + 1;
        const current = Number(row.current_question_number) === n;
        return `<span class="${answered.has(n) ? "answered" : ""} ${current ? "current" : ""}" title="Câu ${n}: ${answered.has(n) ? "đã trả lời" : "chưa trả lời"}">${n}</span>`;
      }).join("")}</div>`;
    }

    function summaryCounts(rows) {
      const states = rows.map(rowState);
      return {
        active: states.filter((x) => x.code === "active").length,
        submitted: states.filter((x) => x.code === "submitted").length,
        warning: states.filter((x) => ["warning", "away"].includes(x.code)).length,
        disconnected: states.filter((x) => ["disconnected", "waiting"].includes(x.code)).length,
      };
    }

    function liveTableHtml(rows) {
      const activeRows = [...rows].sort((a, b) => {
        const aa = a.submitted_at ? 1 : 0, bb = b.submitted_at ? 1 : 0;
        if (aa !== bb) return aa - bb;
        return new Date(b.started_at || 0) - new Date(a.started_at || 0);
      });
      return `<div class="table-wrap aiclo-live-table-wrap"><table class="aiclo-live-table"><thead><tr><th>Sinh viên</th><th>Lần</th><th>Tiến độ</th><th>Câu hiện tại</th><th>Còn lại</th><th>Hoạt động cuối</th><th>Toàn màn hình</th><th>Rời màn hình</th><th>Trạng thái</th></tr></thead><tbody>${activeRows.map((row) => {
        const status = rowState(row);
        const answered = Number(row.answered_count || 0), total = Number(row.total_questions || 0);
        const pct = total ? Math.min(100, Math.round(answered * 100 / total)) : 0;
        const fullname = row.full_name || row.email || "Sinh viên";
        const identity = row.mssv || row.email || "";
        return `<tr data-aiclo-live-attempt="${escapeHtml(row.attempt_id)}" tabindex="0" role="button" aria-label="Xem phiên Live của ${escapeHtml(fullname)}">
          <td><b>${escapeHtml(fullname)}</b><br><small>${escapeHtml(identity)}</small></td>
          <td>${Number(row.attempt_number || 1)}</td>
          <td><div class="aiclo-live-progress"><b>${answered}/${total || "—"}</b><span><i style="width:${pct}%"></i></span></div></td>
          <td>${row.current_question_number ? `<b>Câu ${Number(row.current_question_number)}</b>` : "—"}</td>
          <td class="aiclo-live-mono">${row.submitted_at ? "—" : fmtSeconds(row.remaining_seconds)}</td>
          <td><small>${escapeHtml(activityText(row))}</small></td>
          <td>${row.submitted_at ? "—" : row.fullscreen_active ? '<span class="badge green">⛶ Có</span>' : '<span class="badge">Không</span>'}</td>
          <td><b>${Number(row.violations || 0)} lần</b><br><small>${escapeHtml(fmtAway(effectiveAwayMs(row)))}</small></td>
          <td><span class="badge ${status.className}">${escapeHtml(status.label)}</span></td>
        </tr>`;
      }).join("") || '<tr><td colspan="9" class="empty">Chưa có sinh viên bắt đầu làm bài.</td></tr>'}</tbody></table></div>`;
    }

    function renderSnapshot(root, rows) {
      const body = qs("#aicloLiveBody", root);
      if (!body) return;
      lastRows = rows || [];
      const s = summaryCounts(lastRows);
      body.innerHTML = `<div class="aiclo-live-summary">
        <div><small>Đang làm</small><b>${s.active}</b></div>
        <div><small>Đã nộp</small><b>${s.submitted}</b></div>
        <div class="warning"><small>Cảnh báo</small><b>${s.warning}</b></div>
        <div><small>Mất kết nối / chưa có tín hiệu</small><b>${s.disconnected}</b></div>
      </div>${liveTableHtml(lastRows)}`;

      qsa("[data-aiclo-live-attempt]", body).forEach((rowEl) => {
        const open = () => {
          const row = lastRows.find((x) => String(x.attempt_id) === String(rowEl.dataset.aicloLiveAttempt));
          if (row) openAttemptLiveDetail(row);
        };
        rowEl.onclick = open;
        rowEl.onkeydown = (event) => {
          if (event.key === "Enter" || event.key === " ") { event.preventDefault(); open(); }
        };
      });
      const stamp = qs("#aicloLiveUpdated", root);
      if (stamp) stamp.textContent = `Cập nhật ${new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}`;
    }

    async function openAttemptLiveDetail(row) {
      try {
        const events = liveExamId ? await fetchEvents(liveExamId) : [];
        const mine = events.filter((x) => String(x.attempt_id) === String(row.attempt_id)).slice(-20).reverse();
        const status = rowState(row);
        const html = `<div class="aiclo-live-detail">
          <div class="aiclo-live-detail-grid">
            <div><small>Trạng thái</small><b>${escapeHtml(status.label)}</b></div>
            <div><small>Tiến độ</small><b>${Number(row.answered_count || 0)}/${Number(row.total_questions || 0)}</b></div>
            <div><small>Câu hiện tại</small><b>${row.current_question_number ? `Câu ${Number(row.current_question_number)}` : "—"}</b></div>
            <div><small>Còn lại</small><b>${row.submitted_at ? "—" : fmtSeconds(row.remaining_seconds)}</b></div>
            <div><small>Toàn màn hình</small><b>${row.fullscreen_active ? "Có" : "Không"}</b></div>
            <div><small>Rời màn hình</small><b>${Number(row.violations || 0)} lần · ${escapeHtml(fmtAway(effectiveAwayMs(row)))}</b></div>
          </div>
          <h4>Tiến độ câu hỏi</h4>${progressMapHtml(row)}
          <h4>Sự kiện gần nhất</h4>
          <div class="aiclo-live-event-list">${mine.map((event) => `<div><span>${escapeHtml(eventLabel(event.event_type))}</span><small>${formatDateTime(event.started_at)} · ${escapeHtml(event.duration_ms == null ? "đang diễn ra" : fmtAway(event.duration_ms))}</small></div>`).join("") || '<p class="hint">Chưa ghi nhận sự kiện rời màn hình.</p>'}</div>
          <p class="hint">Live chỉ hiển thị câu đã trả lời/chưa trả lời; không hiển thị phương án A/B/C/D sinh viên đang chọn.</p>
        </div>`;
        if (typeof openDrawer === "function") openDrawer(`AI-CLO | LIVE · ${row.full_name || "Sinh viên"}`, html, null, { wide: true, eyebrow: "THEO DÕI TRỰC TIẾP" });
      } catch (error) { showError?.(error); }
    }

    async function refreshLive(examId, root, quiet = false) {
      try {
        const rows = await fetchSnapshot(examId);
        if (!root?.isConnected || String(liveExamId) !== String(examId)) return;
        renderSnapshot(root, rows);
      } catch (error) {
        if (!root?.isConnected) return;
        const body = qs("#aicloLiveBody", root);
        if (backendUnavailable(error)) {
          stopRefresh();
          if (body) body.innerHTML = '<div class="panel migration-panel"><h3>Cần bật backend AI-CLO | LIVE</h3><p>Chạy migration <code>supabase/migrations/assessment-v12.6.34-live-monitoring.sql</code> trong Supabase SQL Editor, sau đó tải lại trang.</p></div>';
          return;
        }
        if (!quiet) showError?.(error);
      }
    }

    async function openExamLive(examOrId) {
      stopRefresh();
      try {
        const exam = typeof examOrId === "object" && examOrId?.id ? examOrId : await fetchExamById(examOrId);
        if (!exam) throw new Error("Không tìm thấy bài kiểm tra.");
        const root = getAssessmentRoot();
        if (!root) throw new Error("Không mở được trang AI-CLO | LIVE.");
        liveExamId = String(exam.id);
        root.innerHTML = `<section class="assessment-live-page" data-assessment-exam-id="${escapeHtml(exam.id)}">
          <div class="aiclo-live-page-head">
            <div><button id="aicloLiveBack" type="button" class="secondary compact">← Chi tiết bài kiểm tra</button><small>AI-CLO | LIVE</small><h3>Theo dõi trực tiếp</h3><p>${escapeHtml(exam.title || "Bài kiểm tra")} · Tự cập nhật mỗi 5 giây, không hiển thị đáp án sinh viên đang chọn.</p></div>
            <div class="aiclo-live-head-actions"><span id="aicloLiveUpdated" class="hint">Đang tải…</span><button id="aicloLiveExport" type="button" class="secondary">Tải lịch sử Excel</button></div>
          </div>
          <div id="aicloLiveBody"><div class="panel">Đang tải dữ liệu Live…</div></div>
        </section>`;
        window.AICLO_SUBPAGE_STATE?.remember?.("assessment-live", { entityType: "exam", entityId: String(exam.id) });
        qs("#aicloLiveBack", root)?.addEventListener("click", async () => {
          stopRefresh();
          window.AICLO_SUBPAGE_STATE?.remember?.("assessment-detail", { entityType: "exam", entityId: String(exam.id) });
          await openExamDetail(exam);
        });
        qs("#aicloLiveExport", root)?.addEventListener("click", (event) => downloadLiveExcel(exam, event.currentTarget));
        await refreshLive(exam.id, root, false);
        refreshTimer = window.setInterval(() => {
          const page = document.querySelector(`.assessment-live-page[data-assessment-exam-id="${CSS.escape(String(exam.id))}"]`);
          if (!page) return stopRefresh();
          refreshLive(exam.id, root, true);
        }, REFRESH_MS);
        return exam;
      } catch (error) {
        showError?.(error);
        return null;
      }
    }

    function safeFile(value) {
      return String(value || "bai-kiem-tra").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-|-$/g, "").slice(0, 80) || "bai-kiem-tra";
    }

    async function downloadLiveExcel(exam, button) {
      const old = button?.textContent;
      try {
        if (button) { button.disabled = true; button.textContent = "Đang tạo Excel…"; }
        const [rows, events, ExcelJS] = await Promise.all([
          fetchSnapshot(exam.id),
          fetchEvents(exam.id),
          window.AICLO_OFFICE_LIBS?.exceljs?.(),
        ]);
        if (!ExcelJS) throw new Error("Không tải được thư viện ExcelJS.");
        const byAttempt = new Map();
        for (const event of events) {
          const list = byAttempt.get(event.attempt_id) || [];
          list.push(event); byAttempt.set(event.attempt_id, list);
        }
        const wb = new ExcelJS.Workbook();
        wb.creator = "AI-CLO PTITHCM"; wb.created = new Date();
        const summary = wb.addWorksheet("Tong_hop");
        summary.addRow(["AI-CLO | LIVE — LỊCH SỬ GIÁM SÁT BÀI KIỂM TRA"]);
        summary.mergeCells(1,1,1,14);
        summary.addRow(["Bài kiểm tra", exam.title || "—"]);
        summary.addRow(["Ngày xuất", new Date().toLocaleString("vi-VN")]);
        summary.addRow([]);
        const headers = ["STT","MSSV","Họ tên","Lần","Bắt đầu","Nộp/Hết giờ","Tiến độ","Câu hiện tại","Số lần rời","Tổng thời gian rời","Thoát fullscreen","Đổi tab","Rời cửa sổ/app","Điểm"];
        summary.addRow(headers);
        rows.forEach((row, index) => {
          const ev = byAttempt.get(row.attempt_id) || [];
          const count = (type) => ev.filter((x) => x.event_type === type).length;
          const leaveCount = count("window_blur") + count("app_navigation");
          summary.addRow([
            index+1,row.mssv||"",row.full_name||row.email||"",row.attempt_number||1,
            row.started_at?formatDateTime(row.started_at):"—",
            row.submitted_at?formatDateTime(row.submitted_at):(Number(row.remaining_seconds)===0?"Hết giờ":"Chưa nộp"),
            `${Number(row.answered_count||0)}/${Number(row.total_questions||0)}`,
            row.current_question_number||"—",Number(row.violations||0),fmtAway(effectiveAwayMs(row)),
            count("fullscreen_exit"),count("tab_hidden"),leaveCount,row.submitted_at&&row.score!=null?Number(row.score):null,
          ]);
        });
        const eventSheet = wb.addWorksheet("Su_kien");
        eventSheet.addRow(["STT","MSSV","Họ tên","Lần","Sự kiện","Bắt đầu","Kết thúc","Thời lượng"]);
        events.forEach((event, index) => eventSheet.addRow([
          index+1,event.mssv||"",event.full_name||event.email||"",event.attempt_number||1,eventLabel(event.event_type),
          event.started_at?formatDateTime(event.started_at):"—",event.ended_at?formatDateTime(event.ended_at):"Đang diễn ra",
          event.duration_ms==null?"Đang diễn ra":fmtAway(event.duration_ms),
        ]));
        [summary,eventSheet].forEach((ws) => {
          ws.eachRow((row, rowNumber) => row.eachCell((cell) => {
            cell.font = { name: "Times New Roman", size: rowNumber===1 ? 13 : 11, bold: rowNumber===1 || (ws===summary&&rowNumber===5) };
            cell.alignment = { vertical: "middle", wrapText: true };
          }));
          ws.views = [{ state: "frozen", ySplit: ws===summary ? 5 : 1 }];
          ws.columns.forEach((column, index) => { column.width = index===2 ? 26 : index===4 || index===5 ? 20 : 14; });
        });
        const buf = await wb.xlsx.writeBuffer();
        const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
        const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
        a.download = `AI-CLO-LIVE_${safeFile(exam.title)}_${new Date().toISOString().slice(0,10)}.xlsx`;
        document.body.appendChild(a); a.click(); a.remove(); window.setTimeout(() => URL.revokeObjectURL(a.href), 1000);
        notify?.("Đã tạo lịch sử AI-CLO | LIVE");
      } catch (error) { showError?.(error); }
      finally { if (button) { button.disabled = false; button.textContent = old || "Tải lịch sử Excel"; } }
    }

    return Object.freeze({ attachDetailButton, openExamLive, stopRefresh, version: "12.6.34" });
  };
})();
