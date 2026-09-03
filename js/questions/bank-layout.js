/* AI-CLO PTITHCM V11.6.4 — compact question-bank actions and filter drawers. */
(()=>{
'use strict';

let enhanceQueued=false;
const FILTER_IDS=['qchapterFilter','qtopicFilter','qcloFilter','qapprovalFilter','qcreatorFilter'];
const filterLabels={qchapterFilter:'Chương',qtopicFilter:'Chủ đề',qcloFilter:'CLO',qapprovalFilter:'Trạng thái duyệt',qcreatorFilter:'Người nhập'};

function isBankView(){return !!document.querySelector('.v105-bank-tabs')&&!!document.querySelector('#qsearch')&&!!document.querySelector('.bank-actions')}
function activeFilterCount(){return FILTER_IDS.reduce((n,id)=>n+(document.getElementById(id)?.value&&document.getElementById(id).value!=='all'?1:0),0)}
function updateFilterButton(){
 const btn=document.querySelector('#questionFilterButton');if(!btn)return;
 const count=activeFilterCount();
 btn.innerHTML=`<span>☷</span> Lọc${count?` <b>${count}</b>`:''}`;
 btn.classList.toggle('active',count>0);
 btn.title=count?`Đang áp dụng ${count} bộ lọc`:'Lọc danh sách câu hỏi';
}

function compactMainActions(){
 const old=document.querySelector('.bank-actions'),note=document.querySelector('.v105-bank-note');
 if(!old||!note)return;
 let bar=document.querySelector('#questionPrimaryActions');
 if(!bar){bar=document.createElement('div');bar.id='questionPrimaryActions';bar.className='qbank-primary-actions';note.insertAdjacentElement('afterend',bar)}
 const generate=document.querySelector('#generateAI'),add=document.querySelector('#addQ'),history=document.querySelector('#aiHistory');
 if(generate){generate.textContent='✦ Tạo bằng AI';generate.title='Tạo câu hỏi với trợ lý AI';bar.appendChild(generate)}
 if(add){add.textContent='+ Tạo câu hỏi';bar.appendChild(add)}
 if(history){bar.appendChild(history)}
 let more=document.querySelector('#questionFunctionsButton');
 if(!more){
  more=document.createElement('button');more.id='questionFunctionsButton';more.type='button';more.className='secondary qbank-functions-button';more.innerHTML='☰ Chức năng';
  more.addEventListener('click',openFunctionsPanel);
 }
 bar.appendChild(more);
 old.classList.add('qbank-legacy-actions');
}

function compactSearchAndFilters(){
 const tools=document.querySelector('.v105-question-tools'),search=document.querySelector('#qsearch'),oldActions=document.querySelector('.bank-actions');
 if(!tools||!search||!oldActions)return;
 let row=document.querySelector('#questionSearchRow');
 if(!row){
  row=document.createElement('div');row.id='questionSearchRow';row.className='qbank-search-row';
  oldActions.insertAdjacentElement('beforebegin',row);
 }
 row.appendChild(search);
 let filterBtn=document.querySelector('#questionFilterButton');
 if(!filterBtn){
  filterBtn=document.createElement('button');filterBtn.id='questionFilterButton';filterBtn.type='button';filterBtn.className='secondary qbank-filter-button';filterBtn.addEventListener('click',openFilterPanel);
 }
 row.appendChild(filterBtn);
 tools.classList.add('qbank-hidden-filter-source');
 let countRow=document.querySelector('#questionCountRow');
 if(!countRow){countRow=document.createElement('div');countRow.id='questionCountRow';countRow.className='qbank-count-row';row.insertAdjacentElement('afterend',countRow)}
 const count=document.querySelector('#questionCount');if(count)countRow.appendChild(count);
 updateFilterButton();
}

function cloneSelectHtml(sourceId,panelId){
 const src=document.getElementById(sourceId);if(!src)return '';
 return `<label class="field qbank-filter-field"><span>${filterLabels[sourceId]||''}</span><select id="${panelId}">${src.innerHTML}</select></label>`;
}
function setPanelValue(panelId,sourceId){
 const panel=document.getElementById(panelId),src=document.getElementById(sourceId);if(!panel||!src)return;
 if([...panel.options].some(o=>o.value===src.value))panel.value=src.value;
}
function refreshPanelTopics(){
 const chapter=document.querySelector('#panelChapterFilter'),topic=document.querySelector('#panelTopicFilter'),sourceTopic=document.querySelector('#qtopicFilter');
 if(!chapter||!topic||!sourceTopic)return;
 const sourceChapter=document.querySelector('#qchapterFilter');
 const previous=sourceChapter?.value;
 if(sourceChapter){sourceChapter.value=chapter.value;sourceChapter.dispatchEvent(new Event('change'))}
 topic.innerHTML=sourceTopic.innerHTML;
 const wanted=sourceTopic.value;
 if([...topic.options].some(o=>o.value===wanted))topic.value=wanted;
 if(sourceChapter&&previous!==undefined){sourceChapter.value=previous;sourceChapter.dispatchEvent(new Event('change'))}
}

function openFilterPanel(){
 if(!isBankView())return;
 const body=`<div class="qbank-filter-panel">
  <div class="qbank-filter-intro"><b>Lọc ngân hàng câu hỏi</b><span>Chỉ hiển thị các câu phù hợp. Bộ lọc được giữ khi bạn mở chi tiết rồi quay lại.</span></div>
  <div class="qbank-filter-grid">
   ${cloneSelectHtml('qchapterFilter','panelChapterFilter')}
   ${cloneSelectHtml('qtopicFilter','panelTopicFilter')}
   ${cloneSelectHtml('qcloFilter','panelCloFilter')}
   ${cloneSelectHtml('qapprovalFilter','panelApprovalFilter')}
   ${cloneSelectHtml('qcreatorFilter','panelCreatorFilter')}
  </div>
  <div class="qbank-filter-actions"><button id="clearQuestionFilters" class="secondary" type="button">Xóa bộ lọc</button><button id="applyQuestionFilters" class="primary" type="button">Áp dụng</button></div>
 </div>`;
 openDrawer('Bộ lọc câu hỏi',body,()=>{
  setPanelValue('panelChapterFilter','qchapterFilter');setPanelValue('panelTopicFilter','qtopicFilter');setPanelValue('panelCloFilter','qcloFilter');setPanelValue('panelApprovalFilter','qapprovalFilter');setPanelValue('panelCreatorFilter','qcreatorFilter');
  document.querySelector('#panelChapterFilter')?.addEventListener('change',()=>{
   const chapter=document.querySelector('#panelChapterFilter'),topic=document.querySelector('#panelTopicFilter'),sourceChapter=document.querySelector('#qchapterFilter'),sourceTopic=document.querySelector('#qtopicFilter');
   if(!chapter||!topic||!sourceChapter||!sourceTopic)return;
   const oldChapter=sourceChapter.value,oldTopic=sourceTopic.value;
   sourceChapter.value=chapter.value;sourceChapter.dispatchEvent(new Event('change'));
   topic.innerHTML=sourceTopic.innerHTML;topic.value='all';
   sourceChapter.value=oldChapter;sourceChapter.dispatchEvent(new Event('change'));
   if([...sourceTopic.options].some(o=>o.value===oldTopic))sourceTopic.value=oldTopic;
  });
  document.querySelector('#clearQuestionFilters')?.addEventListener('click',()=>{
   ['panelChapterFilter','panelTopicFilter','panelCloFilter','panelApprovalFilter','panelCreatorFilter'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='all'});
  });
  document.querySelector('#applyQuestionFilters')?.addEventListener('click',()=>{
   const chapter=document.querySelector('#qchapterFilter'),topic=document.querySelector('#qtopicFilter');
   if(chapter){chapter.value=document.querySelector('#panelChapterFilter')?.value||'all';chapter.dispatchEvent(new Event('change'))}
   if(topic){const v=document.querySelector('#panelTopicFilter')?.value||'all';if([...topic.options].some(o=>o.value===v))topic.value=v;else topic.value='all';topic.dispatchEvent(new Event('change'))}
   [['qcloFilter','panelCloFilter'],['qapprovalFilter','panelApprovalFilter'],['qcreatorFilter','panelCreatorFilter']].forEach(([source,panel])=>{const el=document.getElementById(source);if(!el)return;el.value=document.getElementById(panel)?.value||'all';el.dispatchEvent(new Event('change'))});
   window.captureQuestionFilters?.();updateFilterButton();window.closeDrawer?.();
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
 FILTER_IDS.forEach(id=>{const el=document.getElementById(id);if(!el||el.dataset.aicloFilterState==='1')return;el.dataset.aicloFilterState='1';el.addEventListener('change',()=>requestAnimationFrame(updateFilterButton))});
}

function enhance(){
 if(!isBankView())return;
 compactMainActions();compactSearchAndFilters();bindFilterState();updateFilterButton();
}
function queueEnhance(){if(enhanceQueued)return;enhanceQueued=true;requestAnimationFrame(()=>{enhanceQueued=false;enhance()})}

document.addEventListener('DOMContentLoaded',()=>{
 enhance();const host=document.querySelector('#content');if(!host)return;new MutationObserver(queueEnhance).observe(host,{childList:true,subtree:true});
});
})();
