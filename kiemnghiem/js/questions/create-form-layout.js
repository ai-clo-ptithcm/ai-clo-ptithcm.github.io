/* AI-CLO PTITHCM V11.6.18 — compact structured create/edit question workspace. */
(()=>{
'use strict';

let queued=false;

function questionFormContext(){
 const form=document.querySelector('#qForm');
 if(!form)return null;
 const workspace=form.closest('.question-workspace');
 const title=String(workspace?.querySelector('.workspace-head h3')?.textContent||'').trim().toLowerCase();
 if(title.includes('thêm câu hỏi'))return {form,mode:'create'};
 if(title.includes('sửa câu hỏi'))return {form,mode:'edit'};
 return null;
}

function forceCurrentBankDefault(form){
 const bank=window.AICLO_V105?.activeBank?.();
 if(!['practice','secure_exam'].includes(bank))return;
 const radio=form.querySelector(`input[name="question_scope"][value="${bank}"]`);
 if(radio&&!radio.checked)radio.checked=true;
}

function titledSection(title,className){
 const el=document.createElement('section');
 el.className=`question-create-section wide ${className||''}`.trim();
 el.innerHTML=`<div class="question-create-section-head"><b>${title}</b></div><div class="question-create-section-body"></div>`;
 return el;
}

function plainSection(className){
 const el=document.createElement('section');
 el.className=`question-create-section wide ${className||''}`.trim();
 el.innerHTML='<div class="question-create-section-body"></div>';
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

function compactScope(scope){
 if(!scope)return;
 scope.classList.add('question-create-scope');
 scope.querySelectorAll('.v105-scope-option').forEach(label=>{
  const hint=label.querySelector('small')?.textContent?.trim();
  if(hint&&label.title!==hint)label.title=hint;
 });
}

function arrangeMeta(form){
 const meta=form.querySelector('.question-create-meta-row');
 if(!meta)return;
 const origin=form.querySelector('.question-origin-field');
 const scope=form.querySelector('.v105-scope-chooser');
 if(origin&&origin.parentElement!==meta)meta.insertBefore(origin,meta.firstChild);
 if(scope&&scope.parentElement!==meta)meta.append(scope);
 compactScope(scope);
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
 const origin=form.querySelector('.question-origin-field');
 const scope=form.querySelector('.v105-scope-chooser');
 const actions=form.querySelector('.form-actions');
 if(!content||!options||!correct||!explanation||!chapter||!topic||!clo||!approval||!scope||!actions)return false;

 const compose=plainSection('question-create-compose');
 const composeBody=compose.querySelector('.question-create-section-body');
 composeBody.append(content,options);
 const answerRow=document.createElement('div');
 answerRow.className='question-create-answer-row';
 answerRow.append(correct);
 composeBody.append(answerRow,explanation);

 const classify=titledSection('Phân loại câu hỏi','question-create-classify');
 const classifyBody=classify.querySelector('.question-create-section-body');
 const grid=document.createElement('div');
 grid.className='question-create-classify-grid';
 grid.append(chapter,topic,clo,approval);
 classifyBody.append(grid);

 const meta=document.createElement('div');
 meta.className='question-create-meta-row wide';
 if(origin)meta.append(origin);
 compactScope(scope);
 meta.append(scope);

 actions.classList.add('question-create-actions');
 form.append(compose,classify,meta,actions);
 return true;
}

function enhance(){
 const context=questionFormContext();
 if(!context)return;
 const {form,mode}=context;
 if(form.dataset.aicloCreateLayout!=='1'){
  if(mode==='create'){
   forceCurrentBankDefault(form);
   buildModeSwitch(form);
  }
  if(!moveFields(form))return;
  form.dataset.aicloCreateLayout='1';
  form.dataset.aicloQuestionFormMode=mode;
 }
 arrangeMeta(form);
}

function queueEnhance(){
 if(queued)return;
 queued=true;
 requestAnimationFrame(()=>{queued=false;enhance()});
}

document.addEventListener('DOMContentLoaded',()=>{
 enhance();
 const host=document.querySelector('#content');
 if(host)new MutationObserver(queueEnhance).observe(host,{childList:true,subtree:true});
});

window.AICLO_QUESTION_FORM_LAYOUT=Object.freeze({enhance});
})();
