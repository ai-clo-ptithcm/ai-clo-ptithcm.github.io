/* AI-CLO PTITHCM V12.0.7 — lightweight Assessment subpage consistency.
   No continuous MutationObserver, no background database polling. */
(()=>{
'use strict';
const VERSION='12.0.7';
const $=s=>document.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];

function normalizeLegacyText(root=document){
 const nodes=[root.querySelector?.('#pageTitle'),root.querySelector?.('#pageSub'),root.querySelector?.('.ub-top h3')].filter(Boolean);
 nodes.forEach(n=>{n.textContent=String(n.textContent||'').replace(/bài đánh giá CLO/ig,'bài kiểm tra').replace(/bài ôn tập thi/ig,'bài kiểm tra')});
 $$('.ub-type-badge,.ub-badges .badge',root).forEach(b=>{
  if(/Bài đánh giá CLO|Bài ôn tập thi/i.test(b.textContent||''))b.textContent='Bài kiểm tra';
 });
}
function activeExamId(){
 try{
  const direct=sessionStorage.getItem(`aiclo:v115:active-exam:${state.subjectId}`);if(direct)return direct;
  const user=state?.user?.id||'user',raw=localStorage.getItem(`aiclo:v118:active:${user}:${state.subjectId}`),meta=JSON.parse(raw||'null');
  return meta?.examId||null;
 }catch{return null}
}

async function ensureGradeSwitch(){
 const form=$('#ubInfoForm');if(!form)return;
 form.classList.add('assessment-window-form');
 const existing=$$('[data-v12-grade-switch]',form);
 if(existing.length){existing.slice(1).forEach(x=>x.remove());return}
 if(form.dataset.v12GradeLoading==='1')return;
 const examId=activeExamId();if(!examId)return;
 form.dataset.v12GradeLoading='1';
 let r;
 try{r=await db.from('exams').select('id,exam_type,counts_toward_grade,allow_ai_feedback').eq('id',examId).maybeSingle()}
 finally{delete form.dataset.v12GradeLoading}
 if(r?.error||!r?.data||r.data.exam_type==='final_exam'||!document.body.contains(form))return;
 if(form.querySelector('[data-v12-grade-switch]'))return;
 const row=document.createElement('label');row.className='aiclo-switch-row assessment-v12-grade-switch';row.dataset.v12GradeSwitch='1';
 row.innerHTML=`<span>Tính vào kết quả CLO học phần</span><span class="aiclo-switch"><input type="checkbox" ${r.data.counts_toward_grade!==false?'checked':''}><i></i></span>`;
 const grid=form.querySelector('.clo-switch-grid');
 if(grid)grid.appendChild(row);else form.querySelector('.form-actions')?.before(row);
 const input=row.querySelector('input');
 input.onchange=()=>{
  if(!input.checked){const ai=form.querySelector('[name="allow_ai_feedback"]');if(ai)ai.checked=false}
 };
 if(form.dataset.v12GradeSubmitBound!=='1'){
  form.dataset.v12GradeSubmitBound='1';
  form.addEventListener('submit',()=>{
   const grade=form.querySelector('[data-v12-grade-switch] input');if(!grade)return;
   const id=activeExamId();if(!id)return;
   const payload={counts_toward_grade:grade.checked};
   if(!grade.checked)payload.allow_ai_feedback=false;
   db.from('exams').update(payload).eq('id',id).then(({error})=>{if(error)window.err?.(error)});
  },true);
 }
}

function normalizeBuilderInfo(){
 const form=$('#ubInfoForm');if(form)form.classList.add('assessment-window-form');
 const input=$('#ubInfoForm [name="total_questions"]');
 if(input){
  input.readOnly=true;input.setAttribute('aria-readonly','true');
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
 ensureGradeSwitch();
}

async function normalizeDetail(){
 const page=$('.assessment-detail-page');if(!page)return;
 normalizeLegacyText(page);
 if(!page.querySelector('.assessment-v12-detail-source')){
  const head=page.querySelector('.assessment-detail-head');
  if(head){const badge=document.createElement('span');badge.className='badge assessment-v12-detail-source';badge.textContent='Ngân hàng luyện tập – kiểm tra';head.appendChild(badge)}
 }
 if(page.dataset.v12GradeLoaded)return;page.dataset.v12GradeLoaded='1';
 const examId=activeExamId();if(!examId)return;
 const r=await db.from('exams').select('counts_toward_grade').eq('id',examId).maybeSingle();if(r.error||!r.data)return;
 if(r.data.counts_toward_grade===false&&!page.querySelector('.assessment-v12-no-grade')){
  const head=page.querySelector('.assessment-detail-head');if(head){const badge=document.createElement('span');badge.className='badge assessment-v12-no-grade';badge.textContent='Không tính CLO học phần';head.appendChild(badge)}
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

function enhanceNow(){normalizeLegacyText(document);normalizeBuilderInfo();normalizeDetail();normalizeFinalTab()}
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
 window.addEventListener('pageshow',enhanceSoon);enhanceSoon();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
window.AICLO_ASSESSMENT_SUBPAGES_V12=Object.freeze({version:VERSION,enhance:enhanceNow});
})();