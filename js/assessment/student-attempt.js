/* AI-CLO PTITHCM V12.5.0 — Student Assessment list, detail and attempt module. */
(() => {
  "use strict";
  window.AICLO_ASSESSMENT_MODULES = window.AICLO_ASSESSMENT_MODULES || {};
  window.AICLO_ASSESSMENT_MODULES.createStudentAttemptModule = function createStudentAttemptModule(ctx) {
    const {
      db, state, subjectId, fetchExams, statusMeta, escapeHtml, formatDateTime,
      qs, qsa, ask, showError, notify, openDrawer, replaceDrawer
    } = ctx;
    if (!db || !state || !subjectId || !fetchExams || !statusMeta || !escapeHtml || !formatDateTime || !qs || !qsa || !ask || !showError || !notify) {
      throw new Error("Assessment Student Attempt dependencies are incomplete");
    }

    let liveTimer = null;
    let listRoot = null;

    const attemptLocalKey = (id) =>
      `aiclo:v122:attempt:${state.user?.id || "user"}:${id}`;

    function readAttemptLocal(id) {
      try {
        return JSON.parse(localStorage.getItem(attemptLocalKey(id)) || "null");
      } catch {
        return null;
      }
    }

    function saveAttemptLocal(id, data) {
      try {
        localStorage.setItem(
          attemptLocalKey(id),
          JSON.stringify({ ...data, updated_at: Date.now() }),
        );
      } catch {}
    }

    function clearAttemptLocal(id) {
      try {
        localStorage.removeItem(attemptLocalKey(id));
      } catch {}
    }

    function clampQuestionIndex(value, length) {
      if (!length) return 0;
      const parsed = Number(value);
      const index = Number.isFinite(parsed) ? Math.floor(parsed) : 0;
      return Math.min(length - 1, Math.max(0, index));
    }

    function saveAttemptWorkspace(payload, answers, currentQuestionIndex) {
      saveAttemptLocal(payload.attempt_id, {
        answers,
        pending: payload._pending || {},
        deadline: payload._deadlineMs,
        currentQuestionIndex,
      });
    }

    function clearLiveTimer() {
      if (liveTimer) {
        clearInterval(liveTimer);
        liveTimer = null;
      }
    }

    function timerText(sec) {
      sec = Math.max(0, Math.floor(sec || 0));
      return `${String(Math.floor(sec / 60)).padStart(2, "0")}:${String(sec % 60).padStart(2, "0")}`;
    }

    function activeRoot() {
      if (listRoot?.isConnected) return listRoot;
      const root = document.querySelector("#content");
      if (root) listRoot = root;
      return root;
    }

    function remember(kind, payload) {
      window.AICLO_SUBPAGE_STATE?.remember?.(kind, payload);
    }

    function clearRemembered() {
      window.AICLO_SUBPAGE_STATE?.clear?.();
    }

    function attemptStatus(exam, mine) {
      const open = mine.find((a) => !a.submitted_at);
      const done = mine.filter((a) => a.submitted_at);
      const s = statusMeta(exam);
      const max = Math.max(1, Number(exam.max_attempts || 1));
      const canStart = !open && s.code === "active" && mine.length < max;
      return { open, done, status: s, max, canStart };
    }

    async function loadStudentExamData() {
      const [items, { data: attempts, error }] = await Promise.all([
        fetchExams(),
        db
          .from("exam_attempts")
          .select("*")
          .eq("student_id", state.user.id)
          .order("created_at", { ascending: false }),
      ]);
      if (error) throw error;
      const rows = attempts || [];
      const visible = items.filter(
        (exam) => exam.status === "active" || rows.some((a) => a.exam_id === exam.id),
      );
      return { items: visible, attempts: rows };
    }

    function availabilityText(exam, meta) {
      if (meta.open) return "Đang có lượt làm";
      if (meta.status.code === "upcoming") return "Chưa mở";
      if (meta.status.code === "expired") return "Đã hết hạn";
      if (exam.status === "closed") return "Đang tạm dừng";
      if (!meta.canStart && meta.done.length >= meta.max) return "Đã hết lượt";
      return meta.status.label;
    }

    async function studentExamList(c) {
      listRoot = c || listRoot;
      try {
        clearLiveTimer();
        const { items, attempts } = await loadStudentExamData();
        c.innerHTML = `<section class="student-exam-list-page">
          <div class="student-exam-list-heading">
            <div><small>BÀI KIỂM TRA TRỰC TUYẾN</small><h3>Danh sách bài kiểm tra</h3><p>Chọn một bài để xem thông tin, lịch sử lượt làm và bắt đầu hoặc tiếp tục bài.</p></div>
          </div>
          <div class="student-exam-list">
            ${items.map((exam) => {
              const mine = attempts.filter((a) => a.exam_id === exam.id);
              const meta = attemptStatus(exam, mine);
              const latest = meta.done[0];
              return `<article class="student-exam-list-row" data-v125-student-detail="${exam.id}" tabindex="0" role="button" aria-label="Xem chi tiết ${escapeHtml(exam.title || "Bài kiểm tra")}">
                <div class="student-exam-row-main">
                  <div class="student-exam-row-title"><span class="badge ${meta.status.className}">${meta.status.label}</span><div><h4>${escapeHtml(exam.title || "Bài kiểm tra")}</h4><p>${escapeHtml(exam.description || "Không có mô tả.")}</p></div></div>
                </div>
                <div class="student-exam-row-meta"><span><b>${Number(exam.total_questions || 0)}</b><small>câu</small></span><span><b>${exam.duration_minutes || "—"}</b><small>phút</small></span><span><b>${meta.done.length}/${meta.max}</b><small>lượt đã nộp</small></span><span><b>${latest?.score == null ? "—" : Number(latest.score).toFixed(2)}</b><small>điểm gần nhất</small></span></div>
                <div class="student-exam-row-end"><small>${escapeHtml(availabilityText(exam, meta))}</small><button type="button" class="secondary compact" data-v125-open-detail="${exam.id}">Chi tiết →</button></div>
              </article>`;
            }).join("") || '<div class="panel empty">Hiện chưa có bài kiểm tra nào.</div>'}
          </div>
        </section>`;

        const openDetail = (examId) => openStudentExamDetail(examId);
        qsa("[data-v125-student-detail]", c).forEach((row) => {
          row.onclick = (event) => {
            if (event.target?.closest?.("button")) return;
            openDetail(row.dataset.v125StudentDetail);
          };
          row.onkeydown = (event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              openDetail(row.dataset.v125StudentDetail);
            }
          };
        });
        qsa("[data-v125-open-detail]", c).forEach(
          (button) => (button.onclick = () => openDetail(button.dataset.v125OpenDetail)),
        );
      } catch (e) {
        showError(e);
      }
    }

    async function openStudentExamDetail(examOrId) {
      try {
        clearLiveTimer();
        const examId = typeof examOrId === "string" ? examOrId : examOrId?.id;
        if (!examId) throw new Error("Không xác định được bài kiểm tra.");
        const { items, attempts } = await loadStudentExamData();
        const exam = typeof examOrId === "object" && examOrId?.id
          ? examOrId
          : items.find((x) => String(x.id) === String(examId));
        if (!exam) throw new Error("Bài kiểm tra không còn khả dụng.");
        const mine = attempts.filter((a) => a.exam_id === exam.id);
        const meta = attemptStatus(exam, mine);
        const root = activeRoot();
        if (!root) throw new Error("Không mở được trang chi tiết bài kiểm tra.");

        const primaryAction = meta.open
          ? `<button type="button" class="primary" data-v122-resume="${exam.id}" data-attempt="${meta.open.id}">Tiếp tục làm bài</button>`
          : meta.canStart
            ? `<button type="button" class="primary" data-v122-start="${exam.id}">Làm bài</button>`
            : `<button type="button" class="secondary" disabled>${escapeHtml(availabilityText(exam, meta))}</button>`;

        root.innerHTML = `<section class="student-exam-detail-v125" data-assessment-exam-id="${exam.id}">
          <div class="subpage-head student-exam-detail-head">
            <div><button id="v125StudentExamBack" type="button" class="secondary compact">← Danh sách bài kiểm tra</button><small>CHI TIẾT BÀI KIỂM TRA</small><h3>${escapeHtml(exam.title || "Bài kiểm tra")}</h3><p>${escapeHtml(exam.description || "Không có mô tả.")}</p></div>
            <span class="badge ${meta.status.className}">${meta.status.label}</span>
          </div>
          <section class="panel">
            <div class="panel-head"><div><h3>Thông tin bài</h3><p class="hint">Kiểm tra thời gian và số lượt trước khi bắt đầu.</p></div><div class="student-exam-detail-actions">${primaryAction}</div></div>
            <div class="student-exam-detail-grid">
              <div><small>Số câu</small><b>${Number(exam.total_questions || 0)}</b></div>
              <div><small>Thời gian làm</small><b>${exam.duration_minutes || "—"} phút</b></div>
              <div><small>Số lần được làm</small><b>${meta.max}</b></div>
              <div><small>Đã nộp</small><b>${meta.done.length} lượt</b></div>
              <div><small>Mở bài</small><b>${exam.opens_at ? formatDateTime(exam.opens_at) : "Khi phát hành"}</b></div>
              <div><small>Đóng bài</small><b>${exam.closes_at ? formatDateTime(exam.closes_at) : "Không giới hạn"}</b></div>
            </div>
            ${meta.open && exam.status === "closed" ? '<p class="hint student-exam-detail-note">Bài đang tạm dừng, nhưng lượt bạn đã bắt đầu vẫn được tiếp tục.</p>' : ""}
          </section>
          <section class="panel">
            <div class="panel-head"><div><h3>Các lượt làm của bạn</h3><p class="hint">Câu hỏi của lượt đã nộp chỉ mở trong panel khi bạn chọn “Xem câu hỏi”.</p></div></div>
            <div class="student-attempt-history">
              ${mine.map((a) => `<article class="student-attempt-history-row">
                <div><small>Lần</small><b>${a.attempt_number || 1}</b></div>
                <div><small>Bắt đầu</small><b>${formatDateTime(a.started_at)}</b></div>
                <div><small>Nộp bài</small><b>${a.submitted_at ? formatDateTime(a.submitted_at) : "Chưa nộp"}</b></div>
                <div><small>Điểm</small><b>${a.submitted_at && a.score != null ? Number(a.score).toFixed(2) : "—"}</b></div>
                <div><span class="badge ${a.submitted_at ? "green" : ""}">${a.submitted_at ? "Đã nộp" : "Đang làm"}</span></div>
                <div class="student-attempt-history-actions">${a.submitted_at
                  ? `<button type="button" class="secondary compact" data-v125-view-questions="${a.id}" data-exam-id="${exam.id}">Xem câu hỏi</button>`
                  : `<button type="button" class="primary compact" data-v122-resume="${exam.id}" data-attempt="${a.id}">Tiếp tục</button>`}</div>
              </article>`).join("") || '<div class="empty">Bạn chưa có lượt làm nào.</div>'}
            </div>
          </section>
        </section>`;

        remember("assessment-student-detail", {
          entityType: "exam",
          entityId: String(exam.id),
        });

        qs("#v125StudentExamBack", root)?.addEventListener("click", async () => {
          clearRemembered();
          await studentExamList(root);
        });
        qsa("[data-v122-start]", root).forEach(
          (b) => (b.onclick = () => startStudentAttempt(b.dataset.v122Start, b)),
        );
        qsa("[data-v122-resume]", root).forEach(
          (b) =>
            (b.onclick = () => {
              remember("assessment-attempt", {
                entityType: "attempt",
                entityId: b.dataset.attempt,
                examId: exam.id,
              });
              openStudentAttempt(b.dataset.attempt);
            }),
        );
        qsa("[data-v125-view-questions]", root).forEach(
          (b) =>
            (b.onclick = () =>
              openStudentAttemptResult(b.dataset.v125ViewQuestions, {
                examId: b.dataset.examId || exam.id,
                parentKind: "assessment-student-detail",
              })),
        );
        if (typeof window.renderMath === "function") window.renderMath(root);
        return exam;
      } catch (e) {
        showError(e);
        return null;
      }
    }

    async function refreshStudentExamList() {
      if (!listRoot || !listRoot.isConnected) return;
      try {
        const detail = document.querySelector(".student-exam-detail-v125[data-assessment-exam-id]");
        if (detail) await openStudentExamDetail(detail.dataset.assessmentExamId);
        else await studentExamList(listRoot);
      } catch (e) {
        console.warn("Assessment student list refresh", e);
      }
    }

    async function startStudentAttempt(examId, button) {
      if (
        !(await ask(
          "Bắt đầu bài kiểm tra",
          "Đồng hồ sẽ tính từ khi bắt đầu. Đáp án được tự lưu sau mỗi lần chọn.",
          "Bắt đầu",
        ))
      )
        return;
      if (button) {
        button.disabled = true;
        button.textContent = "Đang mở bài…";
      }
      try {
        const { data, error } = await db.rpc("start_exam_attempt", {
          p_exam_id: examId,
        });
        if (error) throw error;
        remember("assessment-attempt", {
          entityType: "attempt",
          entityId: data.attempt_id,
          examId,
        });
        await openStudentAttempt(data.attempt_id);
      } catch (e) {
        showError(e);
        if (button) {
          button.disabled = false;
          button.textContent = "Làm bài";
        }
      }
    }

    async function openStudentAttempt(attemptId) {
      try {
        clearLiveTimer();
        const { data, error } = await db.rpc("get_exam_attempt_payload", {
          p_attempt_id: attemptId,
        });
        if (error) throw error;
        if (data.submitted_at) {
          clearAttemptLocal(attemptId);
          if (data.exam?.id) await openStudentExamDetail(data.exam.id);
          return openStudentAttemptResult(attemptId, {
            examId: data.exam?.id || null,
            parentKind: "assessment-student-detail",
          });
        }
        if (data.remaining_seconds === 0) {
          const done = await db.rpc("submit_exam_attempt", {
            p_attempt_id: attemptId,
            p_answers: data.answers || {},
          });
          if (done.error) throw done.error;
          clearAttemptLocal(attemptId);
          if (data.exam?.id) await openStudentExamDetail(data.exam.id);
          return showStudentResult(data.exam, done.data, data.exam?.id || null);
        }
        const local = readAttemptLocal(attemptId) || {};
        const pending = { ...(local.pending || {}) };
        const answers = { ...(data.answers || {}), ...pending };
        const serverDeadline =
          data.remaining_seconds == null
            ? null
            : Date.now() + Math.max(0, data.remaining_seconds) * 1000;
        data._deadlineMs =
          serverDeadline == null
            ? null
            : local.deadline
              ? Math.min(serverDeadline, local.deadline)
              : serverDeadline;
        data._pending = pending;
        const currentQuestionIndex = clampQuestionIndex(
          local.currentQuestionIndex,
          (data.questions || []).length,
        );
        data._currentQuestionIndex = currentQuestionIndex;
        saveAttemptWorkspace(data, answers, currentQuestionIndex);
        showStudentQuestion(data, answers, currentQuestionIndex, true);
      } catch (e) {
        showError(e);
      }
    }

    async function leaveStudentAttempt(examId) {
      clearLiveTimer();
      const root = activeRoot();
      if (!root) return;
      if (examId) await openStudentExamDetail(examId);
      else {
        clearRemembered();
        await studentExamList(root);
      }
    }

    function showStudentQuestion(payload, answers, index, first = false) {
      clearLiveTimer();
      const questions = payload.questions || [];
      index = clampQuestionIndex(index, questions.length);
      const x = questions[index];
      if (!x) return notify("Không đọc được câu hỏi của bài kiểm tra.", true);
      payload._currentQuestionIndex = index;
      saveAttemptWorkspace(payload, answers, index);
      const current =
        payload._deadlineMs == null
          ? null
          : Math.max(0, Math.floor((payload._deadlineMs - Date.now()) / 1000));
      const root = activeRoot();
      if (!root) return notify("Không mở được giao diện làm bài.", true);
      root.innerHTML = `<section class="student-attempt-page" data-attempt-id="${escapeHtml(payload.attempt_id || "")}" data-exam-id="${escapeHtml(payload.exam?.id || "")}">
        <div class="student-attempt-page-head"><button id="v124AttemptBack" type="button" class="secondary">← Chi tiết bài kiểm tra</button><div class="student-attempt-title"><small>Lần ${escapeHtml(String(payload.attempt_number || 1))}</small><h3>${escapeHtml(payload.exam?.title || "Bài kiểm tra")}</h3></div></div>
        <div class="student-attempt-card"><div class="live-exam"><div class="live-top"><div><b>Câu ${index + 1}/${questions.length}</b><span class="badge red">${escapeHtml(x.clo_code || "—")}</span></div><div id="examTimer" class="exam-timer">${current == null ? "Không giới hạn" : timerText(current)}</div></div><div class="live-context"><span>${escapeHtml(x.chapter || "")}</span><span>${escapeHtml(x.topic || "")}</span><span id="saveState">Tự lưu khi chọn đáp án</span></div><div class="preview-question">${escapeHtml(x.content || "")}</div><div class="preview-options live-options">${(x.options || []).map((o) => `<label class="${answers[x.id] === o.key ? "selected" : ""}"><input type="radio" name="v122LiveAnswer" value="${escapeHtml(o.key)}" ${answers[x.id] === o.key ? "checked" : ""}><b>${escapeHtml(o.key)}</b><span>${escapeHtml(o.content || "")}</span></label>`).join("")}</div><div class="question-jump">${questions.map((q, i) => `<button type="button" data-v122-jump="${i}" class="${i === index ? "current" : ""} ${answers[q.id] ? "answered" : ""}">${i + 1}</button>`).join("")}</div><div class="preview-nav"><button id="v122LivePrev" class="secondary" ${index === 0 ? "disabled" : ""}>← Trước</button><button id="v122LiveNext" class="secondary" ${index === questions.length - 1 ? "disabled" : ""}>Sau →</button><button id="v122LiveSubmit" class="primary">Nộp bài</button></div></div></div>
      </section>`;

      const page = qs(".student-attempt-page", root) || root;
      const back = qs("#v124AttemptBack", page);
      if (back) back.onclick = () => leaveStudentAttempt(payload.exam?.id || null);

      qsa('input[name="v122LiveAnswer"]', page).forEach(
        (radio) =>
          (radio.onchange = async () => {
            answers[x.id] = radio.value;
            payload._pending = payload._pending || {};
            payload._pending[x.id] = radio.value;
            saveAttemptWorkspace(payload, answers, index);
            qsa(".live-options label", page).forEach((label) =>
              label.classList.toggle("selected", label.contains(radio)),
            );
            qs(`[data-v122-jump="${index}"]`, page)?.classList.add("answered");
            const saveState = qs("#saveState", page);
            if (saveState) saveState.textContent = "Đang lưu…";
            const rr = await db.rpc("save_exam_progress", {
              p_attempt_id: payload.attempt_id,
              p_question_id: x.id,
              p_selected_option: radio.value,
            });
            if (rr.error) {
              if (saveState) saveState.textContent = "Đã lưu trên máy · chưa đồng bộ";
              console.warn("V12.5 autosave", rr.error);
            } else {
              delete payload._pending[x.id];
              saveAttemptWorkspace(payload, answers, index);
              if (saveState) saveState.textContent = "✓ Đã lưu";
            }
          }),
      );

      qsa("[data-v122-jump]", page).forEach(
        (b) =>
          (b.onclick = () =>
            showStudentQuestion(payload, answers, +b.dataset.v122Jump, false)),
      );

      const prev = qs("#v122LivePrev", page);
      const next = qs("#v122LiveNext", page);
      const submit = qs("#v122LiveSubmit", page);
      if (prev) prev.onclick = () => showStudentQuestion(payload, answers, index - 1, false);
      if (next) next.onclick = () => showStudentQuestion(payload, answers, index + 1, false);
      if (submit) submit.onclick = () => submitStudentAttempt(payload, answers, false);

      if (current != null) {
        liveTimer = setInterval(() => {
          const sec = Math.max(
            0,
            Math.floor((payload._deadlineMs - Date.now()) / 1000),
          );
          const box = qs("#examTimer", page);
          if (box) box.textContent = timerText(sec);
          if (sec <= 0) {
            clearLiveTimer();
            submitStudentAttempt(payload, answers, true);
          }
        }, 1000);
      }
      if (typeof window.renderMath === "function") window.renderMath(page);
    }

    async function submitStudentAttempt(payload, answers, auto) {
      const unanswered = (payload.questions || []).filter((q) => !answers[q.id]).length;
      if (
        !auto &&
        !(await ask(
          "Nộp bài kiểm tra",
          unanswered
            ? `Còn ${unanswered} câu chưa trả lời. Sau khi nộp không thể sửa lượt này.`
            : "Sau khi nộp không thể sửa lượt này.",
          "Nộp bài",
        ))
      )
        return;

      clearLiveTimer();
      const page = document.querySelector(".student-attempt-page");
      const button = qs("#v122LiveSubmit", page || undefined);
      if (button) {
        button.disabled = true;
        button.textContent = auto ? "Hết giờ — đang nộp…" : "Đang nộp…";
      }

      try {
        const { data, error } = await db.rpc("submit_exam_attempt", {
          p_attempt_id: payload.attempt_id,
          p_answers: answers || {},
        });
        if (error) throw error;
        clearAttemptLocal(payload.attempt_id);
        if (payload.exam?.id) await openStudentExamDetail(payload.exam.id);
        showStudentResult(payload.exam, data, payload.exam?.id || null);
      } catch (e) {
        showError(e);
        if (button) {
          button.disabled = false;
          button.textContent = "Nộp bài";
        }
      }
    }

    function attemptAiAnalysisHtml(a) {
      const actions = a?.recommendations || a?.next_actions || [];
      return `<div class="ai-analysis-v122"><p>${escapeHtml(a?.summary || "")}</p>${a?.strengths?.length ? `<h4>Điểm mạnh</h4><ul>${a.strengths.map((x) => `<li>${escapeHtml(x)}</li>`).join("")}</ul>` : ""}${a?.needs_improvement?.length ? `<h4>Cần cải thiện</h4><ul>${a.needs_improvement.map((x) => `<li>${escapeHtml(x)}</li>`).join("")}</ul>` : ""}${actions.length ? `<h4>Khuyến nghị</h4><ul>${actions.map((x) => `<li>${escapeHtml(x)}</li>`).join("")}</ul>` : ""}</div>`;
    }

    async function requestAttemptAi(attemptId, button) {
      const old = button?.textContent;
      if (button) {
        button.disabled = true;
        button.textContent = "✦ Đang nhận xét…";
      }
      try {
        const { data, error } = await db.functions.invoke("analyze-assessment", {
          body: { subject_id: subjectId(), scope: "attempt", attempt_id: attemptId },
        });
        if (error) throw error;
        if (!data?.success) throw new Error(data?.error || "AI chưa tạo được nhận xét");
        const out = qs(`[data-v123-ai-output="${attemptId}"]`);
        if (out) out.innerHTML = attemptAiAnalysisHtml(data.analysis);
        else notify("AI đã tạo nhận xét nhưng vùng kết quả không còn mở.");
      } catch (e) {
        showError(e);
      } finally {
        if (button) {
          button.disabled = false;
          button.textContent = old;
        }
      }
    }

    function studentResultHtml(result) {
      const reviewAllowed = !!result.show_review;
      const answersAllowed = !!result.show_answers;
      const detail =
        reviewAllowed && result.review?.length
          ? `<h4>Chi tiết bài làm</h4><div class="answer-review">${result.review.map((x, i) => `<details class="${x.is_correct ? "right" : "wrong"}"><summary>Câu ${i + 1} — ${x.is_correct ? "Đúng" : "Chưa đúng"} · ${escapeHtml(x.clo_code || "")}</summary><div>${escapeHtml(x.content || "")}</div><p>Bạn chọn: <b>${escapeHtml(x.selected || "Chưa trả lời")}</b>${answersAllowed ? ` · Đáp án đúng: <b>${escapeHtml(x.correct_answer || "")}</b>` : ""}</p>${answersAllowed && x.explanation ? `<p>${escapeHtml(x.explanation)}</p>` : ""}</details>`).join("")}</div>`
          : '<p class="hint">Giảng viên chưa cho phép xem lại chi tiết bài làm.</p>';
      const ai =
        result.allow_ai_feedback && result.attempt_id
          ? `<div class="result-ai-actions"><button type="button" class="ai-btn" data-v123-ai-attempt="${escapeHtml(result.attempt_id)}">✦ AI nhận xét bài làm</button></div><div data-v123-ai-output="${escapeHtml(result.attempt_id)}"></div>`
          : "";
      return `<div class="preview-result result-v122"><div class="result-score"><small>Điểm tổng</small><b>${Number(result.score || 0).toFixed(2)}</b><span>${Number(result.correct || 0)}/${Number(result.total || 0)} câu đúng</span></div><h4>Kết quả theo CLO</h4><div class="clo-results">${(result.clo_scores || []).map((x) => `<div><b>${escapeHtml(x.code || "CLO")}</b><strong>${Number(x.score || 0).toFixed(2)}</strong><span>${x.correct}/${x.total} câu đúng</span></div>`).join("") || "<p>Chưa có dữ liệu CLO.</p>"}</div>${ai}${detail}</div>`;
    }

    document.addEventListener("click", (event) => {
      const button = event.target?.closest?.("[data-v123-ai-attempt]");
      if (button) {
        const attemptId = button.dataset.v123AiAttempt;
        if (attemptId) requestAttemptAi(attemptId, button);
        return;
      }
      const leaving = event.target?.closest?.(
        "#nav [data-view],#systemHomeBtn,#courseSystemReturn,#logoutBtn,[data-open-course]",
      );
      if (leaving && document.querySelector(".student-attempt-page")) clearLiveTimer();
    });

    document.addEventListener("change", (event) => {
      if (
        event.target?.matches?.("#subjectSelect") &&
        document.querySelector(".student-attempt-page")
      )
        clearLiveTimer();
    });

    function rememberAttemptResult(attemptId, examId, parentKind = "assessment-student-detail") {
      remember("assessment-attempt-result", {
        entityType: "attempt",
        entityId: attemptId,
        mode: "student",
        examId: examId || null,
        parentKind,
      });
    }

    function showStudentResult(exam, result, examId = null) {
      clearLiveTimer();
      const id = examId || exam?.id || result?.exam_id || null;
      if (result?.attempt_id) rememberAttemptResult(result.attempt_id, id);
      const html = studentResultHtml(result);
      if (typeof replaceDrawer === "function")
        replaceDrawer(`Kết quả · ${exam?.title || "Bài kiểm tra"}`, html, null, {
          wide: true,
          eyebrow: "KẾT QUẢ BÀI LÀM",
        });
      else notify(`Điểm: ${Number(result.score || 0).toFixed(2)}`);
    }

    async function openStudentAttemptResult(attemptId, options = {}) {
      try {
        clearLiveTimer();
        const { data, error } = await db.rpc("get_attempt_result", {
          p_attempt_id: attemptId,
        });
        if (error) throw error;
        const { data: exam, error: ee } = await db
          .from("exams")
          .select("id,title")
          .eq("id", data.exam_id)
          .single();
        if (ee) throw ee;
        clearAttemptLocal(attemptId);
        rememberAttemptResult(
          attemptId,
          options.examId || exam.id,
          options.parentKind || "assessment-student-detail",
        );
        if (typeof openDrawer === "function")
          openDrawer(`Kết quả · ${exam.title}`, studentResultHtml(data), null, {
            wide: true,
            eyebrow: "CÂU HỎI / KẾT QUẢ BÀI LÀM",
          });
        else notify(`Điểm: ${Number(data.score || 0).toFixed(2)}`);
      } catch (e) {
        showError(e);
      }
    }

    return Object.freeze({
      studentExamList,
      openStudentExamDetail,
      openStudentAttempt,
      openStudentAttemptResult,
      clearLiveTimer,
      studentResultHtml,
    });
  };
})();
