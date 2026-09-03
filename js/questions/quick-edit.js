/* AI-CLO PTITHCM V11.6.14 — draggable quick editor for question content and answers. */
(()=>{
'use strict';

let enhanceQueued=false,activePointer=null;
const optionKeys=['A','B','C','D'];
const duplicateStateKey=()=>`ai-clo:v11612:${state.user?.id||'user'}:${state.subjectId||'subject'}:duplicate-scan`;
const readJson=(key,fallback=null)=>{try{return JSON.parse(sessionStorage.getItem(key)||'null')??fallback}catch{return fallback}};
const writeJson=(key,value)=>{try{sessionStorage.setItem(key,JSON.stringify(value))}catch{}};

async function loadQuestion(id){
 const {data,error}=await db.from('questions').select('*, question_options(*)').eq('id',id).single();
 if(error)throw error;
 return data;
}
function optionMap(question){return Object.fromEntries((question?.question_options||[]).map(o=>[String(o.option_key||'').toUpperCase(),String(o.content||'')]))}
function snapshot(form){
 const v=Object.fromEntries(new FormData(form));
 return {
  content:String(v.content||'').trim(),
  correct_answer:String(v.correct_answer||'A').toUpperCase(),
  options:Object.fromEntries(optionKeys.map(k=>[k,String(v[`opt_${k}`]||'').trim()]))
 };
}
function sameSnapshot(a,b){return a.content===b.content&&a.correct_answer===b.correct_answer&&optionKeys.every(k=>a.options[k]===b.options[k])}
function modalMarkup(question){
 const opts=optionMap(question),correct=String(question.correct_answer||'A').toUpperCase();
 return `<form id="quickQuestionForm" class="quick-question-form">
  <label class="field wide"><span>Nội dung câu hỏi</span><textarea name="content" rows="4" required>${esc(question.content||'')}</textarea></label>
  <div class="quick-answer-grid">${optionKeys.map(k=>`<label class="field"><span>Phương án ${k}</span><textarea name="opt_${k}" rows="2" required>${esc(opts[k]||'')}</textarea></label>`).join('')}</div>
  <label class="field quick-correct-field"><span>Đáp án đúng</span><select name="correct_answer">${optionKeys.map(k=>`<option value="${k}" ${correct===k?'selected':''}>${k}</option>`).join('')}</select></label>
  <div id="quickQuestionError" class="quick-question-error" hidden></div>
  <div class="form-actions quick-question-actions"><button id="cancelQuickQuestion" type="button" class="secondary">Hủy</button><button id="saveQuickQuestion" class="primary">Lưu</button></div>
 </form>`;
}

function resetModalPosition(dialog){
 dialog.style.left='50%';dialog.style.top='50%';dialog.style.transform='translate(-50%,-50%)';
 dialog.style.right='auto';dialog.style.bottom='auto';
}
function clamp(value,min,max){return Math.max(min,Math.min(max,value))}
function installDrag(dialog){
 const head=dialog.querySelector('.modal-head');if(!head)return;
 const onDown=event=>{
  if(matchMedia('(max-width:700px)').matches||event.button!==0||event.target.closest('button,input,select,textarea,a'))return;
  const rect=dialog.getBoundingClientRect();
  activePointer={id:event.pointerId,dx:event.clientX-rect.left,dy:event.clientY-rect.top};
  dialog.style.left=`${rect.left}px`;dialog.style.top=`${rect.top}px`;dialog.style.transform='none';
  head.classList.add('dragging');head.setPointerCapture?.(event.pointerId);event.preventDefault();
 };
 const onMove=event=>{
  if(!activePointer||activePointer.id!==event.pointerId)return;
  const rect=dialog.getBoundingClientRect(),pad=8;
  const left=clamp(event.clientX-activePointer.dx,pad,Math.max(pad,innerWidth-rect.width-pad));
  const top=clamp(event.clientY-activePointer.dy,pad,Math.max(pad,innerHeight-rect.height-pad));
  dialog.style.left=`${left}px`;dialog.style.top=`${top}px`;
 };
 const onUp=event=>{
  if(!activePointer||activePointer.id!==event.pointerId)return;
  activePointer=null;head.classList.remove('dragging');try{head.releasePointerCapture?.(event.pointerId)}catch{}
 };
 head.addEventListener('pointerdown',onDown);head.addEventListener('pointermove',onMove);head.addEventListener('pointerup',onUp);head.addEventListener('pointercancel',onUp);
 const cleanup=()=>{activePointer=null;head.classList.remove('dragging');head.removeEventListener('pointerdown',onDown);head.removeEventListener('pointermove',onMove);head.removeEventListener('pointerup',onUp);head.removeEventListener('pointercancel',onUp);dialog.classList.remove('quick-edit-modal');dialog.style.left='';dialog.style.top='';dialog.style.right='';dialog.style.bottom='';dialog.style.transform=''};
 dialog.addEventListener('close',cleanup,{once:true});
}

async function confirmSimilar(question,content){
 let result=await db.rpc('find_similar_questions_scoped',{p_subject_id:state.subjectId,p_chapter_id:question.chapter_id,p_topic_id:question.topic_id||null,p_content:content,p_exclude_id:question.id,p_limit:3});
 if(result.error){
  result=await db.rpc('find_similar_questions',{p_subject_id:state.subjectId,p_content:content,p_exclude_id:question.id,p_limit:3});
  if(result.error)throw result.error;
 }
 const top=result.data?.[0];
 if(!top||Number(top.similarity_score)<.72)return true;
 return confirmAction('Phát hiện câu hỏi tương tự',`${top.code||'Một câu khác'} có độ tương đồng ${Math.round(Number(top.similarity_score)*100)}%. Bạn vẫn muốn lưu?`,{confirmLabel:'Vẫn lưu'});
}

async function saveQuick(question,next){
 if(!next.content)throw new Error('Nội dung câu hỏi không được để trống.');
 for(const k of optionKeys)if(!next.options[k])throw new Error(`Phương án ${k} không được để trống.`);
 if(!await confirmSimilar(question,next.content))return null;
 const archived=await db.rpc('archive_question_revision',{p_question_id:question.id});if(archived.error)throw archived.error;
 const updatedAt=new Date().toISOString();
 const update=await db.from('questions').update({content:next.content,correct_answer:next.correct_answer,updated_at:updatedAt}).eq('id',question.id);if(update.error)throw update.error;
 for(const k of optionKeys){
  const old=(question.question_options||[]).find(o=>String(o.option_key).toUpperCase()===k);
  const result=old?.id?await db.from('question_options').update({content:next.options[k]}).eq('id',old.id):await db.from('question_options').insert({question_id:question.id,option_key:k,content:next.options[k]});
  if(result.error)throw result.error;
 }
 const fresh=await loadQuestion(question.id);
 window.AICLO_QUESTION_STATE?.invalidate?.(question.id);
 window.logActivity?.('update','question',question.id,'Sửa nhanh: '+next.content.slice(0,120));
 return fresh;
}

function patchDuplicateState(question,pairId){
 const key=duplicateStateKey(),saved=readJson(key,null);if(!saved?.result?.pairs?.length)return;
 const options=optionMap(question),code=questionCode(question);
 const patch=q=>String(q.id)===String(question.id)?{...q,code,content:question.content,correct_answer:question.correct_answer,options,chapter_id:question.chapter_id,topic_id:question.topic_id,clo_id:question.clo_id,question_scope:question.question_scope,updated_at:question.updated_at}:q;
 const pairs=saved.result.pairs.map(pair=>{
  const touched=String(pair.a?.id)===String(question.id)||String(pair.b?.id)===String(question.id);
  return touched?{...pair,a:patch(pair.a),b:patch(pair.b),needs_recheck:true}:pair;
 });
 writeJson(key,{...saved,result:{...saved.result,pairs},anchor:pairId||saved.anchor,updatedAt:Date.now()});
}
function updateVisibleBankRow(question){
 const button=document.querySelector(`[data-quick-edit="${CSS.escape(String(question.id))}"]`),row=button?.closest('tr');
 const summary=row?.querySelector('.question-summary');if(summary)summary.textContent=question.content||'';
 if(row)renderMath(row);
}

async function openQuick(id,{source='bank',pairId=null,onSaved=null}={}){
 let trigger=document.querySelector(`[data-quick-edit="${CSS.escape(String(id))}"]`)||document.querySelector(`[data-edit-duplicate="${CSS.escape(String(id))}"]`);
 if(trigger)trigger.disabled=true;
 try{
  const question=await loadQuestion(id);
  if(!v96CanManage(question))return toast('Chỉ người nhập hoặc Admin được sửa câu hỏi.',true);
  captureQuestionFilters?.();
  const initial={content:String(question.content||'').trim(),correct_answer:String(question.correct_answer||'A').toUpperCase(),options:optionMap(question)};
  modal(`Sửa nhanh · ${questionCode(question)}`,modalMarkup(question));
  const dialog=$('#modal');dialog.classList.add('quick-edit-modal');resetModalPosition(dialog);installDrag(dialog);
  const form=$('#quickQuestionForm'),cancel=$('#cancelQuickQuestion'),save=$('#saveQuickQuestion'),errorBox=$('#quickQuestionError');
  cancel.onclick=closeModal;
  form.onsubmit=async event=>{
   event.preventDefault();const next=snapshot(form);
   if(sameSnapshot(initial,next)){closeModal();return toast('Không có thay đổi để lưu')}
   save.disabled=true;save.textContent='Đang lưu…';errorBox.hidden=true;
   try{
    const fresh=await saveQuick(question,next);if(!fresh){save.disabled=false;save.textContent='Lưu';return}
    closeModal();toast('Đã cập nhật câu hỏi');updateVisibleBankRow(fresh);
    if(source==='duplicate-scan'){
     patchDuplicateState(fresh,pairId);
     await window.AICLO_DUPLICATE_SCAN?.restore?.();
    }
    await onSaved?.(fresh);
    window.dispatchEvent(new CustomEvent('aiclo:question-quick-updated',{detail:{question:fresh,source,pairId}}));
   }catch(error){console.error(error);errorBox.textContent=error?.message||'Không thể lưu câu hỏi.';errorBox.hidden=false;save.disabled=false;save.textContent='Lưu'}
  };
  setTimeout(()=>form.elements.namedItem('content')?.focus(),40);
 }catch(error){err(error)}finally{if(trigger)trigger.disabled=false}
}

function enhanceBankRows(){
 document.querySelectorAll('#qrows tr').forEach(row=>{
  const manage=row.querySelector('[data-select-question]'),detail=row.querySelector('.row-actions [data-detail]');
  if(!manage||!detail||row.querySelector('[data-quick-edit]'))return;
  const id=detail.dataset.detail;if(!id)return;
  const button=document.createElement('button');button.type='button';button.className='quick-edit-button';button.dataset.quickEdit=id;button.textContent='Sửa nhanh';button.title='Chỉ sửa nội dung và đáp án';
  detail.parentElement.insertBefore(button,detail);
 });
}
function enhanceDuplicateButtons(){document.querySelectorAll('[data-edit-duplicate]').forEach(button=>{if(button.textContent!=='Sửa nhanh')button.textContent='Sửa nhanh';button.title='Sửa nhanh nội dung và đáp án'})}
function enhance(){enhanceBankRows();enhanceDuplicateButtons()}
function queueEnhance(){if(enhanceQueued)return;enhanceQueued=true;requestAnimationFrame(()=>{enhanceQueued=false;enhance()})}

document.addEventListener('click',event=>{
 const duplicate=event.target.closest?.('[data-edit-duplicate]');
 if(duplicate){event.preventDefault();event.stopPropagation();openQuick(duplicate.dataset.editDuplicate,{source:'duplicate-scan',pairId:duplicate.dataset.pairAnchor});return}
 const quick=event.target.closest?.('[data-quick-edit]');if(quick){event.preventDefault();event.stopPropagation();openQuick(quick.dataset.quickEdit,{source:'bank'})}
},true);

document.addEventListener('DOMContentLoaded',()=>{
 enhance();const host=$('#content');if(host)new MutationObserver(queueEnhance).observe(host,{childList:true,subtree:true});
});

window.AICLO_QUESTION_QUICK_EDIT=Object.freeze({open:openQuick,enhance});
})();
