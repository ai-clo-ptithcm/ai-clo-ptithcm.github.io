/* AI-CLO PTITHCM V11.6.13 — in-page AI duplicate scan with full answers and edit-return state. */
(()=>{
'use strict';

const stateKey=()=>`ai-clo:v11612:${state.user?.id||'user'}:${state.subjectId||'subject'}:duplicate-scan`;
const returnKey=()=>`${stateKey()}:return`;
let backWrapped=false;

const read=(key,fallback=null)=>{try{return JSON.parse(sessionStorage.getItem(key)||'null')??fallback}catch{return fallback}};
const write=(key,value)=>{try{sessionStorage.setItem(key,JSON.stringify(value))}catch{}};
const drop=key=>{try{sessionStorage.removeItem(key)}catch{}};
const activeScope=()=>window.AICLO_V105?.activeBank?.()==='secure_exam'?'secure_exam':'practice';
const scopeLabel=scope=>scope==='secure_exam'?'🔒 Đề thi - bảo mật':'Luyện tập - kiểm tra';
const defaultState=()=>({subjectId:state.subjectId,scope:activeScope(),filters:{chapter:'all',topic:'all',clo:'all'},result:null,anchor:null,updatedAt:Date.now()});

function currentState(){
 const saved=read(stateKey(),null);
 if(!saved||saved.subjectId!==state.subjectId)return defaultState();
 return {...defaultState(),...saved,filters:{...defaultState().filters,...(saved.filters||{})}};
}
function saveState(value){write(stateKey(),{...value,subjectId:state.subjectId,updatedAt:Date.now()})}
function rememberWorkspace(){window.AICLO_QUESTION_WORKSPACE?.rememberDuplicate?.()}
function forgetWorkspace(){window.AICLO_QUESTION_WORKSPACE?.forgetDuplicate?.()}

function chapterOptions(ch,selected){return '<option value="all">Tất cả chương</option>'+ch.map(x=>`<option value="${esc(x.id)}" ${String(x.id)===String(selected)?'selected':''}>${x.order_index?`${esc(x.order_index)}. `:''}${esc(x.name)}</option>`).join('')}
function topicOptions(topics,chapter,selected){
 const list=chapter==='all'?topics:topics.filter(x=>String(x.chapter_id)===String(chapter));
 return '<option value="all">Tất cả chủ đề</option>'+list.map(x=>`<option value="${esc(x.id)}" ${String(x.id)===String(selected)?'selected':''}>${esc(x.name)}</option>`).join('');
}
function cloOptions(clos,selected){return '<option value="all">Tất cả CLO</option>'+clos.map(x=>`<option value="${esc(x.id)}" ${String(x.id)===String(selected)?'selected':''}>${esc(x.code)}</option>`).join('')}
function scoreClass(score){return score>=90?'danger':score>=75?'warning':'neutral'}
function labelById(list,id,key='name'){return list.find(x=>String(x.id)===String(id))?.[key]||'—'}
function questionMeta(q,sets){
 const chapter=labelById(sets.ch,q.chapter_id),topic=labelById(sets.topics,q.topic_id),clo=labelById(sets.clos,q.clo_id,'code');
 return `${esc(clo)} · ${esc(chapter)} · ${esc(topic)}`;
}
function optionMap(q){
 if(q?.options&&typeof q.options==='object'&&!Array.isArray(q.options))return q.options;
 if(Array.isArray(q?.question_options))return Object.fromEntries(q.question_options.map(o=>[String(o.option_key||'').toUpperCase(),String(o.content||'')]));
 return {};
}
function answerHtml(q){
 const options=optionMap(q),correct=String(q?.correct_answer||'').toUpperCase();
 const hasAny=['A','B','C','D'].some(k=>String(options[k]||'').trim());
 if(!hasAny)return '<div class="duplicate-answer-missing">Chưa có dữ liệu A–D trong kết quả cũ. Hãy chạy lại kiểm tra để hiển thị đáp án.</div>';
 return `<div class="duplicate-answer-list">${['A','B','C','D'].map(k=>`<div class="duplicate-answer-row ${correct===k?'correct':''}"><b>${k}.</b><span>${esc(options[k]||'—')}</span>${correct===k?'<i aria-label="Đáp án đúng">✓</i>':''}</div>`).join('')}</div><div class="duplicate-correct-answer"><span>Đáp án đúng</span><b>${esc(correct||'—')}</b></div>`;
}
function pairHtml(pair,index,sets){
 const stale=pair.needs_recheck?'<span class="badge red">Nội dung vừa cập nhật · cần kiểm tra lại</span>':'';
 const surface=pair.only_surface_changed?'<span class="badge red">Chỉ thay dữ kiện bề mặt</span>':'';
 const card=q=>`<article class="duplicate-question-card"><div class="duplicate-question-head"><div><b>${esc(q.code||'—')}</b><small>${questionMeta(q,sets)}</small></div><button type="button" class="secondary" data-edit-duplicate="${esc(q.id)}" data-pair-anchor="${esc(pair.pair_id)}">Sửa câu này</button></div><div class="duplicate-question-content">${esc(q.content||'')}</div>${answerHtml(q)}</article>`;
 return `<section id="dup-${esc(pair.pair_id)}" class="duplicate-pair ${scoreClass(Number(pair.score)||0)}"><div class="duplicate-pair-head"><div><b>Cặp ${index+1}</b><span class="duplicate-pair-score">${Math.round(Number(pair.score)||0)}% giống về nội dung</span>${surface}${stale}</div><p>${esc(pair.reason||'')}</p></div><div class="duplicate-pair-grid">${card(pair.a)}${card(pair.b)}</div></section>`;
}
function resultHtml(scan,sets){
 if(!scan)return '<div class="duplicate-scan-empty"><b>Chưa kiểm tra</b><p>Chọn phạm vi rồi nhấn “Bắt đầu kiểm tra bằng AI”.</p></div>';
 const mode=scan.analysis_mode==='ai'?'AI đã thẩm định':'Đang hiển thị kết quả tiền lọc vì AI chưa hoàn tất';
 const warn=scan.analysis_mode!=='ai'&&scan.ai_error?`<div class="duplicate-scan-warning">${esc(scan.ai_error)}</div>`:'';
 const truncated=scan.truncated?'<div class="duplicate-scan-warning">Phạm vi có nhiều câu; lần kiểm tra này lấy tối đa 250 câu mới cập nhật gần nhất.</div>':'';
 return `<div class="duplicate-scan-summary"><div><b>${scan.pairs?.length||0} cặp cần xem</b><span>${mode} · rà ${scan.question_count||0} câu · ${scan.reviewed_candidate_count||0} cặp ứng viên được AI xem</span></div>${scan.model?`<span class="badge">${esc(scan.model)}</span>`:''}</div>${warn}${truncated}<div class="duplicate-pair-list">${(scan.pairs||[]).map((p,i)=>pairHtml(p,i,sets)).join('')||'<div class="duplicate-scan-empty"><b>Không phát hiện cặp đáng ngờ</b><p>Không có cặp nào vượt ngưỡng kiểm tra trong phạm vi đã chọn.</p></div>'}</div>`;
}

function mapQuestionOptions(rows){return Object.fromEntries((rows||[]).map(o=>[String(o.option_key||'').toUpperCase(),String(o.content||'')]))}
async function reconcileEditedQuestion(ret,saved){
 if(!ret?.questionId||!saved?.result?.pairs?.length)return saved;
 try{
  const {data,error}=await db.from('questions').select('id,display_code,content,correct_answer,chapter_id,topic_id,clo_id,question_scope,updated_at,question_options(option_key,content)').eq('id',ret.questionId).single();
  if(error||!data)return saved;
  const changed=String(data.updated_at||'')!==String(ret.beforeUpdatedAt||'');
  if(!changed)return {...saved,anchor:ret.anchor||saved.anchor};
  const code=String(data.display_code||'').trim();
  const patch=q=>String(q.id)===String(data.id)?{...q,code:code?code.padStart(6,'0'):q.code,content:data.content,options:mapQuestionOptions(data.question_options),correct_answer:String(data.correct_answer||'').toUpperCase(),chapter_id:data.chapter_id,topic_id:data.topic_id,clo_id:data.clo_id,question_scope:data.question_scope,updated_at:data.updated_at}:q;
  const pairs=saved.result.pairs.map(pair=>{
   const touched=String(pair.a.id)===String(data.id)||String(pair.b.id)===String(data.id);
   return touched?{...pair,a:patch(pair.a),b:patch(pair.b),needs_recheck:true}:pair;
  });
  return {...saved,result:{...saved.result,pairs},anchor:ret.anchor||saved.anchor};
 }catch{return saved}
}

function installReturnWrapper(){
 if(backWrapped)return;
 const base=window.backToQuestionList;
 if(typeof base!=='function')return;
 const wrapped=async function(...args){
  const ret=read(returnKey(),null);
  if(ret?.subjectId===state.subjectId){
   drop(returnKey());
   let saved=currentState();
   saved=await reconcileEditedQuestion(ret,saved);
   saveState(saved);
   await openDuplicateScan({restore:true,anchor:ret.anchor});
   return;
  }
  return base.apply(this,args);
 };
 wrapped.__aicloDuplicateReturn=true;
 wrapped.__aicloBaseBack=base;
 window.backToQuestionList=wrapped;
 backWrapped=true;
}

async function editQuestion(questionId,pairId,sets){
 const item=sets.items.find(x=>String(x.id)===String(questionId));
 if(!item)return toast('Không tìm thấy câu hỏi cần sửa.',true);
 const latest=(currentState().result?.pairs||[]).flatMap(p=>[p.a,p.b]).find(q=>String(q.id)===String(questionId));
 write(returnKey(),{subjectId:state.subjectId,questionId,pairId,anchor:pairId,beforeUpdatedAt:latest?.updated_at||null,updatedAt:Date.now()});
 const saved=currentState();saveState({...saved,anchor:pairId});
 await window.v96QuestionForm(item,sets);
}

async function runScan(sets){
 const button=$('#startDuplicateAiScan'),status=$('#duplicateScanStatus');
 if(!button)return;
 const filters={chapter:$('#dupChapter')?.value||'all',topic:$('#dupTopic')?.value||'all',clo:$('#dupClo')?.value||'all'};
 let saved=currentState();saved={...saved,scope:activeScope(),filters,result:null,anchor:null};saveState(saved);
 button.disabled=true;button.textContent='✦ AI đang kiểm tra…';
 if(status)status.textContent='Đang tiền lọc các cặp và gửi ứng viên phù hợp cho AI…';
 try{
  const {data,error}=await db.functions.invoke('scan-question-duplicates',{body:{subject_id:state.subjectId,question_scope:saved.scope,chapter_id:filters.chapter,topic_id:filters.topic,clo_id:filters.clo}});
  if(error){let detail;try{detail=await error.context?.json()}catch{}throw new Error(detail?.error||error.message)}
  if(!data?.success)throw new Error(data?.error||'Không thể kiểm tra câu trùng.');
  saved={...saved,result:data,anchor:null};saveState(saved);
  $('#duplicateScanResults').innerHTML=resultHtml(data,sets);bindResultActions(sets);
  renderMath($('#duplicateScanResults'));
  if(status)status.textContent=`Hoàn tất · ${data.pairs?.length||0} cặp cần xem`;
  toast('Đã hoàn tất kiểm tra trùng bằng AI');
 }catch(error){
  if(status)status.textContent='Kiểm tra chưa hoàn tất';
  $('#duplicateScanResults').innerHTML=`<div class="duplicate-scan-empty error"><b>Không thể kiểm tra</b><p>${esc(error?.message||'Có lỗi xảy ra.')}</p><small>Nếu đây là lần đầu dùng chức năng này, hãy deploy Edge Function scan-question-duplicates trên Supabase.</small></div>`;
 }finally{button.disabled=false;button.textContent='✦ Bắt đầu kiểm tra bằng AI'}
}

function bindResultActions(sets){
 const box=$('#duplicateScanResults');if(!box)return;
 box.onclick=event=>{
  const button=event.target.closest?.('[data-edit-duplicate]');
  if(button)editQuestion(button.dataset.editDuplicate,button.dataset.pairAnchor,sets);
 };
}

async function openDuplicateScan(options={}){
 installReturnWrapper();
 let sets;
 try{sets=await v96QuestionSets()}catch(error){return err(error)}
 let saved=currentState();
 if(!options.restore&&saved.scope!==activeScope())saved=defaultState();
 saved.scope=activeScope();
 if(options.anchor)saved.anchor=options.anchor;
 saveState(saved);
 rememberWorkspace();
 const filters=saved.filters||defaultState().filters;
 questionWorkspace('Kiểm tra câu hỏi trùng','Lọc phạm vi, dùng AI thẩm định từng cặp và chỉnh sửa trực tiếp câu cần xử lý.',`<div class="duplicate-scan-page"><div class="duplicate-scan-scope"><b>${esc(scopeLabel(saved.scope))}</b><span>Chỉ kiểm tra câu thuộc ngân hàng đang mở; câu lưu “Cả hai” cũng được tính.</span></div><div class="duplicate-scan-filter-row"><label class="field"><span>Chương</span><select id="dupChapter">${chapterOptions(sets.ch,filters.chapter)}</select></label><label class="field"><span>Chủ đề</span><select id="dupTopic">${topicOptions(sets.topics,filters.chapter,filters.topic)}</select></label><label class="field"><span>CLO</span><select id="dupClo">${cloOptions(sets.clos,filters.clo)}</select></label><button type="button" class="ai-btn" id="startDuplicateAiScan">✦ Bắt đầu kiểm tra bằng AI</button></div><div id="duplicateScanStatus" class="duplicate-scan-status">${saved.result?`Kết quả gần nhất · ${saved.result.pairs?.length||0} cặp cần xem`:'Chưa chạy kiểm tra.'}</div><div id="duplicateScanResults">${resultHtml(saved.result,sets)}</div></div>`);

 const back=$('#questionBack');if(back){const base=back.onclick;back.onclick=async()=>{forgetWorkspace();return base?.()}}
 const chapter=$('#dupChapter'),topic=$('#dupTopic'),clo=$('#dupClo');
 const persist=()=>{const now=currentState();saveState({...now,filters:{chapter:chapter?.value||'all',topic:topic?.value||'all',clo:clo?.value||'all'},result:null,anchor:null});if($('#duplicateScanResults'))$('#duplicateScanResults').innerHTML=resultHtml(null,sets);if($('#duplicateScanStatus'))$('#duplicateScanStatus').textContent='Bộ lọc đã thay đổi · hãy chạy kiểm tra lại.'};
 chapter?.addEventListener('change',()=>{if(topic){topic.innerHTML=topicOptions(sets.topics,chapter.value,'all');topic.value='all'}persist()});
 topic?.addEventListener('change',persist);clo?.addEventListener('change',persist);
 $('#startDuplicateAiScan')?.addEventListener('click',()=>runScan(sets));
 bindResultActions(sets);
 renderMath($('#duplicateScanResults'));
 const anchor=options.anchor||saved.anchor;
 if(anchor)requestAnimationFrame(()=>document.getElementById(`dup-${CSS.escape(String(anchor))}`)?.scrollIntoView({block:'center',behavior:'auto'}));
}

window.AICLO_DUPLICATE_SCAN=Object.freeze({open:openDuplicateScan,restore:()=>openDuplicateScan({restore:true}),clear:()=>{drop(stateKey());drop(returnKey());forgetWorkspace()}});
})();
