/* AI-CLO PTITHCM V11.9.6 — isolate the visible create button from every legacy #addExam handler. */
(()=>{
'use strict';
const VERSION='11.9.6';
const WIZARD_SRC='js/exams/create-wizard.js?v=11.9.1';
const NEW_ID='createExamWizardV119';
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
  const t=String(title||'').trim(),h=String(html||'');
  if(/id=["']assessmentForm["']/i.test(h)&&/Tạo bài kiểm tra/i.test(t)){
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

function installDedicatedButton(){
 const legacy=document.querySelector('#addExam');
 if(!legacy)return false;
 // Keep #addExam only as an invisible compatibility hook. Legacy modules may bind it,
 // but users can never click it. The visible button has a new ID unknown to legacy code.
 legacy.hidden=true;
 legacy.style.display='none';
 legacy.setAttribute('aria-hidden','true');
 legacy.tabIndex=-1;
 let fresh=document.querySelector('#'+NEW_ID);
 if(!fresh){
  fresh=document.createElement('button');
  fresh.id=NEW_ID;
  fresh.type='button';
  fresh.className=legacy.className||'primary';
  fresh.textContent='+ Tạo bài kiểm tra';
  fresh.dataset.aicloWizard='4-step';
  legacy.parentNode?.insertBefore(fresh,legacy);
  fresh.addEventListener('click',event=>{
   event.preventDefault();
   event.stopPropagation();
   launch();
  });
 }
 return true;
}

function schedule(){
 installModalGuard();
 queueMicrotask(installDedicatedButton);
 requestAnimationFrame(installDedicatedButton);
 setTimeout(installDedicatedButton,30);
 setTimeout(installDedicatedButton,120);
}
function init(){
 installModalGuard();
 const content=document.querySelector('#content');
 if(content&&!observer){
  observer=new MutationObserver(schedule);
  observer.observe(content,{childList:true,subtree:true});
 }
 schedule();
 let tries=0;
 const timer=setInterval(()=>{
  tries++;
  installModalGuard();
  installDedicatedButton();
  if(tries>=80)clearInterval(timer);
 },100);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
window.AICLO_CREATE_WIZARD_BIND=Object.freeze({version:VERSION,launch,installDedicatedButton,installModalGuard});
})();
