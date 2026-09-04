/* AI-CLO PTITHCM V11.9.2 — keep the create button routed to the 4-step wizard after legacy enhancers run. */
(()=>{
'use strict';
let frame1=0,frame2=0;
function bind(){
 const add=document.querySelector('#addExam');
 const start=window.AICLO_CREATE_WIZARD?.start;
 if(!add||typeof start!=='function')return;
 add.dataset.cwBound='1';
 add.onclick=()=>start();
}
function schedule(){
 cancelAnimationFrame(frame1);cancelAnimationFrame(frame2);
 frame1=requestAnimationFrame(()=>{frame2=requestAnimationFrame(bind)});
}
function init(){
 const content=document.querySelector('#content');
 if(content)new MutationObserver(schedule).observe(content,{childList:true,subtree:true});
 schedule();
 document.addEventListener('click',e=>{
  if(e.target?.closest?.('[data-view="exams"]'))setTimeout(schedule,0);
 },true);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
window.AICLO_CREATE_WIZARD_BIND=Object.freeze({version:'11.9.2',bind,schedule});
})();
