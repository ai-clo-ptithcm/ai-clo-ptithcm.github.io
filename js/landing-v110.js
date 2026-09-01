/* AI-CLO PTITHCM V11.0 — hiệu ứng đếm số liệu khi người xem cuộn đến. */
document.addEventListener('DOMContentLoaded',()=>{
 const items=[...document.querySelectorAll('[data-count]')];if(!items.length)return;
 const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
 const run=el=>{if(el.dataset.counted)return;el.dataset.counted='1';const end=Number(el.dataset.count)||0;if(reduced){el.textContent=end.toLocaleString('vi-VN');return}const start=performance.now(),duration=1100;const frame=now=>{const p=Math.min(1,(now-start)/duration),ease=1-Math.pow(1-p,3);el.textContent=Math.round(end*ease).toLocaleString('vi-VN');if(p<1)requestAnimationFrame(frame)};requestAnimationFrame(frame)};
 if(!('IntersectionObserver'in window)){items.forEach(run);return}
 const observer=new IntersectionObserver(entries=>entries.forEach(entry=>{if(entry.isIntersecting){run(entry.target);observer.unobserve(entry.target)}}),{threshold:.35});items.forEach(el=>observer.observe(el));
});
