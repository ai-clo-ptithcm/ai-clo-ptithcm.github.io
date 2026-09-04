/* AI-CLO PTITHCM V11.9.4 — hard takeover of the create-assessment button. Legacy create handlers are removed from the live DOM. */
(()=>{
'use strict';
const WIZARD_SRC='js/exams/create-wizard.js?v=11.9.1';
let loading=null,observer=null;

async function ensureWizard(){
 if(typeof window.AICLO_CREATE_WIZARD?.start==='function')return window.AICLO_CREATE_WIZARD;
 if(!loading){
  loading=(async()=>{
   if(window.AICLO_FEATURES?.load)await window.AICLO_FEATURES.load(WIZARD_SRC);
   else await new Promise((resolve,reject)=>{
    const s=document.createElement('script');
    s.src=WIZARD_SRC;s.async=false;s.onload=resolve;
    s.onerror=()=>reject(new Error('Không tải được wizard tạo bài kiểm tra.'));
    document.head.appendChild(s);
   });
   if(typeof window.AICLO_CREATE_WIZARD?.start!=='function')throw new Error('Không khởi tạo được wizard tạo bài kiểm tra.');
   return window.AICLO_CREATE_WIZARD;
  })().finally(()=>{loading=null});
 }
 return loading;
}

async function launch(){
 try{const api=await ensureWizard();await api.start()}
 catch(error){console.error('AI-CLO create wizard failed',error);window.toast?.('Không mở được trình tạo bài kiểm tra. Vui lòng tải lại trang.',true)}
}

function hardTakeover(){
 const old=document.querySelector('#addExam');
 if(!old||old.dataset.cwHard==='1')return;
 // Clone removes every legacy property/event handler previously attached to this button.
 const add=old.cloneNode(true);
 add.dataset.cwHard='1';
 old.replaceWith(add);
 const handler=event=>{event.preventDefault();event.stopPropagation();launch()};
 add.addEventListener('click',handler);
 // Legacy modules still try `add.onclick = ...`; make those assignments harmless.
 try{Object.defineProperty(add,'onclick',{configurable:false,enumerable:true,get:()=>handler,set:()=>{}})}
 catch{add.onclick=handler}
}

function schedule(){queueMicrotask(hardTakeover);requestAnimationFrame(hardTakeover);setTimeout(hardTakeover,0)}
function init(){
 const content=document.querySelector('#content');
 if(content&&!observer){observer=new MutationObserver(schedule);observer.observe(content,{childList:true,subtree:true})}
 schedule();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
window.AICLO_CREATE_WIZARD_BIND=Object.freeze({version:'11.9.4',launch,hardTakeover});
})();
