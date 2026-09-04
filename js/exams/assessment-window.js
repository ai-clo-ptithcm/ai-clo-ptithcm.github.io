/* AI-CLO PTITHCM V11.7 — create-assessment app window + CLO assessment builder loader. */
(()=>{
'use strict';
let queued=false,observer=null,modalHookInstalled=false;

function assessmentForm(){return document.querySelector('#modal #matrixAssessmentForm, #modal #assessmentForm')}
function normalizeExamType(form){
 const current=form.elements.namedItem('exam_type');
 if(current&&current.tagName==='SELECT')current.closest('label')?.remove();
 let hidden=form.querySelector('input[type="hidden"][name="exam_type"]');
 if(!hidden){hidden=document.createElement('input');hidden.type='hidden';hidden.name='exam_type';form.append(hidden)}
 hidden.value='chapter_test';
}
function enhanceAssessmentWindow(){
 const form=assessmentForm();
 if(!form)return null;
 const dialog=form.closest('#modal');if(!dialog?.open)return null;
 form.classList.add('assessment-window-form');
 normalizeExamType(form);
 const title=dialog.querySelector('#modalTitle');if(title&&title.textContent!=='AI-CLO | Tạo bài kiểm tra')title.textContent='AI-CLO | Tạo bài kiểm tra';
 const description=form.elements.namedItem('description');if(description&&!description.dataset.aicloCompact){description.dataset.aicloCompact='1';description.setAttribute('rows','2')}
 const actions=form.querySelector('.form-actions');if(actions)actions.classList.add('assessment-window-footer');
 if(dialog.dataset.aicloAssessmentWindow==='1')return dialog;
 dialog.dataset.aicloAssessmentWindow='1';
 const body=dialog.querySelector('#modalBody');if(body){body.scrollTop=0;body.scrollLeft=0}
 if(window.AICLO_APP_WINDOW?.open){
  window.AICLO_APP_WINDOW.open(dialog,{className:'assessment-window-modal',width:900,height:680});
 }else{
  dialog.classList.add('quick-edit-modal','assessment-window-modal');
 }
 dialog.addEventListener('close',()=>{
  delete dialog.dataset.aicloAssessmentWindow;
  dialog.classList.remove('assessment-window-modal');
  form.classList.remove('assessment-window-form');
 },{once:true});
 return dialog;
}
function queueEnhance(){if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;enhanceAssessmentWindow()})}
function installModalHook(){
 if(modalHookInstalled)return;
 const base=window.modal;
 if(typeof base!=='function')return;
 if(base.__aicloAssessmentWindow){modalHookInstalled=true;return}
 const wrapped=function(title,html,...args){
  const markup=String(html||'');
  const isAssessment=String(title||'').trim()==='Tạo bài kiểm tra'||markup.includes('id="assessmentForm"')||markup.includes("id='assessmentForm'")||markup.includes('id="matrixAssessmentForm"')||markup.includes("id='matrixAssessmentForm'");
  const result=base.call(this,isAssessment?'AI-CLO | Tạo bài kiểm tra':title,html,...args);
  if(isAssessment)enhanceAssessmentWindow();
  return result;
 };
 wrapped.__aicloAssessmentWindow=true;
 wrapped.__aicloBase=base;
 window.modal=wrapped;
 modalHookInstalled=true;
}
function loadCloAssessmentBuilder(){
 if(!document.querySelector('link[data-aiclo-clo-assessment]')){
  const link=document.createElement('link');link.rel='stylesheet';link.href='css/exams/clo-assessment-builder.css?v=11.7.0';link.dataset.aicloCloAssessment='1';document.head.append(link);
 }
 if(!document.querySelector('script[data-aiclo-clo-assessment]')){
  const script=document.createElement('script');script.src='js/exams/clo-assessment-builder.js?v=11.7.0';script.defer=true;script.dataset.aicloCloAssessment='1';document.head.append(script);
 }
}
function init(){
 installModalHook();
 loadCloAssessmentBuilder();
 const modal=document.querySelector('#modal');if(modal&&!observer){observer=new MutationObserver(queueEnhance);observer.observe(modal,{childList:true,subtree:true})}
 queueEnhance();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
window.AICLO_ASSESSMENT_WINDOW=Object.freeze({version:'11.7.0',enhance:enhanceAssessmentWindow,open:enhanceAssessmentWindow});
})();