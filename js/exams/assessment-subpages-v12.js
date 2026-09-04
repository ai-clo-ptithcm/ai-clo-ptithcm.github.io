/* AI-CLO PTITHCM V12.0.5 — lightweight Assessment subpage consistency.
   No continuous MutationObserver, no background database polling. */
(()=>{
'use strict';
const VERSION='12.0.5';
const $=s=>document.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];

function normalizeLegacyText(root=document){
 const nodes=[root.querySelector?.('#pageTitle'),root.querySelector?.('#pageSub'),root.querySelector?.('.ub-top h3')].filter(Boolean);
 nodes.forEach(n=>{n.textContent=String(n.textContent||'').replace(/bài đánh giá CLO/ig,'bài kiểm tra').replace(/bài ôn tập thi/ig,'bài kiểm tra')});
 $$('.ub-type-badge,.ub-badges .badge',root).forEach(b=>{
  if(/Bài đánh giá CLO|Bài ôn tập thi/i.test(b.textContent||''))b.textContent='Bài kiểm tra';
 });
}

function normalizeBuilderInfo(){
 const input=$('#ubInfoForm [name="total_questions"]');
 if(input){
  input.readOnly=true;
  input.setAttribute('aria-readonly','true');
  const label=input.closest('label');
  if(label&&!label.dataset.v12Total){
   label.dataset.v12Total='1';
   const text=[...label.childNodes].find(n=>n.nodeType===Node.TEXT_NODE&&String(n.textContent||'').trim());
   if(text)text.textContent='Tổng số câu (tự tính từ ma trận)';
   const note=document.createElement('small');note.className='hint';note.textContent='Không chỉnh độc lập. Tổng số câu được xác định bởi ma trận.';label.appendChild(note);
  }
 }
 const ai=$('#ubInfoForm [name="allow_ai_feedback"]')?.closest('.aiclo-switch-row')?.querySelector('span:first-child');
 if(ai)ai.textContent='Cho phép sinh viên nhận xét AI';
}

function normalizeDetail(){
 const page=$('.assessment-detail-page');if(!page)return;
 normalizeLegacyText(page);
 const source=page.querySelector('.assessment-v12-detail-source');
 if(!source){
  const head=page.querySelector('.assessment-detail-head');
  if(head){const badge=document.createElement('span');badge.className='badge assessment-v12-detail-source';badge.textContent='Ngân hàng luyện tập – kiểm tra';head.appendChild(badge)}
 }
}

function normalizeFinalTab(){
 const section=$('.v102-final-list');if(!section)return;
 const head=section.querySelector('.panel-head'),button=$('#createFinalExam');
 if(button&&head&&button.parentElement!==head)head.appendChild(button);
 if(button){button.hidden=false;button.style.display='';button.removeAttribute('aria-hidden');button.tabIndex=0;button.textContent='+ Tạo bài thi cuối kỳ';button.className='ai-btn'}
 const hint=head?.querySelector('.hint');if(hint)hint.textContent='Ngân hàng đề thi – bảo mật · BM06 · BM07 · BM08 · đáp án CLO';
 $$('[data-open-final]',section).forEach(b=>{b.textContent='Chi tiết →'});
}

function enhanceNow(){
 normalizeLegacyText(document);normalizeBuilderInfo();normalizeDetail();normalizeFinalTab();
}
function enhanceSoon(){requestAnimationFrame(()=>requestAnimationFrame(enhanceNow));setTimeout(enhanceNow,120)}

function interceptFinalCreate(e){
 const b=e.target?.closest?.('#createFinalExam');if(!b)return;
 e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();
 try{sessionStorage.setItem(`aiclo:v109:assessment:${state.subjectId}`,'final')}catch{}
 const start=window.AICLO_CREATE_WIZARD?.start;
 if(typeof start==='function')start('final');else window.toast?.('Chưa tải được trình tạo đề thi cuối kỳ. Vui lòng thử lại.',true);
}

function clickHooks(e){
 if(e.target?.closest?.('#ubEditInfo,#detailStructure,[data-open-final],[data-attempts],.exam-title-link,[data-assessment-tab]'))enhanceSoon();
}

function init(){
 document.addEventListener('click',interceptFinalCreate,true);
 document.addEventListener('click',clickHooks,true);
 document.addEventListener('focusin',e=>{if(e.target?.closest?.('#ubInfoForm'))normalizeBuilderInfo()},true);
 window.addEventListener('pageshow',enhanceSoon);
 enhanceSoon();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
window.AICLO_ASSESSMENT_SUBPAGES_V12=Object.freeze({version:VERSION,enhance:enhanceNow});
})();