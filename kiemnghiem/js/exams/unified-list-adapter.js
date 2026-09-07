/* AI-CLO PTITHCM V12.0.3 — one-shot list adapter; no continuous DB observer loop. */
(()=>{
'use strict';
const VERSION='12.0.3';
let observer=null,armed=false,busy=false;
const onlineTypes=new Set(['chapter_test','clo_assessment','review_exam']);
const $=s=>document.querySelector(s);
function stop(){if(observer){observer.disconnect();observer=null}armed=false}
async function enhanceRows(){
 const body=$('#examRows');if(!body)return;
 const buttons=[...body.querySelectorAll('[data-attempts]')],ids=[...new Set(buttons.map(x=>x.dataset.attempts).filter(Boolean))];if(!ids.length)return;
 const {data,error}=await db.from('exams').select('id,exam_type').in('id',ids);if(error)return;
 for(const e of data||[]){const row=body.querySelector(`[data-attempts="${e.id}"]`)?.closest('tr');if(!row)continue;const title=row.querySelector('.exam-title-link b'),label=onlineTypes.has(e.exam_type)?'Bài kiểm tra':'Bài thi cuối kỳ';let badge=row.querySelector('.ub-type-badge');if(!badge&&title){title.insertAdjacentHTML('afterend',` <span class="badge red ub-type-badge">${label}</span>`);badge=row.querySelector('.ub-type-badge')}if(badge)badge.textContent=label;const actions=row.querySelector('.row-actions');actions?.querySelectorAll('button').forEach(b=>{if(/Chỉnh CLO|Cấu trúc/i.test(b.textContent||''))b.remove()})}
}
function normalizeStatus(){document.querySelectorAll('#content .badge').forEach(x=>{const t=x.textContent.trim();if(t==='Đã đóng')x.textContent='Tạm đóng'})}
async function run(){if(busy)return;busy=true;try{await enhanceRows();normalizeStatus()}finally{busy=false}}
function apply(){stop();run()}
function arm(){stop();const host=$('#content');if(!host)return;if($('#examRows'))return apply();armed=true;observer=new MutationObserver(()=>{if($('#examRows'))apply()});observer.observe(host,{childList:true,subtree:true});setTimeout(()=>{if(armed)stop()},2500)}
function init(){document.addEventListener('click',e=>{if(e.target?.closest?.('[data-view="exams"]'))queueMicrotask(arm)},true);arm()}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
window.AICLO_UNIFIED_LIST=Object.freeze({version:VERSION,arm,run});
})();