import '../../../../js/core/question-tables.js';
let loader;
export async function ensureMathJax(){
  if(window.MathJax?.typesetPromise)return window.MathJax;
  if(!loader){
    window.MathJax={tex:{inlineMath:[['\\(','\\)'],['$','$']],displayMath:[['\\[','\\]'],['$$','$$']]},svg:{fontCache:'global'}};
    loader=new Promise((resolve,reject)=>{const s=document.createElement('script');s.src='https://cdn.jsdelivr.net/npm/mathjax@3.2.2/es5/tex-svg.js';s.async=true;s.onload=()=>resolve(window.MathJax);s.onerror=reject;document.head.appendChild(s);});
  }
  return loader;
}
export async function typesetMath(elements){try{const nodes=elements?Array.from(elements):[document.body];nodes.forEach(node=>window.AICLO_QUESTION_TABLES?.formatTablesInNode(node));const mj=await ensureMathJax();await mj.typesetPromise(elements?nodes:undefined);}catch(e){console.warn('MathJax unavailable',e);}}
