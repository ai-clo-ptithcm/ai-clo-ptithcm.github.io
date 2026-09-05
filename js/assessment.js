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
  const VERSION = "12.3.1";
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
      return String(data || "") === "12.3.1";
    } catch {
      return false;
    }
  }
  function migrationNotice(c) {
    c.innerHTML = `<div class="panel migration-panel"><h3>Cần hoàn tất Assessment V12.3.1 trên Supabase</h3><p>Phiên bản này tách quyền xem lại bài và quyền hiện đáp án đúng.</p><ol><li>Mở <b>Supabase → SQL Editor</b>.</li><li>Chạy <code>docs/assessment-v12.3.1-review-ai.sql</code>.</li><li>Tải lại trang.</li></ol></div>`;
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

  /* SECTION 4/7 moved to js/assessment/final-exam.js */
  const finalExamModule = window.AICLO_ASSESSMENT_MODULES?.createFinalExamModule?.({
    db, state, subjectId, loadSecureSets, poolSnapshot, getAssessmentRoot, exams, ask,
    notify, showError, escapeHtml, formatDateTime, findById, shuffle, qs, qsa,
    modal: typeof modal === "function" ? modal : null,
  });
  if (!finalExamModule) throw new Error("Assessment Final Exam module was not loaded");
  const { finalTable, bindFinalList, openFinalExamBuilder, openFinalExamDetail } = finalExamModule;

  /* SECTION 5/7 moved to js/assessment/student-attempt.js */
  const studentAttemptModule = window.AICLO_ASSESSMENT_MODULES?.createStudentAttemptModule?.({
    db,
    state,
    subjectId,
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
