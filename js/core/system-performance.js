/* AI-CLO PTITHCM — fast paths for system-level views. */
(() => {
'use strict';

const PERF=window.AICLO_PERF;
const previousDashboard=window.dashboard;
if(typeof previousDashboard!=='function')return;

const SYSTEM_TTL=60*1000;
const NOTICE_TTL=30*1000;
const ATTEMPT_TTL=15*1000;
const teacherRoles=['teacher','lecturer','giangvien'];
const isTeacher=r=>teacherRoles.includes(r);
const memo=(key,ttl,loader)=>PERF?.memo?PERF.memo(key,ttl,loader):loader();
const fmt=v=>v?new Intl.DateTimeFormat('vi-VN',{timeZone:'Asia/Ho_Chi_Minh',dateStyle:'short',timeStyle:'short'}).format(new Date(v)):'—';
const roleLabel=r=>r==='admin'?'Quản trị viên':isTeacher(r)?'Giảng viên':'Sinh viên';
const stat=(k,v,note='')=>`<article class="v109-stat"><small>${esc(k)}</small><b>${esc(v)}</b>${note?`<span>${esc(note)}</span>`:''}</article>`;
const courseCards=list=>list.map(s=>`<article class="v109-course"><div><small>${esc(s.semester||'')} · ${esc(s.academic_year||'')}</small><h4>${esc(s.name)}</h4></div><button class="primary" data-system-course="${s.id}">Vào học phần →</button></article>`).join('')||'<div class="empty"><b>Chưa có học phần</b><span>Chưa có học phần được phân công.</span></div>';

async function countRows(key,ttl,table,build=x=>x){
 return memo(key,ttl,async()=>{
  const {count,error}=await build(db.from(table).select('id',{count:'exact',head:true}));
  if(error)throw error;
  return count||0;
 });
}
async function membershipsForUser(){
 if(role()==='admin')return new Set(state.subjects.map(s=>s.id));
 const rows=await q('subject_members','subject_id',x=>x.eq('user_id',state.user.id));
 return new Set(rows.map(x=>x.subject_id));
}
async function recentNotices(){
 if(role()==='admin')return [];
 const uid=state.user.id;
 return memo(`system:notices:${uid}`,NOTICE_TTL,()=>q('notifications','id,title,message,category,severity,created_at,read_at,subject_id,target_view,target_id',x=>x.eq('user_id',uid).order('created_at',{ascending:false}).limit(5)));
}
async function systemData(){
 const uid=state.user.id,r=role();
 return memo(`system:dashboard:v112:${uid}:${r}`,SYSTEM_TTL,async()=>{
  const ids=await membershipsForUser();
  const visible=r==='admin'?state.subjects:state.subjects.filter(s=>ids.has(s.id));
  if(r==='admin'){
   const [profiles,banks,bankQuestions,bankChapters]=await Promise.all([
    q('profiles','id,role,is_active',x=>x.order('id')),
    q('question_banks','id,name,code,description,is_active',x=>x.order('name')),
    q('questions','question_bank_id,question_scope'),
    q('chapters','id,question_bank_id')
   ]);
   return {r,visible,profiles,banks,bankQuestions,bankChapters,unread:0,submitted:0,students:0};
  }
  const unread=await countRows(`system:unread:${uid}`,NOTICE_TTL,'notifications',x=>x.eq('user_id',uid).is('read_at',null));
  if(isTeacher(r)){
   const subjectIds=visible.map(s=>s.id);
   const members=subjectIds.length?await q('subject_members','subject_id,user_id,role',x=>x.in('subject_id',subjectIds)):[];
   const students=new Set(members.filter(m=>m.role==='student').map(m=>m.user_id)).size;
   return {r,visible,profiles:[],unread,submitted:0,students};
  }
  const submitted=await countRows(`system:submitted:${uid}`,ATTEMPT_TTL,'exam_attempts',x=>x.eq('student_id',uid).not('submitted_at','is',null));
  return {r,visible,profiles:[],unread,submitted,students:0};
 });
}
function bindCourseCards(c){
 $$('[data-system-course]',c).forEach(b=>b.onclick=()=>window.v95EnterCourse?.(b.dataset.systemCourse));
}
function appendNotices(c,items){
 const panel=document.createElement('section');
 panel.className='panel v109-notices';
 panel.innerHTML=`<div class="panel-head"><div><h3>Thông báo gần đây</h3><p class="hint">Những nội dung mới từ hệ thống và các học phần.</p></div><button id="systemAllNotices" class="secondary">Xem tất cả thông báo</button></div><div class="v109-notice-list">${items.map(n=>`<button type="button" class="v109-notice ${n.read_at?'':'unread'}" data-system-notice="${n.id}"><span>🔔</span><div><b>${esc(n.title||'Thông báo')}</b><p>${esc(n.message||'')}</p><small>${fmt(n.created_at)}${n.read_at?'':' · Chưa đọc'}</small></div></button>`).join('')||'<div class="empty"><b>Chưa có thông báo</b><span>Thông báo mới sẽ xuất hiện tại đây.</span></div>'}</div>`;
 $('.v109-dashboard',c)?.append(panel);
 $('#systemAllNotices',panel).onclick=()=>navigate('notifications');
 $$('[data-system-notice]',panel).forEach(b=>b.onclick=()=>window.AICLO_V108?.openNoticeDetail?.(items.find(n=>n.id===b.dataset.systemNotice)));
}
async function fastSystemDashboard(c){
 const data=await systemData(),r=data.r;
 let cards=[],intro='',action='',bankPanel='';
 if(r==='admin'){
  cards=[['Học phần',state.subjects.length],['Người dùng',data.profiles.length],['Giảng viên',data.profiles.filter(p=>isTeacher(p.role)).length],['Sinh viên',data.profiles.filter(p=>p.role==='student').length]];
  intro='Theo dõi toàn hệ thống, quản lý người dùng và mở từng học phần để kiểm tra dữ liệu.';action='Quản lý học phần';
  bankPanel=`<section class="panel v112-banks"><div class="panel-head"><div><h3>Ngân hàng câu hỏi</h3><p class="hint">${data.banks.length} ngân hàng · ${data.bankQuestions.length} câu hỏi. File Excel có cả đáp án và câu bảo mật.</p></div></div><div class="v112-bank-grid">${data.banks.map(bank=>{const linked=state.subjects.filter(s=>s.question_bank_id===bank.id),questions=data.bankQuestions.filter(q=>q.question_bank_id===bank.id),practice=questions.filter(q=>['practice','both'].includes(q.question_scope)).length,secure=questions.filter(q=>['secure_exam','both'].includes(q.question_scope)).length,chapters=data.bankChapters.filter(ch=>ch.question_bank_id===bank.id).length;return `<article class="v112-bank-card"><div><small>${esc(bank.code)}</small><h4>${esc(bank.name)}</h4><p>${chapters} chương · ${questions.length} câu · ${linked.length} học phần</p><div><span class="badge green">${practice} luyện tập</span><span class="badge secure">🔒 ${secure} bảo mật</span></div></div><div class="v112-bank-actions"><button class="secondary" data-fast-open-bank="${bank.id}" ${linked.length?'':'disabled'}>Mở ngân hàng</button><button class="primary" data-fast-export-bank="${bank.id}">↓ Tải Excel</button></div></article>`}).join('')||'<div class="empty"><b>Chưa có ngân hàng câu hỏi</b><span>Tạo học phần và ngân hàng đầu tiên để bắt đầu.</span></div>'}</div></section>`;
 }else if(isTeacher(r)){
  cards=[['Học phần phụ trách',data.visible.length],['Sinh viên',data.students],['Thông báo chưa đọc',data.unread],['Vai trò','Giảng viên']];
  intro='Chọn học phần để quản lý nội dung, ngân hàng câu hỏi, đánh giá và kết quả CLO.';action='Xem học phần phụ trách';
 }else{
  cards=[['Học phần đang học',data.visible.length],['Lượt đã nộp',data.submitted],['Thông báo chưa đọc',data.unread],['Vai trò','Sinh viên']];
  intro='Theo dõi học phần, bài cần làm, kết quả CLO và phản hồi học tập của bạn.';action='Xem học phần đang học';
 }
 c.innerHTML=`<div class="v109-dashboard"><section class="v109-hero"><div><small>TỔNG QUAN HỆ THỐNG</small><h3>Xin chào, ${esc(state.profile?.full_name||'bạn')}</h3><p>${esc(intro)}</p></div><span>${esc(roleLabel(r))}</span></section><div class="v109-stats">${cards.map(x=>stat(...x)).join('')}</div>${bankPanel}<section class="panel"><div class="panel-head"><h3>${esc(action)}</h3><button id="systemAllCourses" class="secondary">${esc(action)}</button></div><div class="v109-courses">${courseCards(data.visible.slice(0,6))}</div></section></div>`;
 $('#pageTitle').textContent='Tổng quan hệ thống';
 $('#pageSub').textContent=r==='admin'?'Học phần, người dùng và tình trạng hệ thống':isTeacher(r)?'Các học phần phụ trách và công việc cần xử lý':'Học phần, bài kiểm tra và kết quả của bạn';
 $('#systemAllCourses').onclick=()=>navigate('subjects');
 bindCourseCards(c);
 if(r==='admin'){
  $$('[data-fast-open-bank]',c).forEach(button=>button.onclick=()=>{const subject=state.subjects.find(s=>s.question_bank_id===button.dataset.fastOpenBank);if(subject)window.v95EnterCourse?.(subject.id,'questions')});
  $$('[data-fast-export-bank]',c).forEach(button=>button.onclick=()=>{const bank=data.banks.find(b=>b.id===button.dataset.fastExportBank);if(bank)window.AICLO_QUESTION_EXPORT?.exportBank(bank,button)});
 }
 if(r!=='admin')appendNotices(c,await recentNotices());
}

window.dashboard=async function(c){
 if(state.space==='system')return fastSystemDashboard(c);
 return previousDashboard(c);
};

function invalidateSystem(){
 PERF?.invalidate?.('system:dashboard:');
 PERF?.invalidate?.('system:unread:');
 PERF?.invalidate?.('system:notices:');
 PERF?.invalidate?.('system:submitted:');
 window.AICLO_VIEW_TRANSITION?.invalidate?.('dashboard',null,'system');
}
window.AICLO_SYSTEM_PERF=Object.freeze({invalidate:invalidateSystem,version:'1'});
})();
