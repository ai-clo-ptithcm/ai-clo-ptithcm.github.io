/* AI-CLO PTITHCM V11 — safe bulk delete for question bank. */
(() => {
'use strict';

async function usedQuestionIds(ids){
 const used=new Set();
 if(!ids.length)return used;
 for(const table of ['exam_questions','exam_question_pool']){
  try{
   const {data,error}=await db.from(table).select('question_id').in('question_id',ids);
   if(error)throw error;
   (data||[]).forEach(r=>used.add(r.question_id));
  }catch(ex){console.warn(`V10.5.3 usage check ${table}`,ex)}
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
  }catch(ex){failed++;console.warn('V10.5.3 bulk delete',id,ex)}
 }
 return {deleted,failed};
}

function addSafeBulkDelete(){
 const bar=$('#bulkQuestionBar');if(!bar||$('#bulkDeleteQuestions'))return;
 const clear=$('#clearQuestionSelection');
 const btn=document.createElement('button');btn.id='bulkDeleteQuestions';btn.className='danger';btn.textContent='Xóa đã chọn';
 bar.insertBefore(btn,clear||null);
 btn.onclick=async()=>{
  const ids=$$('#qrows [data-select-question]:checked').map(x=>x.dataset.selectQuestion).filter(Boolean);
  if(!ids.length)return toast('Chưa chọn câu hỏi để xóa',true);
  btn.disabled=true;btn.textContent='Đang kiểm tra…';
  try{
   const used=await usedQuestionIds(ids),allowed=ids.filter(id=>!used.has(id));
   if(!allowed.length){await confirmAction('Không thể xóa',`${ids.length} câu đã chọn đều đã được sử dụng trong bài kiểm tra/đề và được giữ lại để bảo toàn dữ liệu.`,{confirmLabel:'Đóng'});return}
   const message=used.size
    ?`${allowed.length} câu có thể xóa; ${used.size} câu đã được sử dụng nên sẽ được giữ lại. Xóa ${allowed.length} câu có thể xóa?`
    :`Xóa vĩnh viễn ${allowed.length} câu đã chọn và toàn bộ phương án? Thao tác không thể hoàn tác.`;
   if(!await confirmAction('Xóa nhiều câu hỏi',message,{confirmLabel:`Xóa ${allowed.length} câu`,danger:true}))return;
   const r=await deleteUnusedQuestions(allowed);
   toast(r.failed?`Đã xóa ${r.deleted} câu; ${r.failed} câu không xóa được.`:`Đã xóa ${r.deleted} câu hỏi`);
   await render();
  }catch(ex){err(ex)}finally{btn.disabled=false;btn.textContent='Xóa đã chọn'}
 };
}

const oldQuestions=window.questions;
window.questions=async function(c){
 await oldQuestions(c);
 addSafeBulkDelete();
};

window.AICLO_QUESTION_BULK_DELETE=Object.freeze({bind:addSafeBulkDelete});
})();
