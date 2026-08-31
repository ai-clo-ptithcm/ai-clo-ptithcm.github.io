import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type"};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,"Content-Type":"application/json"}});
const clean=(s:string)=>s.replace(/^```json\s*/i,"").replace(/```$/i,"").trim();

Deno.serve(async req=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
 let admin:any=null,batchId:string|null=null;
 try{
  const auth=req.headers.get("Authorization")||"",url=Deno.env.get("SUPABASE_URL")!,anon=Deno.env.get("SUPABASE_ANON_KEY")!,service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,key=Deno.env.get("GEMINI_API_KEY"),model=Deno.env.get("GEMINI_MODEL")||"gemini-3.7-flash";
  if(!key)return json({success:false,error:"Chưa cấu hình GEMINI_API_KEY trong Supabase Edge Function Secrets."});
  const client=createClient(url,anon,{global:{headers:{Authorization:auth}}});admin=createClient(url,service);
  const {data:ud,error:ue}=await client.auth.getUser();if(ue||!ud.user)return json({success:false,error:"Phiên đăng nhập không hợp lệ. Hãy đăng nhập lại."});
  const userId=ud.user.id,body=await req.json(),subjectId=body.subject_id,chapterId=body.chapter_id,topicId=body.topic_id||null,cloId=body.clo_id,count=Math.max(1,Math.min(20,Number(body.count)||10));
  if(!subjectId||!chapterId||!cloId)return json({success:false,error:"Thiếu học phần, chương hoặc CLO."});
  const [{data:profile},{data:member},{data:subject},{data:chapter},{data:topic},{data:clo}]=await Promise.all([admin.from("profiles").select("role").eq("id",userId).maybeSingle(),admin.from("subject_members").select("role").eq("subject_id",subjectId).eq("user_id",userId).maybeSingle(),admin.from("subjects").select("name").eq("id",subjectId).maybeSingle(),admin.from("chapters").select("name").eq("id",chapterId).maybeSingle(),topicId?admin.from("topics").select("name").eq("id",topicId).maybeSingle():Promise.resolve({data:null}),admin.from("clos").select("code,description").eq("id",cloId).maybeSingle()]);
  const allowed=profile?.role==="admin"||["teacher","lecturer","giangvien"].includes(profile?.role||"")||["teacher","lecturer","giangvien"].includes(member?.role||"");if(!allowed)return json({success:false,error:"Chỉ Admin hoặc giảng viên được tạo câu hỏi Gemini."});
  if(!chapter||!clo)return json({success:false,error:"Không tìm thấy Chương hoặc CLO đã chọn."});
  const {data:batch,error:be}=await admin.from("ai_generation_batches").insert({subject_id:subjectId,chapter_id:chapterId,topic_id:topicId,clo_id:cloId,requested_count:count,generated_count:0,created_by:userId}).select().single();if(be)throw be;batchId=batch.id;
  const prompt=`Bạn là giảng viên đại học, hãy tạo ${count} câu hỏi trắc nghiệm bốn lựa chọn A, B, C, D bằng tiếng Việt cho học phần ${subject?.name||""}.\nChương: ${chapter.name}.\nChủ đề: ${topic?.name||"Toàn chương"}.\nChuẩn đầu ra ${clo.code}: ${clo.description||""}.\nYêu cầu bổ sung: ${body.additional_requirements||"Không có"}.\nMỗi câu chỉ có đúng một đáp án. Công thức toán viết bằng LaTeX đặt trong dấu $. Không lặp câu, không đánh số ở đầu nội dung. Trả về duy nhất JSON: {"questions":[{"content":"...","options":{"A":"...","B":"...","C":"...","D":"..."},"correct_answer":"A","explanation":"..."}]}.`;
  const gr=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({contents:[{role:"user",parts:[{text:prompt}]}],generationConfig:{responseMimeType:"application/json"}})}),gj=await gr.json();
  if(!gr.ok)throw new Error(`Gemini (${gr.status}): ${gj?.error?.message||"API trả về lỗi"}`);
  const raw=(gj?.candidates?.[0]?.content?.parts||[]).map((p:any)=>p.text||"").join("");let parsed:any;try{parsed=JSON.parse(clean(raw))}catch{throw new Error("Gemini trả về JSON không hợp lệ. Hãy thử lại.")}
  const questions=(Array.isArray(parsed)?parsed:parsed.questions||[]).slice(0,count).filter((q:any)=>q?.content&&q?.options&&["A","B","C","D"].includes(q.correct_answer));if(!questions.length)throw new Error("Gemini không tạo được câu hỏi hợp lệ.");
  const rows=questions.map((q:any,i:number)=>({batch_id:batchId,order_index:i+1,topic_id:topicId,content:String(q.content),options:{A:String(q.options.A||""),B:String(q.options.B||""),C:String(q.options.C||""),D:String(q.options.D||"")},correct_answer:q.correct_answer,explanation:String(q.explanation||""),review_status:"pending"}));
  const {error:de}=await admin.from("ai_question_drafts").insert(rows);if(de)throw de;
  await admin.from("ai_generation_batches").update({generated_count:rows.length,updated_at:new Date().toISOString()}).eq("id",batchId);
  return json({success:true,batch_id:batchId,total:rows.length,model});
 }catch(e){console.error(e);if(admin&&batchId)await admin.from("ai_generation_batches").update({status:"failed",updated_at:new Date().toISOString()}).eq("id",batchId);return json({success:false,error:e instanceof Error?e.message:"Lỗi không xác định khi tạo câu hỏi."})}
});
