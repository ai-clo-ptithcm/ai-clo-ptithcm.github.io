/* AI-CLO PTITHCM V11.1 — fast sidebar transitions with per-view visual cache. */
(() => {
'use strict';

const previousRender=window.render;
if(typeof previousRender!=='function')return;

const CACHE_TTL=5*60*1000;
const MAX_ENTRIES=24;
const viewCache=new Map();
let sequence=0;

function keyParts(){
 return [state.user?.id||'guest',state.space||'system',state.subjectId||'no-subject',state.view||'dashboard'];
}
function currentKey(){return keyParts().join('|')}

function isGlobalLoading(container){
 if(!container||container.children.length!==1)return false;
 const only=container.firstElementChild;
 return !!only&&only.classList.contains('panel')&&only.textContent.trim()==='Đang tải dữ liệu…';
}

function isErrorView(container){
 return !!container?.textContent?.includes('Không thể tải dữ liệu');
}

function hasStableContent(container){
 return !!container?.children.length&&!isGlobalLoading(container)&&!isErrorView(container);
}

function remember(key,html){
 if(!key||!html)return;
 viewCache.delete(key);
 viewCache.set(key,{html,at:Date.now()});
 while(viewCache.size>MAX_ENTRIES)viewCache.delete(viewCache.keys().next().value);
}

function recall(key){
 const hit=viewCache.get(key);
 if(!hit)return '';
 if(Date.now()-hit.at>CACHE_TTL){viewCache.delete(key);return ''}
 viewCache.delete(key);
 viewCache.set(key,hit);
 return hit.html;
}

function invalidate(view=null,subjectId=null,space=null){
 for(const key of [...viewCache.keys()]){
  const [,keySpace,keySubject,keyView]=key.split('|');
  if((!view||keyView===view)&&(!subjectId||keySubject===subjectId)&&(!space||keySpace===space))viewCache.delete(key);
 }
}

function setRefreshing(container,on){
 if(!container)return;
 if(on){
  container.setAttribute('aria-busy','true');
  container.dataset.aicloRefreshing='1';
  container.style.pointerEvents='none';
  container.style.opacity='0.975';
  container.style.transition='opacity 100ms ease';
  document.documentElement.style.cursor='progress';
 }else{
  container.removeAttribute('aria-busy');
  delete container.dataset.aicloRefreshing;
  container.style.pointerEvents='';
  container.style.opacity='';
  container.style.transition='';
  document.documentElement.style.cursor='';
 }
}

window.render=async function(...args){
 const container=document.querySelector('#content');
 const key=currentKey();
 const cached=recall(key);
 const ticket=++sequence;
 let task;
 try{
  task=previousRender.apply(this,args);
 }catch(error){
  setRefreshing(container,false);
  throw error;
 }

 if(cached&&isGlobalLoading(container)){
  container.innerHTML=cached;
  setRefreshing(container,true);
 }

 try{
  const result=await task;
  if(ticket===sequence&&hasStableContent(container))remember(key,container.innerHTML);
  return result;
 }finally{
  if(ticket===sequence)setRefreshing(container,false);
 }
};

window.AICLO_VIEW_TRANSITION=Object.freeze({
 version:'11.1.2',
 invalidate,
 clear:()=>viewCache.clear(),
 isRefreshing:()=>document.querySelector('#content')?.dataset.aicloRefreshing==='1'
});
})();

/* V12.6.11 — Admin may promote an existing teacher to Admin.
   Existing Admin accounts remain protected from demotion/locking/deletion. */
(() => {
'use strict';
const previousEditUserForm=window.editUserForm;
if(typeof previousEditUserForm!=='function')return;
const teacherRoles=['teacher','lecturer','giangvien'];

window.editUserForm=function(p){
 if(!p||p.role==='admin'||!teacherRoles.includes(p.role))return previousEditUserForm(p);
 modal('Sửa tài khoản',`<form id="editUserForm" class="form-grid"><label class="field wide">Họ và tên<input name="full_name" required value="${esc(p.full_name)}"></label><label class="field wide">Email<input name="email" type="email" required value="${esc(p.email)}"></label><label class="field">Vai trò<select name="role" id="editRole"><option value="teacher" selected>Giảng viên</option><option value="student">Sinh viên</option><option value="admin">Admin</option></select></label><label class="field">MSSV<input name="mssv" id="editMssv" value="${esc(p.mssv||'')}"></label><p class="hint wide" id="editRoleHint">Có thể đổi Giảng viên thành Sinh viên hoặc nâng thành Admin. Khi nâng thành Admin, tài khoản có quyền toàn hệ thống và không thể hạ quyền lại.</p><div class="form-actions"><button type="button" class="secondary" onclick="document.querySelector('#modal').close()">Hủy</button><button class="primary" id="saveUser">Lưu thay đổi</button></div></form>`);
 const roleSelect=$('#editRole'),mssv=$('#editMssv'),hint=$('#editRoleHint');
 const sync=()=>{
  const student=roleSelect.value==='student';
  mssv.required=student;
  if(!student)mssv.value='';
  hint.textContent=roleSelect.value==='admin'?'Nâng thành Admin là thay đổi một chiều theo quy tắc hiện tại. Tài khoản sẽ có quyền toàn hệ thống và không còn cần membership học phần.':student?'Sinh viên phải có MSSV. Hệ thống sẽ đồng bộ vai trò trong các học phần.':'Giảng viên được quản lý theo các học phần được phân công.';
 };
 roleSelect.onchange=sync;sync();
 $('#editUserForm').onsubmit=async e=>{
  e.preventDefault();
  const btn=$('#saveUser'),v=Object.fromEntries(new FormData(e.target));
  if(v.role==='admin'){
   const ok=await confirmAction('Nâng quyền Admin',`Nâng ${p.full_name||p.email} thành Admin? Tài khoản sẽ có quyền quản trị toàn hệ thống và không thể hạ quyền lại.`,{confirmLabel:'Nâng thành Admin',danger:true});
   if(!ok)return;
  }
  btn.disabled=true;btn.textContent='Đang lưu…';
  try{
   await invokeAdmin({action:'update',user_id:p.id,full_name:v.full_name,email:v.email,role:v.role,mssv:v.mssv||null});
   closeModal();
   toast(v.role==='admin'?'Đã nâng tài khoản thành Admin':'Đã cập nhật tài khoản');
   window.AICLO_VIEW_TRANSITION?.invalidate?.('users');
   render();
  }catch(ex){err(ex);btn.disabled=false;btn.textContent='Lưu thay đổi'}
 };
};
})();
