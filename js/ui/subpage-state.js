/* AI-CLO PTITHCM V11.8.1 — shared subpage/workspace persistence.
   One state contract for detail pages, builders and full-page workspaces.
   Existing module-specific draft stores remain the source of form data; this layer restores WHERE the user was. */
(()=>{
'use strict';
const VERSION='11.8.1';
const TTL=12*60*60*1000;
let restoring=false,queued=false,observer=null,pendingStudentId='';
const userId=()=>state?.user?.id||'guest';
const key=()=>`aiclo:v1181:subpage:${userId()}`;
const safeParse=v=>{try{return JSON.parse(v||'null')}catch{return null}};
const read=()=>{try{const x=safeParse(sessionStorage.getItem(key()));if(!x)return null;if(Date.now()-(+x.updated_at||0)>TTL){sessionStorage.removeItem(key());return null}return x}catch{return null}};
const write=x=>{try{sessionStorage.setItem(key(),JSON.stringify({...x,updated_at:Date.now()}))}catch{}};
const clear=()=>{try{sessionStorage.removeItem(key())}catch{}pendingStudentId=''};
const context=()=>({space:state?.space||'system',view:state?.view||'dashboard',subjectId:state?.subjectId||null});
function remember(kind,payload={}){if(restoring)return;write({...context(),kind,...payload,scrollY:Math.max(0,Math.round(window.scrollY||0))})}
function sameContext(x){return !!x&&x.space===(state?.space||'system')&&x.view===(state?.view||'dashboard')&&(x.subjectId||null)===(state?.subjectId||null)}
function activeExamId(){try{return sessionStorage.getItem(`aiclo:v115:active-exam:${state.subjectId}`)||''}catch{return''}}
function activeBuilder(){try{return safeParse(localStorage.getItem(`aiclo:v118:active:${userId()}:${state.subjectId}`))}catch{return null}}
function questionWorkspace(){try{return window.AICLO_QUESTION_WORKSPACE?.current?.()||window.AICLO_QUESTION_WORKSPACE?.review?.()||null}catch{return null}}
function finalWorkspace(){try{return safeParse(sessionStorage.getItem(`ai-clo:v11:final-workspace:${userId()}:${state.subjectId||'subject'}`))}catch{return null}}
function detect(){
 if(restoring)return;
 if(document.querySelector('.assessment-detail-page')){const id=activeExamId();if(id)remember('exam-detail',{entityType:'exam',entityId:id});return}
 if(document.querySelector('.ub-workspace')){const a=activeBuilder();if(a?.type)remember('exam-builder',{entityType:a.type,entityId:a.examId||null,mode:a.type});return}
 if(document.querySelector('.academic-profile-page')){const old=read(),id=pendingStudentId||(old?.kind==='student-profile'?old.entityId:'');if(id)remember('student-profile',{entityType:'student',entityId:id,originView:old?.originView||state.view});return}
 if(document.querySelector('.question-workspace')){const q=questionWorkspace(),f=finalWorkspace();if(f){remember('final-workspace',{entityType:'final_exam',mode:f.stage||'matrix'});return}if(q){remember('question-workspace',{entityType:q.kind||'question',entityId:q.id||null,mode:q.bank||null});return}}
}
function savePosition(){const x=read();if(!x||!sameContext(x))return;write({...x,scrollY:Math.max(0,Math.round(window.scrollY||0))})}
function waitFor(fn,timeout=3500){return new Promise(resolve=>{const start=Date.now(),tick=()=>{let v;try{v=fn()}catch{}if(v)return resolve(v);if(Date.now()-start>=timeout)return resolve(null);setTimeout(tick,60)};tick()})}
async function fetchExam(id){if(!id)return null;try{const {data,error}=await db.from('exams').select('*').eq('id',id).maybeSingle();if(error)throw error;return data||null}catch(e){console.warn('AI-CLO subpage: cannot load exam',e);return null}}
async function restoreExamDetail(x){
 if(document.querySelector('.assessment-detail-page'))return true;
 const exam=await fetchExam(x.entityId);if(!exam){clear();return false}
 const fn=window.AICLO_ASSESSMENT?.openExamDetail||window.openExamAttempts;
 if(typeof fn!=='function')return false;
 await fn(exam);return !!document.querySelector('.assessment-detail-page')
}
async function restoreExamBuilder(x){
 if(document.querySelector('.ub-workspace'))return true;
 try{await window.AICLO_FEATURES?.ensureView?.('exams')}catch{}
 const fn=window.AICLO_EXAM_BUILDER?.open;if(typeof fn!=='function')return false;
 await fn(x.mode||x.entityType||'chapter_test',x.entityId||null);return !!document.querySelector('.ub-workspace')
}
async function restoreStudentProfile(x){
 if(document.querySelector('.academic-profile-page'))return true;
 pendingStudentId=x.entityId||'';
 let button=await waitFor(()=>document.querySelector(`[data-profile="${CSS.escape(x.entityId||'')}"]`)||document.querySelector(`[data-student-profile="${CSS.escape(x.entityId||'')}"]`),1800);
 if(!button&&typeof window.render==='function'){await window.render();button=await waitFor(()=>document.querySelector(`[data-profile="${CSS.escape(x.entityId||'')}"]`)||document.querySelector(`[data-student-profile="${CSS.escape(x.entityId||'')}"]`),2200)}
 if(!button)return false;button.click();return !!(await waitFor(()=>document.querySelector('.academic-profile-page'),2500))
}
async function restoreQuestionWorkspace(){
 if(document.querySelector('.question-workspace'))return true;
 if(typeof window.render==='function')await window.render();return !!(await waitFor(()=>document.querySelector('.question-workspace'),2500))
}
async function restoreFinalWorkspace(){
 if(document.querySelector('.question-workspace'))return true;
 try{await window.AICLO_FEATURES?.ensureView?.('exams')}catch{}
 if(typeof window.render==='function')await window.render();return !!(await waitFor(()=>document.querySelector('.question-workspace'),3000))
}
async function restore(reason='auto'){
 if(restoring)return false;const x=read();if(!x||!sameContext(x))return false;
 const already=(x.kind==='exam-detail'&&document.querySelector('.assessment-detail-page'))||(x.kind==='exam-builder'&&document.querySelector('.ub-workspace'))||(x.kind==='student-profile'&&document.querySelector('.academic-profile-page'))||((x.kind==='question-workspace'||x.kind==='final-workspace')&&document.querySelector('.question-workspace'));
 if(already)return true;
 restoring=true;let ok=false;
 try{
  if(x.kind==='exam-detail')ok=await restoreExamDetail(x);
  else if(x.kind==='exam-builder')ok=await restoreExamBuilder(x);
  else if(x.kind==='student-profile')ok=await restoreStudentProfile(x);
  else if(x.kind==='question-workspace')ok=await restoreQuestionWorkspace(x);
  else if(x.kind==='final-workspace')ok=await restoreFinalWorkspace(x);
  if(ok&&Number.isFinite(+x.scrollY)){const y=Math.max(0,+x.scrollY);requestAnimationFrame(()=>requestAnimationFrame(()=>window.scrollTo({top:y,left:0,behavior:'auto'})))}
 }catch(e){console.warn(`AI-CLO subpage restore (${reason})`,e)}finally{restoring=false}
 return ok
}
function queueRestore(reason){if(queued||document.hidden)return;queued=true;setTimeout(async()=>{queued=false;await restore(reason)},50)}
function applyStartupLocation(){const x=read();if(!x)return;if(x.subjectId){state.subjectId=x.subjectId;try{localStorage.setItem('aiclo_subject',x.subjectId)}catch{}}if(x.space){state.space=x.space;try{localStorage.setItem('aiclo_space',x.space)}catch{}}if(x.view)state.view=x.view}
function installEnterApp(){const base=window.enterApp;if(typeof base!=='function'||base.__aicloSubpageState)return;const wrapped=function(...args){applyStartupLocation();const r=base.apply(this,args);Promise.resolve(r).finally(()=>queueRestore('enter-app'));return r};wrapped.__aicloSubpageState=true;wrapped.__aicloBase=base;window.enterApp=wrapped}
function explicitLeaveTarget(el){return el?.closest?.('#nav [data-view],#systemHomeBtn,#courseSystemReturn,#logoutBtn,[data-open-course],#examDetailBack,#academicProfileBack,#questionBack,#finalAssessmentListBack')}
document.addEventListener('click',e=>{
 const target=e.target.closest?.('[data-attempts],[data-profile],[data-student-profile]');
 if(target?.dataset.attempts&&!document.querySelector('.assessment-detail-page'))remember('exam-detail',{entityType:'exam',entityId:target.dataset.attempts});
 if(target?.dataset.profile||target?.dataset.studentProfile){pendingStudentId=target.dataset.profile||target.dataset.studentProfile;remember('student-profile',{entityType:'student',entityId:pendingStudentId,originView:state.view})}
 if(explicitLeaveTarget(e.target))clear();
},true);
document.addEventListener('change',e=>{if(e.target?.matches?.('#subjectSelect'))clear()},true);
document.addEventListener('visibilitychange',()=>{if(document.hidden){detect();savePosition()}else queueRestore('visible')});
window.addEventListener('pagehide',()=>{detect();savePosition()});
window.addEventListener('pageshow',()=>queueRestore('pageshow'));
window.addEventListener('scroll',()=>{clearTimeout(window.__aicloSubpageScrollTimer);window.__aicloSubpageScrollTimer=setTimeout(savePosition,120)},{passive:true});
function init(){installEnterApp();const host=document.querySelector('#content');if(host&&!observer){observer=new MutationObserver(()=>{requestAnimationFrame(()=>{detect();queueRestore('content-change')})});observer.observe(host,{childList:true,subtree:true})}detect();queueRestore('init')}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
window.AICLO_SUBPAGE_STATE=Object.freeze({version:VERSION,remember,clear,current:read,restore:()=>restore('api'),detect,savePosition,isRestoring:()=>restoring});
})();
