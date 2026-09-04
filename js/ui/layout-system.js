/* AI-CLO PTITHCM V11.8.3 — shared layout adapter.
   Tags recurring KPI/action/filter patterns so the CSS framework controls responsive layout centrally. */
(()=>{
'use strict';
const VERSION='11.8.3';
let observer=null,queued=false;

const directElements=el=>[...el.children].filter(x=>!x.hidden&&getComputedStyle(x).display!=='none');
const directButtons=el=>directElements(el).filter(x=>x.matches?.('button,a.button,.button'));

function setCols(el,varName,count){
 if(!el||count<1)return;
 el.style.setProperty(varName,String(Math.min(6,Math.max(1,count))));
}

function tagKpi(el){
 if(!el)return;
 const kids=directElements(el);
 if(kids.length<2||kids.length>6)return;
 el.classList.add('aiclo-kpi-grid');
 setCols(el,'--aiclo-cols',kids.length);
}

function tagAction(el){
 if(!el)return;
 const buttons=directButtons(el);
 if(buttons.length<4||buttons.length>6)return;
 const others=directElements(el).filter(x=>!buttons.includes(x));
 if(others.length>1)return;
 el.classList.add('aiclo-action-grid');
 setCols(el,'--aiclo-action-cols',buttons.length);
 others.forEach(x=>x.classList.add('aiclo-action-meta'));
}

function tagFilter(el){
 if(!el)return;
 const direct=directElements(el),inputs=direct.filter(x=>x.matches?.('input,select')),buttons=direct.filter(x=>x.matches?.('button'));
 if(inputs.length>=3&&buttons.length>=1&&direct.length<=5)el.classList.add('aiclo-filter-bar');
}

function scan(root=document){
 const q=s=>root.matches?.(s)?[root,...root.querySelectorAll?.(s)||[]]:[...root.querySelectorAll?.(s)||[]];
 const seen=new Set();
 [
  '.assessment-detail-stats','.stats','.v109-stats','.assessment-summary','.academic-profile-summary'
 ].forEach(sel=>q(sel).forEach(el=>{if(!seen.has(el)){seen.add(el);tagKpi(el)}}));

 [
  '.assessment-detail-actions','.bank-actions','.toolbar','.drawer-actions','.student-exam-actions','.ub-export-actions'
 ].forEach(sel=>q(sel).forEach(tagAction));

 q('.attempt-page-toolbar').forEach(el=>el.classList.add('aiclo-filter-bar'));
 q('.toolbar').forEach(tagFilter);
}

function queue(root=document){
 if(queued)return;queued=true;
 requestAnimationFrame(()=>{queued=false;scan(root)});
}
function init(){
 scan(document);
 const host=document.querySelector('#content');
 if(host&&!observer){observer=new MutationObserver(muts=>{for(const m of muts)for(const n of m.addedNodes)if(n.nodeType===1)queue(n)});observer.observe(host,{childList:true,subtree:true})}
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
window.AICLO_LAYOUT_SYSTEM=Object.freeze({version:VERSION,scan:()=>scan(document)});
})();
