/* AI-CLO PTITHCM — fast teacher CLO summary with staged loading and indexed aggregation. */
(() => {
'use strict';

const api=window.AICLO_ASSESSMENT;
if(!api?.results)return;
const PERF=window.AICLO_PERF;
const BASE_TTL=20000;
const DETAIL_TTL=30000;
const CHUNK=220;
const originalResults=api.results;
const memo=(key,ttl,loader)=>PERF?.memo?PERF.memo(key,ttl,loader):loader();
const num=v=>Number(v||0);
const score=(a,b)=>b?a*10/b:0;
const pct=(a,b)=>b?Math.round(a*1000/b)/10:0;
const date=v=>v?new Intl.DateTimeFormat('vi-VN',{timeZone:'Asia/Ho_Chi_Minh',dateStyle:'short',timeStyle:'short'}).format(new Date(v)):'—';

function add(map,key,correct){
 if(!key)return;
 const x=map.get(key)||{correct:0,total:0};
 x.total++;if(correct)x.correct++;map.set(key,x);
}
function chunks(ids){const out=[];for(let i=0;i<ids.length;i+=CHUNK)out.push(ids.slice(i,i+CHUNK));return out}
async function queryChunks(table,select,column,ids){
 if(!ids.length)return [];
 const groups=chunks(ids);
 const pages=await Promise.all(groups.map(group=>q(table,select,x=>x.in(column,group))));
 return pages.flat();
}
async function schemaReady(){
 const [a,b]=await Promise.all([
  db.from('exams').select('id,question_mode').limit(1),
  db.from('attempt_questions').select('id').limit(1)
 ]);
 return a.error?{ok:false,error:a.error}:{ok:!b.error,error:b.error};
}

async function loadTeacherBase(sid){
 return memo(`results:base:${sid}`,BASE_TTL,async()=>{
  const [exams,clos,members]=await Promise.all([
   q('exams','id,title',x=>x.eq('subject_id',sid)),
   q('clos','id,code',x=>x.eq('subject_id',sid).order('code')),
   q('subject_members','user_id,role',x=>x.eq('subject_id',sid).eq('role','student'))
  ]);
  const examIds=exams.map(x=>x.id);
  const studentIds=[...new Set(members.map(x=>x.user_id))];
  const [attempts,profiles]=await Promise.all([
   examIds.length?q('exam_attempts','id,exam_id,student_id,attempt_number,score,submitted_at',x=>x.in('exam_id',examIds).not('submitted_at','is',null).order('submitted_at',{ascending:false})):[],
   studentIds.length?q('profiles','id,full_name,mssv,email,is_active',x=>x.in('id',studentIds).order('full_name')):[]
  ]);
  return {sid,exams,clos,profiles,attempts};
 });
}

function makeAttemptStats(base){
 const byStudent=new Map();
 for(const a of base.attempts){
  let x=byStudent.get(a.student_id);
  if(!x){x={attempts:[],examIds:new Set(),scoreSum:0};byStudent.set(a.student_id,x)}
  x.attempts.push(a);x.examIds.add(a.exam_id);x.scoreSum+=num(a.score);
 }
 return byStudent;
}

async function loadTeacherDetails(base){
 const ids=base.attempts.map(x=>x.id);
 return memo(`results:detail:${base.sid}`,DETAIL_TTL,async()=>{
  const [snapshots,answers]=await Promise.all([
   queryChunks('attempt_questions','attempt_id,question_id,clo_code,chapter_name','attempt_id',ids),
   queryChunks('student_answers','attempt_id,question_id,is_correct','attempt_id',ids)
  ]);
  const meta=new Map(snapshots.map(x=>[`${x.attempt_id}|${x.question_id}`,x]));
  const attemptById=new Map(base.attempts.map(x=>[x.id,x]));
  const classClo=new Map(),classChapter=new Map(),studentClo=new Map(),attemptClo=new Map();
  for(const a of answers){
   const m=meta.get(`${a.attempt_id}|${a.question_id}`);if(!m)continue;
   const attempt=attemptById.get(a.attempt_id);if(!attempt)continue;
   add(classClo,m.clo_code,a.is_correct);add(classChapter,m.chapter_name,a.is_correct);
   let sm=studentClo.get(attempt.student_id);if(!sm){sm=new Map();studentClo.set(attempt.student_id,sm)}add(sm,m.clo_code,a.is_correct);
   let am=attemptClo.get(a.attempt_id);if(!am){am=new Map();attemptClo.set(a.attempt_id,am)}add(am,m.clo_code,a.is_correct);
  }
  return {classClo,classChapter,studentClo,attemptClo};
 });
}

function bars(map,kind){
 const rows=[...map.entries()];
 if(!rows.length)return '<p class="hint">Chưa có dữ liệu.</p>';
 if(kind==='clo')return rows.map(([code,x])=>`<div><b>${esc(code)}</b><strong>${score(x.correct,x.total).toFixed(2)}</strong><span>${pct(x.correct,x.total)}% câu đúng</span><div class="bar"><span style="width:${pct(x.correct,x.total)}%"></span></div></div>`).join('');
 return rows.map(([name,x])=>`<div><span>${esc(name)}</span><b>${score(x.correct,x.total).toFixed(2)}</b><small>${x.correct}/${x.total}</small></div>`).join('');
}
function aiHtml(a){
 if(!a)return '<p class="hint">Chưa có nội dung nhận xét.</p>';
 if(typeof a==='string')return `<div class="ai-summary"><p>${esc(a)}</p></div>`;
 const list=(title,items,tag='ul')=>items?.length?`<div class="feedback-section"><h4>${title}</h4><${tag}>${items.map(x=>`<li>${esc(x)}</li>`).join('')}</${tag}></div>`:'';
 return `<div class="ai-feedback-content"><div class="ai-summary"><span class="ai-spark">✦</span><p>${esc(a.summary||a.overview||'Gemini đã hoàn tất phân tích.')}</p></div>${list('Điểm mạnh',a.strengths)}${list('Cần cải thiện',a.needs_improvement||a.weaknesses)}${list('Gợi ý',a.next_actions||a.recommendations,'ol')}</div>`;
}
async function requestAi(scope,studentId,button){
 const old=button?.textContent;if(button){button.disabled=true;button.textContent='✦ Đang phân tích…'}
 try{
  const body={subject_id:state.subjectId,scope};if(studentId)body.student_id=studentId;
  const {data,error}=await db.functions.invoke('analyze-assessment',{body});
  if(error)throw error;if(!data?.success)throw new Error(data?.error||'Không tạo được nhận xét AI');
  pushDrawer(scope==='class'?'Nhận xét của Gemini · Cả lớp':'Nhận xét của Gemini',`<div class="ai-feedback-panel">${aiHtml(data.analysis)}</div>`,null,{eyebrow:scope==='class'?'PHÂN TÍCH LỚP':'NHẬN XÉT AI'});
  toast(data.cached?'Đang dùng nhận xét AI đã lưu':'Gemini đã hoàn tất nhận xét');
  if(button)button.textContent=data.cached?'✓ Nhận xét đã lưu':'✓ Đã nhận xét';
 }catch(ex){err(ex);if(button){button.disabled=false;button.textContent=old||'✦ Thử lại AI'}}
}

async function exportClass(base,details,stats){
 try{
  const XLSX=window.XLSX||await window.AICLO_OFFICE_LIBS?.xlsx?.();if(!XLSX)throw new Error('Không tải được thư viện Excel');
  const exams=new Map(base.exams.map(x=>[x.id,x])),profiles=new Map(base.profiles.map(x=>[x.id,x]));
  const summary=base.profiles.map(p=>{const s=stats.get(p.id),clo=details.studentClo.get(p.id)||new Map(),row={'MSSV':p.mssv||'','Họ và tên':p.full_name,'Email':p.email||'','Số lượt đã nộp':s?.attempts.length||0,'Điểm trung bình':s?.attempts.length?+(s.scoreSum/s.attempts.length).toFixed(2):''};for(const c of base.clos){const x=clo.get(c.code);row[c.code]=x?+score(x.correct,x.total).toFixed(2):''}return row});
  const history=base.attempts.map(a=>{const p=profiles.get(a.student_id)||{},row={'MSSV':p.mssv||'','Họ và tên':p.full_name||'','Bài kiểm tra':exams.get(a.exam_id)?.title||'','Lần':a.attempt_number,'Điểm':a.score,'Nộp lúc':date(a.submitted_at)};for(const [code,x] of details.attemptClo.get(a.id)||[])row[code]=+score(x.correct,x.total).toFixed(2);return row});
  const cloRows=[...details.classClo].map(([code,x])=>({'CLO':code,'Số câu đúng':x.correct,'Tổng lượt câu':x.total,'Tỷ lệ đúng (%)':pct(x.correct,x.total),'Điểm quy đổi /10':+score(x.correct,x.total).toFixed(2)}));
  const chapterRows=[...details.classChapter].map(([name,x])=>({'Chương':name,'Số câu đúng':x.correct,'Tổng lượt câu':x.total,'Tỷ lệ đúng (%)':pct(x.correct,x.total),'Điểm quy đổi /10':+score(x.correct,x.total).toFixed(2)}));
  const wb=XLSX.utils.book_new();for(const [name,rows] of [['Tong_hop_lop',summary],['Bai_kiem_tra',history],['CLO',cloRows],['Chuong',chapterRows]])XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(rows),name);
  const safe=String(activeSubject()?.name||'hoc-phan').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d').replace(/Đ/g,'D').replace(/[^a-zA-Z0-9_-]+/g,'-').replace(/^-|-$/g,'').slice(0,70)||'hoc-phan';
  XLSX.writeFile(wb,`Bao-cao-${safe}-${new Date().toISOString().slice(0,10)}.xlsx`);toast('Đã xuất báo cáo Excel');
 }catch(ex){err(ex)}
}

async function fastTeacherResults(c){
 if(!state.subjectId){c.replaceChildren(empty());return}
 const ready=await schemaReady();if(!ready.ok)return originalResults(c);
 const sid=state.subjectId,base=await loadTeacherBase(sid),stats=makeAttemptStats(base),avg=base.attempts.reduce((s,a)=>s+num(a.score),0)/(base.attempts.length||1);
 c.innerHTML=`<div class="stats"><div class="stat"><small>Sinh viên</small><b>${base.profiles.length}</b></div><div class="stat"><small>Lượt đã nộp</small><b>${base.attempts.length}</b></div><div class="stat"><small>Điểm trung bình</small><b>${avg.toFixed(2)}</b></div><div class="stat"><small>Bài có dữ liệu</small><b>${new Set(base.attempts.map(x=>x.exam_id)).size}</b></div></div><div class="toolbar report-toolbar"><span class="hint">Điểm tổng hiển thị trước; thống kê CLO được đồng bộ ở nền.</span><button id="classAi" class="ai-btn" ${base.attempts.length?'':'disabled'}>✦ AI phân tích cả lớp</button><button id="exportClass" class="primary">Xuất báo cáo lớp</button></div><div class="grid2"><section class="panel"><div class="panel-head"><h3>CLO toàn lớp</h3><small id="resultsDetailState" class="hint">Đang tổng hợp dữ liệu câu trả lời…</small></div><div id="fastClassClo" class="clo-dashboard"><p class="hint">Đang cập nhật…</p></div></section><section class="panel"><div class="panel-head"><h3>Theo chương</h3></div><div id="fastClassChapter" class="chapter-dashboard"><p class="hint">Đang cập nhật…</p></div></section></div><div class="panel table-wrap"><table><thead><tr><th>Sinh viên</th><th>Số bài/lượt</th><th>Điểm TB</th>${base.clos.map(x=>`<th>${esc(x.code)}</th>`).join('')}<th></th></tr></thead><tbody>${base.profiles.map(p=>{const s=stats.get(p.id),n=s?.attempts.length||0;return `<tr><td><button class="student-name-link" data-student-profile="${p.id}"><b>${esc(p.full_name)}</b></button><br><small>${esc(p.mssv||'')}</small></td><td>${s?.examIds.size||0}/${n}</td><td><b>${n?(s.scoreSum/n).toFixed(2):'—'}</b></td>${base.clos.map(clo=>`<td data-result-clo="${p.id}|${clo.code}">${n?'…':'—'}</td>`).join('')}<td class="row-actions"><button data-student-profile="${p.id}">Hồ sơ</button><button data-ai-student="${p.id}" ${n?'':'disabled'}>AI</button></td></tr>`}).join('')||`<tr><td class="empty" colspan="${base.clos.length+4}">Học phần chưa có sinh viên.</td></tr>`}</tbody></table></div>`;
 $('#classAi',c).onclick=e=>requestAi('class',null,e.currentTarget);
 $$('[data-ai-student]',c).forEach(b=>b.onclick=e=>requestAi('student',b.dataset.aiStudent,e.currentTarget));
 const detailsPromise=loadTeacherDetails(base);
 $('#exportClass',c).onclick=async e=>{const b=e.currentTarget,old=b.textContent;b.disabled=true;b.textContent='Đang chuẩn bị…';try{await exportClass(base,await detailsPromise,stats)}finally{b.disabled=false;b.textContent=old}};
 try{
  const details=await detailsPromise;
  if(state.view!=='results'||state.subjectId!==sid||!c.isConnected)return;
  $('#fastClassClo',c).innerHTML=bars(details.classClo,'clo');$('#fastClassChapter',c).innerHTML=bars(details.classChapter,'chapter');
  const stateBox=$('#resultsDetailState',c);if(stateBox)stateBox.textContent=`Đã tổng hợp ${base.attempts.length} lượt đã nộp`;
  for(const p of base.profiles){const m=details.studentClo.get(p.id)||new Map();for(const clo of base.clos){const cell=$(`[data-result-clo="${CSS.escape(p.id+'|'+clo.code)}"]`,c),x=m.get(clo.code);if(cell)cell.textContent=x?score(x.correct,x.total).toFixed(2):'—'}}
  window.AICLO_VIEW_TRANSITION?.invalidate?.('results',sid,'course');
 }catch(ex){const box=$('#resultsDetailState',c);if(box)box.textContent='Không tải được thống kê chi tiết';console.warn('AI-CLO result detail load failed',ex)}
}

api.results=async function(c){
 if(role()==='student')return originalResults(c);
 return fastTeacherResults(c);
};
window.AICLO_RESULTS_SUMMARY=Object.freeze({invalidate(subjectId=state.subjectId){if(subjectId){PERF?.invalidate?.(`results:base:${subjectId}`);PERF?.invalidate?.(`results:detail:${subjectId}`);window.AICLO_VIEW_TRANSITION?.invalidate?.('results',subjectId,'course')}}});
})();
