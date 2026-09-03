/* AI-CLO PTITHCM V11.6
   Ma trận cấu hình Mục (chủ đề) × CLO khi tạo bài kiểm tra trực tuyến.
   Không thay đổi schema: exam_questions là bộ câu mẫu/blueprint; backend V10.10
   dùng chính bộ mẫu này để giữ ma trận cho student_fixed và attempt_random. */
(()=>{
'use strict';

const MODE_LABEL={
  common_fixed:'Đề chung cố định',
  student_fixed:'Đề riêng cố định theo sinh viên',
  attempt_random:'Rút lại ở mỗi lần làm'
};
const MODE_HELP={
  common_fixed:'Một bộ câu chung cho cả lớp; chỉ thứ tự câu/đáp án có thể được trộn.',
  student_fixed:'Mỗi sinh viên được rút một bộ riêng ở lần đầu; các lần sau giữ nguyên bộ đó.',
  attempt_random:'Mỗi lần làm rút một bộ mới nhưng vẫn giữ đúng ma trận Mục × CLO.'
};
const byId=(arr,id)=>arr.find(x=>String(x.id)===String(id));
const shuffle=arr=>{const out=[...arr];for(let i=out.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[out[i],out[j]]=[out[j],out[i]]}return out};
const isoOrNull=v=>v?new Date(v).toISOString():null;
const asInt=v=>Math.max(0,Math.floor(Number(v)||0));

async function loadMatrixSets(){
  const [chapters,clos]=await Promise.all([
    q('chapters','*',x=>contentFilter(x).order('order_index')),
    q('clos','*',x=>contentFilter(x).order('code'))
  ]);
  const chapterIds=chapters.map(x=>x.id);
  const topics=chapterIds.length?await q('topics','*',x=>x.in('chapter_id',chapterIds).order('order_index')):[];
  let questions=await q(
    'questions',
    'id,subject_id,question_bank_id,display_code,chapter_id,topic_id,clo_id,content,correct_answer,explanation,status,question_scope,approval_status,question_options(id,option_key,content)',
    x=>contentFilter(x).eq('status','active').eq('approval_status','approved')
  );
  questions=questions.filter(x=>{
    const keys=(x.question_options||[]).map(o=>String(o.option_key||'').toUpperCase());
    return ['practice','both'].includes(x.question_scope)
      && keys.length===4
      && new Set(keys).size===4
      && ['A','B','C','D'].every(k=>keys.includes(k))
      && keys.includes(String(x.correct_answer||'').toUpperCase());
  });
  return {chapters,topics,clos,questions};
}

function poolRows(examId,questions,sets){
  return questions.map(qx=>({
    exam_id:examId,
    question_id:qx.id,
    chapter_id:qx.chapter_id,
    chapter_name:byId(sets.chapters,qx.chapter_id)?.name||null,
    topic_id:qx.topic_id||null,
    topic_name:byId(sets.topics,qx.topic_id)?.name||null,
    clo_id:qx.clo_id,
    clo_code:byId(sets.clos,qx.clo_id)?.code||null,
    content:qx.content,
    correct_answer:qx.correct_answer,
    explanation:qx.explanation||null,
    options:[...(qx.question_options||[])]
      .sort((a,b)=>String(a.option_key).localeCompare(String(b.option_key)))
      .map(o=>({key:o.option_key,content:o.content}))
  }));
}

function cellKey(topicId,cloId){return `${topicId||'__none__'}|${cloId}`}

async function openMatrixExamForm(){
  const sets=await loadMatrixSets();
  if(!sets.chapters.length||!sets.clos.length)return toast('Học phần cần có Chương và CLO trước khi tạo bài kiểm tra',true);
  if(!sets.questions.length)return toast('Ngân hàng luyện tập chưa có câu hỏi hợp lệ để tạo bài kiểm tra',true);

  const savedByChapter=new Map();
  modal('Tạo bài kiểm tra',`
    <form id="matrixAssessmentForm" class="form-grid assessment-form exam-blueprint-form">
      <label class="field wide">Tên bài kiểm tra<input name="title" required placeholder="Ví dụ: Kiểm tra Chương 1"></label>
      <label class="field wide">Mô tả<textarea name="description" placeholder="Nội dung hoặc yêu cầu ngắn…"></textarea></label>
      <label class="field">Chương
        <select name="chapter_id" id="matrixExamChapter" required>${sets.chapters.map(v=>`<option value="${v.id}">${esc(v.order_index)}. ${esc(v.name)}</option>`).join('')}</select>
      </label>
      <div class="field assessment-bank-fixed"><span>Nguồn câu hỏi</span><b>Ngân hàng luyện tập - kiểm tra</b><small>Ngân hàng đề thi bảo mật không được dùng cho bài kiểm tra trực tuyến.</small></div>
      <label class="field">Tổng số câu<input id="matrixExamTotal" type="number" value="0" readonly tabindex="-1"></label>
      <label class="field">Thời gian (phút)<input name="duration_minutes" type="number" min="1" max="300" value="30" required></label>
      <label class="field wide">Cách rút câu
        <select name="question_mode" id="matrixQuestionMode">
          <option value="common_fixed">Đề chung cố định</option>
          <option value="student_fixed">Đề riêng cố định theo sinh viên</option>
          <option value="attempt_random">Rút lại ở mỗi lần làm</option>
        </select>
        <small id="matrixQuestionModeHelp" class="hint"></small>
      </label>

      <section class="wide matrix-builder-panel">
        <div class="matrix-builder-head">
          <div><b>Ma trận câu hỏi · Mục × CLO</b><span>Nhập số câu cần rút ở từng ô. Tổng hàng, tổng cột và tổng toàn bài được tính tự động.</span></div>
          <button id="matrixClear" class="secondary" type="button">Xóa phân bổ</button>
        </div>
        <div id="matrixBuilder"></div>
        <div id="matrixBankCheck" class="bank-check"></div>
      </section>

      <label class="field">Số lần được làm<input name="max_attempts" type="number" min="1" max="20" value="1" required></label>
      <label class="field">Cách ghi nhận nhiều lần<select name="score_policy"><option value="highest">Lấy điểm cao nhất</option><option value="latest">Lấy lần cuối</option><option value="average">Lấy trung bình các lần</option></select></label>
      <label class="field">Mở từ<input name="opens_at" type="datetime-local"></label>
      <label class="field">Đóng lúc<input name="closes_at" type="datetime-local"></label>
      <label class="field">Trạng thái<select name="status"><option value="draft">Bản nháp — chưa cho sinh viên làm</option><option value="active">Phát hành ngay</option></select></label>
      <label class="field">Loại bài<select name="exam_type"><option value="chapter_test">Kiểm tra theo chương</option><option value="clo_assessment">Đánh giá CLO</option></select></label>
      <div class="wide assessment-options">
        <label><input name="show_answers" type="checkbox"> Cho xem đáp án/lời giải sau khi nộp</label>
        <label><input name="shuffle_questions" type="checkbox" checked> Trộn thứ tự câu hỏi</label>
        <label><input name="shuffle_options" type="checkbox" checked> Trộn thứ tự phương án A–D</label>
        <label><input name="allow_ai_feedback" type="checkbox" checked> Cho phép nút nhận xét AI</label>
      </div>
      <div class="wide assessment-preview" id="matrixAssessmentPreview"></div>
      <div class="form-actions"><button type="button" class="secondary" id="matrixCancel">Hủy</button><button class="primary" id="matrixCreateAssessment">Tạo và rút câu</button></div>
    </form>`);

  const dialog=document.querySelector('#modal');
  dialog?.classList.add('exam-matrix-modal');
  dialog?.addEventListener('close',()=>dialog.classList.remove('exam-matrix-modal'),{once:true});

  const currentChapter=()=>document.querySelector('#matrixExamChapter')?.value||'';
  const chapterTopics=ch=>sets.topics.filter(t=>String(t.chapter_id)===String(ch));
  const cellAvailable=(ch,tp,clo)=>sets.questions.filter(qx=>String(qx.chapter_id)===String(ch)&&String(qx.topic_id||'')===String(tp||'')&&String(qx.clo_id)===String(clo)).length;

  function snapshotCurrent(){
    const ch=currentChapter();if(!ch)return;
    const values={};
    document.querySelectorAll('.matrix-cell-input').forEach(i=>values[cellKey(i.dataset.topic,i.dataset.clo)]=asInt(i.value));
    savedByChapter.set(ch,values);
  }

  function rowDefinitions(ch){
    const topics=chapterTopics(ch).map(t=>({id:t.id,name:t.name,order:t.order_index??''}));
    const unassigned=sets.questions.some(q=>String(q.chapter_id)===String(ch)&&!q.topic_id);
    if(unassigned)topics.push({id:'',name:'Chưa gán mục',order:'—'});
    return topics;
  }

  function drawMatrix(){
    const ch=currentChapter(),rows=rowDefinitions(ch),saved=savedByChapter.get(ch)||{};
    const html=`<div class="table-wrap matrix-builder-wrap"><table class="exam-matrix matrix-builder-table">
      <thead><tr><th class="matrix-topic-col">Mục (chủ đề)</th>${sets.clos.map(c=>`<th>${esc(c.code)}</th>`).join('')}<th>Tổng</th></tr></thead>
      <tbody>${rows.map(tp=>`<tr data-matrix-row="${tp.id||'__none__'}"><td class="matrix-topic-name"><small>${esc(tp.order)}</small><b>${esc(tp.name)}</b></td>${sets.clos.map(clo=>{const available=cellAvailable(ch,tp.id,clo.id),value=saved[cellKey(tp.id,clo.id)]||0;return `<td class="matrix-edit-cell ${available?'':'matrix-empty-cell'}"><input class="matrix-cell-input" data-topic="${tp.id}" data-clo="${clo.id}" data-clo-code="${esc(clo.code)}" type="number" min="0" max="${available}" value="${Math.min(value,available)}" ${available?'':'disabled'}><small>có ${available}</small></td>`}).join('')}<td class="matrix-row-total"><b>0</b></td></tr>`).join('')||`<tr><td colspan="${sets.clos.length+2}" class="empty">Chương này chưa có mục/chủ đề.</td></tr>`}</tbody>
      <tfoot><tr><th>Tổng</th>${sets.clos.map(c=>`<th class="matrix-clo-total" data-clo-total="${c.id}">0</th>`).join('')}<th id="matrixGrandTotal">0</th></tr></tfoot>
    </table></div>`;
    document.querySelector('#matrixBuilder').innerHTML=html;
    document.querySelectorAll('.matrix-cell-input').forEach(i=>i.addEventListener('input',()=>{let n=asInt(i.value),max=asInt(i.max);if(n>max)n=max;i.value=n;recalculate()}));
    recalculate();
  }

  function readMatrix(){
    const ch=currentChapter();
    return [...document.querySelectorAll('.matrix-cell-input')].map(i=>{
      const topicId=i.dataset.topic||'',cloId=i.dataset.clo,need=asInt(i.value),available=cellAvailable(ch,topicId,cloId);
      const topic=topicId?byId(sets.topics,topicId):null,clo=byId(sets.clos,cloId);
      return {chapterId:ch,topicId,topicName:topic?.name||'Chưa gán mục',cloId,cloCode:clo?.code||i.dataset.cloCode||'',need,available,ok:need<=available};
    });
  }

  function recalculate(){
    const cells=readMatrix(),total=cells.reduce((s,x)=>s+x.need,0),ch=currentChapter();
    document.querySelector('#matrixExamTotal').value=total;
    const rowTotals=new Map();
    const cloTotals=new Map(sets.clos.map(c=>[String(c.id),0]));
    for(const cell of cells){const rk=cell.topicId||'__none__';rowTotals.set(rk,(rowTotals.get(rk)||0)+cell.need);cloTotals.set(String(cell.cloId),(cloTotals.get(String(cell.cloId))||0)+cell.need)}
    document.querySelectorAll('[data-matrix-row]').forEach(tr=>{const b=tr.querySelector('.matrix-row-total b');if(b)b.textContent=rowTotals.get(tr.dataset.matrixRow)||0});
    document.querySelectorAll('[data-clo-total]').forEach(x=>x.textContent=cloTotals.get(String(x.dataset.cloTotal))||0);
    const grand=document.querySelector('#matrixGrandTotal');if(grand)grand.textContent=total;
    const bad=cells.filter(x=>x.need>x.available),used=cells.filter(x=>x.need>0),ok=total>0&&!bad.length;
    document.querySelector('#matrixBankCheck').innerHTML=`<div class="bank-check-head ${ok?'ok':'warn'}"><b>${ok?'✓ Ma trận hợp lệ':'! Cần hoàn thiện ma trận'}</b><span>${total} câu · ${used.length} ô đang sử dụng</span></div>${bad.length?`<div class="bank-check-items">${bad.map(x=>`<span class="bad">${esc(x.topicName)} × ${esc(x.cloCode)}: cần ${x.need} / có ${x.available}</span>`).join('')}</div>`:total?'<small class="matrix-check-note">Mỗi ô đều có đủ câu trong ngân hàng luyện tập.</small>':'<small class="matrix-check-note">Nhập ít nhất 1 câu vào ma trận để tạo bài.</small>'}`;
    const chapter=byId(sets.chapters,ch),mode=document.querySelector('#matrixQuestionMode').value;
    document.querySelector('#matrixAssessmentPreview').innerHTML=`<b>Xem trước cấu trúc</b><span>${esc(chapter?.name||'')} · ${total} câu</span><span>${sets.clos.map(c=>`${esc(c.code)}: ${cloTotals.get(String(c.id))||0}`).join(' · ')}</span><span>${esc(MODE_LABEL[mode])}: ${esc(MODE_HELP[mode])}</span>`;
    document.querySelector('#matrixQuestionModeHelp').textContent=MODE_HELP[mode];
    snapshotCurrent();
    return {ok,total,cells,cloTotals,mode,ch};
  }

  document.querySelector('#matrixExamChapter').addEventListener('change',()=>{drawMatrix()});
  document.querySelector('#matrixQuestionMode').addEventListener('change',recalculate);
  document.querySelector('#matrixClear').addEventListener('click',()=>{document.querySelectorAll('.matrix-cell-input').forEach(i=>i.value=0);recalculate()});
  document.querySelector('#matrixCancel').addEventListener('click',()=>dialog?.close());
  drawMatrix();

  document.querySelector('#matrixAssessmentForm').addEventListener('submit',async e=>{
    e.preventDefault();
    const check=recalculate();
    if(!check.ok)return toast('Ma trận Mục × CLO chưa hợp lệ hoặc chưa có câu',true);
    if(check.total>200)return toast('Bài kiểm tra tối đa 200 câu',true);
    const v=Object.fromEntries(new FormData(e.target));
    if(v.opens_at&&v.closes_at&&new Date(v.closes_at)<=new Date(v.opens_at))return toast('Thời gian đóng phải sau thời gian mở',true);
    if(v.status==='active'&&!await confirmAction('Tạo và phát hành bài kiểm tra',`Hệ thống sẽ tạo bài “${v.title.trim()}” theo đúng ma trận Mục × CLO và cho sinh viên truy cập theo thời gian đã đặt.`,{confirmLabel:'Tạo và phát hành'}))return;

    const btn=document.querySelector('#matrixCreateAssessment');btn.disabled=true;btn.textContent='Đang tạo ma trận và rút câu…';
    let createdExam=null;
    try{
      const activeCells=check.cells.filter(x=>x.need>0);
      const poolQuestionMap=new Map(),selected=[];
      for(const cell of activeCells){
        const candidates=sets.questions.filter(qx=>String(qx.chapter_id)===String(check.ch)&&String(qx.topic_id||'')===String(cell.topicId||'')&&String(qx.clo_id)===String(cell.cloId));
        if(candidates.length<cell.need)throw new Error(`Không đủ câu cho ${cell.topicName} × ${cell.cloCode}`);
        candidates.forEach(qx=>poolQuestionMap.set(qx.id,qx));
        selected.push(...shuffle(candidates).slice(0,cell.need));
      }
      if(selected.length!==check.total)throw new Error('Không rút đủ số câu theo ma trận đã chọn');

      const cloCounts={};for(const clo of sets.clos){const n=check.cells.filter(x=>String(x.cloId)===String(clo.id)).reduce((s,x)=>s+x.need,0);if(n)cloCounts[clo.code]=n}
      const topicIds=[...new Set(activeCells.map(x=>x.topicId).filter(Boolean))];
      const row={
        subject_id:state.subjectId,title:v.title.trim(),description:v.description.trim()||null,exam_type:v.exam_type,
        total_questions:check.total,duration_minutes:+v.duration_minutes,is_clo_assessment:v.exam_type==='clo_assessment',created_by:state.user.id,
        status:v.status,max_attempts:+v.max_attempts,show_answers:!!v.show_answers,shuffle_questions:!!v.shuffle_questions,shuffle_options:!!v.shuffle_options,
        opens_at:isoOrNull(v.opens_at),closes_at:isoOrNull(v.closes_at),chapter_ids:[check.ch],topic_ids:topicIds,clo_counts:cloCounts,
        score_policy:v.score_policy,published_at:v.status==='active'?new Date().toISOString():null,allow_ai_feedback:!!v.allow_ai_feedback,question_mode:check.mode
      };
      const {data:exam,error}=await db.from('exams').insert(row).select().single();if(error)throw error;createdExam=exam;

      const pool=[...poolQuestionMap.values()];
      const poolInsert=await db.from('exam_question_pool').insert(poolRows(exam.id,pool,sets));if(poolInsert.error)throw poolInsert.error;
      const links=selected.map((qx,i)=>({exam_id:exam.id,question_id:qx.id,question_order:i+1}));
      const linkInsert=await db.from('exam_questions').insert(links);if(linkInsert.error)throw linkInsert.error;
      const chapterResult=await db.from('exam_chapters').upsert({exam_id:exam.id,chapter_id:check.ch,question_count:check.total},{onConflict:'exam_id,chapter_id'});if(chapterResult.error)throw chapterResult.error;
      const cloRows=sets.clos.map(clo=>({clo,n:cloCounts[clo.code]||0})).filter(x=>x.n>0).map(x=>({exam_id:exam.id,clo_id:x.clo.id,weight:x.n*100/check.total}));
      if(cloRows.length){const cloResult=await db.from('exam_clos').upsert(cloRows,{onConflict:'exam_id,clo_id'});if(cloResult.error)throw cloResult.error}

      closeModal();
      toast(`Đã tạo bài kiểm tra theo ma trận · ${check.total} câu · ${activeCells.length} ô Mục × CLO`);
      render();
    }catch(ex){
      if(createdExam?.id){const cleanup=await db.from('exams').delete().eq('id',createdExam.id);if(cleanup.error)console.warn('Không thể dọn bài kiểm tra tạo dở',cleanup.error)}
      err(ex);btn.disabled=false;btn.textContent='Tạo và rút câu';
    }
  });
}

// assessment.js gắn onclick trực tiếp cho #addExam. Bắt sự kiện ở capture phase
// để dùng form V11.6 mà không phải sửa khối assessment.js legacy rất lớn.
document.addEventListener('click',e=>{
  const button=e.target.closest?.('#addExam');
  if(!button)return;
  e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();
  openMatrixExamForm().catch(ex=>err(ex));
},true);

window.AICLO_OPEN_MATRIX_EXAM_FORM=openMatrixExamForm;
})();
