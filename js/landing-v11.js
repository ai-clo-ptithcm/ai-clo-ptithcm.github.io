/* AI-CLO PTITHCM V11 — landing interactions + lazy AI chat. */
(() => {
'use strict';

function setupCarousel(){
 const carousel=document.querySelector('.campus-carousel');if(!carousel)return;
 const track=carousel.querySelector('.campus-track'),slides=[...carousel.querySelectorAll('.campus-slide')],dots=carousel.querySelector('.carousel-dots');let current=0,timer;
 dots.innerHTML=slides.map((_,i)=>`<button type="button" aria-label="Xem ảnh ${i+1}" data-slide="${i}"></button>`).join('');
 const show=i=>{current=(i+slides.length)%slides.length;track.style.transform=`translateX(-${current*100}%)`;[...dots.children].forEach((d,n)=>d.classList.toggle('active',n===current))};
 const start=()=>{clearInterval(timer);if(slides.length>1)timer=setInterval(()=>show(current+1),5000)};
 carousel.querySelector('.prev').onclick=()=>{show(current-1);start()};carousel.querySelector('.next').onclick=()=>{show(current+1);start()};dots.onclick=e=>{let b=e.target.closest('[data-slide]');if(b){show(+b.dataset.slide);start()}};
 carousel.addEventListener('mouseenter',()=>clearInterval(timer));carousel.addEventListener('mouseleave',start);document.addEventListener('visibilitychange',()=>document.hidden?clearInterval(timer):start());show(0);start();
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

document.addEventListener('DOMContentLoaded',()=>{setupCarousel();setupCounters();setupLazyChat()});
})();
