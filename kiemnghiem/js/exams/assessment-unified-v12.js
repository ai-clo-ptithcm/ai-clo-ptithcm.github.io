/* AI-CLO PTITHCM V12.0.5 — deterministic Assessment ownership across every course. */
(()=>{
'use strict';
const VERSION='12.0.5';
let observer=null,armed=false;
const $=s=>document.querySelector(s);

function stopObserver(){if(observer){observer.disconnect();observer=null}armed=false}
function ready(){return !!($('#v109AssessmentBody #addExam')&&$('.v102-final-list'))}
function normalizeTabs(){
 const online=$('[data-assessment-tab="online"]'),final=$('[data-assessment-tab="final"]');
 if(online)online.textContent='Bài kiểm tra';
 if(final)final.textContent='Đề thi cuối kỳ';
}
function hideLegacy(button){
 if(!button)return;
 button.hidden=true;
 button.style.setProperty('display','none','important');
 button.setAttribute('aria-hidden','true');
 button.tabIndex=-1;
}
function hideLegacyCreates(){
 hideLegacy($('#v109AssessmentBody #addExam'));
 hideLegacy($('#v109AssessmentBody #addCloAssessment'));
 hideLegacy($('#v109AssessmentBody #createReviewExam'));
 hideLegacy($('#createFinalExam'));
}
function installOnlineCreate(){
 const legacy=$('#v109AssessmentBody #addExam');
 if(!legacy?.parentElement)return;
 hideLegacy(legacy);
 let button=$('#createAssessmentV12');
 if(!button){
  button=document.createElement('button');button.id='createAssessmentV12';button.type='button';button.className='primary';button.textContent='+ Tạo bài kiểm tra';
  legacy.parentElement.insertBefore(button,legacy);
 }
 button.hidden=false;button.style.removeProperty('display');button.removeAttribute('aria-hidden');button.tabIndex=0;
 button.onclick=e=>{e.preventDefault();e.stopPropagation();sessionStorage.setItem(`aiclo:v109:assessment:${state.subjectId}`,'online');window.AICLO_CREATE_WIZARD?.start?.('test')};
}
function installFinalCreate(){
 const section=$('.v102-final-list');if(!section)return;
 const head=section.querySelector('.panel-head');if(!head)return;
 hideLegacy($('#createFinalExam'));
 let button=$('#createFinalAssessmentV12');
 if(!button){button=document.createElement('button');button.id='createFinalAssessmentV12';button.type='button';button.className='ai-btn';button.textContent='+ Tạo bài thi cuối kỳ';head.appendChild(button)}
 else if(button.parentElement!==head)head.appendChild(button);
 button.hidden=false;button.style.removeProperty('display');button.removeAttribute('aria-hidden');button.tabIndex=0;
 button.onclick=e=>{e.preventDefault();e.stopPropagation();sessionStorage.setItem(`aiclo:v109:assessment:${state.subjectId}`,'final');window.AICLO_CREATE_WIZARD?.start?.('final')};
}
function normalizeHeading(){
 const title=$('#pageTitle'),sub=$('#pageSub');
 if(title)title.textContent='Đánh giá';
 if(sub)sub.textContent='Bài kiểm tra và đề thi cuối kỳ';
}
function normalizeOnce(){normalizeTabs();hideLegacyCreates();installOnlineCreate();installFinalCreate();normalizeHeading()}
function stabilize(){
 normalizeOnce();
 requestAnimationFrame(()=>requestAnimationFrame(normalizeOnce));
 setTimeout(normalizeOnce,80);
 setTimeout(normalizeOnce,260);
}
function apply(){stopObserver();stabilize()}
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
 document.addEventListener('click',e=>{
  if(e.target?.closest?.('[data-view="exams"]'))queueMicrotask(arm);
  if(e.target?.closest?.('[data-assessment-tab]'))setTimeout(stabilize,0);
 },true);
 document.addEventListener('change',e=>{if(e.target?.id==='subjectSelect')setTimeout(arm,0)},true);
 window.addEventListener('pageshow',()=>{if(state?.view==='exams')arm()});
 arm();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
window.AICLO_ASSESSMENT_V12=Object.freeze({version:VERSION,arm,apply,stabilize});
})();