/* AI-CLO PTITHCM V12.6.49 — persistent top error notice. */
(()=>{
'use strict';

const STYLE_ID='aiclo-error-notice-style';
const PINNED='errorPinned';
let pinnedMessage='';
let internalChange=false;

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

function renderPinned(toast){
 if(!toast||!pinnedMessage)return;
 internalChange=true;
 toast.dataset[PINNED]='1';
 toast.className='toast show error aiclo-error-notice';
 toast.replaceChildren();
 const message=document.createElement('span');
 message.className='aiclo-error-message';
 message.textContent=pinnedMessage;
 const ok=document.createElement('button');
 ok.type='button';
 ok.className='aiclo-error-ok';
 ok.textContent='OK';
 ok.setAttribute('aria-label','Đóng thông báo lỗi');
 ok.addEventListener('click',()=>dismiss(toast),{once:true});
 toast.append(message,ok);
 internalChange=false;
}

function dismiss(toast){
 pinnedMessage='';
 internalChange=true;
 delete toast.dataset[PINNED];
 toast.className='toast';
 toast.textContent='';
 internalChange=false;
}

function inspect(toast){
 if(internalChange||!toast)return;
 const isError=toast.classList.contains('error');
 if(isError){
  const raw=toast.querySelector('.aiclo-error-message')?.textContent||toast.textContent||'Có lỗi xảy ra';
  if(raw.trim())pinnedMessage=raw.trim();
  renderPinned(toast);
  return;
 }
 if(toast.dataset[PINNED]==='1'&&pinnedMessage){
  renderPinned(toast);
 }
}

function boot(){
 ensureStyle();
 const toast=document.getElementById('toast');
 if(!toast)return;
 const observer=new MutationObserver(()=>inspect(toast));
 observer.observe(toast,{attributes:true,attributeFilter:['class'],childList:true,subtree:true,characterData:true});
 inspect(toast);
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
