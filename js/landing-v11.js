/* AI-CLO PTITHCM V11 — landing interactions + lazy AI chat. */
(() => {
'use strict';

function setupPublicNav(){
 const header=document.querySelector('.public-nav'),nav=header?.querySelector('.public-nav-links'),ai=header?.querySelector('.public-ai-button');
 if(!header||!nav||!ai||header.dataset.unifiedNav==='1')return;
 const links=[...nav.querySelectorAll('a')],home=nav.querySelector('.public-home-link'),guide=links.find(a=>a.getAttribute('href')?.includes('huong-dan')),system=nav.querySelector('.public-system-link');
 links.filter(a=>a.getAttribute('href')?.includes('gioi-thieu')).forEach(a=>a.remove());
 if(home){home.textContent='Trang chủ';home.setAttribute('aria-label','Trang chủ');home.title='Trang chủ'}
 if(guide)guide.textContent='Hướng dẫn AI-CLO';
 const actions=document.createElement('div');actions.className='public-nav-actions';actions.append(ai);if(system)actions.append(system);header.append(actions);header.classList.add('public-nav-unified');header.dataset.unifiedNav='1';
 if(!document.querySelector('#publicNavUnifiedStyle')){
  const style=document.createElement('style');style.id='publicNavUnifiedStyle';style.textContent=`
   .public-nav.public-nav-unified{display:grid!important;grid-template-columns:minmax(0,1fr) auto!important;grid-template-areas:'links actions'!important;align-items:center!important;gap:18px!important}
   .public-nav-unified .public-nav-links{grid-area:links!important;margin:0!important;display:flex!important;align-items:center!important;gap:22px!important;min-width:0!important;overflow:visible!important;padding:0!important}
   .public-nav-unified .public-nav-links a{font-size:14px!important;line-height:1.2!important}
   .public-nav-unified .public-home-link{display:inline-flex!important;width:auto!important;height:auto!important;border-radius:0!important;background:transparent!important;font-size:14px!important;padding:0!important}
   .public-nav-unified .public-nav-actions{grid-area:actions;display:grid;grid-template-columns:auto auto;gap:10px;align-items:center}
   .public-nav-unified .public-nav-actions .public-ai-button,.public-nav-unified .public-nav-actions .public-system-link{min-height:42px;display:inline-flex!important;align-items:center;justify-content:center;border-radius:12px!important;padding:0 15px!important;font-weight:800!important;white-space:nowrap;text-decoration:none}
   .public-nav-unified .public-nav-actions .public-ai-button{border:1px solid #a98bc7!important;background:#f5effc!important;color:#60358a!important}
   .public-nav-unified .public-nav-actions .public-ai-button:hover{background:#ede2f8!important;border-color:#8f6bb5!important}
   .public-nav-unified .public-nav-actions .public-system-link{border:1px solid #a61d2d!important;background:#a61d2d!important;color:#fff!important}
   @media(max-width:760px){
    body.v107-public{padding-top:96px!important}
    .public-nav.public-nav-unified{height:96px!important;min-height:96px!important;padding:5px 14px!important;grid-template-columns:1fr!important;grid-template-rows:34px 42px!important;grid-template-areas:'links' 'actions'!important;gap:4px!important}
    .public-nav-unified .public-nav-links{width:100%!important;display:grid!important;grid-template-columns:.85fr 1.45fr 1.1fr!important;gap:5px!important;align-items:center!important}
    .public-nav-unified .public-nav-links a{min-width:0!important;text-align:center!important;font-size:12.5px!important;padding:3px 2px!important;white-space:nowrap!important}
    .public-nav-unified .public-home-link{justify-content:center!important}
    .public-nav-unified .public-nav-actions{width:100%;grid-template-columns:1fr 1fr;gap:9px}
    .public-nav-unified .public-nav-actions .public-ai-button,.public-nav-unified .public-nav-actions .public-system-link{width:100%!important;min-height:40px!important;padding:0 10px!important;font-size:14px!important}
   }
  `;document.head.append(style);
 }
}

function setupCarousel(){
 const carousel=document.querySelector('.campus-carousel');if(!carousel)return;
 const track=carousel.querySelector('.campus-track'),slides=[...carousel.querySelectorAll('.campus-slide')],dots=carousel.querySelector('.carousel-dots');let current=0,timer,visible=false;
 dots.innerHTML=slides.map((_,i)=>`<button type="button" aria-label="Xem ảnh ${i+1}" data-slide="${i}"></button>`).join('');
 const show=i=>{current=(i+slides.length)%slides.length;track.style.transform=`translateX(-${current*100}%)`;[...dots.children].forEach((d,n)=>d.classList.toggle('active',n===current))};
 const stop=()=>{clearInterval(timer);timer=null};
 const start=()=>{stop();if(visible&&!document.hidden&&slides.length>1)timer=setInterval(()=>show(current+1),5000)};
 carousel.querySelector('.prev').onclick=()=>{show(current-1);start()};carousel.querySelector('.next').onclick=()=>{show(current+1);start()};dots.onclick=e=>{let b=e.target.closest('[data-slide]');if(b){show(+b.dataset.slide);start()}};
 carousel.addEventListener('mouseenter',stop);carousel.addEventListener('mouseleave',start);document.addEventListener('visibilitychange',()=>document.hidden?stop():start());show(0);
 if('IntersectionObserver'in window){const observer=new IntersectionObserver(entries=>{visible=entries.some(entry=>entry.isIntersecting);visible?start():stop()},{rootMargin:'180px 0px',threshold:.01});observer.observe(carousel)}else{visible=true;start()}
}

function setupCounters(){
 const items=[...document.querySelectorAll('[data-count]')];if(!items.length)return;
 const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
 const run=el=>{if(el.dataset.counted)return;el.dataset.counted='1';const end=Number(el.dataset.count)||0;if(reduced){el.textContent=end.toLocaleString('vi-VN');return}const start=performance.now(),duration=1100;const frame=now=>{const p=Math.min(1,(now-start)/duration),ease=1-Math.pow(1-p,3);el.textContent=Math.round(end*ease).toLocaleString('vi-VN');if(p<1)requestAnimationFrame(frame)};requestAnimationFrame(frame)};
 if(!('IntersectionObserver'in window)){items.forEach(run);return}
 const observer=new IntersectionObserver(entries=>entries.forEach(entry=>{if(entry.isIntersecting){run(entry.target);observer.unobserve(entry.target)}}),{threshold:.35});items.forEach(el=>observer.observe(el));
}

let chatPromise=null;
function loadChat(){
 if(window.AICLO_CHAT)return Promise.resolve(window.AICLO_CHAT);
 if(chatPromise)return chatPromise;
 chatPromise=new Promise((resolve,reject)=>{
  if(!document.querySelector('link[data-ai-chat-style]')){
   const css=document.createElement('link');css.rel='stylesheet';css.href='css/ai-chat.css';css.dataset.aiChatStyle='1';document.head.appendChild(css);
  }
  const existing=document.querySelector('script[data-ai-chat-script]');
  if(existing){existing.addEventListener('load',()=>resolve(window.AICLO_CHAT),{once:true});existing.addEventListener('error',reject,{once:true});return}
  const script=document.createElement('script');script.src='js/ai-chat.js';script.defer=true;script.dataset.aiChatScript='1';script.onload=()=>resolve(window.AICLO_CHAT);script.onerror=()=>reject(new Error('Không tải được AI-CLO Assistant.'));document.head.appendChild(script);
 });
 return chatPromise;
}

function setupLazyChat(){
 document.querySelectorAll('.public-ai-button').forEach(btn=>btn.addEventListener('click',async()=>{
  if(btn.disabled)return;
  const old=btn.innerHTML;btn.disabled=true;btn.setAttribute('aria-busy','true');
  try{const chat=await loadChat();chat?.open?.()}catch(ex){console.warn('AI-CLO chat lazy load',ex);alert('Chưa thể mở AI-CLO Assistant. Vui lòng thử lại.')}finally{btn.disabled=false;btn.removeAttribute('aria-busy');btn.innerHTML=old}
 }));
}

document.addEventListener('DOMContentLoaded',()=>{setupPublicNav();setupCarousel();setupCounters();setupLazyChat()});
})();
