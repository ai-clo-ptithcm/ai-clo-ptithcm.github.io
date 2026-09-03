/* AI-CLO PTITHCM V11.6.9 — preserve in-progress academic forms across navigation and tab reloads. */
(() => {
'use strict';
const allowed=new Set(['aiForm','assessmentForm','editAssessmentForm','finalExamForm','chapterForm','topicForm','subjectForm','v102CloForm','editRequestForm']);
const keyById=id=>`ai-clo:v11:form:${state.user?.id||'user'}:${state.subjectId||'system'}:${id}`;
const key=form=>keyById(form.id);
const read=form=>{try{return JSON.parse(sessionStorage.getItem(key(form))||'null')}catch{return null}};
const write=(form,value)=>{try{sessionStorage.setItem(key(form),JSON.stringify({...value,updated_at:Date.now()}))}catch{}};
const drop=form=>{try{sessionStorage.removeItem(key(form))}catch{}};
const clear=id=>{try{sessionStorage.removeItem(keyById(id))}catch{}};

function values(form){
 const result={};
 for(const el of form.elements){
  if(!el.name||el.type==='file'||el.type==='password')continue;
  if(el.type==='checkbox')result[el.name]=!!el.checked;
  else if(el.type==='radio'){if(el.checked)result[el.name]=el.value}
  else result[el.name]=el.value;
 }
 result.__matrix=[...form.querySelectorAll('.clo-count,.matrix-count')].map(el=>({clo:el.dataset.clo||'',topic:el.dataset.topic||'',chapter:el.dataset.chapter||'',value:el.value}));
 return result;
}

function restore(form,data){
 if(!data)return false;
 const chapter=form.elements.namedItem('chapter_id');
 if(chapter&&data.chapter_id!=null){chapter.value=data.chapter_id;chapter.dispatchEvent(new Event('change'))}
 for(const el of form.elements){
  if(!el.name||el.name==='chapter_id'||!(el.name in data)||el.type==='file'||el.type==='password')continue;
  if(el.type==='checkbox')el.checked=!!data[el.name];
  else if(el.type==='radio')el.checked=el.value===data[el.name];
  else el.value=data[el.name];
 }
 for(const item of data.__matrix||[]){
  const el=[...form.querySelectorAll('.clo-count,.matrix-count')].find(x=>(x.dataset.clo||'')===item.clo&&(x.dataset.topic||'')===item.topic&&(x.dataset.chapter||'')===item.chapter);
  if(el){el.value=item.value;el.dispatchEvent(new Event('input'))}
 }
 return true;
}

function flush(form){
 if(!form||!allowed.has(form.id))return;
 write(form,values(form));
}

function bind(form){
 if(!allowed.has(form.id)||form.dataset.persistBound)return;
 form.dataset.persistBound='1';
 const saved=read(form);
 if(restore(form,saved))setTimeout(()=>toast('Đã khôi phục nội dung đang làm'),0);
 else flush(form); // lưu cả trạng thái mặc định ngay khi form vừa mở
 let timer;
 const save=()=>{clearTimeout(timer);timer=setTimeout(()=>flush(form),100)};
 form.addEventListener('input',save);
 form.addEventListener('change',save);
 form.addEventListener('submit',()=>{
  flush(form);
  const watcher=setInterval(()=>{if(!document.body.contains(form)){clearInterval(watcher);drop(form)}},150);
  setTimeout(()=>clearInterval(watcher),5000);
 });
 form.addEventListener('click',event=>{
  const button=event.target.closest('button');
  if(button&&/^(Hủy|Quay lại)/i.test(button.textContent.trim()))drop(form);
 });
}

function scan(root=document){root.querySelectorAll?.('form[id]').forEach(bind)}
function flushVisibleForms(){document.querySelectorAll('form[data-persist-bound="1"]').forEach(flush)}

new MutationObserver(records=>records.forEach(record=>record.addedNodes.forEach(node=>{
 if(node.nodeType===1){if(node.matches?.('form[id]'))bind(node);scan(node)}
}))).observe(document.documentElement,{childList:true,subtree:true});

document.addEventListener('DOMContentLoaded',()=>scan());
document.addEventListener('visibilitychange',()=>{if(document.hidden)flushVisibleForms()});
window.addEventListener('pagehide',flushVisibleForms);

window.AICLO_FORM_PERSISTENCE=Object.freeze({
 flush,
 clear,
 clearForm:form=>form&&drop(form),
 snapshot:id=>{try{return JSON.parse(sessionStorage.getItem(keyById(id))||'null')}catch{return null}}
});
})();
