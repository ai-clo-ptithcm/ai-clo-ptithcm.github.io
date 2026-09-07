/* AI-CLO PTITHCM V12.6.15 — unified quick-edit presentation, source save and AI question setup.
   Assessment "Sửa nhanh" corrects the source question. "AI sinh câu hỏi" opens a scoped
   request window before generation and keeps provider/model details only in the result preview. */
(()=>{
'use strict';

const MODE_CLASSES=[
 'app-window-modal',
 'question-source-editor-modal',
 'question-bank-quick-edit-modal',
 'duplicate-scan-quick-edit-modal',
 'assessment-draft-editor-modal'
];
const OPTION_KEYS=['A','B','C','D'];
let sourceToken=0;
let assessmentBuilderCtx=null;
let pendingAiGeneration=null;
let activeAiButton=null;

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
  return '<div class="quick-edit-context assessment"><b>SỬA CÂU HỎI</b><span>Thay đổi sẽ cập nhật trực tiếp câu gốc trong Ngân hàng câu hỏi. Bài kiểm tra hiện tại giữ cùng nội dung mới trong bản làm việc để snapshot không bị quay lại bản cũ.</span></div>';
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
  code:host.querySelector('.ub-quick-edit > .hint b')?.textContent?.trim()||'',
  content:host.querySelector('#v123EditContent')?.value||'',
  explanation:host.querySelector('#v123EditExplanation')?.value||'',
  correct:host.querySelector('input[name="v123EditCorrect"]:checked')?.value||'A',
  options:Object.fromEntries(OPTION_KEYS.map(k=>[k,option(k)]))
 };
}
function assessmentQuickMarkup(data){
 const correct=String(data.correct||'A').toUpperCase();
 return `<form id="assessmentQuickDraftForm" class="quick-question-form unified-quick-editor" novalidate>
  ${contextMarkup('assessment_draft')}
  <label class="field wide"><span>Nội dung câu hỏi</span><textarea id="v123EditContent" rows="4" required>${esc(data.content)}</textarea></label>
  <div class="quick-answer-grid">${OPTION_KEYS.map(k=>`<label class="field"><span>Phương án ${k}</span><textarea data-v123-edit-option="${k}" rows="2" required>${esc(data.options[k])}</textarea></label>`).join('')}</div>
  <label class="field wide quick-explanation-field"><span>Lời giải</span><textarea id="v123EditExplanation" rows="3">${esc(data.explanation)}</textarea></label>
  <div class="quick-footer-row">
   <label class="field quick-correct-field"><span>Đáp án đúng</span><select id="v123EditCorrectSelect">${OPTION_KEYS.map(k=>`<option value="${k}" ${correct===k?'selected':''}>${k}</option>`).join('')}</select></label>
   <div class="quick-correct-radios" aria-hidden="true">${OPTION_KEYS.map(k=>`<input type="radio" name="v123EditCorrect" value="${k}" ${correct===k?'checked':''}>`).join('')}</div>
   <div class="quick-question-actions"><button id="v123EditCancel" type="button" class="secondary">Hủy</button><button id="v123EditSave" type="button" class="primary">Lưu vào câu hỏi</button></div>
  </div>
 </form>`;
}
function syncAssessmentCorrect(){
 const select=document.querySelector('#v123EditCorrectSelect');
 if(!select)return;
 const sync=()=>document.querySelectorAll('input[name="v123EditCorrect"]').forEach(radio=>{radio.checked=radio.value===select.value;});
 select.addEventListener('change',sync);sync();
}
function assessmentSnapshot(){
 const content=document.querySelector('#v123EditContent')?.value.trim()||'';
 const explanation=document.querySelector('#v123EditExplanation')?.value.trim()||'';
 const correct=document.querySelector('input[name="v123EditCorrect"]:checked')?.value||'';
 const options=Object.fromEntries(OPTION_KEYS.map(k=>[k,document.querySelector(`[data-v123-edit-option="${k}"]`)?.value.trim()||'']));
 return {content,explanation,correct,options};
}
function assessmentFieldsValid(){
 const data=assessmentSnapshot();
 return !!data.content&&!!data.correct&&OPTION_KEYS.every(k=>!!data.options[k]);
}
function sameAssessmentData(a,b){
 return String(a.content||'').trim()===String(b.content||'').trim()&&
  String(a.explanation||'').trim()===String(b.explanation||'').trim()&&
  String(a.correct||'A').toUpperCase()===String(b.correct||'A').toUpperCase()&&
  OPTION_KEYS.every(k=>String(a.options?.[k]||'').trim()===String(b.options?.[k]||'').trim());
}
async function findAssessmentQuestion(ctx,code){
 const subject=typeof ctx?.subjectId==='function'?ctx.subjectId():ctx?.state?.subjectId;
 if(!subject)throw new Error('Chưa xác định được học phần của câu hỏi.');
 const select='id,subject_id,display_code,chapter_id,topic_id,clo_id,content,correct_answer,explanation,created_by,question_options(id,option_key,content)';
 if(code&&!/^Q-/i.test(code)){
  const one=await ctx.db.from('questions').select(select).eq('subject_id',subject).eq('display_code',code).maybeSingle();
  if(one.error)throw one.error;
  if(one.data)return one.data;
 }
 const all=await ctx.db.from('questions').select(select).eq('subject_id',subject);
 if(all.error)throw all.error;
 const prefix=String(code||'').replace(/^Q-/i,'').toLowerCase();
 const found=(all.data||[]).find(q=>String(q.id||'').toLowerCase().startsWith(prefix)||String(q.display_code||'').trim()===String(code||'').trim());
 if(!found)throw new Error(`Không tìm thấy câu ${code||''} trong Ngân hàng câu hỏi.`);
 return found;
}
function sourceMatchesForm(question,next){
 const options=Object.fromEntries((question.question_options||[]).map(o=>[String(o.option_key||'').toUpperCase(),String(o.content||'').trim()]));
 return String(question.content||'').trim()===next.content&&
  String(question.explanation||'').trim()===next.explanation&&
  String(question.correct_answer||'A').toUpperCase()===String(next.correct||'A').toUpperCase()&&
  OPTION_KEYS.every(k=>String(options[k]||'').trim()===String(next.options[k]||'').trim());
}
async function saveAssessmentSource(ctx,question,next){
 if(typeof window.v96CanManage==='function'&&!window.v96CanManage(question))throw new Error('Chỉ người nhập câu hoặc Admin được sửa câu hỏi này.');
 if(sourceMatchesForm(question,next))return;
 const archived=await ctx.db.rpc('archive_question_revision',{p_question_id:question.id});
 if(archived.error)throw archived.error;
 const updatedAt=new Date().toISOString();
 const qr=await ctx.db.from('questions').update({
  content:next.content,
  correct_answer:String(next.correct||'A').toUpperCase(),
  explanation:next.explanation||null,
  updated_at:updatedAt
 }).eq('id',question.id);
 if(qr.error)throw qr.error;
 for(const k of OPTION_KEYS){
  const old=(question.question_options||[]).find(o=>String(o.option_key||'').toUpperCase()===k);
  const result=old?.id
   ?await ctx.db.from('question_options').update({content:next.options[k],updated_at:updatedAt}).eq('id',old.id)
   :await ctx.db.from('question_options').insert({question_id:question.id,option_key:k,content:next.options[k]});
  if(result.error)throw result.error;
 }
 window.AICLO_QUESTION_STATE?.invalidate?.(question.id);
 window.logActivity?.('update','question',question.id,'Sửa nhanh từ bài kiểm tra: '+next.content.slice(0,120));
 window.dispatchEvent(new CustomEvent('aiclo:question-quick-updated',{detail:{questionId:question.id,source:'assessment-builder'}}));
}
function showAssessmentSaveError(error,save){
 console.error(error);
 save.disabled=false;save.textContent='Lưu vào câu hỏi';
 if(typeof window.err==='function')window.err(error);
 else if(typeof window.toast==='function')window.toast(error?.message||'Không thể cập nhật câu hỏi.',true);
}
function openAssessmentQuickWindow(ctx,title,html,bind){
 if(typeof ctx?.modal!=='function')return false;
 const initial=readAssessmentQuickMarkup(html);
 ctx.modal(`AI-CLO | ${title}`,assessmentQuickMarkup(initial));
 const dialog=document.querySelector('#modal');
 if(!dialog)return false;
 applyModeClasses(dialog,'assessment-draft-editor-modal');
 if(window.AICLO_APP_WINDOW?.open){
  window.AICLO_APP_WINDOW.open(dialog,{className:'assessment-draft-editor-modal',width:720,height:640});
  dialog.classList.add('app-window-modal');
 }
 syncAssessmentCorrect();
 const save=document.querySelector('#v123EditSave');
 let bypass=false;
 if(save)save.addEventListener('click',async event=>{
  if(bypass)return;
  event.preventDefault();event.stopImmediatePropagation();
  if(!assessmentFieldsValid()){
   ctx.notify?.('Cần nhập nội dung, đủ 4 phương án và chọn đáp án đúng.',true);
   return;
  }
  const next=assessmentSnapshot();
  if(sameAssessmentData(initial,next)){
   ctx.closeModal?.();ctx.notify?.('Không có thay đổi để lưu');return;
  }
  save.disabled=true;save.textContent='Đang lưu vào câu hỏi…';
  try{
   const question=await findAssessmentQuestion(ctx,initial.code);
   await saveAssessmentSource(ctx,question,next);
   /* Cho handler gốc của Builder chạy đúng một lần sau khi DB đã cập nhật.
      Handler đó cập nhật ctx.selected + draftOverrides, nhờ vậy nút Lưu thay đổi
      của bài kiểm tra sẽ snapshot đúng nội dung mới, không thể ghi ngược bản cũ. */
   bypass=true;save.disabled=false;save.textContent='Lưu vào câu hỏi';save.click();bypass=false;
   setTimeout(()=>ctx.notify?.('Đã cập nhật câu gốc trong Ngân hàng câu hỏi. Bấm “Lưu thay đổi” để đồng bộ snapshot của bài kiểm tra.'),0);
  }catch(error){
   bypass=false;showAssessmentSaveError(error,save);
  }
 },true);
 if(typeof bind==='function')bind();
 document.querySelector('#v123EditCancel')?.addEventListener('click',()=>ctx.closeModal?.());
 save?.addEventListener('click',()=>{
  if(assessmentFieldsValid())queueMicrotask(()=>ctx.closeModal?.());
 });
 if(typeof window.renderMath==='function')requestAnimationFrame(()=>window.renderMath(document.querySelector('#modalBody')));
 setTimeout(()=>document.querySelector('#v123EditContent')?.focus(),40);
 return true;
}

function resetAiButton(button){
 if(!button)return;
 if(button.isConnected){
  button.disabled=false;
  button.textContent='✦ AI sinh câu hỏi';
  button.title='AI sinh một câu mới đúng Chương · Chủ đề · CLO của vị trí hiện tại';
 }
 if(activeAiButton===button)activeAiButton=null;
}
function enhanceAiButtons(root=document){
 root.querySelectorAll?.('[data-v122-ai]').forEach(button=>{
  if(!button.disabled)button.textContent='✦ AI sinh câu hỏi';
  button.title='AI sinh một câu mới đúng Chương · Chủ đề · CLO của vị trí hiện tại';
 });
}
function readAiScopeFromButton(button){
 const card=button?.closest?.('.ub-question-card,.v122-question-card');
 const badges=[...(card?.querySelectorAll?.('.ub-question-head .badge')||[])];
 const clo=card?.querySelector?.('.ub-question-head .badge.red')?.textContent?.trim()||'—';
 const regular=badges.filter(x=>!x.classList.contains('red'));
 return {
  question:card?.querySelector?.('.ub-question-head b')?.textContent?.trim()||'Câu hỏi',
  chapter:regular[0]?.textContent?.trim()||'—',
  topic:regular[1]?.textContent?.trim()||'—',
  clo
 };
}
function aiSetupMarkup(scope){
 return `<div class="v126-fixed-window assessment-ai-question-setup">
  <p class="hint">AI sẽ sinh một câu mới đúng phạm vi của câu đang thay. Chương, Chủ đề và CLO được khóa theo ma trận hiện tại.</p>
  <div class="v126-fixed-scope">
   <label class="field">Chương<input value="${esc(scope.chapter)}" readonly></label>
   <label class="field">Chủ đề<input value="${esc(scope.topic)}" readonly></label>
   <label class="field">CLO<input value="${esc(scope.clo)}" readonly></label>
  </div>
  <label class="field wide">Yêu cầu thêm cho AI<textarea id="v126ReplaceAiRequirements" rows="5" placeholder="Ví dụ: bài tính ngắn, số liệu đẹp, không dùng L'Hôpital, mức độ tương đương câu hiện tại..."></textarea></label>
  <p class="hint">Câu mới chỉ được lưu vào <b>Ngân hàng luyện tập – kiểm tra</b> và nhận mã câu riêng khi bạn xem trước rồi bấm <b>Dùng câu này</b>.</p>
  <div class="form-actions"><button type="button" class="secondary" id="v126ReplaceAiCancel">Hủy</button><button type="button" class="ai-btn" id="v126ReplaceAiGenerate">✦ Sinh câu hỏi</button></div>
 </div>`;
}
function openAiQuestionSetup(ctx,button,originalHandler){
 if(typeof ctx?.modal!=='function'||typeof originalHandler!=='function')return false;
 const scope=readAiScopeFromButton(button);
 ctx.modal(`AI-CLO | AI sinh câu hỏi · ${scope.question}`,aiSetupMarkup(scope));
 const dialog=document.querySelector('#modal');
 if(!dialog)return false;
 if(window.AICLO_APP_WINDOW?.open){
  window.AICLO_APP_WINDOW.open(dialog,{className:'assessment-required-question-modal',width:760,height:540});
 }
 resetAiButton(button);
 const cancel=document.querySelector('#v126ReplaceAiCancel');
 const generate=document.querySelector('#v126ReplaceAiGenerate');
 cancel?.addEventListener('click',()=>ctx.closeModal?.());
 generate?.addEventListener('click',()=>{
  const requirements=document.querySelector('#v126ReplaceAiRequirements')?.value.trim()||'';
  pendingAiGeneration={requirements,button};
  activeAiButton=button;
  ctx.closeModal?.();
  queueMicrotask(()=>originalHandler.call(button));
 });
 dialog.addEventListener('close',()=>{
  if(activeAiButton!==button)resetAiButton(button);
 },{once:true});
 return true;
}
function normalizeAiTitle(title){
 return String(title||'').replace(/do Gemini đề xuất/gi,'do AI đề xuất').replace(/câu Gemini/gi,'câu AI');
}
function normalizeAiNotice(message){
 return String(message||'').replace(/câu Gemini/gi,'câu AI').replace(/Gemini sinh câu/gi,'AI sinh câu hỏi');
}
function makeAssessmentDbProxy(ctx){
 const realDb=ctx?.db;
 const realFunctions=realDb?.functions;
 if(!realDb||!realFunctions?.invoke)return realDb;
 const invoke=realFunctions.invoke.bind(realFunctions);
 const functionsProxy=new Proxy(realFunctions,{
  get(target,prop){
   if(prop==='invoke')return (name,options={})=>{
    if(name==='generate-one-question'&&pendingAiGeneration){
     const request=pendingAiGeneration;
     pendingAiGeneration=null;
     const body={...(options?.body||{}),additional_requirements:request.requirements||''};
     return invoke(name,{...(options||{}),body});
    }
    return invoke(name,options);
   };
   const value=Reflect.get(target,prop,target);
   return typeof value==='function'?value.bind(target):value;
  }
 });
 return new Proxy(realDb,{
  get(target,prop){
   if(prop==='functions')return functionsProxy;
   const value=Reflect.get(target,prop,target);
   return typeof value==='function'?value.bind(target):value;
  }
 });
}
function wrapAssessmentModal(ctx){
 const original=ctx?.modal;
 if(typeof original!=='function')return original;
 return (title,html,...rest)=>{
  const isAiPreview=String(html||'').includes('v122-ai-preview');
  const result=original(normalizeAiTitle(title),html,...rest);
  if(isAiPreview){
   const dialog=document.querySelector('#modal');
   const button=activeAiButton;
   if(dialog&&window.AICLO_APP_WINDOW?.open){
    window.AICLO_APP_WINDOW.open(dialog,{className:'assessment-required-question-modal',width:780,height:680});
   }
   dialog?.addEventListener('close',()=>resetAiButton(button),{once:true});
  }
  return result;
 };
}

/* Intercept the per-question AI button before Builder's onclick starts the network request. */
window.addEventListener('click',event=>{
 const button=event.target.closest?.('[data-v122-ai]');
 if(!button||button.disabled||!assessmentBuilderCtx)return;
 const originalHandler=button.onclick;
 if(typeof originalHandler!=='function')return;
 event.preventDefault();
 event.stopImmediatePropagation();
 openAiQuestionSetup(assessmentBuilderCtx,button,originalHandler);
},true);

function installAiButtonEnhancer(){
 const run=()=>enhanceAiButtons(document);
 run();
 const host=document.querySelector('#content');
 if(host)new MutationObserver(run).observe(host,{childList:true,subtree:true,characterData:true});
}

function installAssessmentAdapter(){
 const modules=window.AICLO_ASSESSMENT_MODULES;
 const base=modules?.createOnlineBuilderModule;
 if(typeof base!=='function'||base.__aicloUnifiedQuickEdit)return;
 const wrapped=function(ctx){
  const originalOpenDrawer=ctx?.openDrawer;
  const originalNotify=ctx?.notify;
  const nextCtx={
   ...ctx,
   db:makeAssessmentDbProxy(ctx),
   modal:wrapAssessmentModal(ctx),
   notify:(message,bad)=>typeof originalNotify==='function'?originalNotify(normalizeAiNotice(message),bad):undefined,
   openDrawer:(title,html,bind,opts)=>{
    const isQuick=/^Sửa nhanh\b/i.test(String(title||''))&&String(html||'').includes('ub-quick-edit');
    if(isQuick&&openAssessmentQuickWindow(ctx,title,html,bind))return;
    return typeof originalOpenDrawer==='function'?originalOpenDrawer(title,html,bind,opts):undefined;
   }
  };
  assessmentBuilderCtx=nextCtx;
  return base(nextCtx);
 };
 wrapped.__aicloUnifiedQuickEdit=true;
 modules.createOnlineBuilderModule=wrapped;
}

installAssessmentAdapter();
document.addEventListener('DOMContentLoaded',installAiButtonEnhancer,{once:true});
window.AICLO_QUICK_EDIT_WINDOW=Object.freeze({version:'12.6.15'});
})();
