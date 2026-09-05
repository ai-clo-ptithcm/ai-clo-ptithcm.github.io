/* AI-CLO PTITHCM V12.2.1 — Assessment single-owner engine.
   Refactor only: formatted source, explicit runtime/root state, sectioned domains and clearer helper names; same V12.2 behavior. */
(() => {
  "use strict";

  /* App-shell dependencies: db, state, canTeach, toast, err, modal, closeModal,
   openDrawer, replaceDrawer and confirmAction. Assessment remains the only runtime owner. */
  const runtime = { root: null };
  const getAssessmentRoot = () =>
    runtime.root || document.querySelector("#content");
  const setAssessmentRoot = (root) => {
    if (root) runtime.root = root;
    return getAssessmentRoot();
  };
  const VERSION = "12.3.0-a5";
  const {
    qs,
    qsa,
    escapeHtml,
    formatDateTime,
    localInput,
    toIsoOrNull,
    findById,
    shuffle,
    modeLabel,
    structureLabel,
    statusMeta,
    validOptions,
    poolSnapshot,
    snapshotQuestion,
  } = window.AICLO_ASSESSMENT_COMMON || {};
  if (!qs || !snapshotQuestion)
    throw new Error("Assessment common utilities were not loaded");
  const isTeacher = () => typeof canTeach === "function" && canTeach();
  const subjectId = () => state?.subjectId || null;
  const notify = (message, bad = false) => {
    if (typeof toast === "function") toast(message, bad);
    else if (bad && typeof err === "function") err(new Error(message));
  };
  const showError = (e) => {
    if (typeof err === "function") err(e);
    else console.error(e);
  };
  /* ============================================================
   * SECTION 1/7 — Core runtime, schema, shared data and list rendering
   * ============================================================ */
  async function schemaReady() {
    try {
      const { data, error } = await db.rpc("assessment_schema_version");
      if (error) throw error;
      return String(data || "") === "12.2";
    } catch {
      return false;
    }
  }
  function migrationNotice(c) {
    c.innerHTML = `<div class="panel migration-panel"><h3>Cần hoàn tất Assessment V12.2 trên Supabase</h3><p>Frontend V12.2 chỉ chạy khi backend contract 12.2 đã được cài.</p><ol><li>Mở <b>Supabase → SQL Editor</b>.</li><li>Chạy <code>docs/assessment-v12.2-migration.sql</code>.</li><li>Tải lại trang.</li></ol></div>`;
  }
  async function ask(title, message, label = "Xác nhận") {
    if (typeof confirmAction === "function")
      return !!(await confirmAction(title, message, {
        confirmLabel: label,
      }));
    return window.confirm(message);
  }
  async function fetchExams() {
    const { data, error } = await db
      .from("exams")
      .select("*")
      .eq("subject_id", subjectId())
      .order("created_at", {
        ascending: false,
      });
    if (error) throw error;
    return data || [];
  }
  async function fetchAttemptCounts(examIds) {
    const out = new Map();
    if (!examIds.length) return out;
    const { data, error } = await db
      .from("exam_attempts")
      .select("exam_id,submitted_at")
      .in("exam_id", examIds);
    if (error) throw error;
    for (const row of data || []) {
      const x = out.get(row.exam_id) || {
        all: 0,
        submitted: 0,
      };
      x.all++;
      if (row.submitted_at) x.submitted++;
      out.set(row.exam_id, x);
    }
    return out;
  }
  async function fetchFinalPackages() {
    const { data, error } = await db
      .from("final_exam_packages")
      .select(
        "id,subject_id,title,status,updated_at,created_at,created_by,metadata,matrix,source_scope,selected_questions,variants",
      )
      .eq("subject_id", subjectId())
      .order("updated_at", {
        ascending: false,
      });
    if (error) throw error;
    return data || [];
  }
  async function loadQuestionSets(scope = "practice") {
    const [{ data: chapters, error: ce }, { data: clos, error: loe }] =
      await Promise.all([
        db
          .from("chapters")
          .select("*")
          .eq("subject_id", subjectId())
          .order("order_index"),
        db.from("clos").select("*").eq("subject_id", subjectId()).order("code"),
      ]);
    if (ce) throw ce;
    if (loe) throw loe;
    const chIds = (chapters || []).map((x) => x.id);
    let topics = [];
    if (chIds.length) {
      const r = await db
        .from("topics")
        .select("*")
        .in("chapter_id", chIds)
        .order("order_index");
      if (r.error) throw r.error;
      topics = r.data || [];
    }
    const qr = await db
      .from("questions")
      .select(
        "id,subject_id,display_code,chapter_id,topic_id,clo_id,content,correct_answer,explanation,status,question_scope,approval_status,question_options(id,option_key,content)",
      )
      .eq("subject_id", subjectId())
      .eq("status", "active")
      .eq("approval_status", "approved");
    if (qr.error) throw qr.error;
    const allowed =
      scope === "secure_exam" ? ["secure_exam", "both"] : ["practice", "both"];
    const questions = (qr.data || []).filter(
      (q) => allowed.includes(q.question_scope) && validOptions(q),
    );
    return {
      chapters: chapters || [],
      topics,
      clos: clos || [],
      questions,
    };
  }
  const loadPracticeSets = () => loadQuestionSets("practice");
  const loadSecureSets = () => loadQuestionSets("secure_exam");
  function topTabs(active = "online") {
    return `<div class="v109-tabs assessment-v122-tabs"><button type="button" class="${active === "online" ? "active" : ""}" data-v122-tab="online">Bài kiểm tra trực tuyến</button><button type="button" class="${active === "final" ? "active" : ""}" data-v122-tab="final">Đề thi cuối kỳ</button></div>`;
  }
  function finalStatusLabel(s) {
    return (
      {
        draft: "Bản nháp",
        reviewing: "Đang rà soát",
        generated: "Đã sinh đề",
        archived: "Đã lưu trữ",
      }[s] || "Bản nháp"
    );
  }
  function finalTable(items) {
    return `<div class="toolbar"><span class="hint">Đề cuối kỳ chỉ dùng Ngân hàng đề thi – bảo mật.</span><button id="v122CreateFinal" class="primary">+ Tạo đề thi cuối kỳ</button></div><div class="panel table-wrap"><table><thead><tr><th>Hồ sơ đề</th><th>Số mã đề</th><th>Nguồn câu</th><th>Cập nhật</th><th>Trạng thái</th><th></th></tr></thead><tbody>${items.map((x) => `<tr><td><b>${escapeHtml(x.title || x.metadata?.title || "Đề thi cuối kỳ")}</b><br><small>${escapeHtml(x.metadata?.exam_code || "")}</small></td><td><b>${Number(x.metadata?.variant_count || x.metadata?.variant_codes?.length || x.variants?.length || 0) || "—"}</b></td><td>Ngân hàng đề thi – bảo mật</td><td>${formatDateTime(x.updated_at || x.created_at)}</td><td><span class="badge ${x.status === "generated" ? "green" : ""}">${escapeHtml(finalStatusLabel(x.status))}</span></td><td><button type="button" class="secondary" data-v122-final="${x.id}">Chi tiết →</button></td></tr>`).join("") || '<tr><td colspan="6" class="empty">Chưa có hồ sơ đề thi cuối kỳ.</td></tr>'}</tbody></table></div>`;
  }
  /* SECTION 2/7 moved to js/assessment/online-lifecycle.js */
  const onlineLifecycleModule = window.AICLO_ASSESSMENT_MODULES?.createOnlineLifecycleModule?.({
    db,
    ask,
    notify,
    showError,
    getAssessmentRoot,
    exams,
    openExamBuilder: (...args) => openExamBuilder(...args),
    studentResultHtml: (...args) => studentResultHtml(...args),
    statusMeta,
    modeLabel,
    structureLabel,
    escapeHtml,
    formatDateTime,
    qs,
    qsa,
    shuffle,
    openDrawer: typeof openDrawer === "function" ? openDrawer : null,
    replaceDrawer: typeof replaceDrawer === "function" ? replaceDrawer : null,
  });
  if (!onlineLifecycleModule) throw new Error("Assessment Online Lifecycle module was not loaded");
  const { onlineTable, bindOnlineList, openExamDetail } = onlineLifecycleModule;

  async function teacherExamList(c) {
    const [items, finals] = await Promise.all([
      fetchExams(),
      fetchFinalPackages(),
    ]);
    const counts = await fetchAttemptCounts(items.map((x) => x.id));
    let active =
      sessionStorage.getItem(`aiclo:v122:assessment-tab:${subjectId()}`) ||
      "online";
    if (!["online", "final"].includes(active)) active = "online";
    const renderTab = (tab) => {
      active = tab;
      sessionStorage.setItem(`aiclo:v122:assessment-tab:${subjectId()}`, tab);
      c.innerHTML = `${topTabs(tab)}<div id="v122AssessmentBody">${tab === "online" ? onlineTable(items, counts) : finalTable(finals)}</div>`;
      qsa("[data-v122-tab]", c).forEach(
        (b) => (b.onclick = () => renderTab(b.dataset.v122Tab)),
      );
      if (tab === "online") bindOnlineList(c, items);
      else bindFinalList(c, finals);
    };
    renderTab(active);
  }
  function bindFinalList(root, items) {
    const add = qs("#v122CreateFinal", root);
    if (add) add.onclick = () => openFinalExamBuilder(null);
    qsa("[data-v122-final]", root).forEach(
      (b) =>
        (b.onclick = () => {
          const x = items.find((v) => v.id === b.dataset.v122Final);
          if (x) openFinalExamDetail(x);
        }),
    );
  }

  /* SECTION 3/7 moved to js/assessment/online-builder.js */
  const onlineBuilderModule = window.AICLO_ASSESSMENT_MODULES?.createOnlineBuilderModule?.({
    db, state, subjectId, loadPracticeSets, poolSnapshot, snapshotQuestion, validOptions,
    getAssessmentRoot, exams, openExamDetail, escapeHtml, localInput, toIsoOrNull,
    findById, shuffle, notify, showError, qs, qsa, ask,
    openDrawer: typeof openDrawer === "function" ? openDrawer : null,
    replaceDrawer: typeof replaceDrawer === "function" ? replaceDrawer : null,
    modal: typeof modal === "function" ? modal : null,
    closeModal: typeof closeModal === "function" ? closeModal : null,
  });
  if (!onlineBuilderModule) throw new Error("Assessment Online Builder module was not loaded");
  const { openExamBuilder } = onlineBuilderModule;

  /* ============================================================
   * SECTION 4/7 — Final exam builder, secure bank, variants, snapshots and export handoff
   * ============================================================ */
  const finalLocalKey = (packageId = "new") =>
    `aiclo:v122:final:${state.user?.id || "user"}:${subjectId() || "subject"}:${packageId}`;
  function readFinalLocal(packageId = "new") {
    try {
      return JSON.parse(
        localStorage.getItem(finalLocalKey(packageId)) || "null",
      );
    } catch {
      return null;
    }
  }
  function writeFinalLocal(ctx) {
    try {
      const key = ctx.packageId || "new";
      localStorage.setItem(
        finalLocalKey(key),
        JSON.stringify({
          ...serializeFinalCtx(ctx),
          package_id: ctx.packageId || null,
          updated_at: Date.now(),
          source: "v12.2",
        }),
      );
    } catch {}
  }
  function clearFinalLocal(packageId = "new") {
    try {
      localStorage.removeItem(finalLocalKey(packageId));
    } catch {}
  }
  function defaultVariantCodes(n) {
    n = Math.min(20, Math.max(1, +n || 1));
    return Array.from(
      {
        length: n,
      },
      (_, i) => String(101 + i),
    );
  }
  function finalMatrixKey(topicId, cloId) {
    return `${topicId}:${cloId}`;
  }
  function finalMatrixTotal(ctx) {
    return Object.values(ctx.matrix || {}).reduce((s, v) => s + (+v || 0), 0);
  }
  function finalSelectedTopics(ctx) {
    return ctx.sets.topics.filter((t) => ctx.selectedTopics.has(t.id));
  }
  function finalQuestionSnapshot(q, sets) {
    return poolSnapshot(q, sets);
  }
  function finalSnapshotToLive(s) {
    return {
      id: s.question_id || s.id,
      display_code: s.display_code || null,
      chapter_id: s.chapter_id,
      topic_id: s.topic_id,
      clo_id: s.clo_id,
      content: s.content || "",
      correct_answer: String(s.correct_answer || "").toUpperCase(),
      explanation: s.explanation || null,
      question_options: (s.options || s.question_options || []).map((o) => ({
        option_key: String(o.key || o.option_key || "").toUpperCase(),
        content: o.content || "",
      })),
    };
  }
  function defaultFinalCtx(pkg = null) {
    const meta = pkg?.metadata || {},
      codes =
        Array.isArray(meta.variant_codes) && meta.variant_codes.length
          ? meta.variant_codes.map(String)
          : Array.isArray(pkg?.variants) && pkg.variants.length
            ? pkg.variants.map((v) => String(v.code || "")).filter(Boolean)
            : defaultVariantCodes(meta.variant_count || 4);
    const selectedTopicIds = meta.selected_topic_ids || [];
    const selectedChapterIds = meta.selected_chapter_ids || [];
    let matrix = {};
    if (pkg?.matrix && Array.isArray(pkg.matrix)) {
      for (const r of pkg.matrix) {
        if (r?.topic_id && r?.clo_id)
          matrix[finalMatrixKey(r.topic_id, r.clo_id)] = +r.count || 0;
      }
    } else if (pkg?.matrix && typeof pkg.matrix === "object")
      matrix = {
        ...pkg.matrix,
      };
    return {
      packageId: pkg?.id || null,
      serverUpdatedAt: pkg?.updated_at || null,
      status: pkg?.status || "draft",
      title: pkg?.title || meta.title || "",
      metadata: {
        exam_code: meta.exam_code || "",
        semester: meta.semester || "",
        academic_year: meta.academic_year || "",
        exam_date: meta.exam_date || "",
        exam_session: meta.exam_session || "",
        duration_minutes: +meta.duration_minutes || 90,
        notes: meta.notes || "",
        prepared_by: meta.prepared_by || "",
        approved_by: meta.approved_by || "",
        variant_count: Math.min(
          20,
          Math.max(1, +meta.variant_count || codes.length || 4),
        ),
        variant_codes: codes.length ? codes : defaultVariantCodes(4),
      },
      selectedChapters: new Set(selectedChapterIds),
      selectedTopics: new Set(selectedTopicIds),
      matrix,
      selected: [],
      variants: Array.isArray(pkg?.variants) ? pkg.variants : [],
      sets: null,
      syncState: "server",
      dirty: false,
    };
  }
  function serializeFinalCtx(ctx) {
    return {
      title: ctx.title,
      metadata: {
        ...ctx.metadata,
        source_scope: "secure_exam",
        selected_chapter_ids: [...ctx.selectedChapters],
        selected_topic_ids: [...ctx.selectedTopics],
        variant_count: ctx.metadata.variant_codes.length,
        variant_codes: [...ctx.metadata.variant_codes],
      },
      matrix: Object.entries(ctx.matrix)
        .filter(([, count]) => (+count || 0) > 0)
        .map(([key, count]) => {
          const [topic_id, clo_id] = key.split(":");
          return {
            topic_id,
            clo_id,
            count: +count || 0,
          };
        }),
      selected_questions: ctx.selected.map((q) =>
        finalQuestionSnapshot(q, ctx.sets),
      ),
      variants: ctx.variants,
      status: ctx.status,
    };
  }
  function applyFinalLocal(ctx, local) {
    if (!local) return ctx;
    ctx.title = local.title ?? ctx.title;
    ctx.metadata = {
      ...ctx.metadata,
      ...(local.metadata || {}),
    };
    ctx.metadata.variant_codes =
      Array.isArray(ctx.metadata.variant_codes) &&
      ctx.metadata.variant_codes.length
        ? ctx.metadata.variant_codes.map(String)
        : defaultVariantCodes(ctx.metadata.variant_count || 4);
    ctx.metadata.variant_count = ctx.metadata.variant_codes.length;
    ctx.selectedChapters = new Set(local.metadata?.selected_chapter_ids || []);
    ctx.selectedTopics = new Set(local.metadata?.selected_topic_ids || []);
    ctx.matrix = {};
    for (const r of local.matrix || []) {
      if (r?.topic_id && r?.clo_id)
        ctx.matrix[finalMatrixKey(r.topic_id, r.clo_id)] = +r.count || 0;
    }
    ctx.variants = Array.isArray(local.variants) ? local.variants : [];
    ctx.status = local.status || ctx.status;
    ctx.syncState = "local";
    ctx.dirty = true;
    ctx._localSelected = Array.isArray(local.selected_questions)
      ? local.selected_questions
      : [];
    return ctx;
  }
  async function hydrateFinalSelected(ctx, pkg) {
    const raw = ctx._localSelected?.length
      ? ctx._localSelected
      : pkg?.selected_questions || [];
    if (!raw.length) {
      ctx.selected = [];
      return;
    }
    const liveMap = new Map(ctx.sets.questions.map((q) => [q.id, q]));
    ctx.selected = raw
      .map((x) => {
        if (typeof x === "string") return liveMap.get(x);
        if (x?.content) return finalSnapshotToLive(x);
        return liveMap.get(x?.question_id || x?.id);
      })
      .filter(Boolean);
  }
  async function openFinalExamBuilder(pkgOrNull) {
    try {
      let pkg = pkgOrNull;
      if (typeof pkgOrNull === "string") {
        const r = await db
          .from("final_exam_packages")
          .select("*")
          .eq("id", pkgOrNull)
          .single();
        if (r.error) throw r.error;
        pkg = r.data;
      }
      const sets = await loadSecureSets();
      if (!sets.chapters.length || !sets.clos.length)
        return notify("Học phần cần có Chương và CLO trước khi tạo đề.", true);
      if (!sets.questions.length)
        return notify(
          "Ngân hàng đề thi – bảo mật chưa có câu hỏi được duyệt.",
          true,
        );
      let ctx = defaultFinalCtx(pkg);
      ctx.sets = sets;
      if (pkg) {
        const local = readFinalLocal(pkg.id);
        const localMs = +local?.updated_at || 0,
          serverMs = new Date(pkg.updated_at || 0).getTime();
        if (local && local.package_id === pkg.id && localMs > serverMs)
          applyFinalLocal(ctx, local);
      } else {
        const local = readFinalLocal("new");
        if (
          local &&
          (await ask(
            "Khôi phục bản nháp chưa đồng bộ",
            "Có một bản nháp đề cuối kỳ trên thiết bị này chưa được lưu lên Supabase. Khôi phục bản đó?",
            "Khôi phục",
          ))
        )
          applyFinalLocal(ctx, local);
      }
      await hydrateFinalSelected(ctx, pkg);
      if (!ctx.selectedChapters.size && ctx.selected.length) {
        ctx.selected.forEach((q) => {
          ctx.selectedChapters.add(q.chapter_id);
          ctx.selectedTopics.add(q.topic_id);
        });
      }
      renderFinalBuilder(ctx);
    } catch (e) {
      showError(e);
    }
  }
  function finalEligible(ctx, topicId, cloId) {
    return ctx.sets.questions.filter(
      (q) => q.topic_id === topicId && q.clo_id === cloId,
    );
  }
  function validateFinalIdentity(ctx) {
    if (!ctx.title.trim()) throw new Error("Cần nhập tên hồ sơ đề thi");
    const codes = (ctx.metadata.variant_codes || [])
      .map((x) => String(x).trim())
      .filter(Boolean);
    if (codes.length < 1 || codes.length > 20)
      throw new Error("Số mã đề phải từ 1 đến 20");
    if (new Set(codes).size !== codes.length)
      throw new Error("Mã đề không được trùng");
    return codes;
  }
  function validateFinalCtx(ctx) {
    validateFinalIdentity(ctx);
    if (!ctx.selectedTopics.size) throw new Error("Cần chọn ít nhất một mục");
    const total = finalMatrixTotal(ctx);
    if (total < 1) throw new Error("Ma trận đề thi cần ít nhất một câu");
    for (const [key, n] of Object.entries(ctx.matrix)) {
      if ((+n || 0) <= 0) continue;
      const [topicId, cloId] = key.split(":"),
        have = finalEligible(ctx, topicId, cloId).length;
      if (have < +n) {
        const t = findById(ctx.sets.topics, topicId),
          c = findById(ctx.sets.clos, cloId);
        throw new Error(
          `${t?.name || "Mục"} · ${c?.code || "CLO"}: cần ${n}, ngân hàng bảo mật chỉ có ${have}`,
        );
      }
    }
    return total;
  }
  function drawFinalSelection(ctx) {
    validateFinalCtx(ctx);
    const used = new Set(),
      rows = [];
    for (const t of finalSelectedTopics(ctx)) {
      for (const c of ctx.sets.clos) {
        const need = +ctx.matrix[finalMatrixKey(t.id, c.id)] || 0;
        if (!need) continue;
        const cand = shuffle(
          finalEligible(ctx, t.id, c.id).filter((q) => !used.has(q.id)),
        );
        if (cand.length < need)
          throw new Error(`Không đủ câu ${c.code} ở ${t.name}`);
        for (const q of cand.slice(0, need)) {
          rows.push(q);
          used.add(q.id);
        }
      }
    }
    return rows;
  }
  function generateFinalVariants(ctx) {
    if (ctx.selected.length !== finalMatrixTotal(ctx))
      throw new Error("Cần rút đủ bộ câu trước khi sinh mã đề");
    const codes = ctx.metadata.variant_codes.map(String);
    return codes.map((code, i) => {
      const base = i === 0 ? [...ctx.selected] : shuffle(ctx.selected);
      return {
        code,
        questions: base.map((q, idx) => ({
          ...finalQuestionSnapshot(q, ctx.sets),
          order: idx + 1,
        })),
      };
    });
  }
  function finalQuestionCard(ctx, q, index) {
    const opts = optionMap(q),
      clo = findById(ctx.sets.clos, q.clo_id),
      ch = findById(ctx.sets.chapters, q.chapter_id),
      tp = findById(ctx.sets.topics, q.topic_id);
    return `<article class="ub-question-card v122-question-card"><div class="ub-question-head"><div><b>Câu ${index + 1}</b><span class="badge red">${escapeHtml(clo?.code || "—")}</span><span class="badge">${escapeHtml(ch?.name || "—")}</span><span class="badge">${escapeHtml(tp?.name || "—")}</span></div><button type="button" class="secondary compact" data-v122-final-replace="${index}">Đổi câu</button></div><div class="detail-question">${escapeHtml(q.content || "")}</div><div class="detail-options">${["A", "B", "C", "D"].map((k) => `<div class="${String(q.correct_answer || "").toUpperCase() === k ? "correct" : ""}"><b>${k}</b><span>${escapeHtml(opts[k] || "")}</span></div>`).join("")}</div></article>`;
  }
  function finalInfoHtml(ctx) {
    const m = ctx.metadata;
    return `<section class="panel"><div class="panel-head"><div><h3>1. Thông tin đề</h3><p class="hint">Nguồn câu được khóa ở Ngân hàng đề thi – bảo mật.</p></div><span id="v122FinalSync" class="badge ${ctx.syncState === "server" ? "green" : ctx.syncState === "local" ? "red" : ""}">${ctx.syncState === "server" ? "Đã đồng bộ" : ctx.syncState === "local" ? "Chưa đồng bộ" : "Đang chỉnh sửa"}</span></div><div class="form-grid"><label class="field wide">Tên hồ sơ đề<input data-final-field="title" value="${escapeHtml(ctx.title)}"></label><label class="field">Mã học phần<input data-final-meta="exam_code" value="${escapeHtml(m.exam_code)}"></label><label class="field">Học kỳ<input data-final-meta="semester" value="${escapeHtml(m.semester)}"></label><label class="field">Năm học<input data-final-meta="academic_year" value="${escapeHtml(m.academic_year)}"></label><label class="field">Ngày thi<input type="date" data-final-meta="exam_date" value="${escapeHtml(m.exam_date)}"></label><label class="field">Ca thi<input data-final-meta="exam_session" value="${escapeHtml(m.exam_session)}"></label><label class="field">Thời gian (phút)<input type="number" min="1" max="300" data-final-meta="duration_minutes" value="${+m.duration_minutes || 90}"></label><label class="field">Số mã đề<input id="v122FinalVariantCount" type="number" min="1" max="20" value="${m.variant_codes.length}"></label><label class="field wide">Danh sách mã đề<input id="v122FinalCodes" value="${escapeHtml(m.variant_codes.join(", "))}" placeholder="101, 102, 103, 104"></label><label class="field">Giảng viên ra đề<input data-final-meta="prepared_by" value="${escapeHtml(m.prepared_by)}"></label><label class="field">Trưởng bộ môn<input data-final-meta="approved_by" value="${escapeHtml(m.approved_by)}"></label><label class="field wide">Ghi chú<textarea data-final-meta="notes">${escapeHtml(m.notes)}</textarea></label></div></section>`;
  }
  function finalMatrixHtml(ctx) {
    const scope = ctx.sets.chapters
      .map((ch) => {
        const topics = ctx.sets.topics.filter((t) => t.chapter_id === ch.id);
        return `<div class="v122-scope-chapter"><label><input type="checkbox" data-final-chapter="${ch.id}" ${ctx.selectedChapters.has(ch.id) ? "checked" : ""}> <b>${escapeHtml(ch.order_index)}. ${escapeHtml(ch.name)}</b></label><div class="v122-topic-list">${topics.map((t) => `<label><input type="checkbox" data-final-topic="${t.id}" data-chapter="${ch.id}" ${ctx.selectedTopics.has(t.id) ? "checked" : ""}> ${escapeHtml(t.name)}</label>`).join("")}</div></div>`;
      })
      .join("");
    let rows = "";
    for (const ch of ctx.sets.chapters.filter((ch) =>
      ctx.selectedChapters.has(ch.id),
    )) {
      const topics = ctx.sets.topics.filter(
        (t) => t.chapter_id === ch.id && ctx.selectedTopics.has(t.id),
      );
      if (!topics.length) continue;
      rows += `<tr class="matrix-chapter"><td colspan="${ctx.sets.clos.length + 2}"><b>${escapeHtml(ch.order_index)}. ${escapeHtml(ch.name)}</b></td></tr>`;
      for (const t of topics) {
        rows += `<tr><td>${escapeHtml(t.name)}</td>${ctx.sets.clos
          .map((c) => {
            const key = finalMatrixKey(t.id, c.id),
              n = +ctx.matrix[key] || 0,
              have = finalEligible(ctx, t.id, c.id).length;
            return `<td><input class="v122-final-matrix-input" type="number" min="0" max="200" value="${n}" data-key="${key}"><small>${have} có sẵn</small></td>`;
          })
          .join(
            "",
          )}<td><b>${ctx.sets.clos.reduce((s, c) => s + (+ctx.matrix[finalMatrixKey(t.id, c.id)] || 0), 0)}</b></td></tr>`;
      }
    }
    return `<section class="panel"><div class="panel-head"><div><h3>2. Ma trận Chương/Mục × CLO</h3><p class="hint">Mọi ô khả dụng được tính chỉ từ ngân hàng bảo mật.</p></div></div><div class="v122-scope">${scope}</div>${
      ctx.selectedTopics.size
        ? `<div class="table-wrap"><table class="exam-matrix"><thead><tr><th>Mục</th>${ctx.sets.clos.map((c) => `<th>${escapeHtml(c.code)}</th>`).join("")}<th>Tổng</th></tr></thead><tbody>${rows}<tr class="matrix-grand"><td><b>TỔNG</b></td>${ctx.sets.clos
            .map(
              (c) =>
                `<td><b>${Object.entries(ctx.matrix)
                  .filter(([k]) => k.endsWith(`:${c.id}`))
                  .reduce((s, [, v]) => s + (+v || 0), 0)}</b></td>`,
            )
            .join(
              "",
            )}<td><b>${finalMatrixTotal(ctx)}</b></td></tr></tbody></table></div>`
        : '<div class="empty"><b>Chưa chọn mục</b><span>Chọn Chương/Mục để tạo ma trận đề thi.</span></div>'
    }</section>`;
  }
  function finalQuestionsHtml(ctx) {
    return `<section class="panel"><div class="panel-head"><div><h3>3. Bộ câu đề thi</h3><p class="hint">Rút từ ngân hàng bảo mật; không dùng câu luyện tập.</p></div><button id="v122FinalDraw" class="secondary">Rút câu theo ma trận</button></div>${
      ctx.selected.length
        ? `<div class="v122-selected-summary"><b>${ctx.selected.length}/${finalMatrixTotal(ctx)} câu</b> · ${Object.entries(
            cloCountsFromQuestions(ctx.selected, ctx.sets),
          )
            .map(([k, v]) => `${escapeHtml(k)}: ${v}`)
            .join(
              " · ",
            )}</div><div class="v122-selected-list">${ctx.selected.map((q, i) => finalQuestionCard(ctx, q, i)).join("")}</div>`
        : '<div class="empty"><b>Chưa có bộ câu</b><span>Hoàn tất ma trận rồi nhấn “Rút câu theo ma trận”.</span></div>'
    }</section>`;
  }
  function finalVariantsHtml(ctx) {
    return `<section class="panel"><div class="panel-head"><div><h3>4. Mã đề</h3><p class="hint">Số mã đề được giữ xuyên suốt từ thiết lập đến hồ sơ server.</p></div></div>${ctx.variants.length ? `<div class="detail-grid">${ctx.variants.map((v) => `<div><small>Mã đề</small><b>${escapeHtml(v.code)}</b><span>${v.questions?.length || 0} câu</span></div>`).join("")}</div>` : `<div class="empty"><b>Chưa sinh mã đề</b><span>Nhấn “Sinh mã đề & lưu” sau khi bộ câu đã đủ.</span></div>`}</section>`;
  }
  function renderFinalBuilder(ctx) {
    const c = getAssessmentRoot();
    if (!c) return;
    c.innerHTML = `<div class="assessment-final-builder-v122"><div class="subpage-head"><div><button id="v122FinalBack" class="secondary compact">← Quay lại</button><small>${ctx.packageId ? "CHỈNH SỬA" : "TẠO"} ĐỀ THI CUỐI KỲ</small><h3>${escapeHtml(ctx.title || "Đề thi cuối kỳ mới")}</h3><p>Ngân hàng đề thi – bảo mật · ${ctx.metadata.variant_codes.length} mã đề</p></div><span class="badge ${ctx.status === "generated" ? "green" : ""}">${escapeHtml(finalStatusLabel(ctx.status))}</span></div>${finalInfoHtml(ctx)}${finalMatrixHtml(ctx)}${finalQuestionsHtml(ctx)}${finalVariantsHtml(ctx)}<div class="form-actions assessment-builder-footer"><button id="v122FinalCancel" class="secondary">Hủy</button><button id="v122FinalSaveDraft" class="secondary">Lưu bản nháp</button><button id="v122FinalGenerate" class="primary">Sinh mã đề & lưu</button></div></div>`;
    bindFinalBuilder(ctx);
  }
  function markFinalDirty(ctx) {
    ctx.dirty = true;
    ctx.syncState = "dirty";
    writeFinalLocal(ctx);
    const badge = qs("#v122FinalSync");
    if (badge) {
      badge.textContent = "Chưa đồng bộ";
      badge.classList.remove("green");
      badge.classList.add("red");
    }
  }
  function cleanFinalMatrix(ctx) {
    for (const key of Object.keys(ctx.matrix)) {
      const [topicId] = key.split(":");
      if (!ctx.selectedTopics.has(topicId)) delete ctx.matrix[key];
    }
  }
  function bindFinalBuilder(ctx) {
    const c = getAssessmentRoot();
    qs("#v122FinalBack", c).onclick = () =>
      ctx.packageId ? openFinalExamDetail(ctx.packageId) : exams(c);
    qs("#v122FinalCancel", c).onclick = () =>
      ctx.packageId ? openFinalExamDetail(ctx.packageId) : exams(c);
    qsa("[data-final-field]", c).forEach(
      (el) =>
        (el.oninput = () => {
          ctx[el.dataset.finalField] = el.value;
          markFinalDirty(ctx);
        }),
    );
    qsa("[data-final-meta]", c).forEach(
      (el) =>
        (el.oninput = () => {
          ctx.metadata[el.dataset.finalMeta] =
            el.type === "number" ? +el.value : el.value;
          markFinalDirty(ctx);
        }),
    );
    const count = qs("#v122FinalVariantCount", c),
      codes = qs("#v122FinalCodes", c);
    count.onchange = () => {
      const n = Math.min(20, Math.max(1, +count.value || 1));
      ctx.metadata.variant_codes = defaultVariantCodes(n);
      ctx.metadata.variant_count = n;
      ctx.variants = [];
      markFinalDirty(ctx);
      renderFinalBuilder(ctx);
    };
    codes.onchange = () => {
      const arr = codes.value
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean);
      ctx.metadata.variant_codes = arr;
      ctx.metadata.variant_count = arr.length;
      ctx.variants = [];
      markFinalDirty(ctx);
      renderFinalBuilder(ctx);
    };
    qsa("[data-final-chapter]", c).forEach(
      (el) =>
        (el.onchange = () => {
          const id = el.dataset.finalChapter,
            topics = ctx.sets.topics.filter((t) => t.chapter_id === id);
          if (el.checked) {
            ctx.selectedChapters.add(id);
            topics.forEach((t) => ctx.selectedTopics.add(t.id));
          } else {
            ctx.selectedChapters.delete(id);
            topics.forEach((t) => ctx.selectedTopics.delete(t.id));
          }
          ctx.selected = [];
          ctx.variants = [];
          cleanFinalMatrix(ctx);
          markFinalDirty(ctx);
          renderFinalBuilder(ctx);
        }),
    );
    qsa("[data-final-topic]", c).forEach(
      (el) =>
        (el.onchange = () => {
          const id = el.dataset.finalTopic,
            ch = el.dataset.chapter;
          if (el.checked) ctx.selectedTopics.add(id);
          else ctx.selectedTopics.delete(id);
          const any = ctx.sets.topics.some(
            (t) => t.chapter_id === ch && ctx.selectedTopics.has(t.id),
          );
          if (any) ctx.selectedChapters.add(ch);
          else ctx.selectedChapters.delete(ch);
          ctx.selected = [];
          ctx.variants = [];
          cleanFinalMatrix(ctx);
          markFinalDirty(ctx);
          renderFinalBuilder(ctx);
        }),
    );
    qsa(".v122-final-matrix-input", c).forEach(
      (el) =>
        (el.onchange = () => {
          ctx.matrix[el.dataset.key] = Math.max(0, +el.value || 0);
          ctx.selected = [];
          ctx.variants = [];
          markFinalDirty(ctx);
          renderFinalBuilder(ctx);
        }),
    );
    qs("#v122FinalDraw", c).onclick = () => {
      try {
        ctx.selected = drawFinalSelection(ctx);
        ctx.variants = [];
        markFinalDirty(ctx);
        renderFinalBuilder(ctx);
        notify(`Đã rút ${ctx.selected.length} câu từ ngân hàng bảo mật`);
      } catch (e) {
        showError(e);
      }
    };
    qsa("[data-v122-final-replace]", c).forEach(
      (el) =>
        (el.onclick = () =>
          replaceFinalQuestion(ctx, +el.dataset.v122FinalReplace)),
    );
    qs("#v122FinalSaveDraft", c).onclick = () => saveFinalPackage(ctx, false);
    qs("#v122FinalGenerate", c).onclick = () => saveFinalPackage(ctx, true);
  }
  function replaceFinalQuestion(ctx, index) {
    const old = ctx.selected[index],
      used = new Set(ctx.selected.map((q) => q.id));
    used.delete(old?.id);
    const pool = ctx.sets.questions.filter(
      (q) =>
        q.id !== old?.id &&
        !used.has(q.id) &&
        q.topic_id === old?.topic_id &&
        q.clo_id === old?.clo_id,
    );
    if (!pool.length)
      return notify(
        "Không còn câu bảo mật khác phù hợp với đúng ô ma trận này.",
        true,
      );
    ctx.selected[index] = shuffle(pool)[0];
    ctx.variants = [];
    markFinalDirty(ctx);
    renderFinalBuilder(ctx);
    notify(`Đã đổi Câu ${index + 1}; chưa đồng bộ lên Supabase.`);
  }
  async function saveFinalPackage(ctx, generate) {
    const btn = generate ? qs("#v122FinalGenerate") : qs("#v122FinalSaveDraft"),
      old = btn?.textContent;
    try {
      let total = finalMatrixTotal(ctx);
      if (generate) {
        total = validateFinalCtx(ctx);
        if (ctx.selected.length !== total)
          throw new Error(
            "Cần rút đủ bộ câu theo ma trận trước khi sinh mã đề",
          );
        ctx.variants = generateFinalVariants(ctx);
      } else validateFinalIdentity(ctx);
      ctx.status = generate
        ? "generated"
        : ctx.packageId && ctx.status === "generated"
          ? "reviewing"
          : "draft";
      ctx.metadata.variant_count = ctx.metadata.variant_codes.length;
      const payload = serializeFinalCtx(ctx);
      if (btn) {
        btn.disabled = true;
        btn.textContent = "Đang đồng bộ…";
      }
      const { data, error } = await db.rpc("save_final_exam_package", {
        p_package_id: ctx.packageId,
        p_subject_id: subjectId(),
        p_title: ctx.title.trim(),
        p_metadata: payload.metadata,
        p_matrix: payload.matrix,
        p_selected_questions: payload.selected_questions,
        p_variants: payload.variants,
        p_status: payload.status,
      });
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      if (!row?.id)
        throw new Error("Supabase chưa trả lại hồ sơ đề thi đã lưu");
      const oldId = ctx.packageId;
      ctx.packageId = row.id;
      ctx.serverUpdatedAt = row.updated_at;
      ctx.status = row.status;
      ctx.syncState = "server";
      ctx.dirty = false;
      if (oldId && oldId !== ctx.packageId) clearFinalLocal(oldId);
      clearFinalLocal("new");
      clearFinalLocal(ctx.packageId);
      notify(generate ? "Đã sinh và lưu các mã đề" : "Đã lưu bản nháp đề thi");
      await openFinalExamDetail(row);
    } catch (e) {
      ctx.syncState = "local";
      writeFinalLocal(ctx);
      showError(e);
      notify(
        "Chưa đồng bộ lên Supabase; bản nháp đã được giữ trên thiết bị.",
        true,
      );
      if (btn) {
        btn.disabled = false;
        btn.textContent = old;
      }
    }
  }
  function canonicalFinalMatrixRows(matrix) {
    if (Array.isArray(matrix)) return matrix;
    if (matrix && typeof matrix === "object")
      return Object.entries(matrix).map(([key, count]) => {
        const [topic_id, clo_id] = key.split(":");
        return {
          topic_id,
          clo_id,
          count: +count || 0,
        };
      });
    return [];
  }
  function finalMatrixSummary(pkg) {
    const rows = canonicalFinalMatrixRows(pkg.matrix);
    const total = rows.reduce((s, r) => s + (+r.count || 0), 0),
      byClo = {};
    for (const r of rows) {
      byClo[r.clo_id] = (byClo[r.clo_id] || 0) + (+r.count || 0);
    }
    return {
      total,
      byClo,
    };
  }
  async function ensureFinalExports() {
    if (window.AICLO_FINAL_EXPORTS) return window.AICLO_FINAL_EXPORTS;
    if (window.AICLO_FEATURES?.load)
      await window.AICLO_FEATURES.load("js/exams/final-export.js?v=12.2.1");
    else
      await new Promise((resolve, reject) => {
        const old = document.querySelector("script[data-aiclo-final-export]");
        if (old) {
          old.addEventListener("load", resolve, {
            once: true,
          });
          old.addEventListener("error", reject, {
            once: true,
          });
          return;
        }
        const s = document.createElement("script");
        s.src = "js/exams/final-export.js?v=12.2.1";
        s.async = false;
        s.dataset.aicloFinalExport = "1";
        s.onload = resolve;
        s.onerror = () =>
          reject(new Error("Không tải được tiện ích xuất đề thi"));
        document.head.appendChild(s);
      });
    if (!window.AICLO_FINAL_EXPORTS)
      throw new Error("Không khởi tạo được tiện ích xuất đề thi");
    return window.AICLO_FINAL_EXPORTS;
  }
  function finalSubjectLabel() {
    const el = qs("#subjectSelect");
    const text = el?.selectedOptions?.[0]?.textContent || "";
    return String(text).trim() || "Học phần";
  }
  function validateStoredFinalPackage(pkg) {
    const meta = pkg?.metadata || {},
      codes = (meta.variant_codes || [])
        .map((x) => String(x).trim())
        .filter(Boolean),
      variants = Array.isArray(pkg?.variants) ? pkg.variants : [],
      selected = Array.isArray(pkg?.selected_questions)
        ? pkg.selected_questions
        : [];
    if (pkg?.status !== "generated")
      throw new Error("Chỉ hồ sơ đã sinh mã đề mới được xuất");
    if (!selected.length) throw new Error("Hồ sơ chưa có snapshot bộ câu");
    if (!codes.length || codes.length > 20)
      throw new Error("Danh sách mã đề không hợp lệ");
    if (new Set(codes).size !== codes.length)
      throw new Error("Danh sách mã đề có mã trùng");
    const selectedIds = selected
      .map((q) => String(q?.question_id || q?.id || ""))
      .filter(Boolean);
    if (
      selectedIds.length !== selected.length ||
      new Set(selectedIds).size !== selected.length
    )
      throw new Error("Snapshot bộ câu có mã câu thiếu hoặc trùng");
    if (variants.length !== codes.length)
      throw new Error(
        `Số phiên bản đã lưu (${variants.length}) không khớp số mã đề (${codes.length})`,
      );
    const selectedSet = new Set(selectedIds);
    for (let i = 0; i < variants.length; i++) {
      const v = variants[i],
        code = String(v?.code || "");
      if (code !== codes[i])
        throw new Error(
          `Mã đề thứ ${i + 1} không khớp hồ sơ (${code || "trống"} ≠ ${codes[i]})`,
        );
      if (!Array.isArray(v.questions) || v.questions.length !== selected.length)
        throw new Error(`Mã đề ${code} không đủ ${selected.length} câu`);
      const ids = v.questions
        .map((q) => String(q?.question_id || q?.id || ""))
        .filter(Boolean);
      if (
        ids.length !== selected.length ||
        new Set(ids).size !== selected.length ||
        ids.some((id) => !selectedSet.has(id))
      )
        throw new Error(
          `Mã đề ${code} không còn là một hoán vị của snapshot bộ câu`,
        );
      for (const q of v.questions) {
        if (
          !["A", "B", "C", "D"].includes(
            String(q?.correct_answer || "").toUpperCase(),
          )
        )
          throw new Error(`Mã đề ${code} có đáp án đúng không hợp lệ`);
        const keys = Array.isArray(q?.options)
          ? q.options.map((o) =>
              String(o?.key || o?.option_key || "").toUpperCase(),
            )
          : Object.keys(q?.options || {}).map((k) => String(k).toUpperCase());
        if (
          keys.length !== 4 ||
          new Set(keys).size !== 4 ||
          !["A", "B", "C", "D"].every((k) => keys.includes(k))
        )
          throw new Error(`Mã đề ${code} có phương án A–D không hợp lệ`);
      }
    }
    return {
      codes,
      variants,
      selected,
    };
  }
  async function buildFinalExportContext(pkg) {
    const checked = validateStoredFinalPackage(pkg),
      sets = await loadSecureSets();
    return {
      packageId: pkg.id,
      title: pkg.title || "Đề thi cuối kỳ",
      subject: {
        id: subjectId(),
        name: finalSubjectLabel(),
      },
      metadata: {
        ...(pkg.metadata || {}),
      },
      sets: {
        chapters: sets.chapters,
        topics: sets.topics,
        clos: sets.clos,
      },
      selected: checked.selected,
      variants: checked.variants,
    };
  }
  async function openFinalExportMenu(pkg) {
    try {
      const ctx = await buildFinalExportContext(pkg),
        api = await ensureFinalExports(),
        codes = ctx.variants.map((v) => String(v.code));
      if (typeof modal !== "function")
        throw new Error("Không mở được cửa sổ xuất hồ sơ");
      modal(
        `Xuất hồ sơ · ${pkg.title || "Đề thi cuối kỳ"}`,
        `<div class="final-export-v122"><p class="hint">Nguồn xuất: snapshot đã lưu trên Supabase · ${ctx.selected.length} câu · ${codes.length} mã đề.</p><div class="form-grid"><label class="field wide">Mã đề để xuất riêng<select id="v122ExportCode">${codes.map((c) => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join("")}</select></label></div><div class="form-actions wrap"><button type="button" id="v122ExportBM06" class="secondary">BM06 · Ma trận DOCX</button><button type="button" id="v122ExportBM07" class="secondary">BM07 · Đề DOCX</button><button type="button" id="v122ExportBM08" class="secondary">BM08 · Đáp án DOCX</button><button type="button" id="v122ExportTeX" class="secondary">TeX</button><button type="button" id="v122ExportAnswers" class="secondary">Đáp án Excel</button><button type="button" id="v122ExportZip" class="primary">ZIP toàn bộ</button></div><p class="hint">ZIP gồm BM06, BM07/BM08 cho mọi mã đề, TeX và file đáp án CLO.</p></div>`,
      );
      const selectedVariant = () =>
        ctx.variants.find(
          (v) => String(v.code) === qs("#v122ExportCode")?.value,
        ) || ctx.variants[0];
      const run = async (btn, fn) => {
        const old = btn.textContent;
        btn.disabled = true;
        btn.textContent = "Đang xuất…";
        try {
          await fn();
          notify("Đã tạo file xuất");
        } catch (e) {
          showError(e);
        } finally {
          btn.disabled = false;
          btn.textContent = old;
        }
      };
      qs("#v122ExportBM06").onclick = (e) =>
        run(e.currentTarget, () => api.bm06(ctx));
      qs("#v122ExportBM07").onclick = (e) =>
        run(e.currentTarget, () => api.bm07(ctx, selectedVariant()));
      qs("#v122ExportBM08").onclick = (e) =>
        run(e.currentTarget, () => api.bm08(ctx, selectedVariant()));
      qs("#v122ExportTeX").onclick = (e) =>
        run(e.currentTarget, () => api.tex(ctx, selectedVariant()));
      qs("#v122ExportAnswers").onclick = (e) =>
        run(e.currentTarget, () => api.answers(ctx));
      qs("#v122ExportZip").onclick = (e) =>
        run(e.currentTarget, () => api.zip(ctx));
    } catch (e) {
      showError(e);
    }
  }
  async function openFinalExamDetail(pkgOrId) {
    try {
      let pkg = pkgOrId;
      if (typeof pkgOrId === "string") {
        const r = await db
          .from("final_exam_packages")
          .select("*")
          .eq("id", pkgOrId)
          .single();
        if (r.error) throw r.error;
        pkg = r.data;
      }
      const c = getAssessmentRoot();
      if (!c) return;
      const sets = await loadSecureSets(),
        meta = pkg.metadata || {},
        codes = meta.variant_codes || pkg.variants?.map((v) => v.code) || [],
        selected = Array.isArray(pkg.selected_questions)
          ? pkg.selected_questions
          : [],
        matrixRows = canonicalFinalMatrixRows(pkg.matrix),
        summary = finalMatrixSummary(pkg);
      c.innerHTML = `<div class="assessment-final-detail-v122"><div class="subpage-head"><div><button id="v122FinalDetailBack" class="secondary compact">← Quay lại</button><small>ĐỀ THI CUỐI KỲ</small><h3>${escapeHtml(pkg.title || "Đề thi cuối kỳ")}</h3><p>Ngân hàng đề thi – bảo mật</p></div><span class="badge ${pkg.status === "generated" ? "green" : ""}">${escapeHtml(finalStatusLabel(pkg.status))}</span></div><section class="panel"><div class="panel-head"><div><h3>Thông tin hồ sơ</h3><p class="hint">Server package ID: ${escapeHtml(pkg.id)}</p></div><div class="row-actions"><button id="v122FinalEdit" class="secondary">Chỉnh sửa</button><button id="v122FinalExport" class="primary" ${pkg.status === "generated" ? "" : "disabled"}>Xuất hồ sơ</button></div></div><div class="detail-grid"><div><small>Mã học phần</small><b>${escapeHtml(meta.exam_code || "—")}</b></div><div><small>Học kỳ</small><b>${escapeHtml(meta.semester || "—")}</b></div><div><small>Năm học</small><b>${escapeHtml(meta.academic_year || "—")}</b></div><div><small>Ngày thi</small><b>${escapeHtml(meta.exam_date || "—")}</b></div><div><small>Ca thi</small><b>${escapeHtml(meta.exam_session || "—")}</b></div><div><small>Thời gian</small><b>${+meta.duration_minutes || "—"} phút</b></div><div><small>Số câu</small><b>${summary.total || selected.length}</b></div><div><small>Số mã đề</small><b>${codes.length || 0}</b></div></div><p class="hint">Mã đề: ${codes.map(escapeHtml).join(" · ") || "—"}</p></section><section class="panel"><div class="panel-head"><div><h3>Ma trận</h3><p class="hint">${matrixRows.length} ô có số câu.</p></div></div><div class="table-wrap"><table><thead><tr><th>Mục</th><th>CLO</th><th>Số câu</th></tr></thead><tbody>${matrixRows.map((r) => `<tr><td>${escapeHtml(findById(sets.topics, r.topic_id)?.name || r.topic_id || "")}</td><td>${escapeHtml(findById(sets.clos, r.clo_id)?.code || r.clo_id || "")}</td><td><b>${+r.count || 0}</b></td></tr>`).join("") || '<tr><td colspan="3" class="empty">Chưa có ma trận.</td></tr>'}</tbody></table></div></section><section class="panel"><div class="panel-head"><div><h3>Bộ câu</h3><p class="hint">Snapshot đề thi được lưu cùng hồ sơ.</p></div></div><div class="v122-selected-list">${
        selected
          .map((s, i) => {
            const q = finalSnapshotToLive(s),
              opts = optionMap(q);
            return `<article class="ub-question-card"><div class="ub-question-head"><b>Câu ${i + 1}</b><span class="badge red">${escapeHtml(s.clo_code || "")}</span></div><div class="detail-question">${escapeHtml(q.content)}</div><div class="detail-options">${["A", "B", "C", "D"].map((k) => `<div class="${q.correct_answer === k ? "correct" : ""}"><b>${k}</b><span>${escapeHtml(opts[k] || "")}</span></div>`).join("")}</div></article>`;
          })
          .join("") || '<div class="empty">Chưa có bộ câu.</div>'
      }</div></section><section class="panel"><div class="panel-head"><div><h3>Các mã đề</h3><p class="hint">${pkg.variants?.length || 0} phiên bản đã lưu.</p></div></div><div class="detail-grid">${(pkg.variants || []).map((v) => `<div><small>Mã đề</small><b>${escapeHtml(v.code || "")}</b><span>${v.questions?.length || 0} câu</span></div>`).join("") || "<div><span>Chưa sinh mã đề.</span></div>"}</div></section></div>`;
      qs("#v122FinalDetailBack").onclick = () => exams(c);
      qs("#v122FinalEdit").onclick = () => openFinalExamBuilder(pkg);
      qs("#v122FinalExport").onclick = () => openFinalExportMenu(pkg);
    } catch (e) {
      showError(e);
    }
  }

  /* SECTION 5/7 moved to js/assessment/student-attempt.js */
  const studentAttemptModule = window.AICLO_ASSESSMENT_MODULES?.createStudentAttemptModule?.({
    db,
    state,
    fetchExams,
    statusMeta,
    escapeHtml,
    qs,
    qsa,
    ask,
    showError,
    notify,
    openDrawer: typeof openDrawer === "function" ? openDrawer : null,
    replaceDrawer: typeof replaceDrawer === "function" ? replaceDrawer : null,
  });
  if (!studentAttemptModule) throw new Error("Assessment Student Attempt module was not loaded");
  const { studentExamList, openStudentAttemptResult, clearLiveTimer, studentResultHtml } = studentAttemptModule;

  /* SECTION 6/7 moved to js/assessment/results.js */
  const resultsModule = window.AICLO_ASSESSMENT_MODULES?.createResultsModule?.({
    db,
    state,
    subjectId,
    escapeHtml,
    qs,
    qsa,
    openDrawer: typeof openDrawer === "function" ? openDrawer : null,
    modal: typeof modal === "function" ? modal : null,
    showError,
  });
  if (!resultsModule)
    throw new Error("Assessment Results module was not loaded");
  const {
    loadOfficialResultBundle,
    buildOfficialMetrics,
    renderTeacherResults,
    renderStudentResults,
  } = resultsModule;

  /* ============================================================
   * SECTION 7/7 — Public Assessment entry points and single runtime ownership
   * ============================================================ */
  async function exams(c) {
    c = setAssessmentRoot(c);
    if (!subjectId()) {
      c?.replaceChildren?.(
        typeof empty === "function"
          ? empty()
          : document.createTextNode("Chưa chọn học phần"),
      );
      return;
    }
    if (!(await schemaReady())) return migrationNotice(c);
    return isTeacher() ? teacherExamList(c) : studentExamList(c);
  }
  async function results(c) {
    c = setAssessmentRoot(c);
    try {
      if (!subjectId()) {
        c.innerHTML = '<div class="panel empty">Chưa chọn học phần.</div>';
        return;
      }
      if (!(await schemaReady())) return migrationNotice(c);
      const bundle = await loadOfficialResultBundle(),
        metrics = buildOfficialMetrics(bundle);
      if (isTeacher()) await renderTeacherResults(c, bundle, metrics);
      else renderStudentResults(c, bundle, metrics);
    } catch (e) {
      showError(e);
    }
  }
  async function teacherClassList(c) {
    return results(c);
  }
  document.addEventListener("click", (e) => {
    if (e.target?.closest?.("#drawerClose")) clearLiveTimer();
  });
  window.exams = exams;
  window.results = results;
  window.AICLO_ASSESSMENT = Object.freeze({
    exams,
    results,
    teacherClassList,
    openStudentAttemptResult,
    openExamDetail,
    openFinalExamDetail,
    version: VERSION,
  });
})();
