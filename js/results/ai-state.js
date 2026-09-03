/* AI-CLO PTITHCM V11.6.27 — explicit loading state for Gemini buttons in CLO results. */
(()=>{
'use strict';
function mark(button,loading){
 if(!button)return;
 button.classList.toggle('is-loading',!!loading);
 if(loading)button.dataset.aiLoading='1';else delete button.dataset.aiLoading;
}
document.addEventListener('click',event=>{
 const button=event.target.closest?.('.ai-btn');
 if(!button)return;
 requestAnimationFrame(()=>{if(button.disabled&&/Đang phân tích/i.test(button.textContent||''))mark(button,true)});
},true);
new MutationObserver(records=>{
 for(const record of records){
  const button=record.target?.closest?.('.ai-btn')||(record.target?.matches?.('.ai-btn')?record.target:null);
  if(!button)continue;
  const loading=button.disabled&&/Đang phân tích/i.test(button.textContent||'');
  mark(button,loading);
 }
}).observe(document.documentElement,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['disabled']});
})();
