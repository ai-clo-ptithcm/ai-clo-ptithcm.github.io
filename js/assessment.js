/* AI-CLO PTITHCM V12.2 — Assessment single-owner engine.
   Step 4: assessment list, detail shell and lifecycle only. */
(()=>{
'use strict';

const VERSION='12.2.0-step4';
const $1=(s,r=document)=>r.querySelector(s);
const $$1=(s,r=document)=>[...r.querySelectorAll(s)];
const esc2=s=>window.esc?esc(s):String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=v=>v?new Intl.DateTimeFormat('vi-VN',{timeZone:'Asia/Ho_Chi_Minh',dateStyle:'short',timeStyle:'short'}).format(new Date(v)):'—';
const isTeacher=()=>typeof canTeach==='function'&&canTeach();
const subjectId=()=>state?.subjectId||null;
const statusMeta=x=>{
  if(x.status==='draft')return {code:'draft',label:'Bản nháp',className:''};
  if(x.status==='closed')return {code:'closed',label:'Tạm dừng',className:'red'};
  const now=Date.now(),opens=x.opens_at?new Date(x.opens_at).getTime():null,closes=x.closes_at?new Date(x.closes_at).getTime():null;
  if(opens&&now<opens)return {code:'upcoming',label:'Sắp mở',className:''};
  if(closes&&now>closes)return {code:'expired',label:'Đã hết hạn',className:'red'};
  return {code:'active',label:'Đang mở',className:'green'};
};
const modeLabel=v=>({common_fixed:'Đề chung cố định',student_fixed:'Đề riêng theo sinh viên',attempt_random:'Rút lại mỗi lần làm'}[v]||'Đề chung cố định');
const notify=(message,bad=false)=>{if(typeof toast==='function')toast(message,bad);else if(bad&&typeof err==='function')err(new Error(message));};
const showError=e=>{if(typeof err==='function')err(e);else console.error(e)};

async function schemaReady(){
  try{
    const {data,error}=await db.rpc('assessment_schema_version');
    if(error)throw error;
    return String(data||'')==='12.2';
  }catch{return false}
}
function migrationNotice(c){
  c.innerHTML=`<div class="panel migration-panel"><h3>Cần hoàn tất Assessment V12.2 trên Supabase</h3><p>Frontend V12.2 chỉ chạy khi backend contract 12.2 đã được cài.</p><ol><li>Mở <b>Supabase → SQL Editor</b>.</li><li>Chạy <code>docs/assessment-v12.2-migration.sql</code>.</li><li>Tải lại trang.</li></ol></div>`;
}
async function ask(title,message,label='Xác nhận'){
  if(typeof confirmAction==='function')return !!(await confirmAction(title,message,{confirmLabel:label}));
  return window.confirm(message);
}
async function fetchExams(){
  const {data,error}=await db.from('exams').select('*').eq('subject_id',subjectId()).order('created_at',{ascending:false});
  if(error)throw error;
  return data||[];
}
async function fetchAttemptCounts(examIds){
  const out=new Map();
  if(!examIds.length)return out;
  const {data,error}=await db.from('exam_attempts').select('exam_id,submitted_at').in('exam_id',examIds);
  if(error)throw error;
  for(const row of data||[]){const x=out.get(row.exam_id)||{all:0,submitted:0};x.all++;if(row.submitted_at)x.submitted++;out.set(row.exam_id,x)}
  return out;
}
async function fetchFinalPackages(){
  try{
    const {data,error}=await db.from('final_exam_packages').select('id,title,status,updated_at,created_at,metadata,source_scope').eq('subject_id',subjectId()).order('updated_at',{ascending:false});
    if(error)throw error;
    return data||[];
  }catch(e){console.warn('V12.2 final package list unavailable',e);return []}
}

function topTabs(active='online'){
  return `<div class="v109-tabs assessment-v122-tabs"><button type="button" class="${active==='online'?'active':''}" data-v122-tab="online">Bài kiểm tra trực tuyến</button><button type="button" class="${active==='final'?'active':''}" data-v122-tab="final">Đề thi cuối kỳ</button></div>`;
}
function onlineTable(items,counts){
  return `<div class="toolbar"><span class="hint">Mỗi bài có một trang Chi tiết duy nhất.</span><button id="v122CreateExam" class="primary">+ Tạo bài kiểm tra</button></div><div class="panel table-wrap"><table class="assessment-table"><thead><tr><th>Bài kiểm tra</th><th>Cấu trúc</th><th>Chế độ câu</th><th>Thời gian</th><th>Bài làm</th><th>Trạng thái</th><th></th></tr></thead><tbody>${items.map(x=>{const s=statusMeta(x),n=counts.get(x.id)||{all:0,submitted:0};return `<tr><td><button type="button" class="exam-title-link" data-v122-detail="${x.id}"><b>${esc2(x.title||'Bài kiểm tra')}</b></button><br><small>${esc2(x.description||'')}</small></td><td><b>${Number(x.total_questions||0)}</b> câu<br><small>${esc2(x.structure_mode==='chapter_pool'?'CLO chung các mục':'CLO cho mỗi mục')}</small></td><td><span class="badge">${esc2(modeLabel(x.question_mode))}</span></td><td>${x.duration_minutes||'—'} phút<br><small>${x.opens_at?fmt(x.opens_at):'Khi phát hành'} → ${x.closes_at?fmt(x.closes_at):'Không giới hạn'}</small></td><td><b>${n.submitted}</b> đã nộp<br><small>${n.all} lượt</small></td><td><span class="badge ${s.className}">${s.label}</span></td><td><button type="button" class="primary" data-v122-detail="${x.id}">Chi tiết →</button></td></tr>`}).join('')||'<tr><td colspan="7" class="empty">Chưa có bài kiểm tra.</td></tr>'}</tbody></table></div>`;
}
function finalTable(items){
  return `<div class="toolbar"><span class="hint">Đề cuối kỳ chỉ dùng Ngân hàng đề thi – bảo mật.</span><button id="v122CreateFinal" class="primary">+ Tạo đề thi cuối kỳ</button></div><div class="panel table-wrap"><table><thead><tr><th>Hồ sơ đề</th><th>Nguồn câu</th><th>Cập nhật</th><th>Trạng thái</th><th></th></tr></thead><tbody>${items.map(x=>`<tr><td><b>${esc2(x.title||x.metadata?.title||'Đề thi cuối kỳ')}</b></td><td>Ngân hàng đề thi – bảo mật</td><td>${fmt(x.updated_at||x.created_at)}</td><td><span class="badge ${x.status==='locked'?'green':''}">${esc2(x.status==='locked'?'Đã khóa':x.status==='generated'?'Đã sinh đề':x.status==='reviewing'?'Đang rà soát':'Bản nháp')}</span></td><td><button type="button" class="secondary" data-v122-final="${x.id}">Chi tiết →</button></td></tr>`).join('')||'<tr><td colspan="5" class="empty">Chưa có hồ sơ đề thi cuối kỳ.</td></tr>'}</tbody></table></div>`;
}

async function teacherExamList(c){
  const [items,finals]=await Promise.all([fetchExams(),fetchFinalPackages()]);
  const counts=await fetchAttemptCounts(items.map(x=>x.id));
  let active=sessionStorage.getItem(`aiclo:v122:assessment-tab:${subjectId()}`)||'online';
  if(!['online','final'].includes(active))active='online';
  const renderTab=tab=>{
    active=tab;sessionStorage.setItem(`aiclo:v122:assessment-tab:${subjectId()}`,tab);
    c.innerHTML=`${topTabs(tab)}<div id="v122AssessmentBody">${tab==='online'?onlineTable(items,counts):finalTable(finals)}</div>`;
    bindTabs(c,renderTab);
    if(tab==='online')bindOnlineList(c,items);else bindFinalList(c);
  };
  renderTab(active);
}
function bindTabs(root,renderTab){$$1('[data-v122-tab]',root).forEach(b=>b.onclick=()=>renderTab(b.dataset.v122Tab))}
function bindOnlineList(root,items){
  $$1('[data-v122-detail]',root).forEach(b=>b.onclick=()=>{const x=items.find(v=>v.id===b.dataset.v122Detail);if(x)openExamDetail(x)});
  const add=$1('#v122CreateExam',root);if(add)add.onclick=()=>notify('Bước 5 sẽ nối trình tạo bài V12.2 vào nút này.');
}
function bindFinalList(root){
  const add=$1('#v122CreateFinal',root);if(add)add.onclick=()=>notify('Bước sau sẽ nối Builder đề thi cuối kỳ V12.2 vào nút này.');
  $$1('[data-v122-final]',root).forEach(b=>b.onclick=()=>notify('Bước sau sẽ nối trang Chi tiết đề cuối kỳ V12.2.'));
}

async function setStatus(exam,next){
  const label=next==='active'?(exam.status==='closed'?'Mở lại':'Phát hành'):'Tạm dừng';
  const message=next==='closed'?'Sinh viên sẽ không thể bắt đầu lượt mới. Lượt đang làm vẫn được phép tiếp tục.':next==='active'?'Bài sẽ cho phép sinh viên bắt đầu lượt mới theo thời gian mở/đóng đã cấu hình.':'';
  if(!await ask(label,message,label))return false;
  const payload={status:next};
  if(next==='active'&&!exam.published_at)payload.published_at=new Date().toISOString();
  const {data,error}=await db.from('exams').update(payload).eq('id',exam.id).select('*').single();
  if(error)throw error;
  if(!data||data.status!==next)throw new Error(`Supabase chưa đổi trạng thái sang ${next}`);
  Object.assign(exam,data);
  notify(label==='Tạm dừng'?'Đã tạm dừng bài kiểm tra':label==='Mở lại'?'Đã mở lại bài kiểm tra':'Đã phát hành bài kiểm tra');
  return true;
}
async function deleteExam(exam){
  const {count,error}=await db.from('exam_attempts').select('id',{count:'exact',head:true}).eq('exam_id',exam.id);
  if(error)throw error;
  if(count>0)return notify('Bài đã có lượt làm nên không thể xóa.',true);
  if(!await ask('Xóa bài kiểm tra',`Xóa “${exam.title||'Bài kiểm tra'}”? Thao tác này không thể hoàn tác.`,'Xóa'))return;
  const r=await db.from('exams').delete().eq('id',exam.id);if(r.error)throw r.error;
  notify('Đã xóa bài kiểm tra');
  await exams($1('#content'));
}
function detailActions(exam){
  if(exam.status==='draft')return `<button id="v122Edit" class="secondary">Chỉnh sửa</button><button id="v122Publish" class="primary">Phát hành</button><button id="v122Delete" class="danger">Xóa</button>`;
  if(exam.status==='closed')return `<button id="v122Edit" class="secondary">Chỉnh sửa</button><button id="v122Reopen" class="primary">Mở lại</button>`;
  return `<button id="v122Edit" class="secondary">Chỉnh sửa</button><button id="v122Pause" class="secondary">Tạm dừng</button>`;
}
async function openExamDetail(examOrId){
  try{
    let exam=typeof examOrId==='string'?null:examOrId;
    if(!exam){const {data,error}=await db.from('exams').select('*').eq('id',examOrId).single();if(error)throw error;exam=data}
    const {count,error}=await db.from('exam_attempts').select('id',{count:'exact',head:true}).eq('exam_id',exam.id);if(error)throw error;
    const c=$1('#content');if(!c)return;
    const s=statusMeta(exam);
    c.innerHTML=`<div class="assessment-detail-v122"><div class="subpage-head"><div><button id="v122Back" class="secondary compact">← Quay lại</button><small>BÀI KIỂM TRA TRỰC TUYẾN</small><h3>${esc2(exam.title||'Bài kiểm tra')}</h3><p>${esc2(exam.description||'')}</p></div><span class="badge ${s.className}">${s.label}</span></div><section class="panel"><div class="panel-head"><div><h3>Thông tin bài kiểm tra</h3><p class="hint">Một nguồn trạng thái duy nhất từ bảng exams.</p></div><div class="assessment-detail-actions">${detailActions(exam)}</div></div><div class="detail-grid"><div><small>Số câu</small><b>${Number(exam.total_questions||0)}</b></div><div><small>Thời gian</small><b>${exam.duration_minutes||'—'} phút</b></div><div><small>Số lần làm</small><b>${exam.max_attempts||1}</b></div><div><small>Lượt đã tạo</small><b>${count||0}</b></div><div><small>Rút câu</small><b>${esc2(modeLabel(exam.question_mode))}</b></div><div><small>Cấu trúc</small><b>${esc2(exam.structure_mode==='chapter_pool'?'CLO chung các mục':'CLO cho mỗi mục')}</b></div></div></section><section class="panel"><div class="panel-head"><div><h3>Quản lý bài</h3><p class="hint">Builder, Làm thử và danh sách bài làm sẽ được nối ở các bước kế tiếp.</p></div></div></section></div>`;
    $1('#v122Back')?.addEventListener('click',()=>exams(c));
    $1('#v122Edit')?.addEventListener('click',()=>notify('Bước 5 sẽ nối Builder V12.2 vào đây.'));
    $1('#v122Publish')?.addEventListener('click',async()=>{try{if(await setStatus(exam,'active'))await openExamDetail(exam)}catch(e){showError(e)}});
    $1('#v122Pause')?.addEventListener('click',async()=>{try{if(await setStatus(exam,'closed'))await openExamDetail(exam)}catch(e){showError(e)}});
    $1('#v122Reopen')?.addEventListener('click',async()=>{try{if(await setStatus(exam,'active'))await openExamDetail(exam)}catch(e){showError(e)}});
    $1('#v122Delete')?.addEventListener('click',async()=>{try{await deleteExam(exam)}catch(e){showError(e)}});
  }catch(e){showError(e)}
}

async function studentExamList(c){
  try{
    const [items,{data:attempts,error}]=await Promise.all([fetchExams(),db.from('exam_attempts').select('*').eq('student_id',state.user.id).order('created_at',{ascending:false})]);
    if(error)throw error;
    const visible=items.filter(x=>x.status==='active'||(attempts||[]).some(a=>a.exam_id===x.id&&!a.submitted_at));
    c.innerHTML=`<div class="student-exam-grid">${visible.map(x=>{const mine=(attempts||[]).filter(a=>a.exam_id===x.id),open=mine.find(a=>!a.submitted_at),s=statusMeta(x);return `<article class="student-exam-card"><div class="student-exam-head"><span class="badge ${s.className}">${s.label}</span><span>${mine.filter(a=>a.submitted_at).length}/${x.max_attempts||1} lượt đã nộp</span></div><h3>${esc2(x.title||'Bài kiểm tra')}</h3><p>${esc2(x.description||'')}</p><div class="student-exam-meta"><span><b>${x.total_questions||0}</b> câu</span><span><b>${x.duration_minutes||'—'}</b> phút</span></div><div class="student-exam-actions">${open?`<button class="primary" data-v122-resume="${x.id}">Tiếp tục làm bài</button>`:x.status==='active'?`<button class="primary" data-v122-start="${x.id}">Làm bài</button>`:'<button class="secondary" disabled>Đang tạm dừng</button>'}</div></article>`}).join('')||'<div class="panel empty">Hiện chưa có bài kiểm tra nào.</div>'}</div>`;
    $$1('[data-v122-start],[data-v122-resume]',c).forEach(b=>b.onclick=()=>notify('Bước Student Attempt sẽ được nối sau khi lifecycle giáo viên ổn định.'));
  }catch(e){showError(e)}
}

async function exams(c){
  if(!subjectId()){c?.replaceChildren?.(typeof empty==='function'?empty():document.createTextNode('Chưa chọn học phần'));return}
  if(!await schemaReady())return migrationNotice(c);
  return isTeacher()?teacherExamList(c):studentExamList(c);
}

// Compatibility surface. Only these entry points are public.
async function results(c){c.innerHTML='<div class="panel"><h3>Kết quả CLO</h3><p class="hint">Sẽ được nối lại trong bước xử lý score_policy.</p></div>'}
async function teacherClassList(c){return results(c)}
async function openStudentAttemptResult(){notify('Kết quả lượt làm sẽ được nối ở bước Student Attempt.')}

window.exams=exams;
window.results=results;
window.AICLO_ASSESSMENT=Object.freeze({exams,results,teacherClassList,openStudentAttemptResult,openExamDetail,version:VERSION});
})();
