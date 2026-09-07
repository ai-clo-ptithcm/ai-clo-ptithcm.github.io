/* AI-CLO PTITHCM V12.6.22 — canonical app shell/navigation runtime owner. */
(() => {
'use strict';
const V='12.6.22';
const teacherRoles=['teacher','lecturer','giangvien'];
const isTeacher=r=>teacherRoles.includes(r);
let installed=false;

function navItems(){
 const r=role();
 if(state.space==='system')return [
  ['dashboard','⌂','Tổng quan',true],
  ['subjects','▣',r==='admin'?'Quản lý học phần':isTeacher(r)?'Học phần phụ trách':'Học phần đang học',true],
  ['questionBanks','?','Ngân hàng câu hỏi',r==='admin'],
  ['notifications','🔔','Thông báo',r!=='admin'],
  ['activity','≡','Nhật ký hoạt động',r==='admin'],
  ['users','♙','Quản lý người dùng',r==='admin']
 ];
 return [
  ['dashboard','⌂','Tổng quan học phần',true],
  ['structure','⌘','Chương · Chủ đề · CLO',true],
  ['questions','?','Ngân hàng câu hỏi',canTeach()],
  ['exams','✎',canTeach()?'Đánh giá':'Bài kiểm tra trực tuyến',true],
  ['results','◫','Kết quả CLO',true],
  ['users','♙','Danh sách thành viên',canTeach()]
 ];
}

function syncSpaceState(){
 const app=$('#app');
 if(!app)return;
 const space=state.space==='course'?'course':'system';
 app.dataset.space=space;
 document.documentElement.dataset.aicloSpace=space;
}

function setContextBadge(){
 const heading=$('.page-heading');if(!heading)return;
 let badge=$('#v108ContextBadge');
 if(!badge){badge=document.createElement('span');badge.id='v108ContextBadge';badge.className='app-context-badge';heading.append(badge)}
 if(state.space==='course'&&activeSubject()){
  const s=activeSubject();badge.classList.add('course');badge.textContent=`${s.name} · ${s.semester||''}`;
 }else{badge.classList.remove('course');badge.textContent='HỆ THỐNG'}
}

function setupAppAi(){
 const header=$('.app main>header');if(!header||$('#appAiButton'))return;
 const bell=$('#notificationBell'),b=document.createElement('button');
 b.id='appAiButton';b.type='button';b.className='app-ai-button';b.innerHTML='<span>💬</span> Hỏi AI-CLO';b.title='Hỏi AI-CLO';
 header.insertBefore(b,bell||null);
 b.onclick=()=>window.AICLO_CHAT?.open?.({role:role(),view:state.view,space:state.space,subject:activeSubject()?.name||''});
}

function refreshShell(){
 syncSpaceState();
 const nav=$('#nav');if(!nav)return;
 nav.innerHTML=navItems().filter(x=>x[3]).map(([view,icon,label])=>`<button data-view="${view}" class="${state.view===view?'active':''}"><span class="nav-icon">${icon}</span><span${view==='users'?' id="usersNavLabel"':''}>${esc(label)}</span></button>`).join('');
 const course=activeSubject(),aside=$('.app>aside');aside?.classList.toggle('course-space',state.space==='course');
 let context=$('#courseContext'),systemReturn=$('#courseSystemReturn');
 if(state.space==='course'&&course){
  if(!systemReturn){systemReturn=document.createElement('button');systemReturn.id='courseSystemReturn';systemReturn.className='course-system-return';systemReturn.type='button';systemReturn.innerHTML='<span>←</span><b>Về hệ thống</b>';$('.app>aside>.logo')?.after(systemReturn)}
  systemReturn.onclick=()=>window.AICLO_NAVIGATION?.enterSystem?.('dashboard');
  if(!context){context=document.createElement('div');context.id='courseContext';context.className='course-context';systemReturn.after(context)}
  context.innerHTML=`<b>${esc(course.name)}</b><span>${esc(course.semester||'')} · ${esc(course.academic_year||'')}</span>`;
 }else{context?.remove();systemReturn?.remove()}
 const home=$('#systemHomeBtn');
 if(home){home.classList.toggle('hidden',state.space!=='course');home.innerHTML='<span>←</span><b>Quay lại</b>';home.title='Quay lại màn hình trước';home.setAttribute('aria-label','Quay lại màn hình trước')}
 const pick=$('.subject-pick');pick?.classList.toggle('hidden',state.space!=='course');
 if(pick&&course){let value=$('.subject-value',pick);if(!value){value=document.createElement('span');value.className='subject-value';pick.append(value)}value.innerHTML=`<b>${esc(course.name)}</b><small>${esc(course.semester||'')}</small>`}
 setContextBadge();setupAppAi();window.AICLO_PROFILE?.makeMiniUserClickable?.();
}

function installCanonicalShell(){
 if(installed)return;installed=true;
 const domainRender=window.render;
 window.v95RefreshShell=refreshShell;
 window.render=async function(){
  refreshShell();
  await domainRender();
  refreshShell();
  window.AICLO_PROFILE?.enhanceUserLists?.();
 };
 const openUserProfile=p=>window.AICLO_PROFILE?.openUserProfile?.(p);
 window.AICLO_V108={version:V,openUserProfile,openNoticeDetail:window.AICLO_NOTIFICATION_DETAIL?.openNoticeDetail};
 window.AICLO_SHELL=Object.freeze({version:V,refresh:refreshShell,setContextBadge,setupAppAi,syncSpaceState});
 document.documentElement.dataset.aicloVersion=V;
 refreshShell();
}

/* shell.js is deferred and loaded after compatibility layers. Install immediately,
 * before DOMContentLoaded/boot can reveal the app, so mobile never paints the
 * course header geometry while the active space is actually system. */
installCanonicalShell();
})();
