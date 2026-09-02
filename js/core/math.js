/* AI-CLO PTITHCM V11 — lazy MathJax loader and render bridge. */
(() => {
'use strict';

const SRC='https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js';
let pending=null;
let queue=Promise.resolve();

function hasMath(container){
 if(!container)return false;
 const text=container.textContent||'';
 return /\$\$[\s\S]+?\$\$|\$[^$\n]+?\$|\\\([\s\S]+?\\\)|\\\[[\s\S]+?\\\]/.test(text);
}

function load(){
 if(window.MathJax?.typesetPromise)return Promise.resolve(window.MathJax);
 if(pending)return pending;
 window.MathJax={
  tex:{inlineMath:[['$','$'],['\\(','\\)']],displayMath:[['$$','$$'],['\\[','\\]']],processEscapes:true},
  options:{skipHtmlTags:['script','noscript','style','textarea','pre','code']},
  startup:{typeset:false}
 };
 pending=new Promise((resolve,reject)=>{
  const script=document.createElement('script');
  script.src=SRC;
  script.async=true;
  script.dataset.aicloMath='mathjax';
  script.onload=async()=>{
   try{
    await window.MathJax?.startup?.promise;
    if(!window.MathJax?.typesetPromise)throw new Error('MathJax không khởi tạo typesetPromise.');
    resolve(window.MathJax);
   }catch(error){reject(error)}
  };
  script.onerror=()=>reject(new Error('Không tải được MathJax.'));
  document.head.appendChild(script);
 }).catch(error=>{pending=null;throw error});
 return pending;
}

window.AICLO_MATH=Object.freeze({load,hasMath,isReady:()=>!!window.MathJax?.typesetPromise});
window.renderMath=function(container=document.body){
 if(!container||!hasMath(container))return Promise.resolve();
 queue=queue.then(async()=>{
  const math=window.MathJax?.typesetPromise?window.MathJax:await load();
  math.typesetClear?.([container]);
  await math.typesetPromise([container]);
 }).catch(error=>console.error('AI-CLO MathJax render failed',error));
 return queue;
};
})();
