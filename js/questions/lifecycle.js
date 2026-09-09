/* AI-CLO PTITHCM V12.6.48 — question lifecycle: archive instead of physical delete. */
(()=>{
'use strict';

const ARCHIVED='archived';
const label=v=>({draft:'Bản nháp',pending:'Chờ duyệt',approved:'Đã duyệt',archived:'Ngưng sử dụng'}[v]||v||'Bản nháp');
const originalConfirm=window.confirmAction;

async function archiveQuestions(ids,{reason='Ngưng sử dụng câu hỏi'}={}){
 ids=[...new Set((ids||[]).filter(Boolean))];
 if(!ids.length)return {count:0};
 const now=new Date().toISOString();
 const {error}=await db.from('questions').update({
  approval_status:ARCHIVED,
  status:'draft',
  approved_by:null,
  approved_at:null,
  updated_at:now,
 }).in('id',ids);
 if(error)throw error;
 window.logActivity?.('archive','question',ids.length===1?ids[0]:null,reason,'success',state.subjectId,{count:ids.length,question_ids:ids});
 return {count:ids.length};
}

async function archiveOne(id){
 if(!id)return;
 try{
  await archiveQuestions([id]);
  toast('Đã chuyển câu hỏi sang Ngưng sử dụng');
  if(typeof backToQuestionList==='function'&&state.view==='questions')await backToQuestionList();else await render();
 }catch(ex){err(ex)}
}

function syncLabels(root=document){
 root.querySelectorAll?.('option[value="archived"]').forEach(o=>{if(o.textContent!=='Ngưng sử dụng')o.textContent='Ngưng sử dụng'});
 root.querySelectorAll?.('.approval-badge').forEach(el=>{if(el.textContent.trim()==='Lưu trữ')el.textContent='Ngưng sử dụng'});
 root.querySelectorAll?.('[data-del]').forEach(btn=>{if(btn.textContent.trim()==='Xóa')btn.textContent='Ngưng sử dụng'});
 const detail=root.querySelector?.('#detailDeleteQuestion');
 if(detail){detail.textContent='Ngưng sử dụng';detail.title='Giữ nguyên dữ liệu lịch sử và không dùng câu này cho đề mới.'}
}

/* Existing bank code already asks for confirmation before calling removeQuestion(id).
   Translate that confirmation to the lifecycle language, then archive instead of deleting. */
if(typeof originalConfirm==='function')window.confirmAction=function(title,message,options={}){
 if(title==='Xóa câu hỏi')return originalConfirm('Ngưng sử dụng câu hỏi','Câu hỏi sẽ được giữ nguyên để bảo toàn đề thi, bài làm và lịch sử; nhưng không còn được dùng cho bài kiểm tra hoặc đề mới. Tiếp tục?',{...options,confirmLabel:'Ngưng sử dụng',danger:true});
 return originalConfirm(title,message,options);
};
window.removeQuestion=archiveOne;
window.v96ApprovalLabel=label;

const observer=new MutationObserver(records=>{
 for(const r of records)for(const node of r.addedNodes)if(node.nodeType===1)syncLabels(node);
});

function boot(){
 syncLabels(document);
 observer.observe(document.body,{childList:true,subtree:true});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();

window.AICLO_QUESTION_LIFECYCLE=Object.freeze({archive:archiveQuestions,archiveOne,label,syncLabels});
})();
