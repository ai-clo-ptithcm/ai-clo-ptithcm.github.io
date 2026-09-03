/* AI-CLO PTITHCM V11.6.27 — compact matrix cells and availability counts shared by online/final exam workflows. */
(()=>{
'use strict';
const normScope=v=>v==='secure_exam'?'secure_exam':v==='both'?'both':'practice';
const inScope=(q,scope)=>scope==='secure_exam'?['secure_exam','both'].includes(q.question_scope):scope==='both'?true:['practice','both'].includes(q.question_scope);
const asInt=v=>Math.max(0,Math.floor(Number(v)||0));

function compactOnlineMatrix(root=document){
 root.querySelectorAll('.matrix-builder-table .matrix-topic-name').forEach(cell=>{
  if(cell.querySelector('.matrix-topic-inline'))return;
  const order=cell.querySelector('small')?.textContent?.trim();
  const name=cell.querySelector('b')?.textContent?.trim()||cell.textContent.trim();
  cell.innerHTML=`<span class="matrix-topic-inline">${order&&order!=='—'?`${order}. `:''}${esc(name)}</span>`;
 });
 root.querySelectorAll('.matrix-builder-table .matrix-edit-cell').forEach(cell=>{
  const input=cell.querySelector('.matrix-cell-input');if(!input)return;
  const hint=cell.querySelector('small');
  const available=asInt((hint?.textContent||'').replace(/\D+/g,''));
  if(!input.dataset.available)input.dataset.available=String(available);
  if(!cell.querySelector('.matrix-cell-available')){
   hint?.remove();
   const wrap=document.createElement('div');wrap.className='matrix-cell-compact';
   input.before(wrap);wrap.append(input);
   const count=document.createElement('span');count.className='matrix-cell-available';count.textContent=`(${available})`;wrap.append(count);
  }
  paintCell(input);
 });
}
function paintCell(input){
 const wrap=input.closest('.matrix-cell-compact');if(!wrap)return;
 const available=asInt(input.dataset.available||input.max),need=asInt(input.value);
 wrap.classList.toggle('is-over',need>available);
 wrap.classList.toggle('is-empty',available===0);
 wrap.title=available?`Ngân hàng hiện có ${available} câu phù hợp`:'Không có câu phù hợp trong ngân hàng';
}

let finalQuestionsCache=null;
async function finalQuestions(){
 if(finalQuestionsCache)return finalQuestionsCache;
 try{
  const sets=await window.v96QuestionSets?.();
  const items=(sets?.items||[]).filter(q=>q.approval_status==='approved'&&q.status==='active');
  finalQuestionsCache=items;return items;
 }catch(error){console.warn('Không tải được nguồn câu để hiển thị số có trong ma trận đề thi',error);return []}
}
function finalScope(root){
 const select=root.closest('form')?.querySelector('[name="source_scope"], [name="source"], #finalQuestionSource');
 if(select?.value)return normScope(select.value);
 return 'secure_exam';
}
async function compactFinalMatrix(root){
 const table=root.matches?.('.v102-matrix')?root:root.querySelector?.('.v102-matrix');if(!table)return;
 table.querySelectorAll('tbody tr:not(.matrix-chapter):not(.matrix-grand)').forEach(tr=>{
  const first=tr.cells?.[0];if(!first||first.querySelector('.matrix-topic-inline'))return;
  const name=first.textContent.trim();
  const chapterRow=(()=>{let p=tr.previousElementSibling;while(p&&!p.classList.contains('matrix-chapter'))p=p.previousElementSibling;return p})();
  const topicOrder=[...chapterRow?.parentElement?.children||[]].filter(x=>x.classList?.contains('matrix-chapter')?false:true);
  const siblingRows=[];let p=chapterRow?.nextElementSibling;while(p&&!p.classList.contains('matrix-chapter')&&!p.classList.contains('matrix-grand')){siblingRows.push(p);p=p.nextElementSibling}
  const idx=siblingRows.indexOf(tr)+1;
  first.innerHTML=`<span class="matrix-topic-inline">${idx>0?`${idx}. `:''}${esc(name)}</span>`;
 });
 const inputs=[...table.querySelectorAll('.matrix-count')];if(!inputs.length)return;
 const items=await finalQuestions(),scope=finalScope(table);
 for(const input of inputs){
  const available=items.filter(q=>String(q.chapter_id)===String(input.dataset.chapter)&&String(q.topic_id||'')===String(input.dataset.topic||'')&&String(q.clo_id)===String(input.dataset.clo)&&inScope(q,scope)).length;
  input.dataset.available=String(available);input.max=String(available);
  if(available===0){input.value='0';input.disabled=true}else input.disabled=false;
  let wrap=input.closest('.matrix-cell-compact');
  if(!wrap){wrap=document.createElement('div');wrap.className='matrix-cell-compact';input.before(wrap);wrap.append(input);const count=document.createElement('span');count.className='matrix-cell-available';wrap.append(count)}
  const count=wrap.querySelector('.matrix-cell-available');if(count)count.textContent=`(${available})`;
  paintCell(input);
  if(!input.dataset.matrixUnifiedBound){input.dataset.matrixUnifiedBound='1';input.addEventListener('input',()=>paintCell(input))}
 }
}

function shortAssessmentLabels(root=document){
 const form=root.querySelector?.('#matrixAssessmentForm')||(root.matches?.('#matrixAssessmentForm')?root:null);if(!form)return;
 const labels=[...form.querySelectorAll('.assessment-options label')];
 const map=[
  ['show_answers','Xem đáp án sau khi nộp'],
  ['shuffle_questions','Trộn câu hỏi'],
  ['shuffle_options','Trộn phương án A–D'],
  ['allow_ai_feedback','Cho phép AI nhận xét']
 ];
 for(const [name,text] of map){const input=form.elements.namedItem(name);const label=input?.closest('label');if(label){[...label.childNodes].filter(n=>n.nodeType===Node.TEXT_NODE).forEach(n=>n.remove());label.append(document.createTextNode(text))}}
}

let queued=false;
function scan(){queued=false;compactOnlineMatrix();shortAssessmentLabels();document.querySelectorAll('.v102-matrix').forEach(x=>compactFinalMatrix(x))}
function queue(){if(queued)return;queued=true;requestAnimationFrame(scan)}
new MutationObserver(queue).observe(document.documentElement,{childList:true,subtree:true});
document.addEventListener('input',e=>{if(e.target.matches?.('.matrix-cell-input,.matrix-count'))paintCell(e.target)},true);
document.addEventListener('change',e=>{if(e.target.matches?.('[name="source_scope"],[name="source"],#finalQuestionSource')){finalQuestionsCache=null;document.querySelectorAll('.v102-matrix').forEach(x=>compactFinalMatrix(x))}},true);
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',scan,{once:true});else scan();
window.AICLO_MATRIX_UNIFIED=Object.freeze({version:'11.6.27',refresh:scan});
})();
