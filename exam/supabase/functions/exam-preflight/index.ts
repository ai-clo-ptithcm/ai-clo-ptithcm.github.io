import { createClient } from "jsr:@supabase/supabase-js@2.116.0";

const URL=Deno.env.get('SUPABASE_URL')!;
const SERVICE=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const db=createClient(URL,SERVICE,{auth:{persistSession:false,autoRefreshToken:false}});
const ORIGINS=new Set(['https://ai-clo-ptithcm.github.io','https://apmaths.github.io']);

function cors(req:Request){const o=req.headers.get('origin')||'';const ok=ORIGINS.has(o)||o.startsWith('http://localhost:')||o.startsWith('http://127.0.0.1:');return {'Access-Control-Allow-Origin':ok?o:'https://ai-clo-ptithcm.github.io','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS','Content-Type':'application/json; charset=utf-8','Vary':'Origin'};}
function out(req:Request,b:any,s=200){return new Response(JSON.stringify(b),{status:s,headers:cors(req)});}
function issue(level:string,code:string,message:string,scope:any={}){return {level,code,message,...scope};}
async function actor(req:Request){const jwt=(req.headers.get('authorization')||'').replace(/^Bearer\s+/i,'');if(!jwt)throw Object.assign(new Error('Chưa đăng nhập.'),{status:401});const u=await db.auth.getUser(jwt);if(u.error||!u.data.user)throw Object.assign(new Error('Phiên đăng nhập không hợp lệ.'),{status:401});const p=await db.from('profiles').select('*').eq('id',u.data.user.id).maybeSingle();if(p.error)throw p.error;if(!p.data?.active)throw Object.assign(new Error('Tài khoản chưa được kích hoạt.'),{status:403});return {user:u.data.user,profile:p.data};}
async function canExam(a:any,examId:string){if(a.profile.system_role==='admin')return true;const m=await db.from('exam_members').select('exam_role,permissions').eq('exam_id',examId).eq('user_id',a.user.id).maybeSingle();if(m.error)throw m.error;return !!m.data&&(m.data.exam_role==='owner'||(m.data.permissions||[]).some((x:string)=>['manage_exam','manage_sessions','manage_paper'].includes(x)));}

async function runPreflight(examId:string,allowDraftPapers=false){
  const issues:any[]=[];
  const ex=await db.from('exams').select('*').eq('id',examId).single();if(ex.error)throw ex.error;const exam=ex.data;
  const allowDraft=allowDraftPapers||exam.status==='draft';
  const sres=await db.from('exam_sessions').select('*').eq('exam_id',examId).order('starts_at');if(sres.error)throw sres.error;const sessions=sres.data||[];
  if(!sessions.length)issues.push(issue('error','NO_SESSION','Kỳ thi chưa có ca thi.'));
  const sessionIds=sessions.map(x=>x.id);
  const [roomsR,studentsR,papersR,membersR,assetsR]=await Promise.all([
    sessionIds.length?db.from('exam_rooms').select('*').in('session_id',sessionIds):Promise.resolve({data:[],error:null} as any),
    db.from('exam_students').select('*').eq('exam_id',examId).eq('active',true),
    sessionIds.length?db.from('exam_papers').select('*').in('session_id',sessionIds):Promise.resolve({data:[],error:null} as any),
    db.from('exam_members').select('*').eq('exam_id',examId),
    db.from('exam_assets').select('*').eq('exam_id',examId).is('deleted_at',null)
  ]);for(const r of [roomsR,studentsR,papersR,membersR,assetsR])if(r.error)throw r.error;
  const rooms=roomsR.data||[],students=studentsR.data||[],papers=papersR.data||[];
  if(!students.length)issues.push(issue('error','NO_STUDENTS','Chưa có sinh viên dự thi.'));
  const studentIds=students.map(x=>x.id);
  const codesR=studentIds.length?await db.from('exam_student_codes').select('exam_student_id').in('exam_student_id',studentIds):{data:[],error:null} as any;if(codesR.error)throw codesR.error;const codeSet=new Set((codesR.data||[]).map((x:any)=>x.exam_student_id));
  const missingCodes=students.filter(x=>!codeSet.has(x.id));if(missingCodes.length)issues.push(issue('error','MISSING_CODES',`${missingCodes.length} sinh viên chưa có mã thi.`));
  const roomStaffR=rooms.length?await db.from('exam_room_staff').select('*').in('room_id',rooms.map(x=>x.id)):{data:[],error:null} as any;if(roomStaffR.error)throw roomStaffR.error;const roomStaff=roomStaffR.data||[];
  let totalQuestions=0,totalPoints=0;
  const sessionReport:any[]=[];
  for(const session of sessions){
    const sr=rooms.filter(x=>x.session_id===session.id),ss=students.filter(x=>x.session_id===session.id),paper=papers.find(x=>x.session_id===session.id);
    if(!sr.length)issues.push(issue('error','NO_ROOM',`${session.name}: chưa có phòng thi.`,{sessionId:session.id}));
    if(!ss.length)issues.push(issue('warning','NO_STUDENTS_SESSION',`${session.name}: chưa có sinh viên.`,{sessionId:session.id}));
    if(new Date(session.ends_at)<=new Date(session.starts_at))issues.push(issue('error','INVALID_TIME',`${session.name}: giờ kết thúc phải sau giờ bắt đầu.`,{sessionId:session.id}));
    const windowMinutes=Math.round((Date.parse(session.ends_at)-Date.parse(session.starts_at))/60000);if(session.duration_minutes>windowMinutes)issues.push(issue('error','DURATION_EXCEEDS_WINDOW',`${session.name}: thời gian làm bài dài hơn cửa sổ ca thi.`,{sessionId:session.id}));
    for(const room of sr){const count=ss.filter(x=>x.room_id===room.id).length;if(room.capacity&&count>room.capacity)issues.push(issue('error','ROOM_OVER_CAPACITY',`${session.name} / ${room.name}: ${count} SV vượt sức chứa ${room.capacity}.`,{sessionId:session.id,roomId:room.id}));if(exam.exam_type==='final'&&!roomStaff.some(x=>x.room_id===room.id))issues.push(issue('warning','NO_PROCTOR',`${session.name} / ${room.name}: chưa gán giám thị phòng.`,{sessionId:session.id,roomId:room.id}));}
    if(!paper){issues.push(issue('error','NO_PAPER',`${session.name}: chưa có đề thi.`,{sessionId:session.id}));sessionReport.push({sessionId:session.id,name:session.name,rooms:sr.length,students:ss.length,questionCount:0,points:0,paperStatus:null});continue;}
    const acceptedStatuses=allowDraft?['draft','locked','hotfix']:['locked','hotfix'];
    const vr=await db.from('exam_paper_versions').select('*').eq('paper_id',paper.id).in('status',acceptedStatuses).order('version_no',{ascending:false}).limit(1).maybeSingle();if(vr.error)throw vr.error;const version=vr.data;
    if(!version){issues.push(issue('error','PAPER_NOT_LOCKED',`${session.name}: đề chưa có phiên bản hợp lệ để sử dụng.`,{sessionId:session.id,paperId:paper.id}));sessionReport.push({sessionId:session.id,name:session.name,rooms:sr.length,students:ss.length,questionCount:0,points:0,paperStatus:'draft'});continue;}
    const linksR=await db.from('paper_version_questions').select('*').eq('paper_version_id',version.id).order('order_no');if(linksR.error)throw linksR.error;const links=linksR.data||[];
    if(!links.length)issues.push(issue('error','NO_QUESTIONS',`${session.name}: đề không có câu hỏi.`,{sessionId:session.id,paperId:paper.id}));
    const qvIds=links.map(x=>x.question_version_id);const qvr=qvIds.length?await db.from('question_versions').select('*').in('id',qvIds):{data:[],error:null} as any;if(qvr.error)throw qvr.error;const qvs=qvr.data||[];let points=0;
    for(const qv of qvs){points+=Number(qv.points||0);const choices=Array.isArray(qv.choices)?qv.choices:[];const keys=choices.map((c:any)=>String(c.key));if(!qv.body_html?.trim())issues.push(issue('error','EMPTY_QUESTION','Có câu hỏi trống nội dung.',{sessionId:session.id,questionVersionId:qv.id}));if(choices.length<2)issues.push(issue('error','TOO_FEW_CHOICES','Có câu hỏi dưới 2 lựa chọn.',{sessionId:session.id,questionVersionId:qv.id}));if(paper.structure_mode==='generic'&&choices.length!==4)issues.push(issue('warning','NON_STANDARD_CHOICES','Đề thường có câu không đủ 4 lựa chọn.',{sessionId:session.id,questionVersionId:qv.id}));if(!keys.includes(String(qv.correct_key)))issues.push(issue('error','BAD_CORRECT_KEY','Đáp án đúng không khớp các lựa chọn.',{sessionId:session.id,questionVersionId:qv.id}));if(Number(qv.points||0)<=0)issues.push(issue('warning','ZERO_POINTS','Có câu có điểm bằng 0.',{sessionId:session.id,questionVersionId:qv.id}));}
    totalQuestions+=links.length;totalPoints+=points;sessionReport.push({sessionId:session.id,name:session.name,rooms:sr.length,students:ss.length,questionCount:links.length,points,paperStatus:version.status,paperVersion:version.version_no});
  }
  const assetIds=new Set<string>();
  const scan=(m:any)=>{const ids=Array.isArray(m?.asset_ids)?m.asset_ids:[];ids.forEach((id:any)=>assetIds.add(String(id)));};
  if(papers.length){const pids=papers.map(x=>x.id);const gr=await db.from('question_groups').select('id').in('paper_id',pids);if(gr.error)throw gr.error;const gids=(gr.data||[]).map(x=>x.id);if(gids.length){const gvr=await db.from('question_group_versions').select('metadata').in('group_id',gids);if(gvr.error)throw gvr.error;(gvr.data||[]).forEach(x=>scan(x.metadata));}const qr=await db.from('questions').select('id').in('paper_id',pids);if(qr.error)throw qr.error;const qids=(qr.data||[]).map(x=>x.id);if(qids.length){const qvr=await db.from('question_versions').select('metadata').in('question_id',qids);if(qvr.error)throw qvr.error;(qvr.data||[]).forEach(x=>scan(x.metadata));}}
  const assetMap=new Map((assetsR.data||[]).map((x:any)=>[x.id,x]));const missingAssets=[...assetIds].filter(id=>!assetMap.has(id));if(missingAssets.length)issues.push(issue('error','MISSING_ASSETS',`${missingAssets.length} ảnh/audio được đề tham chiếu nhưng không còn trong hồ sơ asset.`));
  let storageOk=true;try{const ls=await db.storage.from('exam-files').list('exams',{limit:1});if(ls.error)throw ls.error;}catch{storageOk=false;issues.push(issue('error','STORAGE_UNAVAILABLE','Không truy cập được Storage exam-files.'));}
  const errors=issues.filter(x=>x.level==='error').length,warnings=issues.filter(x=>x.level==='warning').length;
  return {exam:{id:exam.id,name:exam.name,type:exam.exam_type,status:exam.status},ready:errors===0,summary:{sessions:sessions.length,rooms:rooms.length,students:students.length,questions:totalQuestions,totalPoints,assets:(assetsR.data||[]).length,errors,warnings},health:{database:true,storage:storageOk,edgeFunction:true,serverTime:new Date().toISOString()},sessions:sessionReport,issues};
}

Deno.serve(async req=>{if(req.method==='OPTIONS')return new Response('ok',{headers:cors(req)});if(req.method!=='POST')return out(req,{error:'Method not allowed'},405);try{const b=await req.json().catch(()=>({})),examId=String(b.examId||'');if(!examId)return out(req,{error:'Thiếu examId.'},400);const a=await actor(req);if(!await canExam(a,examId))return out(req,{error:'Bạn không có quyền kiểm tra kỳ thi này.'},403);return out(req,await runPreflight(examId,!!b.allowDraftPapers));}catch(e){console.error(e);const s=Number((e as any)?.status||500);return out(req,{error:s>=500?'Máy chủ đang gặp lỗi.':String((e as any)?.message||'Có lỗi xảy ra.')},s);}});
