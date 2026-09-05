/* AI-CLO PTITHCM V12.3.3 — Online Assessment Builder module. */
(() => {
  "use strict";
  window.AICLO_ASSESSMENT_MODULES = window.AICLO_ASSESSMENT_MODULES || {};
  window.AICLO_ASSESSMENT_MODULES.createOnlineBuilderModule = function createOnlineBuilderModule(ctx) {
    const {
      db, state, subjectId, loadPracticeSets, poolSnapshot, snapshotQuestion, validOptions,
      getAssessmentRoot, exams, openExamDetail, escapeHtml, localInput, toIsoOrNull,
      findById, shuffle, notify, showError, qs, qsa, ask, openDrawer, replaceDrawer, modal, closeModal
    } = ctx;
    if (!db || !state || !subjectId || !loadPracticeSets || !poolSnapshot || !snapshotQuestion || !getAssessmentRoot || !exams || !openExamDetail || !escapeHtml || !localInput || !toIsoOrNull || !findById || !shuffle || !notify || !showError || !qs || !qsa || !ask) {
      throw new Error("Assessment Online Builder dependencies are incomplete");
    }

      function defaultBuilder(exam) {
        return {
          examId: exam?.id || null,
          exam,
          settings: {
            title: exam?.title || "",
            description: exam?.description || "",
            duration_minutes: +exam?.duration_minutes || 30,
            max_attempts: +exam?.max_attempts || 1,
            question_mode: exam?.question_mode || "common_fixed",
            score_policy: exam?.score_policy || "highest",
            opens_at: localInput(exam?.opens_at),
            closes_at: localInput(exam?.closes_at),
            show_review: !!exam?.show_review || !!exam?.show_answers,
            show_answers: !!exam?.show_answers,
            shuffle_questions: exam?.shuffle_questions !== false,
            shuffle_options: exam?.shuffle_options !== false,
            allow_ai_feedback: exam?.allow_ai_feedback !== false,
            counts_toward_grade: exam?.counts_toward_grade !== false,
          },
          structureMode: exam?.structure_mode || "topic_clo",
          selectedChapters: new Set(exam?.chapter_ids || []),
          selectedTopics: new Set(exam?.topic_ids || []),
          expandedChapters: new Set(exam?.chapter_ids || []),
          matrix: {
            ...(exam?.question_blueprint?.matrix || {}),
          },
          selected: [],
          locked: false,
          sets: null,
          frozenPool: new Map(),
          draftOverrides: new Map(),
          selectionDirty: false,
        };
      }
      function matrixKey(mode, rowId, cloId) {
        return `${mode === "chapter_pool" ? "c" : "t"}:${rowId}:${cloId}`;
      }
      function selectedTopicsFor(ctx, chapterId) {
        return ctx.sets.topics.filter(
          (t) => t.chapter_id === chapterId && ctx.selectedTopics.has(t.id),
        );
      }
      function eligibleForCell(ctx, rowId, cloId) {
        return ctx.sets.questions.filter(
          (q) =>
            q.clo_id === cloId &&
            (ctx.structureMode === "topic_clo"
              ? q.topic_id === rowId
              : q.chapter_id === rowId && ctx.selectedTopics.has(q.topic_id)),
        );
      }
      function matrixTotal(ctx) {
        return Object.values(ctx.matrix).reduce((s, v) => s + (+v || 0), 0);
      }
      function cloCounts(ctx) {
        const out = {};
        for (const c of ctx.sets.clos) out[c.code] = 0;
        for (const [key, n] of Object.entries(ctx.matrix)) {
          const cloId = key.split(":").at(-1),
            code = findById(ctx.sets.clos, cloId)?.code || cloId;
          out[code] = (out[code] || 0) + (+n || 0);
        }
        return out;
      }
      function designPool(ctx) {
        const merged = new Map(ctx.sets.questions.map((q) => [q.id, q]));
        for (const [id, q] of ctx.frozenPool || []) merged.set(id, q);
        for (const [id, q] of ctx.draftOverrides || []) merged.set(id, q);
        return [...merged.values()].filter(
          (q) =>
            ctx.selectedChapters.has(q.chapter_id) &&
            ctx.selectedTopics.has(q.topic_id),
        );
      }
      function drawSelection(ctx) {
        const chosen = [],
          used = new Set();
        if (ctx.structureMode === "topic_clo") {
          for (const t of ctx.sets.topics.filter((x) =>
            ctx.selectedTopics.has(x.id),
          )) {
            for (const clo of ctx.sets.clos) {
              const need =
                +ctx.matrix[matrixKey(ctx.structureMode, t.id, clo.id)] || 0;
              if (!need) continue;
              const candidates = shuffle(
                eligibleForCell(ctx, t.id, clo.id).filter((q) => !used.has(q.id)),
              );
              if (candidates.length < need)
                throw new Error(
                  `Không đủ câu ${clo.code} ở ${t.name}: cần ${need}, có ${candidates.length}`,
                );
              for (const q of candidates.slice(0, need)) {
                chosen.push(q);
                used.add(q.id);
              }
            }
          }
        } else {
          for (const ch of ctx.sets.chapters.filter((x) =>
            ctx.selectedChapters.has(x.id),
          )) {
            for (const clo of ctx.sets.clos) {
              const need =
                +ctx.matrix[matrixKey(ctx.structureMode, ch.id, clo.id)] || 0;
              if (!need) continue;
              const candidates = shuffle(
                eligibleForCell(ctx, ch.id, clo.id).filter((q) => !used.has(q.id)),
              );
              if (candidates.length < need)
                throw new Error(
                  `Không đủ câu ${clo.code} ở ${ch.name}: cần ${need}, có ${candidates.length}`,
                );
              for (const q of candidates.slice(0, need)) {
                chosen.push(q);
                used.add(q.id);
              }
            }
          }
        }
        return chosen;
      }
      function validateBuilder(ctx) {
        if (!ctx.settings.title.trim())
          throw new Error("Cần nhập tên bài kiểm tra");
        if (!ctx.selectedChapters.size)
          throw new Error("Cần chọn ít nhất một chương");
        if (!ctx.selectedTopics.size) throw new Error("Cần chọn ít nhất một mục");
        const total = matrixTotal(ctx);
        if (total < 1) throw new Error("Ma trận cần ít nhất một câu");
        for (const [key, n] of Object.entries(ctx.matrix)) {
          if ((+n || 0) < 0) throw new Error("Số câu trong ma trận không hợp lệ");
          if (!n) continue;
          const [, rowId, cloId] = key.split(":");
          const available = eligibleForCell(ctx, rowId, cloId).length;
          if (available < +n) {
            const clo = findById(ctx.sets.clos, cloId)?.code || "CLO";
            throw new Error(
              `${clo}: yêu cầu ${n} nhưng ngân hàng chỉ có ${available} câu phù hợp`,
            );
          }
        }
        return total;
      }
      async function openExamBuilder(exam) {
        try {
          const ctx = defaultBuilder(exam);
          ctx.sets = await loadPracticeSets();
          if (!ctx.sets.chapters.length || !ctx.sets.clos.length)
            return notify("Học phần cần có Chương và CLO trước khi tạo bài.", true);
          if (!ctx.sets.questions.length)
            return notify("Ngân hàng luyện tập chưa có câu hỏi được duyệt.", true);
          if (exam) {
            const [
              { count, error },
              { data: chosen, error: qe },
              { data: pool, error: pe },
            ] = await Promise.all([
              db
                .from("exam_attempts")
                .select("id", {
                  count: "exact",
                  head: true,
                })
                .eq("exam_id", exam.id),
              db
                .from("exam_questions")
                .select("question_id,question_order")
                .eq("exam_id", exam.id)
                .order("question_order"),
              db
                .from("exam_question_pool")
                .select(
                  "question_id,chapter_id,chapter_name,topic_id,topic_name,clo_id,clo_code,content,correct_answer,explanation,options",
                )
                .eq("exam_id", exam.id),
            ]);
            if (error) throw error;
            if (qe) throw qe;
            if (pe) throw pe;
            ctx.locked = (count || 0) > 0;
            const frozen = new Map(
              (pool || []).map((row) => [row.question_id, snapshotQuestion(row)]),
            );
            ctx.frozenPool = frozen;
            ctx.selected = (chosen || [])
              .map(
                (x) =>
                  frozen.get(x.question_id) ||
                  findById(ctx.sets.questions, x.question_id),
              )
              .filter(Boolean);
          }
          renderBuilder(ctx);
        } catch (e) {
          showError(e);
        }
      }
      function renderBuilder(ctx) {
        const c = getAssessmentRoot();
        if (!c) return;
        const total = matrixTotal(ctx);
        c.innerHTML = `<div class="assessment-builder-v122"><div class="subpage-head"><div><button id="v122BuilderBack" class="secondary compact">← Quay lại</button><small>${ctx.examId ? "CHỈNH SỬA" : "TẠO"} BÀI KIỂM TRA</small><h3>${escapeHtml(ctx.settings.title || "Bài kiểm tra mới")}</h3><p>Ngân hàng luyện tập – kiểm tra · ${ctx.locked ? "Cấu trúc đã khóa vì có lượt làm" : "Cấu trúc được lưu atomic cùng pool đóng băng"}</p></div><span class="badge">${total} câu</span></div>${builderInfo(ctx)}${builderStructure(ctx)}${builderQuestions(ctx)}<div class="form-actions assessment-builder-footer"><button id="v122BuilderCancel" class="secondary">Hủy</button><button id="v122Draw" class="secondary" ${ctx.locked ? "disabled" : ""}>Rút câu hỏi</button><button id="v122Save" class="primary">${ctx.examId ? "Lưu thay đổi" : "Tạo bài kiểm tra"}</button></div></div>`;
        bindBuilder(ctx);
        renderMathIn(c);
      }
      function renderMathIn(root) {
        if (typeof window.renderMath !== "function") return;
        requestAnimationFrame(() => window.renderMath(root || getAssessmentRoot()));
      }
      function builderInfo(ctx) {
        const s = ctx.settings,
          dis = ctx.locked ? "disabled" : "";
        return `<section class="panel"><div class="panel-head"><div><h3>1. Thông tin</h3><p class="hint">Các trường vận hành vẫn có thể sửa sau khi có lượt làm; cấu trúc đo lường thì không.</p></div></div><div class="form-grid"><label class="field wide">Tên bài<input data-v122-setting="title" value="${escapeHtml(s.title)}" required></label><label class="field wide">Mô tả<textarea data-v122-setting="description">${escapeHtml(s.description)}</textarea></label><label class="field">Thời gian (phút)<input type="number" min="1" max="300" data-v122-setting="duration_minutes" value="${s.duration_minutes}" ${dis}></label><label class="field">Số lần làm<input type="number" min="1" max="20" data-v122-setting="max_attempts" value="${s.max_attempts}"></label><label class="field">Cách rút câu<select data-v122-setting="question_mode" ${dis}><option value="common_fixed" ${s.question_mode === "common_fixed" ? "selected" : ""}>Đề chung cố định</option><option value="student_fixed" ${s.question_mode === "student_fixed" ? "selected" : ""}>Đề riêng theo sinh viên</option><option value="attempt_random" ${s.question_mode === "attempt_random" ? "selected" : ""}>Rút lại mỗi lần làm</option></select></label><label class="field">Cách ghi nhận<select data-v122-setting="score_policy"><option value="highest" ${s.score_policy === "highest" ? "selected" : ""}>Điểm cao nhất</option><option value="latest" ${s.score_policy === "latest" ? "selected" : ""}>Lần cuối</option><option value="average" ${s.score_policy === "average" ? "selected" : ""}>Trung bình</option></select></label><label class="field">Mở từ<input type="datetime-local" data-v122-setting="opens_at" value="${s.opens_at}" ${dis}></label><label class="field">Đóng lúc<input type="datetime-local" data-v122-setting="closes_at" value="${s.closes_at}"></label><div class="field wide assessment-options"><label><input type="checkbox" data-v122-check="show_review" ${s.show_review ? "checked" : ""}> Cho xem lại bài và biết đúng/sai</label><label><input type="checkbox" data-v122-check="show_answers" ${s.show_answers ? "checked" : ""} ${s.show_review ? "" : "disabled"}> Hiện đáp án đúng và lời giải</label><label><input type="checkbox" data-v122-check="shuffle_questions" ${s.shuffle_questions ? "checked" : ""} ${dis}> Trộn thứ tự câu</label><label><input type="checkbox" data-v122-check="shuffle_options" ${s.shuffle_options ? "checked" : ""} ${dis}> Trộn đáp án</label><label><input type="checkbox" data-v122-check="allow_ai_feedback" ${s.allow_ai_feedback ? "checked" : ""}> Cho phép AI nhận xét</label><label><input type="checkbox" data-v122-check="counts_toward_grade" ${s.counts_toward_grade ? "checked" : ""}> Tính vào kết quả CLO học phần</label></div></div></section>`;
      }
      function builderStructure(ctx) {
        const chapterCards = ctx.sets.chapters.map((ch) => {
          const topics = ctx.sets.topics.filter((t) => t.chapter_id === ch.id);
          const selectedCount = topics.filter((t) => ctx.selectedTopics.has(t.id)).length;
          const selected = ctx.selectedChapters.has(ch.id);
          const expanded = selected && ctx.expandedChapters.has(ch.id);
          return `<article class="ub-structure-chapter ${selected ? "selected" : ""}">
            <div class="ub-structure-chapter-head">
              <label class="ub-chapter-main"><input type="checkbox" data-v122-chapter="${ch.id}" ${selected ? "checked" : ""} ${ctx.locked ? "disabled" : ""}><span><b>${escapeHtml(ch.order_index)}. ${escapeHtml(ch.name)}</b><small>${selected ? `${selectedCount}/${topics.length} mục đã chọn` : `${topics.length} mục`}</small></span></label>
              ${selected ? `<button type="button" class="secondary compact ub-chapter-toggle" data-v123-chapter-toggle="${ch.id}" aria-expanded="${expanded}">${expanded ? "Thu gọn" : "Mở mục"}</button>` : ""}
            </div>
            ${expanded ? `<div class="ub-structure-topic-grid">${topics.map((t) => `<label class="ub-topic-item"><input type="checkbox" data-v122-topic="${t.id}" data-chapter="${ch.id}" ${ctx.selectedTopics.has(t.id) ? "checked" : ""} ${ctx.locked ? "disabled" : ""}><span>${escapeHtml(t.name)}</span></label>`).join("")}</div>` : ""}
          </article>`;
        }).join("");
        const selectedSummary = ctx.selectedChapters.size
          ? `${ctx.selectedChapters.size} chương · ${ctx.selectedTopics.size} mục đang chọn`
          : "Chưa chọn chương";
        return `<section class="panel ub-structure-panel"><div class="panel-head"><div><h3>2. Cấu trúc</h3><p class="hint">Chọn phạm vi kiến thức trước, sau đó phân bổ số câu theo CLO trong ma trận riêng bên dưới.</p></div><span class="badge">${selectedSummary}</span></div>
          <div class="ub-structure-block"><h4>Chế độ phân bổ CLO</h4><div class="ub-structure-segmented">
            <label class="${ctx.structureMode === "topic_clo" ? "active" : ""}"><input type="radio" name="v122StructureMode" value="topic_clo" ${ctx.structureMode === "topic_clo" ? "checked" : ""} ${ctx.locked ? "disabled" : ""}><span>CLO cho mỗi mục</span><small>Kiểm soát số câu CLO ở từng mục.</small></label>
            <label class="${ctx.structureMode === "chapter_pool" ? "active" : ""}"><input type="radio" name="v122StructureMode" value="chapter_pool" ${ctx.structureMode === "chapter_pool" ? "checked" : ""} ${ctx.locked ? "disabled" : ""}><span>CLO chung trong chương</span><small>Gộp các mục đã chọn thành một pool của chương.</small></label>
          </div></div>
          <div class="ub-structure-block"><div class="ub-structure-block-head"><h4>Chương và mục</h4><span>Chương chưa chọn được thu gọn để giảm chiều cao.</span></div><div class="ub-structure-chapters">${chapterCards}</div></div>
          <div class="ub-structure-block ub-matrix-block"><div class="ub-structure-block-head"><div><h4>Ma trận câu hỏi</h4><span>Chỉ hiển thị phạm vi đã chọn. Nhập số câu cần dùng trên tổng số câu có sẵn.</span></div><b>${matrixTotal(ctx)} câu</b></div>${matrixEditor(ctx)}</div>
        </section>`;
      }
      function matrixEditor(ctx) {
        if (!ctx.selectedTopics.size)
          return '<div class="empty"><b>Chưa có ma trận</b><span>Chọn ít nhất một chương và một mục để bắt đầu phân bổ câu hỏi.</span></div>';
        let rows = "";
        if (ctx.structureMode === "topic_clo") {
          for (const ch of ctx.sets.chapters.filter((x) => ctx.selectedChapters.has(x.id))) {
            const ts = selectedTopicsFor(ctx, ch.id);
            if (!ts.length) continue;
            rows += `<tr class="matrix-chapter"><td colspan="${ctx.sets.clos.length + 2}"><b>${escapeHtml(ch.order_index)}. ${escapeHtml(ch.name)}</b><small>${ts.length} mục</small></td></tr>` +
              ts.map((t) => `<tr class="ub-matrix-data-row"><td data-label="${ctx.structureMode === "topic_clo" ? "Mục" : "Chương"}"><b>${escapeHtml(t.name)}</b></td>${ctx.sets.clos.map((clo) => matrixCell(ctx, t.id, clo)).join("")}<td data-label="Tổng" class="ub-matrix-total"><b>${ctx.sets.clos.reduce((n, clo) => n + (+ctx.matrix[matrixKey(ctx.structureMode, t.id, clo.id)] || 0), 0)}</b></td></tr>`).join("");
          }
        } else {
          rows = ctx.sets.chapters.filter((ch) => ctx.selectedChapters.has(ch.id) && selectedTopicsFor(ctx, ch.id).length).map((ch) =>
            `<tr class="ub-matrix-data-row"><td data-label="Chương"><b>${escapeHtml(ch.order_index)}. ${escapeHtml(ch.name)}</b><small>${selectedTopicsFor(ctx, ch.id).map((t) => escapeHtml(t.name)).join(", ")}</small></td>${ctx.sets.clos.map((clo) => matrixCell(ctx, ch.id, clo)).join("")}<td data-label="Tổng" class="ub-matrix-total"><b>${ctx.sets.clos.reduce((n, clo) => n + (+ctx.matrix[matrixKey(ctx.structureMode, ch.id, clo.id)] || 0), 0)}</b></td></tr>`
          ).join("");
        }
        return `<div class="ub-matrix-table"><table class="exam-matrix"><thead><tr><th>${ctx.structureMode === "topic_clo" ? "Mục" : "Chương"}</th>${ctx.sets.clos.map((c) => `<th>${escapeHtml(c.code)}</th>`).join("")}<th>Tổng</th></tr></thead><tbody>${rows}<tr class="matrix-grand"><td><b>TỔNG</b></td>${ctx.sets.clos.map((c) => `<td data-label="${escapeHtml(c.code)}"><b>${Object.entries(ctx.matrix).filter(([k]) => k.endsWith(`:${c.id}`)).reduce((n, [, v]) => n + (+v || 0), 0)}</b></td>`).join("")}<td data-label="Tổng"><b>${matrixTotal(ctx)}</b></td></tr></tbody></table></div>`;
      }
      function matrixCell(ctx, rowId, clo) {
        const key = matrixKey(ctx.structureMode, rowId, clo.id),
          n = +ctx.matrix[key] || 0,
          available = eligibleForCell(ctx, rowId, clo.id).length;
        return `<td data-label="${escapeHtml(clo.code)}"><div class="ub-matrix-cell"><input class="v122-matrix-input" type="number" min="0" max="${Math.max(available, n)}" value="${n}" data-key="${key}" ${ctx.locked ? "disabled" : ""}><span>/ ${available} câu có sẵn</span></div></td>`;
      }
      function optionMap(q) {
        return Object.fromEntries(
          (q.question_options || []).map((o) => [
            String(o.option_key || "").toUpperCase(),
            o.content || "",
          ]),
        );
      }
      function questionCode(ctx, q) {
        const bank = findById(ctx.sets.questions, q?.id);
        return q?.display_code || bank?.display_code || (q?.id ? `Q-${String(q.id).slice(0, 8)}` : "—");
      }
      function questionCard(ctx, q, index) {
        const opts = optionMap(q),
          clo = findById(ctx.sets.clos, q.clo_id),
          ch = findById(ctx.sets.chapters, q.chapter_id),
          tp = findById(ctx.sets.topics, q.topic_id),
          code = questionCode(ctx, q);
        return `<article class="ub-question-card v122-question-card"><div class="ub-question-head"><div><b>Câu ${index + 1}</b><span class="ub-question-code">${escapeHtml(code)}</span><span class="badge red">${escapeHtml(clo?.code || "—")}</span><span class="badge">${escapeHtml(ch?.name || "—")}</span><span class="badge">${escapeHtml(tp?.name || "—")}</span></div>${ctx.locked ? "" : `<div class="ub-question-actions"><button type="button" class="secondary compact" data-v122-replace="${index}">Đổi câu</button><button type="button" class="secondary compact" data-v123-pick="${index}">Tự chọn</button><button type="button" class="secondary compact" data-v123-quick-edit="${index}">Sửa nhanh</button><button type="button" class="ai-btn compact" data-v122-ai="${index}">✦ Gemini sinh câu</button></div>`}</div><div class="detail-question">${escapeHtml(q.content || "")}</div><div class="detail-options">${["A", "B", "C", "D"].map((k) => `<div class="${String(q.correct_answer || "").toUpperCase() === k ? "correct" : ""}"><b>${k}</b><span>${escapeHtml(opts[k] || "")}</span></div>`).join("")}</div>${q.explanation ? `<p class="hint"><b>Lời giải:</b> ${escapeHtml(q.explanation)}</p>` : ""}</article>`;
      }
      function builderQuestions(ctx) {
        return `<section class="panel"><div class="panel-head"><div><h3>3. Bộ câu mẫu</h3><p class="hint">Câu đang hiển thị của bài cũ được đọc từ snapshot đóng băng. Đổi câu/Gemini chỉ sửa bản nháp; bấm Lưu mới thay snapshot trong DB.</p></div></div>${
          ctx.selected.length
            ? `<div class="v122-selected-summary"><b>${ctx.selected.length}/${matrixTotal(ctx)} câu đã rút</b> · ${Object.entries(
                cloCountsFromQuestions(ctx.selected, ctx.sets),
              )
                .map(([k, v]) => `${escapeHtml(k)}: ${v}`)
                .join(
                  " · ",
                )}${ctx.selectionDirty ? ' · <span class="badge">Chưa lưu thay đổi câu</span>' : ""}</div><div class="v122-selected-list">${ctx.selected.map((q, i) => questionCard(ctx, q, i)).join("")}</div>`
            : '<div class="empty"><b>Chưa rút câu</b><span>Hoàn tất ma trận rồi nhấn “Rút câu hỏi”.</span></div>'
        }</section>`;
      }
      function cloCountsFromQuestions(rows, sets) {
        const out = {};
        for (const q of rows) {
          const code = findById(sets.clos, q.clo_id)?.code || "—";
          out[code] = (out[code] || 0) + 1;
        }
        return out;
      }
      function replacementCandidates(ctx, index) {
        const old = ctx.selected[index],
          used = new Set(ctx.selected.map((q) => q.id));
        used.delete(old?.id);
        return ctx.sets.questions.filter(
          (q) =>
            q.id !== old?.id &&
            !used.has(q.id) &&
            q.clo_id === old?.clo_id &&
            (ctx.structureMode === "topic_clo"
              ? q.topic_id === old?.topic_id
              : q.chapter_id === old?.chapter_id &&
                ctx.selectedTopics.has(q.topic_id)),
        );
      }
      function closeBuilderDrawer() {
        document.querySelector("#drawerClose")?.click();
      }
      function openManualPicker(ctx, index) {
        if (typeof openDrawer !== "function") return notify("Không mở được panel tự chọn câu.", true);
        const old = ctx.selected[index], pool = replacementCandidates(ctx, index);
        const clo = findById(ctx.sets.clos, old?.clo_id), ch = findById(ctx.sets.chapters, old?.chapter_id), tp = findById(ctx.sets.topics, old?.topic_id);
        const html = `<div class="ub-picker"><p class="hint">Chỉ hiển thị câu hợp lệ cho đúng ô ma trận hiện tại: <b>${escapeHtml(clo?.code || "—")}</b> · ${escapeHtml(ch?.name || "—")}${ctx.structureMode === "topic_clo" ? ` · ${escapeHtml(tp?.name || "—")}` : ""}.</p><label class="field">Tìm câu<input id="v123PickSearch" placeholder="Mã câu hoặc nội dung"></label><div class="ub-picker-list">${pool.length ? pool.map((q,i) => `<article data-v123-pick-row data-search="${escapeHtml(`${questionCode(ctx,q)} ${q.content || ""}`.toLowerCase())}"><div><b>${escapeHtml(questionCode(ctx,q))}</b><span class="badge red">${escapeHtml(findById(ctx.sets.clos,q.clo_id)?.code || "—")}</span></div><div class="ub-picker-content">${escapeHtml(q.content || "")}</div><button type="button" class="primary compact" data-v123-pick-use="${i}">Chọn câu này</button></article>`).join("") : '<div class="empty"><b>Không còn câu phù hợp</b><span>Không có phương án thay thế khác cho ô ma trận này.</span></div>'}</div></div>`;
        openDrawer(`Tự chọn · Câu ${index + 1}`, html, () => {
          const search = document.querySelector("#v123PickSearch");
          if (search) search.oninput = () => {
            const term = search.value.trim().toLowerCase();
            document.querySelectorAll("[data-v123-pick-row]").forEach((row) => { row.hidden = !!term && !String(row.dataset.search || "").includes(term); });
          };
          document.querySelectorAll("[data-v123-pick-use]").forEach((button) => button.onclick = () => {
            const picked = pool[+button.dataset.v123PickUse];
            if (!picked) return;
            ctx.selected[index] = ctx.frozenPool?.get(picked.id) || picked;
            ctx.selectionDirty = true;
            closeBuilderDrawer();
            renderBuilder(ctx);
            notify(`Đã tự chọn ${questionCode(ctx,picked)} cho Câu ${index + 1}. Bấm Lưu thay đổi để cập nhật snapshot.`);
          });
          renderMathIn(document.querySelector("#sideDrawer"));
        }, { wide: true, eyebrow: "NGÂN HÀNG CÂU HỎI" });
      }
      function openQuickEdit(ctx, index) {
        if (typeof openDrawer !== "function") return notify("Không mở được panel sửa nhanh.", true);
        const q = ctx.selected[index]; if (!q) return;
        const opts = optionMap(q), code = questionCode(ctx,q);
        const html = `<div class="ub-quick-edit"><p class="hint"><b>${escapeHtml(code)}</b> · Chỉ sửa bản nháp của bài kiểm tra này; ngân hàng câu hỏi không thay đổi.</p><label class="field">Nội dung câu hỏi<textarea id="v123EditContent" rows="5">${escapeHtml(q.content || "")}</textarea></label><div class="ub-edit-options">${["A","B","C","D"].map((k) => `<label><span><input type="radio" name="v123EditCorrect" value="${k}" ${String(q.correct_answer || "").toUpperCase() === k ? "checked" : ""}> <b>${k}</b></span><textarea data-v123-edit-option="${k}" rows="2">${escapeHtml(opts[k] || "")}</textarea></label>`).join("")}</div><label class="field">Lời giải<textarea id="v123EditExplanation" rows="4">${escapeHtml(q.explanation || "")}</textarea></label><div class="form-actions"><button type="button" class="secondary" id="v123EditCancel">Hủy</button><button type="button" class="primary" id="v123EditSave">Áp dụng vào bản nháp</button></div></div>`;
        openDrawer(`Sửa nhanh · Câu ${index + 1}`, html, () => {
          document.querySelector("#v123EditCancel")?.addEventListener("click", closeBuilderDrawer);
          document.querySelector("#v123EditSave")?.addEventListener("click", () => {
            const content = document.querySelector("#v123EditContent")?.value.trim() || "";
            const explanation = document.querySelector("#v123EditExplanation")?.value.trim() || "";
            const correct = document.querySelector('input[name="v123EditCorrect"]:checked')?.value || "";
            const optionRows = ["A","B","C","D"].map((k) => ({ key:k, content: document.querySelector(`[data-v123-edit-option="${k}"]`)?.value.trim() || "" }));
            if (!content) return notify("Nội dung câu hỏi không được để trống.", true);
            if (optionRows.some((x) => !x.content)) return notify("Cần nhập đủ 4 phương án A–D.", true);
            if (!correct) return notify("Cần chọn đáp án đúng.", true);
            const updated = { ...q, content, explanation: explanation || null, correct_answer: correct, question_options: optionRows.map((x) => ({ option_key:x.key, content:x.content })) };
            ctx.selected[index] = updated;
            ctx.draftOverrides.set(updated.id, updated);
            ctx.selectionDirty = true;
            closeBuilderDrawer();
            renderBuilder(ctx);
            notify(`Đã sửa nhanh ${code} trong bản nháp. Ngân hàng câu hỏi chưa bị thay đổi.`);
          });
        }, { wide: true, eyebrow: "SỬA BẢN NHÁP" });
      }

      function replaceSelectedQuestion(ctx, index) {
        const pool = replacementCandidates(ctx, index);
        if (!pool.length)
          return notify("Không còn câu khác phù hợp với đúng ô ma trận này.", true);
        const picked = shuffle(pool)[0];
        ctx.selected[index] = ctx.frozenPool?.get(picked.id) || picked;
        ctx.selectionDirty = true;
        renderBuilder(ctx);
        notify(`Đã đổi Câu ${index + 1}. Bấm Lưu thay đổi để cập nhật snapshot.`);
      }
      async function generateAiQuestion(ctx, index, button) {
        const old = ctx.selected[index];
        if (!old) return;
        if (button) {
          button.disabled = true;
          button.textContent = "✦ Đang sinh…";
        }
        try {
          const { data, error } = await db.functions.invoke(
            "generate-one-question",
            {
              body: {
                subject_id: subjectId(),
                chapter_id: old.chapter_id,
                topic_id: old.topic_id,
                clo_id: old.clo_id,
              },
            },
          );
          if (error) throw error;
          if (!data?.success || !data?.question)
            throw new Error(data?.error || "Gemini không tạo được câu hỏi");
          previewAiQuestion(ctx, index, data.question, data.model || "Gemini");
        } catch (e) {
          showError(e);
          if (button) {
            button.disabled = false;
            button.textContent = "✦ Gemini sinh câu";
          }
        }
      }
      function previewAiQuestion(ctx, index, g, model) {
        if (typeof modal !== "function")
          return notify("Không mở được cửa sổ xem trước câu Gemini.", true);
        const opts = g.options || {};
        modal(
          `AI-CLO | Câu ${index + 1} do Gemini đề xuất`,
          `<div class="v122-ai-preview"><p class="hint">${escapeHtml(model)} · Câu chỉ được đưa vào bài sau khi bạn chọn “Dùng câu này” và bấm “Lưu thay đổi”.</p><div class="detail-question">${escapeHtml(g.content || "")}</div><div class="detail-options">${["A", "B", "C", "D"].map((k) => `<div class="${String(g.correct_answer || "").toUpperCase() === k ? "correct" : ""}"><b>${k}</b><span>${escapeHtml(opts[k] || "")}</span></div>`).join("")}</div>${g.explanation ? `<p class="hint"><b>Lời giải:</b> ${escapeHtml(g.explanation)}</p>` : ""}<p class="hint">Khi chấp nhận, câu này sẽ được lưu vào <b>Ngân hàng luyện tập – kiểm tra</b> để có mã câu hợp lệ cho frozen pool.</p><div class="form-actions"><button type="button" id="v122AiCancel" class="secondary">Hủy</button><button type="button" id="v122AiUse" class="primary">Dùng câu này</button></div></div>`,
        );
        qs("#v122AiCancel")?.addEventListener("click", () => {
          if (typeof closeModal === "function") closeModal();
          renderBuilder(ctx);
        });
        renderMathIn(document.querySelector("#modal"));
        qs("#v122AiUse")?.addEventListener("click", () =>
          acceptAiQuestion(ctx, index, g),
        );
      }
      async function acceptAiQuestion(ctx, index, g) {
        const btn = qs("#v122AiUse");
        if (btn) {
          btn.disabled = true;
          btn.textContent = "Đang lưu câu…";
        }
        let createdId = null;
        try {
          const old = ctx.selected[index],
            now = new Date().toISOString();
          const qr = await db
            .from("questions")
            .insert({
              subject_id: subjectId(),
              chapter_id: old.chapter_id,
              topic_id: old.topic_id,
              clo_id: old.clo_id,
              content: g.content,
              correct_answer: String(g.correct_answer || "").toUpperCase(),
              explanation: g.explanation || null,
              created_by: state.user.id,
              status: "active",
              question_scope: "practice",
              approval_status: "approved",
              approved_by: state.user.id,
              approved_at: now,
              origin_type: "gemini",
            })
            .select(
              "id,subject_id,display_code,chapter_id,topic_id,clo_id,content,correct_answer,explanation,status,question_scope,approval_status",
            )
            .single();
          if (qr.error) throw qr.error;
          createdId = qr.data.id;
          const rows = ["A", "B", "C", "D"].map((k) => ({
            question_id: createdId,
            option_key: k,
            content: g.options?.[k] || "",
          }));
          const or = await db.from("question_options").insert(rows);
          if (or.error) throw or.error;
          const nq = {
            ...qr.data,
            question_options: rows,
          };
          ctx.sets.questions.push(nq);
          ctx.selected[index] = nq;
          ctx.selectionDirty = true;
          if (typeof closeModal === "function") closeModal();
          renderBuilder(ctx);
          notify(
            `Đã dùng câu Gemini cho Câu ${index + 1}. Bấm Lưu thay đổi để cập nhật bài.`,
          );
        } catch (e) {
          if (createdId) {
            try {
              await db.from("questions").delete().eq("id", createdId);
            } catch {}
          }
          showError(e);
          if (btn) {
            btn.disabled = false;
            btn.textContent = "Dùng câu này";
          }
        }
      }
      function bindBuilder(ctx) {
        const c = getAssessmentRoot();
        qs("#v122BuilderBack", c).onclick = () =>
          ctx.examId ? openExamDetail(ctx.examId) : exams(c);
        qs("#v122BuilderCancel", c).onclick = () =>
          ctx.examId ? openExamDetail(ctx.examId) : exams(c);
        qsa("[data-v122-setting]", c).forEach(
          (el) =>
            (el.oninput = () => {
              const k = el.dataset.v122Setting;
              ctx.settings[k] = el.type === "number" ? +el.value : el.value;
            }),
        );
        qsa("[data-v122-check]", c).forEach(
          (el) =>
            (el.onchange = () => {
              const key = el.dataset.v122Check;
              ctx.settings[key] = el.checked;
              if (key === "show_review" && !el.checked) ctx.settings.show_answers = false;
              if (key === "show_answers" && el.checked) ctx.settings.show_review = true;
              if (key === "show_review" || key === "show_answers") renderBuilder(ctx);
            }),
        );
        qsa("[data-v122-chapter]", c).forEach(
          (el) =>
            (el.onchange = () => {
              const id = el.dataset.v122Chapter,
                topics = ctx.sets.topics.filter((t) => t.chapter_id === id);
              if (el.checked) {
                ctx.selectedChapters.add(id);
                ctx.expandedChapters.add(id);
                topics.forEach((t) => ctx.selectedTopics.add(t.id));
              } else {
                ctx.selectedChapters.delete(id);
                ctx.expandedChapters.delete(id);
                topics.forEach((t) => ctx.selectedTopics.delete(t.id));
              }
              ctx.selected = [];
              ctx.selectionDirty = true;
              cleanMatrix(ctx);
              renderBuilder(ctx);
            }),
        );
        qsa("[data-v123-chapter-toggle]", c).forEach((el) => {
          el.onclick = () => {
            const id = el.dataset.v123ChapterToggle;
            if (ctx.expandedChapters.has(id)) ctx.expandedChapters.delete(id);
            else ctx.expandedChapters.add(id);
            renderBuilder(ctx);
          };
        });
        qsa("[data-v122-topic]", c).forEach(
          (el) =>
            (el.onchange = () => {
              const id = el.dataset.v122Topic,
                ch = el.dataset.chapter;
              if (el.checked) ctx.selectedTopics.add(id);
              else ctx.selectedTopics.delete(id);
              const any = ctx.sets.topics.some(
                (t) => t.chapter_id === ch && ctx.selectedTopics.has(t.id),
              );
              if (any) ctx.selectedChapters.add(ch);
              else ctx.selectedChapters.delete(ch);
              ctx.selected = [];
              ctx.selectionDirty = true;
              cleanMatrix(ctx);
              renderBuilder(ctx);
            }),
        );
        qsa('input[name="v122StructureMode"]', c).forEach(
          (el) =>
            (el.onchange = () => {
              ctx.structureMode = el.value;
              ctx.matrix = {};
              ctx.selected = [];
              ctx.selectionDirty = true;
              renderBuilder(ctx);
            }),
        );
        qsa(".v122-matrix-input", c).forEach(
          (el) =>
            (el.onchange = () => {
              ctx.matrix[el.dataset.key] = Math.max(0, +el.value || 0);
              ctx.selected = [];
              ctx.selectionDirty = true;
              renderBuilder(ctx);
            }),
        );
        qsa("[data-v122-replace]", c).forEach(
          (el) =>
            (el.onclick = () =>
              replaceSelectedQuestion(ctx, +el.dataset.v122Replace)),
        );
        qsa("[data-v123-pick]", c).forEach(
          (el) => (el.onclick = () => openManualPicker(ctx, +el.dataset.v123Pick)),
        );
        qsa("[data-v123-quick-edit]", c).forEach(
          (el) => (el.onclick = () => openQuickEdit(ctx, +el.dataset.v123QuickEdit)),
        );
        qsa("[data-v122-ai]", c).forEach(
          (el) =>
            (el.onclick = () => generateAiQuestion(ctx, +el.dataset.v122Ai, el)),
        );
        qs("#v122Draw", c).onclick = () => {
          try {
            validateBuilder(ctx);
            ctx.selected = drawSelection(ctx);
            ctx.selectionDirty = true;
            renderBuilder(ctx);
            notify(`Đã rút ${ctx.selected.length} câu phù hợp ma trận`);
          } catch (e) {
            showError(e);
          }
        };
        qs("#v122Save", c).onclick = () => saveBuilder(ctx);
      }
      function cleanMatrix(ctx) {
        for (const key of Object.keys(ctx.matrix)) {
          const [, rowId] = key.split(":");
          if (ctx.structureMode === "topic_clo" && !ctx.selectedTopics.has(rowId))
            delete ctx.matrix[key];
          if (
            ctx.structureMode === "chapter_pool" &&
            !ctx.selectedChapters.has(rowId)
          )
            delete ctx.matrix[key];
        }
      }
      async function saveBuilder(ctx) {
        let createdId = null,
          saveBtn = qs("#v122Save");
        try {
          if (!ctx.settings.title.trim())
            throw new Error("Cần nhập tên bài kiểm tra");
          if (
            ctx.settings.opens_at &&
            ctx.settings.closes_at &&
            new Date(ctx.settings.closes_at) <= new Date(ctx.settings.opens_at)
          )
            throw new Error("Thời gian đóng phải sau thời gian mở");
          const total = ctx.locked
            ? +ctx.exam?.total_questions || 0
            : validateBuilder(ctx);
          if (!ctx.locked && ctx.selected.length !== total)
            throw new Error(
              "Cần nhấn “Rút câu hỏi” sau lần chỉnh ma trận cuối cùng",
            );
          if (saveBtn) {
            saveBtn.disabled = true;
            saveBtn.textContent = "Đang lưu…";
          }
          const settings = {
            title: ctx.settings.title.trim(),
            description: ctx.settings.description.trim() || null,
            duration_minutes: +ctx.settings.duration_minutes || 30,
            max_attempts: +ctx.settings.max_attempts || 1,
            question_mode: ctx.settings.question_mode,
            score_policy: ctx.settings.score_policy,
            opens_at: toIsoOrNull(ctx.settings.opens_at),
            closes_at: toIsoOrNull(ctx.settings.closes_at),
            show_review: !!ctx.settings.show_review,
            show_answers: !!ctx.settings.show_answers,
            shuffle_questions: !!ctx.settings.shuffle_questions,
            shuffle_options: !!ctx.settings.shuffle_options,
            allow_ai_feedback: !!ctx.settings.allow_ai_feedback,
            counts_toward_grade: !!ctx.settings.counts_toward_grade,
          };
          let examId = ctx.examId;
          if (!examId) {
            const payload = {
              ...settings,
              subject_id: subjectId(),
              status: "draft",
              exam_type: "chapter_test",
              created_by: state.user.id,
              total_questions: total,
              chapter_ids: [...ctx.selectedChapters],
              topic_ids: [...ctx.selectedTopics],
              clo_counts: cloCounts(ctx),
              structure_mode: ctx.structureMode,
              question_blueprint: {
                version: 1,
                source: "v12.2",
                matrix: {
                  ...ctx.matrix,
                },
              },
            };
            const r = await db.from("exams").insert(payload).select("*").single();
            if (r.error) throw r.error;
            examId = r.data.id;
            createdId = examId;
          } else {
            const r = await db
              .from("exams")
              .update(settings)
              .eq("id", examId)
              .select("*")
              .single();
            if (r.error) throw r.error;
          }
          if (!ctx.locked) {
            const pool = designPool(ctx).map((q) => poolSnapshot(q, ctx.sets)),
              blueprint = {
                version: 1,
                source: "v12.2",
                matrix: {
                  ...ctx.matrix,
                },
              };
            const r = await db.rpc("replace_exam_design", {
              p_exam_id: examId,
              p_structure_mode: ctx.structureMode,
              p_blueprint: blueprint,
              p_chapter_ids: [...ctx.selectedChapters],
              p_topic_ids: [...ctx.selectedTopics],
              p_clo_counts: cloCounts(ctx),
              p_total_questions: total,
              p_pool: pool,
              p_selected: ctx.selected.map((q) => q.id),
            });
            if (r.error) throw r.error;
          }
          ctx.selectionDirty = false;
          notify(ctx.examId ? "Đã lưu thay đổi" : "Đã tạo bài kiểm tra");
          await openExamDetail(examId);
        } catch (e) {
          if (createdId) {
            try {
              await db.from("exams").delete().eq("id", createdId);
            } catch {}
          }
          showError(e);
          if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.textContent = ctx.examId ? "Lưu thay đổi" : "Tạo bài kiểm tra";
          }
        }
      }


    return Object.freeze({ openExamBuilder });
  };
})();
