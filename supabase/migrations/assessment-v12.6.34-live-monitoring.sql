-- AI-CLO PTITHCM V12.6.34 — Live assessment monitoring.
-- Adds server-side telemetry for fullscreen/tab/window monitoring without exposing answer choices.
-- Safe to run repeatedly. Does not change assessment_schema_version().

begin;

create table if not exists public.attempt_live_state (
  attempt_id uuid primary key references public.exam_attempts(id) on delete cascade,
  exam_id uuid not null references public.exams(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  current_question_number integer null,
  answered_count integer not null default 0,
  answered_numbers jsonb not null default '[]'::jsonb,
  total_questions integer not null default 0,
  fullscreen_active boolean not null default false,
  page_visible boolean not null default true,
  away_reason text null,
  away_started_at timestamptz null,
  violations integer not null default 0,
  total_away_ms bigint not null default 0,
  last_seen_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (answered_count >= 0),
  check (total_questions >= 0),
  check (violations >= 0),
  check (total_away_ms >= 0),
  check (jsonb_typeof(answered_numbers) = 'array')
);

create table if not exists public.attempt_monitor_events (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.exam_attempts(id) on delete cascade,
  exam_id uuid not null references public.exams(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  event_type text not null,
  started_at timestamptz not null default now(),
  ended_at timestamptz null,
  duration_ms bigint null,
  created_at timestamptz not null default now(),
  check (event_type in ('tab_hidden','fullscreen_exit','window_blur','app_navigation')),
  check (duration_ms is null or duration_ms >= 0)
);

create index if not exists idx_attempt_live_state_exam_seen
  on public.attempt_live_state(exam_id,last_seen_at desc);
create index if not exists idx_attempt_monitor_events_exam_started
  on public.attempt_monitor_events(exam_id,started_at desc);
create index if not exists idx_attempt_monitor_events_attempt
  on public.attempt_monitor_events(attempt_id,started_at desc);

alter table public.attempt_live_state enable row level security;
alter table public.attempt_monitor_events enable row level security;

-- Runtime access is intentionally RPC-only. Students never receive other students' telemetry,
-- and teachers never receive the selected A/B/C/D values of an in-progress attempt.
revoke all on table public.attempt_live_state from anon,authenticated;
revoke all on table public.attempt_monitor_events from anon,authenticated;

create or replace function public.update_attempt_live_state(
  p_attempt_id uuid,
  p_current_question_number integer,
  p_answered_numbers jsonb,
  p_total_questions integer,
  p_fullscreen_active boolean,
  p_page_visible boolean
)
returns boolean
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_attempt public.exam_attempts%rowtype;
  v_exam public.exams%rowtype;
  v_numbers jsonb := '[]'::jsonb;
  v_total integer;
  v_current integer;
begin
  select * into v_attempt from public.exam_attempts where id=p_attempt_id;
  if not found then raise exception 'Không tìm thấy lượt làm bài'; end if;
  if auth.uid() is null or auth.uid()<>v_attempt.student_id then raise exception 'Không có quyền cập nhật phiên làm bài'; end if;
  if v_attempt.submitted_at is not null then return false; end if;

  select * into v_exam from public.exams where id=v_attempt.exam_id;
  if not found then raise exception 'Không tìm thấy bài kiểm tra'; end if;

  v_total:=greatest(0,least(coalesce(p_total_questions,v_exam.total_questions,0),coalesce(v_exam.total_questions,p_total_questions,0)));
  if v_total=0 then v_total:=greatest(0,coalesce(v_exam.total_questions,p_total_questions,0)); end if;

  if coalesce(jsonb_typeof(p_answered_numbers),'array')='array' then
    select coalesce(jsonb_agg(to_jsonb(n) order by n),'[]'::jsonb)
      into v_numbers
    from (
      select distinct value::integer as n
      from jsonb_array_elements_text(coalesce(p_answered_numbers,'[]'::jsonb)) x(value)
      where value ~ '^[0-9]+$'
        and value::integer between 1 and greatest(1,v_total)
    ) s;
  end if;

  v_current:=case
    when p_current_question_number is null or v_total<1 then null
    else greatest(1,least(v_total,p_current_question_number))
  end;

  insert into public.attempt_live_state(
    attempt_id,exam_id,student_id,current_question_number,answered_count,answered_numbers,
    total_questions,fullscreen_active,page_visible,last_seen_at,updated_at
  ) values(
    v_attempt.id,v_attempt.exam_id,v_attempt.student_id,v_current,jsonb_array_length(v_numbers),v_numbers,
    v_total,coalesce(p_fullscreen_active,false),coalesce(p_page_visible,true),now(),now()
  )
  on conflict(attempt_id) do update set
    current_question_number=excluded.current_question_number,
    answered_count=excluded.answered_count,
    answered_numbers=excluded.answered_numbers,
    total_questions=excluded.total_questions,
    fullscreen_active=excluded.fullscreen_active,
    page_visible=excluded.page_visible,
    last_seen_at=now(),
    updated_at=now();

  return true;
end;
$$;

grant execute on function public.update_attempt_live_state(uuid,integer,jsonb,integer,boolean,boolean) to authenticated;

create or replace function public.start_attempt_monitor_event(
  p_attempt_id uuid,
  p_event_type text
)
returns uuid
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_attempt public.exam_attempts%rowtype;
  v_id uuid;
begin
  if p_event_type not in ('tab_hidden','fullscreen_exit','window_blur','app_navigation') then
    raise exception 'Loại sự kiện giám sát không hợp lệ';
  end if;

  select * into v_attempt from public.exam_attempts where id=p_attempt_id;
  if not found then raise exception 'Không tìm thấy lượt làm bài'; end if;
  if auth.uid() is null or auth.uid()<>v_attempt.student_id then raise exception 'Không có quyền cập nhật phiên làm bài'; end if;
  if v_attempt.submitted_at is not null then return null; end if;

  insert into public.attempt_monitor_events(attempt_id,exam_id,student_id,event_type)
  values(v_attempt.id,v_attempt.exam_id,v_attempt.student_id,p_event_type)
  returning id into v_id;

  insert into public.attempt_live_state(
    attempt_id,exam_id,student_id,page_visible,away_reason,away_started_at,violations,last_seen_at,updated_at
  ) values(
    v_attempt.id,v_attempt.exam_id,v_attempt.student_id,false,p_event_type,now(),1,now(),now()
  )
  on conflict(attempt_id) do update set
    page_visible=false,
    away_reason=p_event_type,
    away_started_at=now(),
    violations=public.attempt_live_state.violations+1,
    last_seen_at=now(),
    updated_at=now();

  return v_id;
end;
$$;

grant execute on function public.start_attempt_monitor_event(uuid,text) to authenticated;

create or replace function public.finish_attempt_monitor_event(p_event_id uuid)
returns boolean
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_event public.attempt_monitor_events%rowtype;
  v_ms bigint;
begin
  select * into v_event from public.attempt_monitor_events where id=p_event_id for update;
  if not found then return false; end if;
  if auth.uid() is null or auth.uid()<>v_event.student_id then raise exception 'Không có quyền cập nhật sự kiện giám sát'; end if;
  if v_event.ended_at is not null then return true; end if;

  v_ms:=greatest(0,floor(extract(epoch from (now()-v_event.started_at))*1000)::bigint);
  update public.attempt_monitor_events
  set ended_at=now(),duration_ms=v_ms
  where id=v_event.id;

  update public.attempt_live_state
  set total_away_ms=greatest(0,total_away_ms+v_ms),
      away_reason=null,
      away_started_at=null,
      page_visible=true,
      last_seen_at=now(),
      updated_at=now()
  where attempt_id=v_event.attempt_id;

  return true;
end;
$$;

grant execute on function public.finish_attempt_monitor_event(uuid) to authenticated;

create or replace function public.get_exam_live_snapshot(p_exam_id uuid)
returns table(
  attempt_id uuid,
  student_id uuid,
  attempt_number integer,
  full_name text,
  mssv text,
  email text,
  started_at timestamptz,
  submitted_at timestamptz,
  score numeric,
  remaining_seconds integer,
  current_question_number integer,
  answered_count integer,
  answered_numbers jsonb,
  total_questions integer,
  fullscreen_active boolean,
  page_visible boolean,
  away_reason text,
  away_started_at timestamptz,
  violations integer,
  total_away_ms bigint,
  last_seen_at timestamptz
)
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_exam public.exams%rowtype;
begin
  select * into v_exam from public.exams where id=p_exam_id;
  if not found then raise exception 'Không tìm thấy bài kiểm tra'; end if;
  if auth.uid() is null or (not public.is_admin() and not public.is_subject_teacher(v_exam.subject_id)) then
    raise exception 'Không có quyền theo dõi bài kiểm tra';
  end if;

  return query
  select
    ea.id,
    ea.student_id,
    ea.attempt_number,
    coalesce(p.full_name,p.email,'Sinh viên')::text,
    p.mssv::text,
    p.email::text,
    ea.started_at,
    ea.submitted_at,
    ea.score,
    case
      when ea.submitted_at is not null then 0
      when v_exam.duration_minutes is null then null
      else greatest(0,floor(extract(epoch from (ea.started_at+make_interval(mins=>v_exam.duration_minutes)-now())))::integer)
    end,
    ls.current_question_number,
    coalesce(ls.answered_count,(
      select count(*)::integer from public.attempt_draft_answers d
      where d.attempt_id=ea.id and d.selected_option is not null
    ),0),
    coalesce(ls.answered_numbers,'[]'::jsonb),
    coalesce(nullif(ls.total_questions,0),v_exam.total_questions,0),
    coalesce(ls.fullscreen_active,false),
    coalesce(ls.page_visible,false),
    ls.away_reason,
    ls.away_started_at,
    coalesce(ls.violations,0),
    coalesce(ls.total_away_ms,0),
    ls.last_seen_at
  from public.exam_attempts ea
  left join public.profiles p on p.id=ea.student_id
  left join public.attempt_live_state ls on ls.attempt_id=ea.id
  where ea.exam_id=p_exam_id
  order by ea.started_at desc;
end;
$$;

grant execute on function public.get_exam_live_snapshot(uuid) to authenticated;

create or replace function public.get_exam_monitor_events(p_exam_id uuid)
returns table(
  event_id uuid,
  attempt_id uuid,
  student_id uuid,
  attempt_number integer,
  full_name text,
  mssv text,
  email text,
  event_type text,
  started_at timestamptz,
  ended_at timestamptz,
  duration_ms bigint
)
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_exam public.exams%rowtype;
begin
  select * into v_exam from public.exams where id=p_exam_id;
  if not found then raise exception 'Không tìm thấy bài kiểm tra'; end if;
  if auth.uid() is null or (not public.is_admin() and not public.is_subject_teacher(v_exam.subject_id)) then
    raise exception 'Không có quyền xem lịch sử giám sát';
  end if;

  return query
  select
    e.id,
    e.attempt_id,
    e.student_id,
    ea.attempt_number,
    coalesce(p.full_name,p.email,'Sinh viên')::text,
    p.mssv::text,
    p.email::text,
    e.event_type,
    e.started_at,
    e.ended_at,
    e.duration_ms
  from public.attempt_monitor_events e
  join public.exam_attempts ea on ea.id=e.attempt_id
  left join public.profiles p on p.id=e.student_id
  where e.exam_id=p_exam_id
  order by e.started_at asc;
end;
$$;

grant execute on function public.get_exam_monitor_events(uuid) to authenticated;

comment on table public.attempt_live_state is
  'Latest privacy-preserving live state for an online assessment attempt. Stores progress positions and monitoring status, never selected answer choices.';
comment on table public.attempt_monitor_events is
  'Audit trail of tab/window/fullscreen/app-navigation incidents during online assessment attempts.';

commit;
