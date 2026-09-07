/* AI-CLO PTITHCM V11 — question bank filters, draft persistence and lightweight list loading. */
(() => {
'use strict';

const keyBase=()=>`ai-clo:v1053:${state.user?.id||'user'}:${state.subjectId||'subject'}`;
const filterKey=()=>`${keyBase()}:question-filters`;
const draftKey=id=>`${keyBase()}:question-draft:${id||'new'}`;
let draftTimer=null;

const jsonRead=(key,fallback=null)=>{try{return JSON.parse(sessionStorage.getItem(key)||'null')??fallback}catch{return fallback}};
const jsonWrite=(key,value)=>{try{sessionStorage.setItem(key,JSON.stringify(value))}catch{}};
const jsonDrop=key=>{try{sessionStorage.removeItem(key)}catch{}};

function currentFilters(){
 if(!$('#qsearch'))return null;
 let search=String($('#qsearch').value||'').trim();
 if(search.toLowerCase()==='all')search='';
 return {
  search,
  chapter:$('#qchapterFilter')?.value||'all',
  topic:$('#qtopicFilter')?.value||'all',
  clo:$('#qcloFilter')?.value||'all',
  approval:$('#qapprovalFilter')?.value||'all',
  creator:$('#qcreatorFilter')?.value||'all',
  bank:window.AICLO_V105?.activeBank?.()||'practice',
  scrollY:window.scrollY||0
 };
}
function persistFilters(){
 const f=currentFilters();
 if(!f)return;
 v94QuestionFilters=f;
 jsonWrite(filterKey(),f);
}
function savedFilters(){return v94QuestionFilters||jsonRead(filterKey(),null)}
function restoreFilters(){
 const f=savedFilters();if(!f||!$('#qsearch'))return;
 let search=String(f.search||'');if(search.toLowerCase()==='all')search='';
 $('#qsearch').value=search;
 if($('#qchapterFilter')){$('#qchapterFilter').value=f.chapter||'all';$('#qchapterFilter').dispatchEvent(new Event('change'))}
 if($('#qtopicFilter')&&[...$('#qtopicFilter').options].some(o=>o.value===(f.topic||'all')))$('#qtopicFilter').value=f.topic||'all';
 if($('#qcloFilter'))$('#qcloFilter').value=f.clo||'all';
 if($('#qapprovalFilter'))$('#qapprovalFilter').value=f.approval||'all';
 if($('#qcreatorFilter'))$('#qcreatorFilter').value=f.creator||'all';
 $('#qsearch').dispatchEvent(new Event('input'));
 requestAnimationFrame(()=>window.scrollTo({top:Number(f.scrollY)||0,behavior:'auto'}));
}

const oldCapture=window.captureQuestionFilters;
window.captureQuestionFilters=function(){oldCapture?.();persistFilters()};
const oldBack=window.backToQuestionList;
window.backToQuestionList=async function(){
 const f=savedFilters();if(f)v94QuestionFilters=f;
 await oldBack();
 persistFilters();
};

const fullQuestionSets=window.v96QuestionSets;
async function lightQuestionSets(){
 const sid=state.subjectId;
 const [items,ch,clos]=await Promise.all([
  q('questions','id,subject_id,question_bank_id,display_code,chapter_id,topic_id,clo_id,content,created_by,status,question_scope,approval_status,origin_type,ai_batch_id,is_official,verified_by,verified_at,created_at,updated_at',x=>contentFilter(x,sid).order('created_at',{ascending:false})),
  q('chapters','*',x=>contentFilter(x,sid).order('order_index')),
  q('clos','*',x=>contentFilter(x,sid).order('code'))
 ]);
 const chapterIds=ch.map(x=>x.id).filter(Boolean);
 const topics=chapterIds.length?await q('topics','*',x=>x.in('chapter_id',chapterIds).order('order_index')):[];
 return {items,ch,topics,clos};
}
async function hydrateQuestion(x){
 if(!x?.id||Array.isArray(x.question_options))return x;
 const {data,error}=await db.from('questions').select('*, question_options(*)').eq('id',x.id).single();
 if(error)throw error;
 return {...x,...data};
}
function invalidateQuestionData(id=null){
 if(id)window.AICLO_PERF?.invalidate?.(`questions:detail:${id}`);
 window.AICLO_OVERVIEW?.invalidate?.(state.subjectId);
 window.AICLO_RUNTIME_PERF?.invalidateCourse?.(state.subjectId);
 window.AICLO_VIEW_TRANSITION?.invalidate?.('questions',state.subjectId,'course');
}

const oldQuestions=window.questions;
window.questions=async function(c){
 const f=savedFilters();
 if(f?.bank&&window.AICLO_V105?.activeBank?.()!==f.bank)v94QuestionFilters=f;
 const currentLoader=window.v96QuestionSets;
 window.v96QuestionSets=lightQuestionSets;
 try{
  await oldQuestions(c);
 }finally{
  window.v96QuestionSets=currentLoader||fullQuestionSets;
 }
 restoreFilters();
 bindFilterPersistence();
};
function bindFilterPersistence(){
 ['#qsearch','#qchapterFilter','#qtopicFilter','#qcloFilter','#qapprovalFilter','#qcreatorFilter'].forEach(sel=>{
  const el=$(sel);if(!el)return;
  el.addEventListener(el.tagName==='INPUT'?'input':'change',()=>{clearTimeout(draftTimer);draftTimer=setTimeout(persistFilters,80)});
 });
 $$('[data-bank-tab]').forEach(b=>b.addEventListener('click',()=>setTimeout(persistFilters,0)));
}

function readFormDraft(form){
 const data=Object.fromEntries(new FormData(form));
 return {...data,updated_at:Date.now()};
}
function saveVisibleQuestionDraft(){
 const form=$('#qForm');if(!form)return;
 const id=form.dataset.draftId||'new';jsonWrite(draftKey(id),readFormDraft(form));
}
function restoreQuestionDraft(form,id){
 const d=jsonRead(draftKey(id),null);if(!d)return false;
 const set=(name,value)=>{const el=form.elements.namedItem(name);if(!el||value==null)return;if(el instanceof RadioNodeList){[...form.querySelectorAll(`[name="${CSS.escape(name)}"]`)].forEach(r=>r.checked=r.value===value)}else el.value=value};
 if(d.chapter_id){set('chapter_id',d.chapter_id);$('#qchapter')?.dispatchEvent(new Event('change'))}
 ['content','topic_id','clo_id','correct_answer','approval_status','question_scope','origin_type','opt_A','opt_B','opt_C','opt_D','explanation'].forEach(n=>set(n,d[n]));
 return true;
}

const oldNavigate=window.navigate;
window.navigate=function(v){
 saveVisibleQuestionDraft();
 if(state.view==='questions')persistFilters();
 return oldNavigate(v);
};
const oldFillSubjectSelect=window.fillSubjectSelect;
window.fillSubjectSelect=function(){return oldFillSubjectSelect()};

const oldQuestionForm=window.v96QuestionForm;
window.v96QuestionForm=async function(x={},sets){
 x=x||{};
 if(x.id&&!Array.isArray(x.question_options)){
  try{x=await hydrateQuestion(x)}catch(ex){return err(ex)}
 }
 await oldQuestionForm(x,sets);
 const form=$('#qForm');if(!form)return;
 const id=x.id||'new';form.dataset.draftId=id;
 const restored=restoreQuestionDraft(form,id);
 if(restored)toast('Đã khôi phục nội dung đang soạn');
 const queue=()=>{clearTimeout(draftTimer);draftTimer=setTimeout(()=>jsonWrite(draftKey(id),readFormDraft(form)),120)};
 form.addEventListener('input',queue);form.addEventListener('change',queue);
 const originalSubmit=form.onsubmit;
 form.onsubmit=async e=>{
  jsonWrite(draftKey(id),readFormDraft(form));
  invalidateQuestionData(id==='new'?null:id);
  const originalRpc=db.rpc.bind(db),chapterId=form.elements.namedItem('chapter_id')?.value||x.chapter_id,topicId=form.elements.namedItem('topic_id')?.value||x.topic_id||null;
  db.rpc=(name,params)=>name==='find_similar_questions'?originalRpc('find_similar_questions_scoped',{p_subject_id:params.p_subject_id,p_chapter_id:chapterId,p_topic_id:topicId,p_content:params.p_content,p_exclude_id:params.p_exclude_id||null,p_limit:params.p_limit||3}):originalRpc(name,params);
  try{await originalSubmit(e)}finally{db.rpc=originalRpc}
  if(!document.body.contains(form))jsonDrop(draftKey(id));
 };
 const cancel=$('#cancelQuestionEdit');
 if(cancel){const old=cancel.onclick;cancel.onclick=async()=>{jsonDrop(draftKey(id));return old?.()}}
 const back=$('#questionBack');
 if(back){const old=back.onclick;back.onclick=async()=>{saveVisibleQuestionDraft();return old?.()}}
};

const oldQuestionDetail=window.v96QuestionDetail;
if(typeof oldQuestionDetail==='function')window.v96QuestionDetail=async function(x,sets){
 try{return oldQuestionDetail(await hydrateQuestion(x),sets)}catch(ex){err(ex)}
};
const oldQuestionAnalysis=window.v95QuestionAnalysis;
if(typeof oldQuestionAnalysis==='function')window.v95QuestionAnalysis=async function(x,...args){
 try{return oldQuestionAnalysis(await hydrateQuestion(x),...args)}catch(ex){err(ex)}
};

window.AICLO_QUESTION_STATE=Object.freeze({persistFilters,savedFilters,lightQuestionSets,hydrateQuestion,invalidate:invalidateQuestionData});
})();

/* V11 — keep the active Gemini review and show its nearest text matches. */
(() => {
'use strict';

const baseKey=()=>`ai-clo:v11:${state.user?.id||'user'}:${state.subjectId||'subject'}`;
const reviewKey=()=>`${baseKey()}:ai-review`;
const read=()=>{try{return JSON.parse(sessionStorage.getItem(reviewKey())||'null')}catch{return null}};
const write=value=>{try{sessionStorage.setItem(reviewKey(),JSON.stringify(value))}catch{}};
const clear=()=>{try{sessionStorage.removeItem(reviewKey())}catch{}};
let restoring=false,similarityRun=0,saveTimer=null;

function formValues(){
 if(!$('#draftContent'))return null;
 return {content:$('#draftContent').value,explanation:$('#draftExplanation')?.value||'',correct_answer:$('#draftCorrect')?.value||'A',options:Object.fromEntries(['A','B','C','D'].map(k=>[k,$('#draft'+k)?.value||'']))};
}
function remember(batch,d,pos){
 const old=read();
 write({batchId:batch.id,draftId:d.id,pos,subjectId:batch.subject_id,values:old?.draftId===d.id?(formValues()||old.values||null):null,updatedAt:Date.now()});
}
function saveVisibleReview(){
 const active=read(),values=formValues();
 if(active&&values)write({...active,values,updatedAt:Date.now()});
}
function restoreValues(active,d){
 if(!active?.values||active.draftId!==d.id)return;
 $('#draftContent').value=active.values.content??d.content??'';
 $('#draftExplanation').value=active.values.explanation??d.explanation??'';
 $('#draftCorrect').value=active.values.correct_answer||d.correct_answer||'A';
 ['A','B','C','D'].forEach(k=>{if($('#draft'+k))$('#draft'+k).value=active.values.options?.[k]??d.options?.[k]??''});
}
function scoreClass(score){return score>=.9?'danger':score>=.75?'warning':'neutral'}
function scopeLabel(scope){return window.AICLO_V105? (scope==='secure_exam'?'Đề thi - bảo mật':scope==='both'?'Cả hai ngân hàng':'Luyện tập - kiểm tra') : scope}
async function loadSimilar(content,batch,d){
 const box=$('#aiSimilarQuestions');if(!box)return;
 const run=++similarityRun;
 box.innerHTML='<p class="hint">Đang đối chiếu ngân hàng câu hỏi…</p>';
 const {data,error}=await db.rpc('find_similar_questions_scoped',{p_subject_id:state.subjectId,p_chapter_id:batch.chapter_id,p_topic_id:d.topic_id||batch.topic_id||null,p_content:String(content||'').trim(),p_exclude_id:null,p_limit:3});
 if(run!==similarityRun||!$('#aiSimilarQuestions'))return;
 if(error){box.innerHTML='<p class="hint">Chưa thể tải các câu tương tự.</p>';return}
 if(!data?.length){box.innerHTML='<p class="ai-similar-empty">Không phát hiện câu có độ giống văn bản từ 55% trở lên.</p>';return}
 box.innerHTML=data.map(item=>{const score=Number(item.similarity_score||0);return `<article class="ai-similar-item ${scoreClass(score)}"><div><button type="button" class="question-code" data-similar-code="${item.id}">${esc(item.code)}</button><span class="ai-similar-score">${Math.round(score*100)}%</span><span class="badge">${esc(scopeLabel(item.question_scope))}</span></div><p>${esc(item.content)}</p></article>`}).join('');
 renderMath(box);
}

const oldShowDraft=window.showDraft;
window.showDraft=function(batch,drafts,d,pos){
 saveVisibleReview();
 const previous=read();
 oldShowDraft(batch,drafts,d,pos);
 write({batchId:batch.id,draftId:d.id,pos,subjectId:batch.subject_id,values:previous?.draftId===d.id?previous.values:null,updatedAt:Date.now()});
 restoreValues(read(),d);
 const note=$('.review-wrap .ai-note');
 if(note){
  const section=document.createElement('section');section.className='ai-similar-panel';section.innerHTML=`<div class="ai-similar-head"><div><h4>3 câu gần giống nhất</h4><p>Phạm vi: cùng ${d.topic_id||batch.topic_id?'chủ đề':'chương'}. Chỉ số bên dưới là độ giống văn bản bằng pg_trgm.</p></div><span class="ai-similar-legend"><i></i> ≥90% · <i></i> 75–89% · <i></i> 45–74%</span></div><div id="aiSimilarQuestions"></div><div class="ai-math-check"><button type="button" id="checkMathSimilarity" class="ai-btn">✦ AI kiểm tra giống về toán học</button><span>Gemini phân tích dạng toán, cấu trúc dữ kiện và hướng giải; chỉ gọi khi bạn nhấn.</span></div><div id="aiMathSimilarity"></div>`;
  note.insertAdjacentElement('afterend',section);
 }
 loadSimilar($('#draftContent')?.value||d.content,batch,d);
 const queue=()=>{clearTimeout(saveTimer);saveTimer=setTimeout(()=>{saveVisibleReview();loadSimilar($('#draftContent')?.value||'',batch,d);if($('#aiMathSimilarity'))$('#aiMathSimilarity').innerHTML='<p class="hint">Nội dung đã thay đổi; hãy kiểm tra AI lại nếu cần.</p>'},350)};
 $('#draftContent')?.addEventListener('input',queue);
 ['#draftExplanation','#draftCorrect','#draftA','#draftB','#draftC','#draftD'].forEach(sel=>$(sel)?.addEventListener('input',()=>{clearTimeout(saveTimer);saveTimer=setTimeout(saveVisibleReview,120)}));
 const back=$('#questionBack');if(back){const fn=back.onclick;back.onclick=async()=>{clear();return fn?.()}}
 const approve=$('#approveDraft');if(approve?.onclick){const save=approve.onclick;approve.onclick=async event=>{const originalRpc=db.rpc.bind(db);db.rpc=(name,params)=>name==='find_similar_questions'?originalRpc('find_similar_questions_scoped',{p_subject_id:params.p_subject_id,p_chapter_id:batch.chapter_id,p_topic_id:d.topic_id||batch.topic_id||null,p_content:params.p_content,p_exclude_id:params.p_exclude_id||null,p_limit:params.p_limit||3}):originalRpc(name,params);try{return await save.call(approve,event)}finally{db.rpc=originalRpc}}}
 $('#checkMathSimilarity')?.addEventListener('click',async()=>{const button=$('#checkMathSimilarity'),box=$('#aiMathSimilarity');button.disabled=true;button.textContent='✦ Gemini đang phân tích…';box.innerHTML='<p class="hint">Đang so sánh bản chất toán học…</p>';try{const options=['A','B','C','D'].map(k=>`${k}. ${$('#draft'+k)?.value||''}`).join('\n'),{data,error}=await db.functions.invoke('analyze-question-similarity',{body:{subject_id:state.subjectId,chapter_id:batch.chapter_id,topic_id:d.topic_id||batch.topic_id||null,content:$('#draftContent')?.value||'',options,explanation:$('#draftExplanation')?.value||''}});if(error){let detail;try{detail=await error.context?.json()}catch{}throw new Error(detail?.error||error.message)}if(!data?.success)throw new Error(data?.error||'Không thể phân tích');box.innerHTML=data.matches?.length?data.matches.map(item=>`<article class="ai-similar-item math ${scoreClass(Number(item.score)/100)}"><div><b>${esc(item.code)}</b><span class="ai-similar-score">${item.score}% giống toán học</span>${item.only_surface_changed?'<span class="badge red">Chỉ thay dữ kiện bề mặt</span>':''}</div><p>${esc(item.content)}</p><small>${esc(item.reason)}</small></article>`).join(''):'<p class="ai-similar-empty">AI không phát hiện câu giống đáng kể về bản chất toán học.</p>';renderMath(box);button.textContent='✦ Kiểm tra lại bằng AI'}catch(ex){box.innerHTML=`<p class="hint">${esc(ex.message||'Không thể phân tích.')}</p>`;button.textContent='✦ Thử lại'}finally{button.disabled=false}});
};

const oldAdvanceReview=window.advanceReview;
window.advanceReview=async function(batch,drafts,pos){
 const hasPending=drafts.some(x=>x.review_status==='pending');
 if(!hasPending)clear();
 return oldAdvanceReview(batch,drafts,pos);
};

const oldNavigate=window.navigate;
window.navigate=function(v){saveVisibleReview();return oldNavigate(v)};

const oldQuestions=window.questions;
window.questions=async function(c){
 await oldQuestions(c);
 if(restoring)return;
 const active=read();if(!active||active.subjectId!==state.subjectId)return;
 restoring=true;
 try{
  const [batches,drafts]=await Promise.all([q('ai_generation_batches','*, chapters(name), clos(code,description)',x=>x.eq('id',active.batchId)),q('ai_question_drafts','*',x=>x.eq('batch_id',active.batchId).order('order_index'))]);
  const batch=batches[0],draft=drafts.find(x=>x.id===active.draftId)||drafts.find(x=>x.review_status==='pending');
  if(!batch||!draft){clear();return}
  window.showDraft(batch,drafts,draft,drafts.findIndex(x=>x.id===draft.id));
  toast('Đã khôi phục phiên duyệt câu Gemini');
 }catch(ex){console.warn('Restore Gemini review',ex)}finally{restoring=false}
};
window.AICLO_AI_REVIEW_STATE=Object.freeze({read,clear});
})();
