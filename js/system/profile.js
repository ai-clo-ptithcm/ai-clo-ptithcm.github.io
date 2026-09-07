/* AI-CLO PTITHCM V12.6.20 — canonical profile/account owner. */
(() => {
'use strict';

const teacherRoles=['teacher','lecturer','giangvien'];
const isTeacherRole=r=>teacherRoles.includes(r);
const roleText=r=>r==='admin'?'Quản trị viên':isTeacherRole(r)?'Giảng viên':'Sinh viên';
const dt=v=>v?new Intl.DateTimeFormat('vi-VN',{timeZone:'Asia/Ho_Chi_Minh',dateStyle:'short',timeStyle:'short'}).format(new Date(v)):'—';
const closeMobileSidebar=()=>window.AICLO_MOBILE_SHELL?.close?.();
const safe=async(fn,fallback=[])=>{try{return await fn()}catch{return fallback}};
const stat=(k,v)=>`<article class="v109-stat"><small>${esc(k)}</small><b>${esc(v)}</b></article>`;

async function recentActivities(userId,limit=12){
 return safe(()=>q('activity_logs','action,summary,created_at,subject_id,status',x=>x.eq('user_id',userId).order('created_at',{ascending:false}).limit(limit)),[]);
}

async function profileSubjects(userId){
 const ms=await safe(()=>q('subject_members','subject_id,role',x=>x.eq('user_id',userId)),[]);
 return ms.map(m=>({member:m,subject:state.subjects.find(s=>s.id===m.subject_id)})).filter(x=>x.subject);
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
 const data=await studentCourseStats(p.id,s.id),done=data.attempts.filter(a=>a.submitted_at),avg=done.length?done.reduce((a,b)=>a+Number(b.score||0),0)/done.length:null;
 openDrawer(`Hồ sơ học tập · ${p.full_name||p.email||'Sinh viên'}`,`<div class="v109-profile"><section class="v109-profile-head"><div>${esc((p.full_name||p.email||'?')[0].toUpperCase())}</div><span><small>${esc(s.name)}</small><h3>${esc(p.full_name||'Chưa đặt tên')}</h3><p>${esc(p.mssv||p.email||'')}</p></span></section><div class="v109-stats">${stat('Bài đã làm',new Set(done.map(x=>x.exam_id)).size)}${stat('Lượt đã nộp',done.length)}${stat('Điểm trung bình',avg===null?'—':avg.toFixed(2))}</div><section class="panel"><h3>Bài kiểm tra gần đây</h3>${done.slice(0,8).map(a=>`<p><b>${esc(data.exams.find(e=>e.id===a.exam_id)?.title||'Bài kiểm tra')}</b><span> · Điểm ${esc(a.score??'—')}</span><small> · ${dt(a.submitted_at)}</small></p>`).join('')||'<p class="hint">Chưa có bài đã nộp.</p>'}</section><p class="hint">Hồ sơ này chỉ hiển thị dữ liệu trong học phần hiện tại.</p></div>`,null,{wide:true});
}

async function openOwnProfile(){
 const p=state.profile;if(!p)return;
 closeMobileSidebar();
 const joined=await profileSubjects(p.id),courses=joined.map(x=>x.subject),r=p.role;
 openDrawer('Hồ sơ của tôi',`<div class="v109-profile"><section class="v109-profile-head"><div>${esc((p.full_name||p.email||'?')[0].toUpperCase())}</div><span><h3>${esc(p.full_name||'Chưa đặt tên')}</h3><p>${esc(p.email||'')}${p.mssv?` · ${esc(p.mssv)}`:''}</p><b>${esc(roleText(r))}</b></span></section><div class="v109-stats">${stat('Học phần',courses.length)}${stat('Trạng thái',p.is_active===false?'Đã khóa':'Hoạt động')}${stat('Vai trò',roleText(r))}</div><section class="panel"><div class="panel-head"><h3>${r==='student'?'Học phần đang học':isTeacherRole(r)?'Học phần phụ trách':'Học phần liên quan'}</h3></div>${joined.map(x=>`<button class="v109-profile-course" data-own-course="${x.subject.id}"><b>${esc(x.subject.name)}</b><small>${esc(x.subject.semester||'')} · ${esc(x.subject.academic_year||'')}</small></button>`).join('')||'<p class="hint">Chưa có học phần.</p>'}</section><section class="panel v109-security"><div><h3>Tài khoản và bảo mật</h3><p>Thay đổi thông tin được phép của tài khoản đang đăng nhập.</p></div><div>${r==='admin'||isTeacherRole(r)?'<button id="profileChangeName" class="secondary">Đổi họ tên</button>':''}<button id="profileChangePassword" class="primary">Đổi mật khẩu</button></div></section><div class="v109-profile-actions"><button id="profileLogout" class="secondary">Đăng xuất</button></div></div>`,root=>{
  $$('[data-own-course]',root).forEach(b=>b.onclick=()=>{closeDrawer();window.v95EnterCourse?.(b.dataset.ownCourse)});
  $('#profileChangeName',root)?.addEventListener('click',changeOwnName);
  $('#profileChangePassword',root).onclick=changeOwnPassword;
  $('#profileLogout',root).onclick=()=>$('#logoutBtn')?.click();
 },{wide:true});
}

function changeOwnName(){
 const current=state.profile?.full_name||'';
 pushDrawer('Đổi họ tên',`<form id="profileNameForm" class="v109-account-form"><p class="hint">Họ tên này được dùng trong hồ sơ và giao diện hệ thống. Email, vai trò và mã sinh viên không thay đổi.</p><label class="field">Họ và tên<input name="full_name" value="${esc(current)}" required minlength="2" maxlength="120" autocomplete="name"></label><div class="form-actions"><button type="button" class="secondary" id="profileCancelName">Hủy</button><button class="primary" id="profileSaveName">Lưu họ tên</button></div></form>`,root=>{
  $('#profileCancelName',root).onclick=backDrawer;
  $('#profileNameForm',root).onsubmit=async e=>{e.preventDefault();const name=String(new FormData(e.target).get('full_name')||'').trim().replace(/\s+/g,' ');if(name.length<2)return toast('Họ tên chưa hợp lệ',true);const btn=$('#profileSaveName',root);btn.disabled=true;btn.textContent='Đang lưu…';const {data,error}=await db.from('profiles').update({full_name:name}).eq('id',state.user.id).select().single();if(error){btn.disabled=false;btn.textContent='Lưu họ tên';return err(error)}state.profile=data;$('#miniUser').innerHTML=`<b>${esc(data.full_name)}</b><br>${esc(data.email)} · ${esc(data.role)}`;window.logActivity?.('update_profile','profile',state.user.id,`Đổi họ tên từ ${current||'chưa đặt'} thành ${name}`);toast('Đã cập nhật họ tên');openOwnProfile()};
 },{eyebrow:'HỒ SƠ CỦA TÔI'});
}

function changeOwnPassword(){
 pushDrawer('Đổi mật khẩu',`<form id="profilePasswordForm" class="v109-account-form"><p class="hint">Mật khẩu mới cần có ít nhất 8 ký tự, gồm chữ và số.</p><label class="field">Mật khẩu mới<div class="v109-password-input"><input id="profileNewPassword" name="password" type="password" required minlength="8" autocomplete="new-password"><button type="button" data-toggle-password="profileNewPassword" aria-label="Hiện hoặc ẩn mật khẩu">👁</button></div></label><label class="field">Nhập lại mật khẩu<div class="v109-password-input"><input id="profileConfirmPassword" name="confirm_password" type="password" required minlength="8" autocomplete="new-password"><button type="button" data-toggle-password="profileConfirmPassword" aria-label="Hiện hoặc ẩn mật khẩu">👁</button></div></label><div class="form-actions"><button type="button" class="secondary" id="profileCancelPassword">Hủy</button><button class="primary" id="profileSavePassword">Đổi mật khẩu</button></div></form>`,root=>{
  $('#profileCancelPassword',root).onclick=backDrawer;
  $$('[data-toggle-password]',root).forEach(b=>b.onclick=()=>{const input=$('#'+b.dataset.togglePassword,root);input.type=input.type==='password'?'text':'password'});
  $('#profilePasswordForm',root).onsubmit=async e=>{e.preventDefault();const v=Object.fromEntries(new FormData(e.target)),password=String(v.password||'');if(password.length<8||!/[A-Za-zÀ-ỹ]/.test(password)||!/[0-9]/.test(password))return toast('Mật khẩu cần ít nhất 8 ký tự, gồm chữ và số',true);if(password!==v.confirm_password)return toast('Hai lần nhập mật khẩu chưa khớp',true);const btn=$('#profileSavePassword',root);btn.disabled=true;btn.textContent='Đang cập nhật…';const {error}=await db.auth.updateUser({password});if(error){btn.disabled=false;btn.textContent='Đổi mật khẩu';return err(error)}window.logActivity?.('change_password','session',state.user.id,'Đổi mật khẩu tài khoản');toast('Đổi mật khẩu thành công');openOwnProfile()};
 },{eyebrow:'BẢO MẬT TÀI KHOẢN'});
}

async function openAdminProfile(p){
 const joined=await profileSubjects(p.id),acts=await recentActivities(p.id,10);
 openDrawer(`Quản lý tài khoản · ${p.full_name||p.email}`,`<div class="v109-profile"><section class="v109-profile-head"><div>${esc((p.full_name||p.email||'?')[0].toUpperCase())}</div><span><h3>${esc(p.full_name||'Chưa đặt tên')}</h3><p>${esc(p.email||'')}${p.mssv?` · ${esc(p.mssv)}`:''}</p><b>${esc(roleText(p.role))}</b></span></section><div class="v109-stats">${stat('Học phần',joined.length)}${stat('Trạng thái',p.is_active===false?'Đã khóa':'Hoạt động')}${stat('Vai trò',roleText(p.role))}</div><section class="panel"><h3>Phân công học phần</h3>${joined.map(x=>`<p><b>${esc(x.subject.name)}</b> · ${esc(roleText(x.member.role))}</p>`).join('')||'<p class="hint">Chưa được phân công.</p>'}</section><section class="panel"><h3>Hoạt động quản trị gần đây</h3>${acts.map(a=>`<p><b>${esc(a.summary||a.action)}</b><small> · ${dt(a.created_at)}</small></p>`).join('')||'<p class="hint">Chưa có hoạt động.</p>'}</section></div>`,null,{wide:true});
}

async function openContextProfile(id){
 if(!id)return;
 const rows=await safe(()=>q('profiles','*',x=>x.eq('id',id).limit(1)),[]),p=rows[0];
 if(!p)return toast('Không tìm thấy hồ sơ',true);
 if(p.id===state.user?.id)return openOwnProfile();
 if(role()==='admin')return openAdminProfile(p);
 if(canTeach()&&state.space==='course'&&p.role==='student'){
  const s=activeSubject();if(!s)return toast('Chưa chọn học phần',true);
  return openStudentCourseProfile(p,s);
 }
 toast('Bạn không có quyền mở hồ sơ này',true);
}

function bindMiniUser(){
 const box=$('#miniUser');if(!box||box.dataset.profileOwner==='12.6.20')return;
 box.dataset.profileOwner='12.6.20';
 box.classList.add('mini-user-button-v108');
 box.setAttribute('role','button');box.setAttribute('tabindex','0');box.title='Mở hồ sơ cá nhân';
 /* COMPATIBILITY TEMPORARY: final-layer.js still assigns a legacy onclick during render.
    This target-level capture guard keeps the canonical Profile owner active until Shell/Nav refactor removes final-layer.js. */
 box.addEventListener('click',e=>{e.preventDefault();e.stopImmediatePropagation();openOwnProfile()},true);
 box.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();e.stopImmediatePropagation();openOwnProfile()}},true);
}

function bindProfileLinks(root=document){
 $$('[data-aiclo-profile]',root).forEach(b=>{
  if(b.dataset.profileBound==='1')return;b.dataset.profileBound='1';
  b.addEventListener('click',e=>{e.preventDefault();openContextProfile(b.dataset.aicloProfile)});
 });
}

function enhanceUserLists(){bindProfileLinks($('#content')||document)}

document.addEventListener('DOMContentLoaded',()=>{bindMiniUser();bindProfileLinks()});
window.addEventListener('pageshow',()=>bindMiniUser());

window.AICLO_PROFILE=Object.freeze({
 version:'12.6.20',
 openOwnProfile,
 openUserProfile:openContextProfile,
 openContextProfile,
 openStudentCourseProfile,
 openAdminProfile,
 bindMiniUser,
 bindProfileLinks,
 enhanceUserLists
});
})();
