/* AI-CLO PTITHCM V12.3.4 — Online Assessment Lifecycle module. */
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
      async function loadAttemptCloBundle(exam, attempts) {
        const { data: clos, error: ce } = await db.from("clos").select("id,code,description").eq("subject_id", exam.subject_id).order("code");
        if (ce) throw ce;
        const ids = attempts.map((x) => x.id);
        if (!ids.length) return { clos: clos || [], attempts };
        const [qr, ar] = await Promise.all([
          db.from("attempt_questions").select("attempt_id,question_id,clo_code").in("attempt_id", ids),
          db.from("student_answers").select("attempt_id,question_id,is_correct").in("attempt_id", ids),
        ]);
        if (qr.error) throw qr.error;
        if (ar.error) throw ar.error;
        const answerMap = new Map((ar.data || []).map((a) => [`${a.attempt_id}|${a.question_id}`, a]));
        const metricMap = new Map(ids.map((id) => [id, {}]));
        for (const q of qr.data || []) {
          if (!q.clo_code) continue;
          const m = metricMap.get(q.attempt_id) || {};
          const c = m[q.clo_code] || { correct: 0, total: 0, score: null };
          c.total++;
          if (answerMap.get(`${q.attempt_id}|${q.question_id}`)?.is_correct === true) c.correct++;
          c.score = c.total ? (c.correct * 10) / c.total : null;
          m[q.clo_code] = c;
          metricMap.set(q.attempt_id, m);
        }
        return { clos: clos || [], attempts: attempts.map((a) => ({ ...a, _clo: metricMap.get(a.id) || {} })) };
      }
      function cloScore(a, code) {
        const x = a?._clo?.[code];
        return a?.submitted_at && x?.total ? Number(x.score) : null;
      }
      function attemptTableHtml(rows, clos, mode = "date") {
        const sorted = attemptSort(rows, mode), cloHeads = (clos || []).map((c) => `<th>${escapeHtml(c.code)}</th>`).join("");
        const colspan = 7 + (clos || []).length;
        return `<div class="toolbar assessment-attempt-toolbar"><span class="hint">${rows.length} lượt làm · ${rows.filter((x) => x.submitted_at).length} đã nộp</span><div class="assessment-attempt-tools"><label class="field compact-field">Sắp xếp<select id="v122AttemptSort"><option value="date" ${mode === "date" ? "selected" : ""}>Mới nhất</option><option value="name" ${mode === "name" ? "selected" : ""}>Tên sinh viên</option><option value="score" ${mode === "score" ? "selected" : ""}>Điểm cao</option></select></label><details class="assessment-export-dropdown"><summary class="secondary">Tải kết quả Excel ▾</summary><div class="assessment-export-menu"><button type="button" data-v1234-export="highest">Điểm cao nhất</button><button type="button" data-v1234-export="all">Tất cả lần làm</button><button type="button" data-v1234-export="average">Điểm trung bình</button></div></details></div></div><div class="table-wrap"><table class="assessment-attempt-table"><thead><tr><th>STT</th><th>Sinh viên</th><th>Lần</th><th>Thời gian</th><th>Điểm tổng</th>${cloHeads}<th>Trạng thái</th><th>Thao tác</th></tr></thead><tbody>${sorted.map((a, i) => `<tr><td>${i + 1}</td><td><b>${escapeHtml(attemptStudentName(a))}</b><br><small>${escapeHtml(a.profiles?.mssv || a.profiles?.email || "")}</small></td><td>${a.attempt_number || 1}</td><td class="attempt-time-cell"><small><b>Bắt đầu:</b> ${formatDateTime(a.started_at)}</small><small><b>Nộp:</b> ${a.submitted_at ? formatDateTime(a.submitted_at) : "—"}</small></td><td>${a.submitted_at && a.score != null ? `<b>${Number(a.score).toFixed(2)}</b>` : "—"}</td>${(clos || []).map((c) => { const v=cloScore(a,c.code); return `<td>${v == null ? "—" : `<b class="${v < 4 ? "score-below" : ""}">${v.toFixed(2)}</b>`}</td>`; }).join("")}<td><span class="badge ${a.submitted_at ? "green" : ""}">${a.submitted_at ? "Đã nộp" : "Đang làm"}</span></td><td class="row-actions">${a.submitted_at ? `<button type="button" class="secondary compact" data-v122-view-attempt="${a.id}">Xem bài</button>` : '<button type="button" class="secondary compact" disabled>Đang làm</button>'}<button type="button" class="danger compact" data-v122-delete-attempt="${a.id}">Xóa lượt</button></td></tr>`).join("") || `<tr><td colspan="${colspan}" class="empty">Chưa có lượt làm.</td></tr>`}</tbody></table></div>`;
      }
      function exportRowsByMode(rows, clos, mode) {
        const submitted = rows.filter((x) => x.submitted_at);
        const groups = new Map();
        for (const a of submitted) {
          const g = groups.get(a.student_id) || [];
          g.push(a); groups.set(a.student_id, g);
        }
        if (mode === "all") return submitted.map((a) => ({ ...a, _exportAttempt: a.attempt_number || 1 }));
        if (mode === "highest") return [...groups.values()].map((g) => [...g].sort((a,b) => Number(b.score || 0)-Number(a.score || 0) || new Date(b.submitted_at)-new Date(a.submitted_at))[0]).map((a) => ({ ...a, _exportAttempt: a.attempt_number || 1 }));
        return [...groups.values()].map((g) => {
          const base = g[0];
          const avg = (vals) => vals.length ? vals.reduce((s,v)=>s+v,0)/vals.length : null;
          const clone = { ...base, score: avg(g.map((x)=>Number(x.score)).filter(Number.isFinite)), started_at:null, submitted_at:null, _exportAttempt:`TB (${g.length})`, _clo:{} };
          for (const c of clos || []) {
            const vals=g.map((x)=>cloScore(x,c.code)).filter((v)=>v!=null);
            const v=avg(vals); clone._clo[c.code]=v==null?{total:0,score:null}:{total:1,score:v};
          }
          return clone;
        });
      }
      function scorePolicyVi(v) { return ({highest:"Điểm cao nhất",latest:"Lần cuối",average:"Trung bình các lần"})[v] || "Điểm cao nhất"; }
      function reportModeVi(v) { return ({highest:"Điểm cao nhất",all:"Tất cả lần làm",average:"Điểm trung bình"})[v] || v; }
      async function exportAttemptExcel(exam, rows, clos, mode, trigger) {
        const old=trigger?.textContent; if(trigger){trigger.disabled=true;trigger.textContent="Đang tạo Excel…";}
        try {
          const ExcelJS = await window.AICLO_OFFICE_LIBS?.exceljs?.();
          if (!ExcelJS) throw new Error("Không tải được thư viện ExcelJS");
          const { data: subject } = await db.from("subjects").select("*").eq("id", exam.subject_id).maybeSingle();
          const exportRows = exportRowsByMode(rows, clos, mode);
          const wb = new ExcelJS.Workbook(); wb.creator="AI-CLO PTITHCM"; wb.created=new Date();
          const ws = wb.addWorksheet("Kết quả", { pageSetup:{paperSize:9,orientation:"landscape",fitToPage:true,fitToWidth:1,fitToHeight:0,margins:{left:0.25,right:0.25,top:0.45,bottom:0.45,header:0.2,footer:0.2}} });
          const totalCols=9+(clos||[]).length;
          ws.mergeCells(1,1,1,totalCols); const title=ws.getCell(1,1); title.value="BÁO CÁO KẾT QUẢ BÀI KIỂM TRA"; title.font={name:"Times New Roman",size:14,bold:true}; title.alignment={horizontal:"center",vertical:"middle"}; ws.getRow(1).height=24;
          const info=[
            ["Tên học phần", subject?.name || subject?.title || "—"],["Mã học phần", subject?.code || subject?.subject_code || "—"],["Tên bài kiểm tra", exam.title || "—"],["Mô tả", exam.description || "—"],["Loại bài / cấu trúc", `Bài kiểm tra trực tuyến · ${structureLabel(exam.structure_mode)}`],["Thời gian làm bài", `${exam.duration_minutes || "—"} phút`],["Số câu", Number(exam.total_questions || 0)],["Số lần làm", Number(exam.max_attempts || 1)],["Chính sách tính điểm", scorePolicyVi(exam.score_policy)],["Chế độ báo cáo", reportModeVi(mode)],["Thời gian mở", exam.opens_at ? formatDateTime(exam.opens_at) : "Khi phát hành"],["Thời gian đóng", exam.closes_at ? formatDateTime(exam.closes_at) : "Không giới hạn"],["Số sinh viên đã làm", new Set(rows.filter((x)=>x.submitted_at).map((x)=>x.student_id)).size],["Ngày xuất báo cáo", formatDateTime(new Date().toISOString())]
          ];
          let r=3;
          for (const [label,value] of info){ ws.getCell(r,1).value=label; ws.getCell(r,1).font={name:"Times New Roman",size:12,bold:true}; ws.mergeCells(r,2,r,totalCols); ws.getCell(r,2).value=value; r++; }
          const tableStart=r+1;
          const headers=["STT","Mã SV","Họ tên","Lần","Bắt đầu","Nộp","Điểm tổng",...(clos||[]).map((c)=>c.code),"Trạng thái"];
          const body=exportRows.map((a,i)=>[i+1,a.profiles?.mssv || "",attemptStudentName(a),a._exportAttempt || a.attempt_number || 1,a.started_at?formatDateTime(a.started_at):"—",a.submitted_at?formatDateTime(a.submitted_at):"—",a.score==null?null:Number(a.score),...(clos||[]).map((c)=>cloScore(a,c.code)),mode==="average"?`Trung bình`:"Đã nộp"]);
          ws.addTable({name:"BangKetQua",ref:`A${tableStart}`,headerRow:true,totalsRow:false,style:{theme:"TableStyleMedium2",showRowStripes:false},columns:headers.map((name)=>({name})),rows:body});
          const tableEnd=tableStart+body.length;
          for(let rr=tableStart;rr<=tableEnd;rr++) for(let cc=1;cc<=headers.length;cc++){ const cell=ws.getCell(rr,cc); cell.font={name:"Times New Roman",size:12,bold:rr===tableStart}; cell.alignment={vertical:"middle",horizontal:[1,4,7,...Array.from({length:(clos||[]).length},(_,i)=>8+i)].includes(cc)?"center":"left",wrapText:true}; cell.border={top:{style:"thin"},left:{style:"thin"},bottom:{style:"thin"},right:{style:"thin"}}; }
          const scoreCols=[7,...(clos||[]).map((_,i)=>8+i)];
          for(let rr=tableStart+1;rr<=tableEnd;rr++) for(const cc of scoreCols){ const cell=ws.getCell(rr,cc); if(typeof cell.value==="number"){cell.numFmt="0.00"; if(cell.value<4) cell.fill={type:"pattern",pattern:"solid",fgColor:{argb:"FFF4CCCC"}};} }
          let sr=tableEnd+3; ws.mergeCells(sr,1,sr,totalCols); ws.getCell(sr,1).value="TỔNG HỢP"; ws.getCell(sr,1).font={name:"Times New Roman",size:12,bold:true}; sr++;
          const scores=exportRows.map((x)=>Number(x.score)).filter(Number.isFinite);
          const summary=[["Điểm trung bình",scores.length?scores.reduce((a,b)=>a+b,0)/scores.length:null],["Điểm cao nhất",scores.length?Math.max(...scores):null],["Điểm thấp nhất",scores.length?Math.min(...scores):null],["Số điểm tổng dưới 4",scores.filter((x)=>x<4).length]];
          for(const c of clos||[]){const vals=exportRows.map((x)=>cloScore(x,c.code)).filter((v)=>v!=null);summary.push([`Trung bình ${c.code}`,vals.length?vals.reduce((a,b)=>a+b,0)/vals.length:null],[`Số SV/lượt ${c.code} dưới 4`,vals.filter((x)=>x<4).length],[`Tỷ lệ đạt ${c.code} (≥4)`,vals.length?vals.filter((x)=>x>=4).length/vals.length:null]);}
          for(const [label,value] of summary){ws.getCell(sr,1).value=label;ws.getCell(sr,1).font={name:"Times New Roman",size:12,bold:true};ws.getCell(sr,2).value=value;ws.getCell(sr,2).font={name:"Times New Roman",size:12};if(typeof value==="number") ws.getCell(sr,2).numFmt=label.startsWith("Tỷ lệ")?"0.00%":"0.00";sr++;}
          ws.views=[{state:"frozen",ySplit:tableStart}];
          ws.columns.forEach((col,i)=>{col.width=i===2?28:i===4||i===5?19:i===1?15:i>=7&&i<7+(clos||[]).length?11:13;});
          ws.eachRow((row)=>row.eachCell((cell)=>{ if(!cell.font?.name) cell.font={name:"Times New Roman",size:12}; }));
          ws.headerFooter.oddFooter="&L AI-CLO PTITHCM&CTrang &P / &N&R"+new Date().toLocaleDateString("vi-VN");
          const buf=await wb.xlsx.writeBuffer(); const blob=new Blob([buf],{type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"}); const a=document.createElement("a"); a.href=URL.createObjectURL(blob); const safe=String(exam.title||"bai-kiem-tra").normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-zA-Z0-9_-]+/g,"-").replace(/^-|-$/g,""); a.download=`${safe||"bai-kiem-tra"}-${mode}.xlsx`; document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(a.href),1000); notify(`Đã tạo Excel: ${reportModeVi(mode)}`);
        } catch(e){ showError(e); } finally { if(trigger){trigger.disabled=false;trigger.textContent=old;} }
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
          const rawAttempts = await loadExamAttempts(exam.id),
            bundle = await loadAttemptCloBundle(exam, rawAttempts),
            attempts = bundle.attempts,
            clos = bundle.clos,
            c = getAssessmentRoot();
          if (!c) return;
          const s = statusMeta(exam);
          c.innerHTML = `<div class="assessment-detail-v122"><div class="subpage-head"><div><button id="v122Back" class="secondary compact">← Quay lại</button><small>BÀI KIỂM TRA TRỰC TUYẾN</small><h3>${escapeHtml(exam.title || "Bài kiểm tra")}</h3><p>${escapeHtml(exam.description || "")}</p></div><span class="badge ${s.className}">${s.label}</span></div><section class="panel"><div class="panel-head"><div><h3>Thông tin bài kiểm tra</h3><p class="hint">Một nguồn trạng thái duy nhất từ bảng exams.</p></div><div class="assessment-detail-actions"><button id="v122Preview" class="secondary">Làm thử</button>${detailActions(exam)}</div></div><div class="detail-grid"><div><small>Số câu</small><b>${Number(exam.total_questions || 0)}</b></div><div><small>Thời gian</small><b>${exam.duration_minutes || "—"} phút</b></div><div><small>Số lần làm</small><b>${exam.max_attempts || 1}</b></div><div><small>Lượt đã tạo</small><b>${attempts.length}</b></div><div><small>Rút câu</small><b>${escapeHtml(modeLabel(exam.question_mode))}</b></div><div><small>Cấu trúc</small><b>${escapeHtml(structureLabel(exam.structure_mode))}</b></div></div></section><section class="panel"><div class="panel-head"><div><h3>Cấu trúc và bộ câu</h3><p class="hint">Làm thử đọc trực tiếp frozen snapshot; không tạo lượt làm và không ghi điểm.</p></div></div><div id="v122DesignSummary"></div></section><section class="panel"><div class="panel-head"><div><h3>Danh sách bài làm</h3><p class="hint">Xem từng bài đã nộp hoặc xóa một lượt làm khi cần.</p></div></div><div id="v122AttemptList">${attemptTableHtml(attempts, clos)}</div></section></div>`;
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
          bindAttemptTable(exam, attempts, clos, "date");
          await renderDesignSummary(exam);
        } catch (e) {
          showError(e);
        }
      }
      function bindAttemptTable(exam, attempts, clos, mode) {
        const box = qs("#v122AttemptList");
        if (!box) return;
        const sort = qs("#v122AttemptSort", box);
        if (sort)
          sort.onchange = () => {
            box.innerHTML = attemptTableHtml(attempts, clos, sort.value);
            bindAttemptTable(exam, attempts, clos, sort.value);
          };
        qsa("[data-v1234-export]", box).forEach((b) => {
          b.onclick = () => exportAttemptExcel(exam, attempts, clos, b.dataset.v1234Export, b);
        });
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
