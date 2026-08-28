-- AI-CLO PTITHCM v9 — Complete Assessment Flow
-- Chạy MỘT LẦN trong Supabase Dashboard > SQL Editor trước khi deploy frontend v9.
-- File này chỉ mở rộng schema hiện có; không xóa dữ liệu bài kiểm tra cũ.

begin;

alter table public.exams add column if not exists max_attempts integer not null default 1;
alter table public.exams add column if not exists show_answers boolean not null default false;
alter table public.exams add column if not exists shuffle_questions boolean not null default true;
alter table public.exams add column if not exists shuffle_options boolean not null default true;
alter table public.exams add column if not exists opens_at timestamptz null;
alter table public.exams add column if not exists closes_at timestamptz null;
alter table public.exams add column if not exists chapter_ids uuid[] not null default '{}'::uuid[];
alter table public.exams add column if not exists topic_ids uuid[] not null default '{}'::uuid[];
alter table public.exams add column if not exists clo_counts jsonb not null default '{}'::jsonb;
alter table public.exams add column if not exists score_policy text not null default 'highest';
alter table public.exams add column if not exists published_at timestamptz null;
alter table public.exams add column if not exists allow_ai_feedback boolean not null default true;

alter table public.exams drop constraint if exists exams_max_attempts_check;
alter table public.exams add constraint exams_max_attempts_check check (max_attempts between 1 and 20);
alter table public.exams drop constraint if exists exams_score_policy_check;
alter table public.exams add constraint exams_score_policy_check check (score_policy in ('highest','latest','average'));

create table if not exists public.attempt_draft_answers (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.exam_attempts(id) on delete cascade,
  question_id uuid not null references public.questions(id) on delete cascade,
  selected_option character(1) null,
  updated_at timestamptz not null default now(),
  unique(attempt_id, question_id),
  check (selected_option is null or selected_option in ('A','B','C','D'))
);

alter table public.attempt_draft_answers enable row level security;
drop policy if exists attempt_draft_answers_own_select on public.attempt_draft_answers;
create policy attempt_draft_answers_own_select on public.attempt_draft_answers
for select to authenticated using (
  exists(select 1 from public.exam_attempts ea where ea.id=attempt_id and ea.student_id=auth.uid())
  or public.is_admin()
  or exists(select 1 from public.exam_attempts ea join public.exams e on e.id=ea.exam_id where ea.id=attempt_id and public.is_subject_teacher(e.subject_id))
);
drop policy if exists attempt_draft_answers_own_insert on public.attempt_draft_answers;
create policy attempt_draft_answers_own_insert on public.attempt_draft_answers
for insert to authenticated with check (
  exists(select 1 from public.exam_attempts ea where ea.id=attempt_id and ea.student_id=auth.uid() and ea.submitted_at is null)
);
drop policy if exists attempt_draft_answers_own_update on public.attempt_draft_answers;
create policy attempt_draft_answers_own_update on public.attempt_draft_answers
for update to authenticated using (
  exists(select 1 from public.exam_attempts ea where ea.id=attempt_id and ea.student_id=auth.uid() and ea.submitted_at is null)
) with check (
  exists(select 1 from public.exam_attempts ea where ea.id=attempt_id and ea.student_id=auth.uid() and ea.submitted_at is null)
);

create table if not exists public.assessment_ai_feedback (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid not null references public.subjects(id) on delete cascade,
  requested_by uuid not null references public.profiles(id) on delete cascade,
  scope text not null check(scope in ('attempt','student','class')),
  student_id uuid null references public.profiles(id) on delete cascade,
  attempt_id uuid null references public.exam_attempts(id) on delete cascade,
  source_fingerprint text not null,
  analysis jsonb not null,
  generated_at timestamptz not null default now(),
  unique(requested_by, scope, student_id, attempt_id, source_fingerprint)
);

alter table public.assessment_ai_feedback enable row level security;
drop policy if exists assessment_ai_feedback_select on public.assessment_ai_feedback;
create policy assessment_ai_feedback_select on public.assessment_ai_feedback
for select to authenticated using (
  requested_by=auth.uid()
  or (student_id=auth.uid())
  or public.is_admin()
  or public.is_subject_teacher(subject_id)
);

-- Không cho sinh viên đọc trực tiếp correct_answer từ bảng ngân hàng.
-- Họ nhận đề đã loại đáp án đúng thông qua RPC get_exam_attempt_payload().
drop policy if exists questions_select_subject_members on public.questions;
create policy questions_select_subject_members on public.questions
for select to authenticated using (
  public.is_admin() or public.is_subject_teacher(subject_id)
);

drop policy if exists question_options_select_subject_members on public.question_options;
create policy question_options_select_subject_members on public.question_options
for select to authenticated using (
  public.is_admin() or public.is_subject_teacher(public.question_subject_id(question_id))
);

-- Sinh viên chỉ nhìn thấy bài đã phát hành của học phần; giảng viên/admin vẫn thấy mọi trạng thái.
drop policy if exists exams_select_subject_members on public.exams;
create policy exams_select_subject_members on public.exams
for select to authenticated using (
  public.is_admin()
  or public.is_subject_teacher(subject_id)
  or (
    public.is_subject_student(subject_id)
    and status='active'
  )
);


create or replace function public.get_exam_attempt_payload(p_attempt_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_attempt public.exam_attempts%rowtype;
  v_exam public.exams%rowtype;
  v_questions jsonb;
  v_answers jsonb;
  v_remaining integer;
begin
  select * into v_attempt from public.exam_attempts where id=p_attempt_id;
  if not found then raise exception 'Không tìm thấy lượt làm bài'; end if;
  select * into v_exam from public.exams where id=v_attempt.exam_id;
  if auth.uid()<>v_attempt.student_id and not public.is_admin() and not public.is_subject_teacher(v_exam.subject_id) then raise exception 'Không có quyền xem lượt làm bài'; end if;

  if v_exam.duration_minutes is null then v_remaining:=null;
  else v_remaining:=greatest(0, floor(extract(epoch from (v_attempt.started_at + make_interval(mins=>v_exam.duration_minutes) - now())))::integer); end if;

  select coalesce(jsonb_object_agg(question_id::text,selected_option) filter(where selected_option is not null),'{}'::jsonb)
  into v_answers from public.attempt_draft_answers where attempt_id=p_attempt_id;

  select coalesce(jsonb_agg(item order by sort_key),'[]'::jsonb) into v_questions
  from (
    select
      case when v_exam.shuffle_questions then md5(p_attempt_id::text||eq.question_id::text) else lpad(eq.question_order::text,10,'0') end sort_key,
      jsonb_build_object(
        'id',q.id,
        'content',q.content,
        'clo_code',c.code,
        'chapter',ch.name,
        'topic',t.name,
        'options',(
          select coalesce(jsonb_agg(jsonb_build_object('key',qo.option_key,'content',qo.content)
            order by case when v_exam.shuffle_options then md5(p_attempt_id::text||qo.id::text) else qo.option_key::text end),'[]'::jsonb)
          from public.question_options qo where qo.question_id=q.id
        )
      ) item
    from public.exam_questions eq
    join public.questions q on q.id=eq.question_id
    left join public.clos c on c.id=q.clo_id
    left join public.chapters ch on ch.id=q.chapter_id
    left join public.topics t on t.id=q.topic_id
    where eq.exam_id=v_attempt.exam_id
  ) s;

  return jsonb_build_object(
    'attempt_id',v_attempt.id,'attempt_number',v_attempt.attempt_number,'started_at',v_attempt.started_at,
    'submitted_at',v_attempt.submitted_at,'remaining_seconds',v_remaining,'answers',coalesce(v_answers,'{}'::jsonb),
    'exam',jsonb_build_object('id',v_exam.id,'title',v_exam.title,'duration_minutes',v_exam.duration_minutes,'show_answers',v_exam.show_answers,'allow_ai_feedback',v_exam.allow_ai_feedback),
    'questions',coalesce(v_questions,'[]'::jsonb)
  );
end;
$$;

create or replace function public.save_exam_progress(p_attempt_id uuid,p_question_id uuid,p_selected_option text)
returns boolean
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_attempt public.exam_attempts%rowtype;
  v_exam public.exams%rowtype;
begin
  select * into v_attempt from public.exam_attempts where id=p_attempt_id;
  if not found or v_attempt.student_id<>auth.uid() then raise exception 'Không có quyền lưu bài này'; end if;
  if v_attempt.submitted_at is not null then raise exception 'Bài đã được nộp'; end if;
  select * into v_exam from public.exams where id=v_attempt.exam_id;
  if v_exam.duration_minutes is not null and now() > v_attempt.started_at + make_interval(mins=>v_exam.duration_minutes) + interval '30 seconds' then raise exception 'Đã hết thời gian làm bài'; end if;
  if p_selected_option is not null and p_selected_option not in ('A','B','C','D') then raise exception 'Phương án không hợp lệ'; end if;
  if not exists(select 1 from public.exam_questions where exam_id=v_attempt.exam_id and question_id=p_question_id) then raise exception 'Câu hỏi không thuộc bài kiểm tra'; end if;

  insert into public.attempt_draft_answers(attempt_id,question_id,selected_option,updated_at)
  values(p_attempt_id,p_question_id,p_selected_option::character(1),now())
  on conflict(attempt_id,question_id) do update set selected_option=excluded.selected_option,updated_at=now();
  return true;
end;
$$;

create or replace function public.get_attempt_result(p_attempt_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_attempt public.exam_attempts%rowtype;
  v_exam public.exams%rowtype;
  v_clos jsonb;
  v_chapters jsonb;
  v_review jsonb;
  v_total integer;
  v_correct integer;
  v_can_review boolean;
begin
  select * into v_attempt from public.exam_attempts where id=p_attempt_id;
  if not found then raise exception 'Không tìm thấy lượt làm bài'; end if;
  select * into v_exam from public.exams where id=v_attempt.exam_id;
  if auth.uid()<>v_attempt.student_id and not public.is_admin() and not public.is_subject_teacher(v_exam.subject_id) then raise exception 'Không có quyền xem kết quả'; end if;
  if v_attempt.submitted_at is null then raise exception 'Bài chưa được nộp'; end if;

  select count(*),count(*) filter(where sa.is_correct) into v_total,v_correct
  from public.exam_questions eq left join public.student_answers sa on sa.attempt_id=p_attempt_id and sa.question_id=eq.question_id
  where eq.exam_id=v_attempt.exam_id;

  select coalesce(jsonb_agg(jsonb_build_object('code',code,'correct',correct_count,'total',total_count,'score',round(correct_count*10.0/nullif(total_count,0),2)) order by code),'[]'::jsonb)
  into v_clos from (
    select coalesce(c.code,'—') code,count(*) total_count,count(*) filter(where sa.is_correct) correct_count
    from public.exam_questions eq join public.questions q on q.id=eq.question_id left join public.clos c on c.id=q.clo_id
    left join public.student_answers sa on sa.attempt_id=p_attempt_id and sa.question_id=q.id
    where eq.exam_id=v_attempt.exam_id group by c.code
  ) z;

  select coalesce(jsonb_agg(jsonb_build_object('chapter',chapter_name,'correct',correct_count,'total',total_count,'score',round(correct_count*10.0/nullif(total_count,0),2)) order by chapter_name),'[]'::jsonb)
  into v_chapters from (
    select coalesce(ch.name,'—') chapter_name,count(*) total_count,count(*) filter(where sa.is_correct) correct_count
    from public.exam_questions eq join public.questions q on q.id=eq.question_id left join public.chapters ch on ch.id=q.chapter_id
    left join public.student_answers sa on sa.attempt_id=p_attempt_id and sa.question_id=q.id
    where eq.exam_id=v_attempt.exam_id group by ch.name
  ) z;

  v_can_review := v_exam.show_answers or public.is_admin() or public.is_subject_teacher(v_exam.subject_id);
  if v_can_review then
    select coalesce(jsonb_agg(jsonb_build_object('question_id',q.id,'content',q.content,'selected',sa.selected_option,'correct_answer',q.correct_answer,'is_correct',coalesce(sa.is_correct,false),'explanation',q.explanation) order by eq.question_order),'[]'::jsonb)
    into v_review
    from public.exam_questions eq join public.questions q on q.id=eq.question_id
    left join public.student_answers sa on sa.attempt_id=p_attempt_id and sa.question_id=q.id
    where eq.exam_id=v_attempt.exam_id;
  else v_review:='[]'::jsonb; end if;

  return jsonb_build_object('attempt_id',v_attempt.id,'exam_id',v_attempt.exam_id,'attempt_number',v_attempt.attempt_number,
    'score',v_attempt.score,'correct',coalesce(v_correct,0),'total',coalesce(v_total,0),'submitted_at',v_attempt.submitted_at,
    'clo_scores',coalesce(v_clos,'[]'::jsonb),'chapter_scores',coalesce(v_chapters,'[]'::jsonb),'review',coalesce(v_review,'[]'::jsonb),'show_answers',v_can_review);
end;
$$;

create or replace function public.finalize_exam_attempt(p_attempt_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_attempt public.exam_attempts%rowtype;
  v_exam public.exams%rowtype;
  v_total integer;
  v_correct integer;
begin
  select * into v_attempt from public.exam_attempts where id=p_attempt_id for update;
  if not found then raise exception 'Không tìm thấy lượt làm bài'; end if;
  select * into v_exam from public.exams where id=v_attempt.exam_id;
  if auth.uid()<>v_attempt.student_id and not public.is_admin() and not public.is_subject_teacher(v_exam.subject_id) then raise exception 'Không có quyền nộp bài'; end if;
  if v_attempt.submitted_at is not null then return public.get_attempt_result(p_attempt_id); end if;

  delete from public.student_answers where attempt_id=p_attempt_id;
  insert into public.student_answers(attempt_id,question_id,selected_option,is_correct)
  select p_attempt_id,eq.question_id,d.selected_option::character(1),coalesce(d.selected_option=q.correct_answer::text,false)
  from public.exam_questions eq join public.questions q on q.id=eq.question_id
  left join public.attempt_draft_answers d on d.attempt_id=p_attempt_id and d.question_id=eq.question_id
  where eq.exam_id=v_attempt.exam_id;

  select count(*),count(*) filter(where is_correct) into v_total,v_correct from public.student_answers where attempt_id=p_attempt_id;
  update public.exam_attempts set submitted_at=now(),score=round(coalesce(v_correct,0)*10.0/nullif(v_total,0),2) where id=p_attempt_id;
  return public.get_attempt_result(p_attempt_id);
end;
$$;

create or replace function public.start_exam_attempt(p_exam_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_exam public.exams%rowtype;
  v_open public.exam_attempts%rowtype;
  v_attempt public.exam_attempts%rowtype;
  v_count integer;
  v_next integer;
  v_expired boolean;
begin
  select * into v_exam from public.exams where id=p_exam_id;
  if not found then raise exception 'Không tìm thấy bài kiểm tra'; end if;
  if auth.uid() is null or not public.is_subject_student(v_exam.subject_id) then raise exception 'Bạn không thuộc học phần này'; end if;
  if v_exam.status <> 'active' then raise exception 'Bài kiểm tra chưa được phát hành'; end if;
  if v_exam.opens_at is not null and now() < v_exam.opens_at then raise exception 'Bài kiểm tra chưa đến thời gian mở'; end if;
  if v_exam.closes_at is not null and now() > v_exam.closes_at then raise exception 'Bài kiểm tra đã kết thúc'; end if;
  if not exists(select 1 from public.exam_questions where exam_id=p_exam_id) then raise exception 'Bài kiểm tra chưa có câu hỏi'; end if;

  select * into v_open from public.exam_attempts
  where exam_id=p_exam_id and student_id=auth.uid() and submitted_at is null
  order by attempt_number desc limit 1;

  if found then
    v_expired := v_exam.duration_minutes is not null and now() >= v_open.started_at + make_interval(mins=>v_exam.duration_minutes);
    if not v_expired then
      return jsonb_build_object('attempt_id',v_open.id,'attempt_number',v_open.attempt_number,'resumed',true);
    end if;
    perform public.finalize_exam_attempt(v_open.id);
  end if;

  select count(*) into v_count from public.exam_attempts where exam_id=p_exam_id and student_id=auth.uid();
  if v_count >= greatest(1,v_exam.max_attempts) then raise exception 'Bạn đã sử dụng hết số lần làm bài'; end if;
  v_next := v_count+1;

  insert into public.exam_attempts(exam_id,student_id,attempt_number,started_at)
  values(p_exam_id,auth.uid(),v_next,now()) returning * into v_attempt;

  return jsonb_build_object('attempt_id',v_attempt.id,'attempt_number',v_attempt.attempt_number,'resumed',false);
end;
$$;

create or replace function public.submit_exam_attempt(p_attempt_id uuid,p_answers jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare r record;
begin
  if p_answers is not null then
    for r in select key,value from jsonb_each_text(p_answers) loop
      perform public.save_exam_progress(p_attempt_id,r.key::uuid,r.value);
    end loop;
  end if;
  return public.finalize_exam_attempt(p_attempt_id);
end;
$$;

grant execute on function public.start_exam_attempt(uuid) to authenticated;
grant execute on function public.get_exam_attempt_payload(uuid) to authenticated;
grant execute on function public.save_exam_progress(uuid,uuid,text) to authenticated;
grant execute on function public.get_attempt_result(uuid) to authenticated;
grant execute on function public.finalize_exam_attempt(uuid) to authenticated;
grant execute on function public.submit_exam_attempt(uuid,jsonb) to authenticated;

commit;
