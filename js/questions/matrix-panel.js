/* AI-CLO PTITHCM V11.6.3
   Question bank matrix + compact action layout helpers.
   - Chapter / Topic rows × CLO columns.
   - Bulk import is moved from the bank list into the Add question workspace.
   - Gemini/Academy provenance stays visible after filtering and pagination.
   - Hovering question content shows the full question in a floating preview.
   - No schema changes. */
(()=>{
'use strict';

const byId=(arr,id)=>arr.find(x=>String(x.id)===String(id));
const currentBank=()=>window.AICLO_V105?.activeBank?.()||'practice';
const inBank=(scope,bank)=>window.v105QuestionInBank?window.v105QuestionInBank(scope,bank):(scope===bank||scope==='both');
const bankLabel=bank=>bank==='secure_exam'?'Đề thi - bảo mật':'Luyện tập - kiểm tra';
let questionMetaSubject=null,questionMetaPromise=null,questionMetaLoadedAt=0;
let hoverCard=null,hoverTarget=null,enhanceQueued=false;

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

function removeListBulkImport(){
 document.querySelector('#bulkImportQ')?.remove();
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

function isAddQuestionWorkspace(){
 const form=document.querySelector('#qForm');
 const title=String(document.querySelector('#pageTitle')?.textContent||'').trim().toLowerCase();
 return !!form&&title.includes('thêm câu hỏi');
}

function ensureBulkImportInsideQuestionForm(){
 if(!isAddQuestionWorkspace()||document.querySelector('#questionBulkImportInside'))return;
 const form=document.querySelector('#qForm');
 const box=document.createElement('div');
 box.className='wide question-create-import';
 box.innerHTML=`<div><b>Thêm nhiều câu hỏi</b><small>Nếu đã chuẩn bị danh sách, bạn có thể nhập nhiều câu từ Excel thay vì tạo từng câu.</small></div><button id="questionBulkImportInside" type="button" class="secondary">⇧ Nhập hàng loạt từ Excel</button>`;
 form.prepend(box);
 const button=box.querySelector('#questionBulkImportInside');
 button.addEventListener('click',async()=>{
  const oldText=button.textContent;button.disabled=true;button.textContent='Đang mở…';
  try{
   if(typeof v96QuestionSets!=='function')throw new Error('Chưa tải được dữ liệu học phần.');
   const sets=await v96QuestionSets();
   if(typeof window.v102BulkImportQuestions!=='function')throw new Error('Chưa tải được chức năng nhập hàng loạt.');
   await window.v102BulkImportQuestions(sets);
  }catch(ex){err(ex);button.disabled=false;button.textContent=oldText}
 });
}

async function loadQuestionMeta(force=false){
 const sid=state.subjectId;
 if(!sid)return new Map();
 const fresh=questionMetaSubject===sid&&questionMetaPromise&&Date.now()-questionMetaLoadedAt<30000;
 if(fresh&&!force)return questionMetaPromise;
 questionMetaSubject=sid;questionMetaLoadedAt=Date.now();
 questionMetaPromise=(async()=>{
  const query=contentFilter(db.from('questions').select('id,origin_type,is_official,content'),sid);
  const {data,error}=await query;
  if(error)throw error;
  return new Map((data||[]).map(x=>[String(x.id),x]));
 })();
 return questionMetaPromise;
}

function originBadgeHtml(meta){
 if(meta?.origin_type==='gemini')return '<br><span class="badge question-origin gemini question-origin-list">✦ Gemini hỗ trợ</span>';
 if(meta?.origin_type==='academy')return `<br><span class="badge question-origin academy question-origin-list">🏛 Câu hỏi Học viện</span><br><span class="badge ${meta.is_official?'green':'red'} question-origin-list-state">${meta.is_official?'Đã xác nhận':'Chờ xác nhận'}</span>`;
 return '';
}

async function decorateQuestionOrigins(){
 const rows=[...document.querySelectorAll('#qrows tr')].filter(row=>row.querySelector('[data-detail]'));
 if(!rows.length)return;
 let metaMap=await loadQuestionMeta();
 if(rows.some(row=>{const id=row.querySelector('[data-detail]')?.dataset.detail;return id&&!metaMap.has(String(id))}))metaMap=await loadQuestionMeta(true);
 for(const row of rows){
  const detail=row.querySelector('[data-detail]'),id=detail?.dataset.detail,meta=metaMap.get(String(id||'')),cell=row.querySelector('.q-code-cell');
  if(!cell||!meta)continue;
  if(meta.origin_type==='lecturer')continue;
  const existing=[...cell.querySelectorAll('.question-origin')].some(el=>el.classList.contains(meta.origin_type));
  if(!existing)cell.insertAdjacentHTML('beforeend',originBadgeHtml(meta));
  if(meta.origin_type==='academy'){
   const statusText=meta.is_official?'Đã xác nhận':'Chờ xác nhận';
   if(!cell.textContent.includes(statusText))cell.insertAdjacentHTML('beforeend',`<br><span class="badge ${meta.is_official?'green':'red'} question-origin-list-state">${statusText}</span>`);
  }
 }
}

function ensureHoverCard(){
 if(hoverCard&&document.body.contains(hoverCard))return hoverCard;
 hoverCard=document.createElement('div');
 hoverCard.id='questionFullHover';hoverCard.className='qbank-question-hover';hoverCard.hidden=true;hoverCard.setAttribute('aria-hidden','true');
 document.body.appendChild(hoverCard);
 return hoverCard;
}

function hideQuestionHover(){
 if(!hoverCard)return;
 hoverTarget=null;hoverCard.hidden=true;hoverCard.setAttribute('aria-hidden','true');
}

function positionQuestionHover(target){
 const card=ensureHoverCard(),rect=target.getBoundingClientRect(),pad=14,gap=9;
 const width=Math.min(560,Math.max(320,window.innerWidth-pad*2));
 card.style.width=`${width}px`;card.style.left='0px';card.style.top='0px';card.hidden=false;card.style.visibility='hidden';
 const height=Math.min(card.scrollHeight,window.innerHeight*0.56);
 let left=Math.min(Math.max(pad,rect.left),window.innerWidth-width-pad);
 let top=rect.bottom+gap;
 if(top+height>window.innerHeight-pad)top=Math.max(pad,rect.top-height-gap);
 card.style.left=`${Math.round(left)}px`;card.style.top=`${Math.round(top)}px`;card.style.visibility='visible';
}

async function showQuestionHover(target){
 if(window.matchMedia?.('(hover: none)').matches)return;
 hoverTarget=target;
 const id=target.dataset.detail;
 let content='';
 try{const map=await loadQuestionMeta();content=map.get(String(id||''))?.content||''}catch{}
 if(hoverTarget!==target)return;
 content=content||String(target.textContent||'').trim();
 const card=ensureHoverCard();
 card.innerHTML='<small>NỘI DUNG ĐẦY ĐỦ</small><div class="qbank-question-hover-content"></div>';
 card.querySelector('.qbank-question-hover-content').textContent=content;
 card.setAttribute('aria-hidden','false');
 positionQuestionHover(target);
 try{renderMath(card)}catch{}
 requestAnimationFrame(()=>{if(hoverTarget===target)positionQuestionHover(target)});
}

function bindQuestionHover(host){
 if(host.dataset.aicloQuestionHover==='1')return;
 host.dataset.aicloQuestionHover='1';
 host.addEventListener('pointerover',event=>{
  const target=event.target.closest?.('.question-summary');
  if(!target||!host.contains(target)||target.contains(event.relatedTarget))return;
  showQuestionHover(target);
 });
 host.addEventListener('pointerout',event=>{
  const target=event.target.closest?.('.question-summary');
  if(!target||target.contains(event.relatedTarget))return;
  if(hoverTarget===target)hideQuestionHover();
 });
 window.addEventListener('scroll',hideQuestionHover,true);
 window.addEventListener('resize',hideQuestionHover);
}

function enhance(){
 ensureBulkImportInsideQuestionForm();
 if(!document.querySelector('.v105-bank-tabs')||!document.querySelector('.bank-actions'))return;
 compactBankHeader();removeListBulkImport();ensureMatrixButton();
 decorateQuestionOrigins().catch(ex=>console.warn('Không thể gắn nguồn câu hỏi',ex));
}

function queueEnhance(){
 if(enhanceQueued)return;
 enhanceQueued=true;
 requestAnimationFrame(()=>{enhanceQueued=false;enhance()});
}

window.AICLO_OPEN_QUESTION_BANK_MATRIX=openQuestionBankMatrix;

document.addEventListener('DOMContentLoaded',()=>{
 const host=document.querySelector('#content');
 if(host)bindQuestionHover(host);
 enhance();
 if(!host)return;
 const observer=new MutationObserver(queueEnhance);
 observer.observe(host,{childList:true,subtree:true});
});
})();
