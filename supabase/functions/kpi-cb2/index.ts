import { createClient } from 'npm:@supabase/supabase-js@2.49.8';
import { sheetRecords } from './core.js';
const db=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false}});
const origins=new Set(['https://ai-clo-ptithcm.github.io']);
const actions=new Set(['unlock','view','load','metric','plan','month','record','settings','pin','delegate','sync']);
const enc=(s:string)=>new TextEncoder().encode(s);
const b64=(a:Uint8Array)=>btoa(String.fromCharCode(...a)).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');
const hash=async(s:string)=>b64(new Uint8Array(await crypto.subtle.digest('SHA-256',enc(s))));
let cached={token:'',until:0};
function googleConfig(){const raw=Deno.env.get('KPI_GOOGLE_SERVICE_ACCOUNT_JSON')||Deno.env.get('GRADE_GOOGLE_SERVICE_ACCOUNT_JSON');if(!raw)throw Error('Chưa có kết nối Google. Admin cần cấu hình KPI_GOOGLE_SERVICE_ACCOUNT_JSON.');return JSON.parse(raw);}
async function accessToken(){
 if(cached.until>Date.now())return cached.token;
 const c=googleConfig(),now=Math.floor(Date.now()/1000);
 const jwt=b64(enc(JSON.stringify({alg:'RS256',typ:'JWT'})))+'.'+b64(enc(JSON.stringify({iss:c.client_email,scope:'https://www.googleapis.com/auth/spreadsheets.readonly',aud:'https://oauth2.googleapis.com/token',iat:now,exp:now+3600})));
 const key=await crypto.subtle.importKey('pkcs8',Uint8Array.from(atob(c.private_key.replace(/-----[^-]+-----|\s/g,'')),x=>x.charCodeAt(0)),{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['sign']);
 const signature=await crypto.subtle.sign('RSASSA-PKCS1-v1_5',key,enc(jwt));
 const response=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion:jwt+'.'+b64(new Uint8Array(signature))}),signal:AbortSignal.timeout(15000)});
 const json=await response.json();if(!response.ok||!json.access_token)throw Error('Không lấy được quyền đọc Google Sheets. Kiểm tra cấu hình kết nối.');
 cached={token:json.access_token,until:Date.now()+3000000};return cached.token;
}
async function readSheet(claim:any){
 const range="'"+claim.sheet_name.replace(/'/g,"''")+"'!A1:F5002";
 const response=await fetch('https://sheets.googleapis.com/v4/spreadsheets/'+claim.sheet_id+'/values/'+encodeURIComponent(range)+'?valueRenderOption=UNFORMATTED_VALUE&dateTimeRenderOption=SERIAL_NUMBER',{headers:{Authorization:'Bearer '+await accessToken()},signal:AbortSignal.timeout(20000)});
 if(!response.ok)throw Error('Không đọc được Sheet. Kiểm tra tên tab và chia sẻ quyền Người xem cho email kết nối.');
 const json=await response.json();return sheetRecords(json.values??[],claim.sheet_id,hash);
}
async function gateway(action:string,payload:any,actor:string|null){
 const {data,error}=await db.rpc('kpi_gateway',{p_action:action,p_payload:payload,p_actor:actor});
 if(error){const e=new Error(['42501','P0001'].includes(error.code)?error.message:error.code==='23505'?'Mã KPI hoặc định danh bị trùng.':error.code==='23514'?'Giá trị nằm ngoài phạm vi cho phép.':'Dữ liệu không hợp lệ. Kiểm tra các trường và thử lại.');(e as any).status=error.code==='42501'?403:400;throw e;}
 return data;
}
Deno.serve(async(req:Request)=>{
 const origin=req.headers.get('origin')??'';
 const headers={'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','Vary':'Origin','Access-Control-Allow-Origin':origins.has(origin)?origin:'https://ai-clo-ptithcm.github.io','Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info','Access-Control-Allow-Methods':'POST, OPTIONS'};
 const reply=(data:any,status=200)=>new Response(JSON.stringify(data),{status,headers});
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers});
 if(req.method!=='POST')return reply({error:'Chỉ hỗ trợ POST'},405);
 if(origin&&!origins.has(origin))return reply({error:'Nguồn truy cập không được hỗ trợ'},403);
 try{
  const raw=await req.text();if(enc(raw).length>100000)return reply({error:'Yêu cầu quá lớn'},413);
  const {action,payload={}}=JSON.parse(raw);
  if(!actions.has(action)||!payload||typeof payload!=='object'||Array.isArray(payload))return reply({error:'Thao tác không hợp lệ'},400);
  let actor:string|null=null;
  if(!['unlock','view'].includes(action)){
   const bearer=req.headers.get('authorization')??'';if(!bearer.startsWith('Bearer '))return reply({error:'Cần đăng nhập quản lý'},401);
   const {data,error}=await db.auth.getUser(bearer.slice(7));if(error||!data.user)return reply({error:'Phiên đăng nhập đã hết hạn'},401);actor=data.user.id;
  }
  if(action==='unlock'){
   const ip=req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()??req.headers.get('cf-connecting-ip')??'unknown';
   const result=await gateway('unlock',{code:payload.code,client:await hash('kpi:'+ip)},null);return reply(result,result.status??200);
  }
  if(action==='load'){
   const result=await gateway('load',payload,actor);let google_email=null;try{google_email=googleConfig().client_email;}catch{}
   return reply({...result,google_email});
  }
  if(action==='record'){
   const e=payload.effective??{};payload.effective=Object.fromEntries(['title','type','reporter','info','evidence','quantity','dedup_key','start_date','end_date'].map(k=>[k,e[k]??(k==='quantity'?1:'')]));
  }
  if(action==='sync'){
   const claim=await gateway('sync_claim',{force:payload.force===true},actor);if(!claim.claimed)return reply({ok:true,skipped:true});
   try{return reply(await gateway('sync_done',{lease:claim.lease,records:await readSheet(claim)},actor));}
   catch(e){const message=(e as Error).message;await gateway('sync_done',{lease:claim.lease,error:message},actor);return reply({error:message},400);}
  }
  const result=await gateway(action,payload,actor);return reply(result,result.status??200);
 }catch(e){return reply({error:(e as Error).message||'Không xử lý được yêu cầu'},(e as any).status??400);}
});
