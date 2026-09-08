/* AI-CLO PTITHCM V12.6.28-kiemnghiem — canonical per-view subpage/workspace persistence.
   Navigation owns top-level history; this layer only preserves/restores the child screen inside each view. */
(()=>{
'use strict';
const VERSION='12.6.28-kiemnghiem';
const TTL=24*60*60*1000;
const SCROLL_IDLE_MS=400;
let restoring=false,scrollTimer=null,pendingStudentId='';
const registry=new Map(),liveCache=new Map();
let cacheUser='',cacheBucket=null;
const safeParse=v=>{try{return JSON.parse(v||'null')}catch{return null}};
const userId=()=>state?.user?.id||'guest';
const bucketKey=()=>`aiclo:v126:subpages:${userId()}`;
const legacyKeys=()=>[`aiclo:v1182:subpage:${userId()}`,`aiclo:v1181:subpage:${userId()}`];
const context=()=>({space:state?.space||'system',view:state?.view||'dashboard',subjectId:state?.subjectId||null});
const contextKey=x=>`${x?.space||'system'}|${x?.subjectId||''}|${x?.view||'dashboard'}`;
const normalizeSnapshot=x=>x?{...x,subjectId:x.subjectId||null}:null;
function blankBucket(){return {version:1,items:{}}}
function saveBucket(bucket){
 try{sessionStorage.setItem(bucketKey(),JSON.stringify(bucket));cacheUser=userId();cacheBucket=bucket;return true}catch{return false}
}
function migrateLegacy(bucket){
 for(const key of legacyKeys()){
  let x=null;try{x=safeParse(sessionStorage.getItem(key))}catch{}
  if(!x)continue;
  x=normalizeSnapshot(x);
  if(Date.now()-(+x.updated_at||0)<=TTL)bucket.items[contextKey(x)]=x;
  try{sessionStorage.removeItem(key)}catch{}
 }
 return bucket;
}
function readBucket(){
 const uid=userId();if(cacheUser===uid&&cacheBucket)return cacheBucket;
 let bucket=null;try{bucket=safeParse(sessionStorage.getItem(bucketKey()))}catch{}
 if(!bucket||typeof bucket!=='object'||!bucket.items)bucket=blankBucket();
 migrateLegacy(bucket);
 const now=Date.now();
 for(const [key,x] of Object.entries(bucket.items||{}))if(!x||now-(+x.updated_at||0)>TTL)delete bucket.items[key];
 cacheUser=uid;cacheBucket=bucket;saveBucket(bucket);return bucket;
}
function current(){return readBucket().items[contextKey(context())]||null}
function writeSnapshot(x){
 if(!x)return false;const bucket=readBucket(),value={...normalizeSnapshot(x),updated_at:Date.now()};
 bucket.items[contextKey(value)]=value;return saveBucket(bucket)
}
function remember(kind,payload={}){
 if(restoring||!kind)return false;
 return writeSnapshot({...context(),kind,...payload,scrollY:Math.max(0,Math.round(window.scrollY||0))})
}
function clear(target=context()){
 const bucket=readBucket(),key=contextKey(target);liveCache.delete(key);if(!(key in bucket.items))return false;delete bucket.items[key];return saveBucket(bucket)
}
function liveWorkspace(){return document.querySelector('.assessment-builder-v122,.assessment-detail-v122,.assessment-export-center,.assessment-final-builder-v122,.assessment-final-detail-v122,.question-workspace,.academic-profile-page')}
function stashLive(){
 const host=document.querySelector('#content');if(!host||!liveWorkspace()||document.querySelector('.student-attempt-page'))return false;
 const key=contextKey(context()),fragment=document.createDocumentFragment();while(host.firstChild)fragment.append(host.firstChild);liveCache.set(key,{fragment,scrollY:Math.max(0,Math.round(window.scrollY||0))});return true
}
function restoreLive(target=context()){
 const key=contextKey(target),saved=liveCache.get(key),host=document.querySelector('#content');if(!saved||!host)return false;
 host.replaceChildren(...saved.fragment.childNodes);liveCache.delete(key);const y=saved.scrollY||0;requestAnimationFrame(()=>requestAnimationFrame(()=>window.scrollTo({top:y,left:0,behavior:'auto'})));return true
}

function savePosition(){
 const x=current();if(!x)return false;const y=Math.max(0,Math.round(window.scrollY||0));
 if(Math.abs((+x.scrollY||0)-y)<4)return false;return writeSnapshot({...x,scrollY:y})
}
function register(kind,spec={}){
 if(!kind||typeof spec.restore!=='function')return()=>{};
 registry.set(kind,{detect:typeof spec.detect==='function'?spec.detect:null,isActive:typeof spec.isActive==='function'?spec.isActive:null,restore:spec.restore});
 return()=>registry.delete(kind)
}
function unregister(kind){registry.delete(kind)}
function genericMarker(){
 const el=document.querySelector('[data-aiclo-subpage-kind]');if(!el)return null;
 return {kind:el.dataset.aicloSubpageKind,entityType:el.dataset.aicloEntityType||null,entityId:el.dataset.aicloEntityId||null,mode:el.dataset.aicloSubpageMode||null}
}
function detect(){
 if(restoring)return false;
 const marker=genericMarker();if(marker?.kind){remember(marker.kind,marker);return true}
 for(const [kind,spec] of registry){
  if(!spec.detect)continue;let payload=null;try{payload=spec.detect()}catch{}
  if(payload){remember(kind,payload===true?{}:payload);return true}
 }
 return false
}
async function restore(reason='auto'){
 if(restoring||document.hidden)return false;
 const x=current();if(!x)return false;const spec=registry.get(x.kind);if(!spec)return false;
 try{if(spec.isActive?.(x))return true}catch{}
 restoring=true;let ok=false;
 try{
  ok=!!(await spec.restore(x));
  if(ok&&Number.isFinite(+x.scrollY)){
   const y=Math.max(0,+x.scrollY);requestAnimationFrame(()=>requestAnimationFrame(()=>window.scrollTo({top:y,left:0,behavior:'auto'})))
  }
 }catch(e){console.warn(`AI-CLO subpage restore (${reason}/${x.kind})`,e)}finally{restoring=false}
 return ok
}
function beforeNavigate(){detect();savePosition();stashLive();return true}
async function afterNavigate(){return restore('navigate')}
function visible(el){if(!el)return false;const style=getComputedStyle(el);return style.display!=='none'&&style.visibility!=='hidden'&&!el.disabled}
async function back(){
 const drawer=document.querySelector('#sideDrawer:not(.hidden)');
 if(drawer){
  const drawerBack=document.querySelector('#drawerBack:not(.hidden)');
  if(visible(drawerBack)){drawerBack.click();return true}
  const drawerClose=document.querySelector('#drawerClose');if(drawerClose){drawerClose.click();return true}
 }
 const selectors=[
  '#v122BuilderBack','#v1235ExportBack','#v122Back','#v125StudentExamBack','#v124AttemptBack',
  '#questionBack','#finalAssessmentListBack','[data-aiclo-subpage-back]'
 ];
 for(const selector of selectors){
  const button=document.querySelector(selector);if(!visible(button))continue;
  clear();button.click();return true
 }
 return false
}
function applyStartupLocation(){
 const savedSpace=localStorage.getItem('aiclo_space')==='course'?'course':'system';
 const savedView=localStorage.getItem('aiclo_view')||state?.view||'dashboard';
 const savedSubject=localStorage.getItem('aiclo_subject')||state?.subjectId||null;
 const x=readBucket().items[contextKey({space:savedSpace,view:savedView,subjectId:savedSubject})];
 if(!x)return false;
 state.space=x.space||savedSpace;state.view=x.view||savedView;
 if(x.subjectId){state.subjectId=x.subjectId;localStorage.setItem('aiclo_subject',x.subjectId)}
 return true
}
function waitFor(fn,timeout=3500){return new Promise(resolve=>{const start=Date.now(),tick=()=>{let v;try{v=fn()}catch{}if(v)return resolve(v);if(Date.now()-start>=timeout)return resolve(null);setTimeout(tick,60)};tick()})}
function activeBuilder(){try{return safeParse(localStorage.getItem(`aiclo:v118:active:${userId()}:${state.subjectId}`))}catch{return null}}
function questionWorkspace(){try{return window.AICLO_QUESTION_WORKSPACE?.current?.()||window.AICLO_QUESTION_WORKSPACE?.review?.()||null}catch{return null}}
function finalWorkspace(){try{return safeParse(sessionStorage.getItem(`ai-clo:v11:final-workspace:${userId()}:${state.subjectId||'subject'}`))}catch{return null}}
register('exam-builder',{
 detect(){if(!document.querySelector('.ub-workspace'))return null;const a=activeBuilder();return a?.type?{entityType:a.type,entityId:a.examId||null,mode:a.type}:null},
 isActive:()=>!!document.querySelector('.ub-workspace'),
 async restore(x){try{await window.AICLO_FEATURES?.ensureView?.('exams')}catch{}const fn=window.AICLO_EXAM_BUILDER?.open;if(typeof fn!=='function')return false;await fn(x.mode||x.entityType||'chapter_test',x.entityId||null);return !!document.querySelector('.ub-workspace')}
});
register('student-profile',{
 detect(){if(!document.querySelector('.academic-profile-page'))return null;const old=current(),id=pendingStudentId||(old?.kind==='student-profile'?old.entityId:'');return id?{entityType:'student',entityId:id,originView:old?.originView||state.view}:null},
 isActive:()=>!!document.querySelector('.academic-profile-page'),
 async restore(x){pendingStudentId=x.entityId||'';const id=CSS.escape(x.entityId||'');let button=await waitFor(()=>document.querySelector(`[data-profile="${id}"]`)||document.querySelector(`[data-student-profile="${id}"]`),1700);if(!button&&typeof window.render==='function'){await window.render();button=await waitFor(()=>document.querySelector(`[data-profile="${id}"]`)||document.querySelector(`[data-student-profile="${id}"]`),2200)}if(!button)return false;button.click();return !!(await waitFor(()=>document.querySelector('.academic-profile-page'),2600))}
});
register('question-workspace',{
 detect(){if(!document.querySelector('.question-workspace'))return null;const f=finalWorkspace();if(f)return null;const q=questionWorkspace();return q?{entityType:q.kind||'question',entityId:q.id||null,mode:q.bank||null}:null},
 isActive:()=>!!document.querySelector('.question-workspace')&&!finalWorkspace(),
 async restore(){if(typeof window.render==='function')await window.render();return !!(await waitFor(()=>document.querySelector('.question-workspace'),2600))}
});
register('final-workspace',{
 detect(){if(!document.querySelector('.question-workspace'))return null;const f=finalWorkspace();return f?{entityType:'final_exam',mode:f.stage||'matrix'}:null},
 isActive:()=>!!document.querySelector('.question-workspace')&&!!finalWorkspace(),
 async restore(){try{await window.AICLO_FEATURES?.ensureView?.('exams')}catch{}if(typeof window.render==='function')await window.render();return !!(await waitFor(()=>document.querySelector('.question-workspace'),3200))}
});
document.addEventListener('click',e=>{
 const target=e.target.closest?.('[data-profile],[data-student-profile]');
 if(target){pendingStudentId=target.dataset.profile||target.dataset.studentProfile||'';if(pendingStudentId)remember('student-profile',{entityType:'student',entityId:pendingStudentId,originView:state.view})}
},true);
document.addEventListener('visibilitychange',()=>{if(document.hidden){detect();savePosition()}else restore('visible')});
window.addEventListener('pagehide',()=>{detect();savePosition()});
window.addEventListener('pageshow',()=>restore('pageshow'));
window.addEventListener('scroll',()=>{clearTimeout(scrollTimer);scrollTimer=setTimeout(()=>{scrollTimer=null;savePosition()},SCROLL_IDLE_MS)},{passive:true});
window.AICLO_SUBPAGE_STATE=Object.freeze({
 version:VERSION,remember,clear,current,restore:()=>restore('api'),detect,savePosition,isRestoring:()=>restoring,
 register,unregister,applyStartupLocation,beforeNavigate,afterNavigate,restoreLive,back
});
})();
