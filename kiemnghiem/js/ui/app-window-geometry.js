/* AI-CLO PTITHCM V11.8.6 — preserve active app-window geometry across inner rerenders. */
(()=>{
'use strict';
const VERSION='11.8.6';
let installed=false;

function hasManagedGeometry(dialog){
 if(!dialog?.open||matchMedia('(max-width:700px)').matches)return false;
 if(!dialog.classList.contains('quick-edit-modal'))return false;
 const s=dialog.style;
 return !!(s.width&&s.height&&s.left&&s.top);
}
function classTokens(value){return String(value||'').split(/\s+/).map(x=>x.trim()).filter(Boolean)}

function install(){
 if(installed)return true;
 const api=window.AICLO_APP_WINDOW;
 if(!api||typeof api.open!=='function')return false;
 const original=api.open.bind(api);
 const wrapped={...api,open(dialog,options={}){
  const tokens=classTokens(options?.className),primary=tokens[0]||'quick-edit-modal',extras=tokens.slice(1);
  if(hasManagedGeometry(dialog)){
   dialog.classList.add('quick-edit-modal');
   tokens.filter(x=>x!=='quick-edit-modal').forEach(x=>dialog.classList.add(x));
   return dialog;
  }
  extras.forEach(x=>dialog.classList.add(x));
  if(extras.length)dialog.addEventListener('close',()=>extras.forEach(x=>dialog.classList.remove(x)),{once:true});
  return original(dialog,{...options,className:primary});
 }};
 try{window.AICLO_APP_WINDOW=Object.freeze(wrapped);installed=true}catch{}
 return installed;
}

function init(){
 if(install())return;
 let tries=0;
 const timer=setInterval(()=>{tries++;if(install()||tries>=40)clearInterval(timer)},50);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
window.AICLO_APP_WINDOW_GEOMETRY=Object.freeze({version:VERSION,install});
})();
