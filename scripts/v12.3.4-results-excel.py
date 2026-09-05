from pathlib import Path

p=Path('js/core/office-libs.js')
s=p.read_text(encoding='utf-8')
s=s.replace(" zip:'https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js'"," zip:'https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js',\n exceljs:'https://cdn.jsdelivr.net/npm/exceljs@4.4.0/dist/exceljs.min.js'")
s=s.replace("const ready=kind=>kind==='xlsx'?!!window.XLSX:!!window.JSZip;","const ready=kind=>kind==='xlsx'?!!window.XLSX:kind==='zip'?!!window.JSZip:!!window.ExcelJS;")
s=s.replace("  script.onload=()=>ready(kind)?resolve(kind==='xlsx'?window.XLSX:window.JSZip):reject(new Error(`Không khởi tạo được thư viện ${kind}.`));","  script.onload=()=>ready(kind)?resolve(kind==='xlsx'?window.XLSX:kind==='zip'?window.JSZip:window.ExcelJS):reject(new Error(`Không khởi tạo được thư viện ${kind}.`));")
s=s.replace(" zip:()=>load('zip'),"," zip:()=>load('zip'),\n exceljs:()=>load('exceljs'),")
p.write_text(s,encoding='utf-8')

p=Path('js/assessment/online-lifecycle.js')
s=p.read_text(encoding='utf-8')
s=s.replace('/* AI-CLO PTITHCM V12.3 — Online Assessment Lifecycle module. */','/* AI-CLO PTITHCM V12.3.4 — Online Assessment Lifecycle module. */',1)
insert_at=s.index('      function attemptTableHtml(rows, mode = "date") {')
end=s.index('      async function openExamDetail(examOrId) {', insert_at)
replacement=r'''      async function loadAttemptCloBundle(exam, attempts) {
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
'''
s=s[:insert_at]+replacement+s[end:]

s=s.replace('          const attempts = await loadExamAttempts(exam.id),\n            c = getAssessmentRoot();','          const rawAttempts = await loadExamAttempts(exam.id),\n            bundle = await loadAttemptCloBundle(exam, rawAttempts),\n            attempts = bundle.attempts,\n            clos = bundle.clos,\n            c = getAssessmentRoot();',1)
s=s.replace('${attemptTableHtml(attempts)}</div></section></div>`;','${attemptTableHtml(attempts, clos)}</div></section></div>`;',1)
s=s.replace('          bindAttemptTable(exam, attempts, "date");','          bindAttemptTable(exam, attempts, clos, "date");',1)
s=s.replace('      function bindAttemptTable(exam, attempts, mode) {','      function bindAttemptTable(exam, attempts, clos, mode) {',1)
s=s.replace('            box.innerHTML = attemptTableHtml(attempts, sort.value);\n            bindAttemptTable(exam, attempts, sort.value);','            box.innerHTML = attemptTableHtml(attempts, clos, sort.value);\n            bindAttemptTable(exam, attempts, clos, sort.value);',1)
needle='''        qsa("[data-v122-view-attempt]", box).forEach(\n'''
extra='''        qsa("[data-v1234-export]", box).forEach((b) => {\n          b.onclick = () => exportAttemptExcel(exam, attempts, clos, b.dataset.v1234Export, b);\n        });\n'''
s=s.replace(needle,extra+needle,1)
p.write_text(s,encoding='utf-8')

p=Path('css/exams/detail-enhancements.css')
css=p.read_text(encoding='utf-8')+r'''\n/* V12.3.4 — attempt CLO table and Excel export */\n.assessment-attempt-toolbar{align-items:flex-end}.assessment-attempt-tools{display:flex;gap:10px;align-items:flex-end;flex-wrap:wrap}.assessment-export-dropdown{position:relative}.assessment-export-dropdown summary{list-style:none;cursor:pointer;user-select:none}.assessment-export-dropdown summary::-webkit-details-marker{display:none}.assessment-export-menu{position:absolute;right:0;top:calc(100% + 6px);z-index:20;min-width:210px;padding:6px;background:#fff;border:1px solid var(--border,#e4e7ec);border-radius:10px;box-shadow:0 10px 28px #0002}.assessment-export-menu button{display:block;width:100%;text-align:left;border:0;background:transparent;padding:9px 10px;border-radius:7px;cursor:pointer}.assessment-export-menu button:hover{background:var(--soft,#f8fafc)}.attempt-time-cell small{display:block;white-space:nowrap}.score-below{color:#a61d2d}.assessment-attempt-table th,.assessment-attempt-table td{vertical-align:middle}.assessment-attempt-table td:nth-child(n+5){text-align:center}\n@media(max-width:800px){.assessment-attempt-toolbar{align-items:stretch;flex-direction:column}.assessment-attempt-tools{width:100%}.assessment-export-dropdown{flex:1}.assessment-export-dropdown summary{width:100%;box-sizing:border-box;text-align:center}.assessment-export-menu{left:0;right:auto;min-width:100%}.attempt-time-cell small{white-space:normal}}\n'''
p.write_text(css,encoding='utf-8')

p=Path('app.html')
s=p.read_text(encoding='utf-8')
s=s.replace('js/core/office-libs.js','js/core/office-libs.js?v=12.3.4',1)
s=s.replace('css/exams/detail-enhancements.css?v=11.6.23','css/exams/detail-enhancements.css?v=12.3.4',1)
for name in ['common','online-lifecycle','online-builder','student-attempt','results','final-exam']:
    import re
    s=re.sub(rf'js/assessment/{name}\.js\?v=[0-9.]+',f'js/assessment/{name}.js?v=12.3.4',s)
s=s.replace('js/assessment.js?v=12.3.1','js/assessment.js?v=12.3.4')
p.write_text(s,encoding='utf-8')

p=Path('js/assessment.js')
s=p.read_text(encoding='utf-8').replace('const VERSION = "12.3.1";','const VERSION = "12.3.4";',1)
p.write_text(s,encoding='utf-8')
