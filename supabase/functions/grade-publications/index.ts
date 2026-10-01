
import { createClient } from "npm:@supabase/supabase-js@2.49.8";
// Data validation is included below so this function can be deployed independently.

function normalize(value,type='text'){
 const s=String(value??'').trim();
 if(type==='dob'){
  let m=s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:T.*)?$/);
  if(!m){const d=s.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})$/);if(d)m=[d[0],d[3],d[2],d[1]];}
  if(!m)return '';
  const y=+m[1],month=+m[2],day=+m[3],date=new Date(Date.UTC(y,month-1,day));
  if(date.getUTCFullYear()!==y||date.getUTCMonth()!==month-1||date.getUTCDate()!==day)return '';
  return m[1]+'-'+String(month).padStart(2,'0')+'-'+String(day).padStart(2,'0');
 }
 if(type==='phone'){let p=s.replace(/[\s().-]/g,'');if(p.startsWith('+84'))p='0'+p.slice(3);if(p.startsWith('84')&&p.length===11)p='0'+p.slice(2);return /^0\d{8,10}$/.test(p)?p:'';}
 return s.normalize('NFKC').toLocaleLowerCase('vi');
}
function validateTable(columns,rows,visible,verification){
 if(!Array.isArray(columns)||!columns.length||columns.length>100)throw Error('Cần từ 1 đến 100 cột.');
 if(columns.some(c=>typeof c!=='string'||!c.trim()||c.length>200))throw Error('Tên cột không được trống và tối đa 200 ký tự.');
 if(new Set(columns.map(c=>c.trim().toLowerCase())).size!==columns.length)throw Error('Tên cột bị trùng. Hãy đổi tên.');
 if(!Array.isArray(rows)||!rows.length||rows.length>5000)throw Error('Cần từ 1 đến 5000 dòng dữ liệu.');
 if(rows.some(r=>!Array.isArray(r)||r.length!==columns.length||r.some(c=>typeof c!=='string'||c.length>2000)))throw Error('Dữ liệu lệch cột hoặc ô vượt 2000 ký tự.');
 if(!Array.isArray(visible)||!visible.length||visible.some(i=>!Number.isInteger(i)||i<0||i>=columns.length)||new Set(visible).size!==visible.length)throw Error('Chọn ít nhất một cột công bố hợp lệ.');
 if(!Array.isArray(verification)||!verification.length||verification.length>4||verification.some(v=>!Number.isInteger(v.column)||v.column<0||v.column>=columns.length||!['mssv','phone','dob','code'].includes(v.type))||new Set(verification.map(v=>v.column)).size!==verification.length)throw Error('Chọn cột xác nhận hợp lệ, không trùng.');
 const seen=new Set();
 rows.forEach((r,i)=>{
  const values=verification.map(v=>normalize(r[v.column],v.type));
  if(values.some(s=>!s))throw Error('Dòng '+(i+1)+': thông tin xác nhận trống hoặc sai định dạng.');
  const key=JSON.stringify(values);if(seen.has(key))throw Error('Dòng '+(i+1)+': tổ hợp xác nhận bị trùng. Chọn thêm trường xác nhận.');seen.add(key);
 });
}
function tableFromMatrix(matrix,header=0){
 if(!Array.isArray(matrix)||!matrix[header])throw Error('Không có dòng tiêu đề.');
 const width=matrix[header].length;
 const columns=matrix[header].map((c,i)=>String(c??'').trim()||'Cột '+(i+1));
 const rows=matrix.slice(header+1).filter(r=>r.some(c=>String(c??'').trim())).map(r=>Array.from({length:width},(_,i)=>String(r[i]??'')));
 return {columns,rows};
}
function parseTSV(text){
 // Excel clipboard uses tabs/newlines and quoted multiline cells.
 const rows=[];let row=[],cell='',quote=false;
 const s=text.replace(/\r\n/g,'\n').replace(/\r/g,'\n');
 for(let i=0;i<s.length;i++){const ch=s[i];
  if(ch==='"'){if(quote&&s[i+1]==='"'){cell+='"';i++;}else if(quote||!cell)quote=!quote;else cell+=ch;}
  else if(ch==='\t'&&!quote){row.push(cell);cell='';}
  else if(ch==='\n'&&!quote){row.push(cell);rows.push(row);row=[];cell='';}
  else cell+=ch;
 }
 if(quote)throw Error('Vùng dán có dấu ngoặc kép chưa đóng.');
 row.push(cell);if(row.some(c=>c!==''))rows.push(row);
 return rows;
}

const url=Deno.env.get('SUPABASE_URL')!;
const key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const db=createClient(url,key,{auth:{persistSession:false}});
const origins=new Set(['https://ai-clo-ptithcm.github.io']);
const actions=new Set(['check_code','list','meta','create','unlock','read','save','restore','upload','original','sync_now','password','lookup','settings','set_code','reset_password','delete','google_preview','connector']);
const adminActions=new Set(['settings','set_code','reset_password','delete']);
let googleToken={token:'',until:0};
function googleConfig(){
 const raw=Deno.env.get('GRADE_GOOGLE_SERVICE_ACCOUNT_JSON');
 if(!raw)throw Error('Chưa cấu hình kết nối Google Sheets. Admin cần thêm GRADE_GOOGLE_SERVICE_ACCOUNT_JSON vào Edge Function secrets.');
 return JSON.parse(raw);
}
const b64=(bytes:Uint8Array)=>btoa(String.fromCharCode(...bytes)).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');
const enc=(s:string)=>new TextEncoder().encode(s);
async function accessToken(){
 if(googleToken.until>Date.now())return googleToken.token;
 const c=googleConfig(),now=Math.floor(Date.now()/1000);
 const head=b64(enc(JSON.stringify({alg:'RS256',typ:'JWT'})));
 const body=b64(enc(JSON.stringify({iss:c.client_email,scope:'https://www.googleapis.com/auth/spreadsheets.readonly',aud:'https://oauth2.googleapis.com/token',iat:now,exp:now+3600})));
 const data=head+'.'+body;
 const pem=c.private_key.replace(/-----[^-]+-----|\s/g,'');
 const privateKey=await crypto.subtle.importKey('pkcs8',Uint8Array.from(atob(pem),(x)=>x.charCodeAt(0)),{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['sign']);
 const signature=await crypto.subtle.sign('RSASSA-PKCS1-v1_5',privateKey,enc(data));
 const response=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion:data+'.'+b64(new Uint8Array(signature))}),signal:AbortSignal.timeout(15000)});
 const token=await response.json();if(!response.ok||!token.access_token)throw Error('Không lấy được quyền đọc Google Sheets. Admin kiểm tra cấu hình.');
 googleToken={token:token.access_token,until:Date.now()+3000000};return googleToken.token;
}
async function googleRead(config:any){
 if(!/^[\w-]{20,100}$/.test(config.spreadsheet_id??''))throw Error('Link Google Sheets không hợp lệ.');
 const header=Number(config.header_row??1);if(!Number.isInteger(header)||header<1||header>100)throw Error('Dòng tiêu đề phải từ 1 đến 100.');
 const sheet=String(config.sheet_name??'').trim();if(!sheet||sheet.length>100)throw Error('Nhập tên sheet.');
 const range="'"+sheet.replace(/'/g,"''")+"'!A"+header+":CW"+(header+5001);
 const response=await fetch('https://sheets.googleapis.com/v4/spreadsheets/'+config.spreadsheet_id+'/values/'+encodeURIComponent(range)+'?valueRenderOption=FORMATTED_VALUE',{headers:{Authorization:'Bearer '+await accessToken()},signal:AbortSignal.timeout(20000)});
 if(!response.ok)throw Error('Không đọc được sheet. Kiểm tra tên sheet và chia sẻ quyền Người xem cho email kết nối.');
 const json=await response.json(),matrix=json.values??[];
 const table=tableFromMatrix(matrix);if(table.columns.length>100)throw Error('Sheet vượt 100 cột.');
 if(table.rows.length>5000)throw Error('Sheet vượt 5000 dòng dữ liệu.');
 return table;
}
async function gateway(action:string,payload:any={},admin:string|null=null){
 const {data,error}=await db.rpc('grade_gateway',{p_action:action,p_payload:payload,p_admin:admin});
 if(error)throw Error(error.message);return data;
}
async function refresh(id:string,internal=false){
 const claim=await gateway('sync_claim',{id,internal:internal?'yes':''});
 if(!claim.claimed)return;
 try{
  const table=await googleRead(claim.source_config);
  if(JSON.stringify(table.columns)!==JSON.stringify(claim.columns))throw Error('Cấu trúc cột đã đổi. Mở quản lý, đọc lại Sheets và chọn lại cột.');
  validateTable(table.columns,table.rows,claim.visible_columns,claim.verification);
  await gateway('sync_done',{id,lease:claim.lease,rows:table.rows});
 }catch(e){await gateway('sync_done',{id,lease:claim.lease,error:(e as Error).message});}
}
async function hash(s:string){return b64(new Uint8Array(await crypto.subtle.digest('SHA-256',enc(s))));}
Deno.serve(async(req:Request)=>{
 const origin=req.headers.get('origin')??'';
 const headers={'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','Vary':'Origin','Access-Control-Allow-Origin':origins.has(origin)?origin:'https://ai-clo-ptithcm.github.io','Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info','Access-Control-Allow-Methods':'POST, OPTIONS'};
 const reply=(data:any,status=200)=>new Response(JSON.stringify(data),{status,headers});
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers});
 if(req.method!=='POST')return reply({error:'Chỉ hỗ trợ POST'},405);
 if(origin&&!origins.has(origin))return reply({error:'Nguồn truy cập không được hỗ trợ'},403);
 try{
  const length=Number(req.headers.get('content-length')??0);if(length>8000000)return reply({error:'Dữ liệu vượt 8 MB'},413);
  const raw=await req.text();if(enc(raw).length>8000000)return reply({error:'Dữ liệu vượt 8 MB'},413);
  const {action,payload={}}=JSON.parse(raw);
  if(!actions.has(action))return reply({error:'Thao tác không hợp lệ'},400);
  let admin:string|null=null;
  const authorization=req.headers.get('Authorization')??'';
  if(authorization.startsWith('Bearer ')){
   const token=authorization.slice(7),{data,error}=await db.auth.getUser(token);
   if(error||!data.user)return reply({error:'Phiên admin đã hết hạn'},401);
   const {data:profile}=await db.from('profiles').select('role,is_active,locked_at').eq('id',data.user.id).single();
   if(profile?.role==='admin'&&profile.is_active&&!profile.locked_at)admin=data.user.id;
   else return reply({error:'Tài khoản không có quyền admin'},403);
  }
  if(adminActions.has(action)&&!admin)return reply({error:'Cần đăng nhập admin'},403);
  if(!admin){
   const ip=req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()??req.headers.get('cf-connecting-ip')??'unknown';
   const sensitive=['check_code','unlock','create','lookup','password','google_preview'].includes(action);
   const category=action==='lookup'?'lookup':sensitive?'credentials':'general';
   const rate=await gateway('rate',{key:await hash(ip+':'+category),limit:action==='lookup'?300:sensitive?30:200});
   if(!rate.allowed)return reply({error:'Quá nhiều yêu cầu. Vui lòng thử lại sau 10 phút.'},429);
  }
  if(action==='check_code'){
   if(typeof payload.code!=='string'||! /^[0-9]{4}$/.test(payload.code))throw Error('Mã tạo phải gồm đúng 4 chữ số.');
   const {data,error}=await db.rpc('grade_check_creation_code',{p_code:payload.code});
   if(error)throw Error(error.message);
   if(!data)throw Error('Mã tạo không đúng.');
   return reply({ok:true});
  }
  if(action==='connector'){
   let email=null;try{email=googleConfig().client_email;}catch{}
   return reply({email,configured:!!email});
  }
  if(action==='settings'){
   const result=await gateway(action,payload,admin);let email=null;try{email=googleConfig().client_email;}catch{}
   return reply({...result,google_email:email});
  }
  if(action==='google_preview'){
   // Preview requires an unlocked publication, or the authenticated admin.
   await gateway('read',payload,admin);
   const table=await googleRead(payload.source_config);return reply(table);
  }
  if(action==='save'){
   if(!['excel','paste','google'].includes(payload.source))throw Error('Nguồn dữ liệu không hợp lệ.');
   if(![payload.title,payload.teacher,payload.class_name].every(x=>typeof x==='string'&&x.trim()))throw Error('Nhập tên công bố, giảng viên và lớp.');
   let data={...payload};
   if(data.source==='google'){
    const table=await googleRead(data.source_config);
    if(JSON.stringify(table.columns)!==JSON.stringify(data.columns))throw Error('Tên cột Sheets đã đổi. Đọc lại Sheets trước khi lưu.');
    data.rows=table.rows;
   }else data.source_config={};
   validateTable(data.columns,data.rows,data.visible_columns,data.verification);
   return reply(await gateway(action,data,admin));
  }
  if(action==='create'){
   if(![payload.title,payload.teacher,payload.class_name].every(x=>typeof x==='string'&&x.trim()))throw Error('Nhập tên công bố, giảng viên và lớp.');
  }
  if(action==='lookup'){
   await gateway('meta',{id:payload.id});
   await refresh(payload.id);
   if(!Array.isArray(payload.values)||payload.values.length>4||payload.values.some((x:any)=>typeof x!=='string'||x.length>200))throw Error('Nhập đầy đủ thông tin xác nhận.');
   return reply(await gateway('lookup',{id:payload.id,values:payload.values}));
  }
  if(action==='meta'){
   const meta=await gateway('meta',payload);
   return reply({...meta,verification:meta.verification.map((v:any)=>({type:v.type,label:v.label}))});
  }
  if(action==='sync_now'){
   await gateway('sync_now',payload,admin);await refresh(payload.id,true);
   return reply(await gateway('read',payload,admin));
  }
  if(action==='upload'){
   const result=await gateway('upload',payload,admin);
   const {data,error}=await db.storage.from('grade-publications').createSignedUploadUrl(result.path,{upsert:true});
   if(error)throw Error('Không tạo được đường dẫn tải file.');
   return reply({path:result.path,token:data.token});
  }
  if(action==='original'){
   await gateway('read',payload,admin);
   if(!new RegExp('^'+payload.id+'/original\\.(xlsx|xls|csv)$').test(payload.path))throw Error('Đường dẫn file không hợp lệ.');
   // Only one original per publication.
   const files=await db.storage.from('grade-publications').list(payload.id);
   const old=(files.data??[]).map(f=>payload.id+'/'+f.name).filter(p=>p!==payload.path);
   if(old.length)await db.storage.from('grade-publications').remove(old);
  }
  if(action==='delete'){
   await gateway('read',payload,admin);
   const files=await db.storage.from('grade-publications').list(payload.id);
   if(files.error)throw Error('Không đọc được file gốc để xóa.');
   const paths=(files.data??[]).map(f=>payload.id+'/'+f.name);
   if(paths.length){const {error}=await db.storage.from('grade-publications').remove(paths);if(error)throw Error('Chưa xóa được file gốc. Thử lại.');}
  }
  return reply(await gateway(action,payload,admin));
 }catch(e){return reply({error:(e as Error).message??'Không xử lý được yêu cầu'},400);}
});

