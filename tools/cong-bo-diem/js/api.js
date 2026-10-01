
const cfg=window.AICLO_CONFIG;
export const client=window.supabase.createClient(cfg.SUPABASE_URL,cfg.SUPABASE_PUBLISHABLE_KEY,{auth:{storageKey:'ptithcm-grade-admin',persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}});
export const $=s=>document.querySelector(s);
export const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const stamp=s=>s?new Date(s).toLocaleString('vi-VN'):'Chưa cập nhật';
let noticeTimer;
export function fieldError(message,fields=[]){const e=new Error(message);e.fields=fields;return e;}
export function clearErrors(){document.querySelectorAll('[aria-invalid="true"]').forEach(el=>el.removeAttribute('aria-invalid'));}
export function markErrors(fields=[]){
 fields.forEach(selector=>document.querySelectorAll(selector).forEach(el=>el.setAttribute('aria-invalid','true')));
 const first=document.querySelector('[aria-invalid="true"]');
 first?.scrollIntoView({block:'center',behavior:'smooth'});first?.focus({preventScroll:true});
}
export function status(message,error=false){
 const el=$('#status');if(!el)return;clearTimeout(noticeTimer);
 const host=document.querySelector('dialog[open]')||document.body;host.append(el);
 el.className='notice floating-notice '+(error?'error':'success');el.setAttribute('role',error?'alert':'status');
 el.replaceChildren();const text=document.createElement('div');text.textContent=message;
 const close=document.createElement('button');close.type='button';close.className='notice-close';close.textContent='Đóng';
 close.setAttribute('aria-label','Đóng thông báo');close.onclick=()=>{clearTimeout(noticeTimer);el.replaceChildren();};
 el.append(text,close);if(!error)noticeTimer=setTimeout(()=>el.replaceChildren(),6000);
}
document.addEventListener('close',e=>{if(e.target instanceof HTMLDialogElement&&e.target.contains($('#status')))document.body.append($('#status'));},true);
export function manualEntry(){
 document.querySelectorAll('[data-manual-entry]').forEach(el=>{
  const enable=()=>el.removeAttribute('readonly');
  el.addEventListener('focus',enable);el.addEventListener('pointerdown',enable);
 });
}
document.addEventListener('input',e=>e.target.removeAttribute?.('aria-invalid'));
document.addEventListener('change',e=>e.target.removeAttribute?.('aria-invalid'));
document.addEventListener('invalid',e=>{e.preventDefault();markErrors(e.target.id?['#'+e.target.id]:[]);e.target.setAttribute('aria-invalid','true');status('Kiểm tra ô '+(e.target.closest('label')?.childNodes[0]?.textContent?.trim()||'đang nhập')+': '+e.target.validationMessage,true);},true);
export async function api(action,payload={},admin=false){
 const headers={'Content-Type':'application/json','apikey':cfg.SUPABASE_PUBLISHABLE_KEY};
 if(admin){const {data}=await client.auth.getSession();if(!data.session)throw Error('Cần đăng nhập admin.');headers.Authorization='Bearer '+data.session.access_token;}
 const response=await fetch(cfg.SUPABASE_URL+'/functions/v1/grade-publications',{method:'POST',headers,body:JSON.stringify({action,payload}),cache:'no-store'});
 let data;try{data=await response.json();}catch{throw Error('Không kết nối được dịch vụ. Thử lại sau.');}
 if(!response.ok||data.error){
  const message=data.error||'Yêu cầu thất bại.';let fields=[];
  if(action==='lookup')fields=['[data-field]'];
  if(action==='unlock')fields=['#editPassword'];
  if(action==='check_code')fields=['#creationCode'];
  if(action==='create')fields=/Mã tạo/.test(message)?['#creationCode']:/Mật khẩu/.test(message)?['#editPassword']:[];
  if(action==='set_code')fields=['#code'];
  if(action==='google_preview'&&/sheet|Sheets|Link/.test(message))fields=['#googleLink','#googleSheet'];
  throw fieldError(message,fields);
 }return data;
}
export async function busy(button,fn){const disabled=button?.disabled;if(button)button.disabled=true;try{return await fn();}catch(e){markErrors(e.fields);status(e.message,true);}finally{if(button)button.disabled=disabled??false;}}
export function lookupLink(id){return new URL('/tools/cong-bo-diem/tra-cuu/?id='+encodeURIComponent(id),location.origin).href;}
export async function showQR(id){
 const link=lookupLink(id);const dialog=$('#qrDialog');$('#qrLink').value=link;$('#qr').replaceChildren();dialog.showModal();
 if(!window.QRCode)await new Promise((resolve,reject)=>{const s=document.createElement('script');s.src='https://cdn.jsdelivr.net/npm/qrcodejs@1.0.0/qrcode.min.js';s.onload=resolve;s.onerror=()=>reject(Error('Không tải được QR. Bạn vẫn có thể sao chép link.'));document.head.append(s);});
 new window.QRCode($('#qr'),{text:link,width:220,height:220,correctLevel:window.QRCode.CorrectLevel.M});
}
export function bindQR(){
 $('#qrClose')?.addEventListener('click',()=>$('#qrDialog').close());
 $('#copyLink')?.addEventListener('click',()=>busy($('#copyLink'),async()=>{await navigator.clipboard.writeText($('#qrLink').value);status('Đã sao chép link tra cứu.');}));
}


