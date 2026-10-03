-- KPI CB2: additive schema. Existing PTITHCM AI-CLO accounts and policies are unchanged.
begin;
create table public.kpi_settings (
 id boolean primary key default true check(id), pin_hash text, pin_code text check(pin_code ~ '^[0-9]{4}$'), pin_version integer not null default 1,
 sheet_id text not null default '17G1lAcjt5iaAwtT3rYU_ofnwN_9rwuOzZYBDbNylTbM', sheet_name text not null default 'Câu trả lời biểu mẫu 1',
 form_url text not null default 'https://docs.google.com/forms/d/e/1FAIpQLSeottKcoUj5tdWL6tBdxZPffA9br8OfSWAeQIHCd8JITw3iGw/viewform?usp=dialog',
 auto_sync boolean not null default true, sync_minutes integer not null default 15 check(sync_minutes between 5 and 1440),
 synced_at timestamptz, sync_error text, sync_lease uuid, lease_until timestamptz
);
insert into public.kpi_settings(id) values(true);
create table public.kpi_managers(user_id uuid primary key references public.profiles(id), assigned_by uuid references public.profiles(id),created_at timestamptz not null default now());
create table public.kpi_metrics(id uuid primary key default gen_random_uuid(),code text not null unique,name text not null,unit text not null default 'Hồ sơ',method text not null check(method in('sum','people','stock','ratio')),visible boolean not null default true,archived boolean not null default false,position integer not null default 0);
create table public.kpi_plans(metric_id uuid references public.kpi_metrics(id),year integer check(year between 2000 and 2100),target numeric check(target>=0),deadline date,active boolean not null default true,primary key(metric_id,year));
create table public.kpi_months(metric_id uuid references public.kpi_metrics(id),year integer check(year between 2000 and 2100),month integer check(month between 1 and 12),value numeric check(value>=0),numerator numeric check(numerator>=0),denominator numeric check(denominator>0),reason text not null default '',updated_at timestamptz not null default now(),primary key(metric_id,year,month));
create table public.kpi_records(
 id uuid primary key default gen_random_uuid(),source_key text unique,source_data jsonb not null default '{}',source_hash text,
 effective jsonb not null default '{}',metric_id uuid references public.kpi_metrics(id),year integer not null check(year between 2000 and 2100),month integer not null check(month between 1 and 12),
 status text not null default 'pending' check(status in('pending','approved','rejected','archived')),source_changed boolean not null default false,
 review_note text not null default '',reviewed_by uuid references public.profiles(id),reviewed_at timestamptz,version integer not null default 1,created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create index kpi_records_period on public.kpi_records(year,month,status);
create table public.kpi_audit(id bigint generated always as identity primary key,actor uuid references public.profiles(id),action text not null,object_id text,details jsonb not null default '{}',created_at timestamptz not null default now());
create table public.kpi_view_sessions(token_hash text primary key,pin_version integer not null,expires_at timestamptz not null);
create table public.kpi_rates(key text primary key,window_start timestamptz not null default now(),attempts integer not null default 0);
insert into public.kpi_metrics(code,name,unit,method,position) values
 ('I.10','Bài giảng điện tử xây dựng mới / học liệu số','Bài giảng','sum',10),
 ('II.1','Công bố WoS/Scopus','Bài','sum',20),('II.2','Patent đăng ký mới','Đơn','sum',30),
 ('II.3','Sản phẩm, giải pháp KHCN, bản quyền sáng tạo','GCN','sum',40),
 ('II.9','Nhiệm vụ KHCN cấp Bộ/tương đương trở lên đang thực hiện','Nhiệm vụ','stock',50),
 ('III.1_dl2','Chuyên gia nước ngoài / Việt kiều tham gia giảng dạy, nghiên cứu','Người','people',60),
 ('III.2','Hội thảo quốc tế chủ trì / phối hợp tổ chức','Hội thảo','sum',70),
 ('IV.4','Hoạt động ngoại khóa cho sinh viên','Hoạt động','sum',80),
 ('V.1','Lao động mới','Người','sum',90),('V.2','Tỷ lệ giảng viên có trình độ tiến sĩ','%','ratio',100),
 ('VII.5','Tỷ lệ hài lòng của người học về hoạt động giảng dạy','%','ratio',110);
-- All application data is server-only. Even a signed-in student cannot read it via REST.
do $$ declare t text;begin
 foreach t in array array['kpi_settings','kpi_managers','kpi_metrics','kpi_plans','kpi_months','kpi_records','kpi_audit','kpi_view_sessions','kpi_rates'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from anon, authenticated',t);
 execute format('grant all on public.%I to service_role',t);
 end loop;
end $$;
grant usage,select on sequence public.kpi_audit_id_seq to service_role;
create function public.kpi_gateway(p_action text,p_payload jsonb default '{}',p_actor uuid default null) returns jsonb
language plpgsql security invoker set search_path=pg_catalog,public,extensions as $$
declare s public.kpi_settings; metricrow public.kpi_metrics; r public.kpi_records; idv uuid; owner boolean:=false; manager boolean:=false;
 v jsonb; outv jsonb; yy integer; mm integer; n numeric; token text; keyv text; attempts integer; old jsonb; changed integer; item jsonb;
begin
 select * into s from public.kpi_settings where id;
 if p_action='unlock' then
  perform pg_advisory_xact_lock(hashtext('kpi-pin'));
  delete from public.kpi_rates where window_start<now()-interval '1 day';
  foreach keyv in array array['all',coalesce(p_payload->>'client','unknown')] loop
   insert into public.kpi_rates(key) values(keyv) on conflict do nothing;
   update public.kpi_rates set attempts=case when window_start<now()-interval '5 minutes' then 1 else public.kpi_rates.attempts+1 end,
    window_start=case when window_start<now()-interval '5 minutes' then now() else window_start end where key=keyv returning public.kpi_rates.attempts into attempts;
   if attempts>(case when keyv='all' then 60 else 8 end) then return jsonb_build_object('error','Nhập mã quá nhiều lần. Thử lại sau 5 phút.','status',429);end if;
  end loop;
  if s.pin_hash is null or coalesce(p_payload->>'code','') !~ '^[0-9]{4}$' or extensions.crypt(p_payload->>'code',s.pin_hash)<>s.pin_hash then return jsonb_build_object('error','Mã không đúng hoặc chưa được thiết lập.','status',403);end if;
  token:=encode(extensions.gen_random_bytes(32),'hex');
  delete from public.kpi_view_sessions where expires_at<now() or pin_version<>s.pin_version;
  insert into public.kpi_view_sessions values(encode(extensions.digest(token,'sha256'),'hex'),s.pin_version,now()+interval '2 hours');
  return jsonb_build_object('token',token,'expires_at',now()+interval '2 hours');
 end if;
 if p_actor is not null then
  select role='admin' into owner from public.profiles where id=p_actor and is_active and locked_at is null;
  owner:=coalesce(owner,false);
  select owner or exists(select 1 from public.kpi_managers km join public.profiles p on p.id=km.user_id where p.id=p_actor and p.is_active and p.locked_at is null and p.role in('teacher','lecturer','giangvien')) into manager;
 end if;
 if p_action='view' then
  if not exists(select 1 from public.kpi_view_sessions where token_hash=encode(extensions.digest(coalesce(p_payload->>'token',''),'sha256'),'hex') and expires_at>now() and pin_version=s.pin_version) then return jsonb_build_object('error','Phiên xem đã hết hạn. Nhập lại mã.','status',401);end if;
 elsif not manager then raise exception 'Không có quyền quản lý KPI' using errcode='42501';end if;
 yy:=coalesce((p_payload->>'year')::integer,extract(year from now() at time zone 'Asia/Ho_Chi_Minh')::integer);
 if yy<2000 or yy>2100 then raise exception 'Năm không hợp lệ';end if;
 if p_action in('view','load') then
  return jsonb_build_object('owner',owner,'year',yy,
   'metrics',(select coalesce(jsonb_agg(to_jsonb(t) order by t.position,t.code),'[]') from public.kpi_metrics t where p_action='load' or (visible and not archived and not exists(select 1 from public.kpi_plans kp where kp.metric_id=t.id and kp.year=yy and not kp.active))),
   'plans',(select coalesce(jsonb_agg(to_jsonb(t)),'[]') from public.kpi_plans t join public.kpi_metrics m on m.id=t.metric_id where t.year=yy and (p_action='load' or (m.visible and not m.archived and not exists(select 1 from public.kpi_plans kp where kp.metric_id=m.id and kp.year=yy and not kp.active)))),
   'months',(select coalesce(jsonb_agg(to_jsonb(t)),'[]') from public.kpi_months t join public.kpi_metrics m on m.id=t.metric_id where t.year=yy and (p_action='load' or (m.visible and not m.archived and not exists(select 1 from public.kpi_plans kp where kp.metric_id=m.id and kp.year=yy and not kp.active)))),
   'records',(select coalesce(jsonb_agg(case when p_action='load' then to_jsonb(t) else jsonb_build_object('id',t.id,'metric_id',t.metric_id,'year',t.year,'month',t.month,'effective',t.effective,'status',t.status) end order by t.updated_at desc),'[]') from public.kpi_records t left join public.kpi_metrics m on m.id=t.metric_id where (t.year=yy or m.method='stock') and (p_action='load' or (t.status='approved' and m.visible and not m.archived and not exists(select 1 from public.kpi_plans kp where kp.metric_id=m.id and kp.year=yy and not kp.active)))),
   'settings',case when p_action='load' then to_jsonb(s)-'pin_hash'-'pin_code'-'sync_lease'-'lease_until' else jsonb_build_object('form_url',s.form_url) end,
   'current_code',case when owner and p_action='load' then s.pin_code else null end,
   'pin_set',case when p_action='load' then s.pin_hash is not null else null end,
   'managers',case when owner and p_action='load' then (select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'name',p.full_name,'email',p.email,'assigned',km.user_id is not null)),'[]') from public.profiles p left join public.kpi_managers km on km.user_id=p.id where p.role in('teacher','lecturer','giangvien') and p.is_active and p.locked_at is null) else '[]'::jsonb end,
   'audit',case when p_action='load' then (select coalesce(jsonb_agg(t),'[]') from (select a.*,coalesce(p.full_name,p.email,'Đồng bộ Google') as actor_name from public.kpi_audit a left join public.profiles p on p.id=a.actor order by a.id desc limit 100)t) else '[]'::jsonb end);
 end if;
 if p_action='metric' then
  v:=p_payload;idv:=nullif(v->>'id','')::uuid;
  if length(trim(coalesce(v->>'name','')))<1 or length(v->>'name')>500 or length(trim(coalesce(v->>'code','')))<1 or length(v->>'code')>50 then raise exception 'Nhập mã và tên KPI';end if;
  if idv is null then insert into public.kpi_metrics(code,name,unit,method,position,visible,archived) values(trim(v->>'code'),trim(v->>'name'),coalesce(v->>'unit',''),v->>'method',coalesce((v->>'position')::integer,0),coalesce((v->>'visible')::boolean,true),false) returning id into idv;
  else
   if exists(select 1 from public.kpi_records where metric_id=idv and status='approved') and exists(select 1 from public.kpi_metrics where id=idv and method<>v->>'method') then raise exception 'KPI đã có hồ sơ được duyệt. Tạo mục mới nếu cần đổi cách tính.';end if;
   update public.kpi_metrics set code=trim(v->>'code'),name=trim(v->>'name'),unit=coalesce(v->>'unit',''),method=v->>'method',position=coalesce((v->>'position')::integer,0),visible=coalesce((v->>'visible')::boolean,true),archived=coalesce((v->>'archived')::boolean,false) where id=idv;
   if not found then raise exception 'Không tìm thấy KPI';end if;
  end if;
 elsif p_action='plan' then
  idv:=(p_payload->>'metric_id')::uuid; select * into metricrow from public.kpi_metrics where id=idv;
  n:=nullif(p_payload->>'target','')::numeric;
  if metricrow.method='ratio' and n>100 then raise exception 'Chỉ tiêu tỷ lệ tối đa 100%%';end if;
  insert into public.kpi_plans values(idv,yy,n,nullif(p_payload->>'deadline','')::date,coalesce((p_payload->>'active')::boolean,true)) on conflict(metric_id,year) do update set target=excluded.target,deadline=excluded.deadline,active=excluded.active;
 elsif p_action='month' then
  idv:=(p_payload->>'metric_id')::uuid;mm:=(p_payload->>'month')::integer;select * into metricrow from public.kpi_metrics where id=idv;
  n:=nullif(p_payload->>'value','')::numeric;
  if nullif(p_payload->>'numerator','') is not null or nullif(p_payload->>'denominator','') is not null then
   if metricrow.method<>'ratio' or nullif(p_payload->>'denominator','') is null or (p_payload->>'denominator')::numeric<=0 or nullif(p_payload->>'numerator','') is null or (p_payload->>'numerator')::numeric<0 or (p_payload->>'numerator')::numeric>(p_payload->>'denominator')::numeric then raise exception 'Kiểm tra tử số / mẫu số của tỷ lệ';end if;
   n:=100*(p_payload->>'numerator')::numeric/(p_payload->>'denominator')::numeric;
  end if;
  if metricrow.method='ratio' and n>100 then raise exception 'Tỷ lệ tối đa 100%%';end if;
  if n is not null and length(trim(coalesce(p_payload->>'reason','')))=0 then raise exception 'Ghi chú nguồn số liệu hoặc lý do điều chỉnh';end if;
  insert into public.kpi_months values(idv,yy,mm,n,nullif(p_payload->>'numerator','')::numeric,nullif(p_payload->>'denominator','')::numeric,coalesce(p_payload->>'reason',''),now()) on conflict(metric_id,year,month) do update set value=excluded.value,numerator=excluded.numerator,denominator=excluded.denominator,reason=excluded.reason,updated_at=now();
 elsif p_action='record' then
  v:=p_payload->'effective';idv:=nullif(p_payload->>'id','')::uuid;mm:=(p_payload->>'month')::integer;
  if v is null or jsonb_typeof(v)<>'object' or length(trim(coalesce(v->>'title','')))=0 or length(v->>'title')>1000 then raise exception 'Nhập tên hồ sơ';end if;
  if length(v::text)>30000 then raise exception 'Hồ sơ quá dài';end if;
  if coalesce(p_payload->>'status','pending') not in('pending','approved','rejected','archived') then raise exception 'Trạng thái không hợp lệ';end if;
  if p_payload->>'status'='approved' then
   select * into metricrow from public.kpi_metrics where id=nullif(p_payload->>'metric_id','')::uuid and not archived;
   if not found then raise exception 'Chọn KPI trước khi duyệt';end if;
   if metricrow.code in('V.1','V.2','VII.5') then raise exception 'KPI này được nhập ở Số liệu tháng';end if;
   if metricrow.method='people' and length(trim(coalesce(v->>'dedup_key','')))=0 then raise exception 'Nhập định danh chuyên gia để đếm người duy nhất';end if;
   if metricrow.method='ratio' then raise exception 'KPI tỷ lệ được nhập ở Số liệu tháng';end if;
   if coalesce(nullif(v->>'quantity','')::numeric,1)<=0 then raise exception 'Số lượng phải lớn hơn 0';end if;
   if metricrow.method='stock' and nullif(v->>'start_date','') is null then raise exception 'Nhập ngày bắt đầu nhiệm vụ trước khi duyệt';end if;
   perform pg_advisory_xact_lock(hashtext(metricrow.id::text||':'||yy::text));
   if nullif(v->>'start_date','') is not null then perform (v->>'start_date')::date;end if;
   if nullif(v->>'end_date','') is not null then perform (v->>'end_date')::date;end if;
   if nullif(v->>'end_date','') is not null and (v->>'end_date')::date<(v->>'start_date')::date then raise exception 'Ngày kết thúc phải sau ngày bắt đầu';end if;
   if exists(select 1 from public.kpi_records t where t.id is distinct from idv and t.metric_id=metricrow.id and t.status='approved' and t.year=yy and lower(trim(t.effective->>'dedup_key'))=lower(trim(v->>'dedup_key')) and length(trim(coalesce(v->>'dedup_key','')))>0) then raise exception 'Mã định danh đã được duyệt trong năm này. Kiểm tra trùng hồ sơ';end if;
  end if;
  if idv is null then insert into public.kpi_records(effective,metric_id,year,month,status,review_note,reviewed_by,reviewed_at) values(v,nullif(p_payload->>'metric_id','')::uuid,yy,mm,coalesce(p_payload->>'status','pending'),coalesce(p_payload->>'review_note',''),p_actor,case when p_payload->>'status'='approved' then now() end) returning id into idv;
  else
   update public.kpi_records set effective=v,metric_id=nullif(p_payload->>'metric_id','')::uuid,year=yy,month=mm,status=coalesce(p_payload->>'status','pending'),review_note=coalesce(p_payload->>'review_note',''),reviewed_by=p_actor,reviewed_at=case when p_payload->>'status'='approved' then now() end,source_changed=false,version=version+1,updated_at=now() where id=idv and version=(p_payload->>'version')::integer;
   if not found then raise exception 'Hồ sơ đã thay đổi. Tải lại trước khi lưu';end if;
  end if;
 elsif p_action='settings' then
  if coalesce(p_payload->>'sheet_id','') !~ '^[A-Za-z0-9_-]{20,100}$' or length(trim(coalesce(p_payload->>'sheet_name','')))=0 then raise exception 'Kiểm tra ID và tên Sheet';end if;
  if coalesce(p_payload->>'form_url','') !~ '^https://(docs.google.com/forms/|forms.gle/)' then raise exception 'Link Form phải là Google Forms';end if;
  if s.lease_until>now() then raise exception 'Đang đồng bộ. Chờ hoàn tất trước khi đổi nguồn';end if;
  update public.kpi_settings set sheet_id=p_payload->>'sheet_id',sheet_name=trim(p_payload->>'sheet_name'),form_url=p_payload->>'form_url',auto_sync=coalesce((p_payload->>'auto_sync')::boolean,true),sync_minutes=(p_payload->>'sync_minutes')::integer where id;
 elsif p_action='pin' then
  if coalesce(p_payload->>'code','') !~ '^[0-9]{4}$' then raise exception 'Mã phải gồm đúng 4 chữ số';end if;
  update public.kpi_settings set pin_hash=extensions.crypt(p_payload->>'code',extensions.gen_salt('bf',10)),pin_code=p_payload->>'code',pin_version=pin_version+1 where id;
  delete from public.kpi_view_sessions where pin_version<=s.pin_version;
  delete from public.kpi_rates where window_start<=now();
  insert into public.kpi_audit(actor,action) values(p_actor,'Đổi mã xem');return '{"ok":true}';
 elsif p_action='delegate' then
  if not owner then raise exception 'Chỉ admin được cấp / thu hồi quyền cán bộ' using errcode='42501';end if;
  idv:=(p_payload->>'user_id')::uuid;
  if (p_payload->>'enabled')::boolean then
   if not exists(select 1 from public.profiles where id=idv and role in('teacher','lecturer','giangvien') and is_active and locked_at is null) then raise exception 'Tài khoản phải là giảng viên đang hoạt động';end if;
   insert into public.kpi_managers values(idv,p_actor,now()) on conflict do nothing;
  else delete from public.kpi_managers where user_id=idv;end if;
 elsif p_action='sync_claim' then
  update public.kpi_settings set sync_lease=gen_random_uuid(),lease_until=now()+interval '90 seconds' where id and (lease_until is null or lease_until<now()) and (coalesce((p_payload->>'force')::boolean,false) or (auto_sync and (synced_at is null or synced_at<now()-make_interval(mins=>sync_minutes)))) returning * into s;
  if not found then return '{"claimed":false}';end if;
  return jsonb_build_object('claimed',true,'lease',s.sync_lease,'sheet_id',s.sheet_id,'sheet_name',s.sheet_name);
 elsif p_action='sync_done' then
  perform 1 from public.kpi_settings where id and sync_lease=(p_payload->>'lease')::uuid for update;
  if not found then raise exception 'Phiên đồng bộ không còn hợp lệ';end if;
  if p_payload ? 'error' then update public.kpi_settings set sync_error=left(p_payload->>'error',1000),sync_lease=null,lease_until=null,synced_at=now() where id;return '{"ok":false}';end if;
  changed:=0;
  for item in select value from jsonb_array_elements(p_payload->'records') loop
   select * into r from public.kpi_records where source_key=item->>'source_key';
   if not found then
    insert into public.kpi_records(source_key,source_data,source_hash,effective,metric_id,year,month) values(item->>'source_key',item->'effective',item->>'source_hash',item->'effective',(select id from public.kpi_metrics where code=item->>'code'),(item->>'year')::integer,(item->>'month')::integer);
    changed:=changed+1;
   elsif r.source_hash is distinct from item->>'source_hash' then
    update public.kpi_records set source_data=item->'effective',source_hash=item->>'source_hash',status=case when status='archived' then status else 'pending' end,source_changed=true,version=version+1,updated_at=now() where id=r.id;
    changed:=changed+1;
   end if;
  end loop;
  update public.kpi_settings set synced_at=now(),sync_error=null,sync_lease=null,lease_until=null where id;
  insert into public.kpi_audit(actor,action,details) values(p_actor,'Đồng bộ Sheet',jsonb_build_object('changed',changed));return jsonb_build_object('ok',true,'changed',changed);
 else raise exception 'Thao tác không hợp lệ';end if;
 insert into public.kpi_audit(actor,action,object_id,details) values(p_actor,p_action,idv::text,p_payload-'code');
 return jsonb_build_object('ok',true,'id',idv);
end $$;
revoke all on function public.kpi_gateway(text,jsonb,uuid) from public,anon,authenticated;
grant execute on function public.kpi_gateway(text,jsonb,uuid) to service_role;
commit;
