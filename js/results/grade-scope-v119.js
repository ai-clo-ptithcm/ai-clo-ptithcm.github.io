/* AI-CLO PTITHCM V12.0 — only assessments enabled for course CLO results contribute to aggregate results. */
(()=>{
'use strict';
const VERSION='12.0.0';
let installed=false,schemaSupport=null,baseQ=null;
function isResultsContext(){return state?.view==='results'}
function missingColumn(error){const s=String(error?.message||error||'');return /counts_toward_grade|column.*does not exist|PGRST204/i.test(s)}
function augment(select){const s=String(select||'*');if(s==='*'||s.includes('counts_toward_grade'))return s;return `${s},counts_toward_grade`}
function install(){
 if(installed)return true;if(typeof q!=='function')return false;baseQ=q;
 const wrapped=async function(table,select='*',build=x=>x){
  if(table!=='exams'||!isResultsContext()||schemaSupport===false)return baseQ(table,select,build);
  try{const rows=await baseQ(table,augment(select),build);schemaSupport=true;return (rows||[]).filter(x=>x.counts_toward_grade!==false)}
  catch(error){if(!missingColumn(error))throw error;schemaSupport=false;console.warn('AI-CLO: Supabase chưa có counts_toward_grade; tạm dùng toàn bộ bài kiểm tra trong Kết quả CLO.');return baseQ(table,select,build)}
 };
 try{window.q=wrapped;q=wrapped;installed=true}catch{try{window.q=wrapped;installed=true}catch{}}
 return installed;
}
function note(){
 if(!isResultsContext()||document.querySelector('[data-v12-grade-note]'))return;const c=document.querySelector('#content');if(!c)return;const target=c.querySelector('.stats')||c.firstElementChild;if(!target)return;const n=document.createElement('div');n.dataset.v12GradeNote='1';n.className='hint';n.style.margin='0 0 10px';n.textContent=schemaSupport===false?'Kết quả CLO đang dùng toàn bộ bài kiểm tra vì Supabase chưa có cột counts_toward_grade.':'GPA và tổng hợp CLO học phần chỉ tính các bài đã bật “Tính vào kết quả CLO học phần”.';target.before(n);
}
function init(){if(!install())return setTimeout(init,50);const host=document.querySelector('#content');if(host)new MutationObserver(()=>requestAnimationFrame(note)).observe(host,{childList:true,subtree:true});note()}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
window.AICLO_GRADE_SCOPE=Object.freeze({version:VERSION,install,supported:()=>schemaSupport});
})();