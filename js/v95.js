/* AI-CLO PTITHCM v9.5 — responsive navigation and cleaner working surfaces. */
state.space=localStorage.getItem('aiclo_space')==='course'?'course':'system';
state.structureEditing=false;

Object.assign(titles,{
 systemDashboard:['Tổng quan hệ thống','Theo dõi các học phần và hoạt động chung'],
 courseDashboard:['Tổng quan môn học','Theo dõi dữ liệu của học phần hiện tại']
});

const v95CourseDashboard=dashboard;
const v95BaseStructure=structure;
const v95BaseQuestions=questions;
const v95BaseRender=render;
const v95BaseNavigate=navigate;
const v95BaseUsers=users;
const v95ShowAuth=showAuth;
const v95EnterAppBase=enterApp;
showAuth=function(){v95ShowAuth();document.body.classList.remove('booting')};
enterApp=function(){v95EnterAppBase();v95RefreshShell();document.body.classList.remove('booting')};

const v95SystemViews=new Set(['dashboard','subjects','notifications','activity','users']);
const v95CourseViews=new Set(['dashboard','structure','questions','exams','results','users']);
const v95RoleLabel=()=>role()==='admin'?'Quản trị viên':canTeach()?'Giảng viên':'Sinh viên';

function v95NavItems(){
 if(state.space==='system')return [
  ['dashboard','⌂','Tổng quan',true],['subjects','▣','Môn học',true],['notifications','♧','Thông báo',true],
  ['activity','≡','Nhật ký',canTeach()],['users','♙','Người dùng',role()==='admin']
 ];
 return [
  ['dashboard','⌂','Tổng quan môn học',true],['structure','⌘','Chương · CLO',true],
  ['questions','?','Ngân hàng câu hỏi',canTeach()],['exams','✎','Bài kiểm tra',true],
  ['results','◫','Kết quả CLO',true],['users','♙','Danh sách lớp',canTeach()]
 ];
}

function v95RefreshShell(){
 const nav=$('#nav');if(!nav)return;
 nav.innerHTML=v95NavItems().filter(x=>x[3]).map(([view,icon,label])=>`<button data-view="${view}" class="${state.view===view?'active':''}"><span class="nav-icon">${icon}</span><span>${esc(label)}</span></button>`).join('');
 const course=activeSubject(),aside=$('.app>aside');
 aside?.classList.toggle('course-space',state.space==='course');
 let context=$('#courseContext');
 if(state.space==='course'&&course){
  if(!context){context=document.createElement('div');context.id='courseContext';context.className='course-context';$('.app>aside>.logo')?.after(context)}
  context.innerHTML=`<small>MÔN HỌC</small><b>${esc(course.name)}</b><span>${esc(course.semester)} · ${esc(course.academic_year)}</span>`;
 }else context?.remove();
 $('#systemHomeBtn')?.classList.toggle('hidden',state.space!=='course');
 $('.subject-pick')?.classList.toggle('hidden',state.space!=='course');
 const pick=$('.subject-pick');if(pick&&course){let value=$('.subject-value',pick);if(!value){value=document.createElement('span');value.className='subject-value';pick.append(value)}value.innerHTML=`<b>${esc(course.name)}</b><small>${esc(course.semester)}</small>`}
}

function v95EnterSystem(view='dashboard'){
 state.space='system';state.view=view;localStorage.setItem('aiclo_space','system');v95RefreshShell();navigate(view);
}
function v95EnterCourse(subjectId,view='dashboard'){
 if(subjectId){state.subjectId=subjectId;localStorage.setItem('aiclo_subject',subjectId);fillSubjectSelect()}
 state.space='course';state.view=view;localStorage.setItem('aiclo_space','course');v95RefreshShell();navigate(view);
}
window.v95EnterCourse=v95EnterCourse;

navigate=function(v){
 if(v==='notifications'){state.space='system';localStorage.setItem('aiclo_space','system')}
 if(state.space==='system'&&!v95SystemViews.has(v))v='dashboard';
 if(state.space==='course'&&!v95CourseViews.has(v))v='dashboard';
 if(v==='users'&&!canTeach()&&role()!=='admin')v='dashboard';
 closeDrawer();state.view=v;v95RefreshShell();$('aside')?.classList.remove('open');
 let t,s;
 if(state.space==='system'){
  const globalTitles={dashboard:['Tổng quan hệ thống','Các môn học và hoạt động chung'],subjects:['Môn học','Danh sách các môn bạn được phép truy cập'],notifications:titles.notifications||['Thông báo','Thông báo của toàn hệ thống'],activity:titles.activity||['Nhật ký','Hoạt động gần đây'],users:['Người dùng','Quản lý tài khoản và phân quyền']};
  [t,s]=globalTitles[v]||globalTitles.dashboard;
 }else{
  const courseTitles={dashboard:['Tổng quan môn học','Theo dõi dữ liệu của học phần hiện tại'],structure:titles.structure,questions:titles.questions,exams:titles.exams,results:titles.results,users:['Danh sách lớp','Sinh viên thuộc học phần hiện tại']};
  [t,s]=courseTitles[v]||courseTitles.dashboard;
 }
 $('#pageTitle').textContent=t;$('#pageSub').textContent=s;render();
};

async function v95SystemDashboard(c){
 let unread=0;try{let {count}=await db.from('notifications').select('id',{count:'exact',head:true}).eq('user_id',state.user.id).is('read_at',null);unread=count||0}catch{}
 c.innerHTML=`<div class="system-welcome"><div><span>${esc(v95RoleLabel())}</span><h3>Xin chào, ${esc(state.profile?.full_name||'bạn')}</h3><p>Chọn một môn học để mở các chức năng Chương, Ngân hàng câu hỏi, Bài kiểm tra và Kết quả CLO.</p></div><button id="overviewCourses" class="primary">Xem môn học</button></div><div class="stats system-stats"><div class="stat"><small>Môn học được truy cập</small><b>${state.subjects.length}</b></div><div class="stat"><small>Thông báo chưa đọc</small><b>${unread}</b></div><div class="stat"><small>Vai trò</small><strong>${esc(v95RoleLabel())}</strong></div></div><section class="panel"><div class="panel-head"><h3>Môn học gần đây</h3><button id="allCourses" class="secondary">Xem tất cả</button></div><div class="course-grid">${v95CourseCards(state.subjects.slice(0,6))}</div></section>`;
 $('#overviewCourses').onclick=$('#allCourses').onclick=()=>navigate('subjects');v95BindCourseCards(c);
}

function v95CourseCards(list){return list.map(s=>`<article class="course-card"><div><span class="course-role">${esc(v95RoleLabel())}</span><h3>${esc(s.name)}</h3><p>${esc(s.semester)} · ${esc(s.academic_year)}</p></div><button class="primary" data-open-course="${s.id}">Vào môn học <b>→</b></button></article>`).join('')||'<div class="empty"><b>Chưa có môn học</b><span>Quản trị viên cần phân công bạn vào một môn học.</span></div>'}
function v95BindCourseCards(root=document){$$('[data-open-course]',root).forEach(b=>b.onclick=()=>v95EnterCourse(b.dataset.openCourse))}

async function v95SystemSubjects(c){
 c.innerHTML=`<div class="toolbar course-toolbar"><input id="search" placeholder="Tìm môn học…"><button class="primary" id="addSubject" ${role()!=='admin'?'hidden':''}>+ Tạo môn học</button></div><div id="courseGrid" class="course-grid"></div>`;
 const draw=list=>{$('#courseGrid').innerHTML=v95CourseCards(list);v95BindCourseCards($('#courseGrid'))};draw(state.subjects);
 $('#search').oninput=e=>draw(state.subjects.filter(s=>`${s.name} ${s.semester} ${s.academic_year}`.toLowerCase().includes(e.target.value.toLowerCase())));
 $('#addSubject')?.addEventListener('click',()=>subjectForm());
}

dashboard=async c=>state.space==='system'?v95SystemDashboard(c):v95CourseDashboard(c);
subjects=v95SystemSubjects;
users=async c=>state.space==='course'?teacherClassList(c):v95BaseUsers(c);

structure=async function(c){
 await v95BaseStructure(c);if(!canTeach())return;
 c.classList.add('structure-v95');c.classList.toggle('is-editing',state.structureEditing);
 const firstHead=$('.panel-head',c);if(!firstHead)return;
 const edit=document.createElement('button');edit.id='structureEditMode';edit.className=state.structureEditing?'primary':'secondary';edit.textContent=state.structureEditing?'Hoàn tất':'Chỉnh sửa cấu trúc';firstHead.append(edit);
 edit.onclick=()=>{state.structureEditing=!state.structureEditing;c.classList.toggle('is-editing',state.structureEditing);edit.className=state.structureEditing?'primary':'secondary';edit.textContent=state.structureEditing?'Hoàn tất':'Chỉnh sửa cấu trúc'};
};

questions=async function(c){
 if(!canTeach())return v95BaseQuestions(c);if(!state.subjectId){c.replaceChildren(empty());return}
 let [items,ch,topics,clos]=await Promise.all([
  q('questions','*, question_options(*)',x=>x.eq('subject_id',state.subjectId).order('created_at',{ascending:false})),
  q('chapters','*',x=>x.eq('subject_id',state.subjectId).order('order_index')),q('topics'),q('clos','*',x=>x.eq('subject_id',state.subjectId).order('code'))
 ]),relevantTopics=topics.filter(t=>ch.some(x=>x.id===t.chapter_id)),creators=[];
 try{let ids=[...new Set(items.map(x=>x.created_by).filter(Boolean))];if(ids.length)creators=await q('profiles','id,full_name,email',x=>x.in('id',ids).order('full_name'))}catch{}
 c.innerHTML=`<div class="question-tools v95-question-tools"><input id="qsearch" placeholder="Tìm theo mã hoặc nội dung…"><select id="qchapterFilter"><option value="all">Tất cả chương</option>${ch.map(x=>`<option value="${x.id}">${esc(x.order_index)}. ${esc(x.name)}</option>`).join('')}</select><select id="qtopicFilter"><option value="all">Tất cả chủ đề</option></select><select id="qcloFilter"><option value="all">Tất cả CLO</option>${clos.map(x=>`<option value="${x.id}">${esc(x.code)}</option>`).join('')}</select><select id="qcreatorFilter"><option value="all">Tất cả người tạo</option><option value="mine">Câu hỏi của tôi</option>${creators.filter(x=>x.id!==state.user.id).map(x=>`<option value="${x.id}">${esc(x.full_name||x.email)}</option>`).join('')}</select><select id="qstatusFilter"><option value="all">Tất cả trạng thái</option><option value="active">Đang dùng</option><option value="draft">Bản nháp</option></select></div><div class="toolbar bank-actions"><span id="questionCount" class="hint"></span><button id="aiHistory" class="secondary">Phiên AI</button><button id="generateAI" class="ai-btn">✦ Tạo bằng Gemini</button><button id="addQ" class="primary">+ Thêm câu hỏi</button></div><div class="panel table-wrap question-table"><table><thead><tr><th>Mã câu</th><th>Nội dung</th><th>Chương · Chủ đề</th><th>Trạng thái</th><th></th></tr></thead><tbody id="qrows"></tbody></table></div>`;
 const fillTopics=()=>{let cid=$('#qchapterFilter').value,allowed=cid==='all'?relevantTopics:relevantTopics.filter(t=>t.chapter_id===cid),old=$('#qtopicFilter').value;$('#qtopicFilter').innerHTML='<option value="all">Tất cả chủ đề</option>'+allowed.map(x=>`<option value="${x.id}">${esc(x.name)}</option>`).join('');if(allowed.some(x=>x.id===old))$('#qtopicFilter').value=old};
 const draw=()=>{let search=$('#qsearch').value.trim().toLowerCase(),cid=$('#qchapterFilter').value,tid=$('#qtopicFilter').value,cloid=$('#qcloFilter').value,creator=$('#qcreatorFilter').value,status=$('#qstatusFilter').value,list=items.filter(x=>(!search||x.content.toLowerCase().includes(search)||questionCode(x.id).toLowerCase().includes(search))&&(cid==='all'||x.chapter_id===cid)&&(tid==='all'||x.topic_id===tid)&&(cloid==='all'||x.clo_id===cloid)&&(creator==='all'||x.created_by===(creator==='mine'?state.user.id:creator))&&(status==='all'||x.status===status));$('#questionCount').textContent=`Hiển thị ${list.length}/${items.length} câu`;$('#qrows').innerHTML=list.map(x=>{let chapter=ch.find(z=>z.id===x.chapter_id),topic=relevantTopics.find(z=>z.id===x.topic_id),clo=clos.find(z=>z.id===x.clo_id);return `<tr><td><button class="question-code" data-detail="${x.id}">${questionCode(x.id)}</button><br><span class="badge red question-clo">${esc(clo?.code||'—')}</span></td><td><button class="question-summary" data-detail="${x.id}">${esc(x.content)}</button></td><td>${esc(chapter?.name||'—')}<br><small>${esc(topic?.name||'—')}</small></td><td><span class="badge ${x.status==='active'?'green':''}">${x.status==='active'?'Đang dùng':'Bản nháp'}</span></td><td class="row-actions"><button data-detail="${x.id}">Chi tiết</button><button data-analysis="${x.id}">Phân tích</button></td></tr>`}).join('')||'<tr><td colspan="5" class="empty">Không có câu hỏi phù hợp.</td></tr>';renderMath($('#qrows'))};
 fillTopics();draw();$('#qsearch').oninput=draw;$('#qchapterFilter').onchange=()=>{fillTopics();draw()};['#qtopicFilter','#qcloFilter','#qcreatorFilter','#qstatusFilter'].forEach(s=>$(s).onchange=draw);
 $('#addQ').onclick=()=>questionForm(null,{ch,topics:relevantTopics,clos});$('#generateAI').onclick=()=>aiGenerateForm({ch,topics:relevantTopics,clos});$('#aiHistory').onclick=aiHistory;
 $('#qrows').onclick=e=>{let b=e.target.closest('button');if(!b)return;let item=items.find(x=>x.id===(b.dataset.detail||b.dataset.analysis));if(b.dataset.detail)questionDetail(item,{ch,topics:relevantTopics,clos});if(b.dataset.analysis)v95QuestionAnalysis(item)};
};

async function v95QuestionAnalysis(item){
 try{let answers=await q('student_answers','selected_option,is_correct',x=>x.eq('question_id',item.id)),n=answers.length,correct=answers.filter(x=>x.is_correct).length,dist=['A','B','C','D'].map(k=>[k,answers.filter(x=>x.selected_option===k).length]);openDrawer(`Phân tích · ${questionCode(item.id)}`,`<div class="panel question-analysis"><div class="analysis-number"><small>Lượt làm</small><b>${n}</b></div><div class="analysis-number"><small>Tỷ lệ đúng</small><b>${n?Math.round(correct*100/n):0}%</b></div><h4>Phân bố lựa chọn</h4>${dist.map(([k,v])=>`<div class="choice-stat"><span>${k}</span><div class="bar"><i style="width:${n?v*100/n:0}%"></i></div><b>${v}</b></div>`).join('')}<p class="hint">${n>=10?'Đã đủ dữ liệu thống kê. Chức năng Gemini nhận xét câu hỏi sẽ được bổ sung ở chặng AI.':'Cần ít nhất 10 lượt làm để đưa ra nhận xét đáng tin cậy.'}</p></div>`,null,{eyebrow:'THỐNG KÊ CÂU HỎI'})}catch{openDrawer(`Phân tích · ${questionCode(item.id)}`,`<div class="panel"><b>Chưa có dữ liệu phân tích</b><p class="hint">Câu hỏi chưa đủ lượt làm hoặc cơ sở dữ liệu chưa cấp quyền đọc thống kê.</p></div>`,null,{eyebrow:'THỐNG KÊ CÂU HỎI'})}
}

resetPassword=function(){modal('Quên mật khẩu',`<div class="forgot-admin"><span class="forgot-icon">?</span><h3>Liên hệ Quản trị viên</h3><p>Vui lòng cung cấp họ và tên, email hoặc mã tài khoản, cùng mã sinh viên/mã giảng viên để được cấp lại mật khẩu.</p><div class="support-email"><small>Email hỗ trợ</small><b>namph@ptithcm.edu.vn</b></div><p class="hint">Không cung cấp mật khẩu cũ hoặc thông tin nhạy cảm khác.</p><div class="form-actions"><button id="copySupportEmail" class="secondary" type="button">Sao chép email</button><button class="primary" type="button" onclick="document.querySelector('#modal').close()">Quay lại đăng nhập</button></div></div>`);$('#copySupportEmail').onclick=async()=>{await navigator.clipboard?.writeText('namph@ptithcm.edu.vn');toast('Đã sao chép email hỗ trợ')}};

function v95RelativeTime(value){if(!value)return'Chưa từng đăng nhập';let seconds=Math.max(0,(Date.now()-new Date(value).getTime())/1000);if(seconds<90)return'Vừa xong';if(seconds<3600)return`${Math.floor(seconds/60)} phút trước`;if(seconds<86400)return`${Math.floor(seconds/3600)} giờ trước`;if(seconds<172800)return'Hôm qua';if(seconds<2592000)return`${Math.floor(seconds/86400)} ngày trước`;return v94Time(value)}
function v95ComposeMessage(profile){modal(`Thông báo · ${profile.full_name}`,`<form id="studentMessageForm" class="form-grid"><p class="hint wide">Thông báo một chiều sẽ xuất hiện trong biểu tượng chuông của sinh viên.</p><label class="field wide">Tiêu đề<input name="title" required maxlength="120" value="Thông báo từ giảng viên"></label><label class="field wide">Nội dung<textarea name="message" required maxlength="1000" placeholder="Nhập nội dung thông báo…"></textarea></label><div class="form-actions"><button type="button" class="secondary" onclick="document.querySelector('#modal').close()">Hủy</button><button class="primary">Gửi thông báo</button></div></form>`);$('#studentMessageForm').onsubmit=async e=>{e.preventDefault();let data=Object.fromEntries(new FormData(e.target)),button=e.submitter;button.disabled=true;button.textContent='Đang gửi…';let {error}=await db.rpc('send_teacher_notification',{p_recipient_id:profile.id,p_subject_id:state.subjectId,p_title:data.title,p_message:data.message});if(error){button.disabled=false;button.textContent='Gửi thông báo';return err(new Error(/send_teacher_notification/i.test(error.message||'')?'Chưa cài đặt SQL v9.5 cho chức năng gửi thông báo.':error.message))}closeModal();toast('Đã gửi thông báo cho sinh viên');window.logActivity?.('notify','profile',profile.id,`Gửi thông báo cho ${profile.full_name}`)}}

if(window.AICLO_ASSESSMENT?.teacherClassList){
 const v95ClassList=window.AICLO_ASSESSMENT.teacherClassList;
 window.AICLO_ASSESSMENT.teacherClassList=async function(c){
  await v95ClassList(c);let members=await q('subject_members','user_id,role',x=>x.eq('subject_id',state.subjectId).eq('role','student')),ids=members.map(x=>x.user_id),profiles=ids.length?await q('profiles','id,full_name,email,mssv,last_login_at',x=>x.in('id',ids)):[];
  const table=$('table',c),head=table?.tHead?.rows?.[0];if(!head)return;
  if(head.cells[3])head.deleteCell(3);if(head.cells[3])head.cells[3].textContent='GPA';let loginHead=document.createElement('th');loginHead.textContent='Đăng nhập gần nhất';head.insertBefore(loginHead,head.cells[4]||null);
  $$('#classRows tr',c).forEach(row=>{if(row.cells.length<5)return;let email=row.cells[1]?.textContent?.trim(),profile=profiles.find(p=>p.email===email);row.deleteCell(3);let cell=document.createElement('td');cell.className='last-login-cell';cell.textContent=v95RelativeTime(profile?.last_login_at);cell.title=profile?.last_login_at?v94Time(profile.last_login_at):'Chưa từng đăng nhập';row.insertBefore(cell,row.lastElementChild);if(profile){let actions=row.lastElementChild,msg=document.createElement('button');msg.type='button';msg.className='message-student';msg.textContent='Nhắn tin';msg.onclick=e=>{e.stopPropagation();v95ComposeMessage(profile)};actions.append(msg)}});
 };
}

let v95RenderQueue=Promise.resolve();
async function v95RenderNow(){let c=$('#content');c.innerHTML='<div class="panel">Đang tải dữ liệu…</div>';try{let fn=state.view==='dashboard'?dashboard:state.view==='subjects'?subjects:state.view==='structure'?structure:state.view==='questions'?questions:state.view==='exams'?exams:state.view==='results'?results:state.view==='notifications'?notifications:state.view==='activity'?activity:state.view==='users'?users:dashboard;await fn(c);v95RefreshShell()}catch(ex){c.innerHTML=`<div class="panel"><b>Không thể tải dữ liệu</b><p>${esc(ex.message)}</p></div>`;err(ex)}}
render=function(){v95RenderQueue=v95RenderQueue.then(v95RenderNow,v95RenderNow);return v95RenderQueue};

document.addEventListener('DOMContentLoaded',()=>{
 $('#systemHomeBtn').onclick=()=>v95EnterSystem('dashboard');
 v95RefreshShell();
});
