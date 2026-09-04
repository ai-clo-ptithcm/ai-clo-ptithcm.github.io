/* AI-CLO PTITHCM V11.8.6 — small scroll/focus stability guard.
   Scope: assessment structure matrix + already-mounted exam detail/builder on Chrome tab resume.
   No data writes, no observers outside these two UI surfaces. */
(()=>{
'use strict';
const VERSION='11.8.6';
let matrixRestore=null;
let resumeState=null;
let modalObserver=null;

const modalBody=()=>document.querySelector('#modalBody');
const liveKind=()=>document.querySelector('.ub-workspace')?'exam-builder':document.querySelector('.assessment-detail-page')?'exam-detail':'';

function rememberMatrixInput(e){
 const input=e.target?.closest?.('#ubStructureForm .ub-matrix-input');
 if(!input)return;
 const body=modalBody();
 if(!body)return;
 matrixRestore={
  key:input.dataset.key||'',
  scrollTop:body.scrollTop,
  scrollLeft:body.scrollLeft,
  at:Date.now()
 };
}

function restoreMatrixPosition(){
 const s=matrixRestore;
 if(!s||Date.now()-s.at>800)return;
 const body=modalBody();
 if(!body||!document.querySelector('#ubStructureForm'))return;
 body.scrollTop=s.scrollTop;
 body.scrollLeft=s.scrollLeft;
 if(s.key){
  const input=[...document.querySelectorAll('#ubStructureForm .ub-matrix-input')].find(x=>x.dataset.key===s.key);
  if(input){
   try{input.focus({preventScroll:true})}catch{input.focus()}
   body.scrollTop=s.scrollTop;
   body.scrollLeft=s.scrollLeft;
  }
 }
}

function installModalObserver(){
 const body=modalBody();
 if(!body||modalObserver)return;
 modalObserver=new MutationObserver(()=>{
  if(!matrixRestore)return;
  requestAnimationFrame(()=>restoreMatrixPosition());
 });
 modalObserver.observe(body,{childList:true,subtree:true});
}

function rememberResumePosition(){
 const kind=liveKind();
 if(!kind)return;
 resumeState={kind,y:Math.max(0,Math.round(window.scrollY||0)),x:Math.max(0,Math.round(window.scrollX||0)),at:Date.now()};
 try{window.AICLO_SUBPAGE_STATE?.savePosition?.()}catch{}
}

function restoreResumePosition(){
 const s=resumeState;
 if(!s||Date.now()-s.at>15*60*1000||liveKind()!==s.kind)return;
 const restore=()=>{
  if(liveKind()!==s.kind)return;
  window.scrollTo({top:s.y,left:s.x,behavior:'auto'});
 };
 requestAnimationFrame(()=>requestAnimationFrame(restore));
 setTimeout(restore,90);
 setTimeout(restore,240);
}

function init(){
 installModalObserver();
 document.addEventListener('input',rememberMatrixInput,true);
 document.addEventListener('visibilitychange',()=>{
  if(document.hidden)rememberResumePosition();
  else restoreResumePosition();
 });
 window.addEventListener('pagehide',rememberResumePosition);
 window.addEventListener('pageshow',restoreResumePosition);
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
window.AICLO_SCROLL_STABILITY=Object.freeze({version:VERSION,restore:restoreResumePosition});
})();
