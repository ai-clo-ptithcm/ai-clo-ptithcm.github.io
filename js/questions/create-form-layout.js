/* AI-CLO PTITHCM V11.6.6 — structured Add question workspace. */
(()=>{
'use strict';

let queued=false;

function addQuestionForm(){
 const form=document.querySelector('#qForm');
 if(!form)return null;
 const title=String(document.querySelector('#pageTitle')?.textContent||document.querySelector('.workspace-head h3')?.textContent||'').trim().toLowerCase();
 return title.includes('thêm câu hỏi')?form:null;
}

function forceCurrentBankDefault(form){
 const bank=window.AICLO_V105?.activeBank?.();
 if(!['practice','secure_exam'].includes(bank))return;
 const radio=form.querySelector(`input[name="question_scope"][value="${bank}"]`);
 if(radio&&!radio.checked)radio.checked=true;
}

function section(title,desc,className){
 const el=document.createElement('section');
 el.className=`question-create-section wide ${className||''}`.trim();
 el.innerHTML=`<div class="question-create-section-head"><b>${title}</b>${desc?`<small>${desc}</small>`:''}</div><div class="question-create-section-body"></div>`;
 return el;
}

async function openBulkUpload(button){
 const original=button.textContent;
 button.disabled=true;button.textContent='Đang mở…';
 try{
  if(typeof v96QuestionSets!=='function')throw new Error('Chưa tải được dữ liệu học phần.');
  if(typeof window.v102BulkImportQuestions!=='function')throw new Error('Chưa tải được chức năng tải hàng loạt.');
  const sets=await v96QuestionSets();
  await window.v102BulkImportQuestions(sets);
 }catch(ex){err(ex)}finally{
  if(document.body.contains(button)){button.disabled=false;button.textContent=original}
 }
}

function buildModeSwitch(form){
 let mode=form.querySelector('#questionCreateMode');
 if(mode)return mode;
 mode=document.createElement('div');
 mode.id='questionCreateMode';
 mode.className='question-create-mode wide';
 mode.innerHTML=`<button type="button" class="question-create-mode-btn active" aria-pressed="true">● Tạo một câu</button><button id="questionBulkUploadMode" type="button" class="question-create-mode-btn" aria-pressed="false">⇧ Tải hàng loạt</button>`;
 form.prepend(mode);
 mode.querySelector('#questionBulkUploadMode')?.addEventListener('click',e=>openBulkUpload(e.currentTarget));
 return mode;
}

function moveFields(form){
 const content=form.querySelector('textarea[name="content"]')?.closest('label');
 const options=form.querySelector('.option-grid');
 const correct=form.querySelector('select[name="correct_answer"]')?.closest('label');
 const explanation=form.querySelector('textarea[name="explanation"]')?.closest('label');
 const chapter=form.querySelector('select[name="chapter_id"]')?.closest('label');
 const topic=form.querySelector('select[name="topic_id"]')?.closest('label');
 const clo=form.querySelector('select[name="clo_id"]')?.closest('label');
 const approval=form.querySelector('select[name="approval_status"]')?.closest('label');
 const scope=form.querySelector('.v105-scope-chooser');
 const actions=form.querySelector('.form-actions');
 if(!content||!options||!correct||!explanation||!chapter||!topic||!clo||!approval||!scope||!actions)return false;

 const compose=section('Soạn câu hỏi','Nhập nội dung, các phương án, đáp án đúng và lời giải theo một mạch.','question-create-compose');
 const composeBody=compose.querySelector('.question-create-section-body');
 composeBody.append(content,options);
 const answerRow=document.createElement('div');
 answerRow.className='question-create-answer-row';answerRow.append(correct);composeBody.append(answerRow,explanation);

 const classify=section('Phân loại câu hỏi','Gán câu hỏi vào đúng cấu trúc học phần.','question-create-classify');
 const classifyBody=classify.querySelector('.question-create-section-body');
 const grid=document.createElement('div');grid.className='question-create-classify-grid';grid.append(chapter,topic,clo,approval);classifyBody.append(grid);

 scope.classList.add('question-create-scope');
 actions.classList.add('question-create-actions');

 const mode=form.querySelector('#questionCreateMode');
 mode.insertAdjacentElement('afterend',compose);
 compose.insertAdjacentElement('afterend',classify);
 classify.insertAdjacentElement('afterend',scope);
 scope.insertAdjacentElement('afterend',actions);
 return true;
}

function enhance(){
 const form=addQuestionForm();
 if(!form||form.dataset.aicloCreateLayout==='1')return;
 forceCurrentBankDefault(form);
 buildModeSwitch(form);
 if(!moveFields(form))return;
 form.dataset.aicloCreateLayout='1';
}

function queueEnhance(){
 if(queued)return;queued=true;
 requestAnimationFrame(()=>{queued=false;enhance()});
}

document.addEventListener('DOMContentLoaded',()=>{
 enhance();
 const host=document.querySelector('#content');
 if(host)new MutationObserver(queueEnhance).observe(host,{childList:true,subtree:true});
});
})();
