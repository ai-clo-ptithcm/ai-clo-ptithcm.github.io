/* AI-CLO PTITHCM V11 — AI question review/history helpers extracted from legacy V10. */
async function v10Profiles(ids){
 ids=[...new Set(ids.filter(Boolean))];
 if(!ids.length)return new Map();
 const rows=await q('profiles','id,full_name,email',z=>z.in('id',ids));
 return new Map(rows.map(p=>[p.id,p]));
}

aiHistory=async function(){
 try{
  captureQuestionFilters();
  const batches=await q('ai_generation_batches','*, chapters(name), clos(code)',x=>x.eq('subject_id',state.subjectId).order('created_at',{ascending:false}).limit(30));
  questionWorkspace('Các phiên tạo câu hỏi AI','Chọn phiên để tiếp tục duyệt trong trang.',`<div class="history-list">${batches.map(b=>`<button data-batch="${b.id}"><span><b>${esc(b.clos?.code)} · ${esc(b.chapters?.name)}</b><small>${new Date(b.created_at).toLocaleString('vi-VN')} · ${b.generated_count}/${b.requested_count} câu · ${esc(b.model||'Gemini')}</small></span><span class="badge ${b.status==='completed'?'green':'red'}">${esc(b.status)}</span></button>`).join('')||'<div class="empty">Chưa có phiên AI nào.</div>'}</div>`);
  $$('.history-list [data-batch]').forEach(b=>b.onclick=()=>reviewBatch(b.dataset.batch,0));
 }catch(ex){err(ex)}
};

advanceReview=async function(batch,drafts,pos){
 let pending=drafts.findIndex((x,i)=>i>pos&&x.review_status==='pending');
 if(pending<0)pending=drafts.findIndex(x=>x.review_status==='pending');
 if(pending>=0)return showDraft(batch,drafts,drafts[pending],pending);
 const {error}=await db.from('ai_generation_batches').update({status:'completed',completed_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq('id',batch.id);
 if(error)return err(error);
 toast('Đã duyệt xong phiên câu hỏi');
 backToQuestionList();
};

window.AICLO_AI_QUESTION_REVIEW=Object.freeze({profiles:v10Profiles,history:aiHistory,advance:advanceReview});
