/* AI-CLO PTITHCM V11 — notification detail extracted from legacy V10.8. */
(() => {
'use strict';

const dt=v=>v?new Intl.DateTimeFormat('vi-VN',{timeZone:'Asia/Ho_Chi_Minh',dateStyle:'short',timeStyle:'short'}).format(new Date(v)):'—';

function actionLabel(n){
 const v=n?.target_view;
 return v==='exams'?'Mở bài kiểm tra':v==='results'?'Xem kết quả CLO':v==='questions'?'Mở ngân hàng câu hỏi':v==='structure'?'Mở Chương · CLO':v==='users'?'Mở danh sách lớp':'Mở nội dung liên quan';
}

function highlightTarget(el){
 if(!el)return false;
 const target=el.closest('tr,article,.panel')||el;
 target.classList.add('notice-target-highlight');
 target.scrollIntoView({behavior:'smooth',block:'center'});
 setTimeout(()=>target.classList.remove('notice-target-highlight'),5000);
 return true;
}

async function openNoticeTarget(n){
 const courseViews=['structure','questions','exams','results','users','dashboard'];
 let view=n.target_view||'notifications';
 if(view==='results'&&n.target_id&&canTeach())view='exams';
 if(n.subject_id&&courseViews.includes(view))await window.v95EnterCourse?.(n.subject_id,view);
 else await navigate(view);
 if(!n.target_id)return;
 if(view==='questions'&&String(n.title||'').startsWith('Admin yêu cầu chỉnh sửa câu hỏi')){
  const sets=await window.AICLO_QUESTION_STATE?.lightQuestionSets?.(),item=sets?.items?.find(x=>x.id===n.target_id);
  if(item){const full=await window.AICLO_QUESTION_STATE.hydrateQuestion(item);await window.v96QuestionDetail?.(full,sets);return}
  toast('Câu hỏi không còn trong ngân hàng hoặc bạn chưa có quyền truy cập.',true);return;
 }
 if(view==='questions'&&typeof reviewBatch==='function'){
  await reviewBatch(n.target_id,0);
  return;
 }
 if(view==='exams'){
  const attempts=$(`[data-attempts="${n.target_id}"]`);
  if(attempts&&canTeach()){attempts.click();return}
  const action=$(`[data-start="${n.target_id}"],[data-resume="${n.target_id}"]`);
  if(highlightTarget(action))toast('Đã mở đúng bài kiểm tra trong thông báo');
 }
}

async function openNoticeDetail(n){
 if(!n)return;
 if(!n.read_at){
  const now=new Date().toISOString();
  await db.from('notifications').update({read_at:now}).eq('id',n.id);
  n.read_at=now;
  window.refreshNotificationData?.(true);
 }
 window.logActivity?.('read_notification','notification',n.id,'Đọc thông báo');
 const subject=state.subjects.find(s=>s.id===n.subject_id);
 openDrawer('Thông báo',`<div class="notice-detail-v108"><div class="notice-detail-icon">🔔</div><div><small>${esc(n.category||'Thông báo')} · ${dt(n.created_at)}</small><h3>${esc(n.title||'Thông báo')}</h3></div><p>${esc(n.message||'')}</p>${subject?`<div><small>Học phần</small><b>${esc(subject.name)} · ${esc(subject.semester||'')}</b></div>`:''}<div class="notice-detail-actions">${n.target_view&&n.target_view!=='notifications'?'<button id="v108OpenNoticeTarget" class="primary">'+actionLabel(n)+'</button>':''}<button id="v108UnreadNotice" class="secondary">Đánh dấu chưa đọc</button></div></div>`);
 $('#v108OpenNoticeTarget')?.addEventListener('click',async()=>{
  closeDrawer();
  try{await openNoticeTarget(n)}catch(ex){err(ex)}
 });
 $('#v108UnreadNotice').onclick=async()=>{
  await db.from('notifications').update({read_at:null}).eq('id',n.id);
  closeDrawer();
  window.refreshNotificationData?.(true);
  if(state.view==='notifications')render();
 };
}

async function openNotification(id,items=[]){
 const n=items.find(x=>x.id===id);
 if(n)await openNoticeDetail(n);
}

window.openNotification=openNotification;
window.AICLO_NOTIFICATION_DETAIL=Object.freeze({openNoticeDetail,openNotification});
})();
