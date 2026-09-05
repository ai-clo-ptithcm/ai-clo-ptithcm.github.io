/* AI-CLO PTITHCM V12.3.6 — preserve in-progress academic forms across navigation and tab reloads. */
(()=>{
'use strict';
const VERSION='12.3.6';
const SAVE_IDLE_MS=320;
const allowed=new Set(['aiForm','assessmentForm','editAssessmentForm','finalExamForm','chapterForm','topicForm','subjectForm','v102CloForm','editRequestForm']);
const cache=new Map();
const bound=new WeakSet();
const timers=new WeakMap();
const keyById=id=>`ai-clo:v11:form:${state.user?.id||'user'}:${state.subjectId||'system'}:${id}`;
const key=form=>keyById(form.id);
const safeParse=v=>{try{return JSON.parse(v||'null')}catch{return null}};
function readByKey(k){if(cache.has(k))return cache.get(k);let value=null;try{value=safeParse(sessionStorage.getItem(k))}catch{}cache.set(k,value);return value}
const read=form=>readByKey(key(form));
function stable(value){try{return JSON.stringify(value)}catch{return''}}
function write(form,value){
 const k=key(form),prev=cache.get(k),next={...value,updated_at:Date.now()};
 if(prev&&stable({...prev,updated_at:0})===stable({...next,updated_at:0}))return false;
 try{sessionStorage.setItem(k,JSON.stringify(next));cache.set(k,next);return true}catch{return false}
}
function drop(form){const k=key(form);try{sessionStorage.removeItem(k)}catch{}cache.delete(k)}
function clear(id){const k=keyById(id);try{sessionStorage.removeItem(k)}catch{}cache.delete(k)}
function register(id){if(id)allowed.add(String(id));return id}
function unregister(id){allowed.delete(String(id));clear(String(id))}
function values(form){
 const result={};
 for(const el of form.elements){
  if(!el.name||el.type==='file'||el.type==='password')continue;
  if(el.type==='checkbox')result[el.name]=!!el.checked;
  else if(el.type==='radio'){if(el.checked)result[el.name]=el.value}
  else result[el.name]=el.value;
 }
 const matrix=[];
 for(const el of form.querySelectorAll('.clo-count,.matrix-count'))matrix.push({clo:el.dataset.clo||'',topic:el.dataset.topic||'',chapter:el.dataset.chapter||'',value:el.value});
 result.__matrix=matrix;
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
 const matrixMap=new Map();
 for(const el of form.querySelectorAll('.clo-count,.matrix-count'))matrixMap.set(`${el.dataset.clo||''}|${el.dataset.topic||''}|${el.dataset.chapter||''}`,el);
 for(const item of data.__matrix||[]){
  const el=matrixMap.get(`${item.clo||''}|${item.topic||''}|${item.chapter||''}`);
  if(el){el.value=item.value;el.dispatchEvent(new Event('input'))}
 }
 return true;
}
function flush(form){if(!form||!allowed.has(form.id))return false;return write(form,values(form))}
function schedule(form){clearTimeout(timers.get(form));timers.set(form,setTimeout(()=>{timers.delete(form);flush(form)},SAVE_IDLE_MS))}
function cleanupAfterSubmit(form){
 const check=()=>{if(!document.body.contains(form)){drop(form);return true}return false};
 setTimeout(()=>{if(check())return;setTimeout(()=>{if(check())return;setTimeout(check,2400)},900)},250)
}
function bind(form){
 if(!form||!allowed.has(form.id)||bound.has(form))return;
 bound.add(form);form.dataset.persistBound='1';
 const saved=read(form);
 if(restore(form,saved))setTimeout(()=>window.toast?.('Đã khôi phục nội dung đang làm'),0);
 else flush(form);
 form.addEventListener('input',()=>schedule(form));
 form.addEventListener('change',()=>schedule(form));
 form.addEventListener('submit',()=>{clearTimeout(timers.get(form));timers.delete(form);flush(form);cleanupAfterSubmit(form)});
 form.addEventListener('click',event=>{const button=event.target.closest('button');if(button&&/^(Hủy|Quay lại)/i.test(button.textContent.trim()))drop(form)});
}
function scan(root=document){
 if(root?.matches?.('form[id]'))bind(root);
 root?.querySelectorAll?.('form[id]').forEach(bind)
}
function flushVisibleForms(){document.querySelectorAll('form[data-persist-bound="1"]').forEach(form=>{clearTimeout(timers.get(form));timers.delete(form);flush(form)})}
function relevantAddedNode(node){return node?.nodeType===1&&(node.matches?.('form[id]')||node.querySelector?.('form[id]'))}
function initObserver(){
 const root=document.body||document.documentElement;if(!root)return;
 new MutationObserver(records=>{for(const record of records){for(const node of record.addedNodes){if(relevantAddedNode(node))scan(node)}}}).observe(root,{childList:true,subtree:true})
}
function init(){scan(document);initObserver()}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
document.addEventListener('visibilitychange',()=>{if(document.hidden)flushVisibleForms()});
window.addEventListener('pagehide',flushVisibleForms);
window.AICLO_FORM_PERSISTENCE=Object.freeze({
 version:VERSION,
 flush,
 clear,
 clearForm:form=>form&&drop(form),
 snapshot:id=>readByKey(keyById(id)),
 register,
 unregister,
 isRegistered:id=>allowed.has(String(id)),
 scan
});
})();
