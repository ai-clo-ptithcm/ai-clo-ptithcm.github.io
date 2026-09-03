/* AI-CLO PTITHCM V11.6.8 — AI draft review, duplicate checking, provenance and bank scope. */
(()=>{
'use strict';

const HIGH_SIMILARITY=0.75;
const SCOPE_KEY=id=>`aiclo:ai-batch-scope:${id}`;
const validScope=value=>['practice','secure_exam','both'].includes(value)?value:'practice';
const scopeLabel=value=>value==='secure_exam'?'🔒 Đề thi - bảo mật':value==='both'?'Cả hai ngân hàng':'Luyện tập - kiểm tra';

function activeScope(){return validScope(window.AICLO_V105?.activeBank?.()||'practice')}
function rememberScope(batchId,scope){try{localStorage.setItem(SCOPE_KEY(batchId),validScope(scope))}catch{}}
function storedScope(batchId){try{return localStorage.getItem(SCOPE_KEY(batchId))||''}catch{return ''}}

async function resolveScope(batchId,preferred){
 if(preferred)return validScope(preferred);
 const saved=storedScope(batchId);if(saved)return validScope(saved);
 try{
  const {data,error}=await db.from('questions').select('question_scope').eq('ai_batch_id',batchId).limit(1);
  if(!error&&data?.[0]?.question_scope)return validScope(data[0].question_scope);
 }catch{}
 return activeScope();
}

async function findSimilar(batch,draft,content){
 const {data,error}=await db.rpc('find_similar_questions_scoped',{
  p_subject_id:batch.subject_id,
  p_chapter_id:batch.chapter_id,
  p_topic_id:draft.topic_id||batch.topic_id||null,
  p_content:content,
  p_exclude_id:null,
  p_limit:5
 });
 if(error)throw error;
 return data||[];
}

function similarHtml(rows){
 if(!rows.length)return '<p class="ai-similar-empty">✓ Không phát hiện câu tương tự trong cùng phạm vi.</p>';
 return rows.map(row=>{
  const score=Number(row.similarity_score)||0;
  const cls=score>=HIGH_SIMILARITY?'danger':score>=0.6?'warning':'';
  const code=String(row.code||'').trim()||'—';
  return `<div class="ai-similar-item ${cls}"><div><b>${esc(code)}</b><span class="ai-similar-score">${Math.round(score*100)}%</span><span class="badge">${esc(row.question_scope==='secure_exam'?'Đề thi':row.question_scope==='both'?'Cả hai':'Luyện tập')}</span></div><p>${esc(row.content||'')}</p></div>`;
 }).join('');
}

async function runSimilarityCheck(batch,draft,{silent=false}={}){
 const box=$('#aiSimilarResults'),status=$('#aiSimilarityStatus');
 if(box)box.innerHTML='<p class="ai-similar-empty checking">Đang kiểm tra câu tương tự…</p>';
 if(status)status.textContent='Đang kiểm tra…';
 try{
  const content=String($('#draftContent')?.value||draft.content||'').trim();
  if(!content)throw new Error('Nội dung câu hỏi đang trống.');
  const rows=await findSimilar(batch,draft,content);
  if(box)box.innerHTML=similarHtml(rows);
  if(status)status.textContent=rows.length?`Phát hiện ${rows.length} câu tương tự`:'Không phát hiện câu tương tự';
  const input=$('#draftContent');if(input)input.dataset.similarityCheckedValue=content;
  return {ok:true,rows};
 }catch(error){
  if(box)box.innerHTML=`<p class="ai-similar-empty error">Không kiểm tra được câu tương tự: ${esc(error?.message||'Lỗi không xác định')}</p>`;
  if(status)status.textContent='Chưa kiểm tra được';
  if(!silent)console.warn('AI duplicate review check failed',error);
  return {ok:false,rows:[],error};
 }
}

async function reviewBatchV1168(batchId,index=0,options={}){
 try{
  const [batches,drafts]=await Promise.all([
   q('ai_generation_batches','*, chapters(name), clos(code,description)',x=>x.eq('id',batchId)),
   q('ai_question_drafts','*',x=>x.eq('batch_id',batchId).order('order_index'))
  ]);
  const batch=batches[0];
  if(!batch||!drafts.length)return toast('Không tìm thấy câu hỏi trong phiên này',true);
  const scope=await resolveScope(batchId,options.questionScope);
  rememberScope(batchId,scope);
  let pos=drafts.findIndex((d,i)=>i>=Number(index||0)&&d.review_status==='pending');
  if(pos<0)pos=drafts.findIndex(d=>d.review_status==='pending');
  if(pos<0){
   toast('Phiên AI này đã được duyệt xong');
   return backToQuestionList();
  }
  showDraftV1168(batch,drafts,drafts[pos],pos,{questionScope:scope});
 }catch(error){err(error)}
}

async function advanceReviewV1168(batch,drafts,pos,options={}){
 let next=drafts.findIndex((d,i)=>i>pos&&d.review_status==='pending');
 if(next<0)next=drafts.findIndex(d=>d.review_status==='pending');
 if(next>=0)return showDraftV1168(batch,drafts,drafts[next],next,options);
 const {error}=await db.from('ai_generation_batches').update({status:'completed',completed_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq('id',batch.id);
 if(error)return err(error);
 toast(`Đã duyệt xong ${drafts.length}/${drafts.length} câu`);
 backToQuestionList();
}

function showDraftV1168(batch,drafts,d,pos,options={}){
 const scope=validScope(options.questionScope||activeScope());
 rememberScope(batch.id,scope);
 const approved=drafts.filter(x=>x.review_status==='approved').length;
 const rejected=drafts.filter(x=>x.review_status==='rejected').length;
 modal('Duyệt câu hỏi AI',`<div class="review-wrap ai-review-v1168">
  <div class="review-progress"><b>Câu ${pos+1}/${drafts.length}</b><span>Đã lưu: ${approved} · Bỏ qua: ${rejected} · Chờ duyệt: ${drafts.length-approved-rejected}</span></div>
  <div class="review-tags"><span class="badge red">${esc(batch.clos?.code||'')}</span><span class="badge">${esc(batch.chapters?.name||'')}</span><span class="badge ai-review-scope">${esc(scopeLabel(scope))}</span></div>
  <div class="ai-note"><b>Xem trước</b><div>${esc(d.content)}</div>${['A','B','C','D'].map(k=>`<div><b>${k}.</b> ${esc(d.options?.[k]||'')}</div>`).join('')}${d.explanation?`<div><b>Lời giải:</b> ${esc(d.explanation)}</div>`:''}</div>
  <label class="field">Nội dung<textarea id="draftContent">${esc(d.content)}</textarea></label>
  <div class="review-options">${['A','B','C','D'].map(k=>`<label class="${d.correct_answer===k?'correct':''}"><b>${k}</b><input id="draft${k}" value="${esc(d.options?.[k]||'')}"></label>`).join('')}</div>
  <label class="field">Đáp án đúng<select id="draftCorrect">${['A','B','C','D'].map(k=>`<option ${d.correct_answer===k?'selected':''}>${k}</option>`).join('')}</select></label>
  <label class="field">Lời giải<textarea id="draftExplanation">${esc(d.explanation||'')}</textarea></label>
  <section class="ai-similar-panel"><div class="ai-similar-head"><div><h4>Kiểm tra câu tương tự</h4><p id="aiSimilarityStatus">Đang kiểm tra…</p></div><button id="recheckAiDuplicate" class="secondary" type="button">Kiểm tra lại</button></div><div id="aiSimilarResults"><p class="ai-similar-empty checking">Đang kiểm tra câu tương tự…</p></div></section>
  <div class="review-actions"><button class="secondary" id="prevDraft" ${pos===0?'disabled':''}>← Trước</button><button class="danger" id="rejectDraft">Bỏ qua</button><button class="primary" id="approveDraft">Xác nhận và lưu</button><button class="secondary" id="nextDraft" ${pos===drafts.length-1?'disabled':''}>Sau →</button></div>
 </div>`);

 $('#prevDraft').onclick=()=>showDraftV1168(batch,drafts,drafts[pos-1],pos-1,{questionScope:scope});
 $('#nextDraft').onclick=()=>showDraftV1168(batch,drafts,drafts[pos+1],pos+1,{questionScope:scope});
 $('#recheckAiDuplicate').onclick=()=>runSimilarityCheck(batch,d);
 $('#draftContent').addEventListener('input',()=>{
  const input=$('#draftContent'),status=$('#aiSimilarityStatus');
  if(status&&input.dataset.similarityCheckedValue!==input.value.trim())status.textContent='Nội dung đã thay đổi · sẽ kiểm tra lại khi lưu';
 });

 $('#rejectDraft').onclick=async()=>{
  const {error}=await db.from('ai_question_drafts').update({review_status:'rejected',reviewed_by:state.user.id,reviewed_at:new Date().toISOString()}).eq('id',d.id);
  if(error)return err(error);
  d.review_status='rejected';toast('Đã bỏ qua câu hỏi');
  advanceReviewV1168(batch,drafts,pos,{questionScope:scope});
 };

 $('#approveDraft').onclick=async()=>{
  const button=$('#approveDraft');button.disabled=true;
  try{
   const content=$('#draftContent').value.trim();
   const explanation=$('#draftExplanation').value.trim()||null;
   const correct=$('#draftCorrect').value;
   const optionsRows=['A','B','C','D'].map(k=>({option_key:k,content:$('#draft'+k).value.trim()}));
   if(!content)throw new Error('Nội dung câu hỏi không được để trống');
   if(!d.topic_id&&!batch.topic_id)throw new Error('Câu hỏi chưa được gắn chủ đề');
   if(optionsRows.some(x=>!x.content))throw new Error('Cần nhập đủ bốn phương án A–D');

   const checked=await runSimilarityCheck(batch,d,{silent:true});
   if(!checked.ok){
    const go=await confirmAction('Chưa kiểm tra được câu trùng','Hệ thống chưa kiểm tra được câu tương tự. Bạn vẫn muốn lưu câu này?',{confirmLabel:'Vẫn lưu'});
    if(!go){button.disabled=false;return}
   }else{
    const high=checked.rows.filter(x=>(Number(x.similarity_score)||0)>=HIGH_SIMILARITY);
    if(high.length){
     const top=Math.round(Math.max(...high.map(x=>Number(x.similarity_score)||0))*100);
     const go=await confirmAction('Phát hiện câu tương tự',`Có ${high.length} câu có độ tương đồng cao, cao nhất ${top}%. Bạn vẫn muốn lưu câu này?`,{confirmLabel:'Vẫn lưu'});
     if(!go){button.disabled=false;return}
    }
   }

   const qrow={
    subject_id:batch.subject_id,
    chapter_id:batch.chapter_id,
    topic_id:d.topic_id||batch.topic_id,
    clo_id:batch.clo_id,
    content,
    explanation,
    correct_answer:correct,
    created_by:state.user.id,
    status:'active',
    question_scope:scope,
    approval_status:'approved',
    approved_by:state.user.id,
    approved_at:new Date().toISOString(),
    origin_type:'gemini',
    ai_batch_id:batch.id
   };
   const {data:question,error:qerr}=await db.from('questions').insert(qrow).select().single();
   if(qerr)throw qerr;
   const optionPayload=optionsRows.map(x=>({question_id:question.id,...x}));
   const {error:oerr}=await db.from('question_options').insert(optionPayload);
   if(oerr){await db.from('questions').delete().eq('id',question.id);throw oerr}
   const {error:derr}=await db.from('ai_question_drafts').update({content,options:Object.fromEntries(optionsRows.map(x=>[x.option_key,x.content])),correct_answer:correct,explanation,review_status:'approved',approved_question_id:question.id,reviewed_by:state.user.id,reviewed_at:new Date().toISOString()}).eq('id',d.id);
   if(derr)throw derr;
   d.review_status='approved';d.content=content;d.explanation=explanation;d.correct_answer=correct;d.options=Object.fromEntries(optionsRows.map(x=>[x.option_key,x.content]));
   toast(`Đã lưu câu hỏi vào ${scopeLabel(scope)}`);
   advanceReviewV1168(batch,drafts,pos,{questionScope:scope});
  }catch(error){err(error);button.disabled=false}
 };

 runSimilarityCheck(batch,d,{silent:true});
}

window.reviewBatch=reviewBatchV1168;
window.showDraft=showDraftV1168;
window.advanceReview=advanceReviewV1168;
window.AICLO_AI_REVIEW_FLOW=Object.freeze({reviewBatch:reviewBatchV1168,showDraft:showDraftV1168,advance:advanceReviewV1168,rememberScope,resolveScope});
})();
