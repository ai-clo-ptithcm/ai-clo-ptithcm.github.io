/* AI-CLO PTITHCM V12.0.3 — lightweight Assessment ownership; no continuous DOM observer. */
(()=>{
'use strict';
const VERSION='12.0.3';
let observer=null,armed=false;
const $=s=>document.querySelector(s);

function stopObserver(){if(observer){observer.disconnect();observer=null}armed=false}
function ready(){return !!($('#v109AssessmentBody #addExam')&&$('.v102-final-list'))}
function normalizeTabs(){
 const online=$('[data-assessment-tab="online"]'),final=$('[data-assessment-tab="final"]');
 if(online)online.textContent='Bài kiểm tra';
 if(final)final.textContent='Đề thi cuối kỳ';
}
function installOnlineCreate(){
 const legacy=$('#v109AssessmentBody #addExam');
 if(!legacy?.parentElement)return;
 legacy.hidden=true;legacy.style.display='none';legacy.tabIndex=-1;legacy.setAttribute('aria-hidden','true');
 const oldFinal=$('#createFinalAssessmentV12');if(oldFinal)oldFinal.remove();
 let button=$('#createAssessmentV12');
 if(!button){
  button=document.createElement('button');button.id='createAssessmentV12';button.type='button';button.className='primary';button.textContent='+ Tạo bài kiểm tra';
  legacy.parentElement.insertBefore(button,legacy);
 }
 button.onclick=e=>{e.preventDefault();sessionStorage.setItem(`aiclo:v109:assessment:${state.subjectId}`,'online');window.AICLO_CREATE_WIZARD?.start?.('test')};
}
function keepFinalCreateInFinalTab(){
 const finalSection=$('.v102-final-list'),button=$('#createFinalExam');
 if(!finalSection||!button)return;
 const head=finalSection.querySelector('.panel-head');if(head&&button.parentElement!==head)head.appendChild(button);
 button.hidden=false;button.style.display='';button.removeAttribute('aria-hidden');button.tabIndex=0;
}
function normalizeHeading(){
 const title=$('#pageTitle'),sub=$('#pageSub');
 if(title)title.textContent='Đánh giá';
 if(sub)sub.textContent='Bài kiểm tra và đề thi cuối kỳ';
}
function apply(){
 stopObserver();
 normalizeTabs();installOnlineCreate();keepFinalCreateInFinalTab();normalizeHeading();
}
function arm(){
 stopObserver();
 const host=$('#content');if(!host)return;
 if(ready())return apply();
 armed=true;
 observer=new MutationObserver(()=>{if(ready())apply()});
 observer.observe(host,{childList:true,subtree:true});
 setTimeout(()=>{if(armed&&ready())apply();else if(armed)stopObserver()},2500);
}
function init(){
 document.addEventListener('click',e=>{if(e.target?.closest?.('[data-view="exams"]'))queueMicrotask(arm)},true);
 arm();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
window.AICLO_ASSESSMENT_V12=Object.freeze({version:VERSION,arm,apply});
})();