/* AI-CLO PTITHCM V11.6.13 — question workspace base. */
let v94QuestionFilters=null;
const v94Time=v=>v?new Intl.DateTimeFormat('vi-VN',{timeZone:'Asia/Ho_Chi_Minh',dateStyle:'medium',timeStyle:'short'}).format(new Date(v)):'—';
function questionWorkspace(title,subtitle,body){
 closeModal();closeDrawer();
 const c=$('#content');
 c.innerHTML=`<section class="panel question-workspace"><div class="workspace-head"><button id="questionBack" class="workspace-back">← Quay lại</button><div><h3>${esc(title)}</h3><p>${esc(subtitle||'')}</p></div></div><div class="workspace-body">${body}</div></section>`;
 const back=$('#questionBack');
 back.onclick=async()=>{
  if(back.dataset.loading==='1')return;
  back.dataset.loading='1';
  back.disabled=true;
  back.textContent='← Đang quay lại…';
  $('#pageTitle').textContent='Ngân hàng câu hỏi';
  $('#pageSub').textContent='Đang tải dữ liệu học phần…';
  c.innerHTML='<section class="panel question-return-loading" role="status" aria-live="polite"><b>Đang tải Ngân hàng câu hỏi…</b><p class="hint">Hệ thống đang cập nhật câu hỏi, chương, chủ đề và CLO mới nhất.</p></section>';
  await new Promise(resolve=>requestAnimationFrame(()=>resolve()));
  try{await backToQuestionList()}catch(error){err(error)}
 };
 window.scrollTo({top:0,behavior:'smooth'});
 renderMath(c);
}
window.AICLO_QUESTION_BASE=Object.freeze({time:v94Time,workspace:questionWorkspace});
