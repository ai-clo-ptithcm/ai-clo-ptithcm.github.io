import { createClient } from "jsr:@supabase/supabase-js@2.116.0";

const URL=Deno.env.get('SUPABASE_URL')!;
const SERVICE=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANON=Deno.env.get('SUPABASE_ANON_KEY')!;
const adminDb=createClient(URL,SERVICE,{auth:{persistSession:false,autoRefreshToken:false}});
const ORIGINS=new Set(['https://ai-clo-ptithcm.github.io','https://apmaths.github.io']);
const NEXT:Record<string,string[]>={draft:['ready'],ready:['draft','live'],live:['closed'],closed:['archived'],archived:[]};

function cors(req:Request){const o=req.headers.get('origin')||'';const ok=ORIGINS.has(o)||o.startsWith('http://localhost:')||o.startsWith('http://127.0.0.1:');return {'Access-Control-Allow-Origin':ok?o:'https://ai-clo-ptithcm.github.io','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS','Content-Type':'application/json; charset=utf-8','Vary':'Origin'};}
function out(req:Request,body:any,status=200){return new Response(JSON.stringify(body),{status,headers:cors(req)});}
async function requireManager(req:Request,examId:string){const jwt=(req.headers.get('authorization')||'').replace(/^Bearer\s+/i,'');if(!jwt)throw Object.assign(new Error('Chưa đăng nhập.'),{status:401});const u=await adminDb.auth.getUser(jwt);if(u.error||!u.data.user)throw Object.assign(new Error('Phiên đăng nhập không hợp lệ.'),{status:401});const p=await adminDb.from('profiles').select('system_role,active').eq('id',u.data.user.id).maybeSingle();if(p.error)throw p.error;if(!p.data?.active)throw Object.assign(new Error('Tài khoản chưa được kích hoạt.'),{status:403});if(p.data.system_role==='admin')return {user:u.data.user,jwt};const m=await adminDb.from('exam_members').select('exam_role,permissions').eq('exam_id',examId).eq('user_id',u.data.user.id).maybeSingle();if(m.error)throw m.error;if(!m.data||(m.data.exam_role!=='owner'&&!(m.data.permissions||[]).includes('manage_exam')))throw Object.assign(new Error('Bạn không có quyền đổi trạng thái kỳ thi.'),{status:403});return {user:u.data.user,jwt};}
async function fullPreflight(jwt:string,examId:string,allowDraftPapers=false){const r=await fetch(`${URL}/functions/v1/exam-preflight`,{method:'POST',headers:{Authorization:`Bearer ${jwt}`,apikey:ANON,'Content-Type':'application/json'},body:JSON.stringify({examId,allowDraftPapers})});const body=await r.json().catch(()=>({}));if(!r.ok)throw new Error(body.error||'Không chạy được preflight.');return body;}
async function attemptsForExam(examId:string){const s=await adminDb.from('exam_sessions').select('id').eq('exam_id',examId);if(s.error)throw s.error;const ids=(s.data||[]).map(x=>x.id);if(!ids.length)return {sessionIds:ids,attempts:[]};const a=await adminDb.from('exam_attempts').select('id,status').in('session_id',ids);if(a.error)throw a.error;return {sessionIds:ids,attempts:a.data||[]};}
async function latestPaperVersions(sessionIds:string[]){if(!sessionIds.length)return [];const p=await adminDb.from('exam_papers').select('id').in('session_id',sessionIds);if(p.error)throw p.error;const out:any[]=[];for(const paper of p.data||[]){const v=await adminDb.from('exam_paper_versions').select('id,paper_id,status,version_no').eq('paper_id',paper.id).order('version_no',{ascending:false}).limit(1).maybeSingle();if(v.error)throw v.error;if(v.data)out.push(v.data);}return out;}
async function lockDraftPapers(sessionIds:string[]){const versions=await latestPaperVersions(sessionIds),ids=versions.filter(v=>v.status==='draft').map(v=>v.id);if(ids.length){const u=await adminDb.from('exam_paper_versions').update({status:'locked'}).in('id',ids);if(u.error)throw u.error;}return ids;}
async function reopenLatestPapers(sessionIds:string[]){const versions=await latestPaperVersions(sessionIds),ids=versions.filter(v=>['locked','hotfix'].includes(v.status)).map(v=>v.id);if(ids.length){const u=await adminDb.from('exam_paper_versions').update({status:'draft'}).in('id',ids);if(u.error)throw u.error;}return ids;}

async function setStatus(req:Request,b:any){
  const examId=String(b.examId||''),target=String(b.status||'');const actor=await requireManager(req,examId);
  const er=await adminDb.from('exams').select('*').eq('id',examId).single();if(er.error)throw er.error;const exam=er.data,current=String(exam.status);
  if(current===target)return out(req,{ok:true,exam});
  if(!NEXT[current]?.includes(target))return out(req,{error:`Không thể chuyển trực tiếp từ ${current} sang ${target}.`},409);
  const runtime=await attemptsForExam(examId);
  let lockedForFinalize:string[]=[];

  if(target==='ready'){
    const draftReport=await fullPreflight(actor.jwt,examId,true);
    if(!draftReport.ready)return out(req,{error:'Kỳ thi chưa đạt kiểm tra trước khi chốt.',readinessErrors:(draftReport.issues||[]).filter((x:any)=>x.level==='error').map((x:any)=>x.message)},409);
    lockedForFinalize=await lockDraftPapers(runtime.sessionIds);
    const lockedReport=await fullPreflight(actor.jwt,examId,false);
    if(!lockedReport.ready){if(lockedForFinalize.length)await adminDb.from('exam_paper_versions').update({status:'draft'}).in('id',lockedForFinalize);return out(req,{error:'Không thể chốt đề sau khi khóa.',readinessErrors:(lockedReport.issues||[]).filter((x:any)=>x.level==='error').map((x:any)=>x.message)},409);}
  }
  if(target==='live'){
    const report=await fullPreflight(actor.jwt,examId,false);
    if(!report.ready)return out(req,{error:'Kỳ thi chưa đạt preflight.',readinessErrors:(report.issues||[]).filter((x:any)=>x.level==='error').map((x:any)=>x.message)},409);
  }
  if(target==='draft'){
    const started=runtime.attempts.filter((x:any)=>x.status!=='ready');
    if(started.length)return out(req,{error:'Đã có sinh viên bắt đầu hoặc phát sinh bài thi; không thể mở lại chỉnh sửa.'},409);
    const readyIds=runtime.attempts.filter((x:any)=>x.status==='ready').map((x:any)=>x.id);
    if(readyIds.length){const del=await adminDb.from('exam_attempts').delete().in('id',readyIds);if(del.error)throw del.error;}
  }
  if(target==='closed'){
    const active=runtime.attempts.filter((x:any)=>['in_progress','locked'].includes(x.status));if(active.length)return out(req,{error:`Còn ${active.length} bài đang làm/bị khóa. Hãy xử lý trước khi đóng kỳ thi.`},409);
    const ready=runtime.attempts.filter((x:any)=>x.status==='ready').map((x:any)=>x.id);if(ready.length){const e=await adminDb.from('exam_attempts').update({status:'expired'}).in('id',ready);if(e.error)throw e.error;const r=await adminDb.from('attempt_sessions').update({revoked_at:new Date().toISOString()}).in('attempt_id',ready).is('revoked_at',null);if(r.error)throw r.error;}
  }

  const patch:any={status:target};
  if(target==='closed'&&!exam.retention_until)patch.retention_until=new Date(Date.now()+Number(exam.retention_days||30)*86400000).toISOString();
  if(['draft','ready','live'].includes(target))patch.retention_until=null;
  const up=await adminDb.from('exams').update(patch).eq('id',examId).select().single();
  if(up.error){if(lockedForFinalize.length)await adminDb.from('exam_paper_versions').update({status:'draft'}).in('id',lockedForFinalize);throw up.error;}
  if(target==='draft')await reopenLatestPapers(runtime.sessionIds);
  if(runtime.sessionIds.length){const s=await adminDb.from('exam_sessions').update({status:target==='archived'?'closed':target}).in('id',runtime.sessionIds);if(s.error)throw s.error;}
  await adminDb.from('audit_logs').insert({actor_user_id:actor.user.id,exam_id:examId,action:'exam_status_changed',entity_type:'exam',entity_id:examId,payload:{from:current,to:target,auto_locked_papers:lockedForFinalize.length}});
  return out(req,{ok:true,exam:up.data});
}

Deno.serve(async req=>{if(req.method==='OPTIONS')return new Response('ok',{headers:cors(req)});if(req.method!=='POST')return out(req,{error:'Method not allowed'},405);try{const b=await req.json().catch(()=>({}));if(b.action==='set-status')return setStatus(req,b);return out(req,{error:'Action không hợp lệ.'},400);}catch(e){console.error(e);const status=Number((e as any)?.status||500);return out(req,{error:status>=500?'Máy chủ đang gặp lỗi.':String((e as any)?.message||'Có lỗi xảy ra.')},status);}});
