from pathlib import Path

p=Path('js/assessment/online-builder.js')
s=p.read_text(encoding='utf-8')
s=s.replace('/* AI-CLO PTITHCM V12.3.2 — Online Assessment Builder module. */','/* AI-CLO PTITHCM V12.3.3 — Online Assessment Builder module. */',1)
s=s.replace('          selectedTopics: new Set(exam?.topic_ids || []),\n          matrix:', '          selectedTopics: new Set(exam?.topic_ids || []),\n          expandedChapters: new Set(exam?.chapter_ids || []),\n          matrix:',1)
start=s.index('      function builderStructure(ctx) {')
end=s.index('      function optionMap(q) {', start)
replacement=r'''      function builderStructure(ctx) {
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
'''
s=s[:start]+replacement+s[end:]
# Expand newly selected chapters and bind collapse toggles.
s=s.replace('              if (el.checked) {\n                ctx.selectedChapters.add(id);\n                topics.forEach((t) => ctx.selectedTopics.add(t.id));', '              if (el.checked) {\n                ctx.selectedChapters.add(id);\n                ctx.expandedChapters.add(id);\n                topics.forEach((t) => ctx.selectedTopics.add(t.id));',1)
s=s.replace('              } else {\n                ctx.selectedChapters.delete(id);\n                topics.forEach((t) => ctx.selectedTopics.delete(t.id));', '              } else {\n                ctx.selectedChapters.delete(id);\n                ctx.expandedChapters.delete(id);\n                topics.forEach((t) => ctx.selectedTopics.delete(t.id));',1)
anchor='''        qsa("[data-v122-topic]", c).forEach(\n'''
insert='''        qsa("[data-v123-chapter-toggle]", c).forEach((el) => {\n          el.onclick = () => {\n            const id = el.dataset.v123ChapterToggle;\n            if (ctx.expandedChapters.has(id)) ctx.expandedChapters.delete(id);\n            else ctx.expandedChapters.add(id);\n            renderBuilder(ctx);\n          };\n        });\n'''
assert anchor in s
s=s.replace(anchor,insert+anchor,1)
p.write_text(s,encoding='utf-8')

# CSS: replace prior V12.3.2 appendix with V12.3.3 structure styles appended.
p=Path('css/exams/unified-builder.css')
css=p.read_text(encoding='utf-8')
append=r'''
/* V12.3.3 — Assessment structure redesign */
.ub-structure-panel{display:grid;gap:16px}.ub-structure-panel>.panel-head{margin-bottom:0}.ub-structure-block{border:1px solid var(--border,#e4e7ec);border-radius:12px;padding:14px;background:#fff}.ub-structure-block>h4,.ub-structure-block-head h4{margin:0 0 8px}.ub-structure-block-head{display:flex;justify-content:space-between;align-items:flex-start;gap:14px;margin-bottom:10px}.ub-structure-block-head span{font-size:.86rem;color:var(--muted,#667085)}.ub-structure-segmented{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.ub-structure-segmented label{position:relative;display:grid;gap:3px;padding:11px 12px;border:1px solid var(--border,#e4e7ec);border-radius:10px;cursor:pointer;background:var(--soft,#f8fafc)}.ub-structure-segmented label.active{border-color:var(--red,#a61d2d);box-shadow:0 0 0 1px var(--red,#a61d2d);background:#fff}.ub-structure-segmented input{position:absolute;opacity:0;pointer-events:none}.ub-structure-segmented span{font-weight:700}.ub-structure-segmented small{color:var(--muted,#667085);line-height:1.4}.ub-structure-chapters{display:grid;gap:9px}.ub-structure-chapter{border:1px solid var(--border,#e4e7ec);border-radius:10px;background:var(--soft,#f8fafc);overflow:hidden}.ub-structure-chapter.selected{background:#fff;border-color:#d8dde6}.ub-structure-chapter-head{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 12px}.ub-chapter-main{display:flex;align-items:flex-start;gap:9px;min-width:0;flex:1}.ub-chapter-main>span{display:grid;gap:2px;min-width:0}.ub-chapter-main small{color:var(--muted,#667085);font-weight:400}.ub-chapter-toggle{flex:0 0 auto}.ub-structure-topic-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px 10px;padding:10px 12px 12px;border-top:1px solid var(--border,#e4e7ec);background:#fff}.ub-topic-item{display:flex;align-items:flex-start;gap:7px;padding:8px 9px;border:1px solid #edf0f4;border-radius:8px;line-height:1.35;min-width:0}.ub-topic-item span{overflow-wrap:anywhere}.ub-matrix-block{padding:0;overflow:hidden}.ub-matrix-block>.ub-structure-block-head{padding:14px 14px 4px;margin-bottom:6px}.ub-matrix-table{width:100%;overflow-x:auto}.ub-matrix-table table{width:100%;border-collapse:collapse}.ub-matrix-table th,.ub-matrix-table td{padding:10px;border-top:1px solid var(--border,#e4e7ec);vertical-align:middle}.ub-matrix-table thead th{background:var(--soft,#f8fafc);white-space:nowrap}.ub-matrix-table td:first-child,.ub-matrix-table th:first-child{text-align:left}.ub-matrix-table .matrix-chapter td{background:#f8fafc}.ub-matrix-table .matrix-chapter small{margin-left:8px;color:var(--muted,#667085);font-weight:400}.ub-matrix-cell{display:flex;align-items:center;justify-content:center;gap:7px;white-space:nowrap}.ub-matrix-cell input{width:62px;text-align:center;padding:7px 5px}.ub-matrix-cell span{font-size:.82rem;color:var(--muted,#667085)}.ub-matrix-total{text-align:center}.ub-matrix-data-row>td:first-child small{display:block;margin-top:3px;color:var(--muted,#667085);font-weight:400}.matrix-grand td{background:#fafafa}
@media(max-width:980px){.ub-structure-topic-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:700px){.ub-structure-panel{gap:12px}.ub-structure-segmented{grid-template-columns:1fr}.ub-structure-topic-grid{grid-template-columns:1fr}.ub-structure-block-head{display:grid;gap:4px}.ub-matrix-table{overflow:visible}.ub-matrix-table table,.ub-matrix-table tbody{display:block;width:100%}.ub-matrix-table thead{display:none}.ub-matrix-table tr{display:block}.ub-matrix-table .matrix-chapter td{display:block;border-top:1px solid var(--border,#e4e7ec);padding:10px 12px}.ub-matrix-table .ub-matrix-data-row{margin:0 10px 10px;border:1px solid var(--border,#e4e7ec);border-radius:10px;overflow:hidden;background:#fff}.ub-matrix-table .ub-matrix-data-row td{display:grid;grid-template-columns:minmax(86px,.8fr) minmax(0,1.2fr);align-items:center;gap:8px;border-top:1px solid #edf0f4;padding:9px 10px;text-align:left}.ub-matrix-table .ub-matrix-data-row td:first-child{display:block;border-top:0;background:#fafafa}.ub-matrix-table .ub-matrix-data-row td:not(:first-child)::before{content:attr(data-label);font-weight:700}.ub-matrix-cell{justify-content:flex-start;white-space:normal}.ub-matrix-total{text-align:left}.ub-matrix-table .matrix-grand{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:0;margin-top:8px;border-top:1px solid var(--border,#e4e7ec)}.ub-matrix-table .matrix-grand td{display:grid;gap:2px;padding:9px 10px;border:0;border-right:1px solid #edf0f4;border-bottom:1px solid #edf0f4;text-align:left}.ub-matrix-table .matrix-grand td:not(:first-child)::before{content:attr(data-label);font-size:.76rem;color:var(--muted,#667085)}.ub-structure-chapter-head{align-items:flex-start}.ub-chapter-toggle{font-size:.78rem}}
'''
css += append
p.write_text(css,encoding='utf-8')

# Cache keys only for modified assets.
p=Path('app.html')
h=p.read_text(encoding='utf-8')
h=h.replace('css/exams/unified-builder.css?v=12.3.2','css/exams/unified-builder.css?v=12.3.3')
h=h.replace('js/assessment/online-builder.js?v=12.3.2','js/assessment/online-builder.js?v=12.3.3')
p.write_text(h,encoding='utf-8')
