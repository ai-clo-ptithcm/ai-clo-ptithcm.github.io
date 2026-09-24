import { listRoster } from '../../services/exams.js';
import { operations } from '../../services/operations.js';
import { readFirstSheet,pick,exportAccessCodes,printAccessCodes } from '../../services/spreadsheet.js';
import { hasPermission } from '../../core/permissions.js';
import { escapeHtml,openModal,closeModal,toast,setBusy,errorMessage,confirmDialog } from '../../core/ui.js';

export async function renderRoster(ctx){
  const {host,profile,membership,exam,sessions}=ctx;
  const can=hasPermission(profile,membership,'manage_roster'),editable=exam.status==='draft';
  const roster=await listRoster(exam.id),rooms=sessions.flatMap(s=>(s.exam_rooms||[]).map(r=>({...r,sessionId:s.id,sessionName:s.name})));
  host.innerHTML=`<div class="card"><div class="toolbar"><div><div class="card-title">Danh sách dự thi</div><div class="muted">${roster.length} sinh viên · MSSV + mã riêng theo kỳ thi</div></div>${can&&editable?`<div class="toolbar-group"><button class="btn btn-secondary" data-codes>Sinh lại toàn bộ mã</button><button class="btn btn-primary" data-import>Import Excel / CSV</button></div>`:''}</div>${!editable?'<div class="alert alert-info" style="margin-top:12px">Kỳ thi đã chốt. Danh sách và mã thi đang được khóa.</div>':''}${roster.length?`<div class="table-wrap"><table class="table"><thead><tr><th>MSSV</th><th>Họ tên</th><th>Lớp</th><th>Ca</th><th>Phòng</th><th>Trạng thái</th>${can&&editable?'<th></th>':''}</tr></thead><tbody>${roster.map(s=>`<tr><td><strong>${escapeHtml(s.student_code)}</strong></td><td>${escapeHtml(s.full_name)}</td><td>${escapeHtml(s.class_name||'')}</td><td>${escapeHtml(s.exam_sessions?.name||'')}</td><td>${escapeHtml(s.exam_rooms?.name||'')}</td><td>${s.locked?'<span class="badge badge-danger">Đã khóa</span>':'<span class="badge badge-success">Hoạt động</span>'}</td>${can&&editable?`<td style="text-align:right"><button class="btn btn-secondary" data-code-one="${s.id}">Sinh lại mã</button></td>`:''}</tr>`).join('')}</tbody></table></div>`:'<div class="empty-state">Chưa có sinh viên. Hãy tạo ca/phòng trước rồi import danh sách.</div>'}</div>`;

  host.querySelector('[data-import]')?.addEventListener('click',()=>importModal(ctx,rooms));
  host.querySelector('[data-codes]')?.addEventListener('click',async()=>{
    if(!roster.length)return toast('Chưa có sinh viên.','error');
    if(!await confirmDialog({title:'Sinh lại toàn bộ mã thi',message:'Toàn bộ mã thi hiện tại sẽ mất hiệu lực. Mã mới chỉ hiển thị trong lần này để bạn tải Excel/PDF.',confirmText:'Sinh mã mới',danger:true}))return;
    try{const res=await operations.generateCodes(exam.id);showCodes(res.codes,sessions,rooms,exam);}catch(e){toast(errorMessage(e),'error');}
  });
  host.querySelectorAll('[data-code-one]').forEach(btn=>btn.addEventListener('click',async()=>{
    const student=roster.find(s=>s.id===btn.dataset.codeOne);if(!student)return;
    if(!await confirmDialog({title:'Sinh lại mã cho 1 sinh viên',message:`Mã hiện tại của ${student.student_code} — ${student.full_name} sẽ mất hiệu lực. Chỉ sinh lại mã của sinh viên này.`,confirmText:'Sinh lại mã',danger:true}))return;
    setBusy(btn,true,'Đang sinh…');
    try{
      const res=await operations.generateCodes(exam.id,[student.id]);
      if(!res.codes?.length)throw new Error('Không sinh được mã mới.');
      showCodes(res.codes,sessions,rooms,exam);
    }catch(e){toast(errorMessage(e),'error');}finally{setBusy(btn,false);}
  }));
}

function maps(sessions,rooms){return {sessionMap:new Map(sessions.map(s=>[s.id,s.name])),roomMap:new Map(rooms.map(r=>[r.id,r.name]))};}
function showCodes(codes,sessions,rooms,exam){
  const {sessionMap,roomMap}=maps(sessions,rooms);
  openModal({title:`Mã thi mới (${codes.length})`,body:`<div class="alert alert-warning"><strong>Lưu ý:</strong> hệ thống chỉ lưu hash. Danh sách mã thô này không thể xem lại; nếu mất phải sinh lại mã.</div><div class="table-wrap" style="margin-top:12px;max-height:46vh"><table class="table"><thead><tr><th>MSSV</th><th>Họ tên</th><th>Mã thi</th></tr></thead><tbody>${codes.slice(0,300).map(x=>`<tr><td>${escapeHtml(x.studentCode)}</td><td>${escapeHtml(x.fullName)}</td><td><strong>${escapeHtml(x.accessCode)}</strong></td></tr>`).join('')}</tbody></table></div>`,footer:'<button class="btn btn-secondary" data-print>In / Lưu PDF</button><button class="btn btn-primary" data-xlsx>Tải Excel</button><button class="btn btn-secondary" data-close>Đóng</button>',onMount(modal){modal.querySelector('[data-close]').onclick=closeModal;modal.querySelector('[data-xlsx]').onclick=()=>exportAccessCodes(codes,sessionMap,roomMap,`${exam.code}-ma-thi.xlsx`);modal.querySelector('[data-print]').onclick=()=>printAccessCodes(codes,sessionMap,roomMap,`${exam.name} — Danh sách mã thi`);}});
}

function importModal(ctx,rooms){
  const {exam,sessions,reload}=ctx;
  if(!sessions.length||!rooms.length)return toast('Cần tạo ca thi và phòng thi trước.','error');
  openModal({title:'Import danh sách sinh viên',body:`<div class="stack"><div class="alert">File có thể dùng các cột <strong>MSSV / SBD</strong>, <strong>Họ tên</strong>, <strong>Lớp</strong>, <strong>Ca</strong>, <strong>Phòng</strong>. Nếu kỳ thi chỉ có một ca/phòng, có thể bỏ cột tương ứng.</div><div class="field"><label>File Excel hoặc CSV</label><input id="roster-file" class="input" type="file" accept=".xlsx,.xls,.csv" required></div><div id="roster-preview" class="muted">Chưa chọn file.</div></div>`,footer:'<button class="btn btn-secondary" data-cancel>Hủy</button><button class="btn btn-primary" data-import disabled>Import</button>',onMount(modal){
    let prepared=[];
    const fileInput=modal.querySelector('#roster-file'),preview=modal.querySelector('#roster-preview'),btn=modal.querySelector('[data-import]');
    modal.querySelector('[data-cancel]').onclick=closeModal;
    fileInput.onchange=async()=>{
      btn.disabled=true;prepared=[];
      try{
        const rows=await readFirstSheet(fileInput.files[0]),sessionByName=new Map(sessions.map(s=>[String(s.name).trim().toLowerCase(),s])),roomByKey=new Map(rooms.map(r=>[`${r.sessionId}|${String(r.name).trim().toLowerCase()}`,r])),issues=[];
        for(let i=0;i<rows.length;i++){
          const row=rows[i],studentCode=String(pick(row,['MSSV','Mã sinh viên','Ma sinh vien','SBD','Số báo danh'])||'').trim(),fullRaw=pick(row,['Họ tên','Họ và tên','Ho ten','Full name']),family=pick(row,['Họ','Ho']),given=pick(row,['Tên','Ten']),fullName=String(fullRaw||`${family||''} ${given||''}`).trim(),className=String(pick(row,['Lớp','Lop','Class'])||'').trim(),sessionName=String(pick(row,['Ca','Ca thi'])||'').trim(),roomName=String(pick(row,['Phòng','Phong','Phòng thi','Phong thi'])||'').trim();
          if(!studentCode&&!fullName)continue;
          const session=sessionName?sessionByName.get(sessionName.toLowerCase()):sessions.length===1?sessions[0]:null,candidateRooms=session?rooms.filter(r=>r.sessionId===session.id):[],room=roomName&&session?roomByKey.get(`${session.id}|${roomName.toLowerCase()}`):candidateRooms.length===1?candidateRooms[0]:null;
          if(!studentCode||!fullName||!session||!room){issues.push(`Dòng ${i+2}: ${studentCode||'(thiếu MSSV)'} — chưa xác định đủ họ tên/ca/phòng.`);continue;}
          prepared.push({studentCode,fullName,className,sessionId:session.id,roomId:room.id});
        }
        if(issues.length)preview.innerHTML=`<div class="alert alert-danger"><strong>${issues.length} dòng cần sửa.</strong><br>${issues.slice(0,8).map(escapeHtml).join('<br>')}${issues.length>8?'<br>…':''}</div><p>Đã nhận hợp lệ: ${prepared.length} dòng.</p>`;
        else preview.innerHTML=`<div class="alert alert-success">Đã đọc <strong>${prepared.length}</strong> sinh viên. Không phát hiện lỗi ánh xạ ca/phòng.</div>`;
        btn.disabled=!prepared.length||issues.length>0;
      }catch(e){preview.innerHTML=`<div class="alert alert-danger">${escapeHtml(errorMessage(e))}</div>`;}
    };
    btn.onclick=async()=>{setBusy(btn,true,'Đang import…');try{const res=await operations.importRoster(exam.id,prepared);toast(`Đã import: ${res.created} mới, ${res.updated} cập nhật.`,'success');closeModal();if(res.newCodes?.length)showCodes(res.newCodes,sessions,rooms,exam);await reload();}catch(e){toast(errorMessage(e),'error');setBusy(btn,false);}};
  }});
}
