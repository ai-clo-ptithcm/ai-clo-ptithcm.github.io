/* AI-CLO PTITHCM V11 — question workspace base extracted from legacy V9.4. */
var v94QuestionFilters=null;
const v94Time=v=>v?new Intl.DateTimeFormat('vi-VN',{timeZone:'Asia/Ho_Chi_Minh',dateStyle:'medium',timeStyle:'short'}).format(new Date(v)):'—';
function questionWorkspace(title,subtitle,body){
 closeModal();closeDrawer();
 const c=$('#content');
 c.innerHTML=`<section class="panel question-workspace"><div class="workspace-head"><button id="questionBack" class="workspace-back">← Quay lại ngân hàng</button><div><h3>${esc(title)}</h3><p>${esc(subtitle||'')}</p></div></div><div class="workspace-body">${body}</div></section>`;
 $('#questionBack').onclick=backToQuestionList;
 window.scrollTo({top:0,behavior:'smooth'});
 renderMath(c);
}
window.AICLO_QUESTION_BASE=Object.freeze({time:v94Time,workspace:questionWorkspace});
