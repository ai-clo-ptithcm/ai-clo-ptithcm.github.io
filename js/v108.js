/* AI-CLO PTITHCM V10.8 — shell compatibility bridge. */
(() => {
'use strict';
const V='10.8';

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

window.AICLO_V108={version:V,openUserProfile,openNoticeDetail:window.AICLO_NOTIFICATION_DETAIL?.openNoticeDetail};

const oldRender=window.render;
window.render=async function(){await oldRender();setContextBadge();setupAppAi();makeMiniUserClickable();enhanceUserLists()};

document.addEventListener('DOMContentLoaded',()=>{document.documentElement.dataset.aicloVersion=V;setupAppAi();setContextBadge();setTimeout(makeMiniUserClickable,250)});
})();
