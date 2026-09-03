/* AI-CLO PTITHCM V11.6.19 — filtered bulk selection and admin bulk actions. */
(()=>{
'use strict';

const selected=new Set();
let currentBar=null,drag=null,enhanceQueued=false;
const isAdmin=()=>typeof role==='function'&&role()==='admin';
const scopeLabel=v=>v==='secure_exam'?'Đề thi - bảo mật':v==='both'?'Cả hai':'Luyện tập - kiểm tra';
const approvalLabel=v=>({draft:'Bản nháp',pending:'Chờ duyệt',approved:'Đã duyệt',archived:'Lưu trữ'}[v]||v);
const originLabel=v=>v==='gemini'?'Gemini hỗ trợ':v==='academy'?'Đề xuất câu hỏi Học viện':'Giảng viên biên soạn';

function barMarkup(){
 return `<b><span id="selectedQuestionCount">0</span> câu đã chọn</b><div class="bulk-selection-actions"><button id="clearQuestionSelection" type="button" class="secondary">Bỏ chọn</button><button id="selectAllFilteredQuestions" type="button" class="secondary">Chọn tất cả</button><button id="bulkDeleteQuestions" type="button" class="danger">Xóa</button><button id="bulkMoreActions" type="button" class="primary">Thao tác khác…</button></div>`;
}
function applyVisibleSelection(){
 document.querySelectorAll('#qrows [data-select-question]').forEach(check=>{check.checked=selected.has(check.dataset.selectQuestion)});
}
function syncBar(){
 const bar=document.querySelector('#bulkQuestionBar');if(!bar)return;
 if(bar!==currentBar||bar.dataset.aicloBulkV11619!=='1'){
  currentBar=bar;selected.clear();bar.innerHTML=barMarkup();bar.dataset.aicloBulkV11619='1';
 }
 const count=bar.querySelector('#selectedQuestionCount');if(count)count.textContent=String(selected.size);
 bar.classList.toggle('hidden',selected.size===0);applyVisibleSelection();
}
function queueSync(){if(enhanceQueued)return;enhanceQueued=true;requestAnimationFrame(()=>{enhanceQueued=false;syncBar()})}
function clearSelection(){selected.clear();syncBar()}
function ids(){return [...selected]}

async function filteredManageableQuestions(){
 const fields='id,display_code,content,chapter_id,topic_id,clo_id,approval_status,created_by,question_scope,is_official,origin_type,ai_batch_id';
 let query=db.from('questions').select(fields);
 if(typeof contentFilter==='function')query=contentFilter(query);
 else if(state.subjectId)query=query.eq('subject_id',state.subjectId);
 const {data,error}=await query;if(error)throw error;
 const search=String(document.querySelector('#qsearch')?.value||'').trim().toLowerCase();
 const chapter=document.querySelector('#qchapterFilter')?.value||'all';
 const topic=document.querySelector('#qtopicFilter')?.value||'all';
 const clo=document.querySelector('#qcloFilter')?.value||'all';
 const approval=document.querySelector('#qapprovalFilter')?.value||'all';
 const creator=document.querySelector('#qcreatorFilter')?.value||'all';
 const bank=window.AICLO_V105?.activeBank?.()||'practice';
 return (data||[]).filter(x=>{
  if(window.AICLO_V105?.inBank&&!window.AICLO_V105.inBank(x.question_scope,bank))return false;
  if(search&&!String(x.content||'').toLowerCase().includes(search)&&!String(typeof questionCode==='function'?questionCode(x):x.display_code||'').toLowerCase().includes(search))return false;
  if(chapter!=='all'&&x.chapter_id!==chapter)return false;
  if(topic!=='all'&&x.topic_id!==topic)return false;
  if(clo!=='all'&&x.clo_id!==clo)return false;
  if(approval!=='all'&&x.approval_status!==approval)return false;
  if(creator!=='all'&&x.created_by!==(creator==='mine'?state.user.id:creator))return false;
  return typeof v96CanManage==='function'?v96CanManage(x):true;
 });
}
async function selectAllFiltered(button){
 const old=button.textContent;button.disabled=true;button.textContent='Đang chọn…';
 try{
  const rows=await filteredManageableQuestions();rows.forEach(x=>selected.add(String(x.id)));syncBar();
  toast(`Đã chọn ${rows.length} câu trong kết quả lọc hiện tại`);
 }catch(ex){err(ex)}finally{button.disabled=false;button.textContent=old}
}

function modalMarkup(count){
 return `<form id="bulkQuestionActionForm" class="bulk-action-form">
  <div class="bulk-action-note"><b>${count} câu đã chọn</b><span>Chỉ các mục khác “Không thay đổi” mới được cập nhật.</span></div>
  <label class="field"><span>Nơi lưu câu hỏi</span><select name="question_scope"><option value="">Không thay đổi</option><option value="practice">Luyện tập - kiểm tra</option><option value="secure_exam">🔒 Đề thi - bảo mật</option><option value="both">Cả hai</option></select></label>
  <label class="field"><span>Trạng thái</span><select name="approval_status"><option value="">Không thay đổi</option><option value="draft">Bản nháp</option><option value="pending">Chờ duyệt</option><option value="approved">Đã duyệt</option><option value="archived">Lưu trữ</option></select></label>
  ${isAdmin()?`<label class="field"><span>Nguồn câu hỏi</span><select name="origin_type"><option value="">Không thay đổi</option><option value="lecturer">✍️ Giảng viên biên soạn</option><option value="gemini">✦ Gemini hỗ trợ</option><option value="academy">🏛 Đề xuất câu hỏi Học viện</option></select></label>`:''}
  <div id="bulkAcademyWarning" class="bulk-action-warning" hidden>Chọn nguồn Học viện sẽ đưa câu vào Ngân hàng đề thi – bảo mật và trạng thái Chờ duyệt. Câu Học viện đã được xác nhận sẽ không bị đổi nguồn hàng loạt.</div>
  <div id="bulkActionError" class="bulk-action-error" hidden></div>
  <div class="bulk-action-footer"><button id="cancelBulkAction" type="button" class="secondary">Hủy</button><button id="saveBulkAction" type="submit" class="primary">Lưu thay đổi</button></div>
 </form>`;
}
function clamp(v,min,max){return Math.max(min,Math.min(max,v))}
function setGeometry(dialog,left,top,width,height){
 dialog.style.left=`${Math.round(left)}px`;dialog.style.top=`${Math.round(top)}px`;dialog.style.width=`${Math.round(width)}px`;dialog.style.height=`${Math.round(height)}px`;dialog.style.right='auto';dialog.style.bottom='auto';dialog.style.transform='none';
}
function resetGeometry(dialog){
 if(matchMedia('(max-width:700px)').matches){['left','top','right','bottom','width','height','transform'].forEach(p=>dialog.style[p]='');return}
 const pad=16,width=Math.min(620,innerWidth-pad*2),height=Math.min(430,innerHeight-pad*2);setGeometry(dialog,(innerWidth-width)/2,(innerHeight-height)/2,width,height);
}
function installDrag(dialog){
 const head=dialog.querySelector('.modal-head');if(!head)return;
 const down=e=>{if(matchMedia('(max-width:700px)').matches||e.button!==0||e.target.closest('button,input,select,textarea,a'))return;const r=dialog.getBoundingClientRect();drag={id:e.pointerId,dx:e.clientX-r.left,dy:e.clientY-r.top};setGeometry(dialog,r.left,r.top,r.width,r.height);head.classList.add('dragging');head.setPointerCapture?.(e.pointerId);e.preventDefault()};
 const move=e=>{if(!drag||drag.id!==e.pointerId)return;const r=dialog.getBoundingClientRect(),pad=8;setGeometry(dialog,clamp(e.clientX-drag.dx,pad,Math.max(pad,innerWidth-r.width-pad)),clamp(e.clientY-drag.dy,pad,Math.max(pad,innerHeight-r.height-pad)),r.width,r.height)};
 const up=e=>{if(!drag||drag.id!==e.pointerId)return;drag=null;head.classList.remove('dragging');try{head.releasePointerCapture?.(e.pointerId)}catch{}};
 head.addEventListener('pointerdown',down);head.addEventListener('pointermove',move);head.addEventListener('pointerup',up);head.addEventListener('pointercancel',up);
 const cleanup=()=>{drag=null;head.classList.remove('dragging');head.removeEventListener('pointerdown',down);head.removeEventListener('pointermove',move);head.removeEventListener('pointerup',up);head.removeEventListener('pointercancel',up);dialog.classList.remove('quick-edit-modal','bulk-actions-modal');['left','top','right','bottom','width','height','transform'].forEach(p=>dialog.style[p]='')};
 dialog.addEventListener('close',cleanup,{once:true});
}

async function loadSelectedQuestions(){
 const list=ids();if(!list.length)return [];
 const {data,error}=await db.from('questions').select('id,origin_type,is_official,question_scope,approval_status').in('id',list);if(error)throw error;return data||[];
}
function describeChanges(v){
 const parts=[];if(v.question_scope)parts.push(`Nơi lưu → ${scopeLabel(v.question_scope)}`);if(v.approval_status)parts.push(`Trạng thái → ${approvalLabel(v.approval_status)}`);if(v.origin_type)parts.push(`Nguồn → ${originLabel(v.origin_type)}`);return parts;
}
async function applyBulkChanges(values){
 const rows=await loadSelectedQuestions();if(!rows.length)throw new Error('Không còn câu hỏi nào trong nhóm đã chọn.');
 const now=new Date().toISOString(),base={updated_at:now};
 if(values.question_scope)base.question_scope=values.question_scope;
 if(values.approval_status){base.approval_status=values.approval_status;base.status=values.approval_status==='approved'?'active':'draft';base.approved_by=values.approval_status==='approved'?state.user.id:null;base.approved_at=values.approval_status==='approved'?now:null}
 let target=rows,skippedOfficial=0;
 if(values.origin_type){
  if(!isAdmin())throw new Error('Chỉ Admin được hiệu chỉnh nguồn hàng loạt.');
  const official=rows.filter(x=>x.is_official),editable=rows.filter(x=>!x.is_official);skippedOfficial=official.length;target=editable;
  if(values.origin_type==='academy'){
   Object.assign(base,{origin_type:'academy',question_scope:'secure_exam',approval_status:'pending',status:'draft',approved_by:null,approved_at:null});
  }else base.origin_type=values.origin_type;
 }
 if(!Object.keys(base).some(k=>k!=='updated_at'))throw new Error('Hãy chọn ít nhất một nội dung cần thay đổi.');
 if(target.length){const {error}=await db.from('questions').update(base).in('id',target.map(x=>x.id));if(error)throw error}
 window.logActivity?.('update','question',null,`Cập nhật hàng loạt ${target.length} câu: ${describeChanges(values).join(' · ')}`, 'success', state.subjectId,{count:target.length,changes:values,skipped_official:skippedOfficial});
 return {updated:target.length,skippedOfficial};
}

async function openBulkWindow(){
 if(!selected.size)return toast('Chưa chọn câu hỏi',true);
 captureQuestionFilters?.();modal(`AI-CLO | Thao tác hàng loạt · ${selected.size} câu`,modalMarkup(selected.size));
 const dialog=document.querySelector('#modal');dialog.classList.add('quick-edit-modal','bulk-actions-modal');resetGeometry(dialog);installDrag(dialog);
 const form=document.querySelector('#bulkQuestionActionForm'),cancel=document.querySelector('#cancelBulkAction'),source=form?.elements.namedItem('origin_type'),scope=form?.elements.namedItem('question_scope'),approval=form?.elements.namedItem('approval_status'),warning=document.querySelector('#bulkAcademyWarning'),errorBox=document.querySelector('#bulkActionError'),save=document.querySelector('#saveBulkAction');
 cancel.onclick=closeModal;
 if(source)source.onchange=()=>{const academy=source.value==='academy';warning.hidden=!academy;if(academy){scope.value='secure_exam';approval.value='pending'}scope.disabled=academy;approval.disabled=academy};
 form.onsubmit=async e=>{
  e.preventDefault();const fd=new FormData(form),values={question_scope:String(fd.get('question_scope')||''),approval_status:String(fd.get('approval_status')||''),origin_type:String(fd.get('origin_type')||'')};
  if(source?.value==='academy'){values.question_scope='secure_exam';values.approval_status='pending'}
  const changes=describeChanges(values);if(!changes.length){errorBox.textContent='Hãy chọn ít nhất một nội dung cần thay đổi.';errorBox.hidden=false;return}
  const rows=await loadSelectedQuestions(),officialSourceSkip=values.origin_type?rows.filter(x=>x.is_official).length:0;
  const message=`Cập nhật ${rows.length-officialSourceSkip} câu${officialSourceSkip?` · giữ nguyên nguồn của ${officialSourceSkip} câu Học viện đã xác nhận`:''}?\n${changes.join(' · ')}`;
  if(!await confirmAction('Lưu thao tác hàng loạt',message,{confirmLabel:'Lưu thay đổi'}))return;
  save.disabled=true;save.textContent='Đang lưu…';errorBox.hidden=true;
  try{const result=await applyBulkChanges(values);closeModal();clearSelection();toast(`Đã cập nhật ${result.updated} câu${result.skippedOfficial?`; ${result.skippedOfficial} câu Học viện chính thức được giữ nguyên nguồn`:''}`);await backToQuestionList()}catch(ex){console.error(ex);errorBox.textContent=ex?.message||'Không thể cập nhật câu hỏi.';errorBox.hidden=false;save.disabled=false;save.textContent='Lưu thay đổi'}
 };
}

function onClick(e){
 const check=e.target.closest?.('#qrows [data-select-question]');if(check){check.checked?selected.add(check.dataset.selectQuestion):selected.delete(check.dataset.selectQuestion);requestAnimationFrame(syncBar);return}
 const clear=e.target.closest?.('#clearQuestionSelection');if(clear){e.preventDefault();e.stopPropagation();clearSelection();return}
 const all=e.target.closest?.('#selectAllFilteredQuestions');if(all){e.preventDefault();e.stopPropagation();selectAllFiltered(all);return}
 const more=e.target.closest?.('#bulkMoreActions');if(more){e.preventDefault();e.stopPropagation();openBulkWindow();return}
}
document.addEventListener('click',onClick,true);
document.addEventListener('change',e=>{if(!e.isTrusted)return;if(e.target?.matches?.('#qchapterFilter,#qtopicFilter,#qcloFilter,#qapprovalFilter,#qcreatorFilter'))clearSelection()},true);
document.addEventListener('input',e=>{if(e.isTrusted&&e.target?.matches?.('#qsearch'))clearSelection()},true);
document.addEventListener('click',e=>{if(e.isTrusted&&e.target?.closest?.('[data-bank-tab]'))clearSelection()},true);
document.addEventListener('DOMContentLoaded',()=>{const host=document.querySelector('#content');if(host)new MutationObserver(queueSync).observe(host,{childList:true,subtree:true});queueSync()});

window.AICLO_QUESTION_BULK_SELECTION=Object.freeze({ids,clear:clearSelection,sync:syncBar,selectAll:()=>filteredManageableQuestions().then(rows=>{rows.forEach(x=>selected.add(String(x.id)));syncBar();return ids()})});
})();
