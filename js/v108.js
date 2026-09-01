/* AI-CLO PTITHCM V10.8 — system/course context, notifications, profiles, mobile shell. */
(() => {
'use strict';
const V='10.8';
const teacherRoles=['teacher','lecturer','giangvien'];
const isTeacherRole=r=>teacherRoles.includes(r);
const roleText=r=>r==='admin'?'Quản trị viên':isTeacherRole(r)?'Giảng viên':'Sinh viên';
const dt=v=>v?new Intl.DateTimeFormat('vi-VN',{timeZone:'Asia/Ho_Chi_Minh',dateStyle:'short',timeStyle:'short'}).format(new Date(v)):'—';

function setContextBadge(){
 const heading=$('.page-heading');if(!heading)return;
 let badge=$('#v108ContextBadge');if(!badge){badge=document.createElement('span');badge.id='v108ContextBadge';badge.className='app-context-badge';heading.append(badge)}
 if(state.space==='course'&&activeSubject()){
  const s=activeSubject();badge.classList.add('course');badge.textContent=`${s.name} · ${s.semester||''}`;
 }else{badge.classList.remove('course');badge.textContent='HỆ THỐNG'}
}
function closeMobileSidebar(){const aside=$('.app>aside'),backdrop=$('#appSidebarBackdrop');aside?.classList.remove('open');backdrop?.classList.remove('show');$('#app')?.classList.remove('sidebar-open')}
function openMobileSidebar(){if(!matchMedia('(max-width:760px)').matches)return;$('.app>aside')?.classList.add('open');$('#appSidebarBackdrop')?.classList.add('show');$('#app')?.classList.add('sidebar-open')}
function setupMobileShell(){
 const app=$('#app'),aside=$('.app>aside');if(!app||!aside)return;
 if(!$('#appSidebarBackdrop')){const b=document.createElement('div');b.id='appSidebarBackdrop';b.className='app-sidebar-backdrop';document.body.append(b);b.onclick=closeMobileSidebar}
 if(!$('#mobileSidebarClose')){const b=document.createElement('button');b.id='mobileSidebarClose';b.type='button';b.className='mobile-sidebar-close';b.setAttribute('aria-label','Đóng menu');b.textContent='×';aside.prepend(b);b.onclick=closeMobileSidebar}
 const menu=$('#menuBtn');if(menu){menu.onclick=e=>{e.preventDefault();if(matchMedia('(max-width:760px)').matches){aside.classList.contains('open')?closeMobileSidebar():openMobileSidebar()}else aside.classList.toggle('open')}}
 $('#nav')?.addEventListener('click',e=>{if(e.target.closest('[data-view]'))closeMobileSidebar()});
 document.addEventListener('keydown',e=>{if(e.key==='Escape')closeMobileSidebar()});
 window.addEventListener('resize',()=>{if(!matchMedia('(max-width:760px)').matches)closeMobileSidebar()});
}
function setupAppAi(){
 const header=$('.app main>header');if(!header||$('#appAiButton'))return;
 const bell=$('#notificationBell');const b=document.createElement('button');b.id='appAiButton';b.type='button';b.className='app-ai-button';b.innerHTML='<span>💬</span> Hỏi AI-CLO';b.title='Hỏi AI-CLO';
 header.insertBefore(b,bell||null);b.onclick=()=>window.AICLO_CHAT?.open?.({role:role(),view:state.view,space:state.space,subject:activeSubject()?.name||''});
}
function makeMiniUserClickable(){const box=$('#miniUser');if(!box)return;box.classList.add('mini-user-button-v108');box.setAttribute('role','button');box.setAttribute('tabindex','0');box.title='Mở hồ sơ cá nhân';const go=()=>openUserProfile(state.profile);box.onclick=go;box.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();go()}}}

const oldRefreshShell=window.v95RefreshShell;
if(typeof oldRefreshShell==='function')window.v95RefreshShell=function(){oldRefreshShell();setContextBadge();setupAppAi();makeMiniUserClickable()};

async function safeCount(table,build=x=>x){try{let {count,error}=await build(db.from(table).select('id',{count:'exact',head:true}));if(error)throw error;return count||0}catch{return null}}
async function systemDashboard(c){
 const r=role();let unread=await safeCount('notifications',x=>x.eq('user_id',state.user.id).is('read_at',null));let members=[],profiles=[];
 try{members=await q('subject_members','user_id,subject_id,role')}catch{}
 if(r==='admin'){try{profiles=await q('profiles','id,role,is_active')}catch{}}
 const subjectIds=new Set(members.filter(m=>m.user_id===state.user.id||r==='admin').map(m=>m.subject_id));
 let primary=[];
 if(r==='admin')primary=[['Môn học',state.subjects.length],['Người dùng',profiles.length],['Giảng viên',profiles.filter(p=>isTeacherRole(p.role)).length],['Sinh viên',profiles.filter(p=>p.role==='student').length]];
 else if(isTeacherRole(r)){
  const mine=state.subjects.filter(s=>subjectIds.has(s.id));let studentIds=new Set(members.filter(m=>mine.some(s=>s.id===m.subject_id)&&m.role==='student').map(m=>m.user_id));
  primary=[['Môn phụ trách',mine.length],['Sinh viên',studentIds.size],['Thông báo chưa đọc',unread??'—'],['Vai trò','Giảng viên']];
 }else{
  const mine=state.subjects.filter(s=>subjectIds.has(s.id));let attemptCount=await safeCount('exam_attempts',x=>x.eq('student_id',state.user.id).not('submitted_at','is',null));
  primary=[['Môn đang học',mine.length],['Lượt đã nộp',attemptCount??'—'],['Thông báo chưa đọc',unread??'—'],['Vai trò','Sinh viên']];
 }
 const visible=state.subjects.filter(s=>r==='admin'||!subjectIds.size||subjectIds.has(s.id));
 $('#pageTitle').textContent='Tổng quan hệ thống';$('#pageSub').textContent='Môn học, hoạt động và thông tin cần xử lý';setContextBadge();
 c.innerHTML=`<div class="system-overview-v108"><section class="overview-hero-v108"><div><small>AI-CLO PTITHCM</small><h3>Xin chào, ${esc(state.profile?.full_name||'bạn')}</h3><p>${r==='admin'?'Theo dõi toàn hệ thống, người dùng và các học phần đang triển khai.':isTeacherRole(r)?'Chọn học phần để quản lý cấu trúc, ngân hàng câu hỏi, bài kiểm tra và kết quả CLO.':'Theo dõi các học phần, bài kiểm tra, kết quả CLO và phản hồi học tập của bạn.'}</p></div><span class="overview-role-v108">${esc(roleText(r))}</span></section><div class="v108-stat-grid">${primary.map(([k,v])=>`<div class="v108-stat"><small>${esc(k)}</small><b>${esc(v)}</b></div>`).join('')}</div><section class="panel"><div class="panel-head"><h3>${r==='admin'?'Các môn học trong hệ thống':isTeacherRole(r)?'Học phần phụ trách':'Học phần đang học'}</h3><button id="v108AllCourses" class="secondary">Xem tất cả</button></div><div class="v108-course-grid">${visible.slice(0,6).map(s=>`<article class="v108-course-card"><div><small>${esc(s.semester||'')} · ${esc(s.academic_year||'')}</small><h4>${esc(s.name)}</h4></div><button class="primary" data-v108-course="${s.id}">Vào môn học →</button></article>`).join('')||'<div class="empty">Chưa có học phần được phân công.</div>'}</div></section></div>`;
 $$('[data-v108-course]',c).forEach(b=>b.onclick=()=>window.v95EnterCourse?.(b.dataset.v108Course));$('#v108AllCourses').onclick=()=>navigate('subjects');
}

const courseDashboard=window.dashboard;
window.dashboard=async function(c){return state.space==='system'?systemDashboard(c):courseDashboard(c)};

function notificationActionLabel(n){const v=n.target_view;return v==='exams'?'Mở bài kiểm tra':v==='results'?'Xem kết quả CLO':v==='questions'?'Mở ngân hàng câu hỏi':v==='structure'?'Mở Chương · CLO':v==='users'?'Mở danh sách lớp':'Mở nội dung liên quan'}
async function openNoticeDetail(n){
 if(!n)return;if(!n.read_at){const now=new Date().toISOString();await db.from('notifications').update({read_at:now}).eq('id',n.id);n.read_at=now;refreshNotificationData?.(true)}
 window.logActivity?.('read_notification','notification',n.id,'Đọc thông báo');
 const subject=state.subjects.find(s=>s.id===n.subject_id);openDrawer('Thông báo',`<div class="notice-detail-v108"><div class="notice-detail-icon">🔔</div><div><small>${esc(n.category||'Thông báo')} · ${dt(n.created_at)}</small><h3>${esc(n.title||'Thông báo')}</h3></div><p>${esc(n.message||'')}</p>${subject?`<div><small>Học phần</small><b>${esc(subject.name)} · ${esc(subject.semester||'')}</b></div>`:''}<div class="notice-detail-actions">${n.target_view?'<button id="v108OpenNoticeTarget" class="primary">'+notificationActionLabel(n)+'</button>':''}<button id="v108UnreadNotice" class="secondary">Đánh dấu chưa đọc</button></div></div>`);
 $('#v108OpenNoticeTarget')?.addEventListener('click',()=>{closeDrawer();if(n.subject_id&&['structure','questions','exams','results','users','dashboard'].includes(n.target_view)){window.v95EnterCourse?.(n.subject_id,n.target_view)}else navigate(n.target_view||'notifications')});
 $('#v108UnreadNotice').onclick=async()=>{await db.from('notifications').update({read_at:null}).eq('id',n.id);closeDrawer();refreshNotificationData?.(true);if(state.view==='notifications')render()};
}
window.openNotification=async function(id,items=[]){const n=items.find(x=>x.id===id);if(n)await openNoticeDetail(n)};

async function recentActivities(userId,limit=12){try{return await q('activity_logs','action,summary,created_at,subject_id,status',x=>x.eq('user_id',userId).order('created_at',{ascending:false}).limit(limit))}catch{return []}}
async function profileSubjects(userId){try{const ms=await q('subject_members','subject_id,role',x=>x.eq('user_id',userId));return ms.map(m=>({member:m,subject:state.subjects.find(s=>s.id===m.subject_id)})).filter(x=>x.subject)}catch{return []}}
async function studentCourseStats(userId,subjectId){
 try{const exams=await q('exams','id,title',x=>x.eq('subject_id',subjectId));const ids=exams.map(e=>e.id);if(!ids.length)return {attempts:[],exams};const attempts=await q('exam_attempts','id,exam_id,attempt_number,score,started_at,submitted_at',x=>x.eq('student_id',userId).in('exam_id',ids).order('created_at',{ascending:false}));return {attempts,exams}}catch{return {attempts:[],exams:[]}}
}
async function openStudentCourseProfile(p,s){
 const data=await studentCourseStats(p.id,s.id),done=data.attempts.filter(a=>a.submitted_at),avg=done.reduce((a,b)=>a+Number(b.score||0),0)/(done.length||1);pushDrawer(`${p.full_name} · ${s.name}`,`<div class="profile-page-v108"><div class="v108-stat-grid"><div class="v108-stat"><small>Bài đã làm</small><b>${new Set(done.map(a=>a.exam_id)).size}</b></div><div class="v108-stat"><small>Lượt đã nộp</small><b>${done.length}</b></div><div class="v108-stat"><small>Điểm trung bình</small><b>${done.length?avg.toFixed(2):'—'}</b></div><div class="v108-stat"><small>Lần làm gần nhất</small><b style="font-size:15px">${done[0]?dt(done[0].submitted_at):'—'}</b></div></div><section class="panel"><div class="panel-head"><h3>Bài kiểm tra gần đây</h3></div><div class="profile-timeline-v108">${done.slice(0,8).map(a=>`<article><b>${esc(data.exams.find(e=>e.id===a.exam_id)?.title||'Bài kiểm tra')}</b><span> · Điểm ${esc(a.score??'—')}</span><small>Lần ${esc(a.attempt_number||'—')} · ${dt(a.submitted_at)}</small></article>`).join('')||'<p class="hint">Chưa có bài kiểm tra đã nộp.</p>'}</div></section></div>`);
}
async function openUserProfile(p){
 if(!p)return;const joined=await profileSubjects(p.id),acts=await recentActivities(p.id),lastLogin=acts.find(a=>a.action==='login')?.created_at;const r=p.role;
 openDrawer(`Hồ sơ · ${p.full_name||p.email}`,`<div class="profile-page-v108"><section class="profile-hero-v108"><div class="profile-avatar-v108">${esc((p.full_name||p.email||'?').trim().charAt(0).toUpperCase())}</div><div class="profile-identity-v108"><h3>${esc(p.full_name||'Chưa đặt tên')}</h3><p>${esc(p.email||'')}${p.mssv?` · ${esc(p.mssv)}`:''}</p><span class="profile-role-v108">${esc(roleText(r))}</span></div></section><div class="v108-stat-grid"><div class="v108-stat"><small>Học phần</small><b>${joined.length}</b></div><div class="v108-stat"><small>Trạng thái</small><b style="font-size:17px">${p.is_active===false?'Đã khóa':'Hoạt động'}</b></div><div class="v108-stat"><small>Đăng nhập gần đây</small><b style="font-size:15px">${dt(lastLogin)}</b></div><div class="v108-stat"><small>Vai trò</small><b style="font-size:17px">${esc(roleText(r))}</b></div></div><div class="profile-grid-v108"><section class="panel"><div class="panel-head"><h3>${r==='student'?'Lớp / học phần đang học':isTeacherRole(r)?'Học phần phụ trách':'Học phần liên quan'}</h3></div>${joined.map(x=>`<button class="profile-course-v108" data-profile-course="${x.subject.id}"><b>${esc(x.subject.name)}</b><small>${esc(x.subject.semester||'')} · ${esc(x.subject.academic_year||'')} · ${esc(roleText(x.member.role))}</small></button>`).join('')||'<p class="hint">Chưa có học phần.</p>'}</section><section class="panel"><div class="panel-head"><h3>Hoạt động gần đây</h3></div><div class="profile-timeline-v108">${acts.slice(0,12).map(a=>`<article><b>${esc(a.summary||a.action)}</b><small>${dt(a.created_at)}</small></article>`).join('')||'<p class="hint">Chưa có hoạt động được ghi nhận.</p>'}</div></section></div></div>`,null,{wide:true});
 $$('[data-profile-course]',$('#drawerBody')).forEach(b=>b.onclick=()=>{const s=state.subjects.find(x=>x.id===b.dataset.profileCourse);if(!s)return;if(r==='student')openStudentCourseProfile(p,s);else window.v95EnterCourse?.(s.id,'dashboard')});
}
window.AICLO_V108={version:V,openUserProfile,openNoticeDetail};

function enhanceUserLists(){
 const root=$('#content');if(!root)return;$$('#userRows tr,#classMemberRows tr,#classRows tr',root).forEach(tr=>{const cell=tr.querySelector('td');const bold=cell?.querySelector('b');if(!bold||cell.querySelector('.user-name-link-v108'))return;let id=tr.querySelector('[data-manage-user]')?.dataset.manageUser||tr.querySelector('[data-profile]')?.dataset.profile||tr.querySelector('[data-ai]')?.dataset.ai;if(!id)return;const text=bold.textContent;const btn=document.createElement('button');btn.type='button';btn.className='user-name-link-v108';btn.textContent=text;btn.onclick=async()=>{try{let rows=await q('profiles','*',x=>x.eq('id',id).limit(1));openUserProfile(rows[0])}catch(ex){err(ex)}};bold.replaceWith(btn)})
}
const oldRender=window.render;
window.render=async function(){await oldRender();setContextBadge();setupAppAi();makeMiniUserClickable();enhanceUserLists()};

document.addEventListener('DOMContentLoaded',()=>{document.documentElement.dataset.aicloVersion=V;setupMobileShell();setupAppAi();setContextBadge();setTimeout(makeMiniUserClickable,250)});
})();
