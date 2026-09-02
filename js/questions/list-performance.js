/* AI-CLO PTITHCM — question-bank pagination, debounced search and visible-only MathJax. */
(() => {
'use strict';

const PAGE_SIZE=50;
const SEARCH_DELAY=160;
const originalRenderMath=window.renderMath;
const states=new WeakMap();
let searchTimer=null;

const bank=()=>window.AICLO_V105?.activeBank?.()||'practice';
const pageKey=()=>`aiclo:qbank-page:${state.user?.id||'user'}:${state.subjectId||'subject'}:${bank()}`;
const readPage=()=>{const n=Number(sessionStorage.getItem(pageKey())||0);return Number.isFinite(n)&&n>=0?Math.floor(n):0};
const savePage=n=>{try{sessionStorage.setItem(pageKey(),String(Math.max(0,n||0)))}catch{}};
const resetPage=()=>savePage(0);

function isQuestionRows(container){return container?.id==='qrows'&&container.tagName==='TBODY'}
function pageCount(total){return Math.max(1,Math.ceil(total/PAGE_SIZE))}

function ensurePager(tbody){
 const tableWrap=tbody.closest('.v105-question-table');
 if(!tableWrap)return null;
 let pager=tableWrap.nextElementSibling;
 if(!pager?.classList.contains('question-bank-pager')){
  pager=document.createElement('nav');
  pager.className='question-bank-pager';
  pager.setAttribute('aria-label','Phân trang ngân hàng câu hỏi');
  tableWrap.after(pager);
 }
 return pager;
}

function preserveCurrentPage(tbody,s){
 if(!s?.rows?.length||!tbody.children.length)return;
 const start=s.page*PAGE_SIZE;
 [...tbody.children].forEach((row,i)=>{if(start+i<s.rows.length)s.rows[start+i]=row.outerHTML});
}

function updateCount(s){
 const box=document.querySelector('#questionCount');if(!box)return;
 const total=s.rows.length,start=total?s.page*PAGE_SIZE+1:0,end=Math.min(total,(s.page+1)*PAGE_SIZE);
 const old=box.textContent||'',match=old.match(/\/(\d+)\s*câu/),bankTotal=match?Number(match[1]):total;
 box.textContent=total===bankTotal?`Hiển thị ${start}–${end}/${total} câu`:`Hiển thị ${start}–${end}/${total} câu phù hợp · ${bankTotal} câu trong ngân hàng`;
}

function updatePager(tbody,s){
 const pager=ensurePager(tbody);if(!pager)return;
 const pages=pageCount(s.rows.length);
 if(s.rows.length<=PAGE_SIZE){pager.innerHTML='';pager.hidden=true;return}
 pager.hidden=false;
 pager.innerHTML=`<button type="button" class="secondary" data-qpage="prev" ${s.page<=0?'disabled':''}>← Trước</button><span>Trang <b>${s.page+1}</b>/${pages} · ${s.rows.length} câu</span><button type="button" class="secondary" data-qpage="next" ${s.page>=pages-1?'disabled':''}>Sau →</button>`;
 pager.onclick=e=>{
  const b=e.target.closest('[data-qpage]');if(!b)return;
  preserveCurrentPage(tbody,s);
  const next=b.dataset.qpage==='prev'?s.page-1:s.page+1;
  showPage(tbody,s,next,true);
  tbody.closest('.v105-question-table')?.scrollIntoView({block:'start',behavior:'smooth'});
 };
}

function showPage(tbody,s,page,typeset=true){
 const pages=pageCount(s.rows.length);
 s.page=Math.max(0,Math.min(page,pages-1));
 savePage(s.page);
 const start=s.page*PAGE_SIZE,end=Math.min(s.rows.length,start+PAGE_SIZE);
 tbody.innerHTML=s.rows.slice(start,end).join('')||'<tr><td colspan="6" class="empty">Không có câu hỏi phù hợp.</td></tr>';
 updateCount(s);updatePager(tbody,s);
 if(typeset&&typeof originalRenderMath==='function')originalRenderMath(tbody);
}

/* bank.js calls renderMath immediately after writing every filtered row. Intercept only
 * #qrows: capture the rows, detach all but the current page, then typeset that page only. */
if(typeof originalRenderMath==='function')window.renderMath=function(container=document.body){
 if(!isQuestionRows(container))return originalRenderMath(container);
 const rows=[...container.children].map(row=>row.outerHTML);
 const s={rows,page:readPage()};states.set(container,s);
 showPage(container,s,s.page,false);
 return originalRenderMath(container);
};

function enhanceSearch(){
 const input=document.querySelector('#qsearch');
 if(!input||input.dataset.aicloDebounced==='1'||typeof input.oninput!=='function')return;
 const run=input.oninput;
 input.dataset.aicloDebounced='1';
 input.oninput=function(event){
  clearTimeout(searchTimer);
  if(event?.isTrusted===false)return run.call(this,event);
  resetPage();
  searchTimer=setTimeout(()=>run.call(this,event),SEARCH_DELAY);
 };
}

/* bank.js installs handlers after it creates the DOM. MutationObserver runs after that
 * synchronous render and wraps only the search box; select filters remain immediate. */
const observer=new MutationObserver(()=>enhanceSearch());
observer.observe(document.documentElement,{childList:true,subtree:true});
document.addEventListener('DOMContentLoaded',enhanceSearch);

/* User-driven filters start at page 1. Synthetic change events used to restore saved
 * filters do not reset the page, so returning from question detail keeps position. */
document.addEventListener('change',e=>{
 if(!e.isTrusted)return;
 if(e.target?.matches?.('#qchapterFilter,#qtopicFilter,#qcloFilter,#qapprovalFilter,#qcreatorFilter'))resetPage();
},true);
document.addEventListener('click',e=>{
 if(!e.isTrusted)return;
 if(e.target?.closest?.('[data-bank-tab]'))resetPage();
},true);

window.AICLO_QUESTION_LIST_PERF=Object.freeze({pageSize:PAGE_SIZE,searchDelay:SEARCH_DELAY,resetPage});
})();
