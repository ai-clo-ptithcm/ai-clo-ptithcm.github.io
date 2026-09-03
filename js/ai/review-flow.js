/* AI-CLO PTITHCM V11.6.10 — in-page AI review with text + discipline-aware semantic duplicate checks. */
(()=>{
'use strict';

const HIGH_SIMILARITY=0.75;
const TEXT_LIMIT=3;
const SCOPE_KEY=id=>`aiclo:ai-batch-scope:${id}`;
const validScope=value=>['practice','secure_exam','both'].includes(value)?value:'practice';
const scopeLabel=value=>value==='secure_exam'?'🔒 Đề thi - bảo mật':value==='both'?'Cả hai ngân hàng':'Luyện tập - kiểm tra';
const reviewKey=()=>`ai-clo:v11:${state.user?.id||'user'}:${state.subjectId||'subject'}:ai-review`;
let textCheckRun=0,textCheckTimer=null,reviewSaveTimer=null;

function activeScope(){return validScope(window.AICLO_V105?.activeBank?.()||'practice')}
function rememberScope(batchId,scope){try{localStorage.setItem(SCOPE_KEY(batchId),validScope(scope))}catch{}}
function storedScope(batchId){try{return localStorage.getItem(SCOPE_KEY(batchId))||''}catch{return ''}}
function readReview(){try{return JSON.parse(sessionStorage.getItem(reviewKey())||'null')}catch{return null}}
function writeReview(value){try{sessionStorage.setItem(reviewKey(),JSON.stringify(value))}catch{}}
function clearReview(){try{sessionStorage.removeItem(reviewKey())}catch{}}

function formValues(){
 if(!$('#draftContent'))return null;
 return {
  content:$('#draftContent').value,
  explanation:$('#draftExplanation')?.value||'',
  correct_answer:$('#draftCorrect')?.value||'A',
  options:Object.fromEntries(['A','B','C','D'].map(k=>[k,$('#draft'+k)?.value||'']))
 };
}
function stashVisibleReview(){
 const active=readReview(),values=formValues();
 if(!active||!values)return;
 const draftValues={...(active.draft_values||{}),[active.draftId]:values};
 writeReview({...active,values,draft_values:draftValues,updatedAt:Date.now()});
}
function rememberReview(batch,d,pos,scope){
 stashVisibleReview();
 const previous=readReview()||{},draftValues={...(previous.draft_values||{})};
 const saved=draftValues[d.id]||(previous.draftId===d.id?previous.values:null)||null;
 writeReview({batchId:batch.id,draftId:d.id,pos,subjectId:batch.subject_id,questionScope:validScope(scope),values:saved,draft_values:draftValues,updatedAt:Date.now()});
}
function restoreReviewValues(d){
 const active=readReview();
 const saved=active?.draft_values?.[d.id]||(active?.draftId===d.id?active?.values:null);
 if(!saved)return;
 if($('#draftContent'))$('#draftContent').value=saved.content??d.content??'';
 if($('#draftExplanation'))$('#draftExplanation').value=saved.explanation??d.explanation??'';
 if($('#draftCorrect'))$('#draftCorrect').value=saved.correct_answer||d.correct_answer||'A';
 ['A','B','C','D'].forEach(k=>{if($('#draft'+k))$('#draft'+k).value=saved.options?.[k]??d.options?.[k]??''});
}
function queueReviewSave(){
 clearTimeout(reviewSaveTimer);
 reviewSaveTimer=setTimeout(stashVisibleReview,100);
}

async function resolveScope(batchId,preferred){
 if(preferred)return validScope(preferred);
 const active=readReview();
 if(active?.batchId===batchId&&active.questionScope)return validScope(active.questionScope);
 const saved=storedScope(batchId);if(saved)return validScope(saved);
 try{
  const {data,error}=await db.from('questions').select('question_scope').eq('ai_batch_id',batchId).limit(1);
  if(!error&&data?.[0]?.question_scope)return validScope(data[0].question_scope);
 }catch{}
 return activeScope();
}

function scoreClass(score){return score>=.9?'danger':score>=.75?'warning':'neutral'}
async function findSimilar(batch,draft,content){
 const {data,error}=await db.rpc('find_similar_questions_scoped',{
  p_subject_id:batch.subject_id,
  p_chapter_id:batch.chapter_id,
  p_topic_id:draft.topic_id||batch.topic_id||null,
  p_content:content,
  p_exclude_id:null,
  p_limit:TEXT_LIMIT
 });
 if(error)throw error;
 return data||[];
}
function textSimilarHtml(rows){
 if(!rows.length)return '<p class="ai-similar-empty">✓ Không phát hiện câu có độ giống văn bản đáng kể trong cùng phạm vi.</p>';
 return rows.map(row=>{
  const score=Number(row.similarity_score)||0;
  const code=String(row.code||'').trim()||'—';
  return `<article class="ai-similar-item ${scoreClass(score)}"><div><b>${esc(code)}</b><span class="ai-similar-score">${Math.round(score*100)}%</span><span class="badge">${esc(row.question_scope==='secure_exam'?'Đề thi':row.question_scope==='both'?'Cả hai':'Luyện tập')}</span></div><p>${esc(row.content||'')}</p></article>`;
 }).join('');
}
async function runTextSimilarityCheck(batch,draft,{silent=false}={}){
 const box=$('#aiTextSimilarResults'),status=$('#aiTextSimilarityStatus');
 const run=++textCheckRun;
 if(box)box.innerHTML='<p class="ai-similar-empty checking">Đang đối chiếu văn bản trong ngân hàng…</p>';
 if(status)status.textContent='Đang kiểm tra…';
 try{
  const content=String($('#draftContent')?.value||draft.content||'').trim();
  if(!content)throw new Error('Nội dung câu hỏi đang trống.');
  const rows=await findSimilar(batch,draft,content);
  if(run!==textCheckRun||!$('#aiTextSimilarResults'))return {ok:false,rows:[],stale:true};
  if(box)box.innerHTML=textSimilarHtml(rows);
  if(status)status.textContent=rows.length?`Có ${rows.length} câu gần giống nhất`:'Không phát hiện câu gần giống';
  const input=$('#draftContent');if(input)input.dataset.similarityCheckedValue=content;
  renderMath(box);
  return {ok:true,rows};
 }catch(error){
  if(run!==textCheckRun)return {ok:false,rows:[],error,stale:true};
  if(box)box.innerHTML=`<p class="ai-similar-empty error">Không kiểm tra được độ giống văn bản: ${esc(error?.message||'Lỗi không xác định')}</p>`;
  if(status)status.textContent='Chưa kiểm tra được';
  if(!silent)console.warn('AI text duplicate review failed',error);
  return {ok:false,rows:[],error};
 }
}

function disciplineText(value){
 if(value==='physics')return {noun:'vật lý',nature:'bản chất vật lý'};
 if(value==='math')return {noun:'toán học',nature:'bản chất toán học'};
 return {noun:'nội dung chuyên môn',nature:'bản chất chuyên môn'};
}
async function runSemanticSimilarityCheck(batch,draft){
 const button=$('#checkSemanticSimilarity'),box=$('#aiSemanticSimilarity'),status=$('#aiSemanticStatus');
 if(!button||!box)return;
 button.disabled=true;button.textContent='✦ AI đang phân tích…';
 if(status)status.textContent='Gemini đang so sánh bản chất nội dung…';
 box.innerHTML='<p class="ai-similar-empty checking">Đang phân tích cấu trúc kiến thức, dữ kiện và hướng giải…</p>';
 try{
  const options=['A','B','C','D'].map(k=>`${k}. ${$('#draft'+k)?.value||''}`).join('\n');
  const {data,error}=await db.functions.invoke('analyze-question-similarity',{body:{
   subject_id:batch.subject_id,
   chapter_id:batch.chapter_id,
   topic_id:draft.topic_id||batch.topic_id||null,
   content:$('#draftContent')?.value||'',
   options,
   explanation:$('#draftExplanation')?.value||''
  }});
  if(error){let detail;try{detail=await error.context?.json()}catch{}throw new Error(detail?.error||error.message)}
  if(!data?.success)throw new Error(data?.error||'Không thể phân tích độ giống nội dung.');
  const domain=disciplineText(data.discipline_group),matches=data.matches||[];
  if(status)status.textContent=`Đã kiểm tra ${domain.nature}${data.model?` · ${data.model}`:''}`;
  box.innerHTML=matches.length?matches.map(item=>`<article class="ai-similar-item math ${scoreClass(Number(item.score||0)/100)}"><div><b>${esc(item.code||'—')}</b><span class="ai-similar-score">${Number(item.score||0)}% giống ${esc(domain.noun)}</span>${item.only_surface_changed?'<span class="badge red">Chỉ thay dữ kiện bề mặt</span>':''}</div><p>${esc(item.content||'')}</p><small>${esc(item.reason||'')}</small></article>`).join(''):`<p class="ai-similar-empty">AI không phát hiện câu giống đáng kể về ${esc(domain.nature)}.</p>`;
  renderMath(box);
  button.textContent='✦ Kiểm tra lại bằng AI';
 }catch(error){
  if(status)status.textContent='Chưa kiểm tra được bằng AI';
  box.innerHTML=`<p class="ai-similar-empty error">${esc(error?.message||'Không thể phân tích độ giống nội dung.')}</p>`;
  button.textContent='✦ Thử lại bằng AI';
 }finally{button.disabled=false}
}

async function reviewBatchV11610(batchId,index=0,options={}){
 try{
  const [batches,drafts]=await Promise.all([
   q('ai_generation_batches','*, chapters(name), clos(code,description)',x=>x.eq('id',batchId)),
   q('ai_question_drafts','*',x=>x.eq('batch_id',batchId).order('order_index'))
  ]);
  const batch=batches[0];
  if(!batch||!drafts.length)return toast('Không tìm thấy câu hỏi trong phiên này',true);
  const scope=await resolveScope(batchId,options.questionScope);
  rememberScope(batchId,scope);
  const active=readReview();
  let start=Number(index||0);
  if(active?.batchId===batchId&&active.draftId){const savedPos=drafts.findIndex(x=>x.id===active.draftId&&x.review_status==='pending');if(savedPos>=0)start=savedPos}
  let pos=drafts.findIndex((d,i)=>i>=start&&d.review_status==='pending');
  if(pos<0)pos=drafts.findIndex(d=>d.review_status==='pending');
  if(pos<0){clearReview();toast('Phiên AI này đã được duyệt xong');return backToQuestionList()}
  showDraftV11610(batch,drafts,drafts[pos],pos,{questionScope:scope});
 }catch(error){err(error)}
}

async function advanceReviewV11610(batch,drafts,pos,options={}){
 let next=drafts.findIndex((d,i)=>i>pos&&d.review_status==='pending');
 if(next<0)next=drafts.findIndex(d=>d.review_status==='pending');
 if(next>=0)return showDraftV11610(batch,drafts,drafts[next],next,options);
 clearReview();
 const {error}=await db.from('ai_generation_batches').update({status:'completed',completed_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq('id',batch.id);
 if(error)return err(error);
 toast(`Đã duyệt xong ${drafts.length}/${drafts.length} câu`);
 backToQuestionList();
}

function showDraftV11610(batch,drafts,d,pos,options={}){
 const scope=validScope(options.questionScope||storedScope(batch.id)||readReview()?.questionScope||activeScope());
 rememberScope(batch.id,scope);
 rememberReview(batch,d,pos,scope);
 const approved=drafts.filter(x=>x.review_status==='approved').length;
 const rejected=drafts.filter(x=>x.review_status==='rejected').length;
 let prevPos=-1,nextPos=-1;
 for(let i=pos-1;i>=0;i--){if(drafts[i].review_status==='pending'){prevPos=i;break}}
 for(let i=pos+1;i<drafts.length;i++){if(drafts[i].review_status==='pending'){nextPos=i;break}}
 const topicScope=d.topic_id||batch.topic_id?'chủ đề':'chương';

 questionWorkspace(
  'Duyệt câu hỏi AI',
  `Câu ${pos+1}/${drafts.length} · Đã lưu ${approved} · Bỏ qua ${rejected} · Còn ${drafts.length-approved-rejected} câu chờ duyệt`,
  `<div class="review-wrap ai-review-page">
   <div class="review-progress"><b>Câu ${pos+1}/${drafts.length}</b><span>Đã lưu: ${approved} · Bỏ qua: ${rejected} · Chờ duyệt: ${drafts.length-approved-rejected}</span></div>
   <div class="review-tags"><span class="badge red">${esc(batch.clos?.code||'')}</span><span class="badge">${esc(batch.chapters?.name||'')}</span><span class="badge ai-review-scope">${esc(scopeLabel(scope))}</span></div>
   <section class="ai-review-editor">
    <div class="ai-note"><b>Xem trước công thức</b><div>${esc(d.content)}</div>${['A','B','C','D'].map(k=>`<div><b>${k}.</b> ${esc(d.options?.[k]||'')}</div>`).join('')}${d.explanation?`<div><b>Lời giải:</b> ${esc(d.explanation)}</div>`:''}</div>
    <label class="field">Nội dung<textarea id="draftContent">${esc(d.content)}</textarea></label>
    <div class="review-options">${['A','B','C','D'].map(k=>`<label class="${d.correct_answer===k?'correct':''}"><b>${k}</b><input id="draft${k}" value="${esc(d.options?.[k]||'')}"></label>`).join('')}</div>
    <div class="ai-review-answer-row"><label class="field">Đáp án đúng<select id="draftCorrect">${['A','B','C','D'].map(k=>`<option ${d.correct_answer===k?'selected':''}>${k}</option>`).join('')}</select></label><label class="field">Lời giải<textarea id="draftExplanation">${esc(d.explanation||'')}</textarea></label></div>
   </section>
   <section class="ai-similar-panel ai-text-similar-panel"><div class="ai-similar-head"><div><h4>3 câu gần giống nhất</h4><p id="aiTextSimilarityStatus">Đang kiểm tra…</p><small>Đối chiếu tự động bằng độ giống văn bản trong cùng ${topicScope}.</small></div><button id="recheckTextDuplicate" class="secondary" type="button">Kiểm tra lại văn bản</button></div><div id="aiTextSimilarResults"><p class="ai-similar-empty checking">Đang đối chiếu văn bản…</p></div></section>
   <section class="ai-similar-panel ai-semantic-panel"><div class="ai-similar-head"><div><h4>Kiểm tra giống về nội dung</h4><p id="aiSemanticStatus">Chỉ gọi AI khi giảng viên nhấn nút.</p><small>Toán: so bản chất toán học, dạng toán và hướng giải. Vật lý: so hiện tượng, định luật, mô hình và phương pháp giải.</small></div><button id="checkSemanticSimilarity" class="ai-btn" type="button">✦ AI kiểm tra giống về nội dung</button></div><div id="aiSemanticSimilarity"></div></section>
   <div class="review-actions ai-review-actions"><button class="secondary" id="prevDraft" ${prevPos<0?'disabled':''}>← Câu trước</button><button class="danger" id="rejectDraft">Bỏ qua</button><button class="primary" id="approveDraft">Xác nhận và lưu</button><button class="secondary" id="nextDraft" ${nextPos<0?'disabled':''}>Câu sau →</button></div>
  </div>`
 );
 restoreReviewValues(d);
 renderMath($('.ai-review-page'));

 const back=$('#questionBack');if(back)back.onclick=async()=>{stashVisibleReview();clearReview();await backToQuestionList()};
 if(prevPos>=0)$('#prevDraft').onclick=()=>{stashVisibleReview();showDraftV11610(batch,drafts,drafts[prevPos],prevPos,{questionScope:scope})};
 if(nextPos>=0)$('#nextDraft').onclick=()=>{stashVisibleReview();showDraftV11610(batch,drafts,drafts[nextPos],nextPos,{questionScope:scope})};
 $('#recheckTextDuplicate').onclick=()=>runTextSimilarityCheck(batch,d);
 $('#checkSemanticSimilarity').onclick=()=>runSemanticSimilarityCheck(batch,d);

 const contentInput=$('#draftContent');
 contentInput?.addEventListener('input',()=>{
  queueReviewSave();
  const status=$('#aiTextSimilarityStatus');if(status)status.textContent='Nội dung đã thay đổi · đang kiểm tra lại…';
  if($('#aiSemanticSimilarity'))$('#aiSemanticSimilarity').innerHTML='<p class="ai-similar-empty checking">Nội dung đã thay đổi; hãy kiểm tra AI lại nếu cần.</p>';
  if($('#aiSemanticStatus'))$('#aiSemanticStatus').textContent='Kết quả AI cũ không còn áp dụng.';
  clearTimeout(textCheckTimer);textCheckTimer=setTimeout(()=>runTextSimilarityCheck(batch,d,{silent:true}),350);
 });
 ['#draftExplanation','#draftCorrect','#draftA','#draftB','#draftC','#draftD'].forEach(sel=>$(sel)?.addEventListener('input',queueReviewSave));
 ['#draftCorrect'].forEach(sel=>$(sel)?.addEventListener('change',queueReviewSave));

 $('#rejectDraft').onclick=async()=>{
  const {error}=await db.from('ai_question_drafts').update({review_status:'rejected',reviewed_by:state.user.id,reviewed_at:new Date().toISOString()}).eq('id',d.id);
  if(error)return err(error);
  d.review_status='rejected';toast('Đã bỏ qua câu hỏi');
  advanceReviewV11610(batch,drafts,pos,{questionScope:scope});
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

   const checked=await runTextSimilarityCheck(batch,d,{silent:true});
   if(!checked.ok){
    const go=await confirmAction('Chưa kiểm tra được câu trùng','Hệ thống chưa kiểm tra được độ giống văn bản. Bạn vẫn muốn lưu câu này?',{confirmLabel:'Vẫn lưu'});
    if(!go){button.disabled=false;return}
   }else{
    const high=checked.rows.filter(x=>(Number(x.similarity_score)||0)>=HIGH_SIMILARITY);
    if(high.length){
     const top=Math.round(Math.max(...high.map(x=>Number(x.similarity_score)||0))*100);
     const go=await confirmAction('Phát hiện câu tương tự',`Có ${high.length} câu có độ giống văn bản cao, cao nhất ${top}%. Bạn vẫn muốn lưu câu này?`,{confirmLabel:'Vẫn lưu'});
     if(!go){button.disabled=false;return}
    }
   }

   const qrow={subject_id:batch.subject_id,chapter_id:batch.chapter_id,topic_id:d.topic_id||batch.topic_id,clo_id:batch.clo_id,content,explanation,correct_answer:correct,created_by:state.user.id,status:'active',question_scope:scope,approval_status:'approved',approved_by:state.user.id,approved_at:new Date().toISOString(),origin_type:'gemini',ai_batch_id:batch.id};
   const {data:question,error:qerr}=await db.from('questions').insert(qrow).select().single();
   if(qerr)throw qerr;
   const optionPayload=optionsRows.map(x=>({question_id:question.id,...x}));
   const {error:oerr}=await db.from('question_options').insert(optionPayload);
   if(oerr){await db.from('questions').delete().eq('id',question.id);throw oerr}
   const {error:derr}=await db.from('ai_question_drafts').update({content,options:Object.fromEntries(optionsRows.map(x=>[x.option_key,x.content])),correct_answer:correct,explanation,review_status:'approved',approved_question_id:question.id,reviewed_by:state.user.id,reviewed_at:new Date().toISOString()}).eq('id',d.id);
   if(derr)throw derr;
   d.review_status='approved';d.content=content;d.explanation=explanation;d.correct_answer=correct;d.options=Object.fromEntries(optionsRows.map(x=>[x.option_key,x.content]));
   toast(`Đã lưu câu hỏi vào ${scopeLabel(scope)}`);
   advanceReviewV11610(batch,drafts,pos,{questionScope:scope});
  }catch(error){err(error);button.disabled=false}
 };

 runTextSimilarityCheck(batch,d,{silent:true});
}

window.reviewBatch=reviewBatchV11610;
window.showDraft=showDraftV11610;
window.advanceReview=advanceReviewV11610;
window.AICLO_AI_REVIEW_STATE=Object.freeze({read:readReview,write:writeReview,clear:clearReview});
window.AICLO_AI_REVIEW_FLOW=Object.freeze({reviewBatch:reviewBatchV11610,showDraft:showDraftV11610,advance:advanceReviewV11610,rememberScope,resolveScope,runTextSimilarityCheck,runSemanticSimilarityCheck});
})();
