/* AI-CLO PTITHCM V12.6.18-kiemnghiem — canonical course overview owner with browser cache. */
(() => {
'use strict';

const OVERVIEW_TTL=60000;
const overviewKey=sid=>`overview:counts:${sid}`;
const safe=async(fn,fallback=[])=>{try{return await fn()}catch{return fallback}};

async function countRows(table,build){
 const query=build(db.from(table).select('id',{count:'exact',head:true}));
 const {count,error}=await query;
 if(error)throw error;
 return count||0;
}

async function loadOverviewCounts(sid,force=false){
 const loader=async()=>{
  const chapters=await q('chapters','id',x=>contentFilter(x,sid));
  const chapterIds=chapters.map(x=>x.id);
  const [cloCount,questionCount,activeQuestionCount,examCount,memberCount,topicCount,practiceCount,secureCount]=await Promise.all([
   countRows('clos',x=>contentFilter(x,sid)),
   countRows('questions',x=>contentFilter(x,sid)),
   countRows('questions',x=>contentFilter(x,sid).eq('status','active')),
   countRows('exams',x=>x.eq('subject_id',sid)),
   countRows('subject_members',x=>x.eq('subject_id',sid).eq('role','student')),
   chapterIds.length?countRows('topics',x=>x.in('chapter_id',chapterIds)):Promise.resolve(0),
   countRows('questions',x=>contentFilter(x,sid).in('question_scope',['practice','both'])),
   countRows('questions',x=>contentFilter(x,sid).in('question_scope',['secure_exam','both']))
  ]);
  return {chapterCount:chapters.length,topicCount,cloCount,questionCount,activeQuestionCount,examCount,memberCount,practiceCount,secureCount};
 };
 if(window.AICLO_PERF?.memo)return window.AICLO_PERF.memo(overviewKey(sid),OVERVIEW_TTL,loader,{force});
 return loader();
}

function invalidateOverview(subjectId=state.subjectId){
 if(subjectId)window.AICLO_PERF?.invalidate?.(overviewKey(subjectId));
 else window.AICLO_PERF?.invalidate?.('overview:counts:');
 window.AICLO_VIEW_TRANSITION?.invalidate?.('dashboard',subjectId||null);
}

function stat(k,v,note=''){
 return `<article class="v109-stat"><small>${esc(k)}</small><b>${esc(v)}</b>${note?`<span>${esc(note)}</span>`:''}</article>`;
}

async function studentAssessmentStats(sid){
 const examRows=await safe(()=>q('exams','id,title,status,created_at',x=>x.eq('subject_id',sid).order('created_at',{ascending:false})),[]);
 const ids=examRows.map(x=>x.id);
 const attempts=ids.length?await safe(()=>q('exam_attempts','exam_id,score,submitted_at',x=>x.eq('student_id',state.user.id).in('exam_id',ids)),[]):[];
 const done=attempts.filter(x=>x.submitted_at);
 const avg=done.length?done.reduce((a,b)=>a+Number(b.score||0),0)/done.length:null;
 return {examCount:examRows.length,submittedCount:done.length,average:avg};
}

async function renderCourseOverview(c){
 const sid=state.subjectId,s=activeSubject();
 if(!sid||!s){c.replaceChildren(empty());return}
 const counts=await loadOverviewCounts(sid);
 const r=role();
 let cards,lead,quick;

 if(r==='student'){
  const student=await studentAssessmentStats(sid);
  cards=[['Bài kiểm tra',student.examCount],['Lượt đã nộp',student.submittedCount],['Điểm trung bình',student.average===null?'—':student.average.toFixed(2)],['CLO học phần',counts.cloCount]];
  lead='Xem bài kiểm tra đang mở, kết quả cá nhân và mức độ đạt CLO trong học phần này.';
  quick='<button class="primary" data-overview-go="exams">Làm bài kiểm tra</button><button class="secondary" data-overview-go="results">Xem kết quả CLO</button>';
 }else{
  cards=[['Chương · Chủ đề · CLO',`${counts.chapterCount} · ${counts.topicCount} · ${counts.cloCount}`],['Câu luyện tập',counts.practiceCount],['Câu đề thi',counts.secureCount],['Sinh viên',counts.memberCount]];
  lead=r==='admin'?'Kiểm tra cấu trúc, thành viên, ngân hàng câu hỏi và hoạt động đánh giá của học phần.':'Quản lý nội dung, câu hỏi, đánh giá trực tuyến, đề thi cuối kỳ và kết quả CLO.';
  quick='<button class="primary" data-overview-go="questions">Thêm câu hỏi</button><button class="secondary" data-overview-go="exams">Mở Đánh giá</button><button class="secondary" data-overview-go="results">Xem kết quả CLO</button>';
 }

 c.innerHTML=`<div class="v109-dashboard"><section class="v109-hero course"><div><small>TỔNG QUAN HỌC PHẦN</small><h3>${esc(s.name)}</h3><p>${esc(lead)}</p></div><span>${esc(s.semester||'')}</span></section><div class="v109-stats">${cards.map(x=>stat(...x)).join('')}</div><section class="panel v109-quick"><div><h3>Thao tác nhanh</h3><p>${r==='student'?'Tiếp tục các hoạt động học tập trong môn.':'Đi đến nghiệp vụ cần thực hiện trong học phần.'}</p></div><div>${quick}</div></section></div>`;
 $('#pageTitle').textContent='Tổng quan học phần';
 $('#pageSub').textContent=`${s.name} · ${s.semester||''} · ${s.academic_year||''}`;
 $$('[data-overview-go]',c).forEach(b=>b.onclick=()=>navigate(b.dataset.overviewGo));
}

window.AICLO_OVERVIEW=Object.freeze({load:loadOverviewCounts,invalidate:invalidateOverview,render:renderCourseOverview,ttl:OVERVIEW_TTL});
})();
