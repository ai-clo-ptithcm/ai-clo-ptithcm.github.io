/* AI-CLO PTITHCM V11 — mobile app shell extracted from legacy V10.8. */
(() => {
'use strict';

function close(){
 const aside=$('.app>aside'),backdrop=$('#appSidebarBackdrop');
 aside?.classList.remove('open');
 backdrop?.classList.remove('show');
 $('#app')?.classList.remove('sidebar-open');
}

function open(){
 if(!matchMedia('(max-width:760px)').matches)return;
 $('.app>aside')?.classList.add('open');
 $('#appSidebarBackdrop')?.classList.add('show');
 $('#app')?.classList.add('sidebar-open');
}

function setup(){
 const app=$('#app'),aside=$('.app>aside');
 if(!app||!aside)return;

 if(!$('#appSidebarBackdrop')){
  const b=document.createElement('div');
  b.id='appSidebarBackdrop';
  b.className='app-sidebar-backdrop';
  document.body.append(b);
  b.onclick=close;
 }

 if(!$('#mobileSidebarClose')){
  const b=document.createElement('button');
  b.id='mobileSidebarClose';
  b.type='button';
  b.className='mobile-sidebar-close';
  b.setAttribute('aria-label','Đóng menu');
  b.textContent='×';
  aside.prepend(b);
  b.onclick=close;
 }

 const menu=$('#menuBtn');
 if(menu){
  menu.onclick=e=>{
   e.preventDefault();
   if(matchMedia('(max-width:760px)').matches){
    aside.classList.contains('open')?close():open();
   }else aside.classList.toggle('open');
  };
 }

 if(!app.dataset.mobileShellBound){
  app.dataset.mobileShellBound='1';
  $('#nav')?.addEventListener('click',e=>{if(e.target.closest('[data-view]'))close()});
  aside.addEventListener('click',e=>{if(e.target.closest('#miniUser'))close()},true);
  document.addEventListener('keydown',e=>{if(e.key==='Escape')close()});
  window.addEventListener('resize',()=>{if(!matchMedia('(max-width:760px)').matches)close()});
 }
}

window.AICLO_MOBILE_SHELL=Object.freeze({setup,open,close});
document.addEventListener('DOMContentLoaded',setup);
})();
