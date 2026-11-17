// Batch OCR helper for anonymous, public Chấm thi CLO. Never saves exam images.
// Images are small crops copied from embedded UnT files; no names/answers are sent.
const allowedOrigins=new Set([
  'https://ai-clo-ptithcm.github.io','https://apmaths.github.io',
  'http://localhost:5500','http://127.0.0.1:5500'
]);
const counters=new Map<string,number[]>();
function cors(origin:string|null){
  return {
    'Access-Control-Allow-Origin':origin&&allowedOrigins.has(origin)?origin:'https://ai-clo-ptithcm.github.io',
    'Access-Control-Allow-Headers':'content-type, apikey, authorization, x-client-info',
    'Access-Control-Allow-Methods':'POST, OPTIONS','Access-Control-Max-Age':'3600',
    'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','Vary':'Origin'
  };
}
function respond(value:unknown,status:number,origin:string|null){
  return new Response(JSON.stringify(value),{status,headers:cors(origin)});
}
function sanitize(items:unknown){
  if(!Array.isArray(items)||items.length<1||items.length>4)return null;
  const used=new Set<number>();
  const safe:{row:number,base64:string,mime_type:string}[]=[];
  for(const x of items){
    if(!x||typeof x!=='object')return null;
    const row=(x as any).row,base64=(x as any).base64,mime_type=(x as any).mime_type;
    if(!Number.isInteger(row)||row<1||row>5000||used.has(row))return null;
    if(!['image/jpeg','image/png','image/webp'].includes(mime_type))return null;
    if(typeof base64!=='string'||base64.length<30||base64.length>450000||
      !/^[A-Za-z0-9+/]+={0,2}$/.test(base64))return null;
    used.add(row);safe.push({row,base64,mime_type});
  }
  return safe;
}
function throttle(req:Request){
  const ip=(req.headers.get('cf-connecting-ip')||req.headers.get('x-forwarded-for')||'unknown').split(',')[0].trim().slice(0,80);
  const now=Date.now();
  const current=(counters.get(ip)||[]).filter(t=>now-t<60000);
  if(current.length>=15)return false;
  current.push(now);counters.set(ip,current);
  if(counters.size>500)counters.clear();
  return true;
}
Deno.serve(async(req:Request)=>{
  const origin=req.headers.get('origin');
  if(origin&&!allowedOrigins.has(origin))return respond({ok:false,error:'Nguồn truy cập không được phép.'},403,origin);
  if(req.method==='OPTIONS')return new Response(null,{status:204,headers:cors(origin)});
  if(req.method!=='POST')return respond({ok:false,error:'Chỉ nhận POST.'},405,origin);
  if(!throttle(req))return respond({ok:false,error:'Quá nhiều lượt AI trong một phút. Có thể nhập thủ công và thử lại sau.'},429,origin);
  let parsed:any;
  try{
    const text=await req.text();
    if(text.length>1750000)return respond({ok:false,error:'Lô ảnh vượt giới hạn dung lượng.'},413,origin);
    parsed=JSON.parse(text);
  }catch{return respond({ok:false,error:'Dữ liệu không hợp lệ.'},400,origin)}
  const images=sanitize(parsed?.images);
  if(!images)return respond({ok:false,error:'Chỉ hỗ trợ 1–4 ảnh JPG/PNG/WEBP kích thước nhỏ trong mỗi lô.'},400,origin);
  const key=Deno.env.get('GEMINI_API_KEY')||Deno.env.get('GEMINI_LIVE_API_KEY');
  if(!key)return respond({ok:false,error:'Chưa cấu hình Gemini trên máy chủ.'},503,origin);
  const models=[...new Set([Deno.env.get('SBD_BATCH_MODEL')||'gemini-3.5-flash-lite','gemini-3.5-flash'])];
  const schema={
    type:'object',additionalProperties:false,required:['results'],
    properties:{results:{type:'array',items:{
      type:'object',additionalProperties:false,required:['row','digits'],
      properties:{row:{type:'integer'},digits:{type:'string'}}
    }}}
  };
  const parts:any[]=[{text:
    'Chỉ đọc các CHỮ SỐ số phách viết trong các hình. Mỗi ảnh sẽ có một mã dòng Excel đứng trước. '+ 
    'Trả đúng JSON results gồm row và digits cho TẤT CẢ mã dòng, kể cả khi không đọc được. '+ 
    'Giữ các chữ số 0 đầu nếu có. Không đoán khi ảnh không rõ; điền digits là chuỗi rỗng. '+ 
    'Tuyệt đối không dùng dữ liệu từ ảnh khác để suy ra số. Không kèm giải thích.'}];
  for(const image of images){
    parts.push({text:'Mã dòng Excel '+image.row+':'});
    parts.push({inlineData:{mimeType:image.mime_type,data:image.base64}});
  }
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),17500);
  try{
    let response:Response|null=null,model=models[0];
    for(const choice of models){
      model=choice;
      response=await fetch('https://generativelanguage.googleapis.com/v1beta/models/'+
        encodeURIComponent(choice)+':generateContent',{
          method:'POST',signal:controller.signal,
          headers:{'Content-Type':'application/json','x-goog-api-key':key},
          body:JSON.stringify({contents:[{role:'user',parts}],generationConfig:{
            temperature:0,responseMimeType:'application/json',responseJsonSchema:schema,maxOutputTokens:300
          }})
        });
      // Fallback only when model name is not available; no quota/retry cascade.
      if(response.status!==404)break;
    }
    if(!response)return respond({ok:false,error:'Gemini chưa phản hồi.'},502,origin);
    if(!response.ok){
      const error=await response.json().catch(()=>({}));
      const status=response.status===429?429:502;
      return respond({ok:false,error:status===429?
        'Gemini đang giới hạn lượt gọi. Có thể nhập số phách thủ công và thử lại sau.':
        'Gemini tạm thời không khả dụng ('+response.status+').'},status,origin);
    }
    const data=await response.json();
    const raw=data?.candidates?.[0]?.content?.parts?.map((x:any)=>x.text||'').join('')||'';
    let obj:any={};
    try{obj=JSON.parse(raw)}catch{return respond({ok:false,error:'Gemini trả kết quả không đúng định dạng.'},502,origin)}
    const allowed=new Set(images.map(x=>x.row)),seen=new Set<number>(),results: {row:number,digits:string}[]=[];
    for(const item of Array.isArray(obj.results)?obj.results:[]){
      const row=item?.row,digits=item?.digits;
      if(!allowed.has(row)||seen.has(row))continue;
      seen.add(row);
      results.push({row,digits:typeof digits==='string'&&/^\\d{1,12}$/.test(digits)?digits:''});
    }
    for(const x of images)if(!seen.has(x.row))results.push({row:x.row,digits:''});
    return respond({ok:true,results,model},200,origin);
  }catch(e){
    return respond({ok:false,error:controller.signal.aborted?
      'Gemini phản hồi quá lâu, đã ngắt yêu cầu sau khoảng 18 giây.':
      'Không thể liên hệ Gemini. Có thể nhập thủ công và thử lại sau.'},504,origin);
  }finally{clearTimeout(timer)}
});
