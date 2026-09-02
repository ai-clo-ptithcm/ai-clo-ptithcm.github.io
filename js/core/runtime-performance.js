/* AI-CLO PTITHCM — runtime performance fast paths for active V11 views. */
(() => {
'use strict';

const PERF=window.AICLO_PERF;
const DASHBOARD_TTL=60000;
const META_TTL=60000;
const ATTEMPT_COUNT_TTL=30000;
const SCHEMA_TTL=8*60*60*1000;
const teacherRoles=['teacher','lecturer','giangvien'];
const isTeacherRole=r=>teacherRoles.includes(r);
const memo=(key,ttl,loader)=>PERF?.memo?PERF.memo(key,ttl,loader):loader();

async function countRows(table,build=x=>x){
 const {count,error}=await build(db.from(table).select('id',{count:'exact',head:true}));
 if(error)throw error;
 return count||0;
}
function stat(k,v,note=''){return `<article class="v109-stat"><small>${esc(k)}</small><b>${esc(v)}</b>${note?`<span>${esc(note)}</span>`:''}</article>`}

/* 1) final-layer.js is the active dashboard. Cache the data used by that view,
 * instead of optimizing an older dashboard implementation that is overwritten later. */
const previousDashboard=window.dashboard;
async function courseDashboardData(){
 const sid=state.subjectId,r=role();
 const key=`runtime:course-dashboard:${sid}:${r}`;
 return memo(key,DASHBOARD_TTL,async()=>{
  if(r==='student'){
   const [clos,examRows]=await Promise.all([
    countRows('clos',x=>x.eq('subject_id',sid)),
    q('exams','id,title,status,created_at',x=>x.eq('subject_id',sid).order('created_at',{ascending:false}))
   ]);
   const ids=examRows.map(x=>x.id);
   const attempts=ids.length?await q('exam_attempts','exam_id,score,submitted_at',x=>x.eq('student_id',state.user.id).in('exam_id',ids)):[];
   return {kind:'student',clos,examRows,attempts};
  }
  const [chapters,clos,questionScopes,members]=await Promise.all([
   q('chapters','id',x=>x.eq('subject_id',sid).order('order_index')),
   countRows('clos',x=>x.eq('subject_id',sid)),
   q('questions','question_scope',x=>x.eq('subject_id',sid)),
   countRows('subject_members',x=>x.eq('subject_id',sid).eq('role','student'))
  ]);
  const chapterIds=chapters.map(x=>x.id);
  const topics=chapterIds.length?await countRows('topics',x=>x.in('chapter_id',chapterIds)):0;
  const practice=questionScopes.filter(x=>['practice','both'].includes(x.question_scope)).length;
  const secure=questionScopes.filter(x=>['secure_exam','both'].includes(x.question_scope)).length;
  return {kind:'staff',chapters:chapters.length,topics,clos,practice,secure,members};
 });
}
async function fastCourseDashboard(c){
 const s=activeSubject();if(!s){c.replaceChildren(empty());return}
 const r=role(),data=await courseDashboardData();
 let cards,lead,quick;
 if(data.kind==='student'){
  const done=data.attempts.filter(x=>x.submitted_at),avg=done.length?done.reduce((a,b)=>a+Number(b.score||0),0)/done.length:null;
  cards=[['Bài kiểm tra',data.examRows.length],['Lượt đã nộp',done.length],['Điểm trung bình',avg===null?'—':avg.toFixed(2)],['CLO học phần',data.clos]];
  lead='Xem bài kiểm tra đang mở, kết quả cá nhân và mức độ đạt CLO trong học phần này.';
  quick='<button class="primary" data-go="exams">Làm bài kiểm tra</button><button class="secondary" data-go="results">Xem kết quả CLO</button>';
 }else{
  cards=[['Chương · Chủ đề · CLO',`${data.chapters} · ${data.topics} · ${data.clos}`],['Câu luyện tập',data.practice],['Câu đề thi',data.secure],['Sinh viên',data.members]];
  lead=r==='admin'?'Kiểm tra cấu trúc, thành viên, ngân hàng câu hỏi và hoạt động đánh giá của học phần.':'Quản lý nội dung, câu hỏi, đánh giá trực tuyến, đề thi cuối kỳ và kết quả CLO.';
  quick='<button class="primary" data-go="questions">Thêm câu hỏi</button><button class="secondary" data-go="exams">Mở Đánh giá</button><button class="secondary" data-go="results">Xem kết quả CLO</button>';
 }
 c.innerHTML=`<div class="v109-dashboard"><section class="v109-hero course"><div><small>TỔNG QUAN HỌC PHẦN</small><h3>${esc(s.name)}</h3><p>${esc(lead)}</p></div><span>${esc(s.semester||'')}</span></section><div class="v109-stats">${cards.map(x=>stat(...x)).join('')}</div><section class="panel v109-quick"><div><h3>Thao tác nhanh</h3><p>${r==='student'?'Tiếp tục các hoạt động học tập trong môn.':'Đi đến nghiệp vụ cần thực hiện trong học phần.'}</p></div><div>${quick}</div></section></div>`;
 $('#pageTitle').textContent='Tổng quan học phần';
 $('#pageSub').textContent=`${s.name} · ${s.semester||''} · ${s.academic_year||''}`;
 $$('[data-go]',c).forEach(b=>b.onclick=()=>navigate(b.dataset.go));
}
window.dashboard=async function(c){
 if(state.space==='course')return fastCourseDashboard(c);
 return previousDashboard(c);
};

/* 2) The legacy structure view fetched every topic in the database and filtered in JS.
 * Fetch chapters first, then only topics belonging to the active course. */
window.structure=async function(c){
 if(!state.subjectId){c.replaceChildren(empty());return}
 const [ch,clos]=await Promise.all([
  q('chapters','*',x=>x.eq('subject_id',state.subjectId).order('order_index')),
  q('clos','*',x=>x.eq('subject_id',state.subjectId).order('code'))
 ]);
 const chapterIds=ch.map(x=>x.id);
 const topics=chapterIds.length?await q('topics','*',x=>x.in('chapter_id',chapterIds).order('order_index')):[];
 c.innerHTML=`<div class="grid2"><section class="panel"><div class="panel-head"><h3>Chương và chủ đề</h3>${canTeach()?'<button id="addChapter" class="primary">+ Chương</button>':''}</div><div id="chapterList" class="structure-list">${ch.map(x=>{const ts=topics.filter(t=>t.chapter_id===x.id);return `<div class="structure-chapter"><div class="structure-chapter-head"><div><b>${esc(x.order_index)}. ${esc(x.name)}</b><small>${ts.length} chủ đề</small></div>${canTeach()?`<div class="structure-actions"><button data-topic="${x.id}">+ Chủ đề</button><button data-edit-chapter="${x.id}">Sửa</button><button class="danger-link" data-delete-chapter="${x.id}">Xóa</button></div>`:''}</div><div class="topic-list">${ts.map(t=>`<div class="topic-row"><span><span class="badge">${esc(t.order_index)}. ${esc(t.name)}</span></span>${canTeach()?`<span class="topic-actions"><button data-edit-topic="${t.id}">Sửa</button><button class="danger-link" data-delete-topic="${t.id}">Xóa</button></span>`:''}</div>`).join('')||'<small>Chưa có chủ đề</small>'}</div></div>`}).join('')||'<p>Chưa có chương.</p>'}</div></section><section class="panel"><div class="panel-head"><h3>Chuẩn đầu ra CLO</h3>${role()==='admin'?'<button id="addClo" class="primary">+ CLO</button>':''}</div><div id="cloList">${clos.map(x=>`<div class="v102-clo-row"><div><span class="badge red">${esc(x.code)}</span> <b>${esc(x.short_description||'Chưa có mô tả ngắn BM08')}</b><p>${esc(x.description||'')}</p></div>${role()==='admin'?`<span class="structure-actions"><button data-edit-clo="${x.id}">Sửa</button><button class="danger-link" data-delete-clo="${x.id}">Xóa</button></span>`:''}</div>`).join('')||'<p>Chưa có CLO.</p>'}</div></section></div>`;
 $('#addChapter')?.addEventListener('click',()=>chapterForm(null,ch));
 $('#addClo')?.addEventListener('click',()=>window.v102CloForm?.(null));
 $('#chapterList').onclick=e=>{
  const b=e.target.closest('button');if(!b)return;
  if(b.dataset.topic)return topicForm(b.dataset.topic,null,topics);
  if(b.dataset.editChapter)return chapterForm(ch.find(x=>x.id===b.dataset.editChapter),ch);
  if(b.dataset.deleteChapter)return deleteChapter(ch.find(x=>x.id===b.dataset.deleteChapter));
  if(b.dataset.editTopic){const t=topics.find(x=>x.id===b.dataset.editTopic);return topicForm(t?.chapter_id,t,topics)}
  if(b.dataset.deleteTopic)return deleteTopic(topics.find(x=>x.id===b.dataset.deleteTopic));
 };
 $('#cloList')?.addEventListener('click',async e=>{
  const edit=e.target.closest('[data-edit-clo]');if(edit){window.v102CloForm?.(clos.find(v=>v.id===edit.dataset.editClo));return}
  const b=e.target.closest('[data-delete-clo]');if(!b)return;const x=clos.find(v=>v.id===b.dataset.deleteClo);
  try{
   const [questions,examClos,pool]=await Promise.all([dependencyCount('questions','clo_id',x.id),dependencyCount('exam_clos','clo_id',x.id),dependencyCount('exam_question_pool','clo_id',x.id)]);
   if(questions||examClos||pool)return modal('Không thể xóa CLO',`<p>CLO <b>${esc(x.code)}</b> đang được sử dụng (${questions} câu hỏi, ${examClos} cấu hình đề, ${pool} câu trong pool).</p><p class="hint">Hãy xử lý các dữ liệu liên quan trước.</p>`);
   if(!await confirmAction('Xóa CLO',`Xóa ${x.code}?`,{confirmLabel:'Xóa',danger:true}))return;
   const {error}=await db.from('clos').delete().eq('id',x.id);if(error)throw error;
   window.logActivity?.('delete','clo',x.id,`Xóa ${x.code}`);PERF?.invalidate?.(`runtime:course-dashboard:${state.subjectId}:`);toast('Đã xóa CLO');render();
  }catch(ex){err(ex)}
 });
 if(canTeach()){
  c.classList.add('structure-v95');c.classList.toggle('is-editing',!!state.structureEditing);
  const head=$('.panel-head',c);if(head){const edit=document.createElement('button');edit.id='structureEditMode';edit.className=state.structureEditing?'primary':'secondary';edit.textContent=state.structureEditing?'Hoàn tất':'Chỉnh sửa cấu trúc';head.append(edit);edit.onclick=()=>{state.structureEditing=!state.structureEditing;c.classList.toggle('is-editing',state.structureEditing);edit.className=state.structureEditing?'primary':'secondary';edit.textContent=state.structureEditing?'Hoàn tất':'Chỉnh sửa cấu trúc'}}
 }
};

/* 3) Cache only the two exact schema probes used by assessment.js. This is deliberately
 * narrow: ordinary exams/attempt_questions queries keep their normal Supabase behavior. */
function installAssessmentSchemaProbeCache(){
 if(!db||db.__aicloSchemaProbeCache)return;
 const originalFrom=db.from.bind(db);
 try{
  db.from=function(table){
   const builder=originalFrom(table);
   if(table!=='exams'&&table!=='attempt_questions')return builder;
   const originalSelect=builder.select?.bind(builder);if(!originalSelect)return builder;
   builder.select=function(columns,...args){
    const selected=originalSelect(columns,...args),normalized=String(columns||'').replace(/\s+/g,'');
    const key=table==='exams'&&normalized==='id,question_mode'?'schema:assessment:exams':table==='attempt_questions'&&normalized==='id'?'schema:assessment:attempt_questions':'';
    if(!key||typeof selected.limit!=='function')return selected;
    const originalLimit=selected.limit.bind(selected);
    selected.limit=function(n,...rest){
     const query=originalLimit(n,...rest);
     if(Number(n)!==1)return query;
     return memo(key,SCHEMA_TTL,async()=>await query);
    };
    return selected;
   };
   return builder;
  };
  Object.defineProperty(db,'__aicloSchemaProbeCache',{value:true,configurable:false});
 }catch(ex){console.warn('Không cài được cache kiểm tra schema',ex)}
}
installAssessmentSchemaProbeCache();

/* 4) Teacher assessment list: render the list before loading all attempt counters.
 * The lightweight two-column attempt rows are fetched once in the background, cached,
 * and aggregated in O(n). Heavy original workflows are lazy-delegated only when a
 * teacher opens a detail/action, so creation/edit/preview logic remains unchanged. */
const assessment=window.AICLO_ASSESSMENT;
const originalAssessmentExams=assessment?.exams;
function assessmentWindow(x){const now=Date.now(),open=x.opens_at?new Date(x.opens_at).getTime():null,close=x.closes_at?new Date(x.closes_at).getTime():null;if(x.status==='draft')return {code:'draft',label:'Bản nháp',className:''};if(x.status==='closed')return {code:'closed',label:'Đã đóng',className:'red'};if(open&&now<open)return {code:'upcoming',label:'Sắp mở',className:''};if(close&&now>close)return {code:'closed-time',label:'Đã hết hạn',className:'red'};return {code:'open',label:'Đang mở',className:'green'}}
const modeLabel=m=>({common_fixed:'Đề chung cố định',student_fixed:'Đề riêng theo sinh viên',attempt_random:'Rút lại mỗi lần làm'}[m]||'Đề chung cố định');
const dateText=v=>v?new Date(v).toLocaleString('vi-VN'):'—';
async function assessmentMeta(){
 const sid=state.subjectId,key=`runtime:assessment-meta:${sid}`;
 return memo(key,META_TTL,async()=>{
  const [chapters,clos]=await Promise.all([q('chapters','id,name,order_index',x=>x.eq('subject_id',sid).order('order_index')),q('clos','id,code',x=>x.eq('subject_id',sid).order('code'))]);
  const ids=chapters.map(x=>x.id),topics=ids.length?await q('topics','id,chapter_id,name,order_index',x=>x.in('chapter_id',ids).order('order_index')):[];
  return {chapters,clos,topics};
 });
}
function examMeta(x,sets){const ch=(x.chapter_ids||[]).map(id=>sets.chapters.find(v=>v.id===id)?.name).filter(Boolean).join(', ')||'—',tp=(x.topic_ids||[]).map(id=>sets.topics.find(v=>v.id===id)?.name).filter(Boolean).join(', ')||'Tất cả chủ đề';return `${esc(ch)} · ${esc(tp)}`}
async function schemaReadyFast(){
 const [r,t]=await Promise.all([db.from('exams').select('id,question_mode').limit(1),db.from('attempt_questions').select('id').limit(1)]);
 return r.error?{ok:false,error:r.error}:{ok:!t.error,error:t.error};
}
async function delegateAssessmentAction(selector,button){
 if(typeof originalAssessmentExams!=='function')return;
 const oldText=button?.textContent;if(button){button.disabled=true;button.textContent='Đang mở…'}
 const temp=document.createElement('div');temp.hidden=true;document.body.insertBefore(temp,document.body.firstChild);
 try{
  await originalAssessmentExams(temp);
  const target=temp.querySelector(selector);if(!target)throw new Error('Không tìm thấy thao tác bài kiểm tra');
  target.click();
 }catch(ex){err(ex)}finally{setTimeout(()=>temp.remove(),0);if(button){button.disabled=false;button.textContent=oldText}}
}
async function fastTeacherExamList(c){
 const ready=await schemaReadyFast();if(!ready.ok){c.innerHTML=`<div class="panel migration-panel"><h3>Hoàn tất nâng cấp Supabase để dùng Bài kiểm tra</h3><p class="hint">${esc(ready.error?.message||'Schema bài kiểm tra chưa sẵn sàng')}</p></div>`;return}
 const sid=state.subjectId;
 const [items,sets]=await Promise.all([q('exams','*',x=>x.eq('subject_id',sid).order('created_at',{ascending:false})),assessmentMeta()]);
 c.innerHTML=`<div class="toolbar"><span class="hint">Danh sách hiển thị trước; số lượt làm được cập nhật nhẹ ở nền.</span><button id="addExam" class="primary">+ Tạo bài kiểm tra</button></div><div class="panel table-wrap"><table class="assessment-table"><thead><tr><th>Bài kiểm tra</th><th>Cấu trúc</th><th>Chế độ câu</th><th>CLO</th><th>Thời gian</th><th>Bài làm</th><th>Trạng thái</th><th></th></tr></thead><tbody id="examRows">${items.map(x=>{const w=assessmentWindow(x),cc=x.clo_counts||{};return `<tr><td><button class="exam-title-link" data-attempts="${x.id}"><b>${esc(x.title)}</b></button><br><small>${esc(x.description||'')}</small></td><td>${examMeta(x,sets)}<br><small>${x.total_questions} câu</small></td><td><span class="badge">${esc(modeLabel(x.question_mode))}</span></td><td>${Object.entries(cc).map(([k,v])=>`<span class="badge">${esc(k)}: ${v}</span>`).join(' ')||'—'}</td><td>${x.duration_minutes||'—'} phút<br><small>${x.opens_at?dateText(x.opens_at):'Mở ngay'} → ${x.closes_at?dateText(x.closes_at):'Không giới hạn'}</small></td><td data-attempt-stat="${x.id}"><b>…</b><br><small>đang cập nhật</small></td><td><span class="badge ${w.className}">${w.label}</span></td><td class="row-actions"><button data-detail="${x.id}">Cấu trúc</button><button data-preview="${x.id}">Làm thử</button><button data-edit="${x.id}">Sửa</button>${x.status==='draft'?`<button data-publish="${x.id}">Phát hành</button>`:`<button data-close="${x.id}">Đóng</button>`}<button data-del="${x.id}">Xóa</button></td></tr>`}).join('')||'<tr><td colspan="8" class="empty">Chưa có bài kiểm tra.</td></tr>'}</tbody></table></div>`;
 $('#addExam',c).onclick=e=>{PERF?.invalidate?.(`runtime:assessment-list:${sid}`);delegateAssessmentAction('#addExam',e.currentTarget)};
 $('#examRows',c).onclick=e=>{
  const b=e.target.closest('button');if(!b)return;
  const id=b.dataset.attempts||b.dataset.detail||b.dataset.preview||b.dataset.edit||b.dataset.publish||b.dataset.close||b.dataset.del;if(!id)return;
  const attr=b.dataset.attempts?'data-attempts':b.dataset.detail?'data-detail':b.dataset.preview?'data-preview':b.dataset.edit?'data-edit':b.dataset.publish?'data-publish':b.dataset.close?'data-close':'data-del';
  if(['data-edit','data-publish','data-close','data-del'].includes(attr)){PERF?.invalidate?.(`runtime:assessment-list:${sid}`);PERF?.invalidate?.(`runtime:course-dashboard:${sid}:`)}
  delegateAssessmentAction(`[${attr}="${id}"]`,b);
 };
 const ids=items.map(x=>x.id);if(!ids.length)return;
 const load=()=>q('exam_attempts','exam_id,submitted_at',x=>x.in('exam_id',ids));
 const apply=rows=>{const map=new Map();for(const a of rows){const s=map.get(a.exam_id)||{total:0,submitted:0};s.total++;if(a.submitted_at)s.submitted++;map.set(a.exam_id,s)}for(const x of items){const el=$(`[data-attempt-stat="${x.id}"]`,c);if(!el)continue;const s=map.get(x.id)||{total:0,submitted:0};el.innerHTML=`<b>${s.submitted}</b> đã nộp<br><small>${s.total} lượt</small>`}};
 const task=async()=>{try{const rows=await memo(`runtime:assessment-list:${sid}`,ATTEMPT_COUNT_TTL,load);apply(rows)}catch(ex){console.warn('Không tải được thống kê lượt làm',ex)}};
 PERF?.idle?PERF.idle(task,500):setTimeout(task,0);
}
if(assessment&&typeof originalAssessmentExams==='function'){
 assessment.exams=async function(c){
  if(!state.subjectId){c.replaceChildren(empty());return}
  if(role()==='student')return originalAssessmentExams(c);
  return fastTeacherExamList(c);
 };
}

window.AICLO_RUNTIME_PERF=Object.freeze({
 invalidateCourse(subjectId=state.subjectId){if(subjectId){PERF?.invalidate?.(`runtime:course-dashboard:${subjectId}:`);PERF?.invalidate?.(`runtime:assessment-meta:${subjectId}`);PERF?.invalidate?.(`runtime:assessment-list:${subjectId}`)}},
 version:'1'
});
})();
