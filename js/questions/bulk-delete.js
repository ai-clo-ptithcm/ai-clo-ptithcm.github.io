/* AI-CLO PTITHCM V11.6.19 — safe bulk delete using shared filtered selection. */
(() => {
'use strict';

function ensureBulkAssets(){
 if(!document.querySelector('link[data-aiclo-bulk-actions]')){
  const link=document.createElement('link');link.rel='stylesheet';link.href='css/questions/bulk-actions.css?v=11.6.19';link.dataset.aicloBulkActions='1';document.head.append(link);
 }
 if(!document.querySelector('script[data-aiclo-bulk-actions]')){
  const script=document.createElement('script');script.src='js/questions/bulk-actions.js?v=11.6.19';script.defer=true;script.dataset.aicloBulkActions='1';document.head.append(script);
 }
}

async function usedQuestionIds(ids){
 const used=new Set();
 if(!ids.length)return used;
 for(const table of ['exam_questions','exam_question_pool']){
  try{
   const {data,error}=await db.from(table).select('question_id').in('question_id',ids);
   if(error)throw error;
   (data||[]).forEach(r=>used.add(r.question_id));
  }catch(ex){console.warn(`V11.6.19 usage check ${table}`,ex)}
 }
 return used;
}

async function deleteUnusedQuestions(ids){
 if(!ids.length)return {deleted:0,failed:0};
 let deleted=0,failed=0;
 for(const id of ids){
  try{
   const a=await db.from('question_options').delete().eq('question_id',id);if(a.error)throw a.error;
   const b=await db.from('questions').delete().eq('id',id);if(b.error)throw b.error;
   deleted++;
  }catch(ex){failed++;console.warn('V11.6.19 bulk delete',id,ex)}
 }
 return {deleted,failed};
}

async function runBulkDelete(btn){
 const shared=window.AICLO_QUESTION_BULK_SELECTION?.ids?.()||[];
 const visible=$$('#qrows [data-select-question]:checked').map(x=>x.dataset.selectQuestion).filter(Boolean);
 const ids=[...new Set((shared.length?shared:visible).filter(Boolean))];
 if(!ids.length)return toast('Chưa chọn câu hỏi để xóa',true);
 const original=btn.textContent;btn.disabled=true;btn.textContent='Đang kiểm tra…';
 try{
  const used=await usedQuestionIds(ids),allowed=ids.filter(id=>!used.has(id));
  if(!allowed.length){await confirmAction('Không thể xóa',`${ids.length} câu đã chọn đều đã được sử dụng trong bài kiểm tra/đề và được giữ lại để bảo toàn dữ liệu.`,{confirmLabel:'Đóng'});return}
  const message=used.size
   ?`${allowed.length} câu có thể xóa; ${used.size} câu đã được sử dụng nên sẽ được giữ lại. Xóa ${allowed.length} câu có thể xóa?`
   :`Xóa vĩnh viễn ${allowed.length} câu đã chọn và toàn bộ phương án? Thao tác không thể hoàn tác.`;
  if(!await confirmAction('Xóa nhiều câu hỏi',message,{confirmLabel:`Xóa ${allowed.length} câu`,danger:true}))return;
  const r=await deleteUnusedQuestions(allowed);
  window.logActivity?.('delete','question',null,`Xóa hàng loạt ${r.deleted} câu hỏi`,'success',state.subjectId,{deleted:r.deleted,failed:r.failed,kept_used:used.size});
  window.AICLO_QUESTION_BULK_SELECTION?.clear?.();
  toast(r.failed?`Đã xóa ${r.deleted} câu; ${r.failed} câu không xóa được.`:`Đã xóa ${r.deleted} câu hỏi`);
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
