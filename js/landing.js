document.addEventListener('DOMContentLoaded',()=>{
 const carousel=document.querySelector('.campus-carousel');if(!carousel)return;
 const track=carousel.querySelector('.campus-track'),slides=[...carousel.querySelectorAll('.campus-slide')],dots=carousel.querySelector('.carousel-dots');let current=0,timer;
 dots.innerHTML=slides.map((_,i)=>`<button type="button" aria-label="Xem ảnh ${i+1}" data-slide="${i}"></button>`).join('');
 const show=i=>{current=(i+slides.length)%slides.length;track.style.transform=`translateX(-${current*100}%)`;[...dots.children].forEach((d,n)=>d.classList.toggle('active',n===current))};
 const start=()=>{clearInterval(timer);if(slides.length>1)timer=setInterval(()=>show(current+1),5000)};
 carousel.querySelector('.prev').onclick=()=>{show(current-1);start()};carousel.querySelector('.next').onclick=()=>{show(current+1);start()};dots.onclick=e=>{let b=e.target.closest('[data-slide]');if(b){show(+b.dataset.slide);start()}};
 carousel.addEventListener('mouseenter',()=>clearInterval(timer));carousel.addEventListener('mouseleave',start);document.addEventListener('visibilitychange',()=>document.hidden?clearInterval(timer):start());show(0);start();
});
