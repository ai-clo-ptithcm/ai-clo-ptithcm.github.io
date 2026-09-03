/* AI-CLO PTITHCM — on-demand loader for heavy feature modules. */
(()=>{
'use strict';

const pending=new Map();
const loaded=new Set();
const FINAL_WORKFLOW='js/exams/final-workflow.js';

function loadScript(src){
 if(loaded.has(src))return Promise.resolve();
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

async function loadFinalWorkflow(){
 if(loaded.has(FINAL_WORKFLOW))return;
 /* final-workflow still contains a legacy importer. Preserve the semantic importer/stub
    that is already active so script load order cannot downgrade bulk import. */
 const importHandler=window.v102BulkImportQuestions;
 await loadScript(FINAL_WORKFLOW);
 if(typeof importHandler==='function')window.v102BulkImportQuestions=importHandler;
}

const lazyCloForm=async function(...args){
 await loadFinalWorkflow();
 const fn=window.v102CloForm;
 if(typeof fn!=='function'||fn===lazyCloForm)throw new Error('Không khởi tạo được chức năng CLO.');
 return fn(...args);
};
window.v102CloForm=lazyCloForm;

async function loadAiReviewFlow(){
 await loadMany(['js/ai/question-review.js?v=11.6.8','js/ai/review-flow.js?v=11.6.8']);
}

const lazyAiHistory=async function(...args){
 await loadAiReviewFlow();
 const fn=window.aiHistory;
 if(typeof fn!=='function'||fn===lazyAiHistory)throw new Error('Không khởi tạo được lịch sử AI.');
 return fn(...args);
};
window.aiHistory=lazyAiHistory;

const lazyAiGenerate=async function(...args){
 await loadAiReviewFlow();
 await loadScript('js/ai/generator.js?v=11.6.9');
 const fn=window.aiGenerateForm;
 if(typeof fn!=='function'||fn===lazyAiGenerate)throw new Error('Không khởi tạo được chức năng tạo câu hỏi AI.');
 return fn(...args);
};
window.aiGenerateForm=lazyAiGenerate;

async function ensureView(view){
 if(view==='exams'){
  if(canTeach())await loadFinalWorkflow();
  await loadScript('js/exams/attempt-autosave.js');
  return;
 }
 if(view==='results'){
  if(role()==='student')await loadScript('js/students/profile.js');
  else await loadMany(['js/results/summary.js','js/students/profile.js']);
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
 loadFinalWorkflow,
 loadAiReviewFlow,
 isLoaded:src=>loaded.has(src),
 pending:()=>[...pending.keys()]
});
})();
