import { createSession,updateSession,createRoom,updateRoom } from '../../services/exams.js';
import { hasPermission } from '../../core/permissions.js';
import { escapeHtml,formatDateTime,badge,openModal,closeModal,toast,setBusy,errorMessage } from '../../core/ui.js';

export async function renderSessions(ctx){
  const {host,profile,membership,rawMembership,exam,sessions,reload}=ctx;
  const canManageAssigned=hasPermission(profile,membership,'manage_sessions');
  const canCreateSession=hasPermission(profile,rawMembership||membership,'manage_sessions');
  const editable=exam.status==='draft';
  host.innerHTML=`<div class="card"><div class="toolbar"><div><div class="card-title">Ca thi & phòng thi</div><div class="muted">${editable?'Có thể chỉnh tên ca, thời gian, thời lượng và phòng thi trước khi Chốt kỳ thi.':'Kỳ thi đã chốt: thông tin ca/phòng đang được khóa.'}</div></div>${editable&&canCreateSession?'<button class="btn btn-primary" data-add-session>Thêm ca thi</button>':''}</div>${!editable?'<div class="alert alert-info" style="margin-top:12px">Muốn sửa cấu trúc ca/phòng, hãy dùng “Mở lại chỉnh sửa” trước khi có sinh viên bắt đầu làm bài.</div>':''}${sessions.length?sessions.map(s=>sessionCard(s,editable&&canManageAssigned)).join(''):'<div class="empty-state">Chưa có ca thi trong phạm vi được phân công.</div>'}</div>`;
  host.querySelector('[data-add-session]')?.addEventListener('click',()=>sessionModal(exam.id,reload));
  host.querySelectorAll('[data-edit-session]').forEach(b=>b.addEventListener('click',()=>sessionModal(exam.id,reload,sessions.find(s=>s.id===b.dataset.editSession))));
  host.querySelectorAll('[data-add-room]').forEach(b=>b.addEventListener('click',()=>roomModal(b.dataset.addRoom,reload)));
  host.querySelectorAll('[data-edit-room]').forEach(b=>b.addEventListener('click',()=>{
    const session=sessions.find(s=>(s.exam_rooms||[]).some(r=>r.id===b.dataset.editRoom));
    const room=session?.exam_rooms?.find(r=>r.id===b.dataset.editRoom);if(room)roomModal(session.id,reload,room);
  }));
}

function sessionCard(s,can){
  const rooms=s.exam_rooms||[];
  return `<section class="card" style="margin-top:12px;background:var(--surface-2)"><div class="row wrap" style="justify-content:space-between"><div><strong>${escapeHtml(s.name)}</strong><div class="muted">${formatDateTime(s.starts_at)} → ${formatDateTime(s.ends_at)} · ${s.duration_minutes} phút</div></div><div class="row wrap">${badge(s.status,s.status==='live'?'success':s.status==='ready'?'info':'')}${can?`<button class="btn btn-secondary" data-edit-session="${s.id}">Sửa ca</button><button class="btn btn-secondary" data-add-room="${s.id}">+ Phòng</button>`:''}</div></div><div style="margin-top:12px">${rooms.length?`<div class="table-wrap"><table class="table"><thead><tr><th>Phòng</th><th>Sức chứa</th><th>Ghi chú</th>${can?'<th></th>':''}</tr></thead><tbody>${rooms.map(r=>`<tr><td><strong>${escapeHtml(r.name)}</strong></td><td>${r.capacity??'—'}</td><td>${escapeHtml(r.location_note||'')}</td>${can?`<td style="text-align:right"><button class="btn btn-secondary" data-edit-room="${r.id}">Sửa</button></td>`:''}</tr>`).join('')}</tbody></table></div>`:'<div class="empty-state" style="padding:18px">Chưa có phòng.</div>'}</div></section>`;
}

function inputLocal(value){
  const d=value?new Date(value):new Date();
  return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,16);
}

function sessionModal(examId,reload,current=null){
  const editing=!!current;
  let start,end;
  if(editing){start=new Date(current.starts_at);end=new Date(current.ends_at);}else{start=new Date(Date.now()+3600000);start.setMinutes(Math.ceil(start.getMinutes()/15)*15,0,0);end=new Date(start.getTime()+60*60000);}
  openModal({title:editing?'Sửa ca thi':'Thêm ca thi',body:`<form id="session-form" class="stack"><div class="field"><label>Tên ca</label><input class="input" name="name" value="${escapeHtml(current?.name||'')}" placeholder="Ca 1" required></div><div class="form-grid"><div class="field"><label>Bắt đầu</label><input class="input" type="datetime-local" name="starts_at" value="${inputLocal(start)}" required></div><div class="field"><label>Kết thúc</label><input class="input" type="datetime-local" name="ends_at" value="${inputLocal(end)}" required></div><div class="field"><label>Thời gian làm (phút)</label><input class="input" type="number" name="duration_minutes" min="1" max="600" value="${Number(current?.duration_minutes||60)}" required></div></div><div class="field"><label>Hướng dẫn (tùy chọn)</label><textarea class="textarea" name="instructions_html">${escapeHtml(current?.instructions_html||'')}</textarea></div></form>`,footer:`<button class="btn btn-secondary" data-cancel>Hủy</button><button class="btn btn-primary" data-save>${editing?'Lưu thay đổi':'Lưu ca thi'}</button>`,onMount(modal){
    modal.querySelector('[data-cancel]').onclick=closeModal;
    modal.querySelector('[data-save]').onclick=async e=>{
      const form=modal.querySelector('#session-form');if(!form.reportValidity())return;
      const raw=Object.fromEntries(new FormData(form)),starts_at=new Date(raw.starts_at),ends_at=new Date(raw.ends_at),duration=Number(raw.duration_minutes||0),windowMinutes=(ends_at-starts_at)/60000;
      if(ends_at<=starts_at)return toast('Giờ kết thúc phải sau giờ bắt đầu.','error');
      if(duration>windowMinutes)return toast('Thời gian làm bài không được dài hơn cửa sổ ca thi.','error');
      const btn=e.currentTarget;setBusy(btn,true);
      try{const payload={...raw,starts_at,ends_at};if(editing)await updateSession(current.id,payload);else await createSession(examId,payload);closeModal();toast(editing?'Đã cập nhật ca thi.':'Đã thêm ca thi.','success');await reload();}catch(err){toast(errorMessage(err),'error');setBusy(btn,false);}
    };
  }});
}

function roomModal(sessionId,reload,current=null){
  const editing=!!current;
  openModal({title:editing?'Sửa phòng thi':'Thêm phòng thi',body:`<form id="room-form" class="stack"><div class="field"><label>Tên phòng</label><input class="input" name="name" value="${escapeHtml(current?.name||'')}" placeholder="A101" required></div><div class="field"><label>Sức chứa</label><input class="input" name="capacity" type="number" min="1" value="${current?.capacity??''}" placeholder="200"></div><div class="field"><label>Ghi chú</label><input class="input" name="location_note" value="${escapeHtml(current?.location_note||'')}"></div></form>`,footer:`<button class="btn btn-secondary" data-cancel>Hủy</button><button class="btn btn-primary" data-save>${editing?'Lưu thay đổi':'Lưu phòng'}</button>`,onMount(modal){
    modal.querySelector('[data-cancel]').onclick=closeModal;
    modal.querySelector('[data-save]').onclick=async e=>{const form=modal.querySelector('#room-form');if(!form.reportValidity())return;const btn=e.currentTarget;setBusy(btn,true);try{const payload=Object.fromEntries(new FormData(form));if(editing)await updateRoom(current.id,payload);else await createRoom(sessionId,payload);closeModal();toast(editing?'Đã cập nhật phòng thi.':'Đã thêm phòng thi.','success');await reload();}catch(err){toast(errorMessage(err),'error');setBusy(btn,false);}};
  }});
}
