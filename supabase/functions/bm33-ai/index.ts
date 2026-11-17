// AI BM33: input accepts only anonymous aggregate statistics.
// Deploy self-contained with verify_jwt=true and Supabase GEMINI_API_KEY secret.
const allowed=new Set(['https://ai-clo-ptithcm.github.io','https://apmaths.github.io','https://apmaths.io.vn','https://www.apmaths.io.vn']);
const url=Deno.env.get('SUPABASE_URL')||'',anon=Deno.env.get('SUPABASE_ANON_KEY')||'',service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'';
const calls=new Map<string,number[]>();
function headers(origin:string|null){return {'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','Vary':'Origin','Access-Control-Allow-Origin':origin&&allowed.has(origin)?origin:'https://ai-clo-ptithcm.github.io','Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info','Access-Control-Allow-Methods':'POST, OPTIONS'}}
function json(value:unknown,status=200,origin:string|null=null){return new Response(JSON.stringify(value),{status,headers:headers(origin)})}
function n(v:unknown,lo=0,hi=1){return typeof v==='number'&&Number.isFinite(v)&&v>=lo&&v<=hi}
function short(v:unknown,len=100){return String(v??'').replace(/[\u0000-\u001f]/g,' ').slice(0,len)}
function sanitize(s:any){
  if(!s||typeof s!=='object'||!Number.isInteger(s.total_students)||s.total_students<1||s.total_students>10000||!n(s.average,0,10)||!n(s.pass_rate)||!n(s.pass_score,0,10)||!n(s.required_clo_attainment_percent,0,100)||!Array.isArray(s.bands)||s.bands.length!==6)return null;
  return {
    count:s.total_students,average:s.average,pass_rate:s.pass_rate,pass_score:s.pass_score,
    target:s.required_clo_attainment_percent, highest:n(s.highest,0,10)?s.highest:null,
    lowest:n(s.lowest,0,10)?s.lowest:null,
    bands:s.bands.map((x:any)=>({band:short(x.label,25),count:Number.isInteger(x.count)?Math.max(0,Math.min(x.count,s.total_students)):0})),
    clos:(Array.isArray(s.clos)?s.clos:[]).slice(0,10).map((x:any)=>({label:short(x.label,20),count:Number(x.count)||0,avg:n(x.avg,0,10)?x.avg:null,pass_rate:n(x.pass_rate)?x.pass_rate:null})),
    question_summary:(Array.isArray(s.question_summary)?s.question_summary:[]).slice(0,10).map((x:any)=>({clo:short(x.label,20),correct_rate:n(x.rate)?x.rate:null,discrimination:n(x.discrimination,-1,1)?x.discrimination:null,groups:Number(x.questionCount)||0})),
    hardest_items:(Array.isArray(s.hardest_items)?s.hardest_items:[]).slice(0,20).map((x:any)=>({code:short(x.code,20),question:Number(x.question)||0,clo:short(x.clo,20),responses:Number(x.responses)||0,rate:n(x.correct_rate)?x.correct_rate:null,discrimination:n(x.discrimination,-1,1)?x.discrimination:null}))
  };
}
async function teacherId(token:string){
  const userResponse=await fetch(url+'/auth/v1/user',{headers:{Authorization:'Bearer '+token,apikey:anon}});
  if(!userResponse.ok)return null;
  const user=await userResponse.json().catch(()=>null);
  if(!user?.id||!(/^[\w-]{30,50}$/).test(user.id))return null;
  const roles=await fetch(url+'/rest/v1/profiles?id=eq.'+encodeURIComponent(user.id)+'&select=role&limit=1',{headers:{Authorization:'Bearer '+service,apikey:service}});
  if(!roles.ok)return null;
  const data=await roles.json().catch(()=>[]);
  return ['admin','teacher','lecturer','giangvien'].includes(String(data?.[0]?.role||'').toLowerCase())?user.id:null;
}
Deno.serve(async(req:Request)=>{
  const origin=req.headers.get('origin');
  if(origin&&!allowed.has(origin))return json({success:false,error:'Nguồn truy cập không được phép.'},403,origin);
  if(req.method==='OPTIONS')return new Response(null,{status:204,headers:headers(origin)});
  if(req.method!=='POST')return json({success:false,error:'Chỉ hỗ trợ POST.'},405,origin);
  try{
    if(!url||!anon||!service)return json({success:false,error:'Máy chủ chưa được cấu hình.'},503,origin);
    const auth=req.headers.get('authorization')||'';
    if(!/^Bearer [\w.-]+$/i.test(auth))return json({success:false,error:'Cần đăng nhập tài khoản giảng viên.'},401,origin);
    const uid=await teacherId(auth.replace(/^Bearer /i,''));
    if(!uid)return json({success:false,error:'Chỉ giảng viên hoặc quản trị viên được phân tích BM33.'},403,origin);
    const body=await req.text();
    if(body.length>22000)return json({success:false,error:'Dữ liệu vượt giới hạn.'},413,origin);
    const request=JSON.parse(body),summary=sanitize(request.summary);
    if(!summary)return json({success:false,error:'Số liệu thống kê không hợp lệ.'},400,origin);
    const now=Date.now(),recent=(calls.get(uid)||[]).filter(t=>now-t<300000);
    if(recent.length>=5)return json({success:false,error:'Giới hạn 5 lượt AI trong 5 phút.'},429,origin);
    recent.push(now);calls.set(uid,recent);if(calls.size>200)calls.clear();
    const key=Deno.env.get('GEMINI_API_KEY')||Deno.env.get('GEMINI_LIVE_API_KEY');
    if(!key)return json({success:false,error:'Chưa cấu hình khóa Gemini.'},503,origin);
    const model=Deno.env.get('GEMINI_MODEL')||'gemini-3.5-flash-lite';
    const instruction=[
      'Phân tích BM33 đại học bằng tiếng Việt, chỉ căn cứ số liệu sau, không tự bịa dữ liệu, sự cố hay nội dung đề cương.',
      'CLO đạt khi tỷ lệ sinh viên đạt điểm CLO >= pass_score vượt ngưỡng target trong JSON.',
      'Độ phân hóa âm cần rà soát. Thiếu mẫu độ phân hóa thì phải nói không đủ mẫu.',
      'Không suy diễn các mã đề có câu hỏi số thứ tự giống nhau là cùng nội dung.',
      'Khi không có đề cương, trường alignment bắt buộc nói chưa đủ cơ sở kết luận mức độ phù hợp.',
      'Không viết tên sinh viên, SBD, đáp án, không đưa ra quyết định thay giảng viên.',
      'Nhận xét statistics cho mục 1 nêu đúng số bài, điểm trung bình, cao nhất/thấp nhất và tỷ lệ đạt; không suy diễn nguyên nhân.',
      'Nhận xét distribution cho mục 2.1 dựa chính xác trên 6 khoảng điểm (count từng khoảng), xác định nhóm đông nhất, tránh suy diễn phân phối chuẩn nếu chưa kiểm định.',
      'Trả về JSON object gồm các trường string statistics, distribution, difficulty, clo, alignment, coverage, bank, teaching, curriculum.',
      'Mỗi trường 1-3 câu có số liệu khi thích hợp, đánh giá khách quan, nêu đề xuất cải tiến.'
    ].join('\n');
    const context=short(request.context,2000);
    const gemini=await fetch('https://generativelanguage.googleapis.com/v1beta/models/'+encodeURIComponent(model)+':generateContent',{method:'POST',
      headers:{'Content-Type':'application/json','x-goog-api-key':key},
      body:JSON.stringify({systemInstruction:{parts:[{text:instruction}]},
        contents:[{role:'user',parts:[{text:JSON.stringify({summary,syllabus_context:context})}]}],
        generationConfig:{responseMimeType:'application/json',temperature:0.25,maxOutputTokens:1500}})});
    const result=await gemini.json().catch(()=>({}));
    if(!gemini.ok)return json({success:false,error:'Gemini hiện không khả dụng (HTTP '+gemini.status+').'},502,origin);
    const output=(result.candidates?.[0]?.content?.parts||[]).map((p:any)=>p.text||'').join('');
    const parsed=JSON.parse(output);
    const fields=['statistics','distribution','difficulty','clo','alignment','coverage','bank','teaching','curriculum'];
    const analysis=Object.fromEntries(fields.map(k=>[k,short(parsed[k],1600)]));
    if(!fields.some(k=>analysis[k]))throw new Error('AI trả về JSON rỗng.');
    return json({success:true,analysis,model},200,origin);
  }catch(e){
    console.error('BM33 AI',e instanceof Error?e.message:e);
    return json({success:false,error:'AI không thể phân tích lúc này; vẫn có thể xuất BM33 thủ công.'},500,origin);
  }
});
