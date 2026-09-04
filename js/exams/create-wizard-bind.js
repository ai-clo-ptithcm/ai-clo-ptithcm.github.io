/* AI-CLO PTITHCM V11.9.5 — hard-disable legacy create form at its modal entry point and route creation to the 4-step wizard. */
(()=>{
'use strict';
const WIZARD_SRC='js/exams/create-wizard.js?v=11.9.1';
let loading=null,observer=null,modalGuardInstalled=false;

async function ensureWizard(){
 if(typeof window.AICLO_CREATE_WIZARD?.start==='function')return window.AICLO_CREATE_WIZARD;
 if(!loading){
  loading=(async()=>{
   if(window.AICLO_FEATURES?.load)await window.AICLO_FEATURES.load(WIZARD_SRC);
   else await new Promise((resolve,reject)=>{
    const existing=[...document.scripts].find(s=>s.src.includes('/js/exams/create-wizard.js'));
    if(existing){
     if(typeof window.AICLO_CREATE_WIZARD?.start==='function')return resolve();
     existing.addEventListener('load',resolve,{once:true});
     existing.addEventListener('error',()=>reject(new Error('Không tải được wizard tạo bài kiểm tra.')),{once:true});
     return;
    }
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

function installModalGuard(){
 if(modalGuardInstalled)return true;
 const base=window.modal;
 if(typeof base!=='function')return false;
 if(base.__aicloWizardGuard){modalGuardInstalled=true;return true}
 const guarded=function(title,html,...args){
  const t=String(title||'').trim();
  const h=String(html||'');
  const legacyCreate=/id=["']assessmentForm["']/i.test(h)&&/Tạo bài kiểm tra/i.test(t);
  if(legacyCreate){
   queueMicrotask(launch);
   return null;
  }
  return base.call(this,title,html,...args);
 };
 guarded.__aicloWizardGuard=true;
 guarded.__aicloBase=base;
 window.modal=guarded;
 modalGuardInstalled=true;
 return true;
}

function hardTakeover(){
 const old=document.querySelector('#addExam');
 if(!old)return;
 if(old.dataset.cwHard==='1')return;
 const add=old.cloneNode(true);
 add.dataset.cwHard='1';
 old.replaceWith(add);
 add.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();launch()},{capture:true});
}

function schedule(){
 installModalGuard();
 queueMicrotask(hardTakeover);
 requestAnimationFrame(hardTakeover);
 setTimeout(hardTakeover,0);
}
function init(){
 installModalGuard();
 const content=document.querySelector('#content');
 if(content&&!observer){observer=new MutationObserver(schedule);observer.observe(content,{childList:true,subtree:true})}
 schedule();
 let tries=0;const timer=setInterval(()=>{tries++;if(installModalGuard()||tries>=40)clearInterval(timer)},50);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
window.AICLO_CREATE_WIZARD_BIND=Object.freeze({version:'11.9.5',launch,hardTakeover,installModalGuard});
})();
