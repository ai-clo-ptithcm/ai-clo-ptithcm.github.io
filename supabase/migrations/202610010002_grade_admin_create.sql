create or replace function public.grade_gateway(p_action text,p_payload jsonb default '{}',p_admin uuid default null)
returns jsonb language plpgsql security definer set search_path=public,extensions,pg_temp as $$
declare
 g public.grade_publications; setting public.grade_settings;
 gid uuid; is_admin boolean:=false; tok text; result jsonb; n integer; lim text;
begin
 if p_admin is not null then
  select exists(select 1 from public.profiles where id=p_admin and role='admin' and is_active and locked_at is null) into is_admin;
  if not is_admin then raise exception 'Không có quyền admin'; end if;
 end if;
 if p_action='rate' then
  lim:=p_payload->>'key';
  delete from grade_limits where window_start<now()-interval '1 day';
  insert into grade_limits(key,count,window_start) values(lim,1,now())
  on conflict(key) do update set
    count=case when grade_limits.window_start<now()-interval '10 minutes' then 1 else grade_limits.count+1 end,
    window_start=case when grade_limits.window_start<now()-interval '10 minutes' then now() else grade_limits.window_start end
  returning count into n;
  return jsonb_build_object('allowed',n<=least(coalesce((p_payload->>'limit')::int,30),300));
 end if;
 if p_action='list' then
  select coalesce(jsonb_agg(t),'[]') into result from (
   select id,title,teacher,class_name,semester,published,source,updated_at from grade_publications
   where (published or is_admin) and
   (coalesce(p_payload->>'search','')='' or concat_ws(' ',title,teacher,class_name,semester) ilike '%'||(p_payload->>'search')||'%')
   order by created_at desc limit 50 offset greatest(coalesce((p_payload->>'offset')::int,0),0)
  ) t; return result;
 end if;
 if p_action='settings' then
  if not is_admin then raise exception 'Không có quyền admin'; end if;
  return jsonb_build_object('code_configured',(select creation_code_hash is not null from grade_settings where id));
 end if;
 if p_action='set_code' then
  if not is_admin then raise exception 'Không có quyền admin'; end if;
  if coalesce(p_payload->>'code','') !~ '^[0-9]{4}$' then raise exception 'Mã tạo phải gồm 4 chữ số'; end if;
  update grade_settings set creation_code_hash=crypt(p_payload->>'code',gen_salt('bf',10)),updated_at=now() where id;
  return '{"ok":true}';
 end if;
 if p_action='create' then
  select * into setting from grade_settings where id;
  if not is_admin and setting.creation_code_hash is null then raise exception 'Admin chưa thiết lập mã tạo công bố'; end if;
  if not is_admin and crypt(coalesce(p_payload->>'code',''),setting.creation_code_hash)<>setting.creation_code_hash then raise exception 'Mã tạo không đúng'; end if;
  if length(coalesce(p_payload->>'password',''))<8 or octet_length(p_payload->>'password')>72 then raise exception 'Mật khẩu cần từ 8 ký tự và tối đa 72 byte'; end if;
  insert into grade_publications(title,teacher,class_name,semester,password_hash)
   values(left(p_payload->>'title',200),left(p_payload->>'teacher',120),left(p_payload->>'class_name',120),
    left(coalesce(p_payload->>'semester',''),80),crypt(p_payload->>'password',gen_salt('bf',10))) returning * into g;
  tok:=encode(gen_random_bytes(32),'hex');
  insert into grade_sessions values(encode(digest(tok,'sha256'),'hex'),g.id,now()+interval '2 hours');
  return jsonb_build_object('id',g.id,'token',tok);
 end if;
 gid:=(p_payload->>'id')::uuid;
 if p_action='unlock' then
  select * into g from grade_publications where id=gid;
  if g.id is null or crypt(coalesce(p_payload->>'password',''),g.password_hash)<>g.password_hash then raise exception 'Công bố hoặc mật khẩu không đúng'; end if;
  delete from grade_sessions where expires_at<now();
  tok:=encode(gen_random_bytes(32),'hex');
  insert into grade_sessions values(encode(digest(tok,'sha256'),'hex'),gid,now()+interval '2 hours');
  return jsonb_build_object('token',tok);
 end if;
 if p_action in ('read','save','restore','upload','original','sync_now','password') and not is_admin then
  if not exists(select 1 from grade_sessions where token_hash=encode(digest(coalesce(p_payload->>'token',''),'sha256'),'hex') and publication_id=gid and expires_at>now()) then
   raise exception 'Phiên chỉnh sửa đã hết hạn. Nhập lại mật khẩu';
  end if;
 end if;
 select * into g from grade_publications where id=gid for update;
 if g.id is null then raise exception 'Không tìm thấy công bố'; end if;
 if p_action='meta' then
  if not g.published and not is_admin then raise exception 'Công bố chưa mở'; end if;
  return jsonb_build_object('id',g.id,'title',g.title,'teacher',g.teacher,'class_name',g.class_name,'semester',g.semester,
   'note',g.note,'verification',g.verification,'synced_at',g.synced_at,'updated_at',g.updated_at);
 end if;
 if p_action='read' then
  return to_jsonb(g)-'password_hash'-'previous_snapshot'-'sync_lease';
 end if;
 if p_action='save' then
  if (p_payload->>'revision')::int<>g.revision then raise exception 'Bảng đã được cập nhật ở phiên khác. Mở lại trước khi lưu'; end if;
  if jsonb_array_length(p_payload->'rows')>5000 or jsonb_array_length(p_payload->'columns')>100 then raise exception 'Tối đa 5000 dòng và 100 cột'; end if;
  update grade_publications set
   previous_snapshot=jsonb_build_object('columns',g.columns,'rows',g.rows,'visible_columns',g.visible_columns,'verification',g.verification,
    'source',g.source,'source_config',g.source_config,'original_path',g.original_path),
   title=left(p_payload->>'title',200),teacher=left(p_payload->>'teacher',120),class_name=left(p_payload->>'class_name',120),
   semester=left(coalesce(p_payload->>'semester',''),80),note=left(coalesce(p_payload->>'note',''),3000),
   source=p_payload->>'source',source_config=coalesce(p_payload->'source_config','{}'),
   columns=p_payload->'columns',rows=p_payload->'rows',visible_columns=p_payload->'visible_columns',verification=p_payload->'verification',
   published=(p_payload->>'published')::boolean, revision=revision+1,updated_at=now(),
   sync_lock_until=null,sync_lease=null,
   sync_attempt_at=case when p_payload->>'source'='google' then now() else null end,
   synced_at=case when p_payload->>'source'='google' then now() else null end,sync_error=null
   where id=gid returning revision into n;
  return jsonb_build_object('ok',true,'revision',n);
 end if;
 if p_action='restore' then
  if g.previous_snapshot is null then raise exception 'Chưa có bản để khôi phục'; end if;
  update grade_publications set columns=g.previous_snapshot->'columns',rows=g.previous_snapshot->'rows',
   visible_columns=g.previous_snapshot->'visible_columns',verification=g.previous_snapshot->'verification',
   source=g.previous_snapshot->>'source',source_config=g.previous_snapshot->'source_config',
   original_path=g.previous_snapshot->>'original_path',previous_snapshot=null,published=false,
   revision=revision+1,updated_at=now(),sync_lock_until=null,sync_lease=null,sync_attempt_at=null
   where id=gid;
  return '{"ok":true}';
 end if;
 if p_action='upload' then
  return jsonb_build_object('path',gid||'/original.'||case when p_payload->>'extension' in ('xlsx','xls','csv') then p_payload->>'extension' else 'xlsx' end);
 end if;
 if p_action='original' then
  update grade_publications set original_path=p_payload->>'path' where id=gid;
  return '{"ok":true}';
 end if;
 if p_action='password' or p_action='reset_password' then
  if p_action='reset_password' and not is_admin then raise exception 'Không có quyền admin'; end if;
  if length(coalesce(p_payload->>'password',''))<8 or octet_length(p_payload->>'password')>72 then raise exception 'Mật khẩu cần từ 8 ký tự và tối đa 72 byte'; end if;
  update grade_publications set password_hash=crypt(p_payload->>'password',gen_salt('bf',10)) where id=gid;
  delete from grade_sessions where publication_id=gid;
  return '{"ok":true}';
 end if;
 if p_action='delete' then
  if not is_admin then raise exception 'Không có quyền admin'; end if;
  delete from grade_publications where id=gid;
  return '{"ok":true}';
 end if;
 if p_action='sync_now' then
  update grade_publications set sync_attempt_at=null where id=gid;
  return '{"ok":true}';
 end if;
 if p_action='sync_claim' then
  if g.source<>'google' or (not g.published and not is_admin and coalesce(p_payload->>'internal','')<>'yes') or
   g.sync_attempt_at>now()-interval '15 minutes' or g.sync_lock_until>now() then return '{"claimed":false}'; end if;
  tok:=gen_random_uuid()::text;
  update grade_publications set sync_lock_until=now()+interval '90 seconds',sync_lease=tok::uuid,sync_attempt_at=now() where id=gid;
  return jsonb_build_object('claimed',true,'lease',tok,'source_config',g.source_config,'columns',g.columns,'visible_columns',g.visible_columns,'verification',g.verification);
 end if;
 if p_action='sync_done' then
  if g.sync_lease::text<>p_payload->>'lease' or g.sync_lease is null then return '{"ok":false}'; end if;
  if coalesce(p_payload->>'error','')<>'' then
   update grade_publications set sync_error=left(p_payload->>'error',500),sync_lock_until=null,sync_lease=null where id=gid;
  else
   if g.rows<>p_payload->'rows' then
    update grade_publications set previous_snapshot=jsonb_build_object('columns',g.columns,'rows',g.rows,'visible_columns',g.visible_columns,
     'verification',g.verification,'source',g.source,'source_config',g.source_config,'original_path',g.original_path),
     rows=p_payload->'rows',revision=revision+1,updated_at=now() where id=gid;
   end if;
   update grade_publications set synced_at=now(),sync_error=null,sync_lock_until=null,sync_lease=null where id=gid;
  end if;
  return '{"ok":true}';
 end if;
 if p_action='lookup' then
  if not g.published then raise exception 'Công bố đang tắt'; end if;
  return jsonb_build_object('columns',g.columns,'rows',g.rows,'visible_columns',g.visible_columns,'verification',g.verification,
   'note',g.note,'synced_at',g.synced_at,'updated_at',g.updated_at);
 end if;
 raise exception 'Thao tác không hợp lệ';
end $$;

revoke all on function public.grade_gateway(text,jsonb,uuid) from public,anon,authenticated;
grant execute on function public.grade_gateway(text,jsonb,uuid) to service_role;
