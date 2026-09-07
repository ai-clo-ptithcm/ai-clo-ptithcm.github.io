/* AI-CLO PTITHCM V12.6.26-kiemnghiem — system-wide account management. */
(() => {
'use strict';
const oldUsers=window.users,teacherRoles=['teacher','lecturer','giangvien'];
const roleText=r=>r==='admin'?'Admin':teacherRoles.includes(r)?'Giảng viên':'Sinh viên';
const recent=v=>{if(!v)return'Chưa từng đăng nhập';let s=Math.max(0,(Date.now()-new Date(v))/1000);if(s<90)return'Vừa xong';if(s<3600)return`${Math.floor(s/60)} phút trước`;if(s<86400)return`${Math.floor(s/3600)} giờ trước`;if(s<172800)return'Hôm qua';if(s<2592000)return`${Math.floor(s/86400)} ngày trước`;return new Date(v).toLocaleDateString('vi-VN')};
const isTemporaryEmail=email=>String(email||'').trim().toLowerCase().endsWith('@aiclo.local');
const temporaryEmailFromMssv=mssv=>{const local=String(mssv||'').trim().toLowerCase().replace(/[^a-z0-9._-]+/g,'');return local?`${local}@aiclo.local`:''};
const canonicalRole=r=>teacherRoles.includes(r)?'teacher':r;
function prepareAccountForCreate(raw={}){
 const role=String(raw.role||'').trim(),mssv=String(raw.mssv||'').trim();
 let email=String(raw.email||'').trim().toLowerCase();
 if(!email&&role==='student'&&mssv)email=temporaryEmailFromMssv(mssv);
 return {...raw,email,mssv:mssv||null};
}
function heading(){ $('#pageTitle').textContent='Quản lý người dùng';$('#pageSub').textContent='Tạo tài khoản, phân quyền, khóa và quản lý người dùng toàn hệ thống' }
const back=()=>'<button type="button" class="secondary" id="userPageBack">← Quay lại danh sách người dùng</button>';

const userPageStateKey=()=>`aiclo_users_page_v1:${state.user?.id||'guest'}`;
function readUserPageState(){try{return JSON.parse(sessionStorage.getItem(userPageStateKey())||'{}')||{}}catch{return{}}}
function writeUserPageState(next){try{sessionStorage.setItem(userPageStateKey(),JSON.stringify({...readUserPageState(),...next}))}catch{}}
function clearUserPageState(){try{sessionStorage.removeItem(userPageStateKey())}catch{}}
function createDraftFromForm(form){
 const v=Object.fromEntries(new FormData(form));
 return {full_name:String(v.full_name||''),email:String(v.email||''),role:String(v.role||'teacher'),mssv:String(v.mssv||'')};
}

function createPage(c,onBack){
 heading();
 const saved=readUserPageState(),savedDraft=saved.page==='create'&&saved.draft?saved.draft:{},startTab=saved.page==='create'&&saved.tab==='csv'?'csv':'single';
 writeUserPageState({page:'create',tab:startTab,draft:savedDraft});
 c.innerHTML=`<div class="user-subpage-head">${back()}<div><h3>Thêm tài khoản</h3><p>Tạo một tài khoản hoặc nhập đồng thời nhiều tài khoản từ CSV.</p></div></div><div class="user-create-tabs"><button class="active" data-create-tab="single">Tạo một tài khoản</button><button data-create-tab="csv">Nhập danh sách CSV</button></div><section class="panel user-create-panel" id="userCreateBody"></section>`;
 $('#userPageBack').onclick=()=>{clearUserPageState();onBack()};
 const activate=t=>$$('[data-create-tab]',c).forEach(b=>b.classList.toggle('active',b.dataset.createTab===t));
 const single=()=>{
  activate('single');
  const s=readUserPageState(),d=s.draft||{},selected=['admin','teacher','student'].includes(d.role)?d.role:'teacher';
  writeUserPageState({page:'create',tab:'single',draft:d});
  $('#userCreateBody').innerHTML=`<form id="inlineNewUser" class="form-grid user-inline-form"><label class="field wide">Họ và tên<input name="full_name" required value="${esc(d.full_name||'')}"></label><label class="field wide">Email đăng nhập<input name="email" type="email" value="${esc(d.email||'')}" placeholder="Có thể để trống với sinh viên đã có MSSV"><small>Nếu sinh viên chưa có email, để trống để hệ thống tự tạo <b>MSSV@aiclo.local</b>.</small></label><label class="field">Vai trò<select name="role" id="inlineNewRole"><option value="teacher" ${selected==='teacher'?'selected':''}>Giảng viên</option><option value="student" ${selected==='student'?'selected':''}>Sinh viên</option><option value="admin" ${selected==='admin'?'selected':''}>Admin</option></select></label><label class="field">MSSV<input name="mssv" id="inlineNewMssv" placeholder="Bắt buộc đối với sinh viên" value="${esc(d.mssv||'')}"></label><div class="hint wide" id="temporaryEmailPreview"></div><p class="hint wide">Admin có quyền trên toàn hệ thống và không cần thêm vào học phần. Admin không thể hạ quyền, khóa hoặc xóa Admin khác.</p><div class="form-actions"><button class="primary" id="inlineCreateUser">Tạo tài khoản</button></div></form>`;
  const form=$('#inlineNewUser'),roleSelect=$('#inlineNewRole'),mssv=$('#inlineNewMssv'),email=form.elements.email,preview=$('#temporaryEmailPreview');
  const syncPreview=()=>{const temp=roleSelect.value==='student'&&!email.value.trim()?temporaryEmailFromMssv(mssv.value):'';preview.innerHTML=temp?`Email đăng nhập tạm sẽ là <b>${esc(temp)}</b> · Có thể đổi sang email thật sau.`:''};
  const syncDraft=()=>{writeUserPageState({page:'create',tab:'single',draft:createDraftFromForm(form)});syncPreview()};
  const syncRole=()=>{let student=roleSelect.value==='student';mssv.required=student;if(!student)mssv.value='';syncDraft()};
  syncRole();
  form.addEventListener('input',syncDraft);
  roleSelect.onchange=syncRole;
  form.onsubmit=async e=>{e.preventDefault();let b=$('#inlineCreateUser'),v=Object.fromEntries(new FormData(e.target)),account=prepareAccountForCreate({full_name:v.full_name.trim(),email:v.email.trim(),role:v.role,mssv:v.mssv.trim()||null});if(!account.email)return toast('Cần nhập email. Riêng sinh viên có MSSV có thể để trống để dùng email tạm.',true);b.disabled=true;b.textContent='Đang tạo…';try{showAccountResults(await createAccounts([account]));writeUserPageState({page:'create',tab:'single',draft:{}})}catch(x){err(x);b.disabled=false;b.textContent='Tạo tài khoản'}};
 };
 const csv=()=>{
  activate('csv');writeUserPageState({page:'create',tab:'csv'});
  $('#userCreateBody').innerHTML=`<form id="inlineCsvUsers" class="form-grid user-inline-form"><div class="csv-guide wide"><b>Cấu trúc CSV</b><code>full_name,email,role,mssv</code><span>Email có thể để trống đối với sinh viên có MSSV; hệ thống sẽ tự tạo <b>MSSV@aiclo.local</b>. Vai trò dùng <b>admin</b>, <b>teacher</b> hoặc <b>student</b>. Tối đa 100 tài khoản mỗi lần.</span></div><label class="field wide">Chọn file CSV<input id="inlineCsvFile" type="file" accept=".csv,text/csv" required></label><div id="inlineCsvPreview" class="wide"></div><div class="form-actions"><button class="primary" id="inlineCsvSubmit">Tạo các tài khoản</button></div></form>`;
  let parsed=[];$('#inlineCsvFile').onchange=async e=>{try{parsed=parseCsv(await e.target.files[0].text()).map(prepareAccountForCreate);if(parsed.length>100)throw new Error('File có quá 100 người');const tempCount=parsed.filter(x=>isTemporaryEmail(x.email)).length;$('#inlineCsvPreview').innerHTML=`<span class="badge green">Đã đọc ${parsed.length} tài khoản</span>${tempCount?` <span class="badge">${tempCount} email tạm</span>`:''}`}catch(x){parsed=[];err(x)}};
  $('#inlineCsvUsers').onsubmit=async e=>{e.preventDefault();if(!parsed.length)return toast('Chưa có dữ liệu CSV hợp lệ',true);let b=$('#inlineCsvSubmit');b.disabled=true;b.textContent='Đang tạo…';try{showAccountResults(await createAccounts(parsed))}catch(x){err(x);b.disabled=false;b.textContent='Tạo các tài khoản'}};
 };
 $('[data-create-tab="single"]',c).onclick=single;
 $('[data-create-tab="csv"]',c).onclick=csv;
 startTab==='csv'?csv():single();
}

function changeEmailForm(p){
 const oldEmail=String(p.email||'').trim();
 modal('Đổi email tài khoản',`<form id="changeAccountEmailForm" class="form-grid"><p class="hint wide">Email này là tên đăng nhập của tài khoản. Sau khi đổi, người dùng đăng nhập bằng email mới; mật khẩu hiện tại được giữ nguyên.</p><label class="field wide">Email hiện tại<input value="${esc(oldEmail)}" disabled></label><label class="field wide">Email đăng nhập mới<input name="email" type="email" required autocomplete="off" placeholder="tennguoidung@example.com"></label>${isTemporaryEmail(oldEmail)?'<p class="hint wide"><span class="badge">Email tạm</span> Tài khoản hiện dùng email nội bộ @aiclo.local.</p>':''}<div class="form-actions"><button type="button" class="secondary" onclick="document.querySelector('#modal').close()">Hủy</button><button class="primary" id="changeAccountEmailBtn">Đổi email</button></div></form>`);
 const form=$('#changeAccountEmailForm');
 form.onsubmit=async e=>{e.preventDefault();const newEmail=String(new FormData(form).get('email')||'').trim().toLowerCase();if(!newEmail)return;if(newEmail===oldEmail.toLowerCase())return toast('Email mới trùng email hiện tại',true);if(!await confirmAction('Đổi email đăng nhập',`Đổi email của ${p.full_name||'tài khoản'} từ ${oldEmail} sang ${newEmail}?`,{confirmLabel:'Đổi email'}))return;const btn=$('#changeAccountEmailBtn');btn.disabled=true;btn.textContent='Đang đổi…';try{await invokeAdmin({action:'update',user_id:p.id,full_name:p.full_name,email:newEmail,role:canonicalRole(p.role),mssv:p.mssv||null});closeModal();toast('Đã đổi email đăng nhập');window.AICLO_VIEW_TRANSITION?.invalidate?.('users');await render()}catch(ex){err(ex);btn.disabled=false;btn.textContent='Đổi email'}};
}

function managePage(c,p,members,onBack){
 heading();writeUserPageState({page:'manage',userId:p.id});let joined=members.filter(m=>m.user_id===p.id).map(m=>({m,s:state.subjects.find(x=>x.id===m.subject_id)})).filter(x=>x.s),temporary=isTemporaryEmail(p.email);
 c.innerHTML=`<div class="user-subpage-head">${back()}<div><h3>Quản lý tài khoản</h3><p>Thông tin, học phần và quyền truy cập của người dùng.</p></div></div><section class="panel user-account-page"><div class="detail-identity"><div class="avatar">${esc((p.full_name||p.email||'?').trim()[0].toUpperCase())}</div><div><h3>${esc(p.full_name||'Chưa đặt tên')}</h3><p>${esc(p.email||'')}${temporary?' <span class="badge">Email tạm</span>':''}${p.mssv?` · ${esc(p.mssv)}`:''}</p><span class="badge ${p.role==='student'?'green':'red'}">${esc(roleText(p.role))}</span> <span class="badge ${p.is_active===false?'red':'green'}">${p.is_active===false?'Đã khóa':'Hoạt động'}</span></div></div><div class="user-account-actions"><button id="pageEditUser" class="secondary">Sửa thông tin</button><button id="pageChangeEmail" class="secondary">Đổi email</button><button id="pageResetPassword" class="secondary">Đặt lại mật khẩu</button>${p.role!=='admin'&&p.id!==state.user.id?`<button id="pageToggleLock" class="${p.is_active===false?'primary':'danger'}">${p.is_active===false?'Mở khóa':'Khóa tài khoản'}</button>`:''}</div>${temporary?'<div class="hint"><b>Email tạm:</b> không nhận được thư đặt lại mật khẩu. Khi có email thật, dùng nút <b>Đổi email</b>; mật khẩu được giữ nguyên.</div>':''}<div id="pagePasswordResult"></div><div class="panel-head user-course-head"><div><h3>Học phần tham gia</h3><p class="hint">Một người dùng có thể tham gia nhiều học phần.</p></div><span class="badge">${p.role==='admin'?'Toàn hệ thống':joined.length+' học phần'}</span></div><div class="subject-memberships">${p.role==='admin'?'<div><b>Toàn hệ thống</b><small>Quản trị viên · không thể hạ quyền, khóa hoặc xóa bởi Admin khác</small></div>':joined.map(x=>`<div><b>${esc(x.s.name)}</b><small>${esc(x.s.semester||'')} · ${esc(x.s.academic_year||'')} · ${esc(roleText(x.m.role))}</small></div>`).join('')||'<p class="hint">Chưa tham gia học phần nào.</p>'}</div></section>`;
 $('#userPageBack').onclick=()=>{clearUserPageState();onBack()};
 $('#pageEditUser').onclick=()=>editUserForm(p);
 $('#pageChangeEmail').onclick=()=>changeEmailForm(p);
 $('#pageResetPassword').onclick=async()=>{if(!await confirmAction('Đặt lại mật khẩu',`Đặt lại mật khẩu cho ${p.full_name}?`,{confirmLabel:'Đặt lại'}))return;try{let d=await invokeAdmin({action:'reset_password',user_id:p.id});$('#pagePasswordResult').innerHTML=`<div class="password-result"><b>Mật khẩu tạm mới</b><code>${esc(d.temporary_password)}</code><small>Hãy sao chép ngay. Mật khẩu này chỉ hiển thị một lần.</small></div>`}catch(x){err(x)}};
 $('#pageToggleLock')?.addEventListener('click',async()=>{let lock=p.is_active!==false;if(!await confirmAction(`${lock?'Khóa':'Mở khóa'} tài khoản`,`Xác nhận ${lock?'khóa':'mở khóa'} tài khoản ${p.full_name}?`,{confirmLabel:lock?'Khóa':'Mở khóa',danger:lock}))return;try{await invokeAdmin({action:lock?'ban':'unban',user_id:p.id});toast(lock?'Đã khóa tài khoản':'Đã mở khóa tài khoản');render()}catch(x){err(x)}});
}

window.users=async function(c){
 if(role()!=='admin')return oldUsers(c);
 heading();let [profiles,members]=await Promise.all([q('profiles','*',x=>x.order('full_name')),q('subject_members','*')]);
 const listPage=()=>{
  clearUserPageState();heading();
  c.innerHTML=`<div class="stats" id="userStats"></div><div class="user-system-toolbar"><input id="userSearch" placeholder="Tìm theo họ tên, email hoặc mã số…"><select id="userRole"><option value="all">Tất cả vai trò</option><option value="admin">Admin</option><option value="teacher">Giảng viên</option><option value="student">Sinh viên</option></select><select id="userStatus"><option value="all">Tất cả trạng thái</option><option value="active">Đang hoạt động</option><option value="locked">Đã khóa</option></select><button id="addAccountPage" class="primary">+ Thêm tài khoản</button></div><div class="panel table-wrap user-system-table"><table><thead><tr><th>Họ tên</th><th>Email / Mã số</th><th>Vai trò</th><th>Học phần</th><th>Đăng nhập gần nhất</th><th>Trạng thái</th><th>Thao tác</th></tr></thead><tbody id="userRows"></tbody></table></div>`;
  const match=(p,w)=>w==='all'||(w==='teacher'?teacherRoles.includes(p.role):p.role===w),draw=()=>{let s=$('#userSearch').value.trim().toLowerCase(),r=$('#userRole').value,st=$('#userStatus').value,rows=profiles.filter(p=>(!s||[p.full_name,p.email,p.mssv].some(v=>String(v||'').toLowerCase().includes(s)))&&match(p,r)&&(st==='all'||(st==='active'?p.is_active!==false:p.is_active===false)));$('#userStats').innerHTML=`<div class="stat"><small>Tổng tài khoản</small><b>${profiles.length}</b></div><div class="stat"><small>Giảng viên</small><b>${profiles.filter(p=>teacherRoles.includes(p.role)).length}</b></div><div class="stat"><small>Sinh viên</small><b>${profiles.filter(p=>p.role==='student').length}</b></div><div class="stat"><small>Admin</small><b>${profiles.filter(p=>p.role==='admin').length}</b></div><div class="stat"><small>Đã khóa</small><b>${profiles.filter(p=>p.is_active===false).length}</b></div>`;$('#userRows').innerHTML=rows.map(p=>{let n=new Set(members.filter(m=>m.user_id===p.id).map(m=>m.subject_id)).size,course=p.role==='admin'?'Toàn hệ thống':n?`${n} học phần`:'Chưa tham gia',temporary=isTemporaryEmail(p.email);return `<tr class="${p.is_active===false?'account-locked':''}"><td><b>${esc(p.full_name||'Chưa đặt tên')}</b>${p.id===state.user.id?' <span class="badge">Bạn</span>':''}</td><td>${esc(p.email||'—')}${temporary?' <span class="badge">Email tạm</span>':''}<br><small>${esc(p.mssv||'')}</small></td><td><span class="badge ${p.role==='student'?'green':'red'}">${esc(roleText(p.role))}</span></td><td><button class="user-course-count" data-manage-user="${p.id}">${esc(course)}</button></td><td>${esc(recent(p.last_login_at))}</td><td><span class="badge ${p.is_active===false?'red':'green'}">${p.is_active===false?'Đã khóa':'Hoạt động'}</span></td><td><button class="primary compact-manage" data-manage-user="${p.id}">Quản lý</button></td></tr>`}).join('')||'<tr><td colspan="7" class="empty">Không có tài khoản phù hợp.</td></tr>'};
  draw();$('#userSearch').oninput=draw;$('#userRole').onchange=draw;$('#userStatus').onchange=draw;
  $('#addAccountPage').onclick=()=>createPage(c,listPage);
  $('#userRows').onclick=e=>{let b=e.target.closest('[data-manage-user]'),p=b&&profiles.find(x=>x.id===b.dataset.manageUser);if(p)managePage(c,p,members,listPage)};
 };
 const saved=readUserPageState();
 if(saved.page==='create')return createPage(c,listPage);
 if(saved.page==='manage'){
  const target=profiles.find(x=>x.id===saved.userId);
  if(target)return managePage(c,target,members,listPage);
  clearUserPageState();
 }
 listPage();
};
window.AICLO_SYSTEM_USERS=Object.freeze({version:'12.6.26-kiemnghiem',temporaryEmailFromMssv,isTemporaryEmail});
})();