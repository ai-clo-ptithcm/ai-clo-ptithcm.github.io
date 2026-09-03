/* AI-CLO PTITHCM V11.6.25 — direct create-assessment app window using the shared draggable/resizable controller. */
(()=>{
'use strict';
let queued=false,observer=null,modalHookInstalled=false;

function enhanceAssessmentWindow(){
 const form=document.querySelector('#modal #assessmentForm');
 if(!form)return null;
 const dialog=form.closest('#modal');if(!dialog?.open)return null;
 form.classList.add('assessment-window-form');
 const title=dialog.querySelector('#modalTitle');if(title&&title.textContent!=='AI-CLO | Tạo bài kiểm tra')title.textContent='AI-CLO | Tạo bài kiểm tra';
 const description=form.elements.namedItem('description');if(description&&!description.dataset.aicloCompact){description.dataset.aicloCompact='1';description.setAttribute('rows','2')}
 const actions=form.querySelector('.form-actions');if(actions)actions.classList.add('assessment-window-footer');
 if(dialog.dataset.aicloAssessmentWindow==='1')return dialog;
 dialog.dataset.aicloAssessmentWindow='1';
 const body=dialog.querySelector('#modalBody');if(body)body.scrollTop=0;
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
  const isAssessment=String(title||'').trim()==='Tạo bài kiểm tra'||markup.includes('id="assessmentForm"')||markup.includes("id='assessmentForm'");
  const result=base.call(this,isAssessment?'AI-CLO | Tạo bài kiểm tra':title,html,...args);
  if(isAssessment)enhanceAssessmentWindow();
  return result;
 };
 wrapped.__aicloAssessmentWindow=true;
 wrapped.__aicloBase=base;
 window.modal=wrapped;
 modalHookInstalled=true;
}
function init(){
 installModalHook();
 const modal=document.querySelector('#modal');if(modal&&!observer){observer=new MutationObserver(queueEnhance);observer.observe(modal,{childList:true,subtree:true})}
 queueEnhance();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
window.AICLO_ASSESSMENT_WINDOW=Object.freeze({version:'11.6.25',enhance:enhanceAssessmentWindow,open:enhanceAssessmentWindow});
})();