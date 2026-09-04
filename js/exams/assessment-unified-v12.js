/* AI-CLO PTITHCM V12.0 — Assessment page: only Bài kiểm tra and Bài thi cuối kỳ. */
(()=>{
'use strict';
const VERSION='12.0.0';
let observer=null,busy=false;
const ONLINE_TYPES=new Set(['chapter_test','clo_assessment','review_exam']);
const $=s=>document.querySelector(s);
function hideLegacyCreateButtons(){
 ['#addExam','#addCloAssessment','#createReviewExam','#createFinalExam'].forEach(sel=>{let b=$(sel);if(b){b.hidden=true;b.style.display='none';b.tabIndex=-1;b.setAttribute('aria-hidden','true')}});
}
function ensureCreateButtons(){
 const legacy=$('#addExam');
 if(!legacy?.parentElement)return;
 const bar=legacy.parentElement;
 let test=$('#createAssessmentV12');
 if(!test){test=document.createElement('button');test.id='createAssessmentV12';test.type='button';test.className='primary';test.textContent='+ Tạo bài kiểm tra';test.onclick=()=>window.AICLO_CREATE_WIZARD?.start?.('test');bar.insertBefore(test,legacy)}
 let final=$('#createFinalAssessmentV12');
 if(!final){final=document.createElement('button');final.id='createFinalAssessmentV12';final.type='button';final.className='ai-btn';final.textContent='+ Tạo bài thi cuối kỳ';final.onclick=()=>window.AICLO_CREATE_WIZARD?.start?.('final');bar.insertBefore(final,legacy)}
 if(test.nextSibling!==final)bar.insertBefore(final,test.nextSibling);
 bar.classList.add('assessment-v12-toolbar');
}
async function normalizeRows(){
 let body=$('#examRows');if(!body)return;
 let buttons=[...body.querySelectorAll('[data-attempts]')],ids=[...new Set(buttons.map(x=>x.dataset.attempts).filter(Boolean))];if(!ids.length)return;
 let {data,error}=await db.from('exams').select('id,exam_type,counts_toward_grade').in('id',ids);
 if(error&&/counts_toward_grade/i.test(String(error.message||''))){let retry=await db.from('exams').select('id,exam_type').in('id',ids);data=retry.data;error=retry.error}
 if(error)return;
 for(let e of data||[]){if(!ONLINE_TYPES.has(e.exam_type))continue;let row=body.querySelector(`[data-attempts="${e.id}"]`)?.closest('tr');if(!row)continue;let badge=row.querySelector('.ub-type-badge');if(badge)badge.textContent='Bài kiểm tra';else{let title=row.querySelector('.exam-title-link b');title?.insertAdjacentHTML('afterend',' <span class="badge red ub-type-badge">Bài kiểm tra</span>')}
  let structure=row.children?.[1];if(structure&&!structure.querySelector('.assessment-v12-bank'))structure.insertAdjacentHTML('beforeend','<br><small class="assessment-v12-bank">Ngân hàng luyện tập – kiểm tra</small>');
  if(e.counts_toward_grade===false&&!row.querySelector('.assessment-v12-no-grade'))row.querySelector('.exam-title-link')?.insertAdjacentHTML('afterend',' <span class="badge assessment-v12-no-grade">Không tính CLO học phần</span>');
 }
}
function normalizeDetail(){
 let page=$('.assessment-detail-page');if(!page)return;
 let badge=page.querySelector('.assessment-detail-head .ub-type-badge');if(badge)badge.textContent='Bài kiểm tra';
 let source=page.querySelector('.assessment-v12-detail-source');if(!source){let meta=page.querySelector('.assessment-detail-head .detail-meta,.assessment-detail-head');if(meta){source=document.createElement('span');source.className='badge assessment-v12-detail-source';source.textContent='Ngân hàng luyện tập – kiểm tra';meta.appendChild(source)}}
}
function pageHeading(){let title=$('#pageTitle'),sub=$('#pageSub');if(title&&state?.view==='exams'){title.textContent='Đánh giá';if(sub)sub.textContent='Bài kiểm tra trực tuyến và đề thi cuối kỳ theo cùng một quy trình AI-CLO'}}
async function run(){if(busy)return;busy=true;try{hideLegacyCreateButtons();ensureCreateButtons();await normalizeRows();normalizeDetail();pageHeading()}finally{busy=false}}
function init(){let c=$('#content');if(c&&!observer){observer=new MutationObserver(()=>requestAnimationFrame(run));observer.observe(c,{childList:true,subtree:true})}run()}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
window.AICLO_ASSESSMENT_V12=Object.freeze({version:VERSION,run});
})();