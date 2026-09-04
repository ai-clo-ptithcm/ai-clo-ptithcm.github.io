/* AI-CLO PTITHCM V11.8.3 — shared subpage/workspace persistence.
   One state contract for every full-page child workspace.
   Module-specific draft stores remain the source of form data; this layer restores WHERE the user was. */
(()=>{
'use strict';
const VERSION='11.8.3';
const TTL=24*60*60*1000;
let restoring=false,queued=false,observer=null,pendingStudentId='',navigationInstalled=false;
const registry=new Map();
const userId=()=>state?.user?.id||'guest';
const storageKey=()=>`aiclo:v1182:subpage:${userId()}`;
const legacyKey=()=>`aiclo:v1181:subpage:${userId()}`;
const safeParse=v=>{try{return JSON.parse(v||'null')}catch{return null}};
function readRaw(){try{return safeParse(sessionStorage.getItem(storageKey()))||safeParse(sessionStorage.getItem(legacyKey()))}catch{return null}}
function read(){const x=readRaw();if(!x)return null;if(Date.now()-(+x.updated_at||0)>TTL){clear();return null}return x}
function write(x){try{sessionStorage.setItem(storageKey(),JSON.stringify({...x,updated_at:Date.now()}));sessionStorage.removeItem(legacyKey())}catch{}}
function clear(){try{sessionStorage.removeItem(storageKey());sessionStorage.removeItem(legacyKey())}catch{}pendingStudentId=''}
const context=()=>({space:state?.space||'system',view:state?.view||'dashboard',subjectId:state?.subjectId||null});
function remember(kind,payload={}){if(restoring||!kind)return;write({...context(),kind,...payload,scrollY:Math.max(0,Math.round(window.scrollY||0))})}
function sameContext(x){return !!x&&x.space===(state?.space||'system')&&x.view===(state?.view||'dashboard')&&(x.subjectId||null)===(state?.subjectId||null)}
function savePosition(){const x=read();if(!x||!sameContext(x))return;write({...x,scrollY:Math.max(0,Math.round(window.scrollY||0))})}
function waitFor(fn,timeout=3500){return new Promise(resolve=>{const start=Date.now(),tick=()=>{let v;try{v=fn()}catch{}if(v)return resolve(v);if(Date.now()-start>=timeout)return resolve(null);setTimeout(tick,60)};tick()})}
function register(kind,spec={}){if(!kind||typeof spec.restore!=='function')return()=>{};registry.set(kind,{detect:typeof spec.detect==='function'?spec.detect:null,isActive:typeof spec.isActive==='function'?spec.isActive:null,restore:spec.restore});return()=>registry.delete(kind)}
function unregister(kind){registry.delete(kind)}
function genericMarker(){const el=document.querySelector('[data-aiclo-subpage-kind]');if(!el)return null;return {kind:el.dataset.aicloSubpageKind,entityType:el.dataset.aicloEntityType||null,entityId:el.dataset.aicloEntityId||null,mode:el.dataset.aicloSubpageMode||null}}
function activeExamId(){try{return sessionStorage.getItem(`aiclo:v115:active-exam:${state.subjectId}`)||''}catch{return''}}
function activeBuilder(){try{return safeParse(localStorage.getItem(`aiclo:v118:active:${userId()}:${state.subjectId}`))}catch{return null}}
function questionWorkspace(){try{return window.AICLO_QUESTION_WORKSPACE?.current?.()||window.AICLO_QUESTION_WORKSPACE?.review?.()||null}catch{return null}}
function finalWorkspace(){try{return safeParse(sessionStorage.getItem(`ai-clo:v11:final-workspace:${userId()}:${state.subjectId||'subject'}`))}catch{return null}}
function detect(){
 if(restoring)return;
 const marker=genericMarker();if(marker?.kind){remember(marker.kind,marker);return}
 for(const [kind,spec] of registry){if(!spec.detect)continue;let payload=null;try{payload=spec.detect()}catch{}if(payload){remember(kind,payload===true?{}:payload);return}}
}
async function restore(reason='auto'){
 if(restoring)return false;const x=read();if(!x||!sameContext(x))return false;
 const spec=registry.get(x.kind);if(!spec)return false;
 try{if(spec.isActive?.(x))return true}catch{}
 restoring=true;let ok=false;
 try{ok=!!(await spec.restore(x));if(ok&&Number.isFinite(+x.scrollY)){const y=Math.max(0,+x.scrollY);requestAnimationFrame(()=>requestAnimationFrame(()=>window.scrollTo({top:y,left:0,behavior:'auto'})))}}catch(e){console.warn(`AI-CLO subpage restore (${reason}/${x.kind})`,e)}finally{restoring=false}
 return ok
}
function liveChildWorkspace(){return !!document.querySelector('.ub-workspace,.assessment-detail-page,.academic-profile-page,.question-workspace')}
function queueRestore(reason){
 if(queued||document.hidden)return;
 /* If the child page is still mounted, do not reopen it just because Chrome resumed the tab.
    Also never restore underneath an active modal. This prevents duplicate builder contexts and stale async handlers. */
 if(liveChildWorkspace()||document.querySelector('#modal[open],#confirmDialog[open]'))return;
 queued=true;setTimeout(async()=>{queued=false;if(document.hidden||liveChildWorkspace()||document.querySelector('#modal[open],#confirmDialog[open]'))return;await restore(reason)},55)
}
function applyStartupLocation(){const x=read();if(!x)return false;if(x.subjectId){state.subjectId=x.subjectId;try{localStorage.setItem('aiclo_subject',x.subjectId)}catch{}}if(x.space){state.space=x.space;try{localStorage.setItem('aiclo_space',x.space)}catch{}}if(x.view)state.view=x.view;return true}
async function fetchExam(id){if(!id)return null;try{const {data,error}=await db.from('exams').select('*').eq('id',id).maybeSingle();if(error)throw error;return data||null}catch(e){console.warn('AI-CLO subpage: cannot load exam',e);return null}}
register('exam-detail',{
 detect(){if(!document.querySelector('.assessment-detail-page'))return null;const id=activeExamId();return id?{entityType:'exam',entityId:id}:null},
 isActive:()=>!!document.querySelector('.assessment-detail-page'),
 async restore(x){const exam=await fetchExam(x.entityId);if(!exam){clear();return false}const fn=window.AICLO_ASSESSMENT?.openExamDetail||window.openExamAttempts;if(typeof fn!=='function')return false;await fn(exam);return !!document.querySelector('.assessment-detail-page')}
});
register('exam-builder',{
 detect(){if(!document.querySelector('.ub-workspace'))return null;const a=activeBuilder();return a?.type?{entityType:a.type,entityId:a.examId||null,mode:a.type}:null},
 isActive:()=>!!document.querySelector('.ub-workspace'),
 async restore(x){try{await window.AICLO_FEATURES?.ensureView?.('exams')}catch{}const fn=window.AICLO_EXAM_BUILDER?.open;if(typeof fn!=='function')return false;await fn(x.mode||x.entityType||'chapter_test',x.entityId||null);return !!document.querySelector('.ub-workspace')}
});
register('student-profile',{
 detect(){if(!document.querySelector('.academic-profile-page'))return null;const old=read(),id=pendingStudentId||(old?.kind==='student-profile'?old.entityId:'');return id?{entityType:'student',entityId:id,originView:old?.originView||state.view}:null},
 isActive:()=>!!document.querySelector('.academic-profile-page'),
 async restore(x){pendingStudentId=x.entityId||'';let selector=`[data-profile="${CSS.escape(x.entityId||'')}"]`;let selector2=`[data-student-profile="${CSS.escape(x.entityId||'')}"]`;let button=await waitFor(()=>document.querySelector(selector)||document.querySelector(selector2),1700);if(!button&&typeof window.render==='function'){await window.render();button=await waitFor(()=>document.querySelector(selector)||document.querySelector(selector2),2200)}if(!button)return false;button.click();return !!(await waitFor(()=>document.querySelector('.academic-profile-page'),2600))}
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
function installEnterApp(){const base=window.enterApp;if(typeof base!=='function'||base.__aicloSubpageState)return;const wrapped=function(...args){applyStartupLocation();const r=base.apply(this,args);Promise.resolve(r).finally(()=>queueRestore('enter-app'));return r};wrapped.__aicloSubpageState=true;wrapped.__aicloBase=base;window.enterApp=wrapped}
function installNavigation(){if(navigationInstalled)return;navigationInstalled=true;const base=window.navigate;if(typeof base!=='function'||base.__aicloSubpageNavigation)return;const wrapped=function(view,...args){if(!restoring){const x=read();if(x&&view!==state.view)clear()}return base.call(this,view,...args)};wrapped.__aicloSubpageNavigation=true;wrapped.__aicloBase=base;window.navigate=wrapped}
function explicitLeaveTarget(el){return el?.closest?.('#nav [data-view],#systemHomeBtn,#courseSystemReturn,#logoutBtn,[data-open-course],#examDetailBack,#academicProfileBack,#questionBack,#finalAssessmentListBack,[data-aiclo-subpage-back]')}
function isBuilderBack(el){const b=el?.closest?.('.ub-workspace button');if(!b)return false;return /quay lại|danh sách/i.test(String(b.textContent||''))}
document.addEventListener('click',e=>{
 const target=e.target.closest?.('[data-attempts],[data-profile],[data-student-profile]');
 if(target?.dataset.attempts&&!document.querySelector('.assessment-detail-page'))remember('exam-detail',{entityType:'exam',entityId:target.dataset.attempts});
 if(target?.dataset.profile||target?.dataset.studentProfile){pendingStudentId=target.dataset.profile||target.dataset.studentProfile;remember('student-profile',{entityType:'student',entityId:pendingStudentId,originView:state.view})}
 if(explicitLeaveTarget(e.target)||isBuilderBack(e.target))clear();
},true);
document.addEventListener('change',e=>{if(e.target?.matches?.('#subjectSelect'))clear()},true);
document.addEventListener('visibilitychange',()=>{if(document.hidden){detect();savePosition()}else queueRestore('visible')});
window.addEventListener('pagehide',()=>{detect();savePosition()});
window.addEventListener('pageshow',()=>queueRestore('pageshow'));
window.addEventListener('scroll',()=>{clearTimeout(window.__aicloSubpageScrollTimer);window.__aicloSubpageScrollTimer=setTimeout(savePosition,120)},{passive:true});
function init(){installEnterApp();installNavigation();const host=document.querySelector('#content');if(host&&!observer){observer=new MutationObserver(()=>{requestAnimationFrame(()=>{detect();queueRestore('content-change')})});observer.observe(host,{childList:true,subtree:true})}detect();queueRestore('init')}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
window.AICLO_SUBPAGE_STATE=Object.freeze({version:VERSION,remember,clear,current:read,restore:()=>restore('api'),detect,savePosition,isRestoring:()=>restoring,register,unregister,applyStartupLocation});
})();
