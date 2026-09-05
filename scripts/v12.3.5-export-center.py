from pathlib import Path

p=Path('js/assessment/online-lifecycle.js')
s=p.read_text(encoding='utf-8')
s=s.replace('/* AI-CLO PTITHCM V12.3 — Online Assessment Lifecycle module. */','/* AI-CLO PTITHCM V12.3.5 — Online Assessment Lifecycle module. */',1)
old='<button id="v122Preview" class="secondary">Làm thử</button>${detailActions(exam)}'
assert old in s
s=s.replace(old,'<button id="v122Preview" class="secondary">Làm thử</button><button id="v1235ExportCenter" class="secondary">Xuất đề / Tạo mã đề</button>${detailActions(exam)}',1)
old_bind='''          qs("#v122Preview")?.addEventListener("click", () =>\n            openTeacherPreview(exam),\n          );\n'''
assert old_bind in s
new_bind=old_bind+'''          qs("#v1235ExportCenter")?.addEventListener("click", () =>\n            openExportCenter(exam),\n          );\n'''
s=s.replace(old_bind,new_bind,1)
anchor='      async function renderDesignSummary(exam) {'
assert anchor in s
insert=r'''      function exportCodes(start, count) {
        const raw = String(start || "101").trim() || "101";
        const width = raw.length;
        const n = Math.max(1, Math.min(20, Number(count) || 1));
        if (!/^\d+$/.test(raw)) return Array.from({ length: n }, (_, i) => `${raw}${i ? `-${i + 1}` : ""}`);
        const first = Number(raw);
        return Array.from({ length: n }, (_, i) => String(first + i).padStart(width, "0"));
      }
      function parseExportCodes(value) {
        return [...new Set(String(value || "").split(/[\s,;]+/).map((x) => x.trim()).filter(Boolean))].slice(0, 20);
      }
      async function loadExportSnapshot(exam) {
        const [subjectRes, chosenRes, poolRes] = await Promise.all([
          db.from("subjects").select("*").eq("id", exam.subject_id).maybeSingle(),
          db.from("exam_questions").select("question_id,question_order").eq("exam_id", exam.id).order("question_order"),
          db.from("exam_question_pool").select("question_id,chapter_name,topic_name,clo_code,content,correct_answer,explanation,options").eq("exam_id", exam.id),
        ]);
        if (chosenRes.error) throw chosenRes.error;
        if (poolRes.error) throw poolRes.error;
        const chosen = chosenRes.data || [], pool = poolRes.data || [];
        if (!chosen.length) throw new Error("Bài kiểm tra chưa có frozen snapshot để xuất đề.");
        const ids = chosen.map((x) => x.question_id).filter(Boolean);
        let codes = new Map();
        if (ids.length) {
          const qr = await db.from("questions").select("id,display_code").in("id", ids);
          if (!qr.error) codes = new Map((qr.data || []).map((x) => [x.id, x.display_code]));
        }
        const byId = new Map(pool.map((x) => [x.question_id, x]));
        const questions = chosen.map((x) => {
          const q = byId.get(x.question_id);
          if (!q) return null;
          return { ...q, display_code: codes.get(x.question_id) || "", question_order: x.question_order };
        }).filter(Boolean);
        if (!questions.length) throw new Error("Không đọc được nội dung frozen snapshot của bài kiểm tra.");
        return { exam, subject: subjectRes.data || {}, questions };
      }
      async function openExportCenter(exam) {
        try {
          const api = window.AICLO_ONLINE_EXPORT;
          if (!api) throw new Error("Chưa tải mô-đun Xuất đề.");
          const snap = await loadExportSnapshot(exam), c = getAssessmentRoot();
          if (!c) return;
          const state = {
            start: "101",
            count: 4,
            codes: exportCodes("101", 4),
            shuffleQuestions: !!exam.shuffle_questions,
            shuffleOptions: !!exam.shuffle_options,
            printRows: 4,
            previewCode: "101",
          };
          const render = () => {
            const variants = api.buildVariants(snap.questions, state.codes, { shuffleQuestions: state.shuffleQuestions, shuffleOptions: state.shuffleOptions });
            const current = variants.find((v) => v.code === state.previewCode) || variants[0];
            if (current) state.previewCode = current.code;
            const subjectCode = snap.subject?.code || snap.subject?.subject_code || "—";
            c.innerHTML = `<div class="assessment-export-center"><div class="subpage-head"><div><button id="v1235ExportBack" class="secondary compact">← Quay lại</button><small>XUẤT ĐỀ / TẠO MÃ ĐỀ</small><h3>${escapeHtml(exam.title || "Bài kiểm tra")}</h3><p>Tạo các mã đề từ frozen snapshot hiện tại; không rút câu mới và không thay đổi bài kiểm tra trên hệ thống.</p></div><span class="badge">${variants.length} mã đề</span></div>
              <div class="export-grid"><section class="panel export-controls"><div class="panel-head"><div><h3>Thiết lập xuất đề</h3><p class="hint">Mỗi mã đề là một phép hoán vị ổn định từ cùng bộ câu đã duyệt.</p></div></div>
                <div class="export-code-row"><label class="field">Mã bắt đầu<input id="v1235CodeStart" value="${escapeHtml(state.start)}"></label><label class="field">Số mã đề<input id="v1235CodeCount" type="number" min="1" max="20" value="${state.count}"></label><div class="field"><span>Tạo mã</span><button id="v1235GenerateCodes" type="button" class="secondary">Tạo danh sách</button></div><label class="field wide">Danh sách mã đề<input id="v1235CodeList" value="${escapeHtml(state.codes.join(", "))}" placeholder="101, 102, 103, 104"></label></div>
                <div class="export-options"><label><input id="v1235ShuffleQuestions" type="checkbox" ${state.shuffleQuestions ? "checked" : ""}> Trộn thứ tự câu</label><label><input id="v1235ShuffleOptions" type="checkbox" ${state.shuffleOptions ? "checked" : ""}> Trộn đáp án</label></div>
                <label class="field">Bố cục bản in đáp án Excel<select id="v1235PrintRows"><option value="1" ${state.printRows===1?"selected":""}>1 dòng/khối</option><option value="2" ${state.printRows===2?"selected":""}>2 dòng/khối</option><option value="4" ${state.printRows===4?"selected":""}>4 dòng/khối</option></select></label>
                <div class="export-note">Excel luôn có sheet <b>Dap_an</b> theo cấu trúc dùng cho Chấm thi CLO. Tùy chọn 1/2/4 chỉ thay đổi sheet <b>Ban_in</b> để tiết kiệm giấy.</div>
                <div><b>Mã đề</b><div class="export-code-list">${variants.map((v) => `<button type="button" class="export-code-chip ${v.code===state.previewCode?"active":""}" data-v1235-code="${escapeHtml(v.code)}">${escapeHtml(v.code)}</button>`).join("")}</div></div>
                <div class="export-actions"><button id="v1235DownloadTex" class="secondary" ${current?"":"disabled"}>Tải TeX mã đang xem</button><button id="v1235DownloadExcel" class="secondary" ${variants.length?"":"disabled"}>Tải Excel đáp án + CLO</button><button id="v1235DownloadZip" class="primary" ${variants.length?"":"disabled"}>Tải ZIP toàn bộ</button></div>
              </section>
              <section class="panel export-preview"><div class="panel-head"><div><h3>Xem trước mã đề ${escapeHtml(current?.code || "—")}</h3><p class="hint">${escapeHtml(snap.subject?.name || "Học phần")} · ${escapeHtml(subjectCode)}</p></div></div>${current ? `<div class="export-paper"><div class="export-paper-head"><b>BÀI KIỂM TRA</b><h3>${escapeHtml(exam.title || "")}</h3><div class="export-paper-meta"><span><b>Học phần:</b> ${escapeHtml(snap.subject?.name || "—")}</span><span><b>Mã HP:</b> ${escapeHtml(subjectCode)}</span><span><b>Mã đề:</b> ${escapeHtml(current.code)}</span><span><b>Thời gian:</b> ${escapeHtml(exam.duration_minutes || "—")} phút</span></div></div>${current.questions.map((q) => `<article class="export-question"><div class="export-question-head"><b>Câu ${q.number}.</b><span class="badge red">${escapeHtml(q.clo_code || "—")}</span>${q.display_code?`<span class="badge">${escapeHtml(q.display_code)}</span>`:""}<small>Đáp án: ${escapeHtml(q.correct_answer || "—")}</small></div><div class="detail-question">${escapeHtml(q.content || "")}</div><div class="export-question-options">${(q.options||[]).map((o)=>`<div><b>${escapeHtml(o.key)}.</b><span>${escapeHtml(o.content||"")}</span></div>`).join("")}</div></article>`).join("")}</div>` : '<div class="empty"><b>Chưa có mã đề</b><span>Tạo ít nhất một mã đề để xem trước.</span></div>'}</section></div></div>`;
            qs("#v1235ExportBack", c)?.addEventListener("click", () => openExamDetail(exam));
            qs("#v1235GenerateCodes", c)?.addEventListener("click", () => { state.start = qs("#v1235CodeStart",c)?.value || "101"; state.count = Math.max(1,Math.min(20,Number(qs("#v1235CodeCount",c)?.value)||1)); state.codes = exportCodes(state.start,state.count); state.previewCode = state.codes[0] || ""; render(); });
            qs("#v1235CodeList", c)?.addEventListener("change", (e) => { const next=parseExportCodes(e.target.value); if(!next.length)return notify("Cần ít nhất một mã đề.",true); state.codes=next; state.previewCode=next.includes(state.previewCode)?state.previewCode:next[0]; render(); });
            qs("#v1235ShuffleQuestions", c)?.addEventListener("change", (e) => { state.shuffleQuestions=!!e.target.checked; render(); });
            qs("#v1235ShuffleOptions", c)?.addEventListener("change", (e) => { state.shuffleOptions=!!e.target.checked; render(); });
            qs("#v1235PrintRows", c)?.addEventListener("change", (e) => { state.printRows=Number(e.target.value)||4; render(); });
            qsa("[data-v1235-code]", c).forEach((b)=>b.onclick=()=>{state.previewCode=b.dataset.v1235Code;render();});
            qs("#v1235DownloadTex", c)?.addEventListener("click", () => { const v=api.buildVariants(snap.questions,[state.previewCode],{shuffleQuestions:state.shuffleQuestions,shuffleOptions:state.shuffleOptions})[0]; if(!v)return; api.download(`% !TeX encoding = UTF-8\n${api.texForVariant(snap,v)}`,`${api.safe(exam.title)}-${api.safe(v.code)}.tex`,'text/x-tex;charset=utf-8'); });
            qs("#v1235DownloadExcel", c)?.addEventListener("click", async (e) => { const btn=e.currentTarget,old=btn.textContent;try{btn.disabled=true;btn.textContent="Đang tạo Excel…";const vs=api.buildVariants(snap.questions,state.codes,{shuffleQuestions:state.shuffleQuestions,shuffleOptions:state.shuffleOptions});await api.downloadWorkbook(snap,vs,state.printRows);}catch(err){showError(err)}finally{btn.disabled=false;btn.textContent=old;} });
            qs("#v1235DownloadZip", c)?.addEventListener("click", async (e) => { const btn=e.currentTarget,old=btn.textContent;try{btn.disabled=true;btn.textContent="Đang tạo ZIP…";const vs=api.buildVariants(snap.questions,state.codes,{shuffleQuestions:state.shuffleQuestions,shuffleOptions:state.shuffleOptions});await api.downloadZip(snap,vs,state.printRows);}catch(err){showError(err)}finally{btn.disabled=false;btn.textContent=old;} });
            if (typeof window.renderMath === "function") requestAnimationFrame(() => window.renderMath(c));
          };
          render();
        } catch (e) { showError(e); }
      }
'''
s=s.replace(anchor,insert+anchor,1)
p.write_text(s,encoding='utf-8')

p=Path('app.html')
s=p.read_text(encoding='utf-8')
css_anchor='<link rel="stylesheet" href="css/exams/unified-builder.css?v=12.3.3">'
assert css_anchor in s
s=s.replace(css_anchor,css_anchor+'<link rel="stylesheet" href="css/exams/online-export.css?v=12.3.5">',1)
script_anchor='<script defer src="js/assessment/common.js?v=12.3.1"></script>'
assert script_anchor in s
s=s.replace(script_anchor,'<script defer src="js/exams/online-export.js?v=12.3.5"></script>'+script_anchor,1)
s=s.replace('js/assessment/online-lifecycle.js?v=12.3.4','js/assessment/online-lifecycle.js?v=12.3.5',1)
p.write_text(s,encoding='utf-8')
