/* AI-CLO PTITHCM V11 — notification detail extracted from legacy V10.8. */
(() => {
'use strict';

const dt=v=>v?new Intl.DateTimeFormat('vi-VN',{timeZone:'Asia/Ho_Chi_Minh',dateStyle:'short',timeStyle:'short'}).format(new Date(v)):'—';

function actionLabel(n){
 const v=n?.target_view;
 return v==='exams'?'Mở bài kiểm tra':v==='results'?'Xem kết quả CLO':v==='questions'?'Mở ngân hàng câu hỏi':v==='structure'?'Mở Chương · CLO':v==='users'?'Mở danh sách lớp':'Mở nội dung liên quan';
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
 openDrawer('Thông báo',`<div class="notice-detail-v108"><div class="notice-detail-icon">🔔</div><div><small>${esc(n.category||'Thông báo')} · ${dt(n.created_at)}</small><h3>${esc(n.title||'Thông báo')}</h3></div><p>${esc(n.message||'')}</p>${subject?`<div><small>Học phần</small><b>${esc(subject.name)} · ${esc(subject.semester||'')}</b></div>`:''}<div class="notice-detail-actions">${n.target_view?'<button id="v108OpenNoticeTarget" class="primary">'+actionLabel(n)+'</button>':''}<button id="v108UnreadNotice" class="secondary">Đánh dấu chưa đọc</button></div></div>`);
 $('#v108OpenNoticeTarget')?.addEventListener('click',()=>{
  closeDrawer();
  if(n.subject_id&&['structure','questions','exams','results','users','dashboard'].includes(n.target_view))window.v95EnterCourse?.(n.subject_id,n.target_view);
  else navigate(n.target_view||'notifications');
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
