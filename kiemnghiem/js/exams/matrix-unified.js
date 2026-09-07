/* AI-CLO PTITHCM V11.6.27 — compact matrix cells and availability counts shared by online/final exam workflows. */
(()=>{
'use strict';
const normScope=v=>v==='secure_exam'?'secure_exam':v==='both'?'both':'practice';
const inScope=(q,scope)=>scope==='secure_exam'?['secure_exam','both'].includes(q.question_scope):scope==='both'?true:['practice','both'].includes(q.question_scope);
const asInt=v=>Math.max(0,Math.floor(Number(v)||0));
const setText=(node,text)=>{if(node&&node.textContent!==text)node.textContent=text};

function paintCell(input){
 const wrap=input.closest('.matrix-cell-compact');if(!wrap)return;
 const available=asInt(input.dataset.available||input.max),need=asInt(input.value);
 const over=need>available,empty=available===0;
 if(wrap.classList.contains('is-over')!==over)wrap.classList.toggle('is-over',over);
 if(wrap.classList.contains('is-empty')!==empty)wrap.classList.toggle('is-empty',empty);
 const title=available?`Ngân hàng hiện có ${available} câu phù hợp`:'Không có câu phù hợp trong ngân hàng';
 if(wrap.title!==title)wrap.title=title;
}

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
  if(!input.dataset.available){
   const available=asInt((hint?.textContent||'').replace(/\D+/g,''));
   input.dataset.available=String(available);
  }
  const available=asInt(input.dataset.available);
  let wrap=input.closest('.matrix-cell-compact');
  if(!wrap){
   hint?.remove();wrap=document.createElement('div');wrap.className='matrix-cell-compact';
   input.before(wrap);wrap.append(input);
   const count=document.createElement('span');count.className='matrix-cell-available';wrap.append(count);
  }
  setText(wrap.querySelector('.matrix-cell-available'),`(${available})`);
  paintCell(input);
 });
}

let finalQuestionsCache={sid:null,items:null};
async function finalQuestions(){
 const sid=String(state.subjectId||'');
 if(finalQuestionsCache.sid===sid&&finalQuestionsCache.items)return finalQuestionsCache.items;
 try{
  const sets=await window.v96QuestionSets?.();
  const items=(sets?.items||[]).filter(q=>q.approval_status==='approved'&&q.status==='active');
  finalQuestionsCache={sid,items};return items;
 }catch(error){console.warn('Không tải được nguồn câu để hiển thị số có trong ma trận đề thi',error);return []}
}
function finalScope(root){
 const select=root.closest('form')?.querySelector('[name="source_scope"], [name="source"], #finalQuestionSource');
 if(select?.value)return normScope(select.value);
 return 'secure_exam';
}
async function compactFinalMatrix(root){
 const table=root.matches?.('.v102-matrix')?root:root.querySelector?.('.v102-matrix');if(!table||!table.isConnected)return;
 table.querySelectorAll('tbody tr:not(.matrix-chapter):not(.matrix-grand)').forEach(tr=>{
  const first=tr.cells?.[0];if(!first||first.querySelector('.matrix-topic-inline'))return;
  const name=first.textContent.trim();
  let chapterRow=tr.previousElementSibling;while(chapterRow&&!chapterRow.classList.contains('matrix-chapter'))chapterRow=chapterRow.previousElementSibling;
  const siblingRows=[];let p=chapterRow?.nextElementSibling;while(p&&!p.classList.contains('matrix-chapter')&&!p.classList.contains('matrix-grand')){siblingRows.push(p);p=p.nextElementSibling}
  const idx=siblingRows.indexOf(tr)+1;
  first.innerHTML=`<span class="matrix-topic-inline">${idx>0?`${idx}. `:''}${esc(name)}</span>`;
 });
 const inputs=[...table.querySelectorAll('.matrix-count')];if(!inputs.length)return;
 const items=await finalQuestions();if(!table.isConnected)return;
 const scope=finalScope(table);
 for(const input of inputs){
  if(!input.isConnected)continue;
  const available=items.filter(q=>String(q.chapter_id)===String(input.dataset.chapter)&&String(q.topic_id||'')===String(input.dataset.topic||'')&&String(q.clo_id)===String(input.dataset.clo)&&inScope(q,scope)).length;
  if(input.dataset.available!==String(available))input.dataset.available=String(available);
  if(input.max!==String(available))input.max=String(available);
  const shouldDisable=available===0;
  if(input.disabled!==shouldDisable)input.disabled=shouldDisable;
  if(shouldDisable&&input.value!=='0'){
   input.value='0';input.dispatchEvent(new Event('input',{bubbles:true}));
  }
  let wrap=input.closest('.matrix-cell-compact');
  if(!wrap){
   wrap=document.createElement('div');wrap.className='matrix-cell-compact';input.before(wrap);wrap.append(input);
   const count=document.createElement('span');count.className='matrix-cell-available';wrap.append(count);
  }
  setText(wrap.querySelector('.matrix-cell-available'),`(${available})`);
  paintCell(input);
  if(!input.dataset.matrixUnifiedBound){input.dataset.matrixUnifiedBound='1';input.addEventListener('input',()=>paintCell(input))}
 }
}

function shortAssessmentLabels(root=document){
 const form=root.querySelector?.('#matrixAssessmentForm')||(root.matches?.('#matrixAssessmentForm')?root:null);if(!form)return;
 const map=[
  ['show_answers','Xem đáp án sau khi nộp'],
  ['shuffle_questions','Trộn câu hỏi'],
  ['shuffle_options','Trộn phương án A–D'],
  ['allow_ai_feedback','Cho phép AI nhận xét']
 ];
 for(const [name,text] of map){
  const input=form.elements.namedItem(name),label=input?.closest('label');if(!label||label.dataset.matrixUnifiedLabel===text)continue;
  [...label.childNodes].filter(n=>n.nodeType===Node.TEXT_NODE).forEach(n=>n.remove());
  label.append(document.createTextNode(text));label.dataset.matrixUnifiedLabel=text;
 }
}

let queued=false;
function scan(){queued=false;compactOnlineMatrix();shortAssessmentLabels();document.querySelectorAll('.v102-matrix').forEach(x=>compactFinalMatrix(x))}
function queue(){if(queued)return;queued=true;requestAnimationFrame(scan)}
new MutationObserver(records=>{
 if(records.some(r=>[...r.addedNodes].some(n=>n.nodeType===1)))queue();
}).observe(document.documentElement,{childList:true,subtree:true});
document.addEventListener('input',e=>{if(e.target.matches?.('.matrix-cell-input,.matrix-count'))paintCell(e.target)},true);
document.addEventListener('change',e=>{if(e.target.matches?.('[name="source_scope"],[name="source"],#finalQuestionSource'))document.querySelectorAll('.v102-matrix').forEach(x=>compactFinalMatrix(x))},true);
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',scan,{once:true});else scan();
window.AICLO_MATRIX_UNIFIED=Object.freeze({version:'11.6.27',refresh:scan});
})();
