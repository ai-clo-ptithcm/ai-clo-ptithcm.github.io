/* AI-CLO PTITHCM V11.6.1
   Question bank matrix: Chapter / Topic rows × CLO columns.
   Uses the same question-bank dataset as the current course view; no schema changes. */
(()=>{
'use strict';

const byId=(arr,id)=>arr.find(x=>String(x.id)===String(id));
const currentBank=()=>window.AICLO_V105?.activeBank?.()||'practice';
const inBank=(scope,bank)=>window.v105QuestionInBank?window.v105QuestionInBank(scope,bank):(scope===bank||scope==='both');
const bankLabel=bank=>bank==='secure_exam'?'Đề thi - bảo mật':'Luyện tập - kiểm tra';

function matrixKey(chapterId,topicId,cloId){return `${chapterId||'__none__'}|${topicId||'__none__'}|${cloId||'__none__'}`}

async function loadQuestionMatrix(){
 if(typeof v96QuestionSets!=='function')throw new Error('Chưa tải được dữ liệu ngân hàng câu hỏi.');
 const sets=await v96QuestionSets();
 const bank=currentBank();
 const items=(sets.items||[]).filter(x=>inBank(x.question_scope,bank));
 const chapters=sets.ch||[],topics=sets.topics||[],clos=sets.clos||[];
 const counts=new Map();
 let structured=0;
 for(const qx of items){
  if(qx.chapter_id&&qx.clo_id){
   counts.set(matrixKey(qx.chapter_id,qx.topic_id,qx.clo_id),(counts.get(matrixKey(qx.chapter_id,qx.topic_id,qx.clo_id))||0)+1);
   structured++;
  }
 }
 return {bank,items,chapters,topics,clos,counts,structured};
}

function matrixHtml(data){
 const {bank,items,chapters,topics,clos,counts,structured}=data;
 const unstructured=Math.max(0,items.length-structured);
 const cloTotals=new Map(clos.map(c=>[String(c.id),0]));
 let matrixTotal=0;
 const groups=[];

 for(const chapter of chapters){
  const chapterTopics=topics.filter(t=>String(t.chapter_id)===String(chapter.id));
  const hasNoTopic=items.some(q=>String(q.chapter_id)===String(chapter.id)&&!q.topic_id);
  const rows=[...chapterTopics.map(t=>({id:t.id,name:t.name,order:t.order_index??''}))];
  if(hasNoTopic)rows.push({id:'',name:'Chưa gán mục',order:'—'});

  const rowData=rows.map(topic=>{
   const values={};let total=0;
   for(const clo of clos){
    const n=counts.get(matrixKey(chapter.id,topic.id,clo.id))||0;
    values[String(clo.id)]=n;total+=n;
    cloTotals.set(String(clo.id),(cloTotals.get(String(clo.id))||0)+n);
    matrixTotal+=n;
   }
   return {topic,values,total};
  });
  const chapterTotal=rowData.reduce((s,r)=>s+r.total,0);
  if(rowData.length||chapterTotal)groups.push({chapter,rowData,total:chapterTotal});
 }

 const orphanItems=items.filter(q=>!q.chapter_id&&q.clo_id);
 if(orphanItems.length){
  const values={};let total=0;
  for(const clo of clos){
   const n=orphanItems.filter(q=>String(q.clo_id)===String(clo.id)).length;
   values[String(clo.id)]=n;total+=n;
   cloTotals.set(String(clo.id),(cloTotals.get(String(clo.id))||0)+n);
   matrixTotal+=n;
  }
  groups.push({chapter:{name:'Chưa gán chương',order_index:'—'},rowData:[{topic:{name:'Chưa gán mục',order:'—'},values,total}],total});
 }

 const summary=`<div class="qbank-matrix-summary">
  <div><small>Ngân hàng đang xem</small><b>${esc(bankLabel(bank))}</b></div>
  <div><small>Tổng câu</small><b>${items.length}</b></div>
  <div><small>Đã phân loại</small><b>${structured}</b></div>
  <div><small>Chưa đủ cấu trúc</small><b>${unstructured}</b></div>
 </div>`;

 if(!items.length)return `<div class="qbank-matrix-panel">${summary}<div class="qbank-matrix-empty">Ngân hàng này chưa có câu hỏi.</div></div>`;

 return `<div class="qbank-matrix-panel">
  ${summary}
  <p class="qbank-matrix-note">Ma trận thống kê toàn bộ <b>${esc(bankLabel(bank))}</b> của học phần hiện tại, không phụ thuộc bộ lọc danh sách phía sau.</p>
  <div class="table-wrap qbank-matrix-wrap"><table class="qbank-matrix-table">
   <thead><tr><th>Chương · Mục</th>${clos.map(c=>`<th>${esc(c.code)}</th>`).join('')}<th>Tổng</th></tr></thead>
   <tbody>${groups.map(group=>{
    const chapterCells=clos.map(clo=>{const n=group.rowData.reduce((s,r)=>s+(r.values[String(clo.id)]||0),0);return `<td><b>${n}</b></td>`}).join('');
    return `<tr class="qbank-chapter-row"><td><b>${esc(group.chapter.order_index??'')}${group.chapter.order_index!==undefined&&group.chapter.order_index!==null&&group.chapter.order_index!==''?'. ':''}${esc(group.chapter.name||'—')}</b><small>Tổng chương</small></td>${chapterCells}<td><b>${group.total}</b></td></tr>`+
     group.rowData.map(row=>`<tr class="qbank-topic-row"><td><span>${row.topic.order!==''&&row.topic.order!==undefined?`${esc(row.topic.order)}. `:''}${esc(row.topic.name||'Chưa gán mục')}</span></td>${clos.map(clo=>`<td>${row.values[String(clo.id)]||0}</td>`).join('')}<td><b>${row.total}</b></td></tr>`).join('');
   }).join('')||`<tr><td colspan="${clos.length+2}" class="empty">Chưa có dữ liệu Chương · Mục.</td></tr>`}</tbody>
   <tfoot><tr><th>Tổng</th>${clos.map(clo=>`<th>${cloTotals.get(String(clo.id))||0}</th>`).join('')}<th>${matrixTotal}</th></tr></tfoot>
  </table></div>
  ${unstructured?`<p class="qbank-matrix-warning">Có ${unstructured} câu chưa đủ Chương hoặc CLO nên chưa được phân bổ đầy đủ vào các ô ma trận.</p>`:''}
 </div>`;
}

async function openQuestionBankMatrix(){
 try{
  openDrawer('Ma trận ngân hàng câu hỏi','<div class="qbank-matrix-loading">Đang tổng hợp số lượng câu hỏi…</div>',async()=>{
   try{$('#drawerBody').innerHTML=matrixHtml(await loadQuestionMatrix())}
   catch(ex){$('#drawerBody').innerHTML=`<div class="qbank-matrix-empty">${esc(ex.message||String(ex))}</div>`;err(ex)}
  },{wide:true,eyebrow:'CHƯƠNG · MỤC × CLO'});
 }catch(ex){err(ex)}
}

function compactBankHeader(){
 const tabs=document.querySelector('.v105-bank-tabs'),note=document.querySelector('.v105-bank-note');
 if(tabs)tabs.classList.add('v1161-bank-tabs-compact');
 if(note)note.classList.add('v1161-bank-note-compact');
}

function ensureMatrixButton(){
 const actions=document.querySelector('.bank-actions');
 if(!actions||document.querySelector('#questionBankMatrix'))return;
 const scan=document.querySelector('#scanDuplicates');
 const button=document.createElement('button');
 button.id='questionBankMatrix';button.type='button';button.className='secondary';button.textContent='Ma trận';
 button.title='Xem số lượng câu theo Chương · Mục và CLO';
 button.addEventListener('click',openQuestionBankMatrix);
 if(scan&&scan.parentElement===actions)actions.insertBefore(button,scan);else actions.appendChild(button);
}

function enhance(){
 if(!document.querySelector('.v105-bank-tabs')||!document.querySelector('.bank-actions'))return;
 compactBankHeader();ensureMatrixButton();
}

window.AICLO_OPEN_QUESTION_BANK_MATRIX=openQuestionBankMatrix;

document.addEventListener('DOMContentLoaded',()=>{
 enhance();
 const host=document.querySelector('#content');
 if(!host)return;
 const observer=new MutationObserver(()=>enhance());
 observer.observe(host,{childList:true,subtree:true});
});
})();
