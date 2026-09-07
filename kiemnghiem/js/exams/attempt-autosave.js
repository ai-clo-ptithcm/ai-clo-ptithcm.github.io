/* AI-CLO PTITHCM V12.1 — autosave/resume for student attempts only.
   Teacher preview stays owned by assessment.js and always uses the frozen exam_question_pool snapshot. */
(() => {
'use strict';
const localKey=id=>`ai-clo:v103:attempt:${state.user?.id||'user'}:${id}`;
const saveLocal=(id,answers,deadline)=>{try{localStorage.setItem(localKey(id),JSON.stringify({answers,deadline,updated_at:Date.now()}))}catch{}};
const readLocal=id=>{try{return JSON.parse(localStorage.getItem(localKey(id))||'null')}catch{return null}};
const clearLocal=id=>{try{localStorage.removeItem(localKey(id))}catch{}};

// V12.1: do not wrap previewTeacherExam/showTeacherPreviewQuestion/showTeacherPreviewResult.
// assessment.js owns teacher preview with the current signature:
// showTeacherPreviewQuestion(exam, questions, answers, index, navMode)
// and reads from exam_question_pool, so the preview cannot drift when the live bank changes.

openStudentAttempt=async function(attemptId){
 try{
  let {data,error}=await db.rpc('get_exam_attempt_payload',{p_attempt_id:attemptId});
  if(error)throw error;
  if(data.submitted_at){clearLocal(attemptId);return openStudentAttemptResult(attemptId)}
  if(data.remaining_seconds===0){let done=await db.rpc('submit_exam_attempt',{p_attempt_id:attemptId,p_answers:data.answers||{}});if(done.error)throw done.error;clearLocal(attemptId);return showStudentResult(data.exam,done.data)}
  let local=readLocal(attemptId),answers={...(data.answers||{}),...(local?.answers||{})};
  data.deadline_ms=data.remaining_seconds==null?null:(Date.now()+data.remaining_seconds*1000);
  if(local?.deadline && data.deadline_ms!=null)data.deadline_ms=Math.min(data.deadline_ms,local.deadline);
  saveLocal(attemptId,answers,data.deadline_ms);
  showStudentQuestion(data,answers,0);
 }catch(ex){err(ex)}
};

showStudentQuestion=function(payload,answers,index){
 clearTimer();let qs=payload.questions||[],x=qs[index];if(!x)return toast('Không đọc được câu hỏi của bài kiểm tra',true);
 let remainNow=payload.deadline_ms==null?null:Math.max(0,Math.ceil((payload.deadline_ms-Date.now())/1000));
 modal(`Làm bài · ${payload.exam.title}`,`<div class="live-exam"><div class="live-top"><div><b>Câu ${index+1}/${qs.length}</b><span class="badge red">${esc(x.clo_code||'—')}</span></div><div id="examTimer" class="exam-timer">${remainNow==null?'Không giới hạn':timerText(remainNow)}</div></div><div class="live-context"><span>${esc(x.chapter||'')}</span><span>${esc(x.topic||'')}</span><span id="saveState">✓ Đã khôi phục bản nháp</span></div><div class="preview-question">${esc(x.content)}</div><div class="preview-options live-options">${(x.options||[]).map(o=>`<label class="${answers[x.id]===o.key?'selected':''}"><input type="radio" name="liveAnswer" value="${o.key}" ${answers[x.id]===o.key?'checked':''}><b>${o.key}</b><span>${esc(o.content)}</span></label>`).join('')}</div><div class="question-jump">${qs.map((q,i)=>`<button data-jump="${i}" class="${i===index?'current':''} ${answers[q.id]?'answered':''}">${i+1}</button>`).join('')}</div><div class="preview-nav"><button id="livePrev" class="secondary" ${index===0?'disabled':''}>← Trước</button><button id="liveNext" class="secondary" ${index===qs.length-1?'disabled':''}>Sau →</button><button id="liveSubmit" class="primary">Nộp bài</button></div></div>`);
 renderMath($('#modalBody'));
 $$('input[name="liveAnswer"]').forEach(r=>r.onchange=async()=>{
  answers[x.id]=r.value;saveLocal(payload.attempt_id,answers,payload.deadline_ms);
  $$('.live-options label').forEach(l=>l.classList.toggle('selected',l.contains(r)));let s=$('#saveState');if(s)s.textContent='Đã lưu trên thiết bị · đang đồng bộ…';
  let {error}=await db.rpc('save_exam_progress',{p_attempt_id:payload.attempt_id,p_question_id:x.id,p_selected_option:r.value});
  if(error){if(s)s.textContent='✓ Đã lưu trên thiết bị · chờ đồng bộ';console.warn('autosave remote failed',error)}else{if(s)s.textContent='✓ Đã tự lưu';let jb=$(`.question-jump [data-jump="${index}"]`);jb?.classList.add('answered')}
 });
 $$('[data-jump]').forEach(b=>b.onclick=()=>showStudentQuestion(payload,answers,+b.dataset.jump));
 $('#livePrev').onclick=()=>showStudentQuestion(payload,answers,index-1);$('#liveNext').onclick=()=>showStudentQuestion(payload,answers,index+1);$('#liveSubmit').onclick=()=>submitStudentAttempt(payload,answers,false);
 if(payload.deadline_ms!=null){liveTimer=setInterval(()=>{let sec=Math.max(0,Math.ceil((payload.deadline_ms-Date.now())/1000)),box=$('#examTimer');if(box)box.textContent=timerText(sec);if(sec<=0){clearTimer();submitStudentAttempt(payload,answers,true)}},1000)}
};

submitStudentAttempt=async function(payload,answers,auto){
 clearTimer();let unanswered=(payload.questions||[]).filter(q=>!answers[q.id]).length;if(!auto&&unanswered&&!confirm(`Còn ${unanswered} câu chưa trả lời. Bạn vẫn muốn nộp bài?`))return;
 let btn=$('#liveSubmit');if(btn){btn.disabled=true;btn.textContent=auto?'Hết giờ — đang nộp…':'Đang nộp…'}
 try{let {data,error}=await db.rpc('submit_exam_attempt',{p_attempt_id:payload.attempt_id,p_answers:answers||{}});if(error)throw error;clearLocal(payload.attempt_id);showStudentResult(payload.exam,data)}catch(ex){saveLocal(payload.attempt_id,answers,payload.deadline_ms);err(ex);if(btn){btn.disabled=false;btn.textContent='Nộp bài'}}
};
})();
