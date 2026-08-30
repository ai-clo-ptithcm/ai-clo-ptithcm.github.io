/* AI-CLO PTITHCM v9.2 — additive layer for notifications and six-month activity logs. */
titles.notifications=['Thông báo','Bài kiểm tra, thời hạn và nhắc cải thiện'];
titles.activity=['Nhật ký hoạt động','Hoạt động người dùng trong 6 tháng gần nhất'];
const viTime=v=>v?new Intl.DateTimeFormat('vi-VN',{timeZone:'Asia/Ho_Chi_Minh',dateStyle:'short',timeStyle:'short'}).format(new Date(v)):'—';
const activityLabels={login:'Đăng nhập',logout:'Đăng xuất',create:'Tạo mới',update:'Cập nhật',delete:'Xóa',export:'Xuất dữ liệu',read_notification:'Đọc thông báo'};
let notificationRefreshAt=0;

window.logActivity=async function(action,entityType='system',entityId=null,summary='',status='success',subjectId=null,metadata={}){
 try{if(!state.user?.id)return;await db.from('activity_logs').insert({user_id:state.user.id,subject_id:subjectId||state.subjectId||null,action,entity_type:entityType,entity_id:entityId||null,summary:String(summary).slice(0,500),status,metadata})}catch(ex){console.warn('Không ghi được nhật ký',ex)}
};

async function refreshNotificationData(force=false){
 if(!state.user)return;if(force||Date.now()-notificationRefreshAt>300000){notificationRefreshAt=Date.now();let r=await db.rpc('refresh_my_notifications');if(r.error)console.warn(r.error)}
 let {count,error}=await db.from('notifications').select('id',{count:'exact',head:true}).eq('user_id',state.user.id).is('read_at',null);if(error)return console.warn(error);let badge=$('#notificationCount');if(badge){badge.textContent=count||0;badge.hidden=!count}
}
function notificationCard(n){return `<button class="notice-card ${n.read_at?'read':''}" data-notice="${n.id}"><span class="notice-icon">${n.severity==='warning'?'!':'●'}</span><span><b>${esc(n.title)}</b><small>${esc(n.message)}</small><em>${viTime(n.created_at)}</em></span></button>`}
async function notifications(c){
 await refreshNotificationData(true);let items=await q('notifications','*',x=>x.eq('user_id',state.user.id).order('created_at',{ascending:false}).limit(200));
 c.innerHTML=`<div class="toolbar"><select id="noticeFilter"><option value="all">Tất cả</option><option value="unread">Chưa đọc</option><option value="exam">Bài kiểm tra</option><option value="clo">CLO</option><option value="activity">Hoạt động</option><option value="ai">AI</option></select><button id="readAll" class="secondary">Đánh dấu tất cả đã đọc</button></div><section class="panel notice-list" id="noticeList"></section>`;
 const draw=()=>{let f=$('#noticeFilter').value,list=items.filter(n=>f==='all'||(f==='unread'?!n.read_at:n.category===f));$('#noticeList').innerHTML=list.length?list.map(notificationCard).join(''):'<div class="empty">Không có thông báo phù hợp.</div>';$$('[data-notice]',$('#noticeList')).forEach(b=>b.onclick=()=>openNotification(b.dataset.notice,items))};draw();$('#noticeFilter').onchange=draw;
 $('#readAll').onclick=async()=>{let now=new Date().toISOString(),{error}=await db.from('notifications').update({read_at:now}).eq('user_id',state.user.id).is('read_at',null);if(error)return err(error);items.forEach(n=>n.read_at=n.read_at||now);draw();refreshNotificationData(true);toast('Đã đánh dấu tất cả là đã đọc')};
}
async function openNotification(id,items=[]){let n=items.find(x=>x.id===id);if(!n)return;if(!n.read_at)await db.from('notifications').update({read_at:new Date().toISOString()}).eq('id',id);logActivity('read_notification','notification',id,'Đọc thông báo');navigate(n.target_view&&titles[n.target_view]?n.target_view:'notifications')}

async function activity(c){
 if(!canTeach()){c.innerHTML='<div class="panel">Bạn không có quyền xem nhật ký hoạt động.</div>';return}
 let rows=await q('activity_logs','*, profiles:user_id(full_name,email,role), subjects:subject_id(name)',x=>x.gte('created_at',new Date(Date.now()-183*86400000).toISOString()).order('created_at',{ascending:false}).limit(5000));
 c.innerHTML=`<div class="toolbar activity-filter"><input id="logSearch" placeholder="Tìm người dùng hoặc hoạt động…"><select id="logAction"><option value="">Mọi hoạt động</option>${[...new Set(rows.map(x=>x.action))].map(x=>`<option value="${esc(x)}">${esc(activityLabels[x]||x)}</option>`).join('')}</select><input id="logFrom" type="date"><input id="logTo" type="date"><button id="exportLogs" class="primary">Xuất nhật ký Excel</button></div><div class="panel table-wrap"><p class="hint">Nhật ký chỉ được lưu 6 tháng.</p><table><thead><tr><th>Thời gian</th><th>Người dùng</th><th>Vai trò</th><th>Học phần</th><th>Hoạt động</th><th>Nội dung</th></tr></thead><tbody id="logRows"></tbody></table></div>`;
 let current=[];const draw=()=>{let s=$('#logSearch').value.toLowerCase(),a=$('#logAction').value,from=$('#logFrom').value?new Date($('#logFrom').value):null,to=$('#logTo').value?new Date($('#logTo').value+'T23:59:59'):null;current=rows.filter(x=>(!s||`${x.profiles?.full_name||''} ${x.profiles?.email||''} ${x.summary}`.toLowerCase().includes(s))&&(!a||x.action===a)&&(!from||new Date(x.created_at)>=from)&&(!to||new Date(x.created_at)<=to));$('#logRows').innerHTML=current.map(x=>`<tr><td>${viTime(x.created_at)}</td><td><b>${esc(x.profiles?.full_name||'—')}</b><br><small>${esc(x.profiles?.email||'')}</small></td><td>${esc(x.profiles?.role||'—')}</td><td>${esc(x.subjects?.name||'—')}</td><td>${esc(activityLabels[x.action]||x.action)}</td><td>${esc(x.summary)}</td></tr>`).join('')||'<tr><td colspan="6">Không có dữ liệu.</td></tr>'};draw();$$('#logSearch,#logAction,#logFrom,#logTo').forEach(x=>x.oninput=draw);
 $('#exportLogs').onclick=()=>{let data=current.map((x,i)=>({'STT':i+1,'Thời gian':viTime(x.created_at),'Họ tên':x.profiles?.full_name||'','Email':x.profiles?.email||'','Vai trò':x.profiles?.role||'','Học phần':x.subjects?.name||'','Hoạt động':activityLabels[x.action]||x.action,'Nội dung':x.summary||''})),wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(data),'Nhật ký hoạt động');XLSX.writeFile(wb,`Nhat-ky-hoat-dong_${new Date().toISOString().slice(0,10)}.xlsx`);logActivity('export','activity_logs',null,`Xuất ${current.length} dòng nhật ký`)};
}

const v91Dashboard=dashboard;dashboard=async c=>{await v91Dashboard(c);try{await refreshNotificationData();let items=await q('notifications','*',x=>x.eq('user_id',state.user.id).is('read_at',null).order('created_at',{ascending:false}).limit(5)),box=document.createElement('section');box.className='panel task-center';box.innerHTML=`<div class="panel-head"><h3>Việc cần xử lý</h3><button id="allNotices">Xem tất cả</button></div>${items.length?items.map(notificationCard).join(''):'<p class="hint">Hiện không có việc mới.</p>'}`;c.append(box);$('#allNotices').onclick=()=>navigate('notifications');$$('[data-notice]',box).forEach(b=>b.onclick=()=>openNotification(b.dataset.notice,items))}catch(ex){console.warn(ex)}};
render=async function(){let c=$('#content');c.innerHTML='<div class="panel">Đang tải dữ liệu…</div>';try{await ({dashboard,subjects,structure,questions,exams,results,notifications,activity,users}[state.view]||dashboard)(c);refreshNotificationData()}catch(ex){c.innerHTML=`<div class="panel"><b>Không thể tải dữ liệu</b><p>${esc(ex.message)}</p></div>`;err(ex)}};
$('#notificationBell').onclick=()=>navigate('notifications');
let tabHiddenAt=0;
document.addEventListener('visibilitychange',()=>{
 if(document.hidden){tabHiddenAt=Date.now();return}
 // Chuyển qua lại tab nhanh không được tải lại dữ liệu hoặc làm giao diện chớp.
 // Chỉ đồng bộ thông báo khi người dùng đã rời ứng dụng ít nhất 5 phút.
 if(tabHiddenAt&&Date.now()-tabHiddenAt>=300000)refreshNotificationData(false)
 tabHiddenAt=0
});
