/* AI-CLO PTITHCM V11 — lazy loader for heavy office export/import libraries. */
(() => {
'use strict';

const sources={
 xlsx:'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js',
 zip:'https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js',
 exceljs:'https://cdn.jsdelivr.net/npm/exceljs@4.4.0/dist/exceljs.min.js'
};
const pending=new Map();
const ready=kind=>kind==='xlsx'?!!window.XLSX:kind==='zip'?!!window.JSZip:!!window.ExcelJS;

function load(kind){
 if(ready(kind))return Promise.resolve(kind==='xlsx'?window.XLSX:window.JSZip);
 if(pending.has(kind))return pending.get(kind);
 const promise=new Promise((resolve,reject)=>{
  const script=document.createElement('script');
  script.src=sources[kind];
  script.async=true;
  script.dataset.aicloOfficeLib=kind;
  script.onload=()=>ready(kind)?resolve(kind==='xlsx'?window.XLSX:kind==='zip'?window.JSZip:window.ExcelJS):reject(new Error(`Không khởi tạo được thư viện ${kind}.`));
  script.onerror=()=>reject(new Error(`Không tải được thư viện ${kind}.`));
  document.head.appendChild(script);
 }).catch(error=>{pending.delete(kind);throw error});
 pending.set(kind,promise);
 return promise;
}

const api=Object.freeze({
 xlsx:()=>load('xlsx'),
 zip:()=>load('zip'),
 exceljs:()=>load('exceljs'),
 all:()=>Promise.all([load('xlsx'),load('zip')]),
 isReady:kind=>ready(kind)
});
window.AICLO_OFFICE_LIBS=api;

function requirements(target,eventType){
 if(!(target instanceof Element))return [];
 if(eventType==='change'&&target.matches('#bulkQuestionFile'))return ['xlsx'];
 const button=target.closest('button,#downloadBulkTemplate,#downloadAnswers,#downloadFinalZip,[data-docx],[data-bm08]');
 if(!button)return [];
 if(button.matches('#downloadFinalZip'))return ['xlsx','zip'];
 if(button.matches('#downloadBulkTemplate,#downloadAnswers'))return ['xlsx'];
 if(button.matches('[data-docx],[data-bm08],#downloadBM06'))return ['zip'];
 return [];
}

async function replayAfterLoad(event){
 const target=event.target instanceof Element?event.target:null;
 const kinds=requirements(target,event.type).filter(kind=>!ready(kind));
 if(!kinds.length)return;
 const control=event.type==='change'?target:target?.closest('button,#downloadBulkTemplate,#downloadAnswers,#downloadFinalZip,[data-docx],[data-bm08]');
 if(!control||control.dataset.aicloOfficeLoading==='1')return;
 event.preventDefault();
 event.stopImmediatePropagation();
 control.dataset.aicloOfficeLoading='1';
 const wasDisabled='disabled' in control?control.disabled:false;
 if('disabled' in control)control.disabled=true;
 try{
  await Promise.all(kinds.map(load));
  delete control.dataset.aicloOfficeLoading;
  if('disabled' in control)control.disabled=wasDisabled;
  if(event.type==='change')control.dispatchEvent(new Event('change',{bubbles:true}));
  else control.click();
 }catch(error){
  delete control.dataset.aicloOfficeLoading;
  if('disabled' in control)control.disabled=wasDisabled;
  console.error('AI-CLO office library load failed',error);
  window.toast?.('Không tải được thư viện xuất/nhập tệp. Vui lòng thử lại.',true);
 }
}

document.addEventListener('click',replayAfterLoad,true);
document.addEventListener('change',replayAfterLoad,true);
})();
