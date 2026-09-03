/* AI-CLO PTITHCM V11 — course members / class list module. */
(() => {
'use strict';

const oldUsers=window.users;
const teacherRoles=['teacher','lecturer','giangvien'];
const roleLabel=r=>r==='admin'?'Admin':teacherRoles.includes(r)?'Giảng viên':'Sinh viên';

async function openClassMembershipManager(members,memberType='students'){
 const subject=activeSubject();
 let profiles=[];
 try{
  profiles=await q('profiles','id,full_name,email,mssv,role,is_active',x=>x.order('full_name'));
 }catch(ex){return err(ex)}
 const currentIds=new Set(members.map(m=>m.user_id));
 const wanted=p=>memberType==='teachers'?teacherRoles.includes(p.role):p.role==='student';
 const scopedMembers=members.filter(m=>memberType==='teachers'?teacherRoles.includes(m.role):m.role==='student');
 const eligible=profiles.filter(p=>wanted(p)&&p.is_active!==false&&!currentIds.has(p.id));
 modal(`Thành viên · ${subject?.name||'Học phần'}`,`<div class="class-manager v1053-class-manager">
  <div class="class-column">
   <h4>Thêm tài khoản đã có vào lớp</h4>
   <p class="hint">Chỉ chọn tài khoản đã tồn tại trong hệ thống. Trang này không tạo tài khoản mới.</p>
   <input id="memberSearch" placeholder="Tìm tên, email, MSSV…">
   <div id="candidateList" class="member-list"></div>
   <button id="addSelectedMembers" class="primary">+ Thêm vào lớp</button>
  </div>
  <div class="class-column">
   <h4>${memberType==='teachers'?'Giảng viên':'Sinh viên'} hiện tại (${scopedMembers.length})</h4>
   <div class="member-list">${scopedMembers.map(m=>{let p=profiles.find(x=>x.id===m.user_id);return `<div class="member-item"><span><b>${esc(p?.full_name||m.user_id)}</b><small>${esc(p?.email||'')}${p?.mssv?` · ${esc(p.mssv)}`:''}</small></span><button class="danger" data-remove-member="${m.id}">Gỡ</button></div>`}).join('')||'<div class="empty">Chưa có thành viên.</div>'}</div>
  </div>
 </div>`);
 const draw=list=>$('#candidateList').innerHTML=list.map(p=>`<label class="member-item"><input type="checkbox" value="${p.id}"><span><b>${esc(p.full_name)}</b><small>${esc(p.email)} · ${esc(p.mssv||roleLabel(p.role))}</small></span></label>`).join('')||'<div class="empty">Không còn tài khoản phù hợp để thêm.</div>';
 draw(eligible);
 $('#memberSearch').oninput=e=>{let s=e.target.value.toLowerCase();draw(eligible.filter(p=>[p.full_name,p.email,p.mssv].some(v=>String(v||'').toLowerCase().includes(s))))};
 $('#addSelectedMembers').onclick=async()=>{
  let ids=$$('#candidateList input:checked').map(x=>x.value);if(!ids.length)return toast('Chưa chọn tài khoản',true);
  let rows=profiles.filter(p=>ids.includes(p.id)).map(p=>({subject_id:state.subjectId,user_id:p.id,role:p.role}));
  let {error}=await db.from('subject_members').upsert(rows,{onConflict:'subject_id,user_id'});if(error)return err(error);
  closeModal();toast(`Đã thêm ${rows.length} thành viên vào lớp`);render();
 };
 $$('[data-remove-member]').forEach(b=>b.onclick=async()=>{
  if(!await confirmAction('Gỡ khỏi lớp','Gỡ tài khoản này khỏi học phần hiện tại? Tài khoản hệ thống sẽ không bị xóa.',{confirmLabel:'Gỡ khỏi lớp',danger:true}))return;
  let {error}=await db.from('subject_members').delete().eq('id',b.dataset.removeMember);if(error)return err(error);
  closeModal();toast('Đã gỡ thành viên khỏi lớp');render();
 });
}

window.users=async function(c){
 if(role()!=='admin'||state.space!=='course')return oldUsers(c);
 if(!state.subjectId){c.replaceChildren(empty());return}
 const subject=activeSubject();
 const members=await q('subject_members','id,user_id,subject_id,role',x=>x.eq('subject_id',state.subjectId));
 const memberIds=[...new Set(members.map(m=>m.user_id).filter(Boolean))];
 const profiles=memberIds.length?await q('profiles','id,full_name,email,mssv,role,is_active',x=>x.in('id',memberIds).order('full_name')):[];
 const memberIdsSet=new Set(memberIds);
 const classProfiles=profiles.filter(p=>memberIdsSet.has(p.id)&&p.role==='student');
 const membership=new Map(members.map(m=>[m.user_id,m]));

 if($('#usersNavLabel'))$('#usersNavLabel').textContent='Danh sách lớp';
 if($('#pageTitle'))$('#pageTitle').textContent='Danh sách lớp';
 if($('#pageSub'))$('#pageSub').textContent=`Thành viên thuộc ${subject?.name||'học phần hiện tại'}`;

 const total=classProfiles.length;
 const students=classProfiles.filter(p=>p.role==='student').length;
 const locked=classProfiles.filter(p=>p.is_active===false).length;
 c.innerHTML=`<div class="stats v1053-class-stats">
   <div class="stat"><small>Tổng sinh viên</small><b>${students}</b></div>
   <div class="stat"><small>Đang hoạt động</small><b>${students-locked}</b></div>
   <div class="stat"><small>Đang bị khóa</small><b>${locked}</b></div>
  </div>
  <div class="toolbar v1053-class-toolbar">
   <input id="classMemberSearch" placeholder="Tìm sinh viên…">
   <select id="classMemberStatus"><option value="all">Tất cả trạng thái</option><option value="active">Đang hoạt động</option><option value="locked">Đã khóa</option></select>
   <button id="manageCurrentClass" class="primary">+ Thêm / bớt sinh viên</button>
  </div>
  <div class="panel table-wrap v1053-class-table"><table><thead><tr><th>Họ tên</th><th>Email / MSSV</th><th>Trạng thái</th><th></th></tr></thead><tbody id="classMemberRows"></tbody></table></div>`;

 const draw=()=>{
  const s=$('#classMemberSearch').value.toLowerCase(),sf=$('#classMemberStatus').value;
  const list=classProfiles.filter(p=>[p.full_name,p.email,p.mssv].some(v=>String(v||'').toLowerCase().includes(s))).filter(p=>sf==='all'||(sf==='active'?p.is_active!==false:p.is_active===false));
  $('#classMemberRows').innerHTML=list.map(p=>`<tr class="${p.is_active===false?'account-locked':''}"><td><b>${esc(p.full_name)}</b></td><td>${esc(p.email)}<br><small>${esc(p.mssv||'')}</small></td><td><span class="badge ${p.is_active===false?'red':'green'}">${p.is_active===false?'Đã khóa':'Hoạt động'}</span></td><td class="row-actions"><button class="danger" data-remove-class-member="${membership.get(p.id)?.id||''}">Gỡ</button></td></tr>`).join('')||'<tr><td colspan="4" class="empty">Không có sinh viên phù hợp.</td></tr>';
 };
 draw();
 $('#classMemberSearch').oninput=draw;$('#classMemberStatus').onchange=draw;
 $('#manageCurrentClass').onclick=()=>openClassMembershipManager(members);
 $('#classMemberRows').onclick=async e=>{
  const b=e.target.closest('[data-remove-class-member]');if(!b||!b.dataset.removeClassMember)return;
  if(!await confirmAction('Gỡ khỏi lớp','Gỡ tài khoản này khỏi học phần hiện tại? Tài khoản hệ thống vẫn được giữ nguyên.',{confirmLabel:'Gỡ khỏi lớp',danger:true}))return;
  let {error}=await db.from('subject_members').delete().eq('id',b.dataset.removeClassMember);if(error)return err(error);
  toast('Đã gỡ thành viên khỏi lớp');render();
 };
};

window.AICLO_COURSE_MEMBERS=Object.freeze({openManager:openClassMembershipManager});
})();
