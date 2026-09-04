/* AI-CLO PTITHCM V11.8.4 — shared layout adapter.
   Tags recurring KPI/action/filter patterns so the CSS framework controls responsive layout centrally.
   Auto-tagging is deliberately conservative; known page layouts also have direct CSS aliases. */
(()=>{
'use strict';
const VERSION='11.8.4';
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
 const direct=directElements(el),buttons=direct.filter(x=>x.matches?.('button,a.button,.button'));
 if(buttons.length<4||buttons.length>6)return;
 const others=direct.filter(x=>!buttons.includes(x));
 if(others.length>1)return;
 el.classList.add('aiclo-action-grid');
 setCols(el,'--aiclo-action-cols',buttons.length);
 others.forEach(x=>x.classList.add('aiclo-action-meta'));
}
function tagFilter(el){
 if(!el)return;
 const direct=directElements(el);
 const controls=direct.filter(x=>x.matches?.('input,select'));
 const buttons=direct.filter(x=>x.matches?.('button'));
 const unsupported=direct.filter(x=>!x.matches?.('input,select,button'));
 /* Standard filter bar = search + 2 selects + one export/action button. */
 if(controls.length===3&&buttons.length===1&&unsupported.length===0&&direct.length===4){
  el.classList.add('aiclo-filter-bar');
 }
}
function selectWithin(root,selector){
 const out=[];
 if(root?.matches?.(selector))out.push(root);
 if(root?.querySelectorAll)out.push(...root.querySelectorAll(selector));
 return out;
}
function scan(root=document){
 const seen=new Set();
 [
  '.assessment-detail-stats','.stats','.v109-stats','.assessment-summary','.academic-profile-summary'
 ].forEach(sel=>selectWithin(root,sel).forEach(el=>{if(!seen.has(el)){seen.add(el);tagKpi(el)}}));

 /* Do not auto-convert every generic .toolbar into an action grid. */
 [
  '.assessment-detail-actions','.bank-actions','.drawer-actions','.student-exam-actions','.ub-export-actions'
 ].forEach(sel=>selectWithin(root,sel).forEach(tagAction));

 selectWithin(root,'.attempt-page-toolbar').forEach(el=>el.classList.add('aiclo-filter-bar'));
 selectWithin(root,'.toolbar').forEach(tagFilter);
}
function queue(){
 if(queued)return;
 queued=true;
 requestAnimationFrame(()=>{
  queued=false;
  const host=document.querySelector('#content');
  scan(host||document);
 });
}
function init(){
 scan(document);
 const host=document.querySelector('#content');
 if(host&&!observer){
  observer=new MutationObserver(()=>queue());
  observer.observe(host,{childList:true,subtree:true});
 }
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
window.AICLO_LAYOUT_SYSTEM=Object.freeze({version:VERSION,scan:()=>scan(document)});
})();
