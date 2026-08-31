/* AI-CLO PTITHCM v10.5.3 — question workspace persistence, compact bank, safe bulk delete, admin role filter. */
(() => {
'use strict';

const V='10.5.3';
const keyBase=()=>`ai-clo:v1053:${state.user?.id||'user'}:${state.subjectId||'subject'}`;
const filterKey=()=>`${keyBase()}:question-filters`;
const draftKey=id=>`${keyBase()}:question-draft:${id||'new'}`;
let draftTimer=null;

const jsonRead=(key,fallback=null)=>{try{return JSON.parse(sessionStorage.getItem(key)||'null')??fallback}catch{return fallback}};
const jsonWrite=(key,value)=>{try{sessionStorage.setItem(key,JSON.stringify(value))}catch{}};
const jsonDrop=key=>{try{sessionStorage.removeItem(key)}catch{}};

function currentFilters(){
 if(!$('#qsearch'))return null;
 let search=String($('#qsearch').value||'').trim();
 if(search.toLowerCase()==='all')search='';
 return {
  search,
  chapter:$('#qchapterFilter')?.value||'all',
  topic:$('#qtopicFilter')?.value||'all',
  clo:$('#qcloFilter')?.value||'all',
  approval:$('#qapprovalFilter')?.value||'all',
  creator:$('#qcreatorFilter')?.value||'all',
  bank:window.AICLO_V105?.activeBank?.()||'practice',
  scrollY:window.scrollY||0
 };
}
function persistFilters(){
 const f=currentFilters();
 if(!f)return;
 v94QuestionFilters=f;
 jsonWrite(filterKey(),f);
}
function savedFilters(){return v94QuestionFilters||jsonRead(filterKey(),null)}
function restoreFilters(){
 const f=savedFilters();if(!f||!$('#qsearch'))return;
 let search=String(f.search||'');if(search.toLowerCase()==='all')search='';
 $('#qsearch').value=search;
 if($('#qchapterFilter')){$('#qchapterFilter').value=f.chapter||'all';$('#qchapterFilter').dispatchEvent(new Event('change'))}
 if($('#qtopicFilter')&&[...$('#qtopicFilter').options].some(o=>o.value===(f.topic||'all')))$('#qtopicFilter').value=f.topic||'all';
 if($('#qcloFilter'))$('#qcloFilter').value=f.clo||'all';
 if($('#qapprovalFilter'))$('#qapprovalFilter').value=f.approval||'all';
 if($('#qcreatorFilter'))$('#qcreatorFilter').value=f.creator||'all';
 $('#qsearch').dispatchEvent(new Event('input'));
 requestAnimationFrame(()=>window.scrollTo({top:Number(f.scrollY)||0,behavior:'auto'}));
}

const oldCapture=window.captureQuestionFilters;
window.captureQuestionFilters=function(){oldCapture?.();persistFilters()};
const oldBack=window.backToQuestionList;
window.backToQuestionList=async function(){
 const f=savedFilters();if(f)v94QuestionFilters=f;
 await oldBack();
 persistFilters();
};

const oldQuestions=window.questions;
window.questions=async function(c){
 const f=savedFilters();
 if(f?.bank&&window.AICLO_V105?.activeBank?.()!==f.bank){
  // v105 bank state is private; the old back helper restores it from v94QuestionFilters.
  v94QuestionFilters=f;
 }
 await oldQuestions(c);
 restoreFilters();
 bindFilterPersistence();
 addSafeBulkDelete();
};
function bindFilterPersistence(){
 ['#qsearch','#qchapterFilter','#qtopicFilter','#qcloFilter','#qapprovalFilter','#qcreatorFilter'].forEach(sel=>{
  const el=$(sel);if(!el)return;
  el.addEventListener(el.tagName==='INPUT'?'input':'change',()=>{clearTimeout(draftTimer);draftTimer=setTimeout(persistFilters,80)});
 });
 $$('[data-bank-tab]').forEach(b=>b.addEventListener('click',()=>setTimeout(persistFilters,0)));
}

function readFormDraft(form){
 const data=Object.fromEntries(new FormData(form));
 return {...data,updated_at:Date.now()};
}
function saveVisibleQuestionDraft(){
 const form=$('#qForm');if(!form)return;
 const id=form.dataset.draftId||'new';jsonWrite(draftKey(id),readFormDraft(form));
}
function restoreQuestionDraft(form,id){
 const d=jsonRead(draftKey(id),null);if(!d)return false;
 const set=(name,value)=>{const el=form.elements.namedItem(name);if(!el||value==null)return;if(el instanceof RadioNodeList){[...form.querySelectorAll(`[name="${CSS.escape(name)}"]`)].forEach(r=>r.checked=r.value===value)}else el.value=value};
 if(d.chapter_id){set('chapter_id',d.chapter_id);$('#qchapter')?.dispatchEvent(new Event('change'))}
 ['content','topic_id','clo_id','correct_answer','approval_status','question_scope','opt_A','opt_B','opt_C','opt_D','explanation'].forEach(n=>set(n,d[n]));
 return true;
}

const oldNavigate=window.navigate;
window.navigate=function(v){
 saveVisibleQuestionDraft();
 if(state.view==='questions')persistFilters();
 return oldNavigate(v);
};
const oldFillSubjectSelect=window.fillSubjectSelect;
window.fillSubjectSelect=function(){return oldFillSubjectSelect()};

const oldQuestionForm=window.v96QuestionForm;
window.v96QuestionForm=async function(x={},sets){
 x=x||{};
 await oldQuestionForm(x,sets);
 const form=$('#qForm');if(!form)return;
 const id=x.id||'new';form.dataset.draftId=id;
 const restored=restoreQuestionDraft(form,id);
 if(restored)toast('Đã khôi phục nội dung đang soạn');
 const queue=()=>{clearTimeout(draftTimer);draftTimer=setTimeout(()=>jsonWrite(draftKey(id),readFormDraft(form)),120)};
 form.addEventListener('input',queue);form.addEventListener('change',queue);
 const originalSubmit=form.onsubmit;
 form.onsubmit=async e=>{
  jsonWrite(draftKey(id),readFormDraft(form));
  await originalSubmit(e);
  if(!document.body.contains(form))jsonDrop(draftKey(id));
 };
 const cancel=$('#cancelQuestionEdit');
 if(cancel){const old=cancel.onclick;cancel.onclick=async()=>{jsonDrop(draftKey(id));return old?.()}}
 const back=$('#questionBack');
 if(back){const old=back.onclick;back.onclick=async()=>{saveVisibleQuestionDraft();return old?.()}}
};

async function usedQuestionIds(ids){
 const used=new Set();
 if(!ids.length)return used;
 for(const table of ['exam_questions','exam_question_pool']){
  try{
   const {data,error}=await db.from(table).select('question_id').in('question_id',ids);
   if(error)throw error;
   (data||[]).forEach(r=>used.add(r.question_id));
  }catch(ex){console.warn(`V10.5.3 usage check ${table}`,ex)}
 }
 return used;
}
async function deleteUnusedQuestions(ids){
 if(!ids.length)return {deleted:0,failed:0};
 let deleted=0,failed=0;
 for(const id of ids){
  try{
   const a=await db.from('question_options').delete().eq('question_id',id);if(a.error)throw a.error;
   const b=await db.from('questions').delete().eq('id',id);if(b.error)throw b.error;
   deleted++;
  }catch(ex){failed++;console.warn('V10.5.3 bulk delete',id,ex)}
 }
 return {deleted,failed};
}
function addSafeBulkDelete(){
 const bar=$('#bulkQuestionBar');if(!bar||$('#bulkDeleteQuestions'))return;
 const clear=$('#clearQuestionSelection');
 const btn=document.createElement('button');btn.id='bulkDeleteQuestions';btn.className='danger';btn.textContent='Xóa đã chọn';
 bar.insertBefore(btn,clear||null);
 btn.onclick=async()=>{
  const ids=$$('#qrows [data-select-question]:checked').map(x=>x.dataset.selectQuestion).filter(Boolean);
  if(!ids.length)return toast('Chưa chọn câu hỏi để xóa',true);
  btn.disabled=true;btn.textContent='Đang kiểm tra…';
  try{
   const used=await usedQuestionIds(ids),allowed=ids.filter(id=>!used.has(id));
   if(!allowed.length){await confirmAction('Không thể xóa',`${ids.length} câu đã chọn đều đã được sử dụng trong bài kiểm tra/đề và được giữ lại để bảo toàn dữ liệu.`,{confirmLabel:'Đóng'});return}
   const message=used.size
    ?`${allowed.length} câu có thể xóa; ${used.size} câu đã được sử dụng nên sẽ được giữ lại. Xóa ${allowed.length} câu có thể xóa?`
    :`Xóa vĩnh viễn ${allowed.length} câu đã chọn và toàn bộ phương án? Thao tác không thể hoàn tác.`;
   if(!await confirmAction('Xóa nhiều câu hỏi',message,{confirmLabel:`Xóa ${allowed.length} câu`,danger:true}))return;
   const r=await deleteUnusedQuestions(allowed);
   toast(r.failed?`Đã xóa ${r.deleted} câu; ${r.failed} câu không xóa được.`:`Đã xóa ${r.deleted} câu hỏi`);
   await render();
  }catch(ex){err(ex)}finally{btn.disabled=false;btn.textContent='Xóa đã chọn'}
 };
}

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
