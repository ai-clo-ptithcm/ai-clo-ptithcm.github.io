/* AI-CLO PTITHCM V12.4.4 — unified quick-edit presentation.
   Business rules remain owned by Questions and Assessment modules; this file only standardizes the window UI. */
(()=>{
'use strict';

const MODE_CLASSES=[
 'app-window-modal',
 'question-source-editor-modal',
 'question-bank-quick-edit-modal',
 'duplicate-scan-quick-edit-modal',
 'assessment-draft-editor-modal'
];
let sourceToken=0;

const esc=value=>String(value??'').replace(/[&<>"']/g,ch=>({
 '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
}[ch]));

function clearModeClasses(dialog){
 if(!dialog)return;
 MODE_CLASSES.forEach(name=>dialog.classList.remove(name));
}
function applyModeClasses(dialog,...classes){
 if(!dialog)return;
 clearModeClasses(dialog);
 dialog.classList.add('app-window-modal',...classes.filter(Boolean));
 dialog.addEventListener('close',()=>clearModeClasses(dialog),{once:true});
}
function contextMarkup(kind){
 if(kind==='duplicate_scan'){
  return '<div class="quick-edit-context duplicate"><b>KIỂM TRA CÂU HỎI TRÙNG</b><span>Thay đổi sẽ cập nhật câu hỏi trong ngân hàng. Sau khi lưu, cặp này được đánh dấu cần kiểm tra lại.</span></div>';
 }
 if(kind==='assessment_draft'){
  return '<div class="quick-edit-context assessment"><b>BẢN NHÁP BÀI KIỂM TRA</b><span>Chỉ áp dụng cho bài kiểm tra này. Ngân hàng câu hỏi không thay đổi.</span></div>';
 }
 return '<div class="quick-edit-context bank"><b>NGÂN HÀNG CÂU HỎI</b><span>Thay đổi sẽ cập nhật trực tiếp câu hỏi trong ngân hàng và được lưu vào lịch sử chỉnh sửa.</span></div>';
}

function waitForSourceEditor(kind,token,started=Date.now()){
 if(token!==sourceToken)return;
 const dialog=document.querySelector('#modal');
 const form=dialog?.querySelector('#quickQuestionForm');
 if(dialog?.open&&form){
  applyModeClasses(
   dialog,
   'question-source-editor-modal',
   kind==='duplicate_scan'?'duplicate-scan-quick-edit-modal':'question-bank-quick-edit-modal'
  );
  if(!form.querySelector('.quick-edit-context')){
   form.insertAdjacentHTML('afterbegin',contextMarkup(kind));
  }
  return;
 }
 if(Date.now()-started<8000)setTimeout(()=>waitForSourceEditor(kind,token,started),50);
}
function queueSourceEditor(kind){
 const token=++sourceToken;
 waitForSourceEditor(kind,token);
}

/* Window capture runs before the Questions document-capture handler, so the source context is known before the async question load completes. */
window.addEventListener('click',event=>{
 const duplicate=event.target.closest?.('[data-edit-duplicate]');
 if(duplicate){queueSourceEditor('duplicate_scan');return;}
 const bank=event.target.closest?.('[data-quick-edit]');
 if(bank)queueSourceEditor('bank');
},true);

function readAssessmentQuickMarkup(html){
 const host=document.createElement('div');
 host.innerHTML=html||'';
 const option=k=>host.querySelector(`[data-v123-edit-option="${k}"]`)?.value||'';
 return {
  content:host.querySelector('#v123EditContent')?.value||'',
  explanation:host.querySelector('#v123EditExplanation')?.value||'',
  correct:host.querySelector('input[name="v123EditCorrect"]:checked')?.value||'A',
  options:Object.fromEntries(['A','B','C','D'].map(k=>[k,option(k)]))
 };
}
function assessmentQuickMarkup(data){
 const correct=String(data.correct||'A').toUpperCase();
 return `<form id="assessmentQuickDraftForm" class="quick-question-form unified-quick-editor" novalidate>
  ${contextMarkup('assessment_draft')}
  <label class="field wide"><span>Nội dung câu hỏi</span><textarea id="v123EditContent" rows="4" required>${esc(data.content)}</textarea></label>
  <div class="quick-answer-grid">${['A','B','C','D'].map(k=>`<label class="field"><span>Phương án ${k}</span><textarea data-v123-edit-option="${k}" rows="2" required>${esc(data.options[k])}</textarea></label>`).join('')}</div>
  <label class="field wide quick-explanation-field"><span>Lời giải</span><textarea id="v123EditExplanation" rows="3">${esc(data.explanation)}</textarea></label>
  <div class="quick-footer-row">
   <label class="field quick-correct-field"><span>Đáp án đúng</span><select id="v123EditCorrectSelect">${['A','B','C','D'].map(k=>`<option value="${k}" ${correct===k?'selected':''}>${k}</option>`).join('')}</select></label>
   <div class="quick-correct-radios" aria-hidden="true">${['A','B','C','D'].map(k=>`<input type="radio" name="v123EditCorrect" value="${k}" ${correct===k?'checked':''}>`).join('')}</div>
   <div class="quick-question-actions"><button id="v123EditCancel" type="button" class="secondary">Hủy</button><button id="v123EditSave" type="button" class="primary">Áp dụng vào bản nháp</button></div>
  </div>
 </form>`;
}
function syncAssessmentCorrect(){
 const select=document.querySelector('#v123EditCorrectSelect');
 if(!select)return;
 const sync=()=>document.querySelectorAll('input[name="v123EditCorrect"]').forEach(radio=>{radio.checked=radio.value===select.value;});
 select.addEventListener('change',sync);sync();
}
function assessmentFieldsValid(){
 const content=document.querySelector('#v123EditContent')?.value.trim()||'';
 const correct=document.querySelector('input[name="v123EditCorrect"]:checked')?.value||'';
 const options=['A','B','C','D'].map(k=>document.querySelector(`[data-v123-edit-option="${k}"]`)?.value.trim()||'');
 return !!content&&!!correct&&options.every(Boolean);
}
function openAssessmentQuickWindow(ctx,title,html,bind){
 if(typeof ctx?.modal!=='function')return false;
 const data=readAssessmentQuickMarkup(html);
 ctx.modal(`AI-CLO | ${title}`,assessmentQuickMarkup(data));
 const dialog=document.querySelector('#modal');
 if(!dialog)return false;
 applyModeClasses(dialog,'assessment-draft-editor-modal');
 if(window.AICLO_APP_WINDOW?.open){
  window.AICLO_APP_WINDOW.open(dialog,{className:'assessment-draft-editor-modal',width:720,height:640});
  dialog.classList.add('app-window-modal');
 }
 syncAssessmentCorrect();
 if(typeof bind==='function')bind();
 document.querySelector('#v123EditCancel')?.addEventListener('click',()=>ctx.closeModal?.());
 document.querySelector('#v123EditSave')?.addEventListener('click',()=>{
  if(assessmentFieldsValid())queueMicrotask(()=>ctx.closeModal?.());
 });
 if(typeof window.renderMath==='function')requestAnimationFrame(()=>window.renderMath(document.querySelector('#modalBody')));
 setTimeout(()=>document.querySelector('#v123EditContent')?.focus(),40);
 return true;
}

function installAssessmentAdapter(){
 const modules=window.AICLO_ASSESSMENT_MODULES;
 const base=modules?.createOnlineBuilderModule;
 if(typeof base!=='function'||base.__aicloUnifiedQuickEdit)return;
 const wrapped=function(ctx){
  const originalOpenDrawer=ctx?.openDrawer;
  const nextCtx={...ctx,openDrawer:(title,html,bind,opts)=>{
   const isQuick=/^Sửa nhanh\b/i.test(String(title||''))&&String(html||'').includes('ub-quick-edit');
   if(isQuick&&openAssessmentQuickWindow(ctx,title,html,bind))return;
   return typeof originalOpenDrawer==='function'?originalOpenDrawer(title,html,bind,opts):undefined;
  }};
  return base(nextCtx);
 };
 wrapped.__aicloUnifiedQuickEdit=true;
 modules.createOnlineBuilderModule=wrapped;
}

installAssessmentAdapter();
window.AICLO_QUICK_EDIT_WINDOW=Object.freeze({version:'12.4.4'});
})();
