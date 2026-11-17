import { normalizeExamCode } from '../untNormalizer.js';
import { recognizePhachBatch } from './aiBatch.js';

function esc(v){return String(v??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')}
function normalize(v){const s=String(v??'').trim();return /^\d+$/.test(s)?String(Number(s)):''}
function valid(v){return /^\d+$/.test(String(v??'').trim())&&Number(v)>0}

export function reviewAllSbd({container,students,imageMap=null,title='Kiểm tra danh sách SBD',allowCancel=true}){
  return new Promise((resolve,reject)=>{
    const objectUrls=[];
    const imageUrls=new Map();
    const imageHtml=s=>{
      const info=imageMap?.get?.(s.sourceRow);
      if(!info?.blob)return '<span class="muted-cell">Không có ảnh</span>';
      const url=URL.createObjectURL(info.blob);
      objectUrls.push(url);imageUrls.set(s.excelRow,url);
      return `<button type="button" class="phach-view-btn" data-photo="${s.excelRow}" title="Xem lớn ảnh số phách dòng ${s.excelRow}">
        <img class="phach-thumb-review" src="${url}" alt="Ảnh số phách dòng ${s.excelRow}">
      </button>`;
    };
    const rows=students.map((s,i)=>{
      const initial=s.sbd||normalize(s.rawSbd);
      return `<tr data-i="${i}" class="${valid(initial)?'':'row-error'}">
        <td>${s.excelRow}</td>
        <td>${imageHtml(s)}</td>
        <td><input class="exam-code-review-input" value="${esc(s.examCode)}" aria-label="Mã đề dòng ${s.excelRow}"></td>
        <td>${esc(s.rawSbd||'')}</td>
        <td><input class="sbd-review-input" inputmode="numeric" value="${esc(initial)}" aria-label="SBD dòng ${s.excelRow}" data-source="${valid(initial)?'existing':'empty'}"></td>
        <td><div class="sbd-state" aria-live="polite">${valid(initial)?'SBD có sẵn':'Cần nhập'}</div><button type="button" class="sbd-accept-one" hidden>Xác nhận AI</button></td></tr>`;
    }).join('');
    container.innerHTML=`<div class="result-box review-panel"><div class="result-head"><div><span class="section-kicker">KIỂM TRA DỮ LIỆU SINH VIÊN</span><h2 class="result-title">${esc(title)}</h2></div><span class="warning-pill">Giảng viên chỉnh sửa mọi dòng</span></div>
      <p class="review-description">Giảng viên nhập từ <b>trên xuống</b>; Gemini đọc ảnh từ <b>dưới lên</b>. Ảnh số phách vẫn hiển thị tại từng dòng và có thể bấm để xem lớn. <b>Mọi ô SBD và mã đề đều sửa được</b>, kể cả số AI đề xuất. AI không thay đổi số đã nhập.</p>
      <div class="phach-ai-toolbar">
        <button type="button" class="secondary-action" id="startPhachAi">✦ Gemini đọc từ dưới lên</button>
        <button type="button" class="secondary-action" id="stopPhachAi" disabled>Dừng AI</button>
        <button type="button" class="secondary-action" id="approvePhachAi" disabled>Tôi đã kiểm tra — duyệt tất cả gợi ý AI</button>
        <div class="phach-ai-progress" id="phachAiProgress" role="status" aria-live="polite">AI chưa chạy. Có thể nhập thủ công ngay.</div>
      </div>
      <div id="sbdReviewError" class="inline-error" hidden></div>
      <div class="table-wrapper review-table-wrapper"><table class="sbd-review-table"><thead><tr><th>Dòng Excel</th><th>Ảnh số phách (cột B)</th><th>Mã đề</th><th>SBD gốc</th><th>SBD xác nhận</th><th>Trạng thái</th></tr></thead><tbody>${rows}</tbody></table></div>
      <div class="review-actions">${allowCancel?'<button class="secondary-action" id="cancelSbdReview">Hủy xác nhận</button>':''}<button class="primary-inline-action" id="confirmSbdReview">Xác nhận danh sách</button></div>
      <dialog id="phachPhotoDialog" aria-label="Xem ảnh số phách">
        <div class="phach-photo-head"><b id="phachPhotoTitle"></b><button type="button" class="secondary-action" id="phachPhotoClose">Đóng</button></div>
        <img id="phachPhotoImage" alt="Ảnh số phách phóng lớn">
      </dialog>
      </div>`;
    const inputs=[...container.querySelectorAll('.sbd-review-input')];
    const examInputs=[...container.querySelectorAll('.exam-code-review-input')];
    const tableRows=[...container.querySelectorAll('.sbd-review-table tbody tr')];
    const statusEls=tableRows.map(row=>row.querySelector('.sbd-state'));
    const acceptBtns=tableRows.map(row=>row.querySelector('.sbd-accept-one'));
    const errorBox=container.querySelector('#sbdReviewError');
    const startBtn=container.querySelector('#startPhachAi');
    const stopBtn=container.querySelector('#stopPhachAi');
    const approveBtn=container.querySelector('#approvePhachAi');
    const progress=container.querySelector('#phachAiProgress');
    const photoDialog=container.querySelector('#phachPhotoDialog');
    let active=false,closed=false,runId=0,cursor=students.length-1,finishedBatches=0,failedBatches=0;
    const controllers=new Set();
    const show=m=>{errorBox.hidden=false;errorBox.textContent=m};
    const clearError=()=>{errorBox.hidden=true;errorBox.textContent=''};
    const applyStatus=(i,label,mode)=>{
      statusEls[i].textContent=label;
      tableRows[i].classList.toggle('row-error',mode==='error');
      tableRows[i].classList.toggle('phach-ai-suggested',mode==='ai');
      acceptBtns[i].hidden=mode!=='ai';
    };
    const pending=()=>inputs.filter(x=>x.dataset.source==='ai').length;
    function summary(message=''){
      const filled=inputs.filter(x=>valid(x.value)).length;
      approveBtn.disabled=closed||pending()===0;
      progress.textContent=`${message?message+' · ':''}Đã có số: ${filled}/${students.length} · AI chờ duyệt: ${pending()} · Lô hoàn tất: ${finishedBatches} · Lô lỗi: ${failedBatches}.`;
    }
    const stop=(message,announce=true)=>{
      active=false;runId++;
      for(const controller of controllers)controller.abort();
      controllers.clear();
      startBtn.disabled=closed;
      stopBtn.disabled=true;
      if(announce)summary(message);
    };
    const cleanup=()=>{
      closed=true;stop('',false);
      if(photoDialog.open)photoDialog.close();
      objectUrls.forEach(u=>URL.revokeObjectURL(u));
    };
    const markHuman=(i)=>{
      // Manual edits always win, even if a delayed Gemini response is still in flight.
      inputs[i].dataset.source='human';
      applyStatus(i,valid(inputs[i].value)?'Giảng viên đã nhập':'Cần nhập lại',valid(inputs[i].value)?'human':'error');
      clearError();summary();
    };
    inputs.forEach((input,i)=>{
      input.addEventListener('input',()=>markHuman(i));
      input.addEventListener('keydown',event=>{
        if(event.key!=='Enter')return;
        event.preventDefault();
        inputs[i+1]?.focus();
        inputs[i+1]?.select();
      });
    });
    examInputs.forEach(x=>x.addEventListener('input',clearError));
    acceptBtns.forEach((button,i)=>button.addEventListener('click',()=>{
      if(inputs[i].dataset.source!=='ai')return;
      inputs[i].dataset.source='human';
      applyStatus(i,'Giảng viên đã duyệt','human');
      summary();
    }));
    approveBtn.addEventListener('click',()=>{
      for(let i=0;i<inputs.length;i++){
        if(inputs[i].dataset.source==='ai'&&valid(inputs[i].value)){
          inputs[i].dataset.source='human';
          applyStatus(i,'Giảng viên đã duyệt','human');
        }
      }
      clearError();summary('Đã duyệt các đề xuất AI sau khi kiểm tra ảnh.');
    });
    container.querySelectorAll('.phach-view-btn').forEach(button=>{
      button.addEventListener('click',()=>{
        const row=Number(button.dataset.photo),url=imageUrls.get(row);
        if(!url||closed)return;
        container.querySelector('#phachPhotoTitle').textContent='Ảnh số phách — dòng '+row;
        container.querySelector('#phachPhotoImage').src=url;
        if(!photoDialog.open)photoDialog.showModal();
      });
    });
    container.querySelector('#phachPhotoClose').addEventListener('click',()=>photoDialog.close());
    function humanFrontier(){
      // An uninterrupted human-completed prefix denotes the top-down work area.
      let i=-1;
      while(i+1<inputs.length && ['human','existing'].includes(inputs[i+1].dataset.source)
        && valid(inputs[i+1].value))i++;
      return i;
    }
    function takeBatch(){
      const batch=[];
      const frontier=humanFrontier();
      while(cursor>frontier&&batch.length<4){
        const i=cursor--;
        const input=inputs[i];
        const info=imageMap?.get?.(students[i].sourceRow);
        if(input.value.trim()||input.dataset.source==='human'||!info?.blob)continue;
        batch.push({row:students[i].excelRow,blob:info.blob,i});
      }
      return batch;
    }
    async function worker(id){
      while(active&&!closed&&id===runId){
        const batch=takeBatch();
        if(!batch.length)return;
        const controller=new AbortController();
        controllers.add(controller);
        try{
          const results=await recognizePhachBatch(batch,{signal:controller.signal});
          if(closed||!active||id!==runId)return;
          const found=new Map(results.map(x=>[x.row,x.digits]));
          for(const item of batch){
            const i=item.i,input=inputs[i];
            // Recheck at the moment a result arrives: never overwrite teacher or existing values.
            if(input.value.trim()||input.dataset.source==='human'||input.dataset.source==='existing'||document.activeElement===input)continue;
            const value=found.get(item.row)||'';
            if(valid(value)){
              input.value=value;input.dataset.source='ai';
              applyStatus(i,'AI gợi ý — cần duyệt','ai');
            }else applyStatus(i,'AI không đọc rõ — nhập tay','error');
          }
          finishedBatches++;summary('Gemini đang xử lý từ dưới lên');
        }catch(error){
          if(closed||id!==runId)return;
          failedBatches++;
          if(error?.status===429){
            stop('Gemini bị giới hạn lượt gọi. Hãy nhập tay hoặc thử lại sau.');
            return;
          }
          for(const item of batch){
            if(inputs[item.i].value.trim()||inputs[item.i].dataset.source==='human')continue;
            applyStatus(item.i,'AI lỗi — nhập tay','error');
          }
          summary('Một lô AI lỗi; giảng viên vẫn nhập bình thường');
        }finally{controllers.delete(controller)}
      }
    }
    startBtn.addEventListener('click',async()=>{
      if(active||closed)return;
      const available=students.some((s,i)=>!inputs[i].value.trim()&&
        inputs[i].dataset.source!=='human'&&imageMap?.get?.(s.sourceRow)?.blob);
      if(!available){summary('Không còn ảnh chưa xử lý. Có thể kiểm tra hoặc nhập tay.');return}
      cursor=inputs.length-1;active=true;runId++;
      const id=runId;
      finishedBatches=0;failedBatches=0;
      startBtn.disabled=true;stopBtn.disabled=false;
      summary('Gemini đã bắt đầu từ dòng cuối, giảng viên tiếp tục nhập từ trên');
      try{await Promise.all([worker(id),worker(id)])}
      finally{
        if(id===runId&&!closed){
          active=false;startBtn.disabled=false;stopBtn.disabled=true;
          summary('AI đã dừng ở vùng giảng viên xử lý hoặc đã hết ảnh cần đọc');
        }
      }
    });
    stopBtn.addEventListener('click',()=>stop('Đã dừng Gemini. Mọi số đã nhập và gợi ý đã nhận vẫn được giữ.'));
    function confirm(){
      const vals=inputs.map(x=>x.value.trim());
      const exams=examInputs.map(x=>normalizeExamCode(x.value));
      const bad=vals.findIndex(v=>!valid(v));
      if(bad>=0){show('Dòng Excel '+students[bad].excelRow+' chưa có số phách hợp lệ.');inputs[bad].focus();return}
      const badExam=exams.findIndex(x=>!x);
      if(badExam>=0){show('Dòng Excel '+students[badExam].excelRow+' chưa có mã đề.');examInputs[badExam].focus();return}
      const unreviewed=inputs.findIndex(x=>x.dataset.source==='ai');
      if(unreviewed>=0){
        show('Còn '+pending()+' số do AI đề xuất chưa được giảng viên duyệt. Có thể xem/sửa từng ảnh hoặc chọn “Tôi đã kiểm tra — duyệt tất cả gợi ý AI”.');
        inputs[unreviewed].focus();return;
      }
      const normalized=vals.map(normalize);
      const seen=new Map(),duplicates=[];
      normalized.forEach((v,i)=>{if(seen.has(v))duplicates.push([seen.get(v),i,v]);else seen.set(v,i)});
      const commit=()=>{
        // Stop all requests before mutating the actual graded records.
        stop('',false);
        normalized.forEach((v,i)=>{
          students[i].sbd=v;
          students[i].rawSbd=students[i].rawSbd||vals[i];
          students[i].examCode=exams[i];
        });
        cleanup();resolve({students,duplicates});
      };
      if(duplicates.length){
        const description=duplicates.slice(0,10).map(([a,b,v])=>
          'Số phách '+v+': dòng '+students[a].excelRow+' và '+students[b].excelRow).join('; ');
        show('Phát hiện số phách trùng. '+description+'. Nếu đã đối chiếu ảnh và muốn tiếp tục, chọn nút bỏ qua ở dưới.');
        let button=container.querySelector('#ignoreDupSbd');
        if(!button){
          button=document.createElement('button');button.type='button';button.id='ignoreDupSbd';
          button.className='secondary-action';button.textContent='Đã kiểm tra — bỏ qua số trùng';
          errorBox.append(button);
        }
        button.onclick=()=>{
          // Revalidate that no field changed between warning and override.
          if(inputs.some((x,i)=>x.value.trim()!==vals[i])||examInputs.some((x,i)=>normalizeExamCode(x.value)!==exams[i])){
            show('Dữ liệu đã thay đổi. Vui lòng xác nhận lại danh sách.');return;
          }
          commit();
        };
        return;
      }
      commit();
    }
    container.querySelector('#confirmSbdReview').addEventListener('click',confirm);
    container.querySelector('#cancelSbdReview')?.addEventListener('click',()=>{
      cleanup();
      const e=new Error('Đã hủy xác nhận dữ liệu sinh viên.');
      e.name='UserCancelledError';reject(e);
    });
    summary();
  });
}
