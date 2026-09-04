/* AI-CLO PTITHCM V11.8.7 — small scroll/focus stability guard.
   Scope: assessment structure matrix + already-mounted exam detail/builder on Chrome tab resume.
   No data writes. */
(()=>{
'use strict';
const VERSION='11.8.7';
let matrixRestore=null;
let resumeState=null;
let modalObserver=null;
let resumeCancelled=false;
let resumeLockUntil=0;

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
 try{window.AICLO_SUBPAGE_STATE?.savePosition?.()}catch{}
}

function cancelResumeOnUserIntent(){
 if(Date.now()<resumeLockUntil)resumeCancelled=true;
}

function restoreResumePosition(){
 const s=resumeState;
 if(!s||Date.now()-s.at>15*60*1000||liveKind()!==s.kind)return;
 resumeCancelled=false;
 resumeLockUntil=Date.now()+1400;
 const restore=()=>{
  if(resumeCancelled||Date.now()>resumeLockUntil||liveKind()!==s.kind)return;
  window.scrollTo({top:s.y,left:s.x,behavior:'auto'});
  const el=scroller();if(el){el.scrollTop=s.y;el.scrollLeft=s.x}
 };
 requestAnimationFrame(()=>requestAnimationFrame(restore));
 [70,160,300,520,820,1150,1350].forEach(ms=>setTimeout(restore,ms));
}

function keyScrollIntent(e){
 if(['ArrowUp','ArrowDown','PageUp','PageDown','Home','End',' '].includes(e.key))cancelResumeOnUserIntent();
}

function init(){
 installModalObserver();
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
