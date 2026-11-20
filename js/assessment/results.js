/* AI-CLO PTITHCM V12.6.45 — Official Results module with sorting and Excel export. */
(() => {
  "use strict";
  window.AICLO_ASSESSMENT_MODULES = window.AICLO_ASSESSMENT_MODULES || {};
  window.AICLO_ASSESSMENT_MODULES.createResultsModule =
    function createResultsModule(ctx) {
      const {
        db,
        state,
        subjectId,
        escapeHtml,
        qs,
        qsa,
        openDrawer,
        modal,
        showError,
      } = ctx;
      if (
        !db ||
        !state ||
        !subjectId ||
        !escapeHtml ||
        !qs ||
        !qsa ||
        !showError
      )
        throw new Error("Assessment Results dependencies are incomplete");

      function scorePolicyLabel(v) {
        return (
          {
            highest: "Điểm cao nhất",
            latest: "Lần cuối",
            average: "Trung bình các lần",
          }[v] || "Điểm cao nhất"
        );
      }

      function freshMetric(clos) {
        return {
          attempts: 0,
          examIds: new Set(),
          scoreSum: 0,
          scoreCount: 0,
          clos: Object.fromEntries(
            (clos || []).map((c) => [
              c.code,
              {
                correct: 0,
                total: 0,
              },
            ]),
          ),
        };
      }

      function finishMetric(m, clos) {
        const cloScores = (clos || []).map((c) => {
          const x = m.clos[c.code] || { correct: 0, total: 0 };
          return {
            code: c.code,
            description: c.description || "",
            correct: x.correct,
            total: x.total,
            score: x.total ? (x.correct * 10) / x.total : 0,
          };
        });
        return {
          attempts: m.attempts,
          examCount: m.examIds.size,
          gpa: m.scoreCount ? m.scoreSum / m.scoreCount : 0,
          clos: cloScores,
        };
      }

// Paginate PostgREST responses: 70 students x 20 questions exceeds 1,000 rows.
  async function fetchAllPages(queryFactory) {
    const limit = 500, result = [];
    for (let from = 0; ; from += limit) {
      const { data, error } = await queryFactory().range(from, from + limit - 1);
      if (error) throw error;
      result.push(...(data || []));
      if (!data || data.length < limit) break;
    }
    return result;
  }
  async function loadAttemptDetails(ids) {
    const answers = [], questions = [];
    for (let i = 0; i < ids.length; i += 40) {
      const part = ids.slice(i, i + 40);
      const [a, q] = await Promise.all([
        fetchAllPages(() => db.from("student_answers").select("attempt_id,question_id,is_correct").in("attempt_id", part).order("id")),
        fetchAllPages(() => db.from("attempt_questions").select("attempt_id,question_id,clo_code").in("attempt_id", part).order("id")),
      ]);
      answers.push(...a);
      questions.push(...q);
    }
    return { answers, questions };
  }
  async function loadSubjectClos(sid) {
    const [sub, local] = await Promise.all([
      db.from("subjects").select("question_bank_id").eq("id", sid).maybeSingle(),
      db.from("clos").select("id,code,description").eq("subject_id", sid).order("code"),
    ]);
    if (sub.error) throw sub.error;
    if (local.error) throw local.error;
    // Legacy classes have local CLOs; shared-bank classes use the bank catalog.
    if ((local.data || []).length || !sub.data?.question_bank_id) return local.data || [];
    const bank = await db.from("clos").select("id,code,description")
      .eq("question_bank_id", sub.data.question_bank_id).order("code");
    if (bank.error) throw bank.error;
    return bank.data || [];
  }
  async function loadOfficialResultBundle() {
    const sid = subjectId();
    const [attempts, clos, exams] = await Promise.all([
      fetchAllPages(() => db.from("assessment_effective_attempts")
        .select("id,exam_id,subject_id,student_id,attempt_number,started_at,submitted_at,score,score_policy")
        .eq("subject_id", sid).order("submitted_at", { ascending: true }).order("id")),
      loadSubjectClos(sid),
      db.from("exams").select("id,title,score_policy,counts_toward_grade,question_blueprint")
        .eq("subject_id", sid).eq("counts_toward_grade", true).order("created_at", { ascending: true }),
    ]);
    if (exams.error) throw exams.error;
    return { attempts, clos, exams: exams.data || [],
      ...(await loadAttemptDetails(attempts.map((a) => a.id))) };
  }

      function buildOfficialMetrics(bundle) {
        const { attempts, clos, answers, questions } = bundle;
        const answerMap = new Map(
          answers.map((a) => [`${a.attempt_id}|${a.question_id}`, a]),
        );
        const attemptMap = new Map(attempts.map((a) => [a.id, a]));
        const classMetric = freshMetric(clos);
        const students = new Map();
        const scoreGroups = new Map();

        for (const a of attempts) {
          const m = students.get(a.student_id) || freshMetric(clos);
          m.attempts++;
          m.examIds.add(a.exam_id);
          students.set(a.student_id, m);
          classMetric.attempts++;
          classMetric.examIds.add(a.exam_id);
          const key = `${a.student_id}|${a.exam_id}`;
          const g = scoreGroups.get(key) || {
            student_id: a.student_id,
            scores: [],
          };
          g.scores.push(Number(a.score || 0));
          scoreGroups.set(key, g);
        }

        for (const g of scoreGroups.values()) {
          const m = students.get(g.student_id);
          if (!m) continue;
          m.scoreSum +=
            g.scores.reduce((sum, x) => sum + x, 0) / g.scores.length;
          m.scoreCount++;
        }

        for (const q of questions) {
          const a = attemptMap.get(q.attempt_id);
          if (!a || !q.clo_code) continue;
          const ans = answerMap.get(`${q.attempt_id}|${q.question_id}`);
          const right = ans?.is_correct === true;
          const sm = students.get(a.student_id);
          if (sm) {
            sm.clos[q.clo_code] ??= { correct: 0, total: 0 };
            sm.clos[q.clo_code].total++;
            if (right) sm.clos[q.clo_code].correct++;
          }
          classMetric.clos[q.clo_code] ??= { correct: 0, total: 0 };
          classMetric.clos[q.clo_code].total++;
          if (right) classMetric.clos[q.clo_code].correct++;
        }

        const finishedStudents = new Map(
          [...students].map(([id, m]) => [id, finishMetric(m, clos)]),
        );
        const classFinished = finishMetric(classMetric, clos);
        const studentValues = [...finishedStudents.values()];
        classFinished.gpa = studentValues.length
          ? studentValues.reduce((s, x) => s + x.gpa, 0) / studentValues.length
          : 0;
        return { classMetric: classFinished, students: finishedStudents };
      }

      async function loadSubjectStudentProfiles() {
        const { data: members, error } = await db
          .from("subject_members")
          .select("user_id,role")
          .eq("subject_id", subjectId());
        if (error) throw error;
        const ids = [
          ...new Set(
            (members || [])
              .filter((x) => x.role === "student")
              .map((x) => x.user_id),
          ),
        ];
        if (!ids.length) return [];
        const { data, error: pe } = await db
          .from("profiles")
          .select("id,full_name,mssv,email")
          .in("id", ids);
        if (pe) throw pe;
        return (data || []).sort((a, b) =>
          (a.full_name || a.email || "").localeCompare(
            b.full_name || b.email || "",
            "vi",
          ),
        );
      }

      function resultCloCards(metric) {
        return `<div class="clo-results">${(metric.clos || [])
          .map(
            (x) =>
              `<div class="${x.total && x.score < 4 ? "clo-below" : ""}"><b>${escapeHtml(x.code)}</b><strong>${x.total ? x.score.toFixed(1) : "—"}</strong><span>${x.total ? `${x.correct}/${x.total} câu đúng` : "Chưa có dữ liệu"}</span></div>`,
          )
          .join("")}</div>`;
      }

      function examPolicyNote(exams) {
        return exams.length
          ? exams
              .map(
                (x) =>
                  `${escapeHtml(x.title || "Bài kiểm tra")}: ${escapeHtml(scorePolicyLabel(x.score_policy))}`,
              )
              .join(" · ")
          : "Chưa có bài kiểm tra được tính vào CLO.";
      }

      function aiAnalysisHtml(a) {
        const actions = a?.recommendations || a?.next_actions || [];
        return `<div class="ai-analysis-v122"><p>${escapeHtml(a?.summary || "")}</p>${a?.strengths?.length ? `<h4>Điểm mạnh</h4><ul>${a.strengths.map((x) => `<li>${escapeHtml(x)}</li>`).join("")}</ul>` : ""}${a?.needs_improvement?.length ? `<h4>Cần cải thiện</h4><ul>${a.needs_improvement.map((x) => `<li>${escapeHtml(x)}</li>`).join("")}</ul>` : ""}${actions.length ? `<h4>Khuyến nghị</h4><ul>${actions.map((x) => `<li>${escapeHtml(x)}</li>`).join("")}</ul>` : ""}</div>`;
      }

      async function requestAssessmentAi(scope, studentId, button) {
        const old = button?.textContent;
        if (button) {
          button.disabled = true;
          button.textContent = "✦ Đang phân tích…";
        }
        try {
          const body = { subject_id: subjectId(), scope };
          if (studentId) body.student_id = studentId;
          const { data, error } = await db.functions.invoke(
            "analyze-assessment",
            { body },
          );
          if (error) throw error;
          if (!data?.success)
            throw new Error(data?.error || "AI chưa tạo được nhận xét");
          const title =
            scope === "class"
              ? "AI phân tích kết quả lớp"
              : "AI nhận xét kết quả CLO";
          if (typeof openDrawer === "function")
            openDrawer(title, aiAnalysisHtml(data.analysis), null, {
              wide: true,
              eyebrow: "AI-CLO",
            });
          else if (typeof modal === "function")
            modal(title, aiAnalysisHtml(data.analysis));
        } catch (e) {
          showError(e);
        } finally {
          if (button) {
            button.disabled = false;
            button.textContent = old;
          }
        }
      }

      function studentExamOfficialRows(bundle, studentId) {
        return bundle.exams
          .map((exam) => {
            const rows = bundle.attempts.filter(
              (a) => a.student_id === studentId && a.exam_id === exam.id,
            );
            if (!rows.length) return null;
            return {
              exam,
              attempts: rows.length,
              score:
                rows.reduce((s, x) => s + Number(x.score || 0), 0) /
                rows.length,
            };
          })
          .filter(Boolean);
      }

      function makeTeacherRows(profiles, metrics) {
        return profiles.map((profile) => ({
          profile,
          metric: metrics.students.get(profile.id) || null,
        }));
      }

      function cloValue(metric, code) {
        const x = metric?.clos?.find((v) => v.code === code);
        return x?.total ? Number(x.score) : null;
      }

      function sortTeacherRows(rows, mode) {
        const sorted = [...rows];
        const nameOf = (row) =>
          row.profile.full_name || row.profile.email || "";
        const numeric = (row, key) => {
          if (key === "gpa") return row.metric ? Number(row.metric.gpa) : null;
          if (key === "attempts") return row.metric ? Number(row.metric.attempts) : 0;
          if (key.startsWith("clo:")) return cloValue(row.metric, key.slice(4));
          return null;
        };
        if (mode === "name") {
          sorted.sort((a, b) =>
            nameOf(a).localeCompare(nameOf(b), "vi", { sensitivity: "base" }),
          );
          return sorted;
        }
        const [key, direction = "desc"] = String(mode || "gpa:desc").split("|");
        sorted.sort((a, b) => {
          const av = numeric(a, key), bv = numeric(b, key);
          const aMissing = av == null || Number.isNaN(av);
          const bMissing = bv == null || Number.isNaN(bv);
          if (aMissing !== bMissing) return aMissing ? 1 : -1;
          if (aMissing) return nameOf(a).localeCompare(nameOf(b), "vi");
          const delta = av - bv;
          if (delta) return direction === "asc" ? delta : -delta;
          return nameOf(a).localeCompare(nameOf(b), "vi", { sensitivity: "base" });
        });
        return sorted;
      }

      function teacherRowsHtml(rows, clos) {
        return rows
          .map(({ profile: p, metric: m }, i) =>
            `<tr><td>${i + 1}</td><td><b>${escapeHtml(p.full_name || p.email || "Sinh viên")}</b><br><small>${escapeHtml(p.mssv || p.email || "")}</small></td><td>${m ? `<b>${m.gpa.toFixed(1)}</b>` : "—"}</td>${clos
              .map((clo) => {
                const x = m?.clos.find((v) => v.code === clo.code);
                return `<td class="${x?.total && x.score < 4 ? "score-low" : ""}">${x?.total ? x.score.toFixed(1) : "—"}</td>`;
              })
              .join("")}<td>${m?.attempts || 0}</td><td>${m?.attempts ? `<button class="ai-btn compact" data-v122-ai-student="${p.id}">✦ AI</button>` : "—"}</td></tr>`,
          )
          .join("");
      }

      function safeFilePart(value) {
        return String(value || "hoc-phan")
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/đ/g, "d")
          .replace(/Đ/g, "D")
          .replace(/[^a-zA-Z0-9_-]+/g, "-")
          .replace(/^-|-$/g, "")
          .slice(0, 70) || "hoc-phan";
      }

      async function exportTeacherResults(rows, clos) {
        try {
          const XLSX =
            window.XLSX || (await window.AICLO_OFFICE_LIBS?.xlsx?.());
          if (!XLSX) throw new Error("Không tải được thư viện Excel");
          const records = rows.map(({ profile: p, metric: m }, i) => {
            const row = {
              STT: i + 1,
              MSSV: p.mssv || "",
              "Họ và tên": p.full_name || "",
              Email: p.email || "",
              GPA: m ? Number(m.gpa.toFixed(1)) : "",
            };
            for (const clo of clos) {
              const value = cloValue(m, clo.code);
              row[clo.code] = value == null ? "" : Number(value.toFixed(1));
            }
            row["Lượt chính thức"] = m?.attempts || 0;
            row["Số bài có dữ liệu"] = m?.examCount || 0;
            return row;
          });
          const sheet = XLSX.utils.json_to_sheet(records);
          const wb = XLSX.utils.book_new();
          XLSX.utils.book_append_sheet(wb, sheet, "Ket_qua_CLO");
          const subjectName =
            document.querySelector("#subjectSelect")?.selectedOptions?.[0]
              ?.textContent || "hoc-phan";
          XLSX.writeFile(
            wb,
            `Ket-qua-CLO-${safeFilePart(subjectName)}-${new Date().toISOString().slice(0, 10)}.xlsx`,
          );
        } catch (e) {
          showError(e);
        }
      }

function effectiveExamAttempts(attempts, policy) {
    if (policy === "average") return attempts;
    const ordered = [...attempts].sort((a,b) => {
      if (policy !== "latest") {
        const delta = Number(b.score ?? -Infinity) - Number(a.score ?? -Infinity);
        if (delta) return delta;
      }
      return Date.parse(b.submitted_at || 0) - Date.parse(a.submitted_at || 0) ||
        Number(b.attempt_number || 0) - Number(a.attempt_number || 0);
    });
    const seen = new Set();
    return ordered.filter((a) => {
      if (seen.has(a.student_id)) return false;
      seen.add(a.student_id);
      return true;
    });
  }

  async function loadExamResultBundle(exam, clos) {
    const submitted = await fetchAllPages(() => db.from("exam_attempts")
      .select("id,exam_id,student_id,attempt_number,submitted_at,score")
      .eq("exam_id", exam.id).not("submitted_at", "is", null)
      .order("submitted_at", { ascending: true }).order("id"));
    const attempts = effectiveExamAttempts(submitted, exam.score_policy);
    return {
      attempts, clos, exams: [exam],
      ...(await loadAttemptDetails(attempts.map((a) => a.id))),
    };
  }

  async function attachTeacherExamInspector(c, clos, profiles, exams) {
    if (!exams.length) return;
    const root = c.querySelector(".assessment-results-v122");
    if (!root) return;
    const panel = document.createElement("section");
    panel.className = "panel";
    panel.innerHTML = `<div class="panel-head"><div><h3>Điểm CLO theo từng bài kiểm tra</h3><p class="hint">Tra cứu được cả bài không tính vào điểm CLO học phần. Kết quả tổng hợp phía trên giữ nguyên.</p></div></div><label class="field">Chọn bài kiểm tra<select id="v122ExamCloSelect">${exams.map((e) => `<option value="${escapeHtml(e.id)}">${escapeHtml(e.title || "Bài kiểm tra")}${e.counts_toward_grade ? "" : " · Không tính vào học phần"}</option>`).join("")}</select></label><div id="v122ExamCloDetail"></div>`;
    root.appendChild(panel);
    const selector = qs("#v122ExamCloSelect", panel);
    const output = qs("#v122ExamCloDetail", panel);
    let token = 0;
    const showExam = async () => {
      const current = ++token;
      const exam = exams.find((x) => x.id === selector?.value);
      if (!exam || !output) return;
      output.innerHTML = '<p class="hint">Đang tải kết quả bài kiểm tra…</p>';
      try {
        const bundle = await loadExamResultBundle(exam, clos);
        const metrics = buildOfficialMetrics(bundle);
        const rows = makeTeacherRows(profiles, metrics).sort((a,b) =>
          String(a.profile.mssv || "").localeCompare(String(b.profile.mssv || ""), "vi"));
        const withData = rows.filter((r) => r.metric).length;
        const m = metrics.classMetric;
        const staging = document.createElement("div");
        staging.innerHTML = `<p class="hint"><b>${escapeHtml(exam.title || "Bài kiểm tra")}</b> · ${exam.counts_toward_grade ? "Tính vào kết quả học phần" : "KHÔNG tính vào kết quả học phần"} · ${escapeHtml(scorePolicyLabel(exam.score_policy))}</p><div class="detail-grid"><div><small>SV có kết quả</small><b>${withData}/${profiles.length}</b></div><div><small>Lượt ghi nhận</small><b>${m.attempts}</b></div><div><small>Điểm trung bình</small><b>${withData ? m.gpa.toFixed(1) : "—"}</b></div></div><h4>Kết quả CLO của bài</h4>${resultCloCards(m)}<div class="table-wrap"><table><thead><tr><th>STT</th><th>Sinh viên</th><th>Điểm bài</th>${clos.map((clo) => `<th>${escapeHtml(clo.code)}</th>`).join("")}</tr></thead><tbody>${rows.map(({ profile: p, metric: metric }, index) => `<tr><td>${index + 1}</td><td><b>${escapeHtml(p.full_name || p.email || "Sinh viên")}</b><br><small>${escapeHtml(p.mssv || "")}</small></td><td>${metric ? metric.gpa.toFixed(1) : "—"}</td>${clos.map((clo) => { const x = metric?.clos.find((v) => v.code === clo.code); return `<td>${x?.total ? x.score.toFixed(1) : "—"}</td>`; }).join("")}</tr>`).join("") || `<tr><td colspan="${clos.length + 3}">Chưa có sinh viên trong lớp.</td></tr>`}</tbody></table></div>`;
        if (current === token) output.innerHTML = staging.innerHTML;
      } catch (error) {
        if (current === token) {
          output.innerHTML = '<p class="hint">Không thể tải kết quả CLO của bài này.</p>';
          showError(error);
        }
      }
    };
    selector?.addEventListener("change", showExam);
    const midterm = exams.find((e) => /giữa\s*(kỳ|kì)|midterm/i.test(e.title || ""));
    selector.value = midterm?.id || exams[0].id;
    await showExam();
  }

      async function renderTeacherResults(c, bundle, metrics) {
        const [profiles, examResponse] = await Promise.all([
          loadSubjectStudentProfiles(),
          db.from("exams").select("id,title,score_policy,counts_toward_grade,created_at")
            .eq("subject_id", subjectId())
            .order("created_at", { ascending: false }),
        ]);
        if (examResponse.error) throw examResponse.error;
        const allExams = examResponse.data || [];
        const withData = profiles.filter((p) => metrics.students.has(p.id));
        const classM = metrics.classMetric;
        const teacherRows = makeTeacherRows(profiles, metrics);
        const defaultSort = "name";
        const sortOptions = [
          `<option value="name">Tên sinh viên</option>`,
          `<option value="gpa|desc">GPA cao → thấp</option>`,
          `<option value="gpa|asc">GPA thấp → cao</option>`,
          ...bundle.clos.flatMap((clo) => [
            `<option value="clo:${escapeHtml(clo.code)}|desc">${escapeHtml(clo.code)} cao → thấp</option>`,
            `<option value="clo:${escapeHtml(clo.code)}|asc">${escapeHtml(clo.code)} thấp → cao</option>`,
          ]),
          `<option value="attempts|desc">Lượt chính thức nhiều → ít</option>`,
        ].join("");

        c.innerHTML = `<div class="assessment-results-v122"><div class="subpage-head"><div><small>KẾT QUẢ HỌC PHẦN</small><h3>Kết quả CLO</h3><p>Chỉ dùng các bài bật “Tính vào kết quả CLO học phần”; mỗi bài đã áp dụng đúng cách ghi nhận điểm.</p></div><button id="v122AiClass" class="ai-btn" ${classM.attempts ? "" : "disabled"}>✦ AI phân tích lớp</button></div><section class="panel"><div class="detail-grid"><div><small>SV có dữ liệu</small><b>${withData.length}/${profiles.length}</b></div><div><small>Bài được tính CLO</small><b>${bundle.exams.length}</b></div><div><small>Lượt chính thức</small><b>${classM.attempts}</b></div><div><small>GPA trung bình SV</small><b>${withData.length ? classM.gpa.toFixed(1) : "—"}</b></div></div><h4>CLO toàn lớp</h4>${resultCloCards(classM)}<details><summary>Quy tắc điểm đang áp dụng</summary><p class="hint">${examPolicyNote(bundle.exams)}</p></details></section><section class="panel"><div class="panel-head"><div><h3>Danh sách sinh viên</h3><p class="hint">Ngưỡng đạt CLO: 4.0/10.</p></div></div><div class="toolbar assessment-attempt-toolbar result-list-toolbar"><span class="hint">${profiles.length} sinh viên · sắp xếp không làm thay đổi dữ liệu điểm.</span><div class="assessment-attempt-tools"><label class="field compact-field">Sắp xếp<select id="v122ResultSort">${sortOptions}</select></label><button id="v122ExportClo" type="button" class="secondary">⇩ Tải kết quả Excel</button></div></div><div class="table-wrap"><table><thead><tr><th>STT</th><th>Sinh viên</th><th>GPA</th>${bundle.clos.map((x) => `<th>${escapeHtml(x.code)}</th>`).join("")}<th>Lượt chính thức</th><th></th></tr></thead><tbody id="v122ResultRows">${teacherRowsHtml(sortTeacherRows(teacherRows, defaultSort), bundle.clos) || `<tr><td colspan="${bundle.clos.length + 5}" class="empty">Chưa có sinh viên trong học phần.</td></tr>`}</tbody></table></div></section></div>`;

        const tbody = qs("#v122ResultRows", c);
        const sort = qs("#v122ResultSort", c);
        const redrawRows = () => {
          if (!tbody) return;
          const rows = sortTeacherRows(teacherRows, sort?.value || defaultSort);
          tbody.innerHTML =
            teacherRowsHtml(rows, bundle.clos) ||
            `<tr><td colspan="${bundle.clos.length + 5}" class="empty">Chưa có sinh viên trong học phần.</td></tr>`;
        };
        if (sort) {
          sort.value = defaultSort;
          sort.onchange = redrawRows;
        }
        qs("#v122ExportClo", c)?.addEventListener("click", () => {
          const rows = sortTeacherRows(teacherRows, sort?.value || defaultSort);
          exportTeacherResults(rows, bundle.clos);
        });
        qs("#v122AiClass", c)?.addEventListener("click", (e) =>
          requestAssessmentAi("class", null, e.currentTarget),
        );
        tbody?.addEventListener("click", (e) => {
          const button = e.target.closest?.("[data-v122-ai-student]");
          if (!button) return;
          requestAssessmentAi("student", button.dataset.v122AiStudent, button);
        });
        await attachTeacherExamInspector(c, bundle.clos, profiles, allExams);
      }

      function renderStudentResults(c, bundle, metrics) {
        const m =
          metrics.students.get(state.user.id) ||
          finishMetric(freshMetric(bundle.clos), bundle.clos);
        const rows = studentExamOfficialRows(bundle, state.user.id);
        // Course-level CLO cards must not bypass the instructor's exam visibility choice.
        const showCloScores = bundle.exams.length > 0 &&
          bundle.exams.every((exam) => exam.question_blueprint?.show_clo_scores !== false);
        const cloHtml = showCloScores ? resultCloCards(m) :
          '<p class="hint">Giảng viên chưa cho phép hiển thị điểm CLO của các bài được tính vào học phần.</p>';
        c.innerHTML = `<div class="assessment-results-v122"><div class="subpage-head"><div><small>KẾT QUẢ HỌC PHẦN</small><h3>Kết quả CLO của bạn</h3><p>Chỉ các bài được giảng viên chọn tính vào CLO mới xuất hiện ở đây.</p></div><button id="v122AiMe" class="ai-btn" ${m.attempts ? "" : "disabled"}>✦ AI nhận xét</button></div><section class="panel"><div class="detail-grid"><div><small>GPA</small><b>${m.attempts ? m.gpa.toFixed(1) : "—"}</b></div><div><small>Bài có dữ liệu</small><b>${m.examCount}</b></div><div><small>Lượt chính thức</small><b>${m.attempts}</b></div></div><h4>Kết quả theo CLO</h4>${cloHtml}</section><section class="panel"><div class="panel-head"><div><h3>Cách tính từ từng bài</h3><p class="hint">Điểm cao nhất/Lần cuối chọn một lượt; Trung bình sử dụng các lượt đã nộp của bài đó.</p></div></div><div class="table-wrap"><table><thead><tr><th>Bài kiểm tra</th><th>Quy tắc</th><th>Lượt dùng</th><th>Điểm quy đổi</th></tr></thead><tbody>${rows.map((x) => `<tr><td><b>${escapeHtml(x.exam.title || "Bài kiểm tra")}</b></td><td>${escapeHtml(scorePolicyLabel(x.exam.score_policy))}</td><td>${x.attempts}</td><td><b>${x.score.toFixed(1)}</b></td></tr>`).join("") || '<tr><td colspan="4" class="empty">Chưa có bài làm được tính vào kết quả CLO.</td></tr>'}</tbody></table></div></section></div>`;
        qs("#v122AiMe", c)?.addEventListener("click", (e) =>
          requestAssessmentAi("student", state.user.id, e.currentTarget),
        );
      }

      return Object.freeze({
        loadOfficialResultBundle,
        buildOfficialMetrics,
        renderTeacherResults,
        renderStudentResults,
      });
    };
})();
