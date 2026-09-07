import { normalizeExamCode } from '../untNormalizer.js';

function esc(v){return String(v??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')}
function normalize(v){const s=String(v??'').trim(); return /^\d+$/.test(s)?String(Number(s)):''}

export function reviewAllSbd({container, students, imageMap=null, title='Kiểm tra danh sách SBD', allowCancel=true}){
  return new Promise((resolve,reject)=>{
    const objectUrls=[];
    const imageHtml=s=>{
      const info=imageMap?.get?.(s.sourceRow);
      if(!info?.blob) return '<span class="muted-cell">Không có ảnh</span>';
      const url=URL.createObjectURL(info.blob); objectUrls.push(url);
      return `<img class="phach-thumb-review" src="${url}" alt="Ảnh số phách dòng ${s.excelRow}">`;
    };
    const cleanup=()=>objectUrls.forEach(u=>URL.revokeObjectURL(u));

    const rows=students.map((s,i)=>`<tr data-i="${i}" class="${/^\d+$/.test(String(s.rawSbd??s.sbd??'').trim())?'':'row-error'}">
      <td>${s.excelRow}</td>
      <td>${imageHtml(s)}</td>
      <td><input class="exam-code-review-input" value="${esc(s.examCode)}" aria-label="Mã đề dòng ${s.excelRow}"></td>
      <td>${esc(s.rawSbd||'')}</td>
      <td><input class="sbd-review-input" inputmode="numeric" value="${esc(s.sbd||normalize(s.rawSbd))}" aria-label="SBD dòng ${s.excelRow}"></td>
      <td class="sbd-state">${/^\d+$/.test(String(s.sbd??'').trim())?'Hợp lệ':'Cần nhập'}</td></tr>`).join('');

    container.innerHTML=`<div class="result-box review-panel"><div class="result-head"><div><span class="section-kicker">KIỂM TRA DỮ LIỆU SINH VIÊN</span><h2 class="result-title">${esc(title)}</h2></div><span class="warning-pill">Có thể chỉnh sửa</span></div>
      <p class="review-description">Hiển thị <b>toàn bộ sinh viên</b>. Có thể đối chiếu ảnh số phách ở cột B, sửa <b>Mã đề</b> và nhập SBD dạng 1, 25, 123...; không cần đủ 6 chữ số.</p>
      <div id="sbdReviewError" class="inline-error" hidden></div>
      <div class="table-wrapper review-table-wrapper"><table class="sbd-review-table"><thead><tr><th>Dòng Excel</th><th>Ảnh số phách (cột B)</th><th>Mã đề</th><th>SBD gốc</th><th>SBD xác nhận</th><th>Trạng thái</th></tr></thead><tbody>${rows}</tbody></table></div>
      <div class="review-actions">${allowCancel?'<button class="secondary-action" id="cancelSbdReview">Hủy xác nhận</button>':''}<button class="primary-inline-action" id="confirmSbdReview">Xác nhận danh sách</button></div></div>`;

    const errBox=container.querySelector('#sbdReviewError');
    const show=m=>{errBox.hidden=false;errBox.innerHTML=m};

    container.querySelector('#confirmSbdReview')?.addEventListener('click',()=>{
      const sbdInputs=[...container.querySelectorAll('.sbd-review-input')];
      const examInputs=[...container.querySelectorAll('.exam-code-review-input')];
      const vals=sbdInputs.map(x=>x.value.trim());
      const exams=examInputs.map(x=>normalizeExamCode(x.value));

      const bad=vals.findIndex(v=>!/^\d+$/.test(v) || Number(v)<=0);
      if(bad>=0){show(`❌ Dòng Excel <b>${students[bad].excelRow}</b> chưa có SBD hợp lệ. Hãy nhập một số tự nhiên dương.`);sbdInputs[bad].focus();return;}
      const badExam=exams.findIndex(v=>!v);
      if(badExam>=0){show(`❌ Dòng Excel <b>${students[badExam].excelRow}</b> chưa có mã đề. Hãy nhập mã đề trước khi tiếp tục.`);examInputs[badExam].focus();return;}

      const norm=vals.map(v=>String(Number(v)));
      const seen=new Map(),dups=[];
      norm.forEach((v,i)=>{if(seen.has(v)) dups.push([seen.get(v),i,v]); else seen.set(v,i)});

      const commit=()=>{
        norm.forEach((v,i)=>{
          students[i].sbd=v;
          students[i].rawSbd=students[i].rawSbd||vals[i];
          students[i].examCode=exams[i];
        });
        cleanup();
        resolve({students,duplicates:dups});
      };

      if(dups.length){
        const desc=dups.map(([a,b,v])=>`SBD ${v}: dòng ${students[a].excelRow} và ${students[b].excelRow}`).join('<br>');
        show(`⚠️ Phát hiện SBD trùng:<br>${desc}<br><br><button type="button" id="ignoreDupSbd" class="secondary-action">Bỏ qua và tiếp tục</button>`);
        container.querySelector('#ignoreDupSbd')?.addEventListener('click',commit,{once:true});
        return;
      }
      commit();
    });

    container.querySelector('#cancelSbdReview')?.addEventListener('click',()=>{cleanup();const e=new Error('Đã hủy xác nhận dữ liệu sinh viên.');e.name='UserCancelledError';reject(e)});
  });
}
