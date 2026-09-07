/* AI-CLO PTITHCM V11.6.24 — compact draggable/resizable quick editor and shared app-window controller. */
(()=>{
'use strict';

let enhanceQueued=false,activePointer=null;
const optionKeys=['A','B','C','D'];
const RESIZE_EDGES=['n','e','s','w','ne','nw','se','sw'];
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
  <div id="quickQuestionError" class="quick-question-error" hidden></div>
  <div class="quick-footer-row">
   <label class="field quick-correct-field"><span>Đáp án đúng</span><select name="correct_answer">${optionKeys.map(k=>`<option value="${k}" ${correct===k?'selected':''}>${k}</option>`).join('')}</select></label>
   <div class="quick-question-actions"><button id="cancelQuickQuestion" type="button" class="secondary">Hủy</button><button id="saveQuickQuestion" class="primary">Lưu</button></div>
  </div>
 </form>`;
}

function clamp(value,min,max){return Math.max(min,Math.min(max,value))}
function setGeometry(dialog,{left,top,width,height}){
 dialog.style.left=`${Math.round(left)}px`;
 dialog.style.top=`${Math.round(top)}px`;
 dialog.style.width=`${Math.round(width)}px`;
 dialog.style.height=`${Math.round(height)}px`;
 dialog.style.right='auto';dialog.style.bottom='auto';dialog.style.transform='none';
}
function resetModalGeometry(dialog){
 if(matchMedia('(max-width:700px)').matches){
  dialog.style.left='';dialog.style.top='';dialog.style.width='';dialog.style.height='';dialog.style.right='';dialog.style.bottom='';dialog.style.transform='';
  return;
 }
 const pad=16,width=Math.min(720,Math.max(520,innerWidth-pad*2)),height=Math.min(600,Math.max(410,innerHeight-pad*2));
 setGeometry(dialog,{left:(innerWidth-width)/2,top:(innerHeight-height)/2,width,height});
}
function keepModalInViewport(dialog){
 if(!dialog?.open||matchMedia('(max-width:700px)').matches)return;
 const rect=dialog.getBoundingClientRect(),pad=8;
 const maxWidth=Math.max(520,innerWidth-pad*2),maxHeight=Math.max(410,innerHeight-pad*2);
 const width=Math.min(rect.width,maxWidth),height=Math.min(rect.height,maxHeight);
 const left=clamp(rect.left,pad,Math.max(pad,innerWidth-width-pad));
 const top=clamp(rect.top,pad,Math.max(pad,innerHeight-height-pad));
 if(Math.abs(left-rect.left)<.5&&Math.abs(top-rect.top)<.5&&Math.abs(width-rect.width)<.5&&Math.abs(height-rect.height)<.5)return;
 setGeometry(dialog,{left,top,width,height});
}
function addResizeHandles(dialog){
 RESIZE_EDGES.forEach(edge=>{
  if(dialog.querySelector(`[data-quick-resize="${edge}"]`))return;
  const handle=document.createElement('span');
  handle.className=`quick-resize-handle quick-resize-${edge}`;
  handle.dataset.quickResize=edge;
  handle.setAttribute('aria-hidden','true');
  dialog.appendChild(handle);
 });
}
function removeResizeHandles(dialog){dialog.querySelectorAll('[data-quick-resize]').forEach(x=>x.remove())}
function installWindowInteractions(dialog){
 const head=dialog.querySelector('.modal-head');if(!head)return;
 let resizeFrame=0;
 addResizeHandles(dialog);

 const finishPointer=(event,target)=>{
  if(!activePointer||activePointer.id!==event.pointerId)return;
  activePointer=null;head.classList.remove('dragging');
  try{target?.releasePointerCapture?.(event.pointerId)}catch{}
 };
 const onHeadDown=event=>{
  if(matchMedia('(max-width:700px)').matches||event.button!==0||event.target.closest('button,input,select,textarea,a'))return;
  const rect=dialog.getBoundingClientRect();
  activePointer={mode:'move',id:event.pointerId,dx:event.clientX-rect.left,dy:event.clientY-rect.top};
  setGeometry(dialog,{left:rect.left,top:rect.top,width:rect.width,height:rect.height});
  head.classList.add('dragging');head.setPointerCapture?.(event.pointerId);event.preventDefault();
 };
 const onHeadMove=event=>{
  if(!activePointer||activePointer.mode!=='move'||activePointer.id!==event.pointerId)return;
  const rect=dialog.getBoundingClientRect(),pad=8;
  const left=clamp(event.clientX-activePointer.dx,pad,Math.max(pad,innerWidth-rect.width-pad));
  const top=clamp(event.clientY-activePointer.dy,pad,Math.max(pad,innerHeight-rect.height-pad));
  setGeometry(dialog,{left,top,width:rect.width,height:rect.height});
 };
 const onHeadUp=event=>finishPointer(event,head);

 const onResizeDown=event=>{
  const handle=event.currentTarget;
  if(matchMedia('(max-width:700px)').matches||event.button!==0)return;
  const rect=dialog.getBoundingClientRect();
  activePointer={mode:'resize',id:event.pointerId,edge:handle.dataset.quickResize,startX:event.clientX,startY:event.clientY,left:rect.left,top:rect.top,width:rect.width,height:rect.height,right:rect.right,bottom:rect.bottom};
  setGeometry(dialog,{left:rect.left,top:rect.top,width:rect.width,height:rect.height});
  handle.setPointerCapture?.(event.pointerId);event.preventDefault();event.stopPropagation();
 };
 const onResizeMove=event=>{
  if(!activePointer||activePointer.mode!=='resize'||activePointer.id!==event.pointerId)return;
  const p=activePointer,edge=p.edge,pad=8,minW=520,minH=410,dx=event.clientX-p.startX,dy=event.clientY-p.startY;
  let left=p.left,top=p.top,width=p.width,height=p.height;
  if(edge.includes('e'))width=clamp(p.width+dx,minW,Math.max(minW,innerWidth-pad-p.left));
  if(edge.includes('s'))height=clamp(p.height+dy,minH,Math.max(minH,innerHeight-pad-p.top));
  if(edge.includes('w')){left=clamp(p.left+dx,pad,p.right-minW);width=p.right-left}
  if(edge.includes('n')){top=clamp(p.top+dy,pad,p.bottom-minH);height=p.bottom-top}
  setGeometry(dialog,{left,top,width,height});
 };
 const onResizeUp=event=>finishPointer(event,event.currentTarget);

 head.addEventListener('pointerdown',onHeadDown);head.addEventListener('pointermove',onHeadMove);head.addEventListener('pointerup',onHeadUp);head.addEventListener('pointercancel',onHeadUp);
 const handles=[...dialog.querySelectorAll('[data-quick-resize]')];
 handles.forEach(handle=>{handle.addEventListener('pointerdown',onResizeDown);handle.addEventListener('pointermove',onResizeMove);handle.addEventListener('pointerup',onResizeUp);handle.addEventListener('pointercancel',onResizeUp)});
 const onViewportResize=()=>{cancelAnimationFrame(resizeFrame);resizeFrame=requestAnimationFrame(()=>keepModalInViewport(dialog))};
 window.addEventListener('resize',onViewportResize);window.visualViewport?.addEventListener('resize',onViewportResize);
 requestAnimationFrame(()=>keepModalInViewport(dialog));

 const cleanup=()=>{
  activePointer=null;cancelAnimationFrame(resizeFrame);head.classList.remove('dragging');
  head.removeEventListener('pointerdown',onHeadDown);head.removeEventListener('pointermove',onHeadMove);head.removeEventListener('pointerup',onHeadUp);head.removeEventListener('pointercancel',onHeadUp);
  handles.forEach(handle=>{handle.removeEventListener('pointerdown',onResizeDown);handle.removeEventListener('pointermove',onResizeMove);handle.removeEventListener('pointerup',onResizeUp);handle.removeEventListener('pointercancel',onResizeUp)});
  window.removeEventListener('resize',onViewportResize);window.visualViewport?.removeEventListener('resize',onViewportResize);
  removeResizeHandles(dialog);dialog.classList.remove('quick-edit-modal');
  ['left','top','right','bottom','width','height','transform'].forEach(prop=>dialog.style[prop]='');
 };
 dialog.addEventListener('close',cleanup,{once:true});
}
function openAppWindow(dialog,{className='quick-edit-modal',width=720,height=600}={}){
 if(!dialog)return null;
 dialog.classList.add('quick-edit-modal');
 if(className&&className!=='quick-edit-modal')dialog.classList.add(className);
 if(matchMedia('(max-width:700px)').matches){
  resetModalGeometry(dialog);
 }else{
  const pad=16,availableWidth=Math.max(520,innerWidth-pad*2),availableHeight=Math.max(410,innerHeight-pad*2);
  const w=Math.min(width,availableWidth),h=Math.min(height,availableHeight);
  setGeometry(dialog,{left:(innerWidth-w)/2,top:(innerHeight-h)/2,width:w,height:h});
 }
 installWindowInteractions(dialog);
 if(className&&className!=='quick-edit-modal')dialog.addEventListener('close',()=>dialog.classList.remove(className),{once:true});
 return dialog;
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
  modal(`AI-CLO | Sửa nhanh · ${questionCode(question)}`,modalMarkup(question));
  const dialog=$('#modal');window.AICLO_APP_WINDOW.open(dialog,{className:'quick-edit-modal',width:720,height:600});
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

window.AICLO_APP_WINDOW=Object.freeze({open:openAppWindow,setGeometry});
window.AICLO_QUESTION_QUICK_EDIT=Object.freeze({open:openQuick,enhance});
})();