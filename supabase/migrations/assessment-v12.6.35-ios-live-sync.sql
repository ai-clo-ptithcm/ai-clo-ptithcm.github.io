-- AI-CLO PTITHCM V12.6.35 — reliable mobile/iOS Live incident synchronization.
-- Safe additive migration. Keeps selected answers private and does not change assessment_schema_version().

begin;

alter table public.attempt_monitor_events
  add column if not exists client_event_id text null;

create unique index if not exists uq_attempt_monitor_events_client_event
  on public.attempt_monitor_events(attempt_id,client_event_id)
  where client_event_id is not null;

create or replace function public.sync_attempt_monitor_event(
  p_attempt_id uuid,
  p_client_event_id text,
  p_event_type text,
  p_started_at timestamptz,
  p_ended_at timestamptz default null
)
returns uuid
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_attempt public.exam_attempts%rowtype;
  v_existing public.attempt_monitor_events%rowtype;
  v_id uuid;
  v_started timestamptz;
  v_ended timestamptz;
  v_ms bigint := null;
  v_new boolean := false;
  v_completed_now boolean := false;
begin
  if coalesce(trim(p_client_event_id),'')='' then raise exception 'Thiếu mã sự kiện giám sát'; end if;
  if p_event_type not in ('tab_hidden','fullscreen_exit','window_blur','app_navigation') then
    raise exception 'Loại sự kiện giám sát không hợp lệ';
  end if;

  select * into v_attempt from public.exam_attempts where id=p_attempt_id;
  if not found then raise exception 'Không tìm thấy lượt làm bài'; end if;
  if auth.uid() is null or auth.uid()<>v_attempt.student_id then raise exception 'Không có quyền cập nhật phiên làm bài'; end if;

  v_started:=greatest(v_attempt.started_at,least(coalesce(p_started_at,now()),now()));
  v_ended:=case when p_ended_at is null then null else greatest(v_started,least(p_ended_at,coalesce(v_attempt.submitted_at,now()),now())) end;
  if v_ended is not null then v_ms:=greatest(0,floor(extract(epoch from (v_ended-v_started))*1000)::bigint); end if;

  select * into v_existing
  from public.attempt_monitor_events
  where attempt_id=p_attempt_id and client_event_id=p_client_event_id
  for update;

  if not found then
    insert into public.attempt_monitor_events(
      attempt_id,exam_id,student_id,event_type,started_at,ended_at,duration_ms,client_event_id
    ) values(
      v_attempt.id,v_attempt.exam_id,v_attempt.student_id,p_event_type,v_started,v_ended,v_ms,p_client_event_id
    ) returning id into v_id;
    v_new:=true;
    v_completed_now:=v_ended is not null;
  else
    v_id:=v_existing.id;
    if v_existing.ended_at is null and v_ended is not null then
      update public.attempt_monitor_events
      set ended_at=v_ended,duration_ms=v_ms
      where id=v_existing.id;
      v_completed_now:=true;
    end if;
  end if;

  insert into public.attempt_live_state(
    attempt_id,exam_id,student_id,page_visible,away_reason,away_started_at,
    violations,total_away_ms,last_seen_at,updated_at
  ) values(
    v_attempt.id,v_attempt.exam_id,v_attempt.student_id,v_ended is not null,
    case when v_ended is null then p_event_type else null end,
    case when v_ended is null then v_started else null end,
    case when v_new then 1 else 0 end,
    case when v_completed_now then coalesce(v_ms,0) else 0 end,
    now(),now()
  )
  on conflict(attempt_id) do update set
    page_visible=case when v_ended is not null then true else false end,
    away_reason=case when v_ended is null then p_event_type else null end,
    away_started_at=case when v_ended is null then v_started else null end,
    violations=public.attempt_live_state.violations + case when v_new then 1 else 0 end,
    total_away_ms=public.attempt_live_state.total_away_ms + case when v_completed_now then coalesce(v_ms,0) else 0 end,
    last_seen_at=now(),
    updated_at=now();

  return v_id;
end;
$$;

grant execute on function public.sync_attempt_monitor_event(uuid,text,text,timestamptz,timestamptz) to authenticated;

comment on column public.attempt_monitor_events.client_event_id is
  'Stable client-generated id used to de-duplicate deferred mobile/iOS monitoring events.';

commit;
