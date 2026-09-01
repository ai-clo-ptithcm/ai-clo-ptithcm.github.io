/* AI-CLO PTITHCM v10.5.3 — legacy subject-scoped overview retained during V11 modularization. */
(() => {
'use strict';

/* Tổng quan môn học: tất cả số liệu đều thuộc học phần đang chọn. */
window.dashboard=async function(c){
 const sid=state.subjectId,subject=activeSubject();
 if(!sid||!subject){c.replaceChildren(empty());return}
 const [chapters,clos,questions,exams]=await Promise.all([
  q('chapters','id',x=>x.eq('subject_id',sid)),
  q('clos','id',x=>x.eq('subject_id',sid)),
  q('questions','id,status',x=>x.eq('subject_id',sid)),
  q('exams','id,status',x=>x.eq('subject_id',sid))
 ]);
 if($('#pageTitle'))$('#pageTitle').textContent='Tổng quan môn học';
 if($('#pageSub'))$('#pageSub').textContent=`Thống kê riêng của ${subject.name} · ${subject.semester||''} · ${subject.academic_year||''}`;
 c.innerHTML=`<div class="stats">
   <div class="stat"><small>Chương</small><b>${chapters.length}</b></div>
   <div class="stat"><small>Câu hỏi</small><i>?</i><b>${questions.length}</b></div>
   <div class="stat"><small>CLO</small><i>◎</i><b>${clos.length}</b></div>
   <div class="stat"><small>Bài kiểm tra</small><i>✎</i><b>${exams.length}</b></div>
  </div>
  <div class="grid2">
   <section class="panel"><div class="panel-head"><h3>Tiến độ học phần</h3></div>${metric('Cấu trúc chương',chapters.length,Math.min(100,chapters.length*20))}${metric('Ngân hàng câu hỏi',questions.length,Math.min(100,questions.length*2))}${metric('Bài kiểm tra đã tạo',exams.length,Math.min(100,exams.length*20))}</section>
   <section class="panel"><div class="panel-head"><h3>Học phần hiện tại</h3></div><h2>${esc(subject.name)}</h2><p>${esc(subject.semester||'')} · ${esc(subject.academic_year||'')}</p><p><span class="badge green">${questions.filter(x=>x.status==='active').length} câu đang hoạt động</span></p><p class="hint">Các số liệu trên chỉ thuộc học phần này. Khi đổi học phần, trang Tổng quan sẽ cập nhật theo học phần mới.</p></section>
  </div>`;
};
})();
