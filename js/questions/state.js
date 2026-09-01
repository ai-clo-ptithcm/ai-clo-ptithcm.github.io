/* AI-CLO PTITHCM V11 — question bank filters and draft persistence. */
(() => {
'use strict';

const keyBase=()=>`ai-clo:v1053:${state.user?.id||'user'}:${state.subjectId||'subject'}`;
const filterKey=()=>`${keyBase()}:question-filters`;
const draftKey=id=>`${keyBase()}:question-draft:${id||'new'}`;
let draftTimer=null;

const jsonRead=(key,fallback=null)=>{try{return JSON.parse(sessionStorage.getItem(key)||'null')??fallback}catch{return fallback}};
const jsonWrite=(key,value)=>{try{sessionStorage.setItem(key,JSON.stringify(value))}catch{}};
const jsonDrop=key=>{try{sessionStorage.removeItem(key)}catch{}};

function currentFilters(){
 if(!$('#qsearch'))return null;
 let search=String($('#qsearch').value||'').trim();
 if(search.toLowerCase()==='all')search='';
 return {
  search,
  chapter:$('#qchapterFilter')?.value||'all',
  topic:$('#qtopicFilter')?.value||'all',
  clo:$('#qcloFilter')?.value||'all',
  approval:$('#qapprovalFilter')?.value||'all',
  creator:$('#qcreatorFilter')?.value||'all',
  bank:window.AICLO_V105?.activeBank?.()||'practice',
  scrollY:window.scrollY||0
 };
}
function persistFilters(){
 const f=currentFilters();
 if(!f)return;
 v94QuestionFilters=f;
 jsonWrite(filterKey(),f);
}
function savedFilters(){return v94QuestionFilters||jsonRead(filterKey(),null)}
function restoreFilters(){
 const f=savedFilters();if(!f||!$('#qsearch'))return;
 let search=String(f.search||'');if(search.toLowerCase()==='all')search='';
 $('#qsearch').value=search;
 if($('#qchapterFilter')){$('#qchapterFilter').value=f.chapter||'all';$('#qchapterFilter').dispatchEvent(new Event('change'))}
 if($('#qtopicFilter')&&[...$('#qtopicFilter').options].some(o=>o.value===(f.topic||'all')))$('#qtopicFilter').value=f.topic||'all';
 if($('#qcloFilter'))$('#qcloFilter').value=f.clo||'all';
 if($('#qapprovalFilter'))$('#qapprovalFilter').value=f.approval||'all';
 if($('#qcreatorFilter'))$('#qcreatorFilter').value=f.creator||'all';
 $('#qsearch').dispatchEvent(new Event('input'));
 requestAnimationFrame(()=>window.scrollTo({top:Number(f.scrollY)||0,behavior:'auto'}));
}

const oldCapture=window.captureQuestionFilters;
window.captureQuestionFilters=function(){oldCapture?.();persistFilters()};
const oldBack=window.backToQuestionList;
window.backToQuestionList=async function(){
 const f=savedFilters();if(f)v94QuestionFilters=f;
 await oldBack();
 persistFilters();
};

const oldQuestions=window.questions;
window.questions=async function(c){
 const f=savedFilters();
 if(f?.bank&&window.AICLO_V105?.activeBank?.()!==f.bank){
  // v105 bank state is private; the old back helper restores it from v94QuestionFilters.
  v94QuestionFilters=f;
 }
 await oldQuestions(c);
 restoreFilters();
 bindFilterPersistence();
};
function bindFilterPersistence(){
 ['#qsearch','#qchapterFilter','#qtopicFilter','#qcloFilter','#qapprovalFilter','#qcreatorFilter'].forEach(sel=>{
  const el=$(sel);if(!el)return;
  el.addEventListener(el.tagName==='INPUT'?'input':'change',()=>{clearTimeout(draftTimer);draftTimer=setTimeout(persistFilters,80)});
 });
 $$('[data-bank-tab]').forEach(b=>b.addEventListener('click',()=>setTimeout(persistFilters,0)));
}

function readFormDraft(form){
 const data=Object.fromEntries(new FormData(form));
 return {...data,updated_at:Date.now()};
}
function saveVisibleQuestionDraft(){
 const form=$('#qForm');if(!form)return;
 const id=form.dataset.draftId||'new';jsonWrite(draftKey(id),readFormDraft(form));
}
function restoreQuestionDraft(form,id){
 const d=jsonRead(draftKey(id),null);if(!d)return false;
 const set=(name,value)=>{const el=form.elements.namedItem(name);if(!el||value==null)return;if(el instanceof RadioNodeList){[...form.querySelectorAll(`[name="${CSS.escape(name)}"]`)].forEach(r=>r.checked=r.value===value)}else el.value=value};
 if(d.chapter_id){set('chapter_id',d.chapter_id);$('#qchapter')?.dispatchEvent(new Event('change'))}
 ['content','topic_id','clo_id','correct_answer','approval_status','question_scope','opt_A','opt_B','opt_C','opt_D','explanation'].forEach(n=>set(n,d[n]));
 return true;
}

const oldNavigate=window.navigate;
window.navigate=function(v){
 saveVisibleQuestionDraft();
 if(state.view==='questions')persistFilters();
 return oldNavigate(v);
};
const oldFillSubjectSelect=window.fillSubjectSelect;
window.fillSubjectSelect=function(){return oldFillSubjectSelect()};

const oldQuestionForm=window.v96QuestionForm;
window.v96QuestionForm=async function(x={},sets){
 x=x||{};
 await oldQuestionForm(x,sets);
 const form=$('#qForm');if(!form)return;
 const id=x.id||'new';form.dataset.draftId=id;
 const restored=restoreQuestionDraft(form,id);
 if(restored)toast('Đã khôi phục nội dung đang soạn');
 const queue=()=>{clearTimeout(draftTimer);draftTimer=setTimeout(()=>jsonWrite(draftKey(id),readFormDraft(form)),120)};
 form.addEventListener('input',queue);form.addEventListener('change',queue);
 const originalSubmit=form.onsubmit;
 form.onsubmit=async e=>{
  jsonWrite(draftKey(id),readFormDraft(form));
  await originalSubmit(e);
  if(!document.body.contains(form))jsonDrop(draftKey(id));
 };
 const cancel=$('#cancelQuestionEdit');
 if(cancel){const old=cancel.onclick;cancel.onclick=async()=>{jsonDrop(draftKey(id));return old?.()}}
 const back=$('#questionBack');
 if(back){const old=back.onclick;back.onclick=async()=>{saveVisibleQuestionDraft();return old?.()}}
};

window.AICLO_QUESTION_STATE=Object.freeze({persistFilters,savedFilters});
})();
