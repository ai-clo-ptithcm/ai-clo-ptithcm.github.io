/* AI-CLO PTITHCM V12.6.40 — question provenance and Academy verification. */
(() => {
'use strict';
const label=value=>value==='gemini'?'✦ AI hỗ trợ':value==='academy'?'🏛 Câu hỏi Học viện':'✍️ Giảng viên biên soạn';
const status=x=>x.origin_type==='academy'?(x.is_official?'Đã được Admin xác nhận':'Chờ Admin xác nhận'):'';
const listOrigins=new Map();
let listSubjectId=null;

function bindOriginField(form,x){
 const target=form.querySelector('.v105-scope-chooser')||form.querySelector('.option-grid');if(!target)return;
 const current=x.origin_type||'lecturer',locked=current==='gemini'&&role()!=='admin';
 const field=document.createElement('label');field.className='field question-origin-field';field.innerHTML=`<span>Nguồn câu hỏi</span><select name="origin_type" ${locked?'disabled':''}><option value="lecturer">Giảng viên biên soạn</option><option value="academy">Câu hỏi Học viện (đề xuất)</option>${current==='gemini'?'<option value="gemini">AI hỗ trợ</option>':''}</select><small class="question-origin-note" hidden></small>${locked?'<input type="hidden" name="origin_type" value="gemini">':''}`;
 target.insertAdjacentElement('beforebegin',field);field.querySelector('select').value=current;
 const note=field.querySelector('.question-origin-note');
 const apply=()=>{
  const value=field.querySelector('select').value,secure=form.querySelector('input[name="question_scope"][value="secure_exam"]'),approval=form.elements.namedItem('approval_status');
  if(value==='academy'){
   if(secure){secure.checked=true;secure.dispatchEvent(new Event('change'))}
   if(approval)approval.value='pending';
   if(note){note.textContent='Câu sẽ chờ Admin xác nhận và chỉ lưu trong Ngân hàng đề thi – bảo mật.';note.hidden=false}
  }else if(note){note.textContent='';note.hidden=true}
 };
 field.querySelector('select').addEventListener('change',apply);apply();
 window.AICLO_QUESTION_FORM_LAYOUT?.enhance?.();
}

const oldForm=window.v96QuestionForm;
window.v96QuestionForm=async function(x={},sets){x=x||{};if(x.is_official&&role()!=='admin')return toast('Câu hỏi Học viện đã xác nhận chỉ Admin được chỉnh sửa',true);await oldForm(x,sets);const form=$('#qForm');if(form)bindOriginField(form,x)};

const oldDetail=window.v96QuestionDetail;
window.v96QuestionDetail=async function(x,sets){
 x=await window.AICLO_QUESTION_STATE?.hydrateQuestion?.(x)||x;await oldDetail(x,sets);const detail=$('#v105Detail');if(!detail)return;
 detail.querySelector('.detail-meta')?.insertAdjacentHTML('beforeend',`<span class="badge question-origin ${x.origin_type||'lecturer'}">${esc(label(x.origin_type))}</span>${status(x)?`<span class="badge ${x.is_official?'green':'red'}">${esc(status(x))}</span>`:''}`);
 if(x.is_official&&role()!=='admin'){['#detailEditQuestion','#detailDeleteQuestion','#saveClassification'].forEach(sel=>$(sel)?.remove());['#detailScope','#detailApproval'].forEach(sel=>{if($(sel))$(sel).disabled=true})}
 const audit=$('#v105Audit');if(audit&&x.verified_at){let verifier='Admin';if(x.verified_by){const {data:p}=await db.from('profiles').select('full_name,email').eq('id',x.verified_by).maybeSingle();verifier=p?.full_name||p?.email||verifier}audit.insertAdjacentHTML('beforeend',`<div><small>Admin xác nhận</small><b>${esc(verifier)} · ${v96Date(x.verified_at)}</b></div>`)}
 if(role()==='admin'&&x.origin_type==='academy'&&!x.is_official){const actions=detail.querySelector('.account-actions');if(actions){actions.insertAdjacentHTML('afterbegin','<button id="rejectAcademyOrigin" class="secondary">Từ chối nguồn Học viện</button><button id="verifyAcademyOrigin" class="primary">✓ Xác nhận câu Học viện</button>');$('#verifyAcademyOrigin').onclick=()=>verify(true);$('#rejectAcademyOrigin').onclick=()=>verify(false)}}
 async function verify(approve){if(!await confirmAction(approve?'Xác nhận câu hỏi Học viện':'Từ chối nguồn Học viện',approve?'Câu sẽ được duyệt, bảo vệ và chỉ lưu trong Ngân hàng đề thi – bảo mật.':'Câu trở lại nguồn Giảng viên biên soạn và trạng thái bản nháp.',{confirmLabel:approve?'Xác nhận':'Từ chối'}))return;let {error}=await db.rpc('verify_academy_question',{p_question_id:x.id,p_approve:approve});if(error)return err(error);window.AICLO_QUESTION_STATE?.invalidate?.(x.id);toast(approve?'Đã xác nhận câu hỏi Học viện':'Đã từ chối nguồn Học viện');backToQuestionList()}
};

function syncOriginBadge(cell,x){
 if(!cell)return;
 const className=`badge question-origin ${x.origin_type||'lecturer'}`;
 let badge=cell.querySelector('.question-origin');
 if(!badge){
  badge=document.createElement('span');
  badge.className=className;
  cell.appendChild(document.createElement('br'));
  cell.appendChild(badge);
 }else badge.className=className;
 badge.textContent=label(x.origin_type);
 let official=cell.querySelector('.question-origin-status');
 const officialText=x.is_official?'Đã xác nhận':x.origin_type==='academy'?'Chờ xác nhận':'';
 if(officialText){
  if(!official){official=document.createElement('span');official.className='badge question-origin-status';cell.appendChild(document.createElement('br'));cell.appendChild(official)}
  official.className=`badge question-origin-status ${x.is_official?'green':'red'}`;
  official.textContent=officialText;
 }else official?.remove();
}

function syncVisibleList(){
 if(state.view!=='questions'||!state.subjectId||listSubjectId!==state.subjectId)return;
 const rows=document.querySelectorAll('#qrows tr');
 for(const row of rows){
  const button=row.querySelector('[data-detail]');
  const x=button?listOrigins.get(button.dataset.detail):null;
  if(!x)continue;
  if(x.is_official)row.querySelector('[data-select-question]')?.remove();
  syncOriginBadge(row.querySelector('.q-code-cell'),x);
 }
}

async function decorateList(){
 if(state.view!=='questions'||!state.subjectId)return;
 const creatorAll=$('#qcreatorFilter option[value="all"]');if(creatorAll)creatorAll.textContent='Tất cả người nhập';
 const subjectId=state.subjectId;
 const {data,error}=await contentFilter(db.from('questions').select('id,origin_type,is_official,display_code'));if(error||state.subjectId!==subjectId)return;
 if(listSubjectId!==subjectId){listOrigins.clear();listSubjectId=subjectId}
 for(const x of data||[])listOrigins.set(String(x.id),x);
 syncVisibleList();
}
const oldQuestions=window.questions;window.questions=async function(c){await oldQuestions(c);await decorateList()};

/* Danh sách có phân trang: mỗi lần bank.js dựng lại #qrows hoặc bộ phân trang
   phục hồi HTML đã cache, chuẩn hóa lại nhãn nguồn bằng owner hiện tại. */
const previousRenderMath=window.renderMath;
if(typeof previousRenderMath==='function')window.renderMath=function(container=document.body){
 const result=previousRenderMath(container);
 if(container?.id==='qrows')queueMicrotask(syncVisibleList);
 return result;
};
document.addEventListener('click',event=>{
 if(event.target?.closest?.('[data-qpage]'))setTimeout(syncVisibleList,0);
},true);

window.AICLO_QUESTION_ORIGIN=Object.freeze({label,status,syncVisibleList,decorateList});
})();
