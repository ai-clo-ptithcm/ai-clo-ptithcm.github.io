/* AI-CLO PTITHCM V11.1 — lightweight subject-scoped overview with browser cache. */
(() => {
'use strict';

const OVERVIEW_TTL=60000;
const overviewKey=sid=>`overview:counts:${sid}`;

async function countRows(table,build){
 const query=build(db.from(table).select('id',{count:'exact',head:true}));
 const {count,error}=await query;
 if(error)throw error;
 return count||0;
}

async function loadOverviewCounts(sid,force=false){
 const loader=async()=>{
  const [chapterCount,cloCount,questionCount,activeQuestionCount,examCount]=await Promise.all([
   countRows('chapters',x=>contentFilter(x,sid)),
   countRows('clos',x=>contentFilter(x,sid)),
   countRows('questions',x=>contentFilter(x,sid)),
   countRows('questions',x=>contentFilter(x,sid).eq('status','active')),
   countRows('exams',x=>x.eq('subject_id',sid))
  ]);
  return {chapterCount,cloCount,questionCount,activeQuestionCount,examCount};
 };
 if(window.AICLO_PERF?.memo)return window.AICLO_PERF.memo(overviewKey(sid),OVERVIEW_TTL,loader,{force});
 return loader();
}

function invalidateOverview(subjectId=state.subjectId){
 if(subjectId)window.AICLO_PERF?.invalidate?.(overviewKey(subjectId));
 else window.AICLO_PERF?.invalidate?.('overview:counts:');
 window.AICLO_VIEW_TRANSITION?.invalidate?.('dashboard',subjectId||null);
}

/* Tổng quan môn học: lần đầu lấy số đếm từ Supabase, sau đó dùng cache RAM 60 giây.
 * Chuyển sidebar qua lại trong thời gian này không tạo lại 5 request mạng. */
window.dashboard=async function(c){
 const sid=state.subjectId,subject=activeSubject();
 if(!sid||!subject){c.replaceChildren(empty());return}
 const {chapterCount,cloCount,questionCount,activeQuestionCount,examCount}=await loadOverviewCounts(sid);
 if($('#pageTitle'))$('#pageTitle').textContent='Tổng quan môn học';
 if($('#pageSub'))$('#pageSub').textContent=`${subject.name} · ${subject.semester||''} · ${subject.academic_year||''} · Ngân hàng: ${subject.question_banks?.name||'chưa gán'}`;
 c.innerHTML=`<div class="stats">
   <div class="stat"><small>Chương</small><b>${chapterCount}</b></div>
   <div class="stat"><small>Câu hỏi</small><i>?</i><b>${questionCount}</b></div>
   <div class="stat"><small>CLO</small><i>◎</i><b>${cloCount}</b></div>
   <div class="stat"><small>Bài kiểm tra</small><i>✎</i><b>${examCount}</b></div>
  </div>
  <div class="grid2">
   <section class="panel"><div class="panel-head"><h3>Tiến độ học phần</h3></div>${metric('Cấu trúc chương',chapterCount,Math.min(100,chapterCount*20))}${metric('Ngân hàng câu hỏi',questionCount,Math.min(100,questionCount*2))}${metric('Bài kiểm tra đã tạo',examCount,Math.min(100,examCount*20))}</section>
   <section class="panel"><div class="panel-head"><h3>Học phần hiện tại</h3></div><h2>${esc(subject.name)}</h2><p>${esc(subject.semester||'')} · ${esc(subject.academic_year||'')}</p><p><b>Ngân hàng câu hỏi:</b> ${esc(subject.question_banks?.name||'Chưa gán')}</p><p><span class="badge green">${activeQuestionCount} câu đang hoạt động</span></p><p class="hint">Chương, CLO và câu hỏi lấy từ ngân hàng đã gán; bài kiểm tra và kết quả vẫn thuộc riêng học phần này.</p></section>
  </div>`;
};

window.AICLO_OVERVIEW=Object.freeze({load:loadOverviewCounts,invalidate:invalidateOverview,ttl:OVERVIEW_TTL});
})();
