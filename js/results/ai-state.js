/* AI-CLO PTITHCM V11.6.27 — explicit loading/unavailable states for Gemini buttons in CLO results. */
(()=>{
'use strict';
function mark(button,loading){
 if(!button)return;
 button.classList.toggle('is-loading',!!loading);
 if(loading){
  button.dataset.aiLoading='1';
  if(button.title==='Chưa có bài làm để AI phân tích')button.removeAttribute('title');
 }else{
  delete button.dataset.aiLoading;
  if(button.disabled&&!button.title)button.title='Chưa có bài làm để AI phân tích';
  if(!button.disabled&&button.title==='Chưa có bài làm để AI phân tích')button.removeAttribute('title');
 }
}
function refresh(button){if(!button)return;mark(button,button.disabled&&/Đang phân tích/i.test(button.textContent||''))}
document.addEventListener('click',event=>{
 const button=event.target.closest?.('.ai-btn');if(!button)return;
 requestAnimationFrame(()=>refresh(button));
},true);
new MutationObserver(records=>{
 for(const record of records){
  const button=record.target?.closest?.('.ai-btn')||(record.target?.matches?.('.ai-btn')?record.target:null);
  if(button)refresh(button);
 }
}).observe(document.documentElement,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['disabled']});
document.addEventListener('DOMContentLoaded',()=>document.querySelectorAll('.ai-btn').forEach(refresh));
})();
