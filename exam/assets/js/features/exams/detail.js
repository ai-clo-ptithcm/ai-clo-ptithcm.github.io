import { getExam,getMembership,listSessions } from '../../services/exams.js';
import { setExamStatus } from '../../services/lifecycle.js';
import { runPreflight } from '../../services/preflight.js';
import { staffShell } from '../../core/shell.js';
import { loadUiState,saveUiState,setState } from '../../state.js';
import { hasAnyPermission,expandScopedMembership,scopedSessionIds,isSystemAdmin } from '../../core/permissions.js';
import { escapeHtml,badge,toast,errorMessage,confirmDialog,setBusy } from '../../core/ui.js';
import { renderOverview } from './overview.js';
import { renderSessions } from './sessions.js';
import { renderRoster } from './roster.js';
import { renderPaper } from './paper.js';
import { renderQuestionImportPage } from './import-page.js';
import { renderMembers } from './members.js';
import { renderSources } from './sources.js';
import { renderPreflight } from './preflight.js';

const allTabs=[['overview','Tổng quan'],['sessions','Ca & phòng'],['roster','Danh sách SV'],['paper','Đề thi'],['import','Nhập đề'],['sources','Tài liệu gốc'],['members','Nhân sự'],['preflight','Kiểm tra trước thi']];
const STATUS_LABEL={draft:'Bản nháp',ready:'Sẵn sàng',live:'Đang thi',closed:'Đã đóng',archived:'Lưu trữ'};
const STATUS_TYPE={ready:'info',live:'success',closed:'warning',archived:'warning'};

export async function renderExamDetail(root,profile,examId){
  const [{exam,members},rawMembership,allSessions]=await Promise.all([getExam(examId),getMembership(examId,profile.id),listSessions(examId)]);
  setState({selectedExam:exam});
  const rawPerms=Array.isArray(rawMembership?.permissions)?rawMembership.permissions:[],scopeIds=scopedSessionIds(rawMembership),hasGlobalOps=rawMembership?.exam_role==='owner'||rawPerms.some(p=>!String(p).includes('@')&&String(p)!=='view_exam')||isSystemAdmin(profile);
  const sessions=scopeIds.length&&!hasGlobalOps?allSessions.filter(s=>scopeIds.includes(s.id)):allSessions;
  const membership=expandScopedMembership(rawMembership);
  const canManageExam=isSystemAdmin(profile)||rawMembership?.exam_role==='owner'||rawPerms.includes('manage_exam');
  const canFullPreflight=canManageExam||rawPerms.includes('manage_paper');
  const tabs=allTabs.filter(([id])=>id==='overview'||id==='sessions'||(id==='roster'&&hasAnyPermission(profile,rawMembership,'manage_roster'))||(id==='paper'&&hasAnyPermission(profile,rawMembership,'manage_paper'))||(id==='import'&&exam.status==='draft'&&hasAnyPermission(profile,rawMembership,'manage_paper'))||(id==='sources'&&hasAnyPermission(profile,rawMembership,'manage_assets'))||(id==='members'&&hasAnyPermission(profile,rawMembership,'manage_members'))||(id==='preflight'&&canFullPreflight));
  const key=`exam-tab:${examId}`;let active=loadUiState(key,'overview');if(!tabs.some(t=>t[0]===active))active='overview';
  const finalize=canManageExam&&exam.status==='draft'?'<button class="btn btn-primary" data-finalize>Chốt kỳ thi</button>':'';
  const reopen=canManageExam&&exam.status==='ready'?'<button class="btn btn-secondary" data-reopen>Mở lại chỉnh sửa</button>':'';
  const live=hasAnyPermission(profile,rawMembership,'manage_live')?`<a class="btn btn-secondary" href="#/exam/${exam.id}/live">LIVE</a>`:'';
  const results=hasAnyPermission(profile,rawMembership,'view_results')?`<a class="btn btn-secondary" href="#/exam/${exam.id}/results">Kết quả</a>`:'';
  const scopeNote=scopeIds.length&&!hasGlobalOps?`<div class="muted">Phạm vi: ${sessions.map(s=>escapeHtml(s.name)).join(', ')||'chưa được gán ca'}</div>`:'';
  const typeBadge=badge(exam.exam_type==='final'?'Cuối kỳ':exam.exam_type==='midterm'?'Giữa kỳ':'Khác',exam.exam_type==='final'?'warning':'info');
  const statusBadge=badge(STATUS_LABEL[exam.status]||exam.status,STATUS_TYPE[exam.status]||'');
  const content=`<div class="page-header"><div><div class="row wrap"><a class="btn btn-secondary" href="#/exams">← Kỳ thi</a>${typeBadge}${statusBadge}</div><h1 class="exam-detail-title">${escapeHtml(exam.name)}</h1><p class="muted">${escapeHtml(exam.subject_name)} · ${escapeHtml(exam.code)}</p>${scopeNote}</div><div class="row wrap">${finalize}${reopen}${live}${results}</div></div><div class="section-tabs" data-tabs>${tabs.map(([id,label])=>`<button class="section-tab ${id===active?'active':''}" data-tab="${id}">${label}</button>`).join('')}</div><div id="exam-tab-content" class="exam-tab-content"></div>`;
  root.innerHTML=staffShell({profile,active:'exam',examId:exam.id,title:exam.name,content});
  const host=root.querySelector('#exam-tab-content');
  const ctx={root,host,profile,exam,members,membership,rawMembership,sessions,allSessions,reload:()=>renderExamDetail(root,profile,examId)};

  const routePaperImportButton=()=>{
    if(exam.status==='draft'){
      const old=host.querySelector('[data-import]');
      if(old){const button=old.cloneNode(true);button.textContent='+ Nhập đề';old.replaceWith(button);button.addEventListener('click',()=>root.querySelector('[data-tab="import"]')?.click());}
      const lock=host.querySelector('[data-lock]');
      if(lock){const note=document.createElement('span');note.className='muted';note.textContent='Đề sẽ tự khóa khi Chốt kỳ thi.';lock.replaceWith(note);}
    }else{
      host.querySelectorAll('[data-edit-question],[data-add-question],[data-add-group],[data-import],[data-lock]').forEach(x=>x.remove());
      host.querySelectorAll('[data-shuffle-q],[data-shuffle-c]').forEach(x=>x.disabled=true);
    }
  };
  const freezePreparedControls=id=>{
    if(exam.status==='draft')return;
    if(id==='roster')host.querySelectorAll('[data-import],[data-codes]').forEach(x=>x.remove());
  };
  const mount=async id=>{
    saveUiState(key,id);root.querySelectorAll('[data-tab]').forEach(b=>b.classList.toggle('active',b.dataset.tab===id));host.innerHTML='<div class="card">Đang tải…</div>';
    if(id==='overview')await renderOverview(ctx);
    if(id==='sessions')await renderSessions(ctx);
    if(id==='roster')await renderRoster(ctx);
    if(id==='paper'){await renderPaper(ctx);routePaperImportButton();}
    if(id==='import')await renderQuestionImportPage(ctx);
    if(id==='sources')await renderSources(ctx);
    if(id==='members')await renderMembers(ctx);
    if(id==='preflight')await renderPreflight(ctx);
    freezePreparedControls(id);
  };
  root.querySelectorAll('[data-tab]').forEach(b=>b.addEventListener('click',()=>mount(b.dataset.tab)));

  root.querySelector('[data-finalize]')?.addEventListener('click',async e=>{
    if(!await confirmDialog({title:'Chốt kỳ thi',message:'Hệ thống sẽ kiểm tra ca, phòng, sinh viên, mã thi và đề; sau khi chốt, dữ liệu chuẩn bị sẽ bị khóa. Có thể mở lại nếu chưa có sinh viên bắt đầu làm bài.',confirmText:'Chốt kỳ thi'}))return;
    const btn=e.currentTarget;setBusy(btn,true,'Đang kiểm tra…');
    try{
      const report=await runPreflight(exam.id,{allowDraftPapers:true});
      if(!report.ready){setBusy(btn,false);toast(`Chưa thể chốt: còn ${report.summary?.errors||0} lỗi cần xử lý.`,'error',6000);root.querySelector('[data-tab="preflight"]')?.click();return;}
      btn.textContent='Đang chốt…';
      await setExamStatus(exam.id,'ready');toast('Đã chốt kỳ thi. Đề, ca/phòng và danh sách dự thi đã được khóa.','success',6000);await renderExamDetail(root,profile,examId);
    }catch(err){toast(errorMessage(err),'error',6500);setBusy(btn,false);}
  });

  root.querySelector('[data-reopen]')?.addEventListener('click',async e=>{
    if(!await confirmDialog({title:'Mở lại chỉnh sửa',message:'Chỉ mở lại khi chưa có sinh viên bắt đầu làm bài. Các đề hiện tại sẽ trở lại trạng thái nháp để tiếp tục chỉnh.',confirmText:'Mở lại chỉnh sửa'}))return;
    const btn=e.currentTarget;setBusy(btn,true,'Đang mở lại…');
    try{await setExamStatus(exam.id,'draft');toast('Đã mở lại kỳ thi để chỉnh sửa.','success');await renderExamDetail(root,profile,examId);}catch(err){toast(errorMessage(err),'error',6500);setBusy(btn,false);}
  });

  await mount(active);
}
