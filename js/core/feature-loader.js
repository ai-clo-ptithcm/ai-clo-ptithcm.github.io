/* AI-CLO PTITHCM — on-demand loader for heavy feature modules. */
(() => {
'use strict';

const pending=new Map();
const loaded=new Set();

function loadScript(src){
 if(loaded.has(src)||document.querySelector(`script[data-aiclo-feature="${CSS.escape(src)}"]`))return Promise.resolve();
 if(pending.has(src))return pending.get(src);
 const promise=new Promise((resolve,reject)=>{
  const script=document.createElement('script');
  script.src=src;
  script.async=false;
  script.dataset.aicloFeature=src;
  script.onload=()=>{loaded.add(src);pending.delete(src);resolve()};
  script.onerror=()=>{pending.delete(src);script.remove();reject(new Error(`Không tải được mô-đun ${src}.`))};
  document.head.appendChild(script);
 });
 pending.set(src,promise);
 return promise;
}
async function loadMany(files){for(const file of files)await loadScript(file)}

const lazyImport=async function(...args){
 await loadScript('js/questions/import.js');
 const fn=window.v102BulkImportQuestions;
 if(typeof fn!=='function'||fn===lazyImport)throw new Error('Không khởi tạo được chức năng nhập câu hỏi.');
 return fn(...args);
};
window.v102BulkImportQuestions=lazyImport;

const lazyAiHistory=async function(...args){
 await loadScript('js/ai/question-review.js');
 const fn=window.aiHistory;
 if(typeof fn!=='function'||fn===lazyAiHistory)throw new Error('Không khởi tạo được lịch sử AI.');
 return fn(...args);
};
window.aiHistory=lazyAiHistory;

const lazyAiGenerate=async function(...args){
 await loadMany(['js/ai/question-review.js','js/ai/generator.js']);
 const fn=window.aiGenerateForm;
 if(typeof fn!=='function'||fn===lazyAiGenerate)throw new Error('Không khởi tạo được chức năng tạo câu hỏi AI.');
 return fn(...args);
};
window.aiGenerateForm=lazyAiGenerate;

async function ensureView(view){
 if(view==='exams'){
  await loadMany(['js/exams/final-workflow.js','js/exams/attempt-autosave.js']);
  return;
 }
 if(view==='results'){
  await loadMany(['js/results/summary.js','js/students/profile.js']);
  return;
 }
 if(view==='users'&&state.space==='course')await loadScript('js/students/profile.js');
}

function installNavigationGate(){
 const base=window.navigate;
 if(typeof base!=='function'||base.__aicloFeatureGate)return;
 const gated=async function(view,...args){
  try{await ensureView(view)}catch(error){
   console.error('AI-CLO feature load failed',error);
   window.toast?.('Không tải được mô-đun chức năng. Vui lòng thử lại.',true);
   throw error;
  }
  return base.call(this,view,...args);
 };
 gated.__aicloFeatureGate=true;
 gated.__aicloBaseNavigate=base;
 window.navigate=gated;
}

document.addEventListener('DOMContentLoaded',installNavigationGate);

window.AICLO_FEATURES=Object.freeze({
 load:loadScript,
 loadMany,
 ensureView,
 isLoaded:src=>loaded.has(src),
 pending:()=>[...pending.keys()]
});
})();
