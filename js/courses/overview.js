/* AI-CLO PTITHCM V11.1 — lightweight subject-scoped overview. */
(() => {
'use strict';

async function countRows(table,build){
 const query=build(db.from(table).select('id',{count:'exact',head:true}));
 const {count,error}=await query;
 if(error)throw error;
 return count||0;
}

/* Tổng quan môn học: chỉ lấy số đếm thay vì tải toàn bộ bản ghi về trình duyệt. */
window.dashboard=async function(c){
 const sid=state.subjectId,subject=activeSubject();
 if(!sid||!subject){c.replaceChildren(empty());return}
 const [chapterCount,cloCount,questionCount,activeQuestionCount,examCount]=await Promise.all([
  countRows('chapters',x=>x.eq('subject_id',sid)),
  countRows('clos',x=>x.eq('subject_id',sid)),
  countRows('questions',x=>x.eq('subject_id',sid)),
  countRows('questions',x=>x.eq('subject_id',sid).eq('status','active')),
  countRows('exams',x=>x.eq('subject_id',sid))
 ]);
 if($('#pageTitle'))$('#pageTitle').textContent='Tổng quan môn học';
 if($('#pageSub'))$('#pageSub').textContent=`Thống kê riêng của ${subject.name} · ${subject.semester||''} · ${subject.academic_year||''}`;
 c.innerHTML=`<div class="stats">
   <div class="stat"><small>Chương</small><b>${chapterCount}</b></div>
   <div class="stat"><small>Câu hỏi</small><i>?</i><b>${questionCount}</b></div>
   <div class="stat"><small>CLO</small><i>◎</i><b>${cloCount}</b></div>
   <div class="stat"><small>Bài kiểm tra</small><i>✎</i><b>${examCount}</b></div>
  </div>
  <div class="grid2">
   <section class="panel"><div class="panel-head"><h3>Tiến độ học phần</h3></div>${metric('Cấu trúc chương',chapterCount,Math.min(100,chapterCount*20))}${metric('Ngân hàng câu hỏi',questionCount,Math.min(100,questionCount*2))}${metric('Bài kiểm tra đã tạo',examCount,Math.min(100,examCount*20))}</section>
   <section class="panel"><div class="panel-head"><h3>Học phần hiện tại</h3></div><h2>${esc(subject.name)}</h2><p>${esc(subject.semester||'')} · ${esc(subject.academic_year||'')}</p><p><span class="badge green">${activeQuestionCount} câu đang hoạt động</span></p><p class="hint">Các số liệu trên chỉ thuộc học phần này. Khi đổi học phần, trang Tổng quan sẽ cập nhật theo học phần mới.</p></section>
  </div>`;
};
})();
