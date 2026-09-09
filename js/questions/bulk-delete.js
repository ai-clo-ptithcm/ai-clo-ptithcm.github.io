/* AI-CLO PTITHCM V12.6.48 — bulk question lifecycle: archive only, never physical delete. */
(()=>{
'use strict';

function ensureBulkAssets(){
 if(!document.querySelector('link[data-aiclo-bulk-actions]')){
  const link=document.createElement('link');link.rel='stylesheet';link.href='css/questions/bulk-actions.css?v=11.6.19';link.dataset.aicloBulkActions='1';document.head.append(link);
 }
 if(!document.querySelector('script[data-aiclo-bulk-actions]')){
  const script=document.createElement('script');script.src='js/questions/bulk-actions.js?v=11.6.19';script.defer=true;script.dataset.aicloBulkActions='1';document.head.append(script);
 }
}

async function archiveSelected(ids){
 const lifecycle=window.AICLO_QUESTION_LIFECYCLE;
 if(lifecycle?.archive)return lifecycle.archive(ids,{reason:`Ngưng sử dụng hàng loạt ${ids.length} câu hỏi`});
 const {error}=await db.from('questions').update({approval_status:'archived',status:'draft',approved_by:null,approved_at:null,updated_at:new Date().toISOString()}).in('id',ids);
 if(error)throw error;
 return {count:ids.length};
}

async function runBulkDelete(btn){
 const shared=window.AICLO_QUESTION_BULK_SELECTION?.ids?.()||[];
 const visible=$$('#qrows [data-select-question]:checked').map(x=>x.dataset.selectQuestion).filter(Boolean);
 const ids=[...new Set((shared.length?shared:visible).filter(Boolean))];
 if(!ids.length)return toast('Chưa chọn câu hỏi để ngưng sử dụng',true);
 const original=btn.textContent;btn.disabled=true;btn.textContent='Đang cập nhật…';
 try{
  if(!await confirmAction('Ngưng sử dụng nhiều câu hỏi',`${ids.length} câu đã chọn sẽ được giữ nguyên trong lịch sử nhưng không còn được dùng cho bài kiểm tra hoặc đề mới. Tiếp tục?`,{confirmLabel:`Ngưng sử dụng ${ids.length} câu`,danger:true}))return;
  const result=await archiveSelected(ids);
  window.logActivity?.('archive','question',null,`Ngưng sử dụng hàng loạt ${result.count||ids.length} câu hỏi`,'success',state.subjectId,{archived:result.count||ids.length});
  window.AICLO_QUESTION_BULK_SELECTION?.clear?.();
  toast(`Đã chuyển ${result.count||ids.length} câu sang Ngưng sử dụng`);
  await render();
 }catch(ex){err(ex)}finally{btn.disabled=false;btn.textContent=original}
}

document.addEventListener('click',event=>{
 const btn=event.target.closest?.('#bulkDeleteQuestions');if(!btn)return;
 event.preventDefault();event.stopPropagation();runBulkDelete(btn);
},true);

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',ensureBulkAssets,{once:true});else ensureBulkAssets();
window.AICLO_QUESTION_BULK_DELETE=Object.freeze({run:runBulkDelete});
})();
