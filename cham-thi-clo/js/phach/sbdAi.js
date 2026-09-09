// AI-assisted SBD recognition for UnT embedded images.
// Human and AI cooperate safely: AI runs from bottom to top, never overwrites
// a non-empty field, skips the field being edited and isolates row failures.

const ENDPOINT='https://rraooqedkpyhokattwdz.supabase.co/functions/v1/recognize-sbd-image';
const CONCURRENCY=4;
const TIMEOUT_MS=15000;
const MAX_RETRIES=2;

function isValidSbd(v){const s=String(v??'').trim();return /^\d+$/.test(s)&&Number(s)>0}
function normalizeSbd(v){return isValidSbd(v)?String(Number(String(v).trim())):''}
function sleep(ms){return new Promise(r=>setTimeout(r,ms))}

function ensureStyles(){
  if(document.getElementById('sbdAiStyles'))return;
  const style=document.createElement('style');style.id='sbdAiStyles';style.textContent=`
  .sbd-ai-toolbar{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:10px 0 14px;padding:10px 12px;border:1px solid #dbe3ee;border-radius:10px;background:#f8fafc}
  .sbd-ai-progress{font-size:13px;font-weight:700;color:#475467}.sbd-ai-actions{display:flex;gap:8px;flex-wrap:wrap}
  tr[data-ai-sbd-state="filled"] .sbd-state,tr[data-ai-sbd-state="matched"] .sbd-state{color:#087443;font-weight:800}
  tr[data-ai-sbd-state="conflict"] .sbd-state,tr[data-ai-sbd-state="failed"] .sbd-state{color:#a61d2d;font-weight:800}
  tr[data-ai-sbd-state="reading"] .sbd-state{color:#5b4a91;font-weight:800}
  @media(max-width:720px){.sbd-ai-toolbar{align-items:flex-start;flex-direction:column}}
  `;document.head.appendChild(style);
}

function blobToBase64(blob){return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result||'').split(',')[1]||'');reader.onerror=()=>reject(new Error('Không đọc được ảnh số báo danh.'));reader.readAsDataURL(blob)})}

async function recognize(blob,{signal}={}){
  const image=await blobToBase64(blob);
  const response=await fetch(ENDPOINT,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({image,mime_type:blob.type||'image/jpeg'}),cache:'no-store',signal});
  const data=await response.json().catch(()=>({}));
  if(!response.ok||data?.ok===false){const err=new Error(data?.error||`AI SBD lỗi ${response.status}`);err.httpStatus=response.status;throw err}
  const digits=normalizeSbd(data?.digits);if(!digits)throw new Error('AI chưa đọc được số hợp lệ.');return {digits,model:data?.model||''};
}

async function recognizeWithRetry(blob){
  let lastErr=null;
  for(let attempt=0;attempt<=MAX_RETRIES;attempt++){
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),TIMEOUT_MS);
    try{return await recognize(blob,{signal:controller.signal})}
    catch(err){
      lastErr=err?.name==='AbortError'?new Error('AI quá thời gian chờ.'):err;
      // 400/401/403/404 usually means configuration/deployment problem; retrying 200 rows is wasteful.
      if([400,401,403,404].includes(Number(err?.httpStatus)))throw lastErr;
      if(attempt<MAX_RETRIES)await sleep(450*Math.pow(2,attempt));
    }finally{clearTimeout(timer)}
  }
  throw lastErr||new Error('Không thể nhận dạng SBD.');
}

function markRow(row,state,text){if(!row)return;row.dataset.aiSbdState=state;const cell=row.querySelector('.sbd-state');if(cell)cell.textContent=text}
function ensureToolbar(container){let toolbar=container.querySelector('.sbd-ai-toolbar');if(toolbar)return toolbar;toolbar=document.createElement('div');toolbar.className='sbd-ai-toolbar';toolbar.innerHTML=`<div class="sbd-ai-progress" aria-live="polite">AI SBD: chưa chạy</div><div class="sbd-ai-actions"><button type="button" class="secondary-action" data-ai-sbd-start>AI đọc SBD trống</button><button type="button" class="secondary-action" data-ai-sbd-stop disabled>Dừng AI</button></div>`;container.querySelector('.review-description')?.insertAdjacentElement('afterend',toolbar);return toolbar}

export function attachSbdAiReview({container,students,imageMap,autoStart=true}){
  if(!container||!students?.length||!imageMap?.size)return null;ensureStyles();
  const toolbar=ensureToolbar(container),progress=toolbar.querySelector('.sbd-ai-progress'),startBtn=toolbar.querySelector('[data-ai-sbd-start]'),stopBtn=toolbar.querySelector('[data-ai-sbd-stop]');
  let stopped=false,running=false,fatalError='';
  const tasks=students.map((s,i)=>({i,row:container.querySelector(`tr[data-i="${i}"]`),input:container.querySelector(`tr[data-i="${i}"] .sbd-review-input`),info:imageMap.get?.(s.sourceRow)})).filter(t=>t.info?.blob&&t.input).sort((a,b)=>b.i-a.i);
  const stats={total:0,done:0,filled:0,matched:0,conflict:0,failed:0,skipped:0};
  const update=()=>{progress.textContent=`AI SBD: ${stats.done}/${stats.total} · điền ${stats.filled} · cần kiểm tra ${stats.conflict+stats.failed}`};

  async function work(task){
    if(stopped||fatalError)return;const {input,row,info}=task;
    if(document.activeElement===input){stats.skipped++;stats.done++;update();return}
    markRow(row,'reading','AI đang đọc…');
    try{
      const out=await recognizeWithRetry(info.blob),current=input.value.trim();
      if(current){if(normalizeSbd(current)===out.digits){stats.matched++;markRow(row,'matched','Khớp AI')}else{stats.conflict++;row.dataset.aiSbdSuggestion=out.digits;markRow(row,'conflict',`Kiểm tra: AI đọc ${out.digits}`)}}
      else{input.value=out.digits;input.dataset.aiFilled='1';input.dispatchEvent(new Event('input',{bubbles:true}));stats.filled++;markRow(row,'filled','AI đã điền')}
    }catch(err){
      stats.failed++;markRow(row,'failed',err?.message||'Lỗi AI');
      if([400,401,403,404].includes(Number(err?.httpStatus))){fatalError=err?.message||'AI chưa sẵn sàng';stopped=true}
    }finally{stats.done++;update()}
  }

  async function run(){
    if(running)return;stopped=false;fatalError='';running=true;
    const queue=tasks.filter(t=>!isValidSbd(t.input.value));stats.total=queue.length;stats.done=stats.filled=stats.matched=stats.conflict=stats.failed=stats.skipped=0;update();startBtn.disabled=true;stopBtn.disabled=false;
    let cursor=0;async function worker(){while(!stopped&&cursor<queue.length){await work(queue[cursor++])}}
    await Promise.all(Array.from({length:Math.min(CONCURRENCY,queue.length||1)},worker));running=false;startBtn.disabled=false;stopBtn.disabled=true;
    progress.textContent=fatalError?`AI SBD tạm chưa sẵn sàng: ${fatalError}. Có thể nhập tay bình thường.`:stopped?`AI SBD đã dừng tại ${stats.done}/${stats.total}. Có thể nhập tay hoặc chạy lại.`:`AI SBD hoàn tất ${stats.done}/${stats.total} · điền ${stats.filled} · cần kiểm tra ${stats.conflict+stats.failed}.`;
  }

  startBtn?.addEventListener('click',()=>void run());stopBtn?.addEventListener('click',()=>{stopped=true;stopBtn.disabled=true});
  tasks.forEach(({input,row})=>input.addEventListener('input',()=>{if(document.activeElement===input){delete input.dataset.aiFilled;delete row.dataset.aiSbdSuggestion;const v=input.value.trim();markRow(row,isValidSbd(v)?'manual':'invalid',isValidSbd(v)?'Đã nhập tay':'Cần nhập')}}));
  if(autoStart&&tasks.some(t=>!isValidSbd(t.input.value)))setTimeout(()=>void run(),120);
  return {run,stop:()=>{stopped=true}};
}
