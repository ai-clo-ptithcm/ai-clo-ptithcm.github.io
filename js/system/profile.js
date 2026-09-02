/* AI-CLO PTITHCM V11 — user profiles extracted from legacy V10.8. */
(() => {
'use strict';

const teacherRoles=['teacher','lecturer','giangvien'];
const isTeacherRole=r=>teacherRoles.includes(r);
const roleText=r=>r==='admin'?'Quản trị viên':isTeacherRole(r)?'Giảng viên':'Sinh viên';
const dt=v=>v?new Intl.DateTimeFormat('vi-VN',{timeZone:'Asia/Ho_Chi_Minh',dateStyle:'short',timeStyle:'short'}).format(new Date(v)):'—';
const closeMobileSidebar=()=>window.AICLO_MOBILE_SHELL?.close?.();

async function recentActivities(userId,limit=12){
 try{return await q('activity_logs','action,summary,created_at,subject_id,status',x=>x.eq('user_id',userId).order('created_at',{ascending:false}).limit(limit))}
 catch{return []}
}

async function profileSubjects(userId){
 try{
  const ms=await q('subject_members','subject_id,role',x=>x.eq('user_id',userId));
  return ms.map(m=>({member:m,subject:state.subjects.find(s=>s.id===m.subject_id)})).filter(x=>x.subject);
 }catch{return []}
}

async function studentCourseStats(userId,subjectId){
 try{
  const exams=await q('exams','id,title',x=>x.eq('subject_id',subjectId));
  const ids=exams.map(e=>e.id);
  if(!ids.length)return {attempts:[],exams};
  const attempts=await q('exam_attempts','id,exam_id,attempt_number,score,started_at,submitted_at',x=>x.eq('student_id',userId).in('exam_id',ids).order('created_at',{ascending:false}));
  return {attempts,exams};
 }catch{return {attempts:[],exams:[]}}
}

async function openStudentCourseProfile(p,s){
 closeMobileSidebar();
 const data=await studentCourseStats(p.id,s.id),done=data.attempts.filter(a=>a.submitted_at),avg=done.reduce((a,b)=>a+Number(b.score||0),0)/(done.length||1);
 pushDrawer(`${p.full_name} · ${s.name}`,`<div class="profile-page-v108"><div class="v108-stat-grid"><div class="v108-stat"><small>Bài đã làm</small><b>${new Set(done.map(a=>a.exam_id)).size}</b></div><div class="v108-stat"><small>Lượt đã nộp</small><b>${done.length}</b></div><div class="v108-stat"><small>Điểm trung bình</small><b>${done.length?avg.toFixed(2):'—'}</b></div><div class="v108-stat"><small>Lần làm gần nhất</small><b style="font-size:15px">${done[0]?dt(done[0].submitted_at):'—'}</b></div></div><section class="panel"><div class="panel-head"><h3>Bài kiểm tra gần đây</h3></div><div class="profile-timeline-v108">${done.slice(0,8).map(a=>`<article><b>${esc(data.exams.find(e=>e.id===a.exam_id)?.title||'Bài kiểm tra')}</b><span> · Điểm ${esc(a.score??'—')}</span><small>Lần ${esc(a.attempt_number||'—')} · ${dt(a.submitted_at)}</small></article>`).join('')||'<p class="hint">Chưa có bài kiểm tra đã nộp.</p>'}</div></section></div>`);
}

async function openUserProfile(p){
 if(!p)return;
 closeMobileSidebar();
 const joined=await profileSubjects(p.id),acts=await recentActivities(p.id),lastLogin=acts.find(a=>a.action==='login')?.created_at,r=p.role;
 openDrawer(`Hồ sơ · ${p.full_name||p.email}`,`<div class="profile-page-v108"><section class="profile-hero-v108"><div class="profile-avatar-v108">${esc((p.full_name||p.email||'?').trim().charAt(0).toUpperCase())}</div><div class="profile-identity-v108"><h3>${esc(p.full_name||'Chưa đặt tên')}</h3><p>${esc(p.email||'')}${p.mssv?` · ${esc(p.mssv)}`:''}</p><span class="profile-role-v108">${esc(roleText(r))}</span></div></section><div class="v108-stat-grid"><div class="v108-stat"><small>Học phần</small><b>${joined.length}</b></div><div class="v108-stat"><small>Trạng thái</small><b style="font-size:17px">${p.is_active===false?'Đã khóa':'Hoạt động'}</b></div><div class="v108-stat"><small>Đăng nhập gần đây</small><b style="font-size:15px">${dt(lastLogin)}</b></div><div class="v108-stat"><small>Vai trò</small><b style="font-size:17px">${esc(roleText(r))}</b></div></div><div class="profile-grid-v108"><section class="panel"><div class="panel-head"><h3>${r==='student'?'Lớp / học phần đang học':isTeacherRole(r)?'Học phần phụ trách':'Học phần liên quan'}</h3></div>${joined.map(x=>`<button class="profile-course-v108" data-profile-course="${x.subject.id}"><b>${esc(x.subject.name)}</b><small>${esc(x.subject.semester||'')} · ${esc(x.subject.academic_year||'')} · ${esc(roleText(x.member.role))}</small></button>`).join('')||'<p class="hint">Chưa có học phần.</p>'}</section><section class="panel"><div class="panel-head"><h3>Hoạt động gần đây</h3></div><div class="profile-timeline-v108">${acts.slice(0,12).map(a=>`<article><b>${esc(a.summary||a.action)}</b><small>${dt(a.created_at)}</small></article>`).join('')||'<p class="hint">Chưa có hoạt động được ghi nhận.</p>'}</div></section></div></div>`,null,{wide:true});
 $$('[data-profile-course]',$('#drawerBody')).forEach(b=>b.onclick=()=>{
  const s=state.subjects.find(x=>x.id===b.dataset.profileCourse);if(!s)return;
  if(r==='student')openStudentCourseProfile(p,s);
  else window.v95EnterCourse?.(s.id,'dashboard');
 });
}

function makeMiniUserClickable(){
 const box=$('#miniUser');if(!box)return;
 box.classList.add('mini-user-button-v108');
 box.setAttribute('role','button');
 box.setAttribute('tabindex','0');
 box.title='Mở hồ sơ cá nhân';
 const go=()=>openUserProfile(state.profile);
 box.onclick=go;
 box.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();go()}};
}

function enhanceUserLists(){
 const root=$('#content');if(!root)return;
 $$('#userRows tr,#classMemberRows tr,#classRows tr',root).forEach(tr=>{
  const cell=tr.querySelector('td'),bold=cell?.querySelector('b');
  if(!bold||cell.querySelector('.user-name-link-v108'))return;
  const id=tr.querySelector('[data-manage-user]')?.dataset.manageUser||tr.querySelector('[data-profile]')?.dataset.profile||tr.querySelector('[data-ai]')?.dataset.ai;
  if(!id)return;
  const text=bold.textContent,btn=document.createElement('button');
  btn.type='button';btn.className='user-name-link-v108';btn.textContent=text;
  btn.onclick=async()=>{try{closeMobileSidebar();const rows=await q('profiles','*',x=>x.eq('id',id).limit(1));openUserProfile(rows[0])}catch(ex){err(ex)}};
  bold.replaceWith(btn);
 });
}

window.AICLO_PROFILE=Object.freeze({openUserProfile,openStudentCourseProfile,makeMiniUserClickable,enhanceUserLists});
})();
