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
 if(state.space==='system'){const r=role();return [
  ['dashboard','⌂','Tổng quan',true],['subjects','▣',role()==='admin'?'Quản lý học phần':isTeacher(role())?'Học phần phụ trách':'Học phần đang học',true],
  ['notifications','🔔','Thông báo',r!=='admin'],
  ['activity','≡','Nhật ký hoạt động',role()==='admin'],['users','♙','Quản lý người dùng',role()==='admin']
 ]}
 return [
  ['dashboard','⌂','Tổng quan học phần',true],['structure','⌘','Chương · Chủ đề · CLO',true],
  ['questions','?','Ngân hàng câu hỏi',canTeach()],['exams','✎',canTeach()?'Đánh giá':'Bài kiểm tra trực tuyến',true],
  ['results','◫','Kết quả CLO',true],['users','♙','Danh sách thành viên',canTeach()]
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
 if(r!=='admin'){
  const notices=await safe(()=>q('notifications','id,title,message,category,created_at,read_at,subject_id,target_view',x=>x.eq('user_id',state.user.id).order('created_at',{ascending:false}).limit(5)),[]);
  const panel=document.createElement('section');panel.className='panel v109-notices';panel.innerHTML=`<div class="panel-head"><div><h3>Thông báo gần đây</h3><p class="hint">Những nội dung mới từ hệ thống và các học phần.</p></div><button id="v109AllNotices" class="secondary">Xem tất cả thông báo</button></div><div class="v109-notice-list">${notices.map(n=>`<button type="button" class="v109-notice ${n.read_at?'':'unread'}" data-v109-notice="${n.id}"><span>🔔</span><div><b>${esc(n.title||'Thông báo')}</b><p>${esc(n.message||'')}</p><small>${fmt(n.created_at)}${n.read_at?'':' · Chưa đọc'}</small></div></button>`).join('')||'<div class="empty"><b>Chưa có thông báo</b><span>Thông báo mới sẽ xuất hiện tại đây.</span></div>'}</div>`;
  $('.v109-dashboard',c).append(panel);$('#v109AllNotices').onclick=()=>navigate('notifications');$$('[data-v109-notice]',panel).forEach(b=>b.onclick=()=>window.AICLO_V108?.openNoticeDetail?.(notices.find(n=>n.id===b.dataset.v109Notice)));
 }
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

const previousUsers=window.users;
const memberTime=value=>{if(!value)return'Chưa từng đăng nhập';const seconds=Math.max(0,(Date.now()-new Date(value).getTime())/1000);if(seconds<90)return'Vừa xong';if(seconds<3600)return`${Math.floor(seconds/60)} phút trước`;if(seconds<86400)return`${Math.floor(seconds/3600)} giờ trước`;if(seconds<172800)return'Hôm qua';if(seconds<2592000)return`${Math.floor(seconds/86400)} ngày trước`;return fmt(value)};
window.users=async function(c){
 if(state.space!=='course'||!canTeach())return previousUsers(c);
 await previousUsers(c);$('#pageTitle').textContent='Danh sách thành viên';$('#pageSub').textContent='Sinh viên và giảng viên thuộc học phần hiện tại';
 const tabs=document.createElement('div');tabs.className='v109-member-tabs';tabs.innerHTML='<button class="active" data-member-tab="students">Danh sách sinh viên</button><button data-member-tab="teachers">Danh sách giảng viên</button>';
 c.prepend(tabs);
 const activate=tab=>$$('[data-member-tab]',tabs).forEach(b=>b.classList.toggle('active',b.dataset.memberTab===tab));
 $('[data-member-tab="students"]',tabs).onclick=()=>render();
 $('[data-member-tab="teachers"]',tabs).onclick=async()=>{
  activate('teachers');const memberships=await safe(()=>q('subject_members','user_id,role',x=>x.eq('subject_id',state.subjectId).in('role',['teacher','lecturer','giangvien','admin'])),[]),ids=[...new Set(memberships.map(m=>m.user_id))],profiles=ids.length?await safe(()=>q('profiles','id,full_name,email,role,last_login_at,is_active',x=>x.in('id',ids).order('full_name')),[]):[];
  [...c.children].filter(x=>x!==tabs).forEach(x=>x.remove());const panel=document.createElement('section');panel.className='panel v109-teacher-members';panel.innerHTML=`<div class="v109-member-summary"><div><small>Giảng viên trong học phần</small><b>${profiles.length}</b></div><input id="v109TeacherSearch" placeholder="Tìm theo họ tên hoặc email…"></div><div class="table-wrap"><table><thead><tr><th>Họ tên</th><th>Email</th><th>Vai trò</th><th>Đăng nhập gần nhất</th><th>Trạng thái</th></tr></thead><tbody id="v109TeacherRows"></tbody></table></div>`;c.append(panel);
  const draw=list=>{$('#v109TeacherRows').innerHTML=list.map(p=>{const member=memberships.find(m=>m.user_id===p.id);return `<tr><td><b>${esc(p.full_name||'Chưa đặt tên')}</b></td><td>${esc(p.email||'—')}</td><td><span class="badge">${esc(roleLabel(member?.role||p.role))}</span></td><td>${esc(memberTime(p.last_login_at))}</td><td><span class="badge ${p.is_active===false?'red':'green'}">${p.is_active===false?'Đã khóa':'Hoạt động'}</span></td></tr>`}).join('')||'<tr><td colspan="5" class="empty">Chưa có giảng viên trong học phần.</td></tr>'};draw(profiles);$('#v109TeacherSearch').oninput=e=>{const s=e.target.value.trim().toLowerCase();draw(profiles.filter(p=>!s||`${p.full_name||''} ${p.email||''}`.toLowerCase().includes(s)))};
 };
};

const previousExams=window.exams;
window.exams=async function(c){
 await previousExams(c);if(!canTeach())return;
 const finalSection=$('.v102-final-list',c);if(!finalSection)return;
 const createFinal=$('#createFinalExam',c),head=$('.panel-head',finalSection);if(createFinal&&head)head.append(createFinal);
 const tabs=document.createElement('div');tabs.className='v109-tabs';tabs.innerHTML='<button class="active" data-assessment-tab="online">Bài kiểm tra trực tuyến</button><button data-assessment-tab="final">Đề thi cuối kỳ</button>';
 c.prepend(tabs);const original=[...c.children].filter(x=>x!==tabs&&x!==finalSection);
 const show=tab=>{original.forEach(x=>{x.hidden=tab!=='online';x.classList.toggle('hidden',tab!=='online')});finalSection.hidden=tab!=='final';finalSection.classList.toggle('hidden',tab!=='final');$$('[data-assessment-tab]',tabs).forEach(b=>b.classList.toggle('active',b.dataset.assessmentTab===tab));sessionStorage.setItem(`aiclo:v109:assessment:${state.subjectId}`,tab)};
 $$('[data-assessment-tab]',tabs).forEach(b=>b.onclick=()=>show(b.dataset.assessmentTab));show(sessionStorage.getItem(`aiclo:v109:assessment:${state.subjectId}`)||'online');

 const add=$('#addExam',c),openOriginal=add?.onclick;
 if(add&&openOriginal)add.onclick=async e=>{
  e?.preventDefault();sessionStorage.setItem(`aiclo:v109:assessment:${state.subjectId}`,'online');
  const oldModal=window.modal;
  window.modal=(title,html)=>{
   if(title!=='Tạo bài kiểm tra')return oldModal(title,html);
   const body=String(html).replace('onclick="document.querySelector(\'#modal\').close()"','id="v109CancelAssessment"');
   c.innerHTML=`<section class="v109-workspace-head"><button id="v109BackAssessments" class="secondary" type="button">← Quay lại</button><div><small>BÀI KIỂM TRA TRỰC TUYẾN</small><h3>${esc(title)}</h3><p>Tạo và kiểm tra cấu trúc ngay trong trang. Dữ liệu chỉ được lưu khi bạn nhấn “Tạo và rút câu”.</p></div></section><section class="panel v109-assessment-workspace">${body}</section>`;
   const back=()=>render();$('#v109BackAssessments').onclick=back;$('#v109CancelAssessment')?.addEventListener('click',back);window.scrollTo({top:0,behavior:'smooth'});
  };
  try{await openOriginal.call(add,e)}finally{window.modal=oldModal}
 };
};

async function ownProfile(){
 const p=state.profile,joined=await safe(()=>q('subject_members','subject_id,role',x=>x.eq('user_id',p.id)),[]);
 const courses=joined.map(m=>({m,s:state.subjects.find(x=>x.id===m.subject_id)})).filter(x=>x.s);
 openDrawer('Hồ sơ của tôi',`<div class="v109-profile"><section class="v109-profile-head"><div>${esc((p.full_name||p.email||'?')[0].toUpperCase())}</div><span><h3>${esc(p.full_name||'Chưa đặt tên')}</h3><p>${esc(p.email||'')}${p.mssv?` · ${esc(p.mssv)}`:''}</p><b>${esc(roleLabel(p.role))}</b></span></section><div class="v109-stats">${stat('Học phần',courses.length)}${stat('Trạng thái',p.is_active===false?'Đã khóa':'Hoạt động')}${stat('Vai trò',roleLabel(p.role))}</div><section class="panel"><div class="panel-head"><h3>${p.role==='student'?'Học phần đang học':isTeacher(p.role)?'Học phần phụ trách':'Học phần liên quan'}</h3></div>${courses.map(x=>`<button class="v109-profile-course" data-own-course="${x.s.id}"><b>${esc(x.s.name)}</b><small>${esc(x.s.semester||'')} · ${esc(x.s.academic_year||'')}</small></button>`).join('')||'<p class="hint">Chưa có học phần.</p>'}</section><section class="panel v109-security"><div><h3>Tài khoản và bảo mật</h3><p>Thay đổi thông tin được phép của tài khoản đang đăng nhập.</p></div><div>${p.role==='admin'||isTeacher(p.role)?'<button id="v109ChangeName" class="secondary">Đổi họ tên</button>':''}<button id="v109ChangePassword" class="primary">Đổi mật khẩu</button></div></section><div class="v109-profile-actions"><button id="v109Logout" class="secondary">Đăng xuất</button></div></div>`,null,{wide:true});
 $$('[data-own-course]',$('#drawerBody')).forEach(b=>b.onclick=()=>{closeDrawer();window.v95EnterCourse?.(b.dataset.ownCourse)});$('#v109ChangeName')?.addEventListener('click',changeOwnName);$('#v109ChangePassword').onclick=changeOwnPassword;$('#v109Logout').onclick=()=>$('#logoutBtn').click();
}

function changeOwnName(){
 const current=state.profile?.full_name||'';
 pushDrawer('Đổi họ tên',`<form id="v109NameForm" class="v109-account-form"><p class="hint">Họ tên này được dùng trong hồ sơ và giao diện hệ thống. Email, vai trò và mã sinh viên không thay đổi.</p><label class="field">Họ và tên<input name="full_name" value="${esc(current)}" required minlength="2" maxlength="120" autocomplete="name"></label><div class="form-actions"><button type="button" class="secondary" id="v109CancelName">Hủy</button><button class="primary" id="v109SaveName">Lưu họ tên</button></div></form>`,root=>{
  $('#v109CancelName',root).onclick=backDrawer;$('#v109NameForm',root).onsubmit=async e=>{e.preventDefault();const name=new FormData(e.target).get('full_name').trim().replace(/\s+/g,' ');if(name.length<2)return toast('Họ tên chưa hợp lệ',true);const btn=$('#v109SaveName',root);btn.disabled=true;btn.textContent='Đang lưu…';const {data,error}=await db.from('profiles').update({full_name:name}).eq('id',state.user.id).select().single();if(error){btn.disabled=false;btn.textContent='Lưu họ tên';return err(error)}state.profile=data;$('#miniUser').innerHTML=`<b>${esc(data.full_name)}</b><br>${esc(data.email)} · ${esc(data.role)}`;window.logActivity?.('update_profile','profile',state.user.id,`Đổi họ tên từ ${current||'chưa đặt'} thành ${name}`);toast('Đã cập nhật họ tên');ownProfile()};
 },{eyebrow:'HỒ SƠ CỦA TÔI'});
}

function changeOwnPassword(){
 pushDrawer('Đổi mật khẩu',`<form id="v109PasswordForm" class="v109-account-form"><p class="hint">Mật khẩu mới cần có ít nhất 8 ký tự, gồm chữ và số.</p><label class="field">Mật khẩu mới<div class="v109-password-input"><input id="v109NewPassword" name="password" type="password" required minlength="8" autocomplete="new-password"><button type="button" data-toggle-password="v109NewPassword" aria-label="Hiện hoặc ẩn mật khẩu">👁</button></div></label><label class="field">Nhập lại mật khẩu<div class="v109-password-input"><input id="v109ConfirmPassword" name="confirm_password" type="password" required minlength="8" autocomplete="new-password"><button type="button" data-toggle-password="v109ConfirmPassword" aria-label="Hiện hoặc ẩn mật khẩu">👁</button></div></label><div class="form-actions"><button type="button" class="secondary" id="v109CancelPassword">Hủy</button><button class="primary" id="v109SavePassword">Đổi mật khẩu</button></div></form>`,root=>{
  $('#v109CancelPassword',root).onclick=backDrawer;$$('[data-toggle-password]',root).forEach(b=>b.onclick=()=>{const input=$('#'+b.dataset.togglePassword,root);input.type=input.type==='password'?'text':'password'});$('#v109PasswordForm',root).onsubmit=async e=>{e.preventDefault();const v=Object.fromEntries(new FormData(e.target)),password=String(v.password||'');if(password.length<8||!/[A-Za-zÀ-ỹ]/.test(password)||!/[0-9]/.test(password))return toast('Mật khẩu cần ít nhất 8 ký tự, gồm chữ và số',true);if(password!==v.confirm_password)return toast('Hai lần nhập mật khẩu chưa khớp',true);const btn=$('#v109SavePassword',root);btn.disabled=true;btn.textContent='Đang cập nhật…';const {error}=await db.auth.updateUser({password});if(error){btn.disabled=false;btn.textContent='Đổi mật khẩu';return err(error)}window.logActivity?.('change_password','session',state.user.id,'Đổi mật khẩu tài khoản');toast('Đổi mật khẩu thành công');ownProfile()};
 },{eyebrow:'BẢO MẬT TÀI KHOẢN'});
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
