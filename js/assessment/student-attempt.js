/* AI-CLO PTITHCM V12.4.2 — Student Attempt module. */
(() => {
  "use strict";
  window.AICLO_ASSESSMENT_MODULES = window.AICLO_ASSESSMENT_MODULES || {};
  window.AICLO_ASSESSMENT_MODULES.createStudentAttemptModule = function createStudentAttemptModule(ctx) {
    const { db, state, subjectId, fetchExams, statusMeta, escapeHtml, qs, qsa, ask, showError, notify, openDrawer, replaceDrawer } = ctx;
    if (!db || !state || !subjectId || !fetchExams || !statusMeta || !escapeHtml || !qs || !qsa || !ask || !showError || !notify) {
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
          JSON.stringify({
            ...data,
            updated_at: Date.now(),
          }),
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
    async function leaveStudentAttempt() {
      clearLiveTimer();
      const root = activeRoot();
      if (root) await studentExamList(root);
    }
    async function studentExamList(c) {
      listRoot = c || listRoot;
      try {
        clearLiveTimer();
        const [items, { data: attempts, error }] = await Promise.all([
          fetchExams(),
          db
            .from("exam_attempts")
            .select("*")
            .eq("student_id", state.user.id)
            .order("created_at", {
              ascending: false,
            }),
        ]);
        if (error) throw error;
        const rows = attempts || [];
        const visible = items.filter(
          (x) => x.status === "active" || rows.some((a) => a.exam_id === x.id),
        );
        c.innerHTML = `<div class="student-exam-grid">${
          visible
            .map((x) => {
              const mine = rows.filter((a) => a.exam_id === x.id),
                open = mine.find((a) => !a.submitted_at),
                done = mine.filter((a) => a.submitted_at),
                s = statusMeta(x),
                canStart =
                  !open &&
                  s.code === "active" &&
                  mine.length < Math.max(1, +x.max_attempts || 1),
                latest = done[0];
              const action = open
                ? `<button class="primary" data-v122-resume="${x.id}" data-attempt="${open.id}">Tiếp tục làm bài</button>`
                : canStart
                  ? `<button class="primary" data-v122-start="${x.id}">Làm bài</button>`
                  : `<button class="secondary" disabled>${s.code === "upcoming" ? "Chưa mở" : s.code === "expired" ? "Đã hết hạn" : x.status === "closed" ? "Đang tạm dừng" : "Đã hết lượt"}</button>`;
              return `<article class="student-exam-card"><div class="student-exam-head"><span class="badge ${s.className}">${s.label}</span><span>${done.length}/${x.max_attempts || 1} lượt đã nộp</span></div><h3>${escapeHtml(x.title || "Bài kiểm tra")}</h3><p>${escapeHtml(x.description || "")}</p><div class="student-exam-meta"><span><b>${x.total_questions || 0}</b> câu</span><span><b>${x.duration_minutes || "—"}</b> phút</span></div><div class="student-exam-actions">${action}${latest ? `<button class="secondary" data-v122-result="${latest.id}">Kết quả gần nhất</button>` : ""}</div>${open && x.status === "closed" ? '<p class="hint">Bài đang tạm dừng, nhưng lượt bạn đã bắt đầu vẫn được tiếp tục.</p>' : ""}</article>`;
            })
            .join("") ||
          '<div class="panel empty">Hiện chưa có bài kiểm tra nào.</div>'
        }</div>`;
        qsa("[data-v122-start]", c).forEach(
          (b) => (b.onclick = () => startStudentAttempt(b.dataset.v122Start, b)),
        );
        qsa("[data-v122-resume]", c).forEach(
          (b) => (b.onclick = () => openStudentAttempt(b.dataset.attempt)),
        );
        qsa("[data-v122-result]", c).forEach(
          (b) =>
            (b.onclick = () => openStudentAttemptResult(b.dataset.v122Result)),
        );
      } catch (e) {
        showError(e);
      }
    }
    async function refreshStudentExamList() {
      if (!listRoot || !listRoot.isConnected) return;
      try {
        await studentExamList(listRoot);
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
          return openStudentAttemptResult(attemptId);
        }
        if (data.remaining_seconds === 0) {
          const done = await db.rpc("submit_exam_attempt", {
            p_attempt_id: attemptId,
            p_answers: data.answers || {},
          });
          if (done.error) throw done.error;
          clearAttemptLocal(attemptId);
          await refreshStudentExamList();
          return showStudentResult(data.exam, done.data);
        }
        const local = readAttemptLocal(attemptId) || {},
          pending = {
            ...(local.pending || {}),
          };
        const answers = {
          ...(data.answers || {}),
          ...pending,
        };
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
      root.innerHTML = `<section class="student-attempt-page" data-attempt-id="${escapeHtml(payload.attempt_id || "")}"><div class="student-attempt-page-head"><button id="v124AttemptBack" type="button" class="secondary">← Danh sách bài kiểm tra</button><div class="student-attempt-title"><small>Lần ${escapeHtml(String(payload.attempt_number || 1))}</small><h3>${escapeHtml(payload.exam?.title || "Bài kiểm tra")}</h3></div></div><div class="student-attempt-card"><div class="live-exam"><div class="live-top"><div><b>Câu ${index + 1}/${questions.length}</b><span class="badge red">${escapeHtml(x.clo_code || "—")}</span></div><div id="examTimer" class="exam-timer">${current == null ? "Không giới hạn" : timerText(current)}</div></div><div class="live-context"><span>${escapeHtml(x.chapter || "")}</span><span>${escapeHtml(x.topic || "")}</span><span id="saveState">Tự lưu khi chọn đáp án</span></div><div class="preview-question">${escapeHtml(x.content || "")}</div><div class="preview-options live-options">${(x.options || []).map((o) => `<label class="${answers[x.id] === o.key ? "selected" : ""}"><input type="radio" name="v122LiveAnswer" value="${escapeHtml(o.key)}" ${answers[x.id] === o.key ? "checked" : ""}><b>${escapeHtml(o.key)}</b><span>${escapeHtml(o.content || "")}</span></label>`).join("")}</div><div class="question-jump">${questions.map((q, i) => `<button type="button" data-v122-jump="${i}" class="${i === index ? "current" : ""} ${answers[q.id] ? "answered" : ""}">${i + 1}</button>`).join("")}</div><div class="preview-nav"><button id="v122LivePrev" class="secondary" ${index === 0 ? "disabled" : ""}>← Trước</button><button id="v122LiveNext" class="secondary" ${index === questions.length - 1 ? "disabled" : ""}>Sau →</button><button id="v122LiveSubmit" class="primary">Nộp bài</button></div></div></div></section>`;
      const bind = () => {
        const page = qs(".student-attempt-page", root) || root;
        const back = qs("#v124AttemptBack", page);
        if (back) back.onclick = () => leaveStudentAttempt();
        qsa('input[name="v122LiveAnswer"]', page).forEach(
          (r) =>
            (r.onchange = async () => {
              answers[x.id] = r.value;
              payload._pending = payload._pending || {};
              payload._pending[x.id] = r.value;
              saveAttemptWorkspace(payload, answers, index);
              qsa(".live-options label", page).forEach((l) =>
                l.classList.toggle("selected", l.contains(r)),
              );
              qs(`[data-v122-jump="${index}"]`, page)?.classList.add(
                "answered",
              );
              const s = qs("#saveState", page);
              if (s) s.textContent = "Đang lưu…";
              const rr = await db.rpc("save_exam_progress", {
                p_attempt_id: payload.attempt_id,
                p_question_id: x.id,
                p_selected_option: r.value,
              });
              if (rr.error) {
                if (s) s.textContent = "Đã lưu trên máy · chưa đồng bộ";
                console.warn("V12.2 autosave", rr.error);
              } else {
                delete payload._pending[x.id];
                saveAttemptWorkspace(payload, answers, index);
                if (s) s.textContent = "✓ Đã lưu";
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
        if (prev)
          prev.onclick = () =>
            showStudentQuestion(payload, answers, index - 1, false);
        if (next)
          next.onclick = () =>
            showStudentQuestion(payload, answers, index + 1, false);
        if (submit)
          submit.onclick = () =>
            submitStudentAttempt(payload, answers, false);
        if (current != null) {
          liveTimer = setInterval(() => {
            const sec = Math.max(
                0,
                Math.floor((payload._deadlineMs - Date.now()) / 1000),
              ),
              box = qs("#examTimer", page);
            if (box) box.textContent = timerText(sec);
            if (sec <= 0) {
              clearLiveTimer();
              submitStudentAttempt(payload, answers, true);
            }
          }, 1000);
        }
        if (typeof window.renderMath === "function") window.renderMath(page);
      };
      bind();
    }
    async function submitStudentAttempt(payload, answers, auto) {
      const unanswered = (payload.questions || []).filter(
        (q) => !answers[q.id],
      ).length;
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
      const b = qs("#v122LiveSubmit", page || undefined);
      if (b) {
        b.disabled = true;
        b.textContent = auto ? "Hết giờ — đang nộp…" : "Đang nộp…";
      }
      try {
        const { data, error } = await db.rpc("submit_exam_attempt", {
          p_attempt_id: payload.attempt_id,
          p_answers: answers || {},
        });
        if (error) throw error;
        clearAttemptLocal(payload.attempt_id);
        await refreshStudentExamList();
        showStudentResult(payload.exam, data);
      } catch (e) {
        showError(e);
        if (b) {
          b.disabled = false;
          b.textContent = "Nộp bài";
        }
      }
    }
    function attemptAiAnalysisHtml(a) {
      const actions = a?.recommendations || a?.next_actions || [];
      return `<div class="ai-analysis-v122"><p>${escapeHtml(a?.summary || "")}</p>${a?.strengths?.length ? `<h4>Điểm mạnh</h4><ul>${a.strengths.map((x) => `<li>${escapeHtml(x)}</li>`).join("")}</ul>` : ""}${a?.needs_improvement?.length ? `<h4>Cần cải thiện</h4><ul>${a.needs_improvement.map((x) => `<li>${escapeHtml(x)}</li>`).join("")}</ul>` : ""}${actions.length ? `<h4>Khuyến nghị</h4><ul>${actions.map((x) => `<li>${escapeHtml(x)}</li>`).join("")}</ul>` : ""}</div>`;
    }
    async function requestAttemptAi(attemptId, button) {
      const old = button?.textContent;
      if (button) { button.disabled = true; button.textContent = "✦ Đang nhận xét…"; }
      try {
        const { data, error } = await db.functions.invoke("analyze-assessment", {
          body: { subject_id: subjectId(), scope: "attempt", attempt_id: attemptId },
        });
        if (error) throw error;
        if (!data?.success) throw new Error(data?.error || "AI chưa tạo được nhận xét");
        const out = qs(`[data-v123-ai-output="${attemptId}"]`);
        if (out) out.innerHTML = attemptAiAnalysisHtml(data.analysis);
        else notify("AI đã tạo nhận xét nhưng vùng kết quả không còn mở.");
      } catch (e) { showError(e); }
      finally { if (button) { button.disabled = false; button.textContent = old; } }
    }
    function studentResultHtml(result) {
      const reviewAllowed = !!result.show_review;
      const answersAllowed = !!result.show_answers;
      const detail = reviewAllowed && result.review?.length
        ? `<h4>Chi tiết bài làm</h4><div class="answer-review">${result.review.map((x, i) => `<details class="${x.is_correct ? "right" : "wrong"}"><summary>Câu ${i + 1} — ${x.is_correct ? "Đúng" : "Chưa đúng"} · ${escapeHtml(x.clo_code || "")}</summary><div>${escapeHtml(x.content || "")}</div><p>Bạn chọn: <b>${escapeHtml(x.selected || "Chưa trả lời")}</b>${answersAllowed ? ` · Đáp án đúng: <b>${escapeHtml(x.correct_answer || "")}</b>` : ""}</p>${answersAllowed && x.explanation ? `<p>${escapeHtml(x.explanation)}</p>` : ""}</details>`).join("")}</div>`
        : '<p class="hint">Giảng viên chưa cho phép xem lại chi tiết bài làm.</p>';
      const ai = result.allow_ai_feedback && result.attempt_id
        ? `<div class="result-ai-actions"><button type="button" class="ai-btn" data-v123-ai-attempt="${escapeHtml(result.attempt_id)}">✦ AI nhận xét bài làm</button></div><div data-v123-ai-output="${escapeHtml(result.attempt_id)}"></div>` : "";
      return `<div class="preview-result result-v122"><div class="result-score"><small>Điểm tổng</small><b>${Number(result.score || 0).toFixed(2)}</b><span>${Number(result.correct || 0)}/${Number(result.total || 0)} câu đúng</span></div><h4>Kết quả theo CLO</h4><div class="clo-results">${(result.clo_scores || []).map((x) => `<div><b>${escapeHtml(x.code || "CLO")}</b><strong>${Number(x.score || 0).toFixed(2)}</strong><span>${x.correct}/${x.total} câu đúng</span></div>`).join("") || "<p>Chưa có dữ liệu CLO.</p>"}</div>${ai}${detail}</div>`;
    }
    document.addEventListener("click", (event) => {
      const button = event.target?.closest?.("[data-v123-ai-attempt]");
      if (button) {
        const attemptId = button.dataset.v123AiAttempt;
        if (attemptId) requestAttemptAi(attemptId, button);
        return;
      }
      const leaving = event.target?.closest?.("#nav [data-view],#systemHomeBtn,#courseSystemReturn,#logoutBtn,[data-open-course]");
      if (leaving && document.querySelector(".student-attempt-page")) clearLiveTimer();
    });
    document.addEventListener("change", (event) => {
      if (event.target?.matches?.("#subjectSelect") && document.querySelector(".student-attempt-page")) clearLiveTimer();
    });
    function showStudentResult(exam, result) {
      clearLiveTimer();
      const html = studentResultHtml(result);
      if (typeof replaceDrawer === "function")
        replaceDrawer(`Kết quả · ${exam.title}`, html, null, {
          wide: true,
          eyebrow: "KẾT QUẢ BÀI LÀM",
        });
      else notify(`Điểm: ${Number(result.score || 0).toFixed(2)}`);
    }
    async function openStudentAttemptResult(attemptId) {
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
        if (typeof openDrawer === "function")
          openDrawer(`Kết quả · ${exam.title}`, studentResultHtml(data), null, {
            wide: true,
            eyebrow: "KẾT QUẢ BÀI LÀM",
          });
        else notify(`Điểm: ${Number(data.score || 0).toFixed(2)}`);
      } catch (e) {
        showError(e);
      }
    }

    return Object.freeze({ studentExamList, openStudentAttemptResult, clearLiveTimer, studentResultHtml });
  };
})();
