/* AI-CLO PTITHCM V11.8 — list/detail adapter for unified exam framework. */
(()=>{
'use strict';
let obs=null,busy=false;
const labels={chapter_test:'Kiểm tra',clo_assessment:'Đánh giá CLO',review_exam:'Ôn tập thi'};
async function enhanceRows(){let body=document.querySelector('#examRows');if(!body)return;let buttons=[...body.querySelectorAll('[data-attempts]')],ids=[...new Set(buttons.map(x=>x.dataset.attempts).filter(Boolean))];if(!ids.length)return;let {data,error}=await db.from('exams').select('id,exam_type').in('id',ids);if(error)return;for(let e of data||[]){let row=body.querySelector(`[data-attempts="${e.id}"]`)?.closest('tr');if(!row)continue;let title=row.querySelector('.exam-title-link b');if(title&&!row.querySelector('.ub-type-badge'))title.insertAdjacentHTML('afterend',` <span class="badge red ub-type-badge">${labels[e.exam_type]||'Bài kiểm tra'}</span>`);let actions=row.querySelector('.row-actions');if(actions){[...actions.querySelectorAll('button')].forEach(b=>{if(/Chỉnh CLO|Cấu trúc/i.test(b.textContent||''))b.remove()})}}
}
function normalizeStatus(){document.querySelectorAll('#content .badge').forEach(x=>{let t=x.textContent.trim();if(t==='Đã đóng')x.textContent='Tạm đóng';if(/^Đã tạo \d+ mã đề$/.test(t))x.textContent=t.replace(/^Đã tạo /,'Đã khóa · ')})}
async function run(){if(busy)return;busy=true;try{await enhanceRows();normalizeStatus()}finally{busy=false}}
function init(){let c=document.querySelector('#content');if(c&&!obs){obs=new MutationObserver(()=>requestAnimationFrame(run));obs.observe(c,{childList:true,subtree:true})}run()}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();