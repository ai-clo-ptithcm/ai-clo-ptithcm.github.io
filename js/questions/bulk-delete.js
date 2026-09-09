/* AI-CLO PTITHCM V12.6.45 — safe single/bulk question deletion. */
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

async function callSafeDelete(id){
 const {data,error}=await db.rpc('safe_delete_question',{p_question_id:id});
 if(error)throw error;
 const result=data&&typeof data==='object'?data:{};
 if(!['deleted','archived'].includes(result.action))throw new Error('Kết quả xóa câu hỏi không hợp lệ');
 return result;
}

async function safeDeleteQuestion(id,{refresh=true,notify=true,silent=false}={}){
 try{
  const result=await callSafeDelete(id);
  if(result.action==='archived'){
   window.logActivity?.('archive','question',id,'Chuyển câu hỏi đã được sử dụng sang Lưu trữ','success',state.subjectId,{reason:result.reason||'referenced'});
   if(notify)toast('Câu hỏi đã được sử dụng hoặc còn thuộc bài kiểm tra nên đã chuyển sang Lưu trữ.');
  }else{
   window.logActivity?.('delete','question',id,'Xóa vĩnh viễn câu hỏi chưa được sử dụng','success',state.subjectId);
   if(notify)toast('Đã xóa câu hỏi');
  }
  if(refresh){
   if(typeof backToQuestionList==='function')await backToQuestionList();
   else await render();
  }
  return result;
 }catch(ex){
  if(silent)throw ex;
  err(ex);
  return null;
 }
}

async function runBulkDelete(btn){
 const shared=window.AICLO_QUESTION_BULK_SELECTION?.ids?.()||[];
 const visible=$$('#qrows [data-select-question]:checked').map(x=>x.dataset.selectQuestion).filter(Boolean);
 const ids=[...new Set((shared.length?shared:visible).filter(Boolean))];
 if(!ids.length)return toast('Chưa chọn câu hỏi để xóa',true);
 const original=btn.textContent;btn.disabled=true;btn.textContent='Đang kiểm tra…';
 try{
  const message=`Xử lý ${ids.length} câu đã chọn? Câu chưa từng được sử dụng sẽ bị xóa vĩnh viễn; câu đã được dùng hoặc còn thuộc bài kiểm tra sẽ được chuyển sang trạng thái Lưu trữ.`;
  if(!await confirmAction('Xóa nhiều câu hỏi',message,{confirmLabel:`Xử lý ${ids.length} câu`,danger:true}))return;
  btn.textContent='Đang xử lý…';
  let deleted=0,archived=0,failed=0;
  for(const id of ids){
   try{
    const result=await callSafeDelete(id);
    if(result.action==='deleted')deleted++;
    else archived++;
   }catch(ex){
    failed++;
    console.warn('V12.6.45 safe bulk delete',id,ex);
   }
  }
  window.logActivity?.('delete','question',null,`Xử lý xóa hàng loạt ${ids.length} câu hỏi`,'success',state.subjectId,{deleted,archived,failed});
  window.AICLO_QUESTION_BULK_SELECTION?.clear?.();
  const parts=[];
  if(deleted)parts.push(`xóa vĩnh viễn ${deleted} câu`);
  if(archived)parts.push(`chuyển Lưu trữ ${archived} câu`);
  if(failed)parts.push(`${failed} câu không xử lý được`);
  toast(parts.length?`Đã ${parts.join('; ')}.`:'Không có câu hỏi nào được thay đổi.',failed>0&&deleted===0&&archived===0);
  if(typeof backToQuestionList==='function')await backToQuestionList();
  else await render();
 }catch(ex){err(ex)}finally{btn.disabled=false;btn.textContent=original}
}

document.addEventListener('click',event=>{
 const btn=event.target.closest?.('#bulkDeleteQuestions');if(!btn)return;
 event.preventDefault();event.stopPropagation();runBulkDelete(btn);
},true);

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',ensureBulkAssets,{once:true});else ensureBulkAssets();

/* Current question-detail code calls the legacy global removeQuestion().
   Keep that public contract, but route it through the transactional RPC above. */
window.removeQuestion=safeDeleteQuestion;
window.AICLO_QUESTION_SAFE_DELETE=Object.freeze({run:safeDeleteQuestion,call:callSafeDelete});
window.AICLO_QUESTION_BULK_DELETE=Object.freeze({run:runBulkDelete});
})();
