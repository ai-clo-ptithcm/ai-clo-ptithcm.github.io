import { readExcel, sheetToArray, readAnswerWorkbook } from './excel.js';
import { normalizeUntData, isValidSbd, rebuildExamCount } from './untNormalizer.js';
import { reviewAllSbd } from './phach/reviewDialog.js';
import { loadUntWorkbook } from './phach/excelWorkbook.js';
import { extractPhachImages } from './phach/imageExtractor.js';
import { reviewExamCodeMapping } from './examCodeReview.js';
import { gradeAllStudents } from './grader.js';
import { calculateAllScores } from './score.js';
import { parseExamOfficeWorkbook, suggestOfficeSheet } from './examOffice.js';
import { exportMarkMulti, exportDetailMulti } from './exportMulti.js';
import { exportReport } from './exportReport.js';
import { initLog, addLog, clearLog, getLogText } from './log.js';
import { buildAnswerDataFromDirect, storeFromAnswerData } from './directAnswer.js';
import { createDirectAnswerGrid } from './directAnswerGrid.js';
import { reviewAnswerData } from './answerReview.js';

const state={answerData:null,answerCacheKey:null,answerConfirmedKey:null,rooms:[],officeData:null,officeTemplateBuffer:null,maxScores:null};
const $=id=>document.getElementById(id);
const result=$('result'), untInput=$('untFile'), answerInput=$('answerFile'), officeInput=$('officeFile');
const btnProcess=$('btnProcess'), btnMark=$('btnExportMark'), btnDetail=$('btnExportDetail'), btnReport=$('btnExportReport');
initLog($('logBox'));

function esc(v){return String(v??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')}
function fileNames(input){return [...(input.files||[])].map(f=>f.name).join(', ')}
function setExportsEnabled(enabled){btnMark.disabled=!enabled;btnDetail.disabled=!enabled;btnReport.disabled=!enabled}
function bind(input,stateEl){input?.addEventListener('change',()=>{stateEl.textContent=input.files?.length?fileNames(input):(input===officeInput?'Không bắt buộc':'Chưa chọn file');setExportsEnabled(false)})}
bind(untInput,$('untFileState'));bind(answerInput,$('answerFileState'));bind(officeInput,$('officeFileState'));
answerInput?.addEventListener('change',()=>{state.answerData=null;state.answerCacheKey=null;state.answerConfirmedKey=null});
$('btnClearLog')?.addEventListener('click',clearLog);
$('btnCopyLog')?.addEventListener('click',async()=>{try{await navigator.clipboard.writeText(getLogText());addLog('Đã sao chép log vào clipboard.','info')}catch{alert('Trình duyệt không cho phép sao chép tự động.')}});

function answerMode(){return $('answerSourceDirect')?.checked?'direct':'excel'}
function syncAnswerModeUi(){
  const direct=answerMode()==='direct';
  $('directAnswerPanel').hidden=!direct;$('answerExcelPanel').hidden=direct;
  state.answerData=null;state.answerCacheKey=null;state.answerConfirmedKey=null;setExportsEnabled(false);
}
$('answerSourceExcel')?.addEventListener('change',syncAnswerModeUi);$('answerSourceDirect')?.addEventListener('change',syncAnswerModeUi);

function resetDirectCache(){state.answerData=null;state.answerCacheKey=null;state.answerConfirmedKey=null;setExportsEnabled(false)}

const directGrid=createDirectAnswerGrid({
  host:$('directAnswerGridHost'),
  questionInput:$('directQuestionCount'),
  applyQuestionButton:$('btnApplyDirectQuestionCount'),
  verticalButton:$('btnDirectVertical'),
  horizontalButton:$('btnDirectHorizontal'),
  validateButton:$('btnValidateDirectAnswer'),
  clearButton:$('btnClearDirectAnswer'),
  statusElement:$('directAnswerStatus'),
  validationElement:$('directAnswerValidation'),
  onChange:resetDirectCache
});

async function loadAnswerData(){
  if(answerMode()==='direct'){
    if(state.answerData && state.answerCacheKey==='direct') return state.answerData;
    const data=buildAnswerDataFromDirect(directGrid.getStore({requireValid:true}));data.sourceLabel='Nhập trực tiếp trên bảng';state.answerData=data;state.answerCacheKey='direct';return data;
  }
  const file=answerInput.files?.[0];if(!file) throw new Error('Vui lòng chọn file đáp án Excel hoặc chuyển sang “Nhập trực tiếp”.');
  const key=`${file.name}|${file.size}|${file.lastModified}`;
  if(state.answerData && state.answerCacheKey===key) return state.answerData;
  const wb=await readExcel(file), data=readAnswerWorkbook(wb);data.sourceLabel=`File Excel: ${file.name}`;state.answerData=data;state.answerCacheKey=key;return data;
}

$('btnReviewAnswer')?.addEventListener('click',async()=>{
  try{
    const data=await loadAnswerData();
    await reviewAnswerData({container:result,answerData:data,title:`Đáp án đang dùng — ${data.sourceLabel||''}`});
    state.answerData=data;state.answerConfirmedKey=state.answerCacheKey;
    if(answerMode()==='direct'){directGrid.setStore(storeFromAnswerData(data))}
    addLog('Đã lưu chỉnh sửa trong bảng xem lại đáp án.','warn');
    if(state.rooms.length){
      state.rooms=[];setExportsEnabled(false);
      result.innerHTML='<div class="warning-box"><b>Đáp án đã được chỉnh sửa.</b><br>Để bảo đảm điểm đúng, hãy bấm “Đọc dữ liệu và chấm bài” lại. Các file đã chọn vẫn còn, không cần chọn lại.</div>';
      addLog('Đáp án thay đổi sau khi đã chấm; kết quả cũ đã được khóa xuất. Cần chấm lại để cập nhật điểm.','warn');
    } else result.innerHTML='<div class="success-box"><b>Đã lưu đáp án.</b> Có thể tiếp tục chọn file UnT và chấm bài.</div>';
  }catch(e){if(e.name!=='UserCancelledError'){alert(e.message);addLog(e.message,'error')}else if(state.rooms.length) renderSummary(); else result.innerHTML=''}
});

function calcMaxScores(answerData){
 const first=answerData.exams[Object.keys(answerData.exams)[0]], out={};
 for(const clo in first.cloCount) out[clo]=(first.cloCount[clo]/first.totalQuestion)*10;
 return out;
}
function regrade(room){gradeAllStudents(state.answerData,room.untData);calculateAllScores(state.answerData,room.untData,state.maxScores)}
function roomInvalidStudents(room){return room.untData.students.filter(s=>!isValidSbd(s.sbd));}

async function reviewRoomSbd(room,force=false){
 const invalid=roomInvalidStudents(room);
 if(!force && !invalid.length) return;
 addLog(`${room.fileName}: ${invalid.length||0} SBD chưa hợp lệ; mở bảng kiểm tra toàn bộ ${room.untData.students.length} dòng.`,invalid.length?'warn':'info');
 const beforeCodes=room.untData.students.map(s=>s.examCode);
 const out=await reviewAllSbd({container:result,students:room.untData.students,imageMap:room.phachImages,title:`${room.fileName} — kiểm tra toàn bộ SBD và mã đề`});
 rebuildExamCount(room.untData);
 const changedCodes=room.untData.students.filter((s,i)=>s.examCode!==beforeCodes[i]);
 if(changedCodes.length) addLog(`${room.fileName}: đã chỉnh mã đề cho ${changedCodes.length} dòng trong bảng kiểm tra.`,'warn');
 if(out.duplicates?.length) addLog(`${room.fileName}: đã xác nhận tiếp tục với ${out.duplicates.length} trường hợp SBD trùng.`,'warn');
 addLog(`${room.fileName}: đã xác nhận danh sách SBD/mã đề.`);
}

function renderOfficeReview(){
 if(!state.officeData?.sheets?.length) return Promise.resolve();
 return new Promise((resolve,reject)=>{
   const rows=state.rooms.map((room,i)=>{const sug=suggestOfficeSheet(room.untData,state.officeData);room.officeSuggestion=sug;return `<tr><td>${esc(room.fileName)}</td><td>${sug?`${sug.hits} SBD trùng`:0}</td><td><select class="office-select" data-i="${i}">${state.officeData.sheets.map(s=>`<option value="${esc(s.name)}" ${sug?.sheet?.name===s.name?'selected':''}>${esc(s.name)} (${s.sbds.length} phách)</option>`).join('')}</select></td></tr>`}).join('');
   result.innerHTML=`<div class="result-box review-panel"><div class="result-head"><div><span class="section-kicker">GHÉP FILE KHẢO THÍ</span><h2 class="result-title">Xác nhận phòng/sheet khảo thí</h2></div><span class="warning-pill">Tùy chọn nhưng cần xác nhận nếu đã tải</span></div><p class="review-description">Hệ thống gợi ý sheet dựa trên số phách trùng. Hãy kiểm tra trước khi tiếp tục.</p><div class="table-wrapper"><table><thead><tr><th>File UnT</th><th>Mức khớp</th><th>Sheet khảo thí</th></tr></thead><tbody>${rows}</tbody></table></div><div class="review-actions"><button class="secondary-action" id="cancelOffice">Hủy</button><button class="primary-inline-action" id="confirmOffice">Xác nhận ghép phòng</button></div></div>`;
   result.querySelector('#confirmOffice')?.addEventListener('click',()=>{
     result.querySelectorAll('.office-select').forEach(sel=>{const room=state.rooms[Number(sel.dataset.i)];room.officeSheet=state.officeData.sheets.find(s=>s.name===sel.value)||null;room.displayName=room.officeSheet?.name||room.fileName.replace(/\.xlsx?$/i,'')});
     state.rooms.forEach(r=>addLog(`${r.fileName}: ghép với sheet khảo thí “${r.officeSheet?.name||'—'}”.`)); resolve();
   });
   result.querySelector('#cancelOffice')?.addEventListener('click',()=>{const e=new Error('Đã hủy xác nhận file khảo thí.');e.name='UserCancelledError';reject(e)});
 });
}

function renderSummary(){
 const rows=state.rooms.map((r,i)=>{
   const invalid=roomInvalidStudents(r).length;
   const absent=r.officeSheet?Math.max(0,r.officeSheet.sbds.length-r.untData.students.length):0;
   return `<tr><td>${esc(r.displayName||r.fileName)}</td><td>${r.untData.students.length}</td><td>${Object.keys(r.untData.examCount).join(', ')}</td><td>${invalid?'❌ '+invalid:'✅'}</td><td>${r.officeSheet?`${r.officeSheet.sbds.length} phách; dự kiến ${absent} dòng trống`:'Không dùng'}</td><td><button class="secondary-action btn-edit-sbd" data-i="${i}">Chỉnh SBD / mã đề</button></td></tr>`;
 }).join('');
 result.innerHTML=`<div class="result-box"><div class="result-head"><div><span class="section-kicker">KẾT QUẢ KIỂM TRA</span><h2 class="result-title">Đã chấm ${state.rooms.length} file UnT</h2></div><span class="success-pill">✓ Sẵn sàng xuất 3 file Excel</span></div><div class="summary-container"><div class="summary-item"><h4>Số file UnT</h4><div class="value">${state.rooms.length}</div></div><div class="summary-item"><h4>Tổng bài</h4><div class="value">${state.rooms.reduce((a,r)=>a+r.untData.students.length,0)}</div></div><div class="summary-item"><h4>Số câu</h4><div class="value">${state.answerData.totalQuestion}</div></div></div><div class="review-actions summary-top-actions"><button class="secondary-action" id="reviewAnswerAgain">Xem / chỉnh đáp án</button></div><div class="table-wrapper"><table><thead><tr><th>Phòng/File</th><th>Số bài</th><th>Mã đề</th><th>SBD</th><th>Khảo thí</th><th></th></tr></thead><tbody>${rows}</tbody></table></div><p class="review-description">Câu bỏ trống hoặc chọn nhiều đáp án được tính sai bình thường và không làm dừng chấm.</p></div>`;
 result.querySelector('#reviewAnswerAgain')?.addEventListener('click',()=>$('btnReviewAnswer').click());
 result.querySelectorAll('.btn-edit-sbd').forEach(btn=>btn.addEventListener('click',async()=>{
   const room=state.rooms[Number(btn.dataset.i)];
   try{await reviewRoomSbd(room,true);regrade(room);addLog(`${room.fileName}: đã cập nhật SBD/mã đề và chấm lại.`);renderSummary()}catch(e){if(e.name!=='UserCancelledError') alert(e.message); else renderSummary()}
 }));
}

btnProcess?.addEventListener('click',async()=>{
 const untFiles=[...(untInput.files||[])], officeFile=officeInput.files?.[0];
 if(!untFiles.length) return alert('Vui lòng chọn ít nhất một file UnT.');
 try{
   btnProcess.disabled=true;setExportsEnabled(false);clearLog();state.rooms=[];
   addLog(`Bắt đầu xử lý ${untFiles.length} file UnT.`,'info');
   state.answerData=await loadAnswerData();
   addLog(`Đã đọc đáp án (${state.answerData.sourceLabel}): ${Object.keys(state.answerData.exams).length} mã đề, ${state.answerData.totalQuestion} câu.`);
   if(state.answerConfirmedKey!==state.answerCacheKey){
     await reviewAnswerData({container:result,answerData:state.answerData,title:`Xác nhận đáp án — ${state.answerData.sourceLabel||''}`});
     state.answerConfirmedKey=state.answerCacheKey;
     if(answerMode()==='direct') directGrid.setStore(storeFromAnswerData(state.answerData));
     addLog('Đã xác nhận số mã đề, số câu và phân bố CLO của đáp án.','info');
   }
   state.maxScores=calcMaxScores(state.answerData);
   if(officeFile){const wb=await readExcel(officeFile);state.officeData=parseExamOfficeWorkbook(wb);state.officeTemplateBuffer=/\.xlsx$/i.test(officeFile.name)?await officeFile.arrayBuffer():null;addLog(`Đã đọc file khảo thí: tìm thấy ${state.officeData.sheets.length} sheet có danh sách số phách.`);if(!state.officeTemplateBuffer)addLog('File khảo thí không phải .xlsx nên chỉ dùng để ghép phách; phần đầu biểu mẫu sẽ dùng mẫu mặc định.','warn')} else {state.officeData=null;state.officeTemplateBuffer=null;addLog('Không sử dụng file khảo thí. Web vẫn chấm bình thường.','info')}

   for(const file of untFiles){
     addLog(`Đang đọc ${file.name}...`,'info');
     const wb=await readExcel(file), data=sheetToArray(wb), untData=normalizeUntData(data,state.answerData);
     let phachImages=new Map();
     try{const imageWb=await loadUntWorkbook(file);phachImages=extractPhachImages(imageWb,0);addLog(`${file.name}: tìm thấy ${phachImages.size} ảnh số phách ở cột B.`,'info')}
     catch(imageErr){addLog(`${file.name}: không đọc được ảnh số phách (${imageErr.message}). Vẫn có thể nhập SBD thủ công.`,'warn')}
     const room={fileName:file.name,displayName:file.name.replace(/\.xlsx?$/i,''),untData,phachImages};state.rooms.push(room);
     addLog(`${file.name}: nhận diện ${untData.students.length} bài.`);
     const bad=roomInvalidStudents(room);
     if(bad.length){addLog(`${file.name}: có ${bad.length} SBD sai/trống tại dòng ${bad.slice(0,12).map(x=>x.excelRow).join(', ')}${bad.length>12?'...':''}.`,'warn');await reviewRoomSbd(room)}
     await reviewExamCodeMapping({container:result,answerData:state.answerData,untData});
     if(untData.examCodeMapping) addLog(`${file.name}: đã xác nhận ánh xạ mã đề ${Object.entries(untData.examCodeMapping).map(([a,b])=>`${a}→${b}`).join(', ')}.`,'warn');
     regrade(room);
     const errors=untData.students.filter(s=>s.result?.error);
     if(errors.length){addLog(`${file.name}: còn ${errors.length} bài chưa chấm được do mã đề chưa khớp.`, 'error');throw new Error(`${file.name}: còn bài chưa có đáp án tương ứng. Hãy kiểm tra mã đề.`)}
     addLog(`${file.name}: chấm xong ${untData.students.length} bài.`);
   }
   if(state.officeData) await renderOfficeReview();
   renderSummary();setExportsEnabled(true);addLog('Hoàn tất. Có thể xuất 3 file Excel.');
 }catch(e){console.error(e);const cancel=e.name==='UserCancelledError';result.innerHTML=`<div class="${cancel?'warning-box':'error-box'}"><b>${cancel?'Đã dừng thao tác':'Không thể chấm bài'}.</b><br>${esc(e.message).replace(/\n/g,'<br>')}</div>`;addLog(e.message,cancel?'warn':'error');if(!cancel) alert(e.message)}finally{btnProcess.disabled=false}
});

btnMark?.addEventListener('click',async()=>{try{btnMark.disabled=true;addLog('Đang xuất Bảng điểm phách...','info');await exportMarkMulti(state.answerData,state.rooms,state.officeTemplateBuffer);addLog('Đã xuất Bảng điểm phách (có sheet Đáp án).')}catch(e){alert(e.message);addLog(e.message,'error')}finally{btnMark.disabled=false}});
btnDetail?.addEventListener('click',async()=>{try{btnDetail.disabled=true;addLog('Đang xuất Bảng điểm chi tiết...','info');await exportDetailMulti(state.answerData,state.rooms,state.officeTemplateBuffer);addLog('Đã xuất Bảng điểm chi tiết.')}catch(e){alert(e.message);addLog(e.message,'error')}finally{btnDetail.disabled=false}});
btnReport?.addEventListener('click',async()=>{try{btnReport.disabled=true;addLog('Đang xuất file Báo cáo...','info');await exportReport(state.answerData,state.rooms);addLog('Đã xuất Báo cáo: Đáp án + Toàn bộ bài làm + BM33 - Báo cáo.')}catch(e){alert(e.message);addLog(e.message,'error')}finally{btnReport.disabled=false}});

syncAnswerModeUi();
