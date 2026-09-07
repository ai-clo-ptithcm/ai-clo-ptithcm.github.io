/* AI-CLO PTITHCM V11.8.3 — restore saved navigation context before the first app render.
   Prevents the parent list from flashing before an exam detail/builder workspace is restored. */
(()=>{
'use strict';
const api=window.AICLO_SUBPAGE_STATE;if(!api)return;
function apply(){return api.applyStartupLocation?.()||false}
function savedChild(){try{const x=api.current?.();return x&&['exam-builder','exam-detail'].includes(x.kind)?x:null}catch{return null}}
function maskContent(on){
 const root=document.documentElement;
 let style=document.querySelector('#aicloSubpageRestoreStyle');
 if(on){
  if(!style){style=document.createElement('style');style.id='aicloSubpageRestoreStyle';style.textContent='html.aiclo-subpage-restoring #content{visibility:hidden!important}';document.head.appendChild(style)}
  root.classList.add('aiclo-subpage-restoring');
 }else root.classList.remove('aiclo-subpage-restoring');
}
apply();
const base=window.enterApp;
if(typeof base==='function'&&!base.__aicloSubpageState){
 const wrapped=function(...args){
  apply();
  const child=savedChild();
  if(child)maskContent(true);
  const safety=child?setTimeout(()=>maskContent(false),4200):null;
  const r=base.apply(this,args);
  Promise.resolve(r).finally(()=>setTimeout(async()=>{
   try{await api.restore?.()}finally{if(safety)clearTimeout(safety);maskContent(false)}
  },45));
  return r
 };
 wrapped.__aicloSubpageState=true;
 wrapped.__aicloBase=base;
 window.enterApp=wrapped
}
})();
