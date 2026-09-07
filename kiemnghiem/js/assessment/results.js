/* AI-CLO PTITHCM V12.3 — Official Results module. */
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
          const x = m.clos[c.code] || {
            correct: 0,
            total: 0,
          };
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
      async function loadOfficialResultBundle() {
        const sid = subjectId();
        const [
          { data: attempts, error: ae },
          { data: clos, error: ce },
          { data: exams, error: ee },
        ] = await Promise.all([
          db
            .from("assessment_effective_attempts")
            .select(
              "id,exam_id,subject_id,student_id,attempt_number,started_at,submitted_at,score,score_policy",
            )
            .eq("subject_id", sid)
            .order("submitted_at", {
              ascending: true,
            }),
          db
            .from("clos")
            .select("id,code,description")
            .eq("subject_id", sid)
            .order("code"),
          db
            .from("exams")
            .select("id,title,score_policy,counts_toward_grade")
            .eq("subject_id", sid)
            .eq("counts_toward_grade", true)
            .order("created_at", {
              ascending: true,
            }),
        ]);
        if (ae) throw ae;
        if (ce) throw ce;
        if (ee) throw ee;
        const ids = (attempts || []).map((x) => x.id);
        let answers = [],
          questions = [];
        if (ids.length) {
          const [ar, qr] = await Promise.all([
            db
              .from("student_answers")
              .select("attempt_id,question_id,is_correct")
              .in("attempt_id", ids),
            db
              .from("attempt_questions")
              .select("attempt_id,question_id,clo_code")
              .in("attempt_id", ids),
          ]);
          if (ar.error) throw ar.error;
          if (qr.error) throw qr.error;
          answers = ar.data || [];
          questions = qr.data || [];
        }
        return {
          attempts: attempts || [],
          clos: clos || [],
          exams: exams || [],
          answers,
          questions,
        };
      }
      function buildOfficialMetrics(bundle) {
        const { attempts, clos, answers, questions } = bundle,
          answerMap = new Map(
            answers.map((a) => [`${a.attempt_id}|${a.question_id}`, a]),
          ),
          attemptMap = new Map(attempts.map((a) => [a.id, a]));
        const classMetric = freshMetric(clos),
          students = new Map(),
          scoreGroups = new Map();
        for (const a of attempts) {
          const m = students.get(a.student_id) || freshMetric(clos);
          m.attempts++;
          m.examIds.add(a.exam_id);
          students.set(a.student_id, m);
          classMetric.attempts++;
          classMetric.examIds.add(a.exam_id);
          const key = `${a.student_id}|${a.exam_id}`,
            g = scoreGroups.get(key) || {
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
          const ans = answerMap.get(`${q.attempt_id}|${q.question_id}`),
            right = ans?.is_correct === true,
            sm = students.get(a.student_id);
          if (sm) {
            sm.clos[q.clo_code] ??= {
              correct: 0,
              total: 0,
            };
            sm.clos[q.clo_code].total++;
            if (right) sm.clos[q.clo_code].correct++;
          }
          classMetric.clos[q.clo_code] ??= {
            correct: 0,
            total: 0,
          };
          classMetric.clos[q.clo_code].total++;
          if (right) classMetric.clos[q.clo_code].correct++;
        }
        const finishedStudents = new Map(
            [...students].map(([id, m]) => [id, finishMetric(m, clos)]),
          ),
          classFinished = finishMetric(classMetric, clos),
          studentValues = [...finishedStudents.values()];
        classFinished.gpa = studentValues.length
          ? studentValues.reduce((s, x) => s + x.gpa, 0) / studentValues.length
          : 0;
        return {
          classMetric: classFinished,
          students: finishedStudents,
        };
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
        return `<div class="clo-results">${(metric.clos || []).map((x) => `<div class="${x.total && x.score < 4 ? "clo-below" : ""}"><b>${escapeHtml(x.code)}</b><strong>${x.total ? x.score.toFixed(2) : "—"}</strong><span>${x.total ? `${x.correct}/${x.total} câu đúng` : "Chưa có dữ liệu"}</span></div>`).join("")}</div>`;
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
          const body = {
            subject_id: subjectId(),
            scope,
          };
          if (studentId) body.student_id = studentId;
          const { data, error } = await db.functions.invoke(
            "analyze-assessment",
            {
              body,
            },
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
      async function renderTeacherResults(c, bundle, metrics) {
        const profiles = await loadSubjectStudentProfiles(),
          withData = profiles.filter((p) => metrics.students.has(p.id)),
          classM = metrics.classMetric;
        c.innerHTML = `<div class="assessment-results-v122"><div class="subpage-head"><div><small>KẾT QUẢ HỌC PHẦN</small><h3>Kết quả CLO</h3><p>Chỉ dùng các bài bật “Tính vào kết quả CLO học phần”; mỗi bài đã áp dụng đúng cách ghi nhận điểm.</p></div><button id="v122AiClass" class="ai-btn" ${classM.attempts ? "" : "disabled"}>✦ AI phân tích lớp</button></div><section class="panel"><div class="detail-grid"><div><small>SV có dữ liệu</small><b>${withData.length}/${profiles.length}</b></div><div><small>Bài được tính CLO</small><b>${bundle.exams.length}</b></div><div><small>Lượt chính thức</small><b>${classM.attempts}</b></div><div><small>GPA trung bình SV</small><b>${withData.length ? classM.gpa.toFixed(2) : "—"}</b></div></div><h4>CLO toàn lớp</h4>${resultCloCards(classM)}<details><summary>Quy tắc điểm đang áp dụng</summary><p class="hint">${examPolicyNote(bundle.exams)}</p></details></section><section class="panel"><div class="panel-head"><div><h3>Danh sách sinh viên</h3><p class="hint">Ngưỡng đạt CLO: 4.00/10.</p></div></div><div class="table-wrap"><table><thead><tr><th>STT</th><th>Sinh viên</th><th>GPA</th>${bundle.clos.map((x) => `<th>${escapeHtml(x.code)}</th>`).join("")}<th>Lượt chính thức</th><th></th></tr></thead><tbody>${
          profiles
            .map((p, i) => {
              const m = metrics.students.get(p.id);
              return `<tr><td>${i + 1}</td><td><b>${escapeHtml(p.full_name || p.email || "Sinh viên")}</b><br><small>${escapeHtml(p.mssv || p.email || "")}</small></td><td>${m ? `<b>${m.gpa.toFixed(2)}</b>` : "—"}</td>${bundle.clos
                .map((clo) => {
                  const x = m?.clos.find((v) => v.code === clo.code);
                  return `<td class="${x?.total && x.score < 4 ? "score-low" : ""}">${x?.total ? x.score.toFixed(2) : "—"}</td>`;
                })
                .join(
                  "",
                )}<td>${m?.attempts || 0}</td><td>${m?.attempts ? `<button class="ai-btn compact" data-v122-ai-student="${p.id}">✦ AI</button>` : "—"}</td></tr>`;
            })
            .join("") ||
          `<tr><td colspan="${bundle.clos.length + 5}" class="empty">Chưa có sinh viên trong học phần.</td></tr>`
        }</tbody></table></div></section></div>`;
        qs("#v122AiClass", c)?.addEventListener("click", (e) =>
          requestAssessmentAi("class", null, e.currentTarget),
        );
        qsa("[data-v122-ai-student]", c).forEach(
          (b) =>
            (b.onclick = () =>
              requestAssessmentAi("student", b.dataset.v122AiStudent, b)),
        );
      }
      function renderStudentResults(c, bundle, metrics) {
        const m =
            metrics.students.get(state.user.id) ||
            finishMetric(freshMetric(bundle.clos), bundle.clos),
          rows = studentExamOfficialRows(bundle, state.user.id);
        c.innerHTML = `<div class="assessment-results-v122"><div class="subpage-head"><div><small>KẾT QUẢ HỌC PHẦN</small><h3>Kết quả CLO của bạn</h3><p>Chỉ các bài được giảng viên chọn tính vào CLO mới xuất hiện ở đây.</p></div><button id="v122AiMe" class="ai-btn" ${m.attempts ? "" : "disabled"}>✦ AI nhận xét</button></div><section class="panel"><div class="detail-grid"><div><small>GPA</small><b>${m.attempts ? m.gpa.toFixed(2) : "—"}</b></div><div><small>Bài có dữ liệu</small><b>${m.examCount}</b></div><div><small>Lượt chính thức</small><b>${m.attempts}</b></div></div><h4>Kết quả theo CLO</h4>${resultCloCards(m)}</section><section class="panel"><div class="panel-head"><div><h3>Cách tính từ từng bài</h3><p class="hint">Điểm cao nhất/Lần cuối chọn một lượt; Trung bình sử dụng các lượt đã nộp của bài đó.</p></div></div><div class="table-wrap"><table><thead><tr><th>Bài kiểm tra</th><th>Quy tắc</th><th>Lượt dùng</th><th>Điểm quy đổi</th></tr></thead><tbody>${rows.map((x) => `<tr><td><b>${escapeHtml(x.exam.title || "Bài kiểm tra")}</b></td><td>${escapeHtml(scorePolicyLabel(x.exam.score_policy))}</td><td>${x.attempts}</td><td><b>${x.score.toFixed(2)}</b></td></tr>`).join("") || '<tr><td colspan="4" class="empty">Chưa có bài làm được tính vào kết quả CLO.</td></tr>'}</tbody></table></div></section></div>`;
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
