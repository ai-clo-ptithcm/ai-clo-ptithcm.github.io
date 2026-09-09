/* AI-CLO PTITHCM — single public header/footer runtime. app.html is excluded. */
(()=>{
'use strict';
if(/(^|\/)app\.html$/.test(location.pathname))return;
const path=location.pathname.replace(/\/index\.html$/,'/');
const active=path==='/'?'home':path.startsWith('/tools/')?'tools':path==='/huong-dan.html'?'guide':path.startsWith('/cham-thi-clo/')?'grading':path==='/chinh-sach.html'?'policy':'';
const navLinks=[['/','Trang chủ','home'],['/tools/','Công cụ CLO','tools'],['/huong-dan.html','Hướng dẫn AI-CLO','guide'],['/cham-thi-clo/','Chấm thi CLO','grading']];
const footerLinks=[['/','Trang chính','home'],['/tools/','Công cụ CLO','tools'],['/huong-dan.html','Hướng dẫn sử dụng','guide'],['/cham-thi-clo/','Chấm thi CLO','grading'],['/chinh-sach.html','Chính sách & bảo mật','policy'],['/app.html','Vào hệ thống','app']];
function headerHtml(){return `<nav class="aiclo-public-links" aria-label="Điều hướng công khai">${navLinks.map(([href,label,key])=>`<a href="${href}"${key===active?' class="active"':''}>${label}</a>`).join('')}</nav><div class="aiclo-public-actions"><button class="public-ai-button" type="button"><span aria-hidden="true">💬</span><span>Hỏi AI-CLO</span></button><a class="public-system-link" href="/app.html" target="_blank" rel="noopener">Vào hệ thống</a></div>`}
function footerHtml(){return `<span>© 2026 AI-CLO PTITHCM</span><nav aria-label="Liên kết cuối trang">${footerLinks.map(([href,label,key])=>`<a href="${href}"${key===active?' class="active"':''}${key==='app'?' target="_blank" rel="noopener"':''}>${label}</a>`).join('')}</nav>`}
function mount(){
 document.body.classList.add('aiclo-public-shell');
 let header=document.querySelector('header.public-nav,header.landing-nav,header.info-header,header[data-public-header]');
 if(!header){header=document.createElement('header');document.body.prepend(header)}
 header.className='aiclo-public-header public-nav public-nav-unified';header.dataset.publicHeader='1';header.dataset.unifiedNav='1';header.innerHTML=headerHtml();
 let footer=document.querySelector('footer.public-footer,footer.landing-footer,footer.info-footer,footer.tools-footer,footer.tool-footer,footer[data-public-footer],body>footer');
 if(!footer){footer=document.createElement('footer');document.body.append(footer)}
 footer.className='aiclo-public-footer';footer.dataset.publicFooter='1';footer.innerHTML=footerHtml();
}
function ensureChat(){
 if(window.AICLO_CHAT)return Promise.resolve(window.AICLO_CHAT);
 return new Promise((resolve,reject)=>{
  if(!document.querySelector('link[data-aiclo-public-chat-css]')){const l=document.createElement('link');l.rel='stylesheet';l.href='/css/ai-chat.css';l.dataset.aicloPublicChatCss='1';document.head.append(l)}
  const existing=[...document.scripts].find(s=>/\/js\/ai-chat\.js(?:\?|$)/.test(s.src));
  if(existing){if(window.AICLO_CHAT)return resolve(window.AICLO_CHAT);existing.addEventListener('load',()=>resolve(window.AICLO_CHAT),{once:true});existing.addEventListener('error',reject,{once:true});return}
  const s=document.createElement('script');s.src='/js/ai-chat.js';s.onload=()=>resolve(window.AICLO_CHAT);s.onerror=reject;document.head.append(s);
 });
}
mount();
document.addEventListener('click',e=>{const btn=e.target.closest?.('.aiclo-public-header .public-ai-button');if(!btn||window.AICLO_CHAT)return;ensureChat().then(chat=>chat?.open?.()).catch(()=>alert('Chưa thể mở Hỏi AI-CLO. Vui lòng thử lại.'))});
window.AICLO_PUBLIC_SHELL=Object.freeze({mount});
})();
