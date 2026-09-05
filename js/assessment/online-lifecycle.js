/* AI-CLO PTITHCM V12.3 — Online Assessment Lifecycle module. */
(() => {
  "use strict";
  window.AICLO_ASSESSMENT_MODULES = window.AICLO_ASSESSMENT_MODULES || {};
  window.AICLO_ASSESSMENT_MODULES.createOnlineLifecycleModule = function createOnlineLifecycleModule(ctx) {
    const {
      db, ask, notify, showError, getAssessmentRoot, exams, openExamBuilder, studentResultHtml,
      statusMeta, modeLabel, structureLabel, escapeHtml, formatDateTime, qs, qsa, shuffle,
      openDrawer, replaceDrawer
    } = ctx;
    if (!db || !ask || !notify || !showError || !getAssessmentRoot || !exams || !openExamBuilder || !studentResultHtml || !statusMeta || !modeLabel || !structureLabel || !escapeHtml || !formatDateTime || !qs || !qsa || !shuffle) {
      throw new Error("Assessment Online Lifecycle dependencies are incomplete");
    }
      function onlineTable(items, counts) {
        return `<div class="toolbar"><span class="hint">Mỗi bài có một trang Chi tiết duy nhất.</span><button id="v122CreateExam" class="primary">+ Tạo bài kiểm tra</button></div><div class="panel table-wrap"><table class="assessment-table"><thead><tr><th>Bài kiểm tra</th><th>Cấu trúc</th><th>Chế độ câu</th><th>Thời gian</th><th>Bài làm</th><th>Trạng thái</th><th></th></tr></thead><tbody>${
          items
            .map((x) => {
              const s = statusMeta(x),
                n = counts.get(x.id) || {
                  all: 0,
                  submitted: 0,
                };
              return `<tr><td><button type="button" class="exam-title-link" data-v122-detail="${x.id}"><b>${escapeHtml(x.title || "Bài kiểm tra")}</b></button><br><small>${escapeHtml(x.description || "")}</small></td><td><b>${Number(x.total_questions || 0)}</b> câu<br><small>${escapeHtml(structureLabel(x.structure_mode))}</small></td><td><span class="badge">${escapeHtml(modeLabel(x.question_mode))}</span></td><td>${x.duration_minutes || "—"} phút<br><small>${x.opens_at ? formatDateTime(x.opens_at) : "Khi phát hành"} → ${x.closes_at ? formatDateTime(x.closes_at) : "Không giới hạn"}</small></td><td><b>${n.submitted}</b> đã nộp<br><small>${n.all} lượt</small></td><td><span class="badge ${s.className}">${s.label}</span></td><td><button type="button" class="primary" data-v122-detail="${x.id}">Chi tiết →</button></td></tr>`;
            })
            .join("") ||
          '<tr><td colspan="7" class="empty">Chưa có bài kiểm tra.</td></tr>'
        }</tbody></table></div>`;
      }

      function bindOnlineList(root, items) {
        qsa("[data-v122-detail]", root).forEach(
          (b) =>
            (b.onclick = () => {
              const x = items.find((v) => v.id === b.dataset.v122Detail);
              if (x) openExamDetail(x);
            }),
        );
        const add = qs("#v122CreateExam", root);
        if (add) add.onclick = () => openExamBuilder(null);
      }


      async function setStatus(exam, next) {
        const label =
          next === "active"
            ? exam.status === "closed"
              ? "Mở lại"
              : "Phát hành"
            : "Tạm dừng";
        const message =
          next === "closed"
            ? "Sinh viên sẽ không thể bắt đầu lượt mới. Lượt đang làm vẫn được phép tiếp tục."
            : next === "active"
              ? "Bài sẽ cho phép sinh viên bắt đầu lượt mới theo thời gian mở/đóng đã cấu hình."
              : "";
        if (!(await ask(label, message, label))) return false;
        const payload = {
          status: next,
        };
        if (next === "active" && !exam.published_at)
          payload.published_at = new Date().toISOString();
        const { data, error } = await db
          .from("exams")
          .update(payload)
          .eq("id", exam.id)
          .select("*")
          .single();
        if (error) throw error;
        if (!data || data.status !== next)
          throw new Error(`Supabase chưa đổi trạng thái sang ${next}`);
        Object.assign(exam, data);
        notify(
          label === "Tạm dừng"
            ? "Đã tạm dừng bài kiểm tra"
            : label === "Mở lại"
              ? "Đã mở lại bài kiểm tra"
              : "Đã phát hành bài kiểm tra",
        );
        return true;
      }
      async function deleteExam(exam) {
        const { count, error } = await db
          .from("exam_attempts")
          .select("id", {
            count: "exact",
            head: true,
          })
          .eq("exam_id", exam.id);
        if (error) throw error;
        if (count > 0) return notify("Bài đã có lượt làm nên không thể xóa.", true);
        if (
          !(await ask(
            "Xóa bài kiểm tra",
            `Xóa “${exam.title || "Bài kiểm tra"}”? Thao tác này không thể hoàn tác.`,
            "Xóa",
          ))
        )
          return;
        const r = await db.from("exams").delete().eq("id", exam.id);
        if (r.error) throw r.error;
        notify("Đã xóa bài kiểm tra");
        await exams(getAssessmentRoot());
      }
      function detailActions(exam) {
        if (exam.status === "draft")
          return `<button id="v122Edit" class="secondary">Chỉnh sửa</button><button id="v122Publish" class="primary">Phát hành</button><button id="v122Delete" class="danger">Xóa</button>`;
        if (exam.status === "closed")
          return `<button id="v122Edit" class="secondary">Chỉnh sửa</button><button id="v122Reopen" class="primary">Mở lại</button>`;
        return `<button id="v122Edit" class="secondary">Chỉnh sửa</button><button id="v122Pause" class="secondary">Tạm dừng</button>`;
      }
      async function loadExamAttempts(examId) {
        const { data, error } = await db
          .from("exam_attempts")
          .select(
            "id,exam_id,student_id,attempt_number,started_at,submitted_at,score,profiles:student_id(id,full_name,mssv,email)",
          )
          .eq("exam_id", examId)
          .order("started_at", {
            ascending: false,
          });
        if (error) throw error;
        return data || [];
      }
      function attemptStudentName(a) {
        return a.profiles?.full_name || a.profiles?.email || "Sinh viên";
      }
      function attemptSort(rows, mode) {
        const out = [...rows];
        if (mode === "name")
          out.sort((a, b) =>
            attemptStudentName(a).localeCompare(attemptStudentName(b), "vi"),
          );
        else if (mode === "score")
          out.sort(
            (a, b) =>
              (b.score == null ? -Infinity : +b.score) -
              (a.score == null ? -Infinity : +a.score),
          );
        else
          out.sort(
            (a, b) =>
              new Date(b.submitted_at || b.started_at || 0) -
              new Date(a.submitted_at || a.started_at || 0),
          );
        return out;
      }
      function attemptTableHtml(rows, mode = "date") {
        const sorted = attemptSort(rows, mode);
        return `<div class="toolbar"><span class="hint">${rows.length} lượt làm · ${rows.filter((x) => x.submitted_at).length} đã nộp</span><label class="field compact-field">Sắp xếp<select id="v122AttemptSort"><option value="date" ${mode === "date" ? "selected" : ""}>Mới nhất</option><option value="name" ${mode === "name" ? "selected" : ""}>Tên sinh viên</option><option value="score" ${mode === "score" ? "selected" : ""}>Điểm cao</option></select></label></div><div class="table-wrap"><table class="assessment-attempt-table"><thead><tr><th>STT</th><th>Sinh viên</th><th>Lần</th><th>Bắt đầu</th><th>Nộp</th><th>Điểm</th><th>Trạng thái</th><th></th></tr></thead><tbody>${sorted.map((a, i) => `<tr><td>${i + 1}</td><td><b>${escapeHtml(attemptStudentName(a))}</b><br><small>${escapeHtml(a.profiles?.mssv || a.profiles?.email || "")}</small></td><td>${a.attempt_number || 1}</td><td>${formatDateTime(a.started_at)}</td><td>${a.submitted_at ? formatDateTime(a.submitted_at) : "—"}</td><td>${a.submitted_at && a.score != null ? `<b>${Number(a.score).toFixed(2)}</b>` : "—"}</td><td><span class="badge ${a.submitted_at ? "green" : ""}">${a.submitted_at ? "Đã nộp" : "Đang làm"}</span></td><td class="row-actions">${a.submitted_at ? `<button type="button" class="secondary compact" data-v122-view-attempt="${a.id}">Xem bài</button>` : '<button type="button" class="secondary compact" disabled>Đang làm</button>'}<button type="button" class="danger compact" data-v122-delete-attempt="${a.id}">Xóa lượt</button></td></tr>`).join("") || '<tr><td colspan="8" class="empty">Chưa có lượt làm.</td></tr>'}</tbody></table></div>`;
      }
      async function openExamDetail(examOrId) {
        try {
          let exam = typeof examOrId === "string" ? null : examOrId;
          if (!exam) {
            const { data, error } = await db
              .from("exams")
              .select("*")
              .eq("id", examOrId)
              .single();
            if (error) throw error;
            exam = data;
          }
          const attempts = await loadExamAttempts(exam.id),
            c = getAssessmentRoot();
          if (!c) return;
          const s = statusMeta(exam);
          c.innerHTML = `<div class="assessment-detail-v122"><div class="subpage-head"><div><button id="v122Back" class="secondary compact">← Quay lại</button><small>BÀI KIỂM TRA TRỰC TUYẾN</small><h3>${escapeHtml(exam.title || "Bài kiểm tra")}</h3><p>${escapeHtml(exam.description || "")}</p></div><span class="badge ${s.className}">${s.label}</span></div><section class="panel"><div class="panel-head"><div><h3>Thông tin bài kiểm tra</h3><p class="hint">Một nguồn trạng thái duy nhất từ bảng exams.</p></div><div class="assessment-detail-actions"><button id="v122Preview" class="secondary">Làm thử</button>${detailActions(exam)}</div></div><div class="detail-grid"><div><small>Số câu</small><b>${Number(exam.total_questions || 0)}</b></div><div><small>Thời gian</small><b>${exam.duration_minutes || "—"} phút</b></div><div><small>Số lần làm</small><b>${exam.max_attempts || 1}</b></div><div><small>Lượt đã tạo</small><b>${attempts.length}</b></div><div><small>Rút câu</small><b>${escapeHtml(modeLabel(exam.question_mode))}</b></div><div><small>Cấu trúc</small><b>${escapeHtml(structureLabel(exam.structure_mode))}</b></div></div></section><section class="panel"><div class="panel-head"><div><h3>Cấu trúc và bộ câu</h3><p class="hint">Làm thử đọc trực tiếp frozen snapshot; không tạo lượt làm và không ghi điểm.</p></div></div><div id="v122DesignSummary"></div></section><section class="panel"><div class="panel-head"><div><h3>Danh sách bài làm</h3><p class="hint">Xem từng bài đã nộp hoặc xóa một lượt làm khi cần.</p></div></div><div id="v122AttemptList">${attemptTableHtml(attempts)}</div></section></div>`;
          qs("#v122Back")?.addEventListener("click", () => exams(c));
          qs("#v122Preview")?.addEventListener("click", () =>
            openTeacherPreview(exam),
          );
          qs("#v122Edit")?.addEventListener("click", () => openExamBuilder(exam));
          qs("#v122Publish")?.addEventListener("click", async () => {
            try {
              if (await setStatus(exam, "active")) await openExamDetail(exam);
            } catch (e) {
              showError(e);
            }
          });
          qs("#v122Pause")?.addEventListener("click", async () => {
            try {
              if (await setStatus(exam, "closed")) await openExamDetail(exam);
            } catch (e) {
              showError(e);
            }
          });
          qs("#v122Reopen")?.addEventListener("click", async () => {
            try {
              if (await setStatus(exam, "active")) await openExamDetail(exam);
            } catch (e) {
              showError(e);
            }
          });
          qs("#v122Delete")?.addEventListener("click", async () => {
            try {
              await deleteExam(exam);
            } catch (e) {
              showError(e);
            }
          });
          bindAttemptTable(exam, attempts, "date");
          await renderDesignSummary(exam);
        } catch (e) {
          showError(e);
        }
      }
      function bindAttemptTable(exam, attempts, mode) {
        const box = qs("#v122AttemptList");
        if (!box) return;
        const sort = qs("#v122AttemptSort", box);
        if (sort)
          sort.onchange = () => {
            box.innerHTML = attemptTableHtml(attempts, sort.value);
            bindAttemptTable(exam, attempts, sort.value);
          };
        qsa("[data-v122-view-attempt]", box).forEach(
          (b) =>
            (b.onclick = () =>
              openTeacherAttemptResult(exam, b.dataset.v122ViewAttempt)),
        );
        qsa("[data-v122-delete-attempt]", box).forEach(
          (b) =>
            (b.onclick = () => deleteAttempt(exam, b.dataset.v122DeleteAttempt)),
        );
      }
      async function deleteAttempt(exam, attemptId) {
        try {
          if (
            !(await ask(
              "Xóa lượt làm",
              "Xóa lượt làm này? Điểm và dữ liệu trả lời của lượt sẽ bị xóa.",
              "Xóa lượt",
            ))
          )
            return;
          const r = await db.from("exam_attempts").delete().eq("id", attemptId);
          if (r.error) throw r.error;
          notify("Đã xóa lượt làm");
          await openExamDetail(exam.id);
        } catch (e) {
          showError(e);
        }
      }
      async function openTeacherAttemptResult(exam, attemptId) {
        try {
          const { data, error } = await db.rpc("get_attempt_result", {
            p_attempt_id: attemptId,
          });
          if (error) throw error;
          const html = studentResultHtml(data);
          if (typeof openDrawer === "function")
            openDrawer(`Bài làm · ${exam.title}`, html, null, {
              wide: true,
              eyebrow: "GIẢNG VIÊN XEM BÀI",
            });
          else notify(`Điểm: ${Number(data.score || 0).toFixed(2)}`);
        } catch (e) {
          showError(e);
        }
      }
      async function renderDesignSummary(exam) {
        const box = qs("#v122DesignSummary");
        if (!box) return;
        const [{ data: pool, error }, { data: selected, error: se }] =
          await Promise.all([
            db
              .from("exam_question_pool")
              .select("question_id,chapter_name,topic_name,clo_code")
              .eq("exam_id", exam.id),
            db
              .from("exam_questions")
              .select("question_id,question_order")
              .eq("exam_id", exam.id)
              .order("question_order"),
          ]);
        if (error || se) {
          box.innerHTML = '<p class="hint">Chưa đọc được snapshot bộ câu.</p>';
          return;
        }
        const rows = pool || [],
          clo = {};
        for (const r of rows)
          clo[r.clo_code || "—"] = (clo[r.clo_code || "—"] || 0) + 1;
        box.innerHTML = `<div class="detail-grid"><div><small>Pool đóng băng</small><b>${rows.length} câu</b></div><div><small>Bộ câu mẫu</small><b>${(selected || []).length} câu</b></div><div><small>CLO trong pool</small><b>${
          Object.entries(clo)
            .map(([k, v]) => `${escapeHtml(k)}: ${v}`)
            .join(" · ") || "—"
        }</b></div></div>`;
      }
      async function loadTeacherPreviewQuestions(exam) {
        const [{ data: chosen, error: ce }, { data: pool, error: pe }] =
          await Promise.all([
            db
              .from("exam_questions")
              .select("question_id,question_order")
              .eq("exam_id", exam.id)
              .order("question_order"),
            db
              .from("exam_question_pool")
              .select(
                "question_id,chapter_name,topic_name,clo_code,content,correct_answer,explanation,options",
              )
              .eq("exam_id", exam.id),
          ]);
        if (ce) throw ce;
        if (pe) throw pe;
        const map = new Map((pool || []).map((x) => [x.question_id, x]));
        let questions = (chosen || [])
          .map((x) => map.get(x.question_id))
          .filter(Boolean);
        if (exam.shuffle_questions) questions = shuffle(questions);
        if (exam.shuffle_options)
          questions = questions.map((q) => ({
            ...q,
            options: shuffle(q.options || []),
          }));
        return questions;
      }
      async function openTeacherPreview(exam) {
        try {
          const questions = await loadTeacherPreviewQuestions(exam);
          if (!questions.length)
            return notify("Bài chưa có bộ câu mẫu để làm thử.", true);
          showTeacherPreviewQuestion(exam, questions, {}, 0, true);
        } catch (e) {
          showError(e);
        }
      }
      function showTeacherPreviewQuestion(
        exam,
        questions,
        answers,
        index,
        first = false,
      ) {
        const qx = questions[index];
        if (!qx) return;
        const html = `<div class="exam-preview"><div class="preview-head"><b>Câu ${index + 1}/${questions.length}</b><span class="badge red">${escapeHtml(qx.clo_code || "—")}</span><span>Bộ câu mẫu đóng băng · không lưu kết quả</span></div><div class="live-context"><span>${escapeHtml(qx.chapter_name || "")}</span><span>${escapeHtml(qx.topic_name || "")}</span></div><div class="preview-question">${escapeHtml(qx.content || "")}</div><div class="preview-options">${(qx.options || []).map((o) => `<label class="${answers[qx.question_id] === o.key ? "selected" : ""}"><input type="radio" name="v122PreviewAnswer" value="${escapeHtml(o.key)}" ${answers[qx.question_id] === o.key ? "checked" : ""}><b>${escapeHtml(o.key)}</b><span>${escapeHtml(o.content || "")}</span></label>`).join("")}</div><div class="question-jump">${questions.map((q, i) => `<button type="button" data-v122-preview-jump="${i}" class="${i === index ? "current" : ""} ${answers[q.question_id] ? "answered" : ""}">${i + 1}</button>`).join("")}</div><div class="preview-nav"><button id="v122PreviewPrev" class="secondary" ${index === 0 ? "disabled" : ""}>← Trước</button><button id="v122PreviewNext" class="secondary" ${index === questions.length - 1 ? "disabled" : ""}>Sau →</button><button id="v122PreviewSubmit" class="primary">Nộp bài thử</button></div></div>`;
        const bind = () => {
          qsa('input[name="v122PreviewAnswer"]', qs("#drawerBody")).forEach(
            (r) =>
              (r.onchange = () => {
                answers[qx.question_id] = r.value;
                showTeacherPreviewQuestion(exam, questions, answers, index, false);
              }),
          );
          qsa("[data-v122-preview-jump]", qs("#drawerBody")).forEach(
            (b) =>
              (b.onclick = () =>
                showTeacherPreviewQuestion(
                  exam,
                  questions,
                  answers,
                  +b.dataset.v122PreviewJump,
                  false,
                )),
          );
          qs("#v122PreviewPrev").onclick = () =>
            showTeacherPreviewQuestion(exam, questions, answers, index - 1, false);
          qs("#v122PreviewNext").onclick = () =>
            showTeacherPreviewQuestion(exam, questions, answers, index + 1, false);
          qs("#v122PreviewSubmit").onclick = async () => {
            const missing = questions.filter((q) => !answers[q.question_id]).length;
            if (
              missing &&
              !(await ask(
                "Nộp bài thử",
                `Còn ${missing} câu chưa trả lời. Vẫn xem kết quả?`,
                "Xem kết quả",
              ))
            )
              return;
            showTeacherPreviewResult(exam, questions, answers);
          };
        };
        if (first && typeof openDrawer === "function")
          openDrawer(`Làm thử · ${exam.title}`, html, bind, {
            wide: true,
            eyebrow: "CHẾ ĐỘ GIẢNG VIÊN",
          });
        else if (typeof replaceDrawer === "function")
          replaceDrawer(`Làm thử · ${exam.title}`, html, bind, {
            wide: true,
            eyebrow: "CHẾ ĐỘ GIẢNG VIÊN",
          });
      }
      function showTeacherPreviewResult(exam, questions, answers) {
        const correct = questions.filter(
            (q) => answers[q.question_id] === q.correct_answer,
          ).length,
          codes = [...new Set(questions.map((q) => q.clo_code).filter(Boolean))];
        const byClo = codes.map((code) => {
          const cloQuestions = questions.filter((q) => q.clo_code === code);
          const right = cloQuestions.filter(
            (q) => answers[q.question_id] === q.correct_answer,
          ).length;
          return {
            code,
            total: cloQuestions.length,
            correct: right,
            score: cloQuestions.length ? (right * 10) / cloQuestions.length : 0,
          };
        });
        const html = `<div class="preview-result"><div class="result-score"><small>Điểm bài thử</small><b>${questions.length ? ((correct * 10) / questions.length).toFixed(2) : "0.00"}</b><span>${correct}/${questions.length} câu đúng</span></div><div class="clo-results">${byClo.map((x) => `<div><b>${escapeHtml(x.code)}</b><strong>${x.score.toFixed(2)}</strong><span>${x.correct}/${x.total} câu đúng</span></div>`).join("")}</div><p class="hint">Làm thử chỉ dùng frozen snapshot, không tạo lượt làm, không ghi điểm và không gọi AI.</p><div class="drawer-actions"><button id="v122PreviewRetry" class="primary">Làm lại</button></div></div>`;
        if (typeof replaceDrawer === "function")
          replaceDrawer(
            `Kết quả làm thử · ${exam.title}`,
            html,
            () => {
              qs("#v122PreviewRetry").onclick = () =>
                showTeacherPreviewQuestion(exam, questions, {}, 0, false);
            },
            {
              wide: true,
              eyebrow: "KẾT QUẢ LÀM THỬ",
            },
          );
      }


    return Object.freeze({ onlineTable, bindOnlineList, openExamDetail });
  };
})();
