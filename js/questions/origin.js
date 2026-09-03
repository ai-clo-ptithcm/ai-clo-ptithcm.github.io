/* AI-CLO PTITHCM V11 — question provenance and Academy verification. */
(() => {
'use strict';
const label=value=>value==='gemini'?'✦ Gemini hỗ trợ':value==='academy'?'🏛 Câu hỏi Học viện':'✍️ Giảng viên biên soạn';
const status=x=>x.origin_type==='academy'?(x.is_official?'Đã được Admin xác nhận':'Chờ Admin xác nhận'):'';

function bindOriginField(form,x){
 const target=form.querySelector('.v105-scope-chooser')||form.querySelector('.option-grid');if(!target)return;
 const current=x.origin_type||'lecturer',locked=current==='gemini'&&role()!=='admin';
 const field=document.createElement('label');field.className='field wide question-origin-field';field.innerHTML=`<span>Nguồn câu hỏi</span><select name="origin_type" ${locked?'disabled':''}><option value="lecturer">Giảng viên biên soạn</option><option value="academy">Đề xuất là câu hỏi Học viện</option>${current==='gemini'||role()==='admin'?'<option value="gemini">Gemini hỗ trợ</option>':''}</select><small>${current==='academy'&&!x.is_official?'Câu sẽ chờ Admin xác nhận và chỉ nằm trong Ngân hàng đề thi – bảo mật.':'Người nhập được ghi riêng theo tài khoản đang thao tác.'}</small>${locked?'<input type="hidden" name="origin_type" value="gemini">':''}`;
 target.insertAdjacentElement('beforebegin',field);field.querySelector('select').value=current;
 const apply=()=>{const value=field.querySelector('select').value,secure=form.querySelector('input[name="question_scope"][value="secure_exam"]'),approval=form.elements.namedItem('approval_status');if(value==='academy'){if(secure){secure.checked=true;secure.dispatchEvent(new Event('change'))}if(approval)approval.value='pending';field.querySelector('small').textContent='Câu sẽ chờ Admin xác nhận và chỉ nằm trong Ngân hàng đề thi – bảo mật.'}else field.querySelector('small').textContent='Người nhập được ghi riêng theo tài khoản đang thao tác.'};field.querySelector('select').addEventListener('change',apply);apply();
}

const oldForm=window.v96QuestionForm;
window.v96QuestionForm=async function(x={},sets){x=x||{};if(x.is_official&&role()!=='admin')return toast('Câu hỏi Học viện đã xác nhận chỉ Admin được chỉnh sửa',true);await oldForm(x,sets);const form=$('#qForm');if(form)bindOriginField(form,x)};

const oldDetail=window.v96QuestionDetail;
window.v96QuestionDetail=async function(x,sets){
 x=await window.AICLO_QUESTION_STATE?.hydrateQuestion?.(x)||x;await oldDetail(x,sets);const detail=$('#v105Detail');if(!detail)return;
 const subtitle=document.querySelector('.question-workspace .workspace-head p');if(subtitle)subtitle.textContent=subtitle.textContent.replace('người tạo','người nhập');
 [...detail.querySelectorAll('#v105Audit small')].forEach(el=>{if(el.textContent.trim()==='Người tạo')el.textContent='Người nhập'});
 const permissionHint=detail.querySelector('.account-actions .hint');if(permissionHint)permissionHint.textContent=permissionHint.textContent.replace('người tạo','người nhập');
 detail.querySelector('.detail-meta')?.insertAdjacentHTML('beforeend',`<span class="badge question-origin ${x.origin_type||'lecturer'}">${esc(label(x.origin_type))}</span>${status(x)?`<span class="badge ${x.is_official?'green':'red'}">${esc(status(x))}</span>`:''}`);
 if(x.is_official&&role()!=='admin'){['#detailEditQuestion','#detailDeleteQuestion','#saveClassification'].forEach(sel=>$(sel)?.remove());['#detailScope','#detailApproval'].forEach(sel=>{if($(sel))$(sel).disabled=true})}
 const audit=$('#v105Audit');if(audit&&x.verified_at){let verifier='Admin';if(x.verified_by){const {data:p}=await db.from('profiles').select('full_name,email').eq('id',x.verified_by).maybeSingle();verifier=p?.full_name||p?.email||verifier}audit.insertAdjacentHTML('beforeend',`<div><small>Admin xác nhận</small><b>${esc(verifier)} · ${v96Date(x.verified_at)}</b></div>`)}
 if(role()==='admin'&&x.origin_type==='academy'&&!x.is_official){const actions=detail.querySelector('.account-actions');if(actions){actions.insertAdjacentHTML('afterbegin','<button id="rejectAcademyOrigin" class="secondary">Từ chối nguồn Học viện</button><button id="verifyAcademyOrigin" class="primary">✓ Xác nhận câu Học viện</button>');$('#verifyAcademyOrigin').onclick=()=>verify(true);$('#rejectAcademyOrigin').onclick=()=>verify(false)}}
 async function verify(approve){if(!await confirmAction(approve?'Xác nhận câu hỏi Học viện':'Từ chối nguồn Học viện',approve?'Câu sẽ được duyệt, bảo vệ và chỉ lưu trong Ngân hàng đề thi – bảo mật.':'Câu trở lại nguồn Giảng viên biên soạn và trạng thái bản nháp.',{confirmLabel:approve?'Xác nhận':'Từ chối'}))return;let {error}=await db.rpc('verify_academy_question',{p_question_id:x.id,p_approve:approve});if(error)return err(error);window.AICLO_QUESTION_STATE?.invalidate?.(x.id);toast(approve?'Đã xác nhận câu hỏi Học viện':'Đã từ chối nguồn Học viện');backToQuestionList()}
};

async function decorateList(){
 if(state.view!=='questions'||!state.subjectId)return;const creatorAll=$('#qcreatorFilter option[value="all"]');if(creatorAll)creatorAll.textContent='Tất cả người nhập';const {data,error}=await db.from('questions').select('id,origin_type,is_official').eq('subject_id',state.subjectId);if(error)return;
 for(const x of data||[]){const button=document.querySelector(`#qrows [data-detail="${CSS.escape(x.id)}"]`);if(!button)continue;const row=button.closest('tr'),cell=row?.querySelector('.q-code-cell');if(x.is_official)row?.querySelector('[data-select-question]')?.remove();if(!cell||cell.querySelector('.question-origin'))continue;cell.insertAdjacentHTML('beforeend',`<br><span class="badge question-origin ${x.origin_type||'lecturer'}">${esc(label(x.origin_type))}</span>${x.is_official?'<br><span class="badge green">Đã xác nhận</span>':x.origin_type==='academy'?'<br><span class="badge red">Chờ xác nhận</span>':''}`)}
}
const oldQuestions=window.questions;window.questions=async function(c){await oldQuestions(c);await decorateList()};

/* Câu Gemini được lưu trực tiếp khi thay một câu trong đề cuối kỳ. */
function bindDynamicOrigins(){
 const button=$('#useGenerated');if(button&&!button.dataset.originBound&&button.onclick){button.dataset.originBound='1';const save=button.onclick;button.onclick=async event=>{const originalFrom=db.from.bind(db);db.from=table=>{const builder=originalFrom(table);if(table==='questions'){const insert=builder.insert.bind(builder);builder.insert=(values,...args)=>insert({...values,origin_type:'gemini'},...args)}return builder};try{return await save.call(button,event)}finally{db.from=originalFrom}}}
 const bulk=$('#confirmBulkImport');if(bulk&&!bulk.dataset.originBound&&bulk.onclick){bulk.dataset.originBound='1';const actions=bulk.closest('.form-actions'),field=document.createElement('label');field.className='field bulk-origin-field';field.innerHTML='<span>Nguồn của danh sách nhập</span><select id="bulkQuestionOrigin"><option value="lecturer">Giảng viên biên soạn</option><option value="academy">Đề xuất là câu hỏi Học viện</option></select><small>Nguồn Học viện sẽ chờ Admin xác nhận.</small>';actions?.insertAdjacentElement('beforebegin',field);const save=bulk.onclick;bulk.onclick=async event=>{const origin=$('#bulkQuestionOrigin')?.value||'lecturer',originalFrom=db.from.bind(db);db.from=table=>{const builder=originalFrom(table);if(table==='questions'){const insert=builder.insert.bind(builder);builder.insert=(values,...args)=>insert({...values,origin_type:origin},...args)}return builder};try{return await save.call(bulk,event)}finally{db.from=originalFrom}}}
}
new MutationObserver(bindDynamicOrigins).observe(document.documentElement,{childList:true,subtree:true});
window.AICLO_QUESTION_ORIGIN=Object.freeze({label,status});
})();
