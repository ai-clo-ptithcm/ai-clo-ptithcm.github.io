/* AI-CLO PTITHCM v10.5.3 — admin role filter. */
(() => {
'use strict';

const V='10.5.3';

const oldUsers=window.users;
window.users=async function(c){
 if(role()!=='admin')return oldUsers(c);
 let [profiles,members]=await Promise.all([q('profiles','*',x=>x.order('full_name')),q('subject_members','*')]);
 const roleLabel=r=>r==='admin'?'Admin':(['teacher','lecturer','giangvien'].includes(r)?'Giảng viên':'Sinh viên');
 c.innerHTML=`<div class="stats" id="userStats"></div><div class="toolbar user-toolbar v1053-user-toolbar"><input id="userSearch" placeholder="Tìm theo họ tên, email hoặc MSSV…"><select id="userRole"><option value="all">Tất cả vai trò</option><option value="admin">Admin</option><option value="teacher">Giảng viên</option><option value="student">Sinh viên</option></select><select id="userSubject"><option value="all">Tất cả người dùng</option>${state.subjects.map(s=>`<option value="${s.id}">${esc(s.name)} · ${esc(s.semester)}</option>`).join('')}</select><select id="userStatus"><option value="all">Tất cả trạng thái</option><option value="active">Đang hoạt động</option><option value="locked">Đã khóa</option></select><button id="manageClass" class="secondary" disabled>Quản lý lớp</button><button id="importUsers" class="secondary">Nhập CSV</button><button id="addUser" class="primary">+ Thêm người dùng</button></div><div class="panel table-wrap"><table><thead><tr><th>Họ tên</th><th>Email / MSSV</th><th>Vai trò</th><th>Trạng thái</th><th id="membershipHeading">Học phần</th><th></th></tr></thead><tbody id="userRows"></tbody></table></div>`;
 const roleMatch=(p,want)=>want==='all'||(want==='teacher'?['teacher','lecturer','giangvien'].includes(p.role):p.role===want);
 const draw=()=>{
  let s=$('#userSearch').value.toLowerCase(),status=$('#userStatus').value,roleFilter=$('#userRole').value,subjectId=$('#userSubject').value,subjectMembers=subjectId==='all'?members:members.filter(m=>m.subject_id===subjectId),memberIds=new Set(subjectMembers.map(m=>m.user_id)),base=subjectId==='all'?profiles:profiles.filter(p=>memberIds.has(p.id));
  let list=base.filter(p=>[p.full_name,p.email,p.mssv].some(v=>String(v||'').toLowerCase().includes(s))).filter(p=>roleMatch(p,roleFilter)).filter(p=>status==='all'||(status==='active'?p.is_active!==false:p.is_active===false));
  let teachers=base.filter(p=>['teacher','lecturer','giangvien'].includes(p.role)).length,students=base.filter(p=>p.role==='student').length,admins=base.filter(p=>p.role==='admin').length,locked=base.filter(p=>p.is_active===false).length;
  $('#userStats').innerHTML=`<div class="stat"><small>${subjectId==='all'?'Tổng tài khoản':'Tổng thành viên'}</small><b>${base.length}</b></div><div class="stat"><small>Giảng viên</small><b>${teachers}</b></div><div class="stat"><small>Sinh viên</small><b>${students}</b></div><div class="stat"><small>Admin</small><b>${admins}</b></div><div class="stat"><small>Đang bị khóa</small><b>${locked}</b></div>`;
  $('#manageClass').disabled=subjectId==='all';$('#membershipHeading').textContent=subjectId==='all'?'Học phần':'Vai trò trong lớp';
  $('#userRows').innerHTML=list.map(p=>{let membership=subjectId==='all'?members.filter(m=>m.user_id===p.id).length:(subjectMembers.find(m=>m.user_id===p.id)?.role||'—');return `<tr class="${p.is_active===false?'account-locked':''}"><td><b>${esc(p.full_name)}</b>${p.id===state.user.id?' <span class="badge">Bạn</span>':''}</td><td>${esc(p.email)}<br><small>${esc(p.mssv||'')}</small></td><td><span class="badge ${p.role==='student'?'green':'red'}">${esc(roleLabel(p.role))}</span></td><td><span class="badge ${p.is_active===false?'red':'green'}">${p.is_active===false?'Đã khóa':'Hoạt động'}</span></td><td>${esc(membership)}</td><td class="row-actions"><button class="primary compact-manage" data-manage-user="${p.id}">Quản lý</button></td></tr>`}).join('')||'<tr><td colspan="6" class="empty">Không có tài khoản phù hợp.</td></tr>';
 };
 draw();
 $('#userSearch').oninput=draw;$('#userRole').onchange=draw;$('#userStatus').onchange=draw;$('#userSubject').onchange=draw;
 $('#userRows').onclick=e=>{let b=e.target.closest('[data-manage-user]');if(!b)return;let p=profiles.find(x=>x.id===b.dataset.manageUser);if(p)userDetail(p,members)};
 $('#addUser').onclick=()=>manualUserForm();$('#importUsers').onclick=csvUserForm;$('#manageClass').onclick=()=>{let subjectId=$('#userSubject').value;if(subjectId!=='all')classManager(profiles,members,subjectId)};
};

window.AICLO_V1053={version:V};
document.addEventListener('DOMContentLoaded',()=>{document.documentElement.dataset.aicloVersion=V});
})();
