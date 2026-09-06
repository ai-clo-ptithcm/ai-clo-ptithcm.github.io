/* AI-CLO PTITHCM V12.4.3 — Assessment single-owner engine.
   Assessment workspaces register with the shared subpage persistence layer; child modules remain single-owner. */
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
  const VERSION = "12.4.3";
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
  async function fetchExamById(id) {
    if (!id) return null;
    const { data, error } = await db
      .from("exams")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    return data || null;
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
    openExamBuilder: (...args) => openExamBuilderTracked(...args),
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
    getAssessmentRoot, exams, openExamDetail: (...args) => openExamDetailTracked(...args), escapeHtml, localInput, toIsoOrNull,
    findById, shuffle, notify, showError, qs, qsa, ask,
    openDrawer: typeof openDrawer === "function" ? openDrawer : null,
    replaceDrawer: typeof replaceDrawer === "function" ? replaceDrawer : null,
    modal: typeof modal === "function" ? modal : null,
    closeModal: typeof closeModal === "function" ? closeModal : null,
  });
  if (!onlineBuilderModule) throw new Error("Assessment Online Builder module was not loaded");
  const { openExamBuilder } = onlineBuilderModule;

  async function openExamDetailTracked(examOrId) {
    const id = typeof examOrId === "string" ? examOrId : examOrId?.id || "";
    const result = await openExamDetail(examOrId);
    const page = document.querySelector(".assessment-detail-v122");
    if (page && id) {
      page.dataset.assessmentExamId = String(id);
      window.AICLO_SUBPAGE_STATE?.remember?.("assessment-detail", {
        entityType: "exam",
        entityId: String(id),
      });
    }
    return result;
  }
  async function openExamBuilderTracked(exam) {
    const result = await openExamBuilder(exam || null);
    const page = document.querySelector(".assessment-builder-v122");
    if (page) {
      const id = exam?.id || "";
      page.dataset.assessmentExamId = String(id);
      page.dataset.assessmentMode = id ? "edit" : "create";
      window.AICLO_SUBPAGE_STATE?.remember?.("assessment-builder", {
        entityType: "exam",
        entityId: id || null,
        mode: id ? "edit" : "create",
      });
    }
    return result;
  }

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

  function waitForAssessment(fn, timeout = 3400) {
    return new Promise((resolve) => {
      const started = Date.now();
      const tick = () => {
        let value = null;
        try {
          value = fn();
        } catch {}
        if (value) return resolve(value);
        if (Date.now() - started >= timeout) return resolve(null);
        setTimeout(tick, 60);
      };
      tick();
    });
  }
  function activeEntity(selector, id, kind, datasetKey = "assessmentExamId") {
    const page = document.querySelector(selector);
    if (!page) return false;
    const marked = String(page.dataset?.[datasetKey] || "");
    if (marked) return marked === String(id || "");
    const current = window.AICLO_SUBPAGE_STATE?.current?.();
    return current?.kind === kind && String(current.entityId || "") === String(id || "");
  }
  function installAssessmentPersistence() {
    const persistence = window.AICLO_SUBPAGE_STATE;
    if (!persistence?.register || installAssessmentPersistence.done) return;
    installAssessmentPersistence.done = true;

    persistence.register("assessment-detail", {
      detect() {
        const page = document.querySelector(".assessment-detail-v122");
        if (!page) return null;
        const current = persistence.current?.();
        const id = page.dataset.assessmentExamId ||
          (current?.kind === "assessment-detail" ? current.entityId || "" : "");
        return id ? { entityType: "exam", entityId: id } : null;
      },
      isActive: (x) => activeEntity(".assessment-detail-v122", x.entityId, "assessment-detail"),
      async restore(x) {
        const exam = await fetchExamById(x.entityId);
        if (!exam) {
          persistence.clear();
          return false;
        }
        await openExamDetailTracked(exam);
        return activeEntity(".assessment-detail-v122", x.entityId, "assessment-detail");
      },
    });

    persistence.register("assessment-builder", {
      detect() {
        const page = document.querySelector(".assessment-builder-v122");
        if (!page) return null;
        const current = persistence.current?.();
        const fallbackId = current?.kind === "assessment-builder" ? current.entityId || "" : "";
        const id = page.dataset.assessmentExamId || fallbackId;
        return {
          entityType: "exam",
          entityId: id || null,
          mode: page.dataset.assessmentMode ||
            (current?.kind === "assessment-builder" ? current.mode : null) ||
            (id ? "edit" : "create"),
        };
      },
      isActive(x) {
        return activeEntity(".assessment-builder-v122", x.entityId, "assessment-builder");
      },
      async restore(x) {
        const exam = x.entityId ? await fetchExamById(x.entityId) : null;
        if (x.entityId && !exam) {
          persistence.clear();
          return false;
        }
        await openExamBuilderTracked(exam);
        return activeEntity(".assessment-builder-v122", x.entityId, "assessment-builder");
      },
    });

    persistence.register("assessment-attempt", {
      detect() {
        const page = document.querySelector(".student-attempt-page[data-attempt-id]");
        const id = page?.dataset.attemptId || "";
        return id ? { entityType: "attempt", entityId: id } : null;
      },
      isActive(x) {
        const page = document.querySelector(".student-attempt-page[data-attempt-id]");
        return !!page && String(page.dataset.attemptId || "") === String(x.entityId || "");
      },
      async restore(x) {
        const root = getAssessmentRoot();
        await exams(root);
        const resume = Array.from(root?.querySelectorAll?.("[data-v122-resume]") || []).find(
          (button) => String(button.dataset.attempt || "") === String(x.entityId || ""),
        );
        if (!resume) {
          persistence.clear();
          return false;
        }
        resume.click();
        return !!(await waitForAssessment(() => {
          const page = document.querySelector(".student-attempt-page[data-attempt-id]");
          return page && String(page.dataset.attemptId || "") === String(x.entityId || "") ? page : null;
        }));
      },
    });

    persistence.register("assessment-attempt-result", {
      detect() {
        const current = persistence.current?.();
        if (!document.querySelector("#sideDrawer:not(.hidden) .result-v122")) return null;
        return current?.kind === "assessment-attempt-result"
          ? {
              entityType: "attempt",
              entityId: current.entityId || null,
              mode: current.mode || "student",
              examId: current.examId || null,
            }
          : null;
      },
      isActive: () => !!document.querySelector("#sideDrawer:not(.hidden) .result-v122"),
      async restore(x) {
        if (!x.entityId) {
          persistence.clear();
          return false;
        }
        if (x.mode === "teacher" && x.examId) {
          const exam = await fetchExamById(x.examId);
          if (!exam) {
            persistence.clear();
            return false;
          }
          await openExamDetailTracked(exam);
          const button = Array.from(document.querySelectorAll("[data-v122-view-attempt]")).find(
            (b) => String(b.dataset.v122ViewAttempt || "") === String(x.entityId),
          );
          if (!button) {
            persistence.clear();
            return false;
          }
          button.click();
        } else {
          await openStudentAttemptResult(x.entityId);
        }
        return !!(await waitForAssessment(() => document.querySelector("#sideDrawer:not(.hidden) .result-v122")));
      },
    });

    persistence.register("assessment-results", {
      detect() {
        return document.querySelector(".assessment-results-v122")
          ? { mode: isTeacher() ? "teacher" : "student" }
          : null;
      },
      isActive: () => !!document.querySelector(".assessment-results-v122"),
      async restore() {
        await results(getAssessmentRoot());
        return !!document.querySelector(".assessment-results-v122");
      },
    });

    persistence.register("assessment-export", {
      detect() {
        const page = document.querySelector(".assessment-export-center");
        if (!page) return null;
        const current = persistence.current?.();
        const id = page.dataset.assessmentExamId ||
          (current?.kind === "assessment-export" ? current.entityId || "" : "");
        return id ? { entityType: "exam", entityId: id } : null;
      },
      isActive: (x) => activeEntity(".assessment-export-center", x.entityId, "assessment-export"),
      async restore(x) {
        const exam = await fetchExamById(x.entityId);
        if (!exam) {
          persistence.clear();
          return false;
        }
        await openExamDetailTracked(exam);
        const button = qs("#v1235ExportCenter", getAssessmentRoot());
        if (!button) {
          persistence.clear();
          return false;
        }
        persistence.remember("assessment-export", {
          entityType: "exam",
          entityId: x.entityId,
        });
        button.click();
        const page = await waitForAssessment(() => document.querySelector(".assessment-export-center"));
        if (page) page.dataset.assessmentExamId = String(x.entityId);
        return !!page;
      },
    });

    document.addEventListener(
      "click",
      (event) => {
        const target = event.target;
        const back = target?.closest?.(
          "#v122BuilderBack,#v122BuilderCancel,#v122Back,#v1235ExportBack,#v124AttemptBack",
        );
        if (back) persistence.clear();

        const detail = target?.closest?.("[data-v122-detail]");
        if (detail?.dataset.v122Detail)
          persistence.remember("assessment-detail", {
            entityType: "exam",
            entityId: detail.dataset.v122Detail,
          });

        if (target?.closest?.("#v122CreateExam"))
          persistence.remember("assessment-builder", {
            entityType: "exam",
            entityId: null,
            mode: "create",
          });

        if (target?.closest?.("#v122Edit")) {
          const page = document.querySelector(".assessment-detail-v122");
          const current = persistence.current?.();
          const id = page?.dataset.assessmentExamId ||
            (current?.kind === "assessment-detail" ? current.entityId || "" : "");
          if (id)
            persistence.remember("assessment-builder", {
              entityType: "exam",
              entityId: id,
              mode: "edit",
            });
        }

        if (target?.closest?.("#v1235ExportCenter")) {
          const page = document.querySelector(".assessment-detail-v122");
          const current = persistence.current?.();
          const id = page?.dataset.assessmentExamId ||
            (current?.kind === "assessment-detail" ? current.entityId || "" : "");
          if (id) {
            persistence.remember("assessment-export", {
              entityType: "exam",
              entityId: id,
            });
            setTimeout(() => {
              const exportPage = document.querySelector(".assessment-export-center");
              if (exportPage) exportPage.dataset.assessmentExamId = String(id);
            }, 0);
          }
        }

        const resume = target?.closest?.("[data-v122-resume]");
        if (resume?.dataset.attempt)
          persistence.remember("assessment-attempt", {
            entityType: "attempt",
            entityId: resume.dataset.attempt,
          });

        const studentResult = target?.closest?.("[data-v122-result]");
        if (studentResult?.dataset.v122Result)
          persistence.remember("assessment-attempt-result", {
            entityType: "attempt",
            entityId: studentResult.dataset.v122Result,
            mode: "student",
          });

        const teacherResult = target?.closest?.("[data-v122-view-attempt]");
        if (teacherResult?.dataset.v122ViewAttempt) {
          const page = document.querySelector(".assessment-detail-v122");
          const current = persistence.current?.();
          const examId = page?.dataset.assessmentExamId ||
            (current?.kind === "assessment-detail" ? current.entityId || null : null);
          persistence.remember("assessment-attempt-result", {
            entityType: "attempt",
            entityId: teacherResult.dataset.v122ViewAttempt,
            mode: "teacher",
            examId,
          });
        }

        if (target?.closest?.("#drawerClose")) {
          clearLiveTimer();
          if (persistence.current?.()?.kind === "assessment-attempt-result")
            persistence.clear();
        }
      },
      true,
    );
  }

  installAssessmentPersistence();
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
    openExamDetail: openExamDetailTracked,
    openFinalExamDetail,
    version: VERSION,
  });
})();
