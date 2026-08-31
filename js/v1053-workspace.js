/* AI-CLO PTITHCM v10.5.3 — restore the active question editor, not only its draft values. */
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

function rememberEditor(id){
 write(workspaceKey(),{kind:'question-form',id:id||'new',updated_at:Date.now()});
}
function forgetEditor(){drop(workspaceKey())}
function editorToRestore(){
 const w=read(workspaceKey());
 if(!w||w.kind!=='question-form'||!hasDraft(w.id)){if(w)forgetEditor();return null}
 return w;
}

/* Nếu trình duyệt reload tab trong lúc đang soạn, vào lại đúng Ngân hàng câu hỏi. */
const oldEnterApp=window.enterApp;
window.enterApp=function(){
 if(editorToRestore())state.view='questions';
 return oldEnterApp();
};

/* Rời sang mục khác: giữ dấu vết màn hình soạn để khi quay lại tự mở đúng form. */
const oldNavigate=window.navigate;
window.navigate=function(v){
 const form=$('#qForm');
 if(form)rememberEditor(form.dataset.draftId||'new');
 return oldNavigate(v);
};

/* Mỗi lần mở form, ghi lại màn hình hiện hành. Hủy/Quay lại/Lưu thành công thì xóa dấu vết. */
const oldQuestionForm=window.v96QuestionForm;
window.v96QuestionForm=async function(x={},sets){
 x=x||{};
 await oldQuestionForm(x,sets);
 const form=$('#qForm');if(!form)return;
 const id=x.id||'new';rememberEditor(id);

 const cancel=$('#cancelQuestionEdit');
 if(cancel){const old=cancel.onclick;cancel.onclick=async()=>{forgetEditor();return old?.()}}

 const back=$('#questionBack');
 if(back){const old=back.onclick;back.onclick=async()=>{forgetEditor();return old?.()}}

 const submit=form.onsubmit;
 form.onsubmit=async e=>{
  await submit(e);
  if(!document.body.contains(form))forgetEditor();
 };
};

/* Quay lại Ngân hàng câu hỏi: nếu còn nháp chưa Hủy/Lưu thì tự mở lại đúng form. */
const oldQuestions=window.questions;
window.questions=async function(c){
 await oldQuestions(c);
 if(restoring)return;
 const w=editorToRestore();if(!w)return;
 restoring=true;
 try{
  const sets=await v96QuestionSets();
  let item=null;
  if(w.id!=='new'){
   item=sets.items.find(x=>x.id===w.id)||null;
   if(!item){forgetEditor();return}
  }
  await window.v96QuestionForm(item,sets);
 }catch(ex){console.warn('V10.5.3 restore question workspace',ex)}finally{restoring=false}
};
})();
