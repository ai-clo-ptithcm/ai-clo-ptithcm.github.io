/* AI-CLO PTITHCM V11 — preserve visible content while sidebar views refresh. */
(() => {
'use strict';

const previousRender=window.render;
if(typeof previousRender!=='function')return;
let sequence=0;

function isGlobalLoading(container){
 if(!container||container.children.length!==1)return false;
 const only=container.firstElementChild;
 return !!only&&only.classList.contains('panel')&&only.textContent.trim()==='Đang tải dữ liệu…';
}

function hasStableContent(container){
 return !!container?.children.length&&!isGlobalLoading(container);
}

function setRefreshing(container,on){
 if(!container)return;
 if(on){
  container.setAttribute('aria-busy','true');
  container.dataset.aicloRefreshing='1';
  container.style.pointerEvents='none';
  container.style.opacity='0.965';
  container.style.transition='opacity 120ms ease';
  document.documentElement.style.cursor='progress';
 }else{
  container.removeAttribute('aria-busy');
  delete container.dataset.aicloRefreshing;
  container.style.pointerEvents='';
  container.style.opacity='';
  container.style.transition='';
  document.documentElement.style.cursor='';
 }
}

window.render=async function(...args){
 const container=document.querySelector('#content');
 const snapshot=hasStableContent(container)?container.innerHTML:'';
 const ticket=++sequence;
 let task;
 try{
  task=previousRender.apply(this,args);
 }catch(error){
  setRefreshing(container,false);
  throw error;
 }

 if(snapshot&&isGlobalLoading(container)){
  container.innerHTML=snapshot;
  setRefreshing(container,true);
 }

 try{
  return await task;
 }finally{
  if(ticket===sequence)setRefreshing(container,false);
 }
};

window.AICLO_VIEW_TRANSITION=Object.freeze({version:'11.0',isRefreshing:()=>document.querySelector('#content')?.dataset.aicloRefreshing==='1'});
})();
