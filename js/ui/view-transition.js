/* AI-CLO PTITHCM V11.1 — fast sidebar transitions with per-view visual cache. */
(() => {
'use strict';

const previousRender=window.render;
if(typeof previousRender!=='function')return;

const CACHE_TTL=5*60*1000;
const MAX_ENTRIES=24;
const viewCache=new Map();
let sequence=0;

function currentKey(){
 return `${state.user?.id||'guest'}:${state.subjectId||'no-subject'}:${state.view||'dashboard'}`;
}

function isGlobalLoading(container){
 if(!container||container.children.length!==1)return false;
 const only=container.firstElementChild;
 return !!only&&only.classList.contains('panel')&&only.textContent.trim()==='Đang tải dữ liệu…';
}

function isErrorView(container){
 return !!container?.textContent?.includes('Không thể tải dữ liệu');
}

function hasStableContent(container){
 return !!container?.children.length&&!isGlobalLoading(container)&&!isErrorView(container);
}

function remember(key,html){
 if(!key||!html)return;
 viewCache.delete(key);
 viewCache.set(key,{html,at:Date.now()});
 while(viewCache.size>MAX_ENTRIES)viewCache.delete(viewCache.keys().next().value);
}

function recall(key){
 const hit=viewCache.get(key);
 if(!hit)return '';
 if(Date.now()-hit.at>CACHE_TTL){viewCache.delete(key);return ''}
 viewCache.delete(key);
 viewCache.set(key,hit);
 return hit.html;
}

function invalidate(view=null,subjectId=null){
 for(const key of [...viewCache.keys()]){
  const parts=key.split(':');
  const keySubject=parts[1],keyView=parts.slice(2).join(':');
  if((!view||keyView===view)&&(!subjectId||keySubject===subjectId))viewCache.delete(key);
 }
}

function setRefreshing(container,on){
 if(!container)return;
 if(on){
  container.setAttribute('aria-busy','true');
  container.dataset.aicloRefreshing='1';
  container.style.pointerEvents='none';
  container.style.opacity='0.975';
  container.style.transition='opacity 100ms ease';
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
 const key=currentKey();
 const cached=recall(key);
 const ticket=++sequence;
 let task;
 try{
  task=previousRender.apply(this,args);
 }catch(error){
  setRefreshing(container,false);
  throw error;
 }

 /* previousRender intentionally writes the global loading panel first.
    If this view has already been opened, immediately replace that panel with
    its own last successful snapshot while fresh Supabase data loads behind it. */
 if(cached&&isGlobalLoading(container)){
  container.innerHTML=cached;
  setRefreshing(container,true);
 }

 try{
  const result=await task;
  if(ticket===sequence&&hasStableContent(container))remember(key,container.innerHTML);
  return result;
 }finally{
  if(ticket===sequence)setRefreshing(container,false);
 }
};

window.AICLO_VIEW_TRANSITION=Object.freeze({
 version:'11.1',
 invalidate,
 clear:()=>viewCache.clear(),
 isRefreshing:()=>document.querySelector('#content')?.dataset.aicloRefreshing==='1'
});
})();
