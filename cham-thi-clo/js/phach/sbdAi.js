// AI-assisted SBD recognition for UnT embedded images.
// Designed to cooperate with manual entry: AI processes from bottom to top,
// skips the input currently being edited, never overwrites a non-empty value,
// and isolates network failures per row.

const ENDPOINT = 'https://rraooqedkpyhokattwdz.supabase.co/functions/v1/recognize-sbd-image';
const CONCURRENCY = 4;
const TIMEOUT_MS = 15000;
const MAX_RETRIES = 2;

function isValidSbd(v){
  const s=String(v??'').trim();
  return /^\d+$/.test(s) && Number(s)>0;
}

function normalizeSbd(v){
  return isValidSbd(v)?String(Number(String(v).trim())):'';
}

function sleep(ms){return new Promise(r=>setTimeout(r,ms))}

function blobToBase64(blob){
  return new Promise((resolve,reject)=>{
    const reader=new FileReader();
    reader.onload=()=>resolve(String(reader.result||'').split(',')[1]||'');
    reader.onerror=()=>reject(new Error('Không đọc được ảnh số báo danh.'));
    reader.readAsDataURL(blob);
  });
}

async function recognize(blob,{signal}={}){
  const image=await blobToBase64(blob);
  const response=await fetch(ENDPOINT,{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({image,mime_type:blob.type||'image/jpeg'}),
    cache:'no-store',
    signal
  });
  const data=await response.json().catch(()=>({}));
  if(!response.ok || data?.ok===false) throw new Error(data?.error||`AI SBD lỗi ${response.status}`);
  const digits=normalizeSbd(data?.digits);
  if(!digits) throw new Error('AI chưa đọc được số hợp lệ.');
  return {digits,model:data?.model||'',raw:data};
}

async function recognizeWithRetry(blob){
  let lastErr=null;
  for(let attempt=0;attempt<=MAX_RETRIES;attempt++){
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),TIMEOUT_MS);
    try{
      return await recognize(blob,{signal:controller.signal});
    }catch(err){
      lastErr=err?.name==='AbortError'?new Error('AI quá thời gian chờ.'):err;
      if(attempt<MAX_RETRIES) await sleep(450*Math.pow(2,attempt));
    }finally{clearTimeout(timer)}
  }
  throw lastErr||new Error('Không thể nhận dạng SBD.');
}

function markRow(row,state,text){
  if(!row)return;
  row.dataset.aiSbdState=state;
  const cell=row.querySelector('.sbd-state');
  if(cell) cell.textContent=text;
}

function ensureToolbar(container){
  let toolbar=container.querySelector('.sbd-ai-toolbar');
  if(toolbar)return toolbar;
  toolbar=document.createElement('div');
  toolbar.className='sbd-ai-toolbar';
  toolbar.innerHTML=`
    <div class="sbd-ai-progress" aria-live="polite">AI SBD: chưa chạy</div>
    <div class="sbd-ai-actions">
      <button type="button" class="secondary-action" data-ai-sbd-start>AI đọc SBD trống</button>
      <button type="button" class="secondary-action" data-ai-sbd-stop disabled>Dừng AI</button>
    </div>`;
  const desc=container.querySelector('.review-description');
  desc?.insertAdjacentElement('afterend',toolbar);
  return toolbar;
}

export function attachSbdAiReview({container,students,imageMap,autoStart=true}){
  if(!container || !students?.length || !imageMap?.size) return null;
  const toolbar=ensureToolbar(container);
  const progress=toolbar.querySelector('.sbd-ai-progress');
  const startBtn=toolbar.querySelector('[data-ai-sbd-start]');
  const stopBtn=toolbar.querySelector('[data-ai-sbd-stop]');
  let stopped=false,running=false;

  const tasks=students.map((s,i)=>({
    i,
    student:s,
    row:container.querySelector(`tr[data-i="${i}"]`),
    input:container.querySelector(`tr[data-i="${i}"] .sbd-review-input`),
    info:imageMap.get?.(s.sourceRow)
  })).filter(t=>t.info?.blob && t.input);

  // Human starts at the top; AI starts at the bottom.
  tasks.sort((a,b)=>b.i-a.i);

  const stats={total:0,done:0,filled:0,matched:0,conflict:0,failed:0,skipped:0};

  function updateProgress(){
    const base=`AI SBD: ${stats.done}/${stats.total}`;
    progress.textContent=`${base} · điền ${stats.filled} · cần kiểm tra ${stats.conflict+stats.failed}`;
  }

  async function work(task){
    if(stopped)return;
    const {input,row,info}=task;
    // Do not compete with the user on the field currently being edited.
    if(document.activeElement===input){stats.skipped++;stats.done++;updateProgress();return}

    const before=input.value.trim();
    markRow(row,'reading','AI đang đọc…');
    try{
      const out=await recognizeWithRetry(info.blob);
      const current=input.value.trim();
      if(current){
        if(normalizeSbd(current)===out.digits){
          stats.matched++;
          markRow(row,'matched','Khớp AI');
        }else{
          stats.conflict++;
          row.dataset.aiSbdSuggestion=out.digits;
          markRow(row,'conflict',`Kiểm tra: AI đọc ${out.digits}`);
        }
      }else if(before){
        stats.skipped++;
      }else{
        input.value=out.digits;
        input.dataset.aiFilled='1';
        input.dispatchEvent(new Event('input',{bubbles:true}));
        stats.filled++;
        markRow(row,'filled','AI đã điền');
      }
    }catch(err){
      stats.failed++;
      markRow(row,'failed',err?.message||'Lỗi AI');
    }finally{
      stats.done++;
      updateProgress();
    }
  }

  async function run(){
    if(running)return;
    stopped=false;running=true;
    const queue=tasks.filter(t=>!isValidSbd(t.input.value));
    stats.total=queue.length;stats.done=stats.filled=stats.matched=stats.conflict=stats.failed=stats.skipped=0;
    updateProgress();
    startBtn.disabled=true;stopBtn.disabled=false;
    let cursor=0;
    async function worker(){
      while(!stopped && cursor<queue.length){
        const task=queue[cursor++];
        await work(task);
      }
    }
    await Promise.all(Array.from({length:Math.min(CONCURRENCY,queue.length||1)},worker));
    running=false;startBtn.disabled=false;stopBtn.disabled=true;
    progress.textContent=stopped
      ? `AI SBD đã dừng tại ${stats.done}/${stats.total}. Có thể nhập tay hoặc chạy lại.`
      : `AI SBD hoàn tất ${stats.done}/${stats.total} · điền ${stats.filled} · cần kiểm tra ${stats.conflict+stats.failed}.`;
  }

  startBtn?.addEventListener('click',()=>void run());
  stopBtn?.addEventListener('click',()=>{stopped=true;stopBtn.disabled=true});

  // Manual typing always wins. If AI had filled this field, it becomes a manual value.
  tasks.forEach(({input,row})=>{
    input.addEventListener('input',()=>{
      if(document.activeElement===input){
        delete input.dataset.aiFilled;
        delete row.dataset.aiSbdSuggestion;
        const v=input.value.trim();
        markRow(row,isValidSbd(v)?'manual':'invalid',isValidSbd(v)?'Đã nhập tay':'Cần nhập');
      }
    });
  });

  if(autoStart && tasks.some(t=>!isValidSbd(t.input.value))) setTimeout(()=>void run(),120);
  return {run,stop:()=>{stopped=true}};
}
