import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "npm:@supabase/server@^1";
// V10.2: Gemini fallback self-contained for Supabase Dashboard deployment
type GeminiAttempt = { model: string; status: number; message?: string };

const DEFAULT_MODELS = [
  "gemini-3.7-flash",
  "gemini-3.6-flash",
  "gemini-3.5-flash",
  "gemini-3.5-flash-lite",
];

function configuredModels() {
  const raw = Deno.env.get("GEMINI_MODELS") || Deno.env.get("GEMINI_MODEL") || "";
  const configured = raw.split(",").map(x => x.trim()).filter(Boolean);
  return [...new Set([...configured, ...DEFAULT_MODELS])];
}

function retryable(status: number, message: string) {
  return status === 404 || status === 408 || status === 429 || status >= 500 ||
    /quota|rate limit|resource exhausted|not found|unavailable|overloaded|temporar/i.test(message);
}

async function callGemini(
  apiKey: string,
  body: unknown,
): Promise<{ data: any; model: string; attempts: GeminiAttempt[] }> {
  const attempts: GeminiAttempt[] = [];
  let lastMessage = "Gemini không thể xử lý yêu cầu.";

  for (const model of configuredModels()) {
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": apiKey,
          },
          body: JSON.stringify(body),
        },
      );
      const data = await response.json().catch(() => ({}));
      const message = data?.error?.message || `Gemini API HTTP ${response.status}`;
      attempts.push({ model, status: response.status, message: response.ok ? undefined : message });
      if (response.ok) return { data, model, attempts };
      lastMessage = message;
      if (!retryable(response.status, message)) break;
    } catch (error) {
      lastMessage = error instanceof Error ? error.message : String(error);
      attempts.push({ model, status: 0, message: lastMessage });
    }
  }

  throw new Error(`${lastMessage} (đã thử: ${attempts.map(x => x.model).join(" → ")})`);
}


const fail=(error:string,status=400)=>Response.json({success:false,error},{status});
const schema={type:"object",additionalProperties:false,required:["content","option_a","option_b","option_c","option_d","correct_answer","explanation"],properties:{content:{type:"string"},option_a:{type:"string"},option_b:{type:"string"},option_c:{type:"string"},option_d:{type:"string"},correct_answer:{type:"string",enum:["A","B","C","D"]},explanation:{type:"string"}}};

export default {fetch:withSupabase({auth:"user"},async(req,ctx)=>{
 try{
  if(req.method!=="POST") return fail("Chỉ hỗ trợ POST.",405);
  const b=await req.json();
  const {subject_id,chapter_id,topic_id,clo_id}=b;
  if(!subject_id||!chapter_id||!topic_id||!clo_id)return fail("Thiếu Chương, Mục hoặc CLO.");
  const uid=ctx.userClaims?.sub||ctx.userClaims?.id;if(!uid)return fail("Phiên đăng nhập không hợp lệ.",401);
  const {data:profile}=await ctx.supabase.from("profiles").select("role").eq("id",uid).maybeSingle();
  if(profile?.role!=="admin"){
   const {data:member}=await ctx.supabase.from("subject_members").select("role").eq("subject_id",subject_id).eq("user_id",uid).in("role",["teacher","lecturer","giangvien"]).maybeSingle();
   if(!member)return fail("Bạn không có quyền tạo câu hỏi cho học phần này.",403);
  }
  const [sr,cr,tr,lr]=await Promise.all([
   ctx.supabase.from("subjects").select("name").eq("id",subject_id).single(),
   ctx.supabase.from("chapters").select("name").eq("id",chapter_id).eq("subject_id",subject_id).single(),
   ctx.supabase.from("topics").select("name").eq("id",topic_id).eq("chapter_id",chapter_id).single(),
   ctx.supabase.from("clos").select("code,description").eq("id",clo_id).eq("subject_id",subject_id).single()
  ]);
  if(sr.error||cr.error||tr.error||lr.error)return fail("Chương, Mục hoặc CLO không hợp lệ.");
  const prompt=`Bạn hỗ trợ giảng viên đại học tạo MỘT câu trắc nghiệm 4 lựa chọn.\nHọc phần: ${sr.data.name}\nChương: ${cr.data.name}\nMục/chủ đề: ${tr.data.name}\nCLO: ${lr.data.code}\nMô tả CLO: ${lr.data.description}\n\nYêu cầu: đúng phạm vi trên; đúng một đáp án; 4 phương án A-D; nhiễu hợp lý; công thức toán dùng LaTeX $...$; có lời giải ngắn; không nhắc AI. ${String(b.additional_requirements||"")}`;
  const key=Deno.env.get("GEMINI_API_KEY");if(!key)return fail("Chưa cấu hình GEMINI_API_KEY.",500);
  const call=await callGemini(key,{contents:[{role:"user",parts:[{text:prompt}]}],generationConfig:{responseMimeType:"application/json",responseJsonSchema:schema}});
  const text=call.data?.candidates?.[0]?.content?.parts?.map((p:any)=>p.text||"").join("")||"";
  const x=JSON.parse(text);
  return Response.json({success:true,model:call.model,question:{content:x.content,options:{A:x.option_a,B:x.option_b,C:x.option_c,D:x.option_d},correct_answer:x.correct_answer,explanation:x.explanation,chapter_id,topic_id,clo_id}});
 }catch(e){console.error(e);return fail(e instanceof Error?e.message:"Không thể sinh câu hỏi.",500)}
})};
