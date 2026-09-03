/* AI-CLO PTITHCM V11.6.9 — restore active question/AI workspaces, not only draft values. */
(() => {
'use strict';

const baseKey=()=>`ai-clo:v1053:${state.user?.id||'user'}:${state.subjectId||'subject'}`;
const workspaceKey=()=>`${baseKey()}:question-workspace`;
const draftKey=id=>`${baseKey()}:question-draft:${id||'new'}`;
let restoring=false;

const read=key=>{try{return JSON.parse(sessionStorage.getItem(key)||'null')}catch{return null}};
const write=(key,value)=>{try{sessionStorage.setItem(key,JSON.stringify(value))}catch{}};
const drop=key=>{try{sessionStorage.removeItem(key)}catch{}};
const hasDraft=id=>{try{return !!sessionStorage.getItem(draftKey(id))}catch{return false}};
const activeBank=()=>window.AICLO_V105?.activeBank?.()||'practice';

function rememberEditor(id){
 write(workspaceKey(),{kind:'question-form',id:id||'new',bank:activeBank(),updated_at:Date.now()});
}
function rememberAi(){
 write(workspaceKey(),{kind:'ai-form',bank:activeBank(),updated_at:Date.now()});
}
function forgetWorkspace(){drop(workspaceKey())}
function forgetKind(kind){const w=read(workspaceKey());if(w?.kind===kind)forgetWorkspace()}
function workspaceToRestore(){
 const w=read(workspaceKey());
 if(!w)return null;
 if(w.kind==='question-form'){
  if(!hasDraft(w.id)){forgetWorkspace();return null}
  return w;
 }
 if(w.kind==='ai-form')return w;
 forgetWorkspace();
 return null;
}

function restoreBank(bank){
 if(!['practice','secure_exam'].includes(bank))return;
 const tab=document.querySelector(`[data-bank-tab="${bank}"]`);
 if(tab&&!tab.classList.contains('active'))tab.click();
}

/* Nếu trình duyệt reload/discard tab trong lúc đang soạn, vào lại đúng Ngân hàng câu hỏi. */
const oldEnterApp=window.enterApp;
window.enterApp=function(){
 if(workspaceToRestore())state.view='questions';
 return oldEnterApp();
};

/* Rời sang mục khác: flush dữ liệu trước khi render view mới và giữ dấu vết workspace. */
const oldNavigate=window.navigate;
window.navigate=function(v){
 const qform=$('#qForm');
 if(qform){rememberEditor(qform.dataset.draftId||'new')}
 const aiForm=$('#aiForm');
 if(aiForm){window.AICLO_FORM_PERSISTENCE?.flush?.(aiForm);rememberAi()}
 return oldNavigate(v);
};

/* Mỗi lần mở form câu hỏi, ghi lại workspace. Hủy/Quay lại/Lưu thành công thì xóa dấu vết. */
const oldQuestionForm=window.v96QuestionForm;
window.v96QuestionForm=async function(x={},sets){
 x=x||{};
 await oldQuestionForm(x,sets);
 const form=$('#qForm');if(!form)return;
 const id=x.id||'new';rememberEditor(id);

 const cancel=$('#cancelQuestionEdit');
 if(cancel){const old=cancel.onclick;cancel.onclick=async()=>{forgetKind('question-form');return old?.()}}

 const back=$('#questionBack');
 if(back){const old=back.onclick;back.onclick=async()=>{forgetKind('question-form');return old?.()}}

 const submit=form.onsubmit;
 form.onsubmit=async e=>{
  await submit(e);
  if(!document.body.contains(form))forgetKind('question-form');
 };
};

/* Quay lại Ngân hàng: tự mở đúng form câu hỏi hoặc Tạo bằng AI còn dang dở. */
const oldQuestions=window.questions;
window.questions=async function(c){
 await oldQuestions(c);
 if(restoring)return;
 const w=workspaceToRestore();if(!w)return;
 restoring=true;
 try{
  restoreBank(w.bank);
  const sets=await v96QuestionSets();
  if(w.kind==='ai-form'){
   await window.aiGenerateForm(sets);
   return;
  }
  let item=null;
  if(w.id!=='new'){
   item=sets.items.find(x=>x.id===w.id)||null;
   if(!item){forgetKind('question-form');return}
  }
  await window.v96QuestionForm(item,sets);
 }catch(ex){
  console.warn('V11.6.9 restore question workspace',ex);
 }finally{restoring=false}
};

window.AICLO_QUESTION_WORKSPACE=Object.freeze({
 rememberAi,
 forgetAi:()=>forgetKind('ai-form'),
 rememberQuestion:rememberEditor,
 forgetQuestion:()=>forgetKind('question-form'),
 current:workspaceToRestore
});
})();
