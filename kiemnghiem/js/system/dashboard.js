/* AI-CLO PTITHCM V12.6.18-kiemnghiem — canonical system dashboard owner and router. */
(() => {
'use strict';

const teacherRoles=['teacher','lecturer','giangvien'];
const isTeacher=r=>teacherRoles.includes(r);
const roleLabel=r=>r==='admin'?'Quản trị viên':isTeacher(r)?'Giảng viên':'Sinh viên';
const fmt=v=>v?new Intl.DateTimeFormat('vi-VN',{timeZone:'Asia/Ho_Chi_Minh',dateStyle:'short',timeStyle:'short'}).format(new Date(v)):'—';
const safe=async(fn,fallback=[])=>{try{return await fn()}catch{return fallback}};
const count=async(table,build=x=>x)=>{try{const {count,error}=await build(db.from(table).select('id',{count:'exact',head:true}));if(error)throw error;return count||0}catch{return 0}};

function stat(k,v,note=''){
 return `<article class="v109-stat"><small>${esc(k)}</small><b>${esc(v)}</b>${note?`<span>${esc(note)}</span>`:''}</article>`;
}

function ongoingCourses(list){
 const today=new Date().toISOString().slice(0,10);
 return (list||[]).filter(s=>(!s.starts_on||s.starts_on<=today)&&(!s.ends_on||s.ends_on>=today));
}

async function roleCourseIds(){
 return safe(async()=>{
  const rows=await q('subject_members','subject_id,user_id',x=>x.eq('user_id',state.user.id));
  return new Set(rows.map(x=>x.subject_id));
 },new Set());
}

function courseCards(list){
 return (list||[]).map(s=>`<article class="v109-course"><div><small>${esc(s.semester||'')} · ${esc(s.academic_year||'')}</small><h4>${esc(s.name)}</h4></div><button class="primary" data-dashboard-course="${s.id}">Vào học phần →</button></article>`).join('')||'<div class="empty"><b>Chưa có học phần</b><span>Chưa có học phần được phân công.</span></div>';
}

function bindCourseCards(root){
 $$('[data-dashboard-course]',root).forEach(b=>b.onclick=()=>window.v95EnterCourse?.(b.dataset.dashboardCourse));
}

async function renderSystemDashboard(c){
 const r=role(),ids=await roleCourseIds();
 const visible=r==='admin'?state.subjects:state.subjects.filter(s=>ids.has(s.id));
 const unread=await count('notifications',x=>x.eq('user_id',state.user.id).is('read_at',null));
 let cards=[],intro='',action='';

 if(r==='admin'){
  const [profiles,bankRows]=await Promise.all([
   safe(()=>q('profiles','id,role,is_active'),[]),
   safe(()=>q('question_banks','id,name,code,description,is_active',x=>x.order('name')),[])
  ]);
  cards=[['Học phần đang diễn ra',ongoingCourses(state.subjects).length],['Ngân hàng câu hỏi',bankRows.length],['Người dùng',profiles.length],['Giảng viên',profiles.filter(p=>isTeacher(p.role)).length],['Sinh viên',profiles.filter(p=>p.role==='student').length]];
  intro='Theo dõi toàn hệ thống, quản lý người dùng và mở từng học phần để kiểm tra dữ liệu.';
  action='Quản lý học phần';
 }else if(isTeacher(r)){
  const visibleIds=visible.map(s=>s.id);
  const members=visibleIds.length?await safe(()=>q('subject_members','subject_id,user_id,role',x=>x.in('subject_id',visibleIds)),[]):[];
  const students=new Set(members.filter(m=>m.role==='student').map(m=>m.user_id));
  cards=[['Học phần phụ trách',visible.length],['Sinh viên',students.size],['Thông báo chưa đọc',unread],['Vai trò','Giảng viên']];
  intro='Chọn học phần để quản lý nội dung, ngân hàng câu hỏi, đánh giá và kết quả CLO.';
  action='Xem học phần phụ trách';
 }else{
  const submitted=await count('exam_attempts',x=>x.eq('student_id',state.user.id).not('submitted_at','is',null));
  cards=[['Học phần đang học',visible.length],['Lượt đã nộp',submitted],['Thông báo chưa đọc',unread],['Vai trò','Sinh viên']];
  intro='Theo dõi học phần, bài cần làm, kết quả CLO và phản hồi học tập của bạn.';
  action='Xem học phần đang học';
 }

 const dashboardCourses=ongoingCourses(visible);
 c.innerHTML=`<div class="v109-dashboard"><section class="v109-hero"><div><small>TỔNG QUAN HỆ THỐNG</small><h3>Xin chào, ${esc(state.profile?.full_name||'bạn')}</h3><p>${esc(intro)}</p></div><span>${esc(roleLabel(r))}</span></section><div class="v109-stats">${cards.map(x=>stat(...x)).join('')}</div><section class="panel"><div class="panel-head"><h3>${r==='admin'?'Học phần đang diễn ra':esc(action)}</h3><button id="dashboardAllCourses" class="secondary">${esc(action)}</button></div><div class="v109-courses">${courseCards(dashboardCourses.slice(0,6))}</div></section></div>`;
 $('#pageTitle').textContent='Tổng quan hệ thống';
 $('#pageSub').textContent=r==='admin'?'Học phần, người dùng và tình trạng hệ thống':isTeacher(r)?'Các học phần phụ trách và công việc cần xử lý':'Học phần, bài kiểm tra và kết quả của bạn';
 $('#dashboardAllCourses').onclick=()=>navigate('subjects');
 bindCourseCards(c);

 if(r!=='admin'){
  const notices=await safe(()=>q('notifications','id,title,message,category,severity,created_at,read_at,subject_id,target_view,target_id',x=>x.eq('user_id',state.user.id).order('created_at',{ascending:false}).limit(5)),[]);
  const panel=document.createElement('section');
  panel.className='panel v109-notices';
  panel.innerHTML=`<div class="panel-head"><div><h3>Thông báo gần đây</h3><p class="hint">Những nội dung mới từ hệ thống và các học phần.</p></div><button id="dashboardAllNotices" class="secondary">Xem tất cả thông báo</button></div><div class="v109-notice-list">${notices.map(n=>`<button type="button" class="v109-notice ${n.read_at?'':'unread'}" data-dashboard-notice="${n.id}"><span>🔔</span><div><b>${esc(n.title||'Thông báo')}</b><p>${esc(n.message||'')}</p><small>${fmt(n.created_at)}${n.read_at?'':' · Chưa đọc'}</small></div></button>`).join('')||'<div class="empty"><b>Chưa có thông báo</b><span>Thông báo mới sẽ xuất hiện tại đây.</span></div>'}</div>`;
  $('.v109-dashboard',c).append(panel);
  $('#dashboardAllNotices').onclick=()=>navigate('notifications');
  $$('[data-dashboard-notice]',panel).forEach(b=>b.onclick=()=>window.AICLO_V108?.openNoticeDetail?.(notices.find(n=>n.id===b.dataset.dashboardNotice)));
 }
}

async function renderDashboard(c){
 if(state.space==='system')return renderSystemDashboard(c);
 const owner=window.AICLO_OVERVIEW;
 if(!owner?.render)throw new Error('Course Overview owner was not loaded');
 return owner.render(c);
}

window.dashboard=renderDashboard;
window.AICLO_SYSTEM_DASHBOARD=Object.freeze({version:'12.6.18-kiemnghiem',render:renderSystemDashboard,route:renderDashboard});
})();
