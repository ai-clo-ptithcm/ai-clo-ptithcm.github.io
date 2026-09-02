/* AI-CLO PTITHCM V10.8 — system/course context and shell integration. */
(() => {
'use strict';
const V='10.8';
const teacherRoles=['teacher','lecturer','giangvien'];
const isTeacherRole=r=>teacherRoles.includes(r);
const roleText=r=>r==='admin'?'Quản trị viên':isTeacherRole(r)?'Giảng viên':'Sinh viên';

function setContextBadge(){
 const heading=$('.page-heading');if(!heading)return;
 let badge=$('#v108ContextBadge');if(!badge){badge=document.createElement('span');badge.id='v108ContextBadge';badge.className='app-context-badge';heading.append(badge)}
 if(state.space==='course'&&activeSubject()){
  const s=activeSubject();badge.classList.add('course');badge.textContent=`${s.name} · ${s.semester||''}`;
 }else{badge.classList.remove('course');badge.textContent='HỆ THỐNG'}
}
function setupAppAi(){
 const header=$('.app main>header');if(!header||$('#appAiButton'))return;
 const bell=$('#notificationBell');const b=document.createElement('button');b.id='appAiButton';b.type='button';b.className='app-ai-button';b.innerHTML='<span>💬</span> Hỏi AI-CLO';b.title='Hỏi AI-CLO';
 header.insertBefore(b,bell||null);b.onclick=()=>window.AICLO_CHAT?.open?.({role:role(),view:state.view,space:state.space,subject:activeSubject()?.name||''});
}
const openUserProfile=p=>window.AICLO_PROFILE?.openUserProfile?.(p);
const makeMiniUserClickable=()=>window.AICLO_PROFILE?.makeMiniUserClickable?.();
const enhanceUserLists=()=>window.AICLO_PROFILE?.enhanceUserLists?.();

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

window.AICLO_V108={version:V,openUserProfile,openNoticeDetail:window.AICLO_NOTIFICATION_DETAIL?.openNoticeDetail};

const oldRender=window.render;
window.render=async function(){await oldRender();setContextBadge();setupAppAi();makeMiniUserClickable();enhanceUserLists()};

document.addEventListener('DOMContentLoaded',()=>{document.documentElement.dataset.aicloVersion=V;setupAppAi();setContextBadge();setTimeout(makeMiniUserClickable,250)});
})();
