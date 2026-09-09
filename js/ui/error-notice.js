/* AI-CLO PTITHCM V12.6.51 — persistent top error notice without observer feedback loops. */
(()=>{
'use strict';

const STYLE_ID='aiclo-error-notice-style';
const PINNED='errorPinned';
let pinnedMessage='';
let observer=null;
let toastNode=null;

function ensureStyle(){
 if(document.getElementById(STYLE_ID))return;
 const style=document.createElement('style');
 style.id=STYLE_ID;
 style.textContent=`
  #toast.toast.error.aiclo-error-notice{top:84px;right:24px;bottom:auto;left:auto;max-width:min(560px,calc(100vw - 32px));min-width:min(360px,calc(100vw - 32px));display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:14px;padding:14px 14px 14px 16px;pointer-events:auto;box-shadow:0 12px 34px rgba(67,18,27,.24);z-index:2500;line-height:1.45}
  #toast.toast.error.aiclo-error-notice .aiclo-error-message{min-width:0;overflow-wrap:anywhere;white-space:pre-wrap}
  #toast.toast.error.aiclo-error-notice .aiclo-error-ok{border:1px solid rgba(255,255,255,.7);border-radius:8px;background:#fff;color:#8f1828;padding:8px 13px;font-weight:800;cursor:pointer;flex:none}
  #toast.toast.error.aiclo-error-notice .aiclo-error-ok:hover{background:#fff4f5}
  @media(max-width:700px){#toast.toast.error.aiclo-error-notice{top:108px;right:12px;left:12px;max-width:none;min-width:0}}
 `;
 document.head.appendChild(style);
}

function observe(){
 if(!observer||!toastNode)return;
 observer.observe(toastNode,{attributes:true,attributeFilter:['class'],childList:true,characterData:true});
}
function mutateSafely(fn){
 observer?.disconnect();
 try{fn()}finally{observe()}
}

function renderPinned(toast){
 if(!toast||!pinnedMessage)return;
 const current=toast.querySelector('.aiclo-error-message')?.textContent||'';
 if(toast.dataset[PINNED]==='1'&&toast.classList.contains('aiclo-error-notice')&&current===pinnedMessage&&toast.querySelector('.aiclo-error-ok'))return;
 mutateSafely(()=>{
  toast.dataset[PINNED]='1';
  toast.className='toast show error aiclo-error-notice';
  const message=document.createElement('span');
  message.className='aiclo-error-message';
  message.textContent=pinnedMessage;
  const ok=document.createElement('button');
  ok.type='button';
  ok.className='aiclo-error-ok';
  ok.textContent='OK';
  ok.setAttribute('aria-label','Đóng thông báo lỗi');
  ok.addEventListener('click',()=>dismiss(toast),{once:true});
  toast.replaceChildren(message,ok);
 });
}

function dismiss(toast){
 pinnedMessage='';
 mutateSafely(()=>{
  delete toast.dataset[PINNED];
  toast.className='toast';
  toast.textContent='';
 });
}

function inspect(toast){
 if(!toast)return;
 if(toast.dataset[PINNED]==='1'&&toast.classList.contains('aiclo-error-notice'))return;
 if(!toast.classList.contains('error'))return;
 const raw=(toast.textContent||'Có lỗi xảy ra').trim();
 if(!raw)return;
 pinnedMessage=raw;
 renderPinned(toast);
}

function boot(){
 ensureStyle();
 toastNode=document.getElementById('toast');
 if(!toastNode)return;
 observer=new MutationObserver(()=>inspect(toastNode));
 observe();
 inspect(toastNode);
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
