/* AI-CLO PTITHCM V12.6.21-kiemnghiem — canonical app shell owner. */
(() => {
'use strict';

const V='12.6.21-kiemnghiem';
const teacherRoles=['teacher','lecturer','giangvien'];
const isTeacher=r=>teacherRoles.includes(r);

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
 const bell=$('#notificationBell'),button=document.createElement('button');
 button.id='appAiButton';button.type='button';button.className='app-ai-button';button.innerHTML='<span>💬</span> Hỏi AI-CLO';button.title='Hỏi AI-CLO';
 header.insertBefore(button,bell||null);
 button.onclick=()=>window.AICLO_CHAT?.open?.({role:role(),view:state.view,space:state.space,subject:activeSubject()?.name||''});
}

function refreshShell(){
 const nav=$('#nav');if(!nav)return;
 nav.innerHTML=navItems().filter(x=>x[3]).map(([view,icon,label])=>`<button data-view="${view}" class="${state.view===view?'active':''}"><span class="nav-icon">${icon}</span><span${view==='users'?' id="usersNavLabel"':''}>${esc(label)}</span></button>`).join('');
 const course=activeSubject(),aside=$('.app>aside');
 aside?.classList.toggle('course-space',state.space==='course');
 let context=$('#courseContext'),systemReturn=$('#courseSystemReturn');
 if(state.space==='course'&&course){
  if(!systemReturn){
   systemReturn=document.createElement('button');systemReturn.id='courseSystemReturn';systemReturn.className='course-system-return';systemReturn.type='button';systemReturn.innerHTML='<span>←</span><b>Về hệ thống</b>';
   $('.app>aside>.logo')?.after(systemReturn);
  }
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
 window.v95RefreshShell=refreshShell;
 const nav=window.AICLO_NAVIGATION;
 if(nav)window.AICLO_NAVIGATION=Object.freeze({...nav,refresh:refreshShell});
 window.AICLO_V108={version:V,openUserProfile:p=>window.AICLO_PROFILE?.openUserProfile?.(p),openNoticeDetail:window.AICLO_NOTIFICATION_DETAIL?.openNoticeDetail};
 window.AICLO_SHELL=Object.freeze({version:V,refresh:refreshShell,setContextBadge,setupAppAi});
 document.documentElement.dataset.aicloVersion=V;
 refreshShell();
}

document.addEventListener('DOMContentLoaded',()=>setTimeout(installCanonicalShell,0));
})();
