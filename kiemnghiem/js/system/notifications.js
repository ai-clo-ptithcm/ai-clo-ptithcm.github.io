/* AI-CLO PTITHCM V11.6.21 — compact responsive notification center. */
(() => {
  'use strict';

  titles.notifications=['Thông báo','Bài kiểm tra, thời hạn và nhắc cải thiện'];

  const RPC_TTL=300000;
  const BADGE_TTL=30000;
  const DASHBOARD_NOTICE_TTL=30000;
  const DISMISSED_TTL=60000;
  let notificationRefreshAt=0;
  let dismissSupported=null;
  let dismissedCache={at:0,ids:new Set()};
  let pruneQueued=false;

  const dateKey=v=>v?new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Ho_Chi_Minh',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(v)):'';
  const timeOnly=v=>v?new Intl.DateTimeFormat('vi-VN',{timeZone:'Asia/Ho_Chi_Minh',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(v)):'—';
  const dateOnly=v=>v?new Intl.DateTimeFormat('vi-VN',{timeZone:'Asia/Ho_Chi_Minh',day:'2-digit',month:'2-digit',year:'numeric'}).format(new Date(v)):'—';
  const todayKey=()=>dateKey(new Date());
  const yesterdayKey=()=>dateKey(new Date(Date.now()-86400000));
  const friendlyTime=v=>{
    if(!v)return'—';
    const key=dateKey(v),time=timeOnly(v);
    if(key===todayKey())return`Hôm nay · ${time}`;
    if(key===yesterdayKey())return`Hôm qua · ${time}`;
    return `${dateOnly(v)} · ${time}`;
  };

  function badgeCacheKey(){return `notifications:unread:${state.user?.id||'guest'}`}
  function dashboardNoticeKey(){return `notifications:dashboard:${state.user?.id||'guest'}`}
  function invalidateBadge(){window.AICLO_PERF?.invalidate?.('notifications:unread:')}
  function invalidateNoticeLists(){window.AICLO_PERF?.invalidate?.('notifications:dashboard:')}
  function isMissingDismissColumn(error){const text=`${error?.code||''} ${error?.message||''} ${error?.details||''}`.toLowerCase();return text.includes('dismissed_at')&&(text.includes('column')||text.includes('42703'))}

  async function detectDismissSupport(force=false){
    if(!force&&dismissSupported!==null)return dismissSupported;
    try{
      const {error}=await db.from('notifications').select('dismissed_at').limit(1);
      if(error){dismissSupported=false;if(!isMissingDismissColumn(error))console.warn('Không kiểm tra được trạng thái xóa thông báo',error)}
      else dismissSupported=true;
    }catch{dismissSupported=false}
    return dismissSupported;
  }

  async function unreadCount(force=false){
    if(!state.user?.id)return 0;
    await detectDismissSupport();
    const loader=async()=>{
      let query=db.from('notifications').select('id',{count:'exact',head:true}).eq('user_id',state.user.id).is('read_at',null);
      if(dismissSupported)query=query.is('dismissed_at',null);
      const {count,error}=await query;
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

  function noticeIcon(n){
    const title=String(n?.title||'').toLowerCase();
    if(n?.category==='ai')return'✦';
    if(title.includes('hết hạn'))return'⏰';
    if(n?.category==='exam')return'📝';
    if(n?.category==='clo')return'◎';
    if(n?.category==='activity')return'👤';
    if(n?.category==='system')return'⚙';
    return n?.severity==='warning'?'!':'●';
  }
  const categoryLabel=n=>n?.category==='ai'?'AI':n?.category==='exam'?'Đánh giá':n?.category==='clo'?'CLO':n?.category==='activity'?'Hoạt động':'Hệ thống';

  function dashboardNotificationCard(n){
    return `<button class="notice-card ${n.read_at?'read':''}" data-notice="${n.id}"><span class="notice-icon">${noticeIcon(n)}</span><span><b>${esc(n.title)}</b><small>${esc(n.message)}</small><em>${friendlyTime(n.created_at)}</em></span></button>`;
  }

  function centerNotificationCard(n){
    return `<article class="notice-center-card ${n.read_at?'read':'unread'}" data-notice-card="${n.id}">
      <button type="button" class="notice-center-main" data-notice-open="${n.id}">
        <span class="notice-center-icon">${noticeIcon(n)}</span>
        <span class="notice-center-copy"><span class="notice-center-top"><b>${esc(n.title)}</b><span class="notice-kind">${esc(categoryLabel(n))}</span></span><small>${esc(n.message)}</small><em>${friendlyTime(n.created_at)}</em></span>
      </button>
      <button type="button" class="notice-more" data-notice-menu-trigger="${n.id}" aria-label="Thao tác thông báo" title="Thao tác">⋯</button>
      <div class="notice-card-menu" data-notice-menu="${n.id}" hidden>
        <button type="button" data-notice-action="toggle-read" data-notice-id="${n.id}">${n.read_at?'Đánh dấu chưa đọc':'Đánh dấu đã đọc'}</button>
        <button type="button" class="danger-link" data-notice-action="dismiss" data-notice-id="${n.id}">Xóa thông báo</button>
      </div>
    </article>`;
  }

  function filterMatches(n,filter){
    if(filter==='all')return true;
    if(filter==='unread')return !n.read_at;
    if(filter==='ai')return n.category==='ai';
    if(filter==='assessment')return n.category==='exam'||n.category==='clo';
    if(filter==='system')return n.category==='activity'||n.category==='system';
    return true;
  }

  function groupedNoticeHtml(list){
    if(!list.length)return'<div class="empty notice-empty"><b>Không có thông báo phù hợp</b><span>Thông báo mới sẽ xuất hiện tại đây.</span></div>';
    const today=[],older=[];for(const n of list)(dateKey(n.created_at)===todayKey()?today:older).push(n);
    const group=(title,rows)=>rows.length?`<section class="notice-day-group"><h4>${title}</h4><div>${rows.map(centerNotificationCard).join('')}</div></section>`:'';
    return group('Hôm nay',today)+group('Trước đó',older);
  }

  function closeNoticeMenus(){
    document.querySelectorAll('.notice-card-menu,.notice-page-menu').forEach(x=>x.hidden=true);
    document.querySelectorAll('.notice-center-card.menu-open,.notice-page-menu-wrap.menu-open').forEach(x=>x.classList.remove('menu-open'));
  }

  async function activeNotifications(){
    await detectDismissSupport();
    let query=db.from('notifications').select('*').eq('user_id',state.user.id).order('created_at',{ascending:false}).limit(200);
    if(dismissSupported)query=query.is('dismissed_at',null);
    const {data,error}=await query;if(error)throw error;return data||[];
  }

  async function loadDismissedIds(force=false){
    if(!dismissSupported||!state.user?.id)return new Set();
    if(!force&&Date.now()-dismissedCache.at<DISMISSED_TTL)return dismissedCache.ids;
    const {data,error}=await db.from('notifications').select('id').eq('user_id',state.user.id).not('dismissed_at','is',null).limit(300);
    if(error)return dismissedCache.ids;
    dismissedCache={at:Date.now(),ids:new Set((data||[]).map(x=>String(x.id)))};
    return dismissedCache.ids;
  }

  async function pruneLegacyDashboardNotices(){
    const list=document.querySelector('.v109-notice-list');if(!list)return;
    await detectDismissSupport();if(!dismissSupported)return;
    const ids=await loadDismissedIds();
    list.querySelectorAll('[data-v109-notice]').forEach(card=>{if(ids.has(String(card.dataset.v109Notice)))card.remove()});
    if(!list.querySelector('[data-v109-notice]')&&!list.querySelector('.empty'))list.innerHTML='<div class="empty"><b>Chưa có thông báo</b><span>Thông báo mới sẽ xuất hiện tại đây.</span></div>';
  }
  function queueDashboardPrune(){if(pruneQueued)return;pruneQueued=true;requestAnimationFrame(()=>{pruneQueued=false;pruneLegacyDashboardNotices().catch(()=>{})})}

  async function notifications(c){
    await refreshNotificationData(false);
    let items=await activeNotifications();
    const filterKey=`aiclo:v11621:notice-filter:${state.user?.id||'user'}`;
    let currentFilter='all';try{currentFilter=sessionStorage.getItem(filterKey)||'all'}catch{}
    if(!['all','unread','ai','assessment','system'].includes(currentFilter))currentFilter='all';
    c.innerHTML=`<div class="notification-center" data-notification-center>
      <div class="notice-center-toolbar">
        <select id="noticeFilterMobile" class="notice-filter-mobile" aria-label="Lọc thông báo">
          <option value="all">Tất cả</option><option value="unread">Chưa đọc</option><option value="ai">AI</option><option value="assessment">Đánh giá</option><option value="system">Hệ thống</option>
        </select>
        <div class="notice-filter-chips" role="group" aria-label="Lọc thông báo">
          <button type="button" data-notice-filter="all">Tất cả</button>
          <button type="button" data-notice-filter="unread">Chưa đọc <span id="noticeUnreadCount">0</span></button>
          <button type="button" data-notice-filter="ai">✦ AI</button>
          <button type="button" data-notice-filter="assessment">📝 Đánh giá</button>
          <button type="button" data-notice-filter="system">⚙ Hệ thống</button>
        </div>
        <div class="notice-toolbar-actions">
          <button id="readAll" type="button" class="secondary">Đánh dấu tất cả đã đọc</button>
          <button id="dismissRead" type="button" class="secondary">Xóa đã đọc</button>
        </div>
        <div class="notice-page-menu-wrap">
          <button id="noticePageMenuTrigger" type="button" class="secondary notice-page-menu-trigger" aria-label="Thao tác thông báo">⋯</button>
          <div id="noticePageMenu" class="notice-page-menu" hidden><button type="button" data-page-notice-action="read-all">Đánh dấu tất cả đã đọc</button><button type="button" data-page-notice-action="dismiss-read">Xóa đã đọc</button></div>
        </div>
      </div>
      <section class="panel notification-center-list" id="noticeList"></section>
    </div>`;

    const saveFilter=()=>{try{sessionStorage.setItem(filterKey,currentFilter)}catch{}};
    const draw=()=>{
      const unread=items.filter(n=>!n.read_at).length;
      const count=$('#noticeUnreadCount');if(count)count.textContent=String(unread);
      const mobile=$('#noticeFilterMobile');if(mobile)mobile.value=currentFilter;
      $$('[data-notice-filter]').forEach(b=>b.classList.toggle('active',b.dataset.noticeFilter===currentFilter));
      const list=items.filter(n=>filterMatches(n,currentFilter));
      $('#noticeList').innerHTML=groupedNoticeHtml(list);
      $('#readAll').disabled=!unread;
      $('#dismissRead').disabled=!items.some(n=>n.read_at)||!dismissSupported;
    };

    async function setRead(n,read){
      const readAt=read?new Date().toISOString():null;
      const {error}=await db.from('notifications').update({read_at:readAt}).eq('id',n.id).eq('user_id',state.user.id);
      if(error)throw error;n.read_at=readAt;invalidateBadge();invalidateNoticeLists();draw();refreshNotificationData(false);
    }
    async function dismissOne(n){
      if(!dismissSupported)return toast('Cần chạy migration V11.6.21 trên Supabase trước khi dùng chức năng Xóa thông báo.',true);
      if(!n.read_at){const ok=await confirmAction('Xóa thông báo chưa đọc','Thông báo này chưa được đọc. Bạn vẫn muốn xóa khỏi Trung tâm thông báo?',{confirmLabel:'Xóa',danger:true});if(!ok)return}
      const now=new Date().toISOString(),{error}=await db.from('notifications').update({dismissed_at:now,read_at:n.read_at||now}).eq('id',n.id).eq('user_id',state.user.id);
      if(error)throw error;
      items=items.filter(x=>x.id!==n.id);dismissedCache.ids.add(String(n.id));dismissedCache.at=Date.now();invalidateBadge();invalidateNoticeLists();window.logActivity?.('dismiss_notification','notification',n.id,'Xóa thông báo khỏi trung tâm');draw();refreshNotificationData(true);queueDashboardPrune();toast('Đã xóa thông báo');
    }
    async function markAllRead(){
      const pending=items.filter(n=>!n.read_at);if(!pending.length)return;
      const now=new Date().toISOString(),{error}=await db.from('notifications').update({read_at:now}).eq('user_id',state.user.id).is('read_at',null);
      if(error)throw error;pending.forEach(n=>n.read_at=now);draw();invalidateBadge();invalidateNoticeLists();refreshNotificationData(true);toast('Đã đánh dấu tất cả là đã đọc');
    }
    async function dismissRead(){
      if(!dismissSupported)return toast('Cần chạy migration V11.6.21 trên Supabase trước khi dùng chức năng Xóa đã đọc.',true);
      const read=items.filter(n=>n.read_at);if(!read.length)return toast('Không có thông báo đã đọc để xóa');
      if(!await confirmAction('Xóa các thông báo đã đọc',`Xóa ${read.length} thông báo đã đọc khỏi Trung tâm thông báo? Nhật ký hoạt động không bị ảnh hưởng.`,{confirmLabel:'Xóa đã đọc',danger:true}))return;
      const now=new Date().toISOString(),ids=read.map(n=>n.id);const {error}=await db.from('notifications').update({dismissed_at:now}).eq('user_id',state.user.id).not('read_at','is',null).is('dismissed_at',null);
      if(error)throw error;items=items.filter(n=>!n.read_at);ids.forEach(id=>dismissedCache.ids.add(String(id)));dismissedCache.at=Date.now();invalidateBadge();invalidateNoticeLists();draw();refreshNotificationData(true);queueDashboardPrune();toast(`Đã xóa ${read.length} thông báo đã đọc`);
    }

    $('#noticeFilterMobile').onchange=e=>{currentFilter=e.target.value;saveFilter();draw()};
    $('.notice-filter-chips').onclick=e=>{const b=e.target.closest('[data-notice-filter]');if(!b)return;currentFilter=b.dataset.noticeFilter;saveFilter();draw()};
    $('#readAll').onclick=()=>markAllRead().catch(err);
    $('#dismissRead').onclick=()=>dismissRead().catch(err);
    $('#noticePageMenuTrigger').onclick=e=>{e.stopPropagation();const panel=$('#noticePageMenu'),open=panel.hidden;closeNoticeMenus();panel.hidden=!open;panel.parentElement.classList.toggle('menu-open',open)};
    $('#noticePageMenu').onclick=e=>{const b=e.target.closest('[data-page-notice-action]');if(!b)return;closeNoticeMenus();(b.dataset.pageNoticeAction==='read-all'?markAllRead():dismissRead)().catch(err)};
    $('#noticeList').onclick=e=>{
      const trigger=e.target.closest('[data-notice-menu-trigger]');if(trigger){e.stopPropagation();const panel=$(`[data-notice-menu="${trigger.dataset.noticeMenuTrigger}"]`),open=panel?.hidden;closeNoticeMenus();if(panel){panel.hidden=!open;panel.closest('.notice-center-card')?.classList.toggle('menu-open',open)}return}
      const action=e.target.closest('[data-notice-action]');if(action){e.stopPropagation();const n=items.find(x=>x.id===action.dataset.noticeId);if(!n)return;closeNoticeMenus();(action.dataset.noticeAction==='toggle-read'?setRead(n,!n.read_at):dismissOne(n)).catch(err);return}
      const open=e.target.closest('[data-notice-open]');if(open){const n=items.find(x=>x.id===open.dataset.noticeOpen);if(!n)return;const result=window.openNotification?.(n.id,items);Promise.resolve(result).finally(()=>draw())}
    };
    draw();
  }

  async function openNotification(id,items=[]){
    let n=items.find(x=>x.id===id);
    if(!n)return;
    if(!n.read_at){
      const now=new Date().toISOString();
      const {error}=await db.from('notifications').update({read_at:now}).eq('id',id);
      if(!error){n.read_at=now;invalidateBadge();invalidateNoticeLists();refreshNotificationData(false)}
    }
    window.logActivity?.('read_notification','notification',id,'Đọc thông báo');
    navigate(n.target_view&&titles[n.target_view]?n.target_view:'notifications');
  }

  const previousDashboard=window.dashboard;
  window.dashboard=async function(c){
    await previousDashboard(c);
    try{
      await refreshNotificationData(false);await detectDismissSupport();
      const loader=async()=>{let query=db.from('notifications').select('*').eq('user_id',state.user.id).is('read_at',null).order('created_at',{ascending:false}).limit(5);if(dismissSupported)query=query.is('dismissed_at',null);const {data,error}=await query;if(error)throw error;return data||[]};
      let items=window.AICLO_PERF?.memo?await window.AICLO_PERF.memo(dashboardNoticeKey(),DASHBOARD_NOTICE_TTL,loader):await loader(),box=document.createElement('section');
      box.className='panel task-center';
      box.innerHTML=`<div class="panel-head"><h3>Việc cần xử lý</h3><button id="allNotices">Xem tất cả</button></div>${items.length?items.map(dashboardNotificationCard).join(''):'<p class="hint">Hiện không có việc mới.</p>'}`;
      c.append(box);
      $('#allNotices').onclick=()=>navigate('notifications');
      $$('[data-notice]',box).forEach(b=>b.onclick=()=>window.openNotification?.(b.dataset.notice,items));
    }catch(ex){console.warn(ex)}
  };

  window.notifications=notifications;
  window.openNotification=openNotification;
  window.refreshNotificationData=refreshNotificationData;

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
  document.addEventListener('click',e=>{if(!e.target.closest('.notice-card-menu,.notice-more,.notice-page-menu,.notice-page-menu-trigger'))closeNoticeMenus()});

  const content=$('#content');if(content)new MutationObserver(()=>{if(document.querySelector('.v109-notice-list'))queueDashboardPrune()}).observe(content,{childList:true,subtree:true});

  window.AICLO_NOTIFICATIONS=Object.freeze({refresh:refreshNotificationData,invalidate:()=>{invalidateBadge();invalidateNoticeLists()},dismissSupported:()=>dismissSupported});
})();
