// Reads only embedded SBD pictures. All suggestions require teacher approval.
// Network timeout is per batch, never blocks manual input in the review table.
const REQUEST_MS=22000;
function readDataUrl(blob){
  return new Promise((resolve,reject)=>{
    const reader=new FileReader();
    reader.onload=()=>resolve(String(reader.result||''));
    reader.onerror=()=>reject(new Error('Không đọc được ảnh số phách.'));
    reader.readAsDataURL(blob);
  });
}
async function compressImage(blob){
  const url=URL.createObjectURL(blob);
  try{
    const image=new Image();
    await new Promise((resolve,reject)=>{
      image.onload=resolve;
      image.onerror=()=>reject(new Error('Ảnh số phách bị lỗi.'));
      image.src=url;
    });
    const scale=Math.min(1,1400/image.naturalWidth,700/image.naturalHeight);
    const canvas=document.createElement('canvas');
    canvas.width=Math.max(1,Math.round(image.naturalWidth*scale));
    canvas.height=Math.max(1,Math.round(image.naturalHeight*scale));
    const ctx=canvas.getContext('2d');
    ctx.drawImage(image,0,0,canvas.width,canvas.height);
    return new Promise((resolve,reject)=>
      canvas.toBlob(b=>b?resolve(b):reject(new Error('Không thu nhỏ được ảnh.')),'image/jpeg',0.78));
  }finally{URL.revokeObjectURL(url)}
}
async function asImage(item){
  let blob=item.blob;
  if(!['image/jpeg','image/png','image/webp'].includes(blob.type)||blob.size>260000)blob=await compressImage(blob);
  if(blob.size>330000)throw new Error('Ảnh số phách quá lớn. Vui lòng nhập tay dòng '+item.row+'.');
  const url=await readDataUrl(blob);
  return {row:item.row,mime_type:blob.type,base64:url.slice(url.indexOf(',')+1)};
}
export async function recognizePhachBatch(items,{signal}={}){
  const config=window.AICLO_CONFIG||{};
  if(!/^https:\/\/[-a-z0-9.]+\.supabase\.co$/i.test(config.SUPABASE_URL||'')){
    throw new Error('Thiếu cấu hình Supabase AI-CLO.');
  }
  if(!Array.isArray(items)||!items.length||items.length>4)throw new Error('Lô AI chỉ nhận 1–4 ảnh.');
  const images=await Promise.all(items.map(asImage));
  if(signal?.aborted)throw new DOMException('Đã hủy','AbortError');
  const controller=new AbortController();
  const abort=()=>controller.abort();
  signal?.addEventListener('abort',abort,{once:true});
  const timer=setTimeout(()=>controller.abort(),REQUEST_MS);
  try{
    const response=await fetch(config.SUPABASE_URL+'/functions/v1/recognize-phach-batch',{
      method:'POST',headers:{'Content-Type':'application/json'},
      signal:controller.signal,body:JSON.stringify({images})
    });
    const data=await response.json().catch(()=>({}));
    if(!response.ok||!data.ok){
      const error=new Error(data?.error||('Gemini HTTP '+response.status));
      error.status=response.status;
      throw error;
    }
    const accepted=new Set(items.map(x=>x.row));
    return (Array.isArray(data.results)?data.results:[]).filter(x=>
      Number.isInteger(x?.row)&&accepted.has(x.row)).map(x=>({
        row:x.row,digits:typeof x.digits==='string'&&/^\d{1,12}$/.test(x.digits)?x.digits:''
      }));
  }catch(e){
    if(e?.name==='AbortError'&&!signal?.aborted)throw new Error('Gemini phản hồi quá lâu, bỏ qua lô này. Có thể nhập tay hoặc thử lại.');
    throw e;
  }finally{
    clearTimeout(timer);
    signal?.removeEventListener('abort',abort);
  }
}
