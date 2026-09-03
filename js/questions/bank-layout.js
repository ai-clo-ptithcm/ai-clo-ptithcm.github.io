/* AI-CLO PTITHCM V11.6.5 — stable compact question-bank actions and isolated filter drawer. */
(()=>{
'use strict';

let enhanceQueued=false;
const FILTER_IDS=['qchapterFilter','qtopicFilter','qcloFilter','qapprovalFilter','qcreatorFilter'];
const filterLabels={qchapterFilter:'Chương',qtopicFilter:'Chủ đề',qcloFilter:'CLO',qapprovalFilter:'Trạng thái duyệt',qcreatorFilter:'Người nhập'};

function isBankView(){return !!document.querySelector('.v105-bank-tabs')&&!!document.querySelector('#qsearch')&&!!document.querySelector('.bank-actions')}
function activeFilterCount(){return FILTER_IDS.reduce((n,id)=>n+(document.getElementById(id)?.value&&document.getElementById(id).value!=='all'?1:0),0)}
function moveIfNeeded(el,parent){if(el&&parent&&el.parentElement!==parent)parent.appendChild(el)}
function setTextIfNeeded(el,text){if(el&&el.textContent!==text)el.textContent=text}

function updateFilterButton(){
 const btn=document.querySelector('#questionFilterButton');if(!btn)return;
 const count=activeFilterCount(),key=String(count);
 if(btn.dataset.filterCount!==key){
  btn.dataset.filterCount=key;
  btn.innerHTML=`<span>☷</span> Lọc${count?` <b>${count}</b>`:''}`;
 }
 if(btn.classList.contains('active')!==(count>0))btn.classList.toggle('active',count>0);
 btn.title=count?`Đang áp dụng ${count} bộ lọc`:'Lọc danh sách câu hỏi';
}

function compactMainActions(){
 const old=document.querySelector('.bank-actions'),note=document.querySelector('.v105-bank-note');
 if(!old||!note)return;
 let bar=document.querySelector('#questionPrimaryActions');
 if(!bar){
  bar=document.createElement('div');
  bar.id='questionPrimaryActions';
  bar.className='qbank-primary-actions';
  note.insertAdjacentElement('afterend',bar);
 }
 const generate=document.querySelector('#generateAI'),add=document.querySelector('#addQ'),history=document.querySelector('#aiHistory');
 if(generate){setTextIfNeeded(generate,'✦ Tạo bằng AI');generate.title='Tạo câu hỏi với trợ lý AI';moveIfNeeded(generate,bar)}
 if(add){setTextIfNeeded(add,'+ Tạo câu hỏi');moveIfNeeded(add,bar)}
 if(history)moveIfNeeded(history,bar);
 let more=document.querySelector('#questionFunctionsButton');
 if(!more){
  more=document.createElement('button');
  more.id='questionFunctionsButton';
  more.type='button';
  more.className='secondary qbank-functions-button';
  more.innerHTML='☰ Chức năng';
  more.addEventListener('click',openFunctionsPanel);
 }
 moveIfNeeded(more,bar);
 if(!old.classList.contains('qbank-legacy-actions'))old.classList.add('qbank-legacy-actions');
}

function compactSearchAndFilters(){
 const tools=document.querySelector('.v105-question-tools'),search=document.querySelector('#qsearch'),oldActions=document.querySelector('.bank-actions');
 if(!tools||!search||!oldActions)return;
 let row=document.querySelector('#questionSearchRow');
 if(!row){
  row=document.createElement('div');
  row.id='questionSearchRow';
  row.className='qbank-search-row';
  oldActions.insertAdjacentElement('beforebegin',row);
 }
 moveIfNeeded(search,row);
 let filterBtn=document.querySelector('#questionFilterButton');
 if(!filterBtn){
  filterBtn=document.createElement('button');
  filterBtn.id='questionFilterButton';
  filterBtn.type='button';
  filterBtn.className='secondary qbank-filter-button';
  filterBtn.addEventListener('click',openFilterPanel);
 }
 moveIfNeeded(filterBtn,row);
 if(!tools.classList.contains('qbank-hidden-filter-source'))tools.classList.add('qbank-hidden-filter-source');
 let countRow=document.querySelector('#questionCountRow');
 if(!countRow){
  countRow=document.createElement('div');
  countRow.id='questionCountRow';
  countRow.className='qbank-count-row';
  row.insertAdjacentElement('afterend',countRow);
 }
 const count=document.querySelector('#questionCount');
 moveIfNeeded(count,countRow);
 updateFilterButton();
}

function cloneSelectHtml(sourceId,panelId){
 const src=document.getElementById(sourceId);if(!src)return '';
 return `<label class="field qbank-filter-field"><span>${filterLabels[sourceId]||''}</span><select id="${panelId}">${src.innerHTML}</select></label>`;
}
function topicOptions(topics,chapterId,selected='all'){
 const allowed=chapterId==='all'?topics:topics.filter(t=>String(t.chapter_id)===String(chapterId));
 return '<option value="all">Tất cả chủ đề</option>'+allowed.map(t=>`<option value="${esc(t.id)}" ${String(t.id)===String(selected)?'selected':''}>${esc(t.name)}</option>`).join('');
}
function setPanelValue(panelId,sourceId){
 const panel=document.getElementById(panelId),src=document.getElementById(sourceId);if(!panel||!src)return;
 if([...panel.options].some(o=>o.value===src.value))panel.value=src.value;
}

async function openFilterPanel(){
 if(!isBankView())return;
 let sets={topics:[]};
 try{if(typeof v96QuestionSets==='function')sets=await v96QuestionSets()}catch(ex){console.warn('Không tải được dữ liệu chủ đề cho bộ lọc',ex)}
 const topics=sets?.topics||[];
 const sourceChapter=document.querySelector('#qchapterFilter'),sourceTopic=document.querySelector('#qtopicFilter');
 const chapterValue=sourceChapter?.value||'all',topicValue=sourceTopic?.value||'all';
 const body=`<div class="qbank-filter-panel">
  <div class="qbank-filter-intro"><b>Lọc ngân hàng câu hỏi</b><span>Chỉ hiển thị các câu phù hợp. Bộ lọc được giữ khi bạn mở chi tiết rồi quay lại.</span></div>
  <div class="qbank-filter-grid">
   ${cloneSelectHtml('qchapterFilter','panelChapterFilter')}
   <label class="field qbank-filter-field"><span>Chủ đề</span><select id="panelTopicFilter">${topicOptions(topics,chapterValue,topicValue)}</select></label>
   ${cloneSelectHtml('qcloFilter','panelCloFilter')}
   ${cloneSelectHtml('qapprovalFilter','panelApprovalFilter')}
   ${cloneSelectHtml('qcreatorFilter','panelCreatorFilter')}
  </div>
  <div class="qbank-filter-actions"><button id="clearQuestionFilters" class="secondary" type="button">Xóa bộ lọc</button><button id="applyQuestionFilters" class="primary" type="button">Áp dụng</button></div>
 </div>`;
 openDrawer('Bộ lọc câu hỏi',body,()=>{
  setPanelValue('panelChapterFilter','qchapterFilter');
  setPanelValue('panelCloFilter','qcloFilter');
  setPanelValue('panelApprovalFilter','qapprovalFilter');
  setPanelValue('panelCreatorFilter','qcreatorFilter');
  const panelChapter=document.querySelector('#panelChapterFilter'),panelTopic=document.querySelector('#panelTopicFilter');
  if(panelTopic&&[...panelTopic.options].some(o=>o.value===topicValue))panelTopic.value=topicValue;
  panelChapter?.addEventListener('change',()=>{
   if(!panelTopic)return;
   panelTopic.innerHTML=topicOptions(topics,panelChapter.value,'all');
   panelTopic.value='all';
  });
  document.querySelector('#clearQuestionFilters')?.addEventListener('click',()=>{
   ['panelChapterFilter','panelCloFilter','panelApprovalFilter','panelCreatorFilter'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='all'});
   if(panelTopic){panelTopic.innerHTML=topicOptions(topics,'all','all');panelTopic.value='all'}
  });
  document.querySelector('#applyQuestionFilters')?.addEventListener('click',()=>{
   const chapter=document.querySelector('#qchapterFilter'),topic=document.querySelector('#qtopicFilter');
   const nextChapter=panelChapter?.value||'all',nextTopic=panelTopic?.value||'all';
   if(chapter){
    chapter.value=nextChapter;
    chapter.dispatchEvent(new Event('change'));
   }
   if(topic){
    topic.value=[...topic.options].some(o=>o.value===nextTopic)?nextTopic:'all';
    topic.dispatchEvent(new Event('change'));
   }
   [['qcloFilter','panelCloFilter'],['qapprovalFilter','panelApprovalFilter'],['qcreatorFilter','panelCreatorFilter']].forEach(([source,panel])=>{
    const el=document.getElementById(source),panelEl=document.getElementById(panel);if(!el||!panelEl)return;
    el.value=panelEl.value||'all';
    el.dispatchEvent(new Event('change'));
   });
   window.captureQuestionFilters?.();
   updateFilterButton();
   window.closeDrawer?.();
  });
 },{eyebrow:'NGÂN HÀNG CÂU HỎI'});
}

function functionCard(id,icon,title,desc){return `<button id="${id}" class="qbank-function-card" type="button"><span class="qbank-function-icon">${icon}</span><span><b>${title}</b><small>${desc}</small></span><i>→</i></button>`}
function openFunctionsPanel(){
 const body=`<div class="qbank-functions-panel">
  <div class="qbank-filter-intro"><b>Chức năng ngân hàng</b><span>Các tiện ích quản lý và kiểm tra ngân hàng câu hỏi được gom tại đây.</span></div>
  <div class="qbank-function-list">
   ${functionCard('panelQuestionMatrix','▦','Ma trận câu hỏi','Xem số lượng câu theo Chương · Mục và CLO.')}
   ${functionCard('panelQuestionDuplicates','⧉','Kiểm tra trùng','Tìm các câu có nội dung tương đồng trong học phần.')}
  </div>
  <p class="qbank-functions-future">Các chức năng mới sẽ tiếp tục được bổ sung tại panel này.</p>
 </div>`;
 openDrawer('Chức năng',body,()=>{
  document.querySelector('#panelQuestionMatrix')?.addEventListener('click',()=>window.AICLO_OPEN_QUESTION_BANK_MATRIX?.());
  document.querySelector('#panelQuestionDuplicates')?.addEventListener('click',()=>document.querySelector('#scanDuplicates')?.click());
 },{eyebrow:'NGÂN HÀNG CÂU HỎI'});
}

function bindFilterState(){
 FILTER_IDS.forEach(id=>{
  const el=document.getElementById(id);if(!el||el.dataset.aicloFilterState==='1')return;
  el.dataset.aicloFilterState='1';
  el.addEventListener('change',()=>requestAnimationFrame(updateFilterButton));
 });
}

function enhance(){
 if(!isBankView())return;
 compactMainActions();
 compactSearchAndFilters();
 bindFilterState();
 updateFilterButton();
}
function queueEnhance(){
 if(enhanceQueued)return;
 enhanceQueued=true;
 requestAnimationFrame(()=>{enhanceQueued=false;enhance()});
}

document.addEventListener('DOMContentLoaded',()=>{
 enhance();
 const host=document.querySelector('#content');if(!host)return;
 new MutationObserver(queueEnhance).observe(host,{childList:true,subtree:true});
});
})();
