/* AI-CLO PTITHCM V10.9 — role-aware dashboards, profiles and assessment navigation. */
(() => {
'use strict';
const V='10.9';
const teacherRoles=['teacher','lecturer','giangvien'];
const isTeacher=r=>teacherRoles.includes(r);
const roleLabel=r=>r==='admin'?'Quản trị viên':isTeacher(r)?'Giảng viên':'Sinh viên';
Object.assign(titles,{exams:['Đánh giá','Bài kiểm tra trực tuyến và đề thi cuối kỳ'],structure:['Chương · Chủ đề · CLO','Xây dựng nội dung và chuẩn đầu ra học phần']});
const fmt=v=>v?new Intl.DateTimeFormat('vi-VN',{timeZone:'Asia/Ho_Chi_Minh',dateStyle:'short',timeStyle:'short'}).format(new Date(v)):'—';
const safe=async(fn,fallback=[])=>{try{return await fn()}catch{return fallback}};
const count=async(table,build=x=>x)=>{try{const {count,error}=await build(db.from(table).select('id',{count:'exact',head:true}));if(error)throw error;return count||0}catch{return 0}};

function navItems(){
 if(state.space==='system')return [
  ['dashboard','⌂','Tổng quan',true],['subjects','▣',role()==='admin'?'Quản lý học phần':isTeacher(role())?'Học phần phụ trách':'Học phần đang học',true],
  ['activity','≡','Nhật ký hoạt động',role()==='admin'],['users','♙','Quản lý người dùng',role()==='admin']
 ];
 return [
  ['dashboard','⌂','Tổng quan học phần',true],['structure','⌘','Chương · Chủ đề · CLO',true],
  ['questions','?','Ngân hàng câu hỏi',canTeach()],['exams','✎',canTeach()?'Đánh giá':'Bài kiểm tra trực tuyến',true],
  ['results','◫','Kết quả CLO',true],['users','♙','Danh sách lớp',canTeach()]
 ];
}

const priorRefresh=window.v95RefreshShell;
window.v95RefreshShell=function(){
 priorRefresh?.();
 const nav=$('#nav');if(!nav)return;
 nav.innerHTML=navItems().filter(x=>x[3]).map(([view,icon,label])=>`<button data-view="${view}" class="${state.view===view?'active':''}"><span class="nav-icon">${icon}</span><span>${esc(label)}</span></button>`).join('');
 const home=$('#systemHomeBtn');if(home){home.innerHTML='<span>⌂</span><b>Hệ thống</b>';home.title='Về tổng quan hệ thống';home.setAttribute('aria-label','Về tổng quan hệ thống')}
 const pick=$('.subject-pick');pick?.classList.toggle('hidden',state.space!=='course');
};

function roleCourseIds(){
 return safe(async()=>{const rows=await q('subject_members','subject_id,user_id',x=>x.eq('user_id',state.user.id));return new Set(rows.map(x=>x.subject_id))},new Set());
}
function stat(k,v,note=''){return `<article class="v109-stat"><small>${esc(k)}</small><b>${esc(v)}</b>${note?`<span>${esc(note)}</span>`:''}</article>`}
function courseCards(list){return list.map(s=>`<article class="v109-course"><div><small>${esc(s.semester||'')} · ${esc(s.academic_year||'')}</small><h4>${esc(s.name)}</h4></div><button class="primary" data-v109-course="${s.id}">Vào học phần →</button></article>`).join('')||'<div class="empty"><b>Chưa có học phần</b><span>Chưa có học phần được phân công.</span></div>'}
function bindCourseCards(root){$$('[data-v109-course]',root).forEach(b=>b.onclick=()=>window.v95EnterCourse?.(b.dataset.v109Course))}

async function systemDashboard(c){
 const r=role(),ids=await roleCourseIds();
 const visible=r==='admin'?state.subjects:state.subjects.filter(s=>ids.has(s.id));
 const unread=await count('notifications',x=>x.eq('user_id',state.user.id).is('read_at',null));
 let cards=[],intro='',action='';
 if(r==='admin'){
  const profiles=await safe(()=>q('profiles','id,role,is_active'),[]);
  cards=[['Học phần',state.subjects.length],['Người dùng',profiles.length],['Giảng viên',profiles.filter(p=>isTeacher(p.role)).length],['Sinh viên',profiles.filter(p=>p.role==='student').length]];
  intro='Theo dõi toàn hệ thống, quản lý người dùng và mở từng học phần để kiểm tra dữ liệu.';action='Quản lý học phần';
 }else if(isTeacher(r)){
  const members=await safe(()=>q('subject_members','subject_id,user_id,role',x=>x.in('subject_id',visible.map(s=>s.id))),[]);
  const students=new Set(members.filter(m=>m.role==='student').map(m=>m.user_id));
  cards=[['Học phần phụ trách',visible.length],['Sinh viên',students.size],['Thông báo chưa đọc',unread],['Vai trò','Giảng viên']];
  intro='Chọn học phần để quản lý nội dung, ngân hàng câu hỏi, đánh giá và kết quả CLO.';action='Xem học phần phụ trách';
 }else{
  const submitted=await count('exam_attempts',x=>x.eq('student_id',state.user.id).not('submitted_at','is',null));
  cards=[['Học phần đang học',visible.length],['Lượt đã nộp',submitted],['Thông báo chưa đọc',unread],['Vai trò','Sinh viên']];
  intro='Theo dõi học phần, bài cần làm, kết quả CLO và phản hồi học tập của bạn.';action='Xem học phần đang học';
 }
 c.innerHTML=`<div class="v109-dashboard"><section class="v109-hero"><div><small>TỔNG QUAN HỆ THỐNG</small><h3>Xin chào, ${esc(state.profile?.full_name||'bạn')}</h3><p>${esc(intro)}</p></div><span>${esc(roleLabel(r))}</span></section><div class="v109-stats">${cards.map(x=>stat(...x)).join('')}</div><section class="panel"><div class="panel-head"><h3>${esc(action)}</h3><button id="v109AllCourses" class="secondary">${esc(action)}</button></div><div class="v109-courses">${courseCards(visible.slice(0,6))}</div></section></div>`;
 $('#pageTitle').textContent='Tổng quan hệ thống';$('#pageSub').textContent=r==='admin'?'Học phần, người dùng và tình trạng hệ thống':isTeacher(r)?'Các học phần phụ trách và công việc cần xử lý':'Học phần, bài kiểm tra và kết quả của bạn';
 $('#v109AllCourses').onclick=()=>navigate('subjects');bindCourseCards(c);
}

async function courseDashboard(c){
 const r=role(),s=activeSubject();if(!s){c.replaceChildren(empty());return}
 const [chapters,topics,clos,questions,exams,members]=await Promise.all([
  count('chapters',x=>x.eq('subject_id',state.subjectId)),
  safe(async()=>{const ch=await q('chapters','id',x=>x.eq('subject_id',state.subjectId));return ch.length?await count('topics',x=>x.in('chapter_id',ch.map(v=>v.id))):0},0),
  count('clos',x=>x.eq('subject_id',state.subjectId)),count('questions',x=>x.eq('subject_id',state.subjectId)),
  count('exams',x=>x.eq('subject_id',state.subjectId)),count('subject_members',x=>x.eq('subject_id',state.subjectId).eq('role','student'))
 ]);
 let cards,lead,quick;
 if(r==='student'){
  const examRows=await safe(()=>q('exams','id,title,status,created_at',x=>x.eq('subject_id',state.subjectId).order('created_at',{ascending:false})),[]);
  const ids=examRows.map(x=>x.id),attempts=ids.length?await safe(()=>q('exam_attempts','exam_id,score,submitted_at',x=>x.eq('student_id',state.user.id).in('exam_id',ids)),[]):[];
  const done=attempts.filter(x=>x.submitted_at),avg=done.length?done.reduce((a,b)=>a+Number(b.score||0),0)/done.length:null;
  cards=[['Bài kiểm tra',examRows.length],['Lượt đã nộp',done.length],['Điểm trung bình',avg===null?'—':avg.toFixed(2)],['CLO học phần',clos]];
  lead='Xem bài kiểm tra đang mở, kết quả cá nhân và mức độ đạt CLO trong học phần này.';
  quick=`<button class="primary" data-go="exams">Làm bài kiểm tra</button><button class="secondary" data-go="results">Xem kết quả CLO</button>`;
 }else{
  const practice=await count('questions',x=>x.eq('subject_id',state.subjectId).in('question_scope',['practice','both']));
  const secure=await count('questions',x=>x.eq('subject_id',state.subjectId).in('question_scope',['secure_exam','both']));
  cards=[['Chương · Chủ đề · CLO',`${chapters} · ${topics} · ${clos}`],['Câu luyện tập',practice],['Câu đề thi',secure],['Sinh viên',members]];
  lead=r==='admin'?'Kiểm tra cấu trúc, thành viên, ngân hàng câu hỏi và hoạt động đánh giá của học phần.':'Quản lý nội dung, câu hỏi, đánh giá trực tuyến, đề thi cuối kỳ và kết quả CLO.';
  quick=`<button class="primary" data-go="questions">Thêm câu hỏi</button><button class="secondary" data-go="exams">Mở Đánh giá</button><button class="secondary" data-go="results">Xem kết quả CLO</button>`;
 }
 c.innerHTML=`<div class="v109-dashboard"><section class="v109-hero course"><div><small>TỔNG QUAN HỌC PHẦN</small><h3>${esc(s.name)}</h3><p>${esc(lead)}</p></div><span>${esc(s.semester||'')}</span></section><div class="v109-stats">${cards.map(x=>stat(...x)).join('')}</div><section class="panel v109-quick"><div><h3>Thao tác nhanh</h3><p>${r==='student'?'Tiếp tục các hoạt động học tập trong môn.':'Đi đến nghiệp vụ cần thực hiện trong học phần.'}</p></div><div>${quick}</div></section></div>`;
 $('#pageTitle').textContent='Tổng quan học phần';$('#pageSub').textContent=`${s.name} · ${s.semester||''} · ${s.academic_year||''}`;
 $$('[data-go]',c).forEach(b=>b.onclick=()=>navigate(b.dataset.go));
}

const previousDashboard=window.dashboard;
window.dashboard=async function(c){return state.space==='system'?systemDashboard(c):courseDashboard(c)};

const previousExams=window.exams;
window.exams=async function(c){
 await previousExams(c);if(!canTeach())return;
 const finalSection=$('.v102-final-list',c);if(!finalSection)return;
 const createFinal=$('#createFinalExam',c),head=$('.panel-head',finalSection);if(createFinal&&head)head.append(createFinal);
 const tabs=document.createElement('div');tabs.className='v109-tabs';tabs.innerHTML='<button class="active" data-assessment-tab="online">Bài kiểm tra trực tuyến</button><button data-assessment-tab="final">Đề thi cuối kỳ</button>';
 c.prepend(tabs);const original=[...c.children].filter(x=>x!==tabs&&x!==finalSection);
 const show=tab=>{original.forEach(x=>x.hidden=tab!=='online');finalSection.hidden=tab!=='final';$$('[data-assessment-tab]',tabs).forEach(b=>b.classList.toggle('active',b.dataset.assessmentTab===tab));sessionStorage.setItem(`aiclo:v109:assessment:${state.subjectId}`,tab)};
 $$('[data-assessment-tab]',tabs).forEach(b=>b.onclick=()=>show(b.dataset.assessmentTab));show(sessionStorage.getItem(`aiclo:v109:assessment:${state.subjectId}`)||'online');
};

async function ownProfile(){
 const p=state.profile,joined=await safe(()=>q('subject_members','subject_id,role',x=>x.eq('user_id',p.id)),[]);
 const courses=joined.map(m=>({m,s:state.subjects.find(x=>x.id===m.subject_id)})).filter(x=>x.s);
 openDrawer('Hồ sơ của tôi',`<div class="v109-profile"><section class="v109-profile-head"><div>${esc((p.full_name||p.email||'?')[0].toUpperCase())}</div><span><h3>${esc(p.full_name||'Chưa đặt tên')}</h3><p>${esc(p.email||'')}${p.mssv?` · ${esc(p.mssv)}`:''}</p><b>${esc(roleLabel(p.role))}</b></span></section><div class="v109-stats">${stat('Học phần',courses.length)}${stat('Trạng thái',p.is_active===false?'Đã khóa':'Hoạt động')}${stat('Vai trò',roleLabel(p.role))}</div><section class="panel"><div class="panel-head"><h3>${p.role==='student'?'Học phần đang học':isTeacher(p.role)?'Học phần phụ trách':'Học phần liên quan'}</h3></div>${courses.map(x=>`<button class="v109-profile-course" data-own-course="${x.s.id}"><b>${esc(x.s.name)}</b><small>${esc(x.s.semester||'')} · ${esc(x.s.academic_year||'')}</small></button>`).join('')||'<p class="hint">Chưa có học phần.</p>'}</section><div class="v109-profile-actions"><button id="v109Logout" class="secondary">Đăng xuất</button></div></div>`,null,{wide:true});
 $$('[data-own-course]',$('#drawerBody')).forEach(b=>b.onclick=()=>{closeDrawer();window.v95EnterCourse?.(b.dataset.ownCourse)});$('#v109Logout').onclick=()=>$('#logoutBtn').click();
}

async function adminProfile(p){
 const joined=await safe(()=>q('subject_members','subject_id,role',x=>x.eq('user_id',p.id)),[]),acts=await safe(()=>q('activity_logs','summary,action,created_at',x=>x.eq('user_id',p.id).order('created_at',{ascending:false}).limit(10)),[]);
 openDrawer(`Quản lý tài khoản · ${p.full_name||p.email}`,`<div class="v109-profile"><section class="v109-profile-head"><div>${esc((p.full_name||p.email||'?')[0].toUpperCase())}</div><span><h3>${esc(p.full_name||'Chưa đặt tên')}</h3><p>${esc(p.email||'')}${p.mssv?` · ${esc(p.mssv)}`:''}</p><b>${esc(roleLabel(p.role))}</b></span></section><div class="v109-stats">${stat('Học phần',joined.length)}${stat('Trạng thái',p.is_active===false?'Đã khóa':'Hoạt động')}${stat('Vai trò',roleLabel(p.role))}</div><section class="panel"><h3>Phân công học phần</h3>${joined.map(m=>`<p><b>${esc(state.subjects.find(s=>s.id===m.subject_id)?.name||'Học phần')}</b> · ${esc(roleLabel(m.role))}</p>`).join('')||'<p class="hint">Chưa được phân công.</p>'}</section><section class="panel"><h3>Hoạt động quản trị gần đây</h3>${acts.map(a=>`<p><b>${esc(a.summary||a.action)}</b><small> · ${fmt(a.created_at)}</small></p>`).join('')||'<p class="hint">Chưa có hoạt động.</p>'}</section></div>`,null,{wide:true});
}

async function studentLearningProfile(p){
 const s=activeSubject();if(!s)return;
 const exams=await safe(()=>q('exams','id,title',x=>x.eq('subject_id',s.id)),[]),ids=exams.map(x=>x.id);
 const attempts=ids.length?await safe(()=>q('exam_attempts','exam_id,score,submitted_at,attempt_number',x=>x.eq('student_id',p.id).in('exam_id',ids).order('submitted_at',{ascending:false})),[]):[];
 const done=attempts.filter(x=>x.submitted_at),avg=done.length?done.reduce((a,b)=>a+Number(b.score||0),0)/done.length:null;
 openDrawer(`Hồ sơ học tập · ${p.full_name}`,`<div class="v109-profile"><section class="v109-profile-head"><div>${esc((p.full_name||'?')[0].toUpperCase())}</div><span><small>${esc(s.name)}</small><h3>${esc(p.full_name)}</h3><p>${esc(p.mssv||p.email||'')}</p></span></section><div class="v109-stats">${stat('Bài đã làm',new Set(done.map(x=>x.exam_id)).size)}${stat('Lượt đã nộp',done.length)}${stat('Điểm trung bình',avg===null?'—':avg.toFixed(2))}</div><section class="panel"><h3>Bài kiểm tra gần đây</h3>${done.slice(0,8).map(a=>`<p><b>${esc(exams.find(e=>e.id===a.exam_id)?.title||'Bài kiểm tra')}</b><span> · Điểm ${esc(a.score??'—')}</span><small> · ${fmt(a.submitted_at)}</small></p>`).join('')||'<p class="hint">Chưa có bài đã nộp.</p>'}</section><p class="hint">Hồ sơ này chỉ hiển thị dữ liệu trong học phần hiện tại.</p></div>`,null,{wide:true});
}

async function openContextProfile(id){
 const rows=await safe(()=>q('profiles','*',x=>x.eq('id',id).limit(1)),[]),p=rows[0];if(!p)return toast('Không tìm thấy hồ sơ',true);
 if(p.id===state.user.id)return ownProfile();
 if(role()==='admin')return adminProfile(p);
 if(canTeach()&&state.space==='course'&&p.role==='student')return studentLearningProfile(p);
 toast('Bạn không có quyền mở hồ sơ này',true);
}

function profileIdFromButton(btn){const row=btn.closest('tr');return row?.querySelector('[data-manage-user]')?.dataset.manageUser||row?.querySelector('[data-profile]')?.dataset.profile||row?.querySelector('[data-ai]')?.dataset.ai||null}
document.addEventListener('click',e=>{const b=e.target.closest('.user-name-link-v108');if(!b)return;const id=profileIdFromButton(b);if(!id)return;e.preventDefault();e.stopImmediatePropagation();openContextProfile(id)},true);

const previousRender=window.render;
window.render=async function(){await previousRender();window.v95RefreshShell?.();const mini=$('#miniUser');if(mini){mini.onclick=ownProfile;mini.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();ownProfile()}}}};

document.addEventListener('DOMContentLoaded',()=>{document.documentElement.dataset.aicloVersion=V;setTimeout(()=>{window.v95RefreshShell?.();const mini=$('#miniUser');if(mini)mini.onclick=ownProfile},300)});
})();
