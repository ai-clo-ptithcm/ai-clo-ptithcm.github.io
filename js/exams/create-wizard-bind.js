/* AI-CLO PTITHCM V11.9.3 — route create-assessment clicks to the 4-step wizard before legacy handlers. */
(()=>{
'use strict';
const WIZARD_SRC='js/exams/create-wizard.js?v=11.9.1';
let loading=null;

async function ensureWizard(){
 if(typeof window.AICLO_CREATE_WIZARD?.start==='function')return window.AICLO_CREATE_WIZARD;
 if(!loading){
  loading=(async()=>{
   if(window.AICLO_FEATURES?.load)await window.AICLO_FEATURES.load(WIZARD_SRC);
   else await new Promise((resolve,reject)=>{
    const existing=[...document.scripts].find(s=>s.src.includes('/js/exams/create-wizard.js'));
    if(existing){existing.addEventListener('load',resolve,{once:true});existing.addEventListener('error',reject,{once:true});return}
    const s=document.createElement('script');s.src=WIZARD_SRC;s.async=false;s.onload=resolve;s.onerror=()=>reject(new Error('Không tải được wizard tạo bài kiểm tra.'));document.head.appendChild(s);
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

function onClick(event){
 const add=event.target?.closest?.('#addExam');
 if(!add)return;
 event.preventDefault();
 event.stopPropagation();
 event.stopImmediatePropagation();
 launch();
}

function init(){
 document.addEventListener('click',onClick,true);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
window.AICLO_CREATE_WIZARD_BIND=Object.freeze({version:'11.9.3',launch});
})();
