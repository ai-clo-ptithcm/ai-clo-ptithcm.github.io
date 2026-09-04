/* AI-CLO PTITHCM V11.9 — shared UX layer for 1-chapter and multi-chapter online tests. */
(()=>{
'use strict';
const VERSION='11.9.0';
let observer=null,toastObserver=null,gradeColumn=null,recovering=false,splitBusy=false;
const $v=s=>document.querySelector(s), $$v=(s,r=document)=>[...r.querySelectorAll(s)];
const escv=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const userKey=()=>state?.user?.id||'user';
const activeKey=()=>`aiclo:v118:active:${userKey()}:${state.subjectId}`;
const draftKey=(type,id=null)=>`aiclo:v118:builder:${userKey()}:${state.subjectId}:${type||'exam'}:${id||'new'}`;
const readJson=(k,f=null)=>{try{return JSON.parse(localStorage.getItem(k)||'null')??f}catch{return f}};
const writeJson=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v))}catch{}};

function injectCss(){
 if(document.querySelector('link[data-v119-online]'))return;
 const l=document.createElement('link');l.rel='stylesheet';l.href='css/exams/online-assessment-v119.css?v=11.9.0';l.dataset.v119Online='1';document.head.appendChild(l);
}
function sw(name,text,val=true,disabled=false){return `<label class="aiclo-switch-row"><span>${escv(text)}</span><span class="aiclo-switch"><input type="checkbox" name="${name}" ${val?'checked':''} ${disabled?'disabled':''}><i></i></span></label>`}
function appWindow(){const d=$v('#modal');if(window.AICLO_APP_WINDOW?.open)window.AICLO_APP_WINDOW.open(d,{className:'assessment-window-modal v119-create-window',width:900,height:690});else d?.classList.add('quick-edit-modal','assessment-window-modal','v119-create-window')}
function activeBuilder(){return readJson(activeKey(),null)}
function activeDraft(){const a=activeBuilder();return a?.type?readJson(draftKey(a.type,a.examId||null),null):null}

function tuneBuilderTypes(){
 const t=window.AICLO_EXAM_BUILDER?.types;if(!t)return;
 if(t.chapter_test){Object.assign(t.chapter_test,{label:'Kiểm tra 1 chương',export:true,help:'Kiểm tra trong một chương; phân bố số câu theo CLO cho từng mục.'})}
 if(t.review_exam){Object.assign(t.review_exam,{label:'Kiểm tra nhiều chương',export:true,help:'Chọn nhiều chương; dùng CLO cho mỗi mục hoặc CLO chung các mục thuộc từng chương.'})}
 if(t.clo_assessment){Object.assign(t.clo_assessment,{label:'Kiểm tra nhiều chương',export:true,help:'Bài nhiều chương tương thích dữ liệu cũ; CLO được phân bố theo từng chương.'})}
}

function friendlyMessage(raw){
 const s=String(raw||'').trim();
 if(/cannot (read|set)|undefined|null.*(property|properties)|innerhtml/i.test(s))return 'Giao diện vừa được cập nhật trong lúc thao tác. Dữ liệu đã nhập vẫn được giữ; vui lòng thử lại thao tác vừa rồi.';
 if(/failed to fetch|network|load failed|fetch/i.test(s))return 'Kết nối tới máy chủ đang gián đoạn. Vui lòng kiểm tra mạng và thử lại.';
 if(/quota|rate.?limit|resource exhausted/i.test(s))return 'Dịch vụ AI tạm thời đã đạt giới hạn sử dụng. Bạn có thể thử lại sau; các chức năng khác vẫn hoạt động bình thường.';
 if(/timeout|timed out/i.test(s))return 'Máy chủ phản hồi chậm hơn bình thường. Dữ liệu đã nhập vẫn được giữ; vui lòng thử lại sau ít phút.';
 if(!s||s==='Có lỗi xảy ra')return 'Không thể hoàn tất thao tác. Dữ liệu đã nhập vẫn được giữ; vui lòng thử lại.';
 return s.length>170?'Không thể hoàn tất thao tác. Dữ liệu đã nhập vẫn được giữ; vui lòng thử lại.':s;
}
function ensureBanner(){
 let b=$v('#aicloFriendlyError');if(b)return b;
 b=document.createElement('div');b.id='aicloFriendlyError';b.className='v119-error-banner';b.hidden=true;b.innerHTML='<div><strong>Không thể hoàn tất thao tác</strong><p></p></div><button type="button" aria-label="Đóng">×</button>';document.body.appendChild(b);b.querySelector('button').onclick=()=>b.hidden=true;return b;
}
function showFriendly(raw,{sticky=false}={}){
 const b=ensureBanner(),msg=friendlyMessage(raw);b.querySelector('p').textContent=msg;b.hidden=false;clearTimeout(b._timer);if(!sticky)b._timer=setTimeout(()=>b.hidden=true,7500);
}
async function recoverDrawAfterError(){
 if(recovering)return;const btn=$v('#ubDraw');if(!btn||!/Đang rút/i.test(btn.textContent||''))return;
 const a=activeBuilder();if(!a?.type)return;recovering=true;setTimeout(async()=>{try{await window.AICLO_EXAM_BUILDER?.open?.(a.type,a.examId||null)}catch(e){console.warn('AI-CLO V11.9 builder recovery',e)}finally{recovering=false}},250);
}
function watchErrors(){
 const toast=$v('#toast');if(toast&&!toastObserver){toastObserver=new MutationObserver(()=>{if(!toast.classList.contains('error'))return;const raw=toast.textContent;toast.textContent=friendlyMessage(raw);showFriendly(raw);recoverDrawAfterError()});toastObserver.observe(toast,{attributes:true,childList:true,subtree:true,characterData:true})}
 window.addEventListener('error',e=>{if(e?.message)showFriendly(e.message)});
 window.addEventListener('unhandledrejection',e=>{const m=e?.reason?.message||String(e?.reason||'');if(m)showFriendly(m)});
}

async function gradeColumnReady(){
 if(gradeColumn!==null)return gradeColumn;
 try{const r=await db.from('exams').select('id,counts_toward_grade').limit(1);gradeColumn=!r.error}catch{gradeColumn=false}
 return gradeColumn;
}
async function syncGradeFromActive(){
 const a=activeBuilder();if(!a?.type||!a.examId)return;const d=readJson(draftKey(a.type,a.examId),null);if(!d?.settings||typeof d.settings.counts_toward_grade!=='boolean')return;
 if(!await gradeColumnReady()){if(d.settings.counts_toward_grade===false)showFriendly('Cần chạy migration V11.9 trên Supabase để lưu thiết lập “Tính vào kết quả học phần”.',{sticky:true});return}
 const r=await db.from('exams').update({counts_toward_grade:d.settings.counts_toward_grade}).eq('id',a.examId);if(r.error)console.warn('AI-CLO V11.9 grade setting sync',r.error);
}

async function loadCreateSets(){
 const chapters=await q('chapters','*',x=>contentFilter(x).order('order_index'));
 const ids=chapters.map(x=>x.id),topics=ids.length?await q('topics','*',x=>x.in('chapter_id',ids).order('order_index')):[];
 return {chapters,topics};
}
function createWindowHtml(kind,sets){
 const multi=kind==='multi';
 const chapterUi=multi?`<div class="field wide"><span>Chương sử dụng</span><div class="v119-chapter-list">${sets.chapters.map(ch=>`<label><input type="checkbox" name="chapter_ids" value="${ch.id}"><span><b>${escv(ch.order_index)}. ${escv(ch.name)}</b></span></label>`).join('')}</div><small class="hint">Chọn ít nhất 2 chương. Các mục trong từng chương sẽ chỉnh tiếp ở Mục 2.</small></div>`:`<label class="field wide"><span>Chương kiểm tra</span><select name="chapter_id" required>${sets.chapters.map(ch=>`<option value="${ch.id}">${escv(ch.order_index)}. ${escv(ch.name)}</option>`).join('')}</select><small class="hint">Bài này chỉ dùng một chương. Cấu trúc chi tiết chỉnh tiếp ở Mục 2.</small></label>`;
 const mode=multi?`<div class="field wide"><span>Cách phân bố CLO</span><div class="v119-mode-choice"><label><input type="radio" name="structure_mode" value="topic_clo" checked> <b>CLO cho mỗi mục</b><small>Phân bố số câu CLO riêng cho từng mục.</small></label><label><input type="radio" name="structure_mode" value="chapter_pool"> <b>CLO chung các mục thuộc chương</b><small>Trong từng chương, gộp các mục đã chọn thành pool chung theo CLO.</small></label></div></div>`:'';
 return `<form id="v119CreateForm" class="form-grid assessment-form v119-create-window-form"><label class="field wide"><span>Tên bài kiểm tra</span><input name="title" required placeholder="Ví dụ: Kiểm tra Chương 2"></label><label class="field wide"><span>Mô tả</span><textarea name="description" rows="2" placeholder="Nội dung hoặc yêu cầu ngắn…"></textarea></label>${chapterUi}${mode}<label class="field"><span>Tổng số câu</span><input name="total_questions" type="number" min="1" max="300" value="${multi?20:10}" required></label><label class="field"><span>Thời gian (phút)</span><input name="duration_minutes" type="number" min="1" max="300" value="30" required></label><label class="field"><span>Số lần được làm</span><input name="max_attempts" type="number" min="1" max="100" value="1" required></label><label class="field"><span>Cách ghi nhận nhiều lần</span><select name="score_policy"><option value="highest">Điểm cao nhất</option><option value="latest">Lần cuối</option><option value="average">Trung bình</option></select></label><label class="field wide"><span>Cách rút câu</span><select name="question_mode"><option value="common_fixed">Đề chung cố định</option><option value="student_fixed">Đề riêng cố định theo sinh viên</option><option value="attempt_random">Rút lại ở mỗi lần làm</option></select></label><label class="field"><span>Mở từ</span><input name="opens_at" type="datetime-local"></label><label class="field"><span>Đóng lúc</span><input name="closes_at" type="datetime-local"></label><div class="wide clo-switch-grid">${sw('counts_toward_grade','Tính vào kết quả học phần',true)}${sw('show_answers','Cho xem đáp án/lời giải sau khi nộp',false)}${sw('shuffle_questions','Trộn thứ tự câu hỏi',true)}${sw('shuffle_options','Trộn thứ tự phương án A–D',true)}${sw('allow_ai_feedback','Cho phép sinh viên nhận xét AI',true)}</div><div id="v119AiAutoNote" class="v119-switch-note" hidden>Nhận xét AI của sinh viên đã được tắt mặc định vì bài này không tính vào kết quả học phần. Giảng viên vẫn luôn có đầy đủ nút AI và có thể bật lại quyền AI cho sinh viên.</div><div class="form-actions"><button id="v119CreateCancel" type="button" class="secondary">Hủy</button><button class="primary">Tiếp tục</button></div></form>`;
}
async function openCreateWindow(kind){
 try{
  const sets=await loadCreateSets();if(!sets.chapters.length)return toast('Học phần cần có Chương trước khi tạo bài kiểm tra',true);
  modal(`AI-CLO | ${kind==='multi'?'Kiểm tra nhiều chương':'Kiểm tra 1 chương'}`,createWindowHtml(kind,sets));appWindow();
  const f=$v('#v119CreateForm'),grade=f.elements.counts_toward_grade,ai=f.elements.allow_ai_feedback,note=$v('#v119AiAutoNote');
  $v('#v119CreateCancel').onclick=closeModal;
  grade.onchange=()=>{if(!grade.checked){ai.checked=false;note.hidden=false}else note.hidden=true};
  f.onsubmit=async e=>{
   e.preventDefault();const fd=new FormData(f),multi=kind==='multi';
   const chapters=multi?fd.getAll('chapter_ids').map(String):[String(fd.get('chapter_id')||'')];
   if(multi&&chapters.length<2)return toast('Kiểm tra nhiều chương cần chọn ít nhất 2 chương',true);
   const topics=sets.topics.filter(t=>chapters.includes(String(t.chapter_id))).map(t=>t.id);
   const type=multi?'review_exam':'chapter_test',settings={title:String(fd.get('title')||'').trim(),description:String(fd.get('description')||'').trim(),total_questions:Math.max(1,+fd.get('total_questions')||1),duration_minutes:Math.max(1,+fd.get('duration_minutes')||1),max_attempts:Math.max(1,+fd.get('max_attempts')||1),question_mode:String(fd.get('question_mode')||'common_fixed'),score_policy:String(fd.get('score_policy')||'highest'),opens_at:String(fd.get('opens_at')||''),closes_at:String(fd.get('closes_at')||''),show_answers:!!f.elements.show_answers.checked,shuffle_questions:!!f.elements.shuffle_questions.checked,shuffle_options:!!f.elements.shuffle_options.checked,allow_ai_feedback:!!ai.checked,counts_toward_grade:!!grade.checked,status:'draft'};
   if(settings.opens_at&&settings.closes_at&&new Date(settings.closes_at)<=new Date(settings.opens_at))return toast('Thời gian đóng phải sau thời gian mở',true);
   const data={type,examId:null,settings,selectedChapters:chapters,selectedTopics:topics,structureMode:multi?String(fd.get('structure_mode')||'topic_clo'):'topic_clo',matrix:{},collapsed:{info:false,structure:false,questions:false,export:false},updated_at:Date.now()};
   writeJson(draftKey(type,null),data);writeJson(activeKey(),{type,examId:null,updated_at:Date.now()});closeModal();await window.AICLO_EXAM_BUILDER.open(type,null);setTimeout(patchAll,0);
  };
 }catch(e){console.error(e);showFriendly(e?.message||e)}
}

function patchToolbar(){
 const add=$v('#addExam');if(!add)return;
 tuneBuilderTypes();const bar=add.parentElement;if(!bar)return;bar.classList.add('v119-create-toolbar');
 add.textContent='+ Kiểm tra 1 chương';add.className='primary v119-create-single';add.onclick=e=>{e.preventDefault();e.stopPropagation();openCreateWindow('single')};add.dataset.v119='1';
 let multi=$v('#addMultiExam');if(!multi){multi=document.createElement('button');multi.id='addMultiExam';bar.insertBefore(multi,add.nextSibling)}multi.className='secondary v119-create-multi';multi.textContent='+ Kiểm tra nhiều chương';multi.onclick=e=>{e.preventDefault();e.stopPropagation();openCreateWindow('multi')};
 const clo=$v('#addCloAssessment'),review=$v('#createReviewExam');if(clo)clo.hidden=true;if(review)review.hidden=true;
}
async function fetchExam(id){if(!id)return null;const {data,error}=await db.from('exams').select('*').eq('id',id).maybeSingle();if(error)throw error;return data}
function typeLabel(type){return type==='chapter_test'?'Kiểm tra 1 chương':['review_exam','clo_assessment'].includes(type)?'Kiểm tra nhiều chương':'Bài kiểm tra'}
async function openConfig(id){
 try{
  const exam=await fetchExam(id);if(!exam)return;const [chapters,topics]=await Promise.all([q('chapters','id,name,order_index',x=>contentFilter(x).order('order_index')),q('topics','id,chapter_id,name,order_index',x=>x.order('order_index'))]);
  const ch=(exam.chapter_ids||[]).map(cid=>chapters.find(x=>x.id===cid)).filter(Boolean),tp=(exam.topic_ids||[]).map(tid=>topics.find(x=>x.id===tid)).filter(Boolean),grade=exam.counts_toward_grade!==false,clo=Object.entries(exam.clo_counts||{}).map(([k,v])=>`${k}: ${v}`).join(' · ')||'Chưa có phân bố';
  const html=`<div class="v119-config-grid"><div><b>Loại bài</b><span>${escv(typeLabel(exam.exam_type))}</span></div><div><b>Trạng thái</b><span>${escv(exam.status||'—')}</span></div><div><b>Tổng số câu</b><span>${exam.total_questions||0} câu</span></div><div><b>Thời gian</b><span>${exam.duration_minutes||'—'} phút</span></div><div><b>Số lần làm</b><span>${exam.max_attempts||1} lượt</span></div><div><b>Cách ghi nhận</b><span>${escv(({highest:'Điểm cao nhất',latest:'Lần cuối',average:'Trung bình'}[exam.score_policy]||'Điểm cao nhất'))}</span></div><div><b>Tính vào kết quả học phần</b><span><span class="v119-grade-badge ${grade?'':'off'}">${grade?'Bật':'Tắt'}</span></span></div><div><b>AI sinh viên</b><span>${exam.allow_ai_feedback?'Bật':'Tắt'} · Giảng viên luôn có AI</span></div><div class="v119-config-wide"><b>Chương</b><span>${ch.map(x=>`${x.order_index}. ${x.name}`).join(' · ')||'—'}</span></div><div class="v119-config-wide"><b>Các mục được dùng</b><span>${tp.map(x=>x.name).join(' · ')||'Theo cấu trúc bài'}</span></div><div class="v119-config-wide"><b>Phân bố CLO</b><span>${escv(clo)}</span></div><div><b>Xem đáp án/lời giải</b><span>${exam.show_answers?'Bật':'Tắt'}</span></div><div><b>Trộn câu / phương án</b><span>${exam.shuffle_questions?'Bật':'Tắt'} / ${exam.shuffle_options?'Bật':'Tắt'}</span></div></div>`;
  openDrawer(`Cấu hình · ${exam.title}`,html,null,{wide:true,eyebrow:'CẤU HÌNH BÀI KIỂM TRA'});
 }catch(e){console.error(e);showFriendly(e?.message||e)}
}

async function splitTables(){
 const body=$v('#examRows');if(!body||body.dataset.v119Split==='1'||splitBusy)return;splitBusy=true;
 try{
  const rows=[...body.querySelectorAll('tr')].filter(r=>r.querySelector('[data-attempts]')),ids=[...new Set(rows.flatMap(r=>[...r.querySelectorAll('[data-attempts]')].map(b=>b.dataset.attempts)).filter(Boolean))];
  if(!ids.length){body.dataset.v119Split='1';return}
  const {data,error}=await db.from('exams').select('id,exam_type').in('id',ids);if(error)throw error;const map=new Map((data||[]).map(x=>[x.id,x.exam_type]));
  const table=body.closest('table'),panel=table?.closest('.panel');if(!table||!panel)return;
  panel.querySelector('.v119-list-heading')?.remove();const singleRows=[],multiRows=[];
  for(const row of rows){const id=row.querySelector('[data-attempts]')?.dataset.attempts,type=map.get(id)||'chapter_test',target=['review_exam','clo_assessment'].includes(type)?multiRows:singleRows;target.push(row);const badge=row.querySelector('.ub-type-badge');if(badge)badge.textContent=typeLabel(type);let actions=row.querySelector('.row-actions');if(actions&&!actions.querySelector('[data-v119-config]'))actions.insertAdjacentHTML('afterbegin',`<button type="button" class="v119-config-btn" data-v119-config="${id}">Cấu hình</button>`)}
  body.innerHTML='';singleRows.forEach(r=>body.appendChild(r));if(!singleRows.length)body.innerHTML='<tr><td colspan="8" class="empty">Chưa có bài kiểm tra 1 chương.</td></tr>';
  panel.insertAdjacentHTML('afterbegin',`<div class="v119-list-heading"><h3>Kiểm tra 1 chương</h3><span>${singleRows.length} bài</span></div>`);
  let multiPanel=$v('#v119MultiPanel');if(multiPanel)multiPanel.remove();multiPanel=document.createElement('div');multiPanel.id='v119MultiPanel';multiPanel.className='panel table-wrap v119-list-panel';multiPanel.innerHTML=`<div class="v119-list-heading"><h3>Kiểm tra nhiều chương</h3><span>${multiRows.length} bài</span></div><table class="assessment-table"><thead>${table.tHead?.innerHTML||''}</thead><tbody id="v119MultiRows"></tbody></table>`;panel.after(multiPanel);const mb=multiPanel.querySelector('#v119MultiRows');multiRows.forEach(r=>mb.appendChild(r));if(!multiRows.length)mb.innerHTML='<tr><td colspan="8" class="empty">Chưa có bài kiểm tra nhiều chương.</td></tr>';
  mb.onclick=async e=>{const cfg=e.target.closest('[data-v119-config]');if(cfg){e.preventDefault();e.stopPropagation();return openConfig(cfg.dataset.v119Config)}const b=e.target.closest('[data-attempts]');if(!b)return;e.preventDefault();e.stopPropagation();try{const exam=await fetchExam(b.dataset.attempts);if(exam)await window.AICLO_ASSESSMENT?.openExamDetail?.(exam)}catch(ex){showFriendly(ex?.message||ex)}};
  body.dataset.v119Split='1';
 }catch(e){console.warn('AI-CLO V11.9 split lists',e)}finally{splitBusy=false}
}

function patchDetail(){
 const page=$v('.assessment-detail-page');if(!page)return;const id=(()=>{try{return sessionStorage.getItem(`aiclo:v115:active-exam:${state.subjectId}`)}catch{return''}})();
 const actions=page.querySelector('.assessment-detail-actions');if(actions&&id&&!actions.querySelector('[data-v119-config]')){const b=document.createElement('button');b.type='button';b.className='secondary v119-config-btn';b.dataset.v119Config=id;b.textContent='Cấu hình';b.onclick=()=>openConfig(id);actions.insertBefore(b,actions.firstChild)}
 if(id&&!page.dataset.v119Grade){page.dataset.v119Grade='1';fetchExam(id).then(exam=>{if(!exam||!page.isConnected)return;const meta=page.querySelector('.assessment-detail-meta>div');if(meta&&!meta.querySelector('.v119-grade-badge'))meta.insertAdjacentHTML('beforeend',`<span class="v119-grade-badge ${exam.counts_toward_grade===false?'off':''}">${exam.counts_toward_grade===false?'Không tính vào kết quả học phần':'Tính vào kết quả học phần'}</span><span class="v119-grade-badge">AI sinh viên: ${exam.allow_ai_feedback?'Bật':'Tắt'}</span>`)}).catch(()=>{})}
}

function patchWorkspace(){
 const w=$v('.ub-workspace');if(!w)return;tuneBuilderTypes();const a=activeBuilder(),d=activeDraft();
 const title=w.querySelector('.ub-top h3');if(title&&a?.type)title.textContent=(a.examId?'Chỉnh sửa ':'Tạo ')+typeLabel(a.type).toLowerCase();
 w.querySelectorAll('.ub-type-badge').forEach(()=>{});
 const exportSection=w.querySelector('[data-ub-section="export"]');if(exportSection){const b=exportSection.querySelector('.ub-export-box b');if(b&&/ôn tập/i.test(b.textContent))b.textContent='Xuất bài kiểm tra';const p=exportSection.querySelector('.ub-export-box p');if(p&&/ôn tập/i.test(p.textContent))p.textContent='Xuất đề TeX từ đúng bộ câu hỏi hiện tại. Cả kiểm tra 1 chương và nhiều chương đều dùng chung chức năng xuất này.'}
 const info=w.querySelector('[data-ub-section="info"] .ub-info-list');if(info&&d?.settings&&!info.querySelector('[data-v119-info]')){const grade=d.settings.counts_toward_grade!==false;info.insertAdjacentHTML('beforeend',`<div data-v119-info="grade"><b>Tính vào kết quả học phần:</b> ${grade?'Bật':'Tắt'}</div><div data-v119-info="ai"><b>AI sinh viên:</b> ${d.settings.allow_ai_feedback?'Bật':'Tắt'} <small>· Giảng viên luôn có AI</small></div>`)}
 syncGradeFromActive();
}
function patchInfoModal(){
 const f=$v('#ubInfoForm');if(!f||f.dataset.v119Patched)return;f.dataset.v119Patched='1';const d=activeDraft(),ai=f.elements.allow_ai_feedback;if(!ai)return;const aiRow=ai.closest('.aiclo-switch-row');if(aiRow)aiRow.querySelector('span:first-child').textContent='Cho phép sinh viên nhận xét AI';
 const gradeOn=d?.settings?.counts_toward_grade!==false;const holder=aiRow?.parentElement;if(holder&&!holder.querySelector('[name="counts_toward_grade"]'))aiRow.insertAdjacentHTML('beforebegin',sw('counts_toward_grade','Tính vào kết quả học phần',gradeOn));const grade=f.elements.counts_toward_grade;if(!grade)return;
 let note=document.createElement('div');note.className='v119-switch-note';note.hidden=true;note.textContent='Nhận xét AI của sinh viên đã được tắt mặc định vì bài này không tính vào kết quả học phần. Giảng viên vẫn luôn có đầy đủ nút AI và có thể bật lại quyền AI cho sinh viên.';holder?.after(note);
 grade.onchange=()=>{if(!grade.checked){ai.checked=false;note.hidden=false}else note.hidden=true};
 f.addEventListener('submit',()=>{const a=activeBuilder(),key=a?.type?draftKey(a.type,a.examId||null):null;if(key){const x=readJson(key,null);if(x?.settings){x.settings.counts_toward_grade=!!grade.checked;x.settings.allow_ai_feedback=!!ai.checked;writeJson(key,x)}}setTimeout(syncGradeFromActive,900)},true);
}
function patchStructureModal(){
 const f=$v('#ubStructureForm');if(!f||f.dataset.v119Patched)return;const a=activeBuilder();if(a?.type!=='chapter_test')return;f.dataset.v119Patched='1';const refresh=()=>{const boxes=$$v('[data-ub-chapter]',f),checked=boxes.filter(x=>x.checked);boxes.forEach(x=>x.disabled=checked.length===1&&!x.checked)};refresh();f.addEventListener('change',e=>{if(e.target.matches('[data-ub-chapter]'))setTimeout(()=>patchStructureModal(),0)},true);
 const help=f.querySelector('.ub-structure-help span');if(help)help.textContent='Kiểm tra 1 chương chỉ chọn một chương. Các câu được phân bố theo CLO cho từng mục trong chương.';
}
function patchAll(){injectCss();tuneBuilderTypes();patchToolbar();splitTables();patchDetail();patchWorkspace();patchInfoModal();patchStructureModal()}

function installDelegation(){
 document.addEventListener('click',e=>{const c=e.target.closest?.('[data-v119-config]');if(!c)return;e.preventDefault();e.stopImmediatePropagation();openConfig(c.dataset.v119Config)},true);
}
function init(){
 injectCss();tuneBuilderTypes();watchErrors();installDelegation();const host=$v('#content');if(host&&!observer){observer=new MutationObserver(()=>requestAnimationFrame(patchAll));observer.observe(host,{childList:true,subtree:true})}
 patchAll();document.addEventListener('visibilitychange',()=>{if(!document.hidden){setTimeout(patchAll,60);setTimeout(syncGradeFromActive,600)}});window.addEventListener('pageshow',()=>setTimeout(patchAll,80));
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
window.AICLO_ONLINE_ASSESSMENT_V119=Object.freeze({version:VERSION,openCreate:openCreateWindow,config:openConfig,patch:patchAll});
})();
