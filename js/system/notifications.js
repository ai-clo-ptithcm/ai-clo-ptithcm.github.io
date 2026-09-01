/* AI-CLO PTITHCM V11 — notifications domain module.
 * Extracted from the legacy v9.2 layer without changing public behavior.
 */
(() => {
  'use strict';

  titles.notifications=['Thông báo','Bài kiểm tra, thời hạn và nhắc cải thiện'];

  const RPC_TTL=300000;
  const BADGE_TTL=30000;
  let notificationRefreshAt=0;

  const noticeTime=v=>v?new Intl.DateTimeFormat('vi-VN',{timeZone:'Asia/Ho_Chi_Minh',dateStyle:'short',timeStyle:'short'}).format(new Date(v)):'—';

  function badgeCacheKey(){return `notifications:unread:${state.user?.id||'guest'}`}
  function invalidateBadge(){window.AICLO_PERF?.invalidate?.('notifications:unread:')}

  async function unreadCount(force=false){
    if(!state.user?.id)return 0;
    const loader=async()=>{
      const {count,error}=await db.from('notifications').select('id',{count:'exact',head:true}).eq('user_id',state.user.id).is('read_at',null);
      if(error)throw error;
      return count||0;
    };
    if(window.AICLO_PERF?.memo)return window.AICLO_PERF.memo(badgeCacheKey(),BADGE_TTL,loader,{force});
    return loader();
  }

  async function refreshNotificationData(force=false){
    if(!state.user?.id)return;
    try{
      if(force||Date.now()-notificationRefreshAt>RPC_TTL){
        notificationRefreshAt=Date.now();
        const r=await db.rpc('refresh_my_notifications');
        if(r.error)console.warn(r.error);
      }
      const count=await unreadCount(force);
      const badge=$('#notificationCount');
      if(badge){badge.textContent=count||0;badge.hidden=!count}
    }catch(ex){console.warn('Không đồng bộ được thông báo',ex)}
  }

  function notificationCard(n){
    return `<button class="notice-card ${n.read_at?'read':''}" data-notice="${n.id}"><span class="notice-icon">${n.severity==='warning'?'!':'●'}</span><span><b>${esc(n.title)}</b><small>${esc(n.message)}</small><em>${noticeTime(n.created_at)}</em></span></button>`;
  }

  async function notifications(c){
    await refreshNotificationData(true);
    let items=await q('notifications','*',x=>x.eq('user_id',state.user.id).order('created_at',{ascending:false}).limit(200));
    c.innerHTML=`<div class="toolbar"><select id="noticeFilter"><option value="all">Tất cả</option><option value="unread">Chưa đọc</option><option value="exam">Bài kiểm tra</option><option value="clo">CLO</option><option value="activity">Hoạt động</option><option value="ai">AI</option></select><button id="readAll" class="secondary">Đánh dấu tất cả đã đọc</button></div><section class="panel notice-list" id="noticeList"></section>`;
    const draw=()=>{
      let f=$('#noticeFilter').value,list=items.filter(n=>f==='all'||(f==='unread'?!n.read_at:n.category===f));
      $('#noticeList').innerHTML=list.length?list.map(notificationCard).join(''):'<div class="empty">Không có thông báo phù hợp.</div>';
      $$('[data-notice]',$('#noticeList')).forEach(b=>b.onclick=()=>window.openNotification?.(b.dataset.notice,items));
    };
    draw();
    $('#noticeFilter').onchange=draw;
    $('#readAll').onclick=async()=>{
      let now=new Date().toISOString(),{error}=await db.from('notifications').update({read_at:now}).eq('user_id',state.user.id).is('read_at',null);
      if(error)return err(error);
      items.forEach(n=>n.read_at=n.read_at||now);
      draw();
      invalidateBadge();
      refreshNotificationData(true);
      toast('Đã đánh dấu tất cả là đã đọc');
    };
  }

  async function openNotification(id,items=[]){
    let n=items.find(x=>x.id===id);
    if(!n)return;
    if(!n.read_at){
      const now=new Date().toISOString();
      const {error}=await db.from('notifications').update({read_at:now}).eq('id',id);
      if(!error){n.read_at=now;invalidateBadge();refreshNotificationData(false)}
    }
    window.logActivity?.('read_notification','notification',id,'Đọc thông báo');
    navigate(n.target_view&&titles[n.target_view]?n.target_view:'notifications');
  }

  const previousDashboard=window.dashboard;
  window.dashboard=async function(c){
    await previousDashboard(c);
    try{
      await refreshNotificationData();
      let items=await q('notifications','*',x=>x.eq('user_id',state.user.id).is('read_at',null).order('created_at',{ascending:false}).limit(5)),box=document.createElement('section');
      box.className='panel task-center';
      box.innerHTML=`<div class="panel-head"><h3>Việc cần xử lý</h3><button id="allNotices">Xem tất cả</button></div>${items.length?items.map(notificationCard).join(''):'<p class="hint">Hiện không có việc mới.</p>'}`;
      c.append(box);
      $('#allNotices').onclick=()=>navigate('notifications');
      $$('[data-notice]',box).forEach(b=>b.onclick=()=>window.openNotification?.(b.dataset.notice,items));
    }catch(ex){console.warn(ex)}
  };

  window.notifications=notifications;
  window.openNotification=openNotification;
  window.refreshNotificationData=refreshNotificationData;

  const previousRender=window.render;
  window.render=async function(){
    let c=$('#content');
    c.innerHTML='<div class="panel">Đang tải dữ liệu…</div>';
    try{
      await ({dashboard,subjects,structure,questions,exams,results,notifications,activity,users}[state.view]||dashboard)(c);
      refreshNotificationData();
    }catch(ex){
      c.innerHTML=`<div class="panel"><b>Không thể tải dữ liệu</b><p>${esc(ex.message)}</p></div>`;
      err(ex);
    }
  };

  const bell=$('#notificationBell');
  if(bell)bell.onclick=()=>navigate('notifications');

  let tabHiddenAt=0;
  document.addEventListener('visibilitychange',()=>{
    if(document.hidden){tabHiddenAt=Date.now();return}
    if(tabHiddenAt&&Date.now()-tabHiddenAt>=RPC_TTL)refreshNotificationData(false);
    tabHiddenAt=0;
  });

  window.AICLO_NOTIFICATIONS=Object.freeze({refresh:refreshNotificationData,invalidate:invalidateBadge});
})();
