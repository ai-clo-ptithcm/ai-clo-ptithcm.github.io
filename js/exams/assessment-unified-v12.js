/* AI-CLO PTITHCM V12.0 — Assessment page: only Bài kiểm tra and Bài thi cuối kỳ. */
(()=>{
'use strict';
const VERSION='12.0.1';
let observer=null,busy=false,topicCache=null;
const ONLINE_TYPES=new Set(['chapter_test','clo_assessment','review_exam']);
const $=s=>document.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
function hideLegacyCreateButtons(){
 ['#addExam','#addCloAssessment','#createReviewExam','#createFinalExam','#createExamWizardV119'].forEach(sel=>{let b=$(sel);if(b){b.hidden=true;b.style.display='none';b.tabIndex=-1;b.setAttribute('aria-hidden','true')}});
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
function activeBuilderState(){try{let user=state?.user?.id||'user',subject=state?.subjectId;if(!subject)return null;let a=JSON.parse(localStorage.getItem(`aiclo:v118:active:${user}:${subject}`)||'null');if(!a)return null;return JSON.parse(localStorage.getItem(`aiclo:v118:builder:${user}:${subject}:${a.type||'exam'}:${a.examId||'new'}`)||'null')}catch{return null}}
async function topics(){if(topicCache)return topicCache;try{topicCache=await q('topics','*',x=>contentFilter(x).order('order_index'));return topicCache}catch{return []}}
function normalizeBuilderLabels(){
 let title=$('#pageTitle');if(title&&/ôn tập thi|đánh giá clo/i.test(title.textContent||''))title.textContent=title.textContent.replace(/ôn tập thi|đánh giá clo/ig,'bài kiểm tra');
 let top=$('.ub-top h3');if(top&&/ôn tập thi|đánh giá clo/i.test(top.textContent||''))top.textContent=top.textContent.replace(/ôn tập thi|đánh giá clo/ig,'bài kiểm tra');
 $$('.ub-badges .badge').forEach(b=>{if(/Bài ôn tập thi|Bài đánh giá CLO/i.test(b.textContent||''))b.textContent='Bài kiểm tra'});
 let info=$('#ubInfoForm [name="total_questions"]');if(info&&!info.readOnly){info.readOnly=true;info.setAttribute('aria-readonly','true');let label=info.closest('label');if(label){let text=[...label.childNodes].find(n=>n.nodeType===3);if(text)text.textContent='Tổng số câu (tự tính từ ma trận)';let small=document.createElement('small');small.className='hint assessment-v12-total-note';small.textContent='Tổng này được lấy từ ma trận câu hỏi, không chỉnh độc lập.';label.appendChild(small)}}
}
async function enhanceStructureEditor(){
 let form=$('#ubStructureForm');if(!form||form.dataset.assessmentV12==='1')return;let fixed=form.querySelector('.ub-fixed-mode'),scope=form.querySelector('.ub-scope-list');if(!scope)return;
 form.dataset.assessmentV12='1';let saved=activeBuilderState(),mode=saved?.structureMode||(/CLO chung/i.test(fixed?.textContent||'')?'chapter_pool':'topic_clo');
 if(fixed){fixed.outerHTML=`<div class="ub-mode-choice assessment-v12-mode-choice"><label><input type="radio" name="ubStructureMode" value="topic_clo" ${mode==='topic_clo'?'checked':''}> <b>CLO cho mỗi mục</b><small>Mỗi mục có phân bố CLO riêng.</small></label><label><input type="radio" name="ubStructureMode" value="chapter_pool" ${mode==='chapter_pool'?'checked':''}> <b>CLO chung các mục thuộc chương</b><small>Chỉ gom các mục đã chọn và vẫn tách riêng từng chương.</small></label></div>`}
 let allTopics=await topics(),selected=new Set(saved?.selectedTopics||[]);
 for(let article of [...scope.querySelectorAll('article')]){let ch=article.querySelector('[data-ub-chapter]');if(!ch||article.querySelector('.ub-topic-checks'))continue;let box=document.createElement('div');box.className='ub-topic-checks assessment-v12-topic-checks';let list=allTopics.filter(t=>t.chapter_id===ch.dataset.ubChapter);box.innerHTML=list.map(t=>`<label><input type="checkbox" data-ub-topic="${t.id}" data-chapter="${ch.dataset.ubChapter}" ${selected.has(t.id)?'checked':''} ${ch.checked?'':'disabled'}> ${window.esc?window.esc(t.name):t.name}</label>`).join('')||'<small class="hint">Chương này chưa có mục.</small>';article.appendChild(box)}
}
function pageHeading(){let nav=$('[data-view="exams"]');if(nav)nav.textContent='✎ Đánh giá';let title=$('#pageTitle'),sub=$('#pageSub');if(title&&state?.view==='exams'&&!$('.ub-workspace')&&!$('.assessment-detail-page')){title.textContent='Đánh giá';if(sub)sub.textContent='Bài kiểm tra trực tuyến và đề thi cuối kỳ theo cùng một quy trình AI-CLO'}}
async function run(){if(busy)return;busy=true;try{hideLegacyCreateButtons();ensureCreateButtons();await normalizeRows();normalizeDetail();normalizeBuilderLabels();await enhanceStructureEditor();pageHeading()}finally{busy=false}}
function init(){let c=$('#content');if(c&&!observer){observer=new MutationObserver(()=>requestAnimationFrame(run));observer.observe(c,{childList:true,subtree:true})}run()}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
window.AICLO_ASSESSMENT_V12=Object.freeze({version:VERSION,run});
})();