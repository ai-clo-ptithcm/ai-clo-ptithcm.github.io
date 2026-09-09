// Supabase Edge Function: recognize-sbd-image
// Public helper for /cham-thi-clo. Reads digits only from one embedded UnT image.

const ALLOWED_ORIGINS = new Set([
  'https://ai-clo-ptithcm.github.io',
  'http://localhost:5500',
  'http://127.0.0.1:5500',
]);

const DEFAULT_MODELS = [
  'gemini-3.5-flash-lite',
  'gemini-3.5-flash',
  'gemini-3.6-flash',
];

function cors(origin: string | null) {
  const allowed = origin && ALLOWED_ORIGINS.has(origin)
    ? origin
    : 'https://ai-clo-ptithcm.github.io';
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Headers': 'content-type, authorization, apikey, x-client-info',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  };
}

function json(data: unknown, status: number, origin: string | null) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...cors(origin),
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}

function models() {
  const configured=(Deno.env.get('SBD_GEMINI_MODELS')||Deno.env.get('GEMINI_MODELS')||'')
    .split(',').map(x=>x.trim()).filter(Boolean);
  return [...new Set([...configured,...DEFAULT_MODELS])];
}

function retryable(status:number,message:string){
  return status===404 || status===408 || status===429 || status>=500 ||
    /quota|rate limit|resource exhausted|not found|unavailable|overloaded|temporar/i.test(message);
}

async function callGemini(key:string,body:unknown){
  let last='Gemini chưa đọc được ảnh.';
  for(const model of models()){
    try{
      const response=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,{
        method:'POST',
        headers:{'Content-Type':'application/json','x-goog-api-key':key},
        body:JSON.stringify(body),
      });
      const data=await response.json().catch(()=>({}));
      if(response.ok)return {data,model};
      last=data?.error?.message||`Gemini HTTP ${response.status}`;
      if(!retryable(response.status,last))break;
    }catch(err){last=err instanceof Error?err.message:String(err)}
  }
  throw new Error(last);
}

function cleanBase64(value:unknown){
  if(typeof value!=='string')return '';
  return value.replace(/^data:[^;]+;base64,/i,'').replace(/\s+/g,'').slice(0,2_500_000);
}

Deno.serve(async(req)=>{
  const origin=req.headers.get('origin');
  if(req.method==='OPTIONS') return new Response(null,{status:204,headers:cors(origin)});
  if(req.method!=='POST') return json({ok:false,error:'Chỉ hỗ trợ POST.'},405,origin);

  try{
    const body=await req.json();
    const image=cleanBase64(body?.image);
    const mimeType=String(body?.mime_type||'image/jpeg').trim();
    if(!image) return json({ok:false,error:'Thiếu ảnh SBD.'},400,origin);
    if(!/^image\/(png|jpeg|jpg|webp)$/i.test(mimeType)) return json({ok:false,error:'Định dạng ảnh không hỗ trợ.'},400,origin);

    const key=Deno.env.get('GEMINI_API_KEY')||Deno.env.get('GEMINI_LIVE_API_KEY');
    if(!key) return json({ok:false,error:'Chưa cấu hình khóa Gemini.'},500,origin);

    const schema={
      type:'object',
      additionalProperties:false,
      required:['digits'],
      properties:{digits:{type:'string',pattern:'^[0-9]*$'}},
    };

    const call=await callGemini(key,{
      contents:[{
        role:'user',
        parts:[
          {text:'Đọc duy nhất dãy chữ số của số báo danh/số phách trong ảnh. Không suy đoán chữ. Nếu không đọc chắc được thì trả digits là chuỗi rỗng. Không giải thích.'},
          {inlineData:{mimeType:mimeType==='image/jpg'?'image/jpeg':mimeType,data:image}},
        ],
      }],
      generationConfig:{
        responseMimeType:'application/json',
        responseJsonSchema:schema,
        temperature:0,
        maxOutputTokens:40,
      },
    });

    const text=call.data?.candidates?.[0]?.content?.parts?.map((p:any)=>p.text||'').join('')||'';
    let parsed:any={};
    try{parsed=JSON.parse(text)}catch{}
    const digits=String(parsed?.digits||'').replace(/\D/g,'');
    if(!digits) return json({ok:false,error:'AI chưa đọc chắc được số trong ảnh.',model:call.model},422,origin);

    return json({ok:true,digits:String(Number(digits)),model:call.model},200,origin);
  }catch(err){
    console.error('recognize-sbd-image',err);
    return json({ok:false,error:err instanceof Error?err.message:'Không thể nhận dạng SBD.'},500,origin);
  }
});
