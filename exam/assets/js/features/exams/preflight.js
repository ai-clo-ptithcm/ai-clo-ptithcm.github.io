import { runPreflight } from '../../services/preflight.js';
import { escapeHtml,formatDateTime,badge,toast,errorMessage } from '../../core/ui.js';

const levelLabel={error:'Lỗi cần xử lý',warning:'Cảnh báo'};

export async function renderPreflight(ctx){
  const {host,exam}=ctx;
  const allowDraftPapers=exam.status==='draft';
  host.innerHTML=`<div class="card"><div class="toolbar"><div><div class="card-title">Kiểm tra trước ca thi</div><div class="muted">Kiểm tra dữ liệu, đề, mã sinh viên, phòng, giám thị và Storage bằng dữ liệu thật trên server.${allowDraftPapers?' Khi kỳ thi còn ở bản nháp, đề nháp vẫn được kiểm tra đầy đủ và sẽ tự khóa khi Chốt kỳ thi.':''}</div></div><button class="btn btn-primary" data-run>Chạy kiểm tra</button></div><div id="preflight-result" class="empty-state">Nhấn “Chạy kiểm tra” sau khi đã chuẩn bị kỳ thi.</div></div>`;
  const button=host.querySelector('[data-run]'),result=host.querySelector('#preflight-result');
  const run=async()=>{button.disabled=true;button.textContent='Đang kiểm tra…';result.className='empty-state';result.textContent='Đang kiểm tra database, Storage và cấu trúc kỳ thi…';try{const report=await runPreflight(exam.id,{allowDraftPapers});renderReport(result,report);if(report.ready)toast(allowDraftPapers?'Kỳ thi đủ điều kiện để chốt.':'Preflight đạt: không còn lỗi chặn.','success');else toast(`Còn ${report.summary.errors} lỗi cần xử lý.`,'error',5000);}catch(e){result.className='alert alert-danger';result.textContent=errorMessage(e);toast(errorMessage(e),'error');}finally{button.disabled=false;button.textContent='Chạy lại';}};
  button.addEventListener('click',run);
  await run();
}

function renderReport(host,r){
  const health=[['Database',r.health?.database],['Storage',r.health?.storage],['Edge Function',r.health?.edgeFunction]].map(([name,ok])=>`<div class="card stat-card"><div class="row"><span class="status-dot ${ok?'online':'offline'}"></span><strong>${escapeHtml(name)}</strong></div><div class="stat-label">${ok?'Hoạt động':'Có lỗi'}</div></div>`).join('');
  const issues=(r.issues||[]).map(x=>`<div class="alert ${x.level==='error'?'alert-danger':'alert-warning'}"><strong>${escapeHtml(levelLabel[x.level]||x.level)}:</strong> ${escapeHtml(x.message)}<div class="muted preflight-code">${escapeHtml(x.code||'')}</div></div>`).join('');
  const sessions=(r.sessions||[]).map(s=>`<tr><td><strong>${escapeHtml(s.name)}</strong></td><td>${s.rooms}</td><td>${s.students}</td><td>${s.questionCount}</td><td>${Number(s.points||0).toFixed(2)}</td><td>${s.paperStatus?badge(`${s.paperStatus}${s.paperVersion?` v${s.paperVersion}`:''}`,s.paperStatus==='locked'?'info':s.paperStatus==='hotfix'?'warning':''):'—'}</td></tr>`).join('');
  host.className='stack';
  host.innerHTML=`<div class="alert ${r.ready?'alert-success':'alert-danger'}"><strong>${r.ready?'Sẵn sàng về dữ liệu':'Chưa sẵn sàng'}</strong> · ${r.summary.errors} lỗi · ${r.summary.warnings} cảnh báo · kiểm tra lúc ${escapeHtml(formatDateTime(r.health?.serverTime))}</div>
  <div class="page-grid"><div class="card col-3 stat-card"><div class="stat-value">${r.summary.sessions}</div><div class="stat-label">Ca thi</div></div><div class="card col-3 stat-card"><div class="stat-value">${r.summary.rooms}</div><div class="stat-label">Phòng</div></div><div class="card col-3 stat-card"><div class="stat-value">${r.summary.students}</div><div class="stat-label">Sinh viên</div></div><div class="card col-3 stat-card"><div class="stat-value">${r.summary.questions}</div><div class="stat-label">Câu hỏi qua các ca</div></div></div>
  <div class="page-grid preflight-health">${health}</div>
  <div class="card"><div class="card-title">Theo ca thi</div>${sessions?`<div class="table-wrap"><table class="table"><thead><tr><th>Ca</th><th>Phòng</th><th>SV</th><th>Câu</th><th>Tổng điểm</th><th>Đề</th></tr></thead><tbody>${sessions}</tbody></table></div>`:'<div class="empty-state">Chưa có ca thi.</div>'}</div>
  <div class="card"><div class="card-title">Kết quả kiểm tra</div>${issues||'<div class="alert alert-success">Không phát hiện lỗi hoặc cảnh báo.</div>'}</div>`;
}
