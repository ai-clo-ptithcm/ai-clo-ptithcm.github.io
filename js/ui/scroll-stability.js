/* AI-CLO PTITHCM V11.8.8 — small scroll/focus stability guard.
   Scope: assessment structure matrix + already-mounted exam detail/builder on Chrome tab resume.
   No data writes. */
(()=>{
'use strict';
const VERSION='11.8.8';
let matrixRestore=null;
let resumeState=null;
let modalObserver=null;
let resumeCancelled=false;
let resumeLockUntil=0;
let resumeRenderArmed=false;
let resumeRenderUntil=0;
let guardedKind='';

const modalBody=()=>document.querySelector('#modalBody');
const liveKind=()=>document.querySelector('.ub-workspace')?'exam-builder':document.querySelector('.assessment-detail-page')?'exam-detail':'';
const scroller=()=>document.scrollingElement||document.documentElement;
const scrollPoint=()=>({x:Math.max(0,Math.round(window.scrollX||scroller()?.scrollLeft||0)),y:Math.max(0,Math.round(window.scrollY||scroller()?.scrollTop||0))});

function rememberMatrixInput(e){
 const input=e.target?.closest?.('#ubStructureForm .ub-matrix-input');
 if(!input)return;
 const body=modalBody();
 if(!body)return;
 matrixRestore={key:input.dataset.key||'',scrollTop:body.scrollTop,scrollLeft:body.scrollLeft,at:Date.now()};
}

function restoreMatrixPosition(){
 const s=matrixRestore;
 if(!s||Date.now()-s.at>1000)return;
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
  if(matrixRestore)requestAnimationFrame(restoreMatrixPosition);
 });
 modalObserver.observe(body,{childList:true,subtree:true});
}

function rememberResumePosition(){
 const kind=liveKind();
 if(!kind)return;
 const p=scrollPoint();
 resumeState={kind,x:p.x,y:p.y,at:Date.now()};
 guardedKind=kind;
 resumeRenderArmed=true;
 resumeRenderUntil=0;
 try{window.AICLO_SUBPAGE_STATE?.savePosition?.()}catch{}
}

function shouldSuppressResumeRender(){
 if(resumeCancelled||state?.view!=='exams')return false;
 const kind=liveKind();
 if(!kind||kind!==guardedKind)return false;
 if(resumeRenderArmed)return true;
 return Date.now()<resumeRenderUntil;
}

function wrapResumeRender(name){
 const base=window[name];
 if(typeof base!=='function'||base.__aicloResumeRenderGuard)return;
 const wrapped=function(...args){
  if(shouldSuppressResumeRender()){
   console.debug(`AI-CLO: giữ nguyên ${guardedKind} khi Chrome khôi phục tab; bỏ qua ${name}() nền.`);
   return Promise.resolve();
  }
  return base.apply(this,args);
 };
 wrapped.__aicloResumeRenderGuard=true;
 wrapped.__aicloBase=base;
 window[name]=wrapped;
}

function installResumeRenderGuards(){
 wrapResumeRender('render');
 wrapResumeRender('exams');
}

function cancelResumeOnUserIntent(){
 if(Date.now()<resumeLockUntil||resumeRenderArmed||Date.now()<resumeRenderUntil){
  resumeCancelled=true;
  resumeRenderArmed=false;
  resumeRenderUntil=0;
 }
}

function restoreResumePosition(){
 const s=resumeState;
 if(!s||Date.now()-s.at>15*60*1000||liveKind()!==s.kind){
  resumeRenderArmed=false;
  resumeRenderUntil=0;
  return;
 }
 resumeCancelled=false;
 resumeRenderArmed=false;
 resumeRenderUntil=Date.now()+1250;
 resumeLockUntil=Date.now()+1400;
 const restore=()=>{
  if(resumeCancelled||Date.now()>resumeLockUntil||liveKind()!==s.kind)return;
  window.scrollTo({top:s.y,left:s.x,behavior:'auto'});
  const el=scroller();if(el){el.scrollTop=s.y;el.scrollLeft=s.x}
 };
 requestAnimationFrame(()=>requestAnimationFrame(restore));
 [70,160,300,520,820,1150,1350].forEach(ms=>setTimeout(restore,ms));
 setTimeout(()=>{resumeRenderUntil=0},1350);
}

function keyScrollIntent(e){
 if(['ArrowUp','ArrowDown','PageUp','PageDown','Home','End',' '].includes(e.key))cancelResumeOnUserIntent();
}

function init(){
 installModalObserver();
 installResumeRenderGuards();
 document.addEventListener('input',rememberMatrixInput,true);
 document.addEventListener('wheel',cancelResumeOnUserIntent,{capture:true,passive:true});
 document.addEventListener('touchstart',cancelResumeOnUserIntent,{capture:true,passive:true});
 document.addEventListener('pointerdown',cancelResumeOnUserIntent,true);
 document.addEventListener('keydown',keyScrollIntent,true);
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
