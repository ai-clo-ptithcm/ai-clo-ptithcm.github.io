/* AI-CLO PTITHCM V12.1 — persist/restore assessment blueprint on the server. */
(()=>{
'use strict';
const VERSION='12.1.0';
const PENDING_TTL=30*60*1000;
const userKey=()=>state?.user?.id||'user';
const subjectKey=()=>state?.subjectId||'subject';
const pendingKey=()=>`aiclo:v121:pending-blueprint:${userKey()}:${subjectKey()}`;
const activeKey=()=>`aiclo:v118:active:${userKey()}:${subjectKey()}`;
const draftKey=(examId)=>`aiclo:v118:builder:${userKey()}:${subjectKey()}:chapter_test:${examId}`;
const missingBlueprintColumn=(error)=>/structure_mode|question_blueprint|column.*does not exist|PGRST204/i.test(String(error?.message||error||''));

function readJson(storage,key){
 try{return JSON.parse(storage.getItem(key)||'null')}catch{return null}
}
function writeJson(storage,key,value){
 try{storage.setItem(key,JSON.stringify(value));return true}catch{return false}
}
function readPending(){
 const x=readJson(sessionStorage,pendingKey());
 if(!x)return null;
 if(!x.updated_at||Date.now()-x.updated_at>PENDING_TTL){
  try{sessionStorage.removeItem(pendingKey())}catch{}
  return null;
 }
 return x;
}
function clearPending(){try{sessionStorage.removeItem(pendingKey())}catch{}}

function captureWizardBlueprint(){
 const form=document.querySelector('#cwForm');
 if(!form)return;
 const current=readPending()||{matrix:{}};
 const mode=form.querySelector('[name="structure_mode"]:checked')?.value;
 if(mode==='topic_clo'||mode==='chapter_pool')current.structureMode=mode;
 const cells=[...form.querySelectorAll('.cw-matrix-input[data-key]')];
 if(cells.length){
  const matrix={};
  cells.forEach(input=>{matrix[input.dataset.key]=Math.max(0,+input.value||0)});
  current.matrix=matrix;
 }
 current.updated_at=Date.now();
 writeJson(sessionStorage,pendingKey(),current);
}

function activeExamId(){
 const x=readJson(localStorage,activeKey());
 return x?.examId||null;
}
function readDraft(examId){return readJson(localStorage,draftKey(examId))||null}
function validDraftBlueprint(draft){
 return !!draft&&['topic_clo','chapter_pool'].includes(draft.structureMode)&&draft.matrix&&typeof draft.matrix==='object'&&Object.keys(draft.matrix).length>0;
}
function serverBlueprintPayload(mode,matrix,source){
 return {
  structure_mode:mode,
  question_blueprint:{version:1,source,matrix:{...matrix}},
 };
}
async function saveServerBlueprint(examId,mode,matrix,source='frontend-v12.1'){
 if(!examId||!['topic_clo','chapter_pool'].includes(mode)||!matrix||!Object.keys(matrix).length)return false;
 const {error}=await db.from('exams').update(serverBlueprintPayload(mode,matrix,source)).eq('id',examId);
 if(error){
  if(missingBlueprintColumn(error)){
   console.warn('AI-CLO V12.1: Supabase chưa chạy assessment-v12.1-migration.sql; blueprint vẫn dùng local fallback.');
   return false;
  }
  throw error;
 }
 return true;
}
function mergeBlueprintIntoDraft(examId,mode,matrix){
 const old=readDraft(examId)||{};
 const next={...old,type:'chapter_test',examId,structureMode:mode,matrix:{...matrix},collapsed:old.collapsed||{},updated_at:old.updated_at||Date.now()};
 writeJson(localStorage,draftKey(examId),next);
}

async function canonicalBlueprint(examId){
 const local=readDraft(examId);
 const {data,error}=await db.from('exams').select('id,structure_mode,question_blueprint').eq('id',examId).maybeSingle();
 if(error){
  if(missingBlueprintColumn(error))return validDraftBlueprint(local)?{mode:local.structureMode,matrix:local.matrix,source:'local-fallback'}:null;
  throw error;
 }
 if(!data)return null;
 const serverMatrix=data.question_blueprint?.matrix;
 const serverValid=['topic_clo','chapter_pool'].includes(data.structure_mode)&&serverMatrix&&typeof serverMatrix==='object'&&Object.keys(serverMatrix).length>0;
 const canRecoverLocal=validDraftBlueprint(local)&&(!serverValid||data.question_blueprint?.source==='backfill-v12.1');
 if(canRecoverLocal){
  await saveServerBlueprint(examId,local.structureMode,local.matrix,'client-recovery-v12.1');
  return {mode:local.structureMode,matrix:local.matrix,source:'client-recovery-v12.1'};
 }
 return serverValid?{mode:data.structure_mode,matrix:serverMatrix,source:data.question_blueprint?.source||'server'}:null;
}

async function persistActiveDraftBlueprint(){
 const examId=activeExamId();
 if(!examId)return;
 const draft=readDraft(examId);
 if(!validDraftBlueprint(draft))return;
 try{await saveServerBlueprint(examId,draft.structureMode,draft.matrix,'builder-v12.1')}
 catch(error){console.error('AI-CLO V12.1: không lưu được blueprint',error)}
}

function wrapBuilder(){
 const current=window.AICLO_EXAM_BUILDER;
 if(!current||typeof current.open!=='function'||current.__v121Wrapped)return;
 const baseOpen=current.open.bind(current);
 const wrappedOpen=async function(type='chapter_test',examId=null){
  if(type==='final_exam')clearPending();
  if(type==='chapter_test'&&examId){
   const pending=readPending();
   if(pending&&['topic_clo','chapter_pool'].includes(pending.structureMode)&&pending.matrix&&Object.keys(pending.matrix).length){
    try{
     await saveServerBlueprint(examId,pending.structureMode,pending.matrix,'wizard-v12.1');
     mergeBlueprintIntoDraft(examId,pending.structureMode,pending.matrix);
    }catch(error){console.error('AI-CLO V12.1: không lưu được blueprint từ wizard',error)}
    clearPending();
   }else{
    try{
     const canonical=await canonicalBlueprint(examId);
     if(canonical)mergeBlueprintIntoDraft(examId,canonical.mode,canonical.matrix);
    }catch(error){console.error('AI-CLO V12.1: không khôi phục được blueprint',error)}
   }
  }
  return baseOpen(type,examId);
 };
 window.AICLO_EXAM_BUILDER=Object.freeze({
  ...current,
  version:VERSION,
  open:wrappedOpen,
  __v121Wrapped:true,
  __v121Base:current,
 });
}

function onClickCapture(event){
 if(event.target?.closest?.('#cwNext'))captureWizardBlueprint();
 if(event.target?.closest?.('#ubDraw,#ubSaveDraft,#ubPublish'))setTimeout(persistActiveDraftBlueprint,0);
}
function onChangeCapture(event){
 if(event.target?.closest?.('#cwForm'))captureWizardBlueprint();
}
function onSubmit(event){
 if(event.target?.id==='ubStructureForm')setTimeout(persistActiveDraftBlueprint,0);
}
function init(){
 wrapBuilder();
 document.addEventListener('click',onClickCapture,true);
 document.addEventListener('change',onChangeCapture,true);
 document.addEventListener('input',onChangeCapture,true);
 document.addEventListener('submit',onSubmit,false);
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
window.AICLO_ASSESSMENT_V121=Object.freeze({version:VERSION,captureWizardBlueprint,persistActiveDraftBlueprint});
})();
