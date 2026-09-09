/* AI-CLO PTITHCM V12.6.48 — question lifecycle: archive instead of physical delete. */
(()=>{
'use strict';

const ARCHIVED='archived';
const label=v=>({draft:'Bản nháp',pending:'Chờ duyệt',approved:'Đã duyệt',archived:'Ngưng sử dụng'}[v]||v||'Bản nháp');

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

function syncLabels(root=document){
 root.querySelectorAll?.('option[value="archived"]').forEach(o=>{if(o.textContent!=='Ngưng sử dụng')o.textContent='Ngưng sử dụng'});
 root.querySelectorAll?.('.approval-badge').forEach(el=>{if(el.textContent.trim()==='Lưu trữ')el.textContent='Ngưng sử dụng'});
 const detail=root.querySelector?.('#detailDeleteQuestion');
 if(detail){detail.textContent='Ngưng sử dụng';detail.title='Giữ nguyên dữ liệu lịch sử và không dùng câu này cho đề mới.'}
}

if(typeof window.v96ApprovalLabel==='function')window.v96ApprovalLabel=label;

async function handleSingleArchive(btn,event){
 event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();
 const detail=btn.closest('#v105Detail');
 const code=(detail?.closest('.question-workspace')?.querySelector('.workspace-head h3')?.textContent||'câu hỏi').split(' · ')[0];
 if(!await confirmAction('Ngưng sử dụng câu hỏi',`${code} sẽ được giữ nguyên trong lịch sử nhưng không còn dùng cho bài kiểm tra hoặc đề mới. Tiếp tục?`,{confirmLabel:'Ngưng sử dụng',danger:true}))return;
 btn.disabled=true;btn.textContent='Đang cập nhật…';
 try{
  const match=btn.closest('.question-workspace')?.querySelector('[data-question-id]')?.dataset.questionId;
  const id=match||window.__aicloCurrentQuestionId||null;
  if(!id)throw new Error('Không xác định được câu hỏi cần ngưng sử dụng.');
  await archiveQuestions([id],{reason:`Ngưng sử dụng ${code}`});
  toast('Đã chuyển câu hỏi sang Ngưng sử dụng');
  if(typeof backToQuestionList==='function')await backToQuestionList();else await render();
 }catch(ex){err(ex);btn.disabled=false;btn.textContent='Ngưng sử dụng'}
}

document.addEventListener('click',event=>{
 const btn=event.target.closest?.('#detailDeleteQuestion');
 if(!btn)return;
 handleSingleArchive(btn,event);
},true);

const observer=new MutationObserver(records=>{
 for(const r of records)for(const node of r.addedNodes)if(node.nodeType===1)syncLabels(node);
 syncLabels(document);
});

function boot(){
 syncLabels(document);
 observer.observe(document.body,{childList:true,subtree:true});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();

window.AICLO_QUESTION_LIFECYCLE=Object.freeze({archive:archiveQuestions,label,syncLabels});
})();
