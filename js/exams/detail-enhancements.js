/* AI-CLO PTITHCM V11.6.20 — assessment detail layout, sorting and scroll persistence. */
(()=>{
'use strict';

let queued=false,observer=null,scrollTimer=null,restoringScroll=false;
const enhancedPages=new WeakSet();
const activeExamId=()=>{try{return sessionStorage.getItem(`aiclo:v115:active-exam:${state.subjectId}`)||''}catch{return''}};
const scrollKey=id=>`aiclo:v11620:exam-scroll:${state.user?.id||'user'}:${state.subjectId||'subject'}:${id}`;
const highSortKey=id=>`aiclo:v11620:exam-high-sort:${state.user?.id||'user'}:${state.subjectId||'subject'}:${id}`;
const readNumber=text=>{const n=Number(String(text||'').trim().replace(',','.'));return Number.isFinite(n)?n:null};

function readSavedScroll(id){
 if(!id)return null;
 try{const x=JSON.parse(sessionStorage.getItem(scrollKey(id))||'null');return x&&Number.isFinite(Number(x.y))?Number(x.y):null}catch{return null}
}
function saveScroll(){
 if(restoringScroll)return;
 const page=document.querySelector('.assessment-detail-page'),id=activeExamId();if(!page||!id)return;
 try{sessionStorage.setItem(scrollKey(id),JSON.stringify({y:Math.max(0,Math.round(window.scrollY||0)),at:Date.now()}))}catch{}
}
function clearScroll(id){if(!id)return;try{sessionStorage.removeItem(scrollKey(id))}catch{}}
function restoreScroll(page,id){
 if(!id||page.dataset.aicloScrollRestored==='1')return;
 page.dataset.aicloScrollRestored='1';const y=readSavedScroll(id);if(y==null)return;
 restoringScroll=true;
 const apply=()=>window.scrollTo({top:y,left:0,behavior:'auto'});
 requestAnimationFrame(()=>requestAnimationFrame(apply));
 setTimeout(apply,90);setTimeout(()=>{apply();restoringScroll=false},180);
}

function removeLeakedFinalExamSection(){
 if(!document.querySelector('.assessment-detail-page'))return;
 document.querySelectorAll('#content .v102-final-list').forEach(section=>section.remove());
}

function syncExamAiResult(page){
 const section=page.querySelector('.exam-ai-section'),result=page.querySelector('#examAiResult');if(!section||!result)return;
 section.classList.add('exam-ai-result-only');
 const heading=section.querySelector('h3');if(heading&&heading.textContent!=='Kết quả AI phân tích')heading.textContent='Kết quả AI phân tích';
 const intro=section.querySelector('p');if(intro)intro.hidden=true;
 const text=String(result.textContent||'').trim();
 const empty=!text||text.includes('Chưa có kết quả phân tích AI.');
 section.hidden=empty&&section.dataset.aiRunning!=='1';
}
function moveExamAiAction(page){
 const actions=page.querySelector('.assessment-detail-actions'),button=page.querySelector('#examAiAnalyze'),section=page.querySelector('.exam-ai-section');if(!actions||!button)return;
 button.textContent='✦ AI phân tích';button.classList.add('ai-btn');
 if(button.parentElement!==actions)actions.insertBefore(button,actions.firstChild);
 if(section)syncExamAiResult(page);
}

function ensureCloHighSortOptions(page,id){
 const select=page.querySelector('#attemptSort');if(!select||select.dataset.aicloCloHigh==='1')return;
 const lows=[...select.options].filter(o=>String(o.value).startsWith('clo:'));
 for(const low of lows){
  const code=String(low.value).slice(4),high=document.createElement('option');
  high.value=`clo-high:${code}`;high.textContent=`${code} cao nhất`;select.insertBefore(high,low);
 }
 select.dataset.aicloCloHigh='1';
 try{const saved=sessionStorage.getItem(highSortKey(id));if(saved&&[...select.options].some(o=>o.value===saved))select.value=saved}catch{}
}
function applyHighCloSort(page){
 const select=page.querySelector('#attemptSort'),tbody=page.querySelector('#attemptRows');if(!select||!tbody||!String(select.value).startsWith('clo-high:'))return;
 const code=String(select.value).slice('clo-high:'.length),headers=[...page.querySelectorAll('.exam-attempt-table thead th')],index=headers.findIndex(th=>th.textContent.trim()===code);if(index<0)return;
 const current=[...tbody.querySelectorAll('tr')];if(current.length<2)return;
 const sorted=[...current].sort((a,b)=>{
  const av=readNumber(a.children[index]?.textContent),bv=readNumber(b.children[index]?.textContent);
  if(av==null&&bv==null)return 0;if(av==null)return 1;if(bv==null)return-1;return bv-av;
 });
 if(sorted.some((row,i)=>row!==current[i]))sorted.forEach(row=>tbody.appendChild(row));
 sorted.forEach((row,i)=>{const cell=row.children[0];if(cell&&cell.textContent!==String(i+1))cell.textContent=String(i+1)});
}

function splitAttemptDate(cell){
 if(!cell||cell.dataset.aicloDateSplit==='1')return;
 const raw=String(cell.textContent||'').trim();
 let time='',date='';
 let m=raw.match(/(\d{1,2}:\d{2}:\d{2})\s*,?\s*(\d{1,2}\/\d{1,2}\/\d{4})/);
 if(m){time=m[1];date=m[2]}else{
  m=raw.match(/(\d{1,2}\/\d{1,2}\/\d{4})\s*,?\s*(\d{1,2}:\d{2}:\d{2})/);if(m){date=m[1];time=m[2]}
 }
 if(!date||!time)return;
 cell.dataset.aicloDateSplit='1';cell.classList.add('attempt-date-cell');
 cell.innerHTML=`<span>${date}</span><small>${time}</small>`;
}
function enhanceAttemptActions(cell){
 if(!cell)return;
 const view=cell.querySelector('[data-view-attempt]'),del=cell.querySelector('[data-delete-attempt]'),ai=cell.querySelector('[data-ai-attempt]');
 if(view&&view.textContent!=='Xem')view.textContent='Xem';
 if(del&&del.textContent!=='Xóa')del.textContent='Xóa';
 if(ai){if(ai.textContent!=='✦ AI nhận xét')ai.textContent='✦ AI nhận xét';ai.classList.add('ai-btn')}
 const desired=[view,del,ai].filter(Boolean),present=[...cell.querySelectorAll('button')].filter(b=>desired.includes(b));
 if(desired.length&&desired.some((b,i)=>present[i]!==b))desired.forEach(b=>cell.appendChild(b));
 cell.classList.add('attempt-actions-cell');
}
function enhanceAttemptRows(page){
 const table=page.querySelector('.exam-attempt-table');if(!table)return;
 const head=table.querySelector('thead tr');if(head){head.children[1]?.classList.add('attempt-student-col');head.children[3]?.classList.add('attempt-date-col');head.lastElementChild?.classList.add('attempt-actions-col')}
 table.querySelectorAll('tbody tr').forEach(row=>{
  if(row.children.length<4)return;
  row.children[1]?.classList.add('attempt-student-col');splitAttemptDate(row.children[3]);enhanceAttemptActions(row.lastElementChild);
 });
 applyHighCloSort(page);
}

function enhancePage(page){
 const id=activeExamId();removeLeakedFinalExamSection();moveExamAiAction(page);ensureCloHighSortOptions(page,id);enhanceAttemptRows(page);syncExamAiResult(page);
 if(!enhancedPages.has(page)){enhancedPages.add(page);restoreScroll(page,id)}
}
function enhance(){
 const page=document.querySelector('.assessment-detail-page');if(page)enhancePage(page);else removeLeakedFinalExamSection();
}
function queueEnhance(){if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;enhance()})}

// Keep the AI-result panel visible as soon as the lecturer explicitly starts analysis.
document.addEventListener('click',e=>{
 const ai=e.target.closest?.('#examAiAnalyze');if(ai){const page=ai.closest('.assessment-detail-page'),section=page?.querySelector('.exam-ai-section');if(section){section.dataset.aiRunning='1';section.hidden=false}}
 const back=e.target.closest?.('#examDetailBack');if(back){clearScroll(activeExamId());return}
 // An explicit click from the assessment list means a fresh visit: start at the top.
 const open=e.target.closest?.('[data-attempts]');if(open&&!document.querySelector('.assessment-detail-page'))clearScroll(open.dataset.attempts);
},true);

document.addEventListener('change',e=>{
 const select=e.target.closest?.('#attemptSort');if(!select)return;const id=activeExamId();
 try{if(String(select.value).startsWith('clo-high:'))sessionStorage.setItem(highSortKey(id),select.value);else sessionStorage.removeItem(highSortKey(id))}catch{}
 requestAnimationFrame(queueEnhance);
},true);

window.addEventListener('scroll',()=>{clearTimeout(scrollTimer);scrollTimer=setTimeout(saveScroll,80)},{passive:true});
document.addEventListener('visibilitychange',()=>{if(document.hidden)saveScroll();else setTimeout(queueEnhance,30)});
window.addEventListener('pagehide',saveScroll);

function init(){
 const host=document.querySelector('#content');if(host&&!observer){observer=new MutationObserver(queueEnhance);observer.observe(host,{childList:true,subtree:true,characterData:true})}queueEnhance();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();

window.AICLO_EXAM_DETAIL_ENHANCEMENTS=Object.freeze({version:'11.6.20',enhance:queueEnhance,saveScroll});
})();
