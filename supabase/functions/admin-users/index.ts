import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors={
 'Access-Control-Allow-Origin':'*',
 'Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type',
 'Access-Control-Allow-Methods':'POST, OPTIONS'
}
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,'Content-Type':'application/json'}})

Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers:cors})
 try{
  const url=Deno.env.get('SUPABASE_URL')!,anon=Deno.env.get('SUPABASE_ANON_KEY')!,service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const token=(req.headers.get('Authorization')||'').replace('Bearer ','')
  const caller=createClient(url,anon,{global:{headers:{Authorization:`Bearer ${token}`}}})
  const {data:{user},error:userError}=await caller.auth.getUser()
  if(userError||!user)return json({success:false,error:'Chưa đăng nhập'},401)
  const {data:profile}=await caller.from('profiles').select('role').eq('id',user.id).single()
  if(profile?.role!=='admin')return json({success:false,error:'Chỉ Admin được thực hiện'},403)
  const admin=createClient(url,service,{auth:{autoRefreshToken:false,persistSession:false}})
  const body=await req.json(),action=body.action
  if(action==='create'){
   if(!body.email||!body.password||!body.full_name)return json({success:false,error:'Thiếu thông tin bắt buộc'},400)
   const role=['admin','teacher','student'].includes(body.role)?body.role:'student'
   const {data,error}=await admin.auth.admin.createUser({email:String(body.email).trim().toLowerCase(),password:String(body.password),email_confirm:true,user_metadata:{full_name:body.full_name,role,mssv:body.mssv||null}})
   if(error)throw error
   const uid=data.user.id
   const {error:profileError}=await admin.from('profiles').upsert({id:uid,email:String(body.email).trim().toLowerCase(),full_name:body.full_name,role,mssv:body.mssv||null,is_active:true})
   if(profileError){await admin.auth.admin.deleteUser(uid);throw profileError}
   if(body.subject_id){const memberRole=role==='student'?'student':'teacher';const {error:memberError}=await admin.from('subject_members').insert({subject_id:body.subject_id,user_id:uid,role:memberRole});if(memberError)throw memberError}
   return json({success:true,user_id:uid})
  }
  if(action==='set_active'){
   if(body.user_id===user.id)return json({success:false,error:'Không thể khóa chính tài khoản đang dùng'},400)
   const active=Boolean(body.is_active)
   const {error}=await admin.from('profiles').update({is_active:active}).eq('id',body.user_id);if(error)throw error
   const {error:authError}=await admin.auth.admin.updateUserById(body.user_id,{ban_duration:active?'none':'876000h'});if(authError)throw authError
   return json({success:true})
  }
  if(action==='delete'){
   if(body.user_id===user.id)return json({success:false,error:'Không thể xóa chính tài khoản đang dùng'},400)
   await admin.from('subject_members').delete().eq('user_id',body.user_id)
   const {error}=await admin.auth.admin.deleteUser(body.user_id);if(error)throw error
   return json({success:true})
  }
  return json({success:false,error:'Thao tác không hợp lệ'},400)
 }catch(e){return json({success:false,error:e instanceof Error?e.message:'Có lỗi xảy ra'},400)}
})
