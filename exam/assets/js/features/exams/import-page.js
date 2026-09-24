import { getPaperWorkspace,addQuestion } from '../../services/papers.js';
import { storageService } from '../../services/storage.js';
import { readFirstSheet,pick } from '../../services/spreadsheet.js';
import { mountRichEditor } from '../../components/rich-editor.js';
import { sanitizeHtml } from '../../core/sanitize.js';
import { typesetMath } from '../../core/math.js';
import { hasPermission } from '../../core/permissions.js';
import { loadUiState,saveUiState } from '../../state.js';
import { escapeHtml,toast,setBusy,errorMessage,confirmDialog } from '../../core/ui.js';
import { parseDocxQuestions,parseTexQuestions } from './importer.js';

const KEYS=['A','B','C','D'];

function normalizeClo(value){
  const raw=String(value??'').trim().toUpperCase();
  if(!raw)return '';
  const m=raw.match(/CLO\s*[:=\-]?\s*(?:CLO\s*)?(\d+)/i);
  if(m)return `CLO${m[1]}`;
  return /^\d+$/.test(raw)?`CLO${Number(raw)}`:raw;
}
function normalizeAnswer(value){const m=String(value||'').toUpperCase().match(/\b([A-D])\b/);return m?m[1]:'';}
function normalizeQuestionNo(value){const m=String(value??'').match(/\d+/);return m?Number(m[0]):null;}
function textHtml(value){return escapeHtml(String(value||'')).replace(/\n/g,'<br>');}
function unique(items){return [...new Set((items||[]).filter(Boolean))];}
function cleanParserWarnings(items){return unique((items||[]).filter(x=>!/Chưa nhận CLO|Chưa có CLO/i.test(String(x))));}

function fromParsed(q,index){
  const choices=KEYS.map(k=>{
    const c=(q.choices||[]).find(x=>x.key===k)||{};
    return {key:k,html:c.html||textHtml(c.text||'')};
  });
  return {
    sourceNo:Number(q.sourceNo)||index+1,
    include:q.include!==false,
    bodyHtml:q.bodyHtml||textHtml(q.body||''),
    choices,
    correct:q.correct||'',
    clo:normalizeClo(q.clo||''),
    points:Number(q.points??1),
    answerSource:q.answerSource||'',
    cloSource:q.cloSource||'',
    reviewWarnings:cleanParserWarnings(q.reviewWarnings||q.warnings),
    conflicts:Array.isArray(q.conflicts)?q.conflicts:[],
    format:q.format||''
  };
}

async function parseAnswerFile(file){
  const rows=await readFirstSheet(file),out=[],issues=[],seen=new Set();
  for(let i=0;i<rows.length;i++){
    const row=rows[i];
    const no=normalizeQuestionNo(pick(row,['Câu','Cau','Question','Số câu','So cau','STT']));
    const answer=normalizeAnswer(pick(row,['Đáp án','Dap an','Answer','ĐA','DA']));
    const clo=normalizeClo(pick(row,['CLO','Clo','Chuẩn đầu ra','Chuan dau ra']));
    if(no===null&&!answer&&!clo)continue;
    if(no===null){issues.push(`Dòng ${i+2}: thiếu số câu.`);continue;}
    if(seen.has(no)){issues.push(`Dòng ${i+2}: câu ${no} bị lặp trong Excel.`);continue;}
    seen.add(no);
    if(!answer)issues.push(`Dòng ${i+2}: câu ${no} chưa có đáp án A–D.`);
    out.push({sourceNo:no,answer,clo,rowNo:i+2});
  }
  if(!out.length)throw new Error('Excel chưa có dữ liệu hợp lệ. Cần các cột Câu, Đáp án; cột CLO được phép để trống.');
  if(issues.some(x=>/bị lặp/.test(x)))throw new Error(issues.filter(x=>/bị lặp/.test(x)).join(' '));
  return {rows:out,issues};
}

function mergeExcel(rows,answerRows){
  const byNo=new Map(rows.map(q=>[Number(q.sourceNo),q])),unmatched=[];
  for(const x of answerRows){
    const q=byNo.get(Number(x.sourceNo));if(!q){unmatched.push(x.sourceNo);continue;}
    q.conflicts=(q.conflicts||[]).filter(c=>!['correct','clo'].includes(c.field));
    if(x.answer){
      if(q.correct&&q.correct!==x.answer)q.conflicts.push({field:'correct',message:`Đáp án Excel (${x.answer}) khác ${q.answerSource||q.format?.toUpperCase()||'file đề'} (${q.correct}); đang ưu tiên Excel.`});
      q.correct=x.answer;q.answerSource='Excel';
    }
    if(x.clo){
      if(q.clo&&q.clo!==x.clo)q.conflicts.push({field:'clo',message:`CLO Excel (${x.clo}) khác ${q.cloSource||q.format?.toUpperCase()||'file đề'} (${q.clo}); đang ưu tiên Excel.`});
      q.clo=x.clo;q.cloSource='Excel';
    }
  }
  return unmatched;
}

function structuralWarnings(q){
  const out=[];
  if(!String(q.bodyHtml||'').replace(/<[^>]+>/g,'').trim())out.push('Thiếu nội dung câu hỏi');
  if((q.choices||[]).some(x=>!String(x.html||'').replace(/<[^>]+>/g,'').trim()))out.push('Có lựa chọn trống');
  if(!KEYS.includes(q.correct))out.push('Chưa chọn đáp án đúng');
  return out;
}
function allWarnings(q){return unique([...structuralWarnings(q),...(q.reviewWarnings||[]),...(q.conflicts||[]).map(x=>x.message)]);}

function matrixHtml(rows){
  const map=new Map();
  for(const q of rows.filter(x=>x.include)){
    const key=q.clo||'Không gán CLO',v=map.get(key)||{count:0,points:0};v.count++;v.points+=Number(q.points||0);map.set(key,v);
  }
  return `<div class="table-wrap"><table class="table"><thead><tr><th>CLO</th><th>Số câu</th><th>Tổng điểm</th></tr></thead><tbody>${[...map.entries()].sort(([a],[b])=>a.localeCompare(b,undefined,{numeric:true})).map(([k,v])=>`<tr><td>${escapeHtml(k)}</td><td>${v.count}</td><td>${Number(v.points.toFixed(2))}</td></tr>`).join('')}</tbody></table></div>`;
}

function cardShell(q,index){
  const warnings=allWarnings(q);
  return `<article class="card import-page-question" data-index="${index}" style="margin-bottom:14px;scroll-margin-top:150px">
    <div class="toolbar">
      <div class="row wrap"><label class="choice-row"><input type="checkbox" data-include ${q.include?'checked':''}><strong>Câu ${escapeHtml(q.sourceNo)}</strong></label><span class="badge ${warnings.length?'badge-warning':'badge-success'}" data-status>${warnings.length?'Cần kiểm tra':'Hợp lệ'}</span></div>
      <div class="row wrap">
        <div class="field" style="min-width:145px"><label>CLO <span class="muted">(tùy chọn)</span></label><input class="input" data-clo value="${escapeHtml(q.clo||'')}" placeholder="CLO1"><div class="muted" data-clo-source>${q.cloSource?`Nguồn: ${escapeHtml(q.cloSource)}`:'Có thể để trống'}</div></div>
        <div class="field" style="width:110px"><label>Điểm</label><input class="input" data-points type="number" min="0" step="0.25" value="${Number(q.points??1)}"></div>
        <div class="field" style="width:150px"><label>Đáp án đúng</label><select class="select" data-correct><option value="">-- Chọn --</option>${KEYS.map(k=>`<option value="${k}" ${q.correct===k?'selected':''}>${k}</option>`).join('')}</select><div class="muted" data-answer-source>${q.answerSource?`Nguồn: ${escapeHtml(q.answerSource)}`:''}</div></div>
      </div>
    </div>
    <div data-warning-box>${warnings.length?`<div class="alert alert-warning">${warnings.map(escapeHtml).join(' · ')}</div>`:''}</div>
    <div class="field"><label>Nội dung câu hỏi</label><div data-body-editor></div></div>
    <div class="form-grid">${KEYS.map(k=>`<div class="field"><label>Lựa chọn ${k}</label><div data-choice-editor="${k}"></div></div>`).join('')}</div>
    <details data-preview-wrap><summary>Xem trước câu hỏi</summary><div class="question-card" data-preview style="margin-top:10px"></div></details>
  </article>`;
}

function paintPreview(card,q){
  const host=card.querySelector('[data-preview]');
  host.innerHTML=`<div style="line-height:1.65">${q.bodyHtml||''}</div><div class="choice-grid" style="margin-top:10px">${q.choices.map(c=>`<div class="choice-row"><span class="choice-key">${c.key}</span><div class="grow">${c.html||''}</div>${q.correct===c.key?'<span class="badge badge-success">Đúng</span>':''}</div>`).join('')}</div>`;
  typesetMath(host.querySelectorAll('div')).catch(()=>{});
}

function numberingWarnings(rows){
  const nums=rows.map(x=>Number(x.sourceNo)).filter(Number.isFinite),out=[],seen=new Set();
  for(const n of nums){if(seen.has(n))out.push(`Trùng số câu ${n}.`);seen.add(n);}
  if(nums.length){const sorted=[...seen].sort((a,b)=>a-b);for(let n=sorted[0];n<sorted[sorted.length-1];n++)if(!seen.has(n))out.push(`Thiếu câu ${n}.`);}
  return out;
}

export async function renderQuestionImportPage(ctx){
  const {host,profile,membership,exam,sessions,root}=ctx;
  if(!hasPermission(profile,membership,'manage_paper')){host.innerHTML='<div class="alert alert-danger">Bạn không có quyền quản lý đề thi.</div>';return;}
  if(!sessions.length){host.innerHTML='<div class="empty-state">Hãy tạo ca thi trước khi nhập đề.</div>';return;}

  const sessionKey=`paper-session:${exam.id}`;
  let sessionId=loadUiState(sessionKey,sessions[0].id);if(!sessions.some(s=>s.id===sessionId))sessionId=sessions[0].id;
  const ws=await getPaperWorkspace(sessionId);
  if(!ws.paper){host.innerHTML=`<div class="empty-state"><h3>Ca này chưa có đề</h3><p>Hãy sang tab Đề thi, tạo đề cho ca này rồi quay lại Nhập đề.</p><button class="btn btn-primary" data-go-paper>Đến Đề thi</button></div>`;host.querySelector('[data-go-paper]')?.addEventListener('click',()=>root.querySelector('[data-tab="paper"]')?.click());return;}
  if(ws.version?.status!=='draft'){host.innerHTML='<div class="alert alert-warning">Phiên bản đề hiện tại đã khóa. Chỉ nhập hàng loạt vào bản nháp.</div>';return;}

  const draftKey=`question-import-page:${exam.id}:${sessionId}:${ws.version.id}`;
  let rows=[],sourceFile=null,answerFile=null,sourceFileName='',answerFileName='',filter='all',persistTimer=null;
  const saved=loadUiState(draftKey,null);

  host.innerHTML=`<div class="stack">
    <div class="card" style="position:sticky;top:8px;z-index:8">
      <div class="toolbar"><div><div class="card-title">Nhập và duyệt câu hỏi</div><div class="muted">Chỉnh trực tiếp bằng rich editor. CLO là tùy chọn.</div></div><div class="row wrap"><button class="btn btn-secondary" data-go-paper>← Đề thi</button><button class="btn btn-secondary" data-save-draft>Lưu nháp</button><button class="btn btn-primary" data-confirm-import disabled>Xác nhận nhập đề</button></div></div>
      <div class="form-grid" style="margin-top:10px">
        <div class="field"><label>Ca thi</label><select class="select" data-session>${sessions.map(s=>`<option value="${s.id}" ${s.id===sessionId?'selected':''}>${escapeHtml(s.name)}</option>`).join('')}</select></div>
        <div class="field"><label>1. File đề Word / TeX</label><input class="input" data-source-file type="file" accept=".docx,.tex"><div class="muted">DOCX hoặc TEX.</div></div>
        <div class="field"><label>2. File Excel đáp án / CLO <span class="muted">(tùy chọn)</span></label><input class="input" data-answer-file type="file" accept=".xlsx,.xls,.csv"><div class="muted">Cột: Câu | Đáp án | CLO. CLO được phép để trống.</div></div>
      </div>
      <div class="row wrap" style="margin-top:10px"><button class="btn btn-secondary" data-filter="all">Tất cả</button><button class="btn btn-secondary" data-filter="warning">Cần kiểm tra</button><button class="btn btn-secondary" data-review>Rà soát đề</button><span class="muted" data-summary>Chưa có câu hỏi.</span></div>
      <div data-global-review></div><div data-matrix style="margin-top:8px"></div>
    </div>
    <div data-list></div>
  </div>`;

  const list=host.querySelector('[data-list]'),summary=host.querySelector('[data-summary]'),globalReview=host.querySelector('[data-global-review]'),matrix=host.querySelector('[data-matrix]'),confirmBtn=host.querySelector('[data-confirm-import]');
  const currentScroll=()=>window.scrollY;
  const saveDraft=()=>saveUiState(draftKey,{rows,sourceFileName,answerFileName,filter,scrollY:currentScroll(),savedAt:Date.now()});
  const scheduleSave=()=>{clearTimeout(persistTimer);persistTimer=setTimeout(saveDraft,160);};
  const syncSummary=()=>{
    const selected=rows.filter(x=>x.include),bad=selected.filter(x=>allWarnings(x).length).length,total=selected.reduce((s,x)=>s+Number(x.points||0),0);
    summary.innerHTML=`Đang chọn <strong>${selected.length}</strong> câu · Tổng điểm <strong>${Number(total.toFixed(2))}</strong>${bad?` · <span class="text-danger">Cần kiểm tra: <strong>${bad}</strong></span>`:''}`;
    matrix.innerHTML=selected.length?matrixHtml(rows):'';confirmBtn.disabled=!selected.length;
  };
  const applyFilter=mode=>{filter=mode;list.querySelectorAll('.import-page-question').forEach(card=>{const q=rows[Number(card.dataset.index)],show=mode==='all'||(mode==='warning'&&allWarnings(q).length);card.style.display=show?'':'none';});scheduleSave();};
  const refreshCardStatus=(card,q)=>{
    const warnings=allWarnings(q),status=card.querySelector('[data-status]'),box=card.querySelector('[data-warning-box]');
    status.textContent=warnings.length?'Cần kiểm tra':'Hợp lệ';status.className=`badge ${warnings.length?'badge-warning':'badge-success'}`;
    box.innerHTML=warnings.length?`<div class="alert alert-warning">${warnings.map(escapeHtml).join(' · ')}</div>`:'';
    card.querySelector('[data-answer-source]').textContent=q.answerSource?`Nguồn: ${q.answerSource}`:'';
    card.querySelector('[data-clo-source]').textContent=q.cloSource?`Nguồn: ${q.cloSource}`:'Có thể để trống';
  };
  const renderRows=()=>{
    list.innerHTML=rows.map(cardShell).join('');
    list.querySelectorAll('.import-page-question').forEach(card=>{
      const index=Number(card.dataset.index),q=rows[index];
      const bodyEditor=mountRichEditor(card.querySelector('[data-body-editor]'),{value:q.bodyHtml,onChange:html=>{q.bodyHtml=html;scheduleSave();refreshCardStatus(card,q);syncSummary();}});
      const choiceEditors=new Map();
      for(const c of q.choices){choiceEditors.set(c.key,mountRichEditor(card.querySelector(`[data-choice-editor="${c.key}"]`),{value:c.html,onChange:html=>{c.html=html;scheduleSave();refreshCardStatus(card,q);syncSummary();}}));}
      card.querySelector('[data-include]').onchange=e=>{q.include=e.target.checked;syncSummary();scheduleSave();};
      card.querySelector('[data-clo]').oninput=e=>{q.clo=normalizeClo(e.target.value);q.cloSource='Giảng viên';q.conflicts=(q.conflicts||[]).filter(x=>x.field!=='clo');refreshCardStatus(card,q);syncSummary();scheduleSave();};
      card.querySelector('[data-points]').oninput=e=>{q.points=Number(e.target.value||0);syncSummary();scheduleSave();};
      card.querySelector('[data-correct]').onchange=e=>{q.correct=e.target.value;q.answerSource='Giảng viên';q.conflicts=(q.conflicts||[]).filter(x=>x.field!=='correct');refreshCardStatus(card,q);syncSummary();scheduleSave();};
      card.querySelector('[data-preview-wrap]').ontoggle=e=>{if(e.currentTarget.open){q.bodyHtml=bodyEditor.getHTML();for(const c of q.choices)c.html=choiceEditors.get(c.key).getHTML();paintPreview(card,q);}};
    });
    applyFilter(filter);syncSummary();
  };

  host.querySelector('[data-go-paper]').onclick=()=>{saveDraft();root.querySelector('[data-tab="paper"]')?.click();};
  host.querySelector('[data-save-draft]').onclick=()=>{saveDraft();toast('Đã lưu bản nháp trên trình duyệt.','success');};
  host.querySelector('[data-session]').onchange=e=>{saveDraft();saveUiState(sessionKey,e.target.value);renderQuestionImportPage(ctx);};
  host.querySelectorAll('[data-filter]').forEach(btn=>btn.onclick=()=>applyFilter(btn.dataset.filter));
  host.querySelector('[data-review]').onclick=()=>{applyFilter('warning');const first=[...list.querySelectorAll('.import-page-question')].find(x=>x.style.display!=='none');if(first){first.scrollIntoView({block:'start'});toast('Đang hiển thị các câu cần kiểm tra.','info');}else toast('Không phát hiện câu cần kiểm tra.','success');};

  host.querySelector('[data-source-file]').onchange=async e=>{
    sourceFile=e.target.files?.[0]||null;if(!sourceFile)return;sourceFileName=sourceFile.name;confirmBtn.disabled=true;globalReview.innerHTML='<div class="alert">Đang phân tích file đề…</div>';
    try{
      const ext=sourceFile.name.toLowerCase().split('.').pop(),parsed=ext==='tex'?parseTexQuestions(await sourceFile.text()):ext==='docx'?await parseDocxQuestions(sourceFile):[];
      if(!parsed.length)throw new Error('Không tìm thấy câu hỏi trong file đề.');
      rows=parsed.map(fromParsed);const numbering=numberingWarnings(rows);globalReview.innerHTML=numbering.length?`<div class="alert alert-warning"><strong>Số thứ tự câu:</strong> ${numbering.map(escapeHtml).join(' · ')}</div>`:`<div class="alert alert-success">Đã nhận ${rows.length} câu từ ${escapeHtml(sourceFile.name)}. Hãy duyệt và chỉnh trực tiếp bên dưới.</div>`;
      filter='all';renderRows();saveDraft();
    }catch(err){globalReview.innerHTML=`<div class="alert alert-danger">${escapeHtml(errorMessage(err))}</div>`;toast(errorMessage(err),'error',6000);}
  };

  host.querySelector('[data-answer-file]').onchange=async e=>{
    answerFile=e.target.files?.[0]||null;if(!answerFile)return;if(!rows.length){toast('Hãy tải file đề Word/TEX trước.','error');e.target.value='';return;}
    answerFileName=answerFile.name;
    try{
      const parsed=await parseAnswerFile(answerFile),unmatched=mergeExcel(rows,parsed.rows),notes=[...parsed.issues];if(unmatched.length)notes.push(`Excel có câu không tìm thấy trong đề: ${unmatched.join(', ')}.`);
      globalReview.innerHTML=notes.length?`<div class="alert alert-warning"><strong>Excel:</strong> ${notes.map(escapeHtml).join(' · ')}</div>`:`<div class="alert alert-success">Đã ghép ${parsed.rows.length} dòng từ ${escapeHtml(answerFile.name)}. Đáp án/CLO Excel được ưu tiên khi có dữ liệu.</div>`;
      renderRows();saveDraft();
    }catch(err){toast(errorMessage(err),'error',6500);}
  };

  confirmBtn.onclick=async e=>{
    const selected=rows.filter(x=>x.include);if(!selected.length)return toast('Chưa chọn câu nào.','error');
    const blocking=selected.flatMap(q=>structuralWarnings(q).map(w=>`Câu ${q.sourceNo}: ${w}`));if(blocking.length)return toast(`Còn ${blocking.length} lỗi bắt buộc cần sửa trước khi nhập. CLO không bắt buộc.`,'error',6000);
    if(!await confirmDialog({title:'Xác nhận nhập đề',message:`Nhập ${selected.length} câu vào bản nháp hiện tại?`,confirmText:'Nhập đề'}))return;
    const btn=e.currentTarget;setBusy(btn,true,'Đang nhập…');
    try{
      if(sourceFile)await storageService.upload({examId:exam.id,file:sourceFile,kind:'source',metadata:{purpose:'import_source',session_id:sessionId}});
      if(answerFile)await storageService.upload({examId:exam.id,file:answerFile,kind:'source',metadata:{purpose:'answer_key',session_id:sessionId,source_file:sourceFileName||null}});
      for(let i=0;i<selected.length;i++){
        const q=selected[i];btn.textContent=`Đang nhập ${i+1}/${selected.length}…`;
        const body=await sanitizeHtml(q.bodyHtml||'');const choices=[];for(const c of q.choices)choices.push({key:c.key,html:await sanitizeHtml(c.html||'')});
        await addQuestion(ws.paper,ws.version,{code:null,group_id:null,group_version_id:null,body_html:body,choices,correct_key:q.correct,points:q.points,metadata:{shuffle_choices:true,clo_code:q.clo||null,import_source:sourceFileName||null,import_format:sourceFileName.toLowerCase().endsWith('.tex')?'tex':'docx',answer_source:q.answerSource||null,clo_source:q.cloSource||null,answer_file:answerFileName||null,source_question_no:q.sourceNo||null}},profile.id);
      }
      saveUiState(draftKey,null);toast(`Đã nhập ${selected.length} câu vào đề.`,'success',5500);root.querySelector('[data-tab="paper"]')?.click();
    }catch(err){toast(errorMessage(err),'error',6500);setBusy(btn,false);}
  };

  if(saved?.rows?.length){
    rows=saved.rows.map((q,i)=>({...fromParsed(q,i),...q,reviewWarnings:cleanParserWarnings(q.reviewWarnings),choices:KEYS.map(k=>q.choices?.find(c=>c.key===k)||{key:k,html:''})}));sourceFileName=saved.sourceFileName||'';answerFileName=saved.answerFileName||'';filter=saved.filter||'all';globalReview.innerHTML=`<div class="alert">Đã khôi phục bản nháp ${rows.length} câu${sourceFileName?` từ ${escapeHtml(sourceFileName)}`:''}. File gốc cần chọn lại nếu muốn lưu kèm lên hệ thống.</div>`;renderRows();requestAnimationFrame(()=>window.scrollTo(0,Number(saved.scrollY||0)));
  }
}
