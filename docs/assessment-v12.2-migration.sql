-- AI-CLO PTITHCM V12.2 — Assessment Stability / single-owner backend contract.
-- Run after assessment-v12.1-migration.sql. Safe to run again.

begin;

alter table public.exams add column if not exists counts_toward_grade boolean not null default true;
alter table public.exams add column if not exists structure_mode text not null default 'topic_clo';
alter table public.exams add column if not exists question_blueprint jsonb not null default '{"version":1,"source":"legacy","matrix":{}}'::jsonb;
alter table public.exams add column if not exists score_policy text not null default 'highest';

update public.exams
set score_policy='highest'
where score_policy is null or score_policy not in ('highest','latest','average');

alter table public.exams drop constraint if exists exams_structure_mode_check;
alter table public.exams add constraint exams_structure_mode_check check (structure_mode in ('topic_clo','chapter_pool'));
alter table public.exams drop constraint if exists exams_score_policy_check;
alter table public.exams add constraint exams_score_policy_check check (score_policy in ('highest','latest','average'));

create or replace function public.assessment_schema_version()
returns text language sql stable security definer set search_path=public,pg_temp
as $$ select '12.2'::text $$;
grant execute on function public.assessment_schema_version() to authenticated;

-- Canonical official-attempt scope for course CLO results.
-- highest: one highest-score attempt per student/exam (latest wins a tie).
-- latest: one latest submitted attempt per student/exam.
-- average: every submitted attempt for that student/exam participates.
-- Exams excluded from course CLO aggregation never appear in this view.
create or replace view public.assessment_effective_attempts
with (security_invoker=true)
as
select id,exam_id,subject_id,student_id,attempt_number,started_at,submitted_at,score,score_policy
from (
  select ea.id,
         ea.exam_id,
         e.subject_id,
         ea.student_id,
         ea.attempt_number,
         ea.started_at,
         ea.submitted_at,
         ea.score,
         coalesce(e.score_policy,'highest') as score_policy,
         row_number() over (
           partition by ea.exam_id,ea.student_id
           order by ea.score desc nulls last,ea.submitted_at desc nulls last,ea.attempt_number desc
         ) as rn_highest,
         row_number() over (
           partition by ea.exam_id,ea.student_id
           order by ea.submitted_at desc nulls last,ea.attempt_number desc
         ) as rn_latest
  from public.exam_attempts ea
  join public.exams e on e.id=ea.exam_id
  where ea.submitted_at is not null
    and coalesce(e.counts_toward_grade,true)=true
) ranked
where score_policy='average'
   or (score_policy='highest' and rn_highest=1)
   or (score_policy='latest' and rn_latest=1);

grant select on public.assessment_effective_attempts to authenticated;
comment on view public.assessment_effective_attempts is
  'Canonical submitted-attempt scope for course CLO/GPA aggregation. Applies exams.counts_toward_grade and exams.score_policy.';

-- Canonical lock: after the first attempt, freeze only fields that can change what
-- students saw or how the attempt was measured. Operational fields remain editable.
create or replace function public.guard_exam_structure_update()
returns trigger
language plpgsql
security definer
set search_path=public,pg_temp
as $$
begin
  if exists(select 1 from public.exam_attempts where exam_id=old.id limit 1)
     and (
       new.total_questions is distinct from old.total_questions
       or new.chapter_ids is distinct from old.chapter_ids
       or new.topic_ids is distinct from old.topic_ids
       or new.clo_counts is distinct from old.clo_counts
       or new.question_mode is distinct from old.question_mode
       or new.duration_minutes is distinct from old.duration_minutes
       or new.shuffle_questions is distinct from old.shuffle_questions
       or new.shuffle_options is distinct from old.shuffle_options
       or new.opens_at is distinct from old.opens_at
       or new.structure_mode is distinct from old.structure_mode
       or new.question_blueprint is distinct from old.question_blueprint
     ) then
    raise exception 'Bài kiểm tra đã có lượt làm; cấu trúc đo lường đã được khóa';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_guard_exam_structure on public.exams;
create trigger trg_guard_exam_structure
before update on public.exams
for each row execute function public.guard_exam_structure_update();

-- V12.1 may already have a dedicated blueprint guard. The canonical structure guard
-- above covers the same fields, so remove the duplicate trigger to keep one policy.
drop trigger if exists trg_guard_exam_blueprint on public.exams;

-- Atomic design replacement. The browser never updates matrix metadata first and
-- pool/questions later. All five representations are changed in one DB transaction.
create or replace function public.replace_exam_design(
  p_exam_id uuid,
  p_structure_mode text,
  p_blueprint jsonb,
  p_chapter_ids uuid[],
  p_topic_ids uuid[],
  p_clo_counts jsonb,
  p_total_questions integer,
  p_pool jsonb,
  p_selected jsonb
)
returns boolean
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_exam public.exams%rowtype;
  v_pool_count integer;
  v_selected_count integer;
  v_selected_distinct integer;
begin
  select * into v_exam from public.exams where id=p_exam_id for update;
  if not found then raise exception 'Không tìm thấy bài kiểm tra'; end if;
  if not public.is_admin() and not public.is_subject_teacher(v_exam.subject_id) then
    raise exception 'Không có quyền chỉnh cấu trúc bài kiểm tra';
  end if;
  if exists(select 1 from public.exam_attempts where exam_id=p_exam_id limit 1) then
    raise exception 'Bài kiểm tra đã có lượt làm; cấu trúc và bộ câu đã được khóa';
  end if;
  if p_structure_mode not in ('topic_clo','chapter_pool') then raise exception 'Chế độ cấu trúc không hợp lệ'; end if;
  if coalesce(p_total_questions,0)<1 then raise exception 'Tổng số câu phải lớn hơn 0'; end if;
  if coalesce(jsonb_typeof(p_pool),'')<>'array' then raise exception 'Pool câu hỏi không hợp lệ'; end if;
  if coalesce(jsonb_typeof(p_selected),'')<>'array' then raise exception 'Bộ câu được chọn không hợp lệ'; end if;
  if coalesce(p_blueprint->'matrix','{}'::jsonb)='{}'::jsonb then raise exception 'Ma trận câu hỏi không được rỗng'; end if;

  select count(*) into v_pool_count from jsonb_array_elements(p_pool);
  select count(*),count(distinct value) into v_selected_count,v_selected_distinct from jsonb_array_elements_text(p_selected);
  if v_selected_count<>p_total_questions then raise exception 'Số câu được chọn không khớp tổng số câu'; end if;
  if v_selected_distinct<>p_total_questions then raise exception 'Bộ câu được chọn có câu trùng'; end if;
  if v_pool_count<p_total_questions then raise exception 'Pool câu hỏi nhỏ hơn bộ đề'; end if;

  -- Remove old frozen design first. Existing guard permits this because no attempt exists.
  delete from public.exam_questions where exam_id=p_exam_id;
  delete from public.exam_question_pool where exam_id=p_exam_id;
  delete from public.exam_chapters where exam_id=p_exam_id;
  delete from public.exam_clos where exam_id=p_exam_id;

  insert into public.exam_question_pool(
    exam_id,question_id,chapter_id,chapter_name,topic_id,topic_name,clo_id,clo_code,
    content,correct_answer,explanation,options
  )
  select p_exam_id,
         (x->>'question_id')::uuid,
         nullif(x->>'chapter_id','')::uuid,
         nullif(x->>'chapter_name',''),
         nullif(x->>'topic_id','')::uuid,
         nullif(x->>'topic_name',''),
         nullif(x->>'clo_id','')::uuid,
         nullif(x->>'clo_code',''),
         x->>'content',
         upper(x->>'correct_answer')::character(1),
         nullif(x->>'explanation',''),
         coalesce(x->'options','[]'::jsonb)
  from jsonb_array_elements(p_pool) x;

  if exists(
    select 1 from jsonb_array_elements_text(p_selected) s(value)
    where not exists(
      select 1 from public.exam_question_pool p
      where p.exam_id=p_exam_id and p.question_id=s.value::uuid
    )
  ) then raise exception 'Có câu được chọn không nằm trong pool đóng băng'; end if;

  insert into public.exam_questions(exam_id,question_id,question_order)
  select p_exam_id,value::uuid,ord::integer
  from jsonb_array_elements_text(p_selected) with ordinality s(value,ord);

  insert into public.exam_chapters(exam_id,chapter_id,question_count)
  select p_exam_id,p.chapter_id,count(*)::integer
  from public.exam_questions eq
  join public.exam_question_pool p on p.exam_id=eq.exam_id and p.question_id=eq.question_id
  where eq.exam_id=p_exam_id and p.chapter_id is not null
  group by p.chapter_id;

  insert into public.exam_clos(exam_id,clo_id,weight)
  select p_exam_id,p.clo_id,count(*)*100.0/p_total_questions
  from public.exam_questions eq
  join public.exam_question_pool p on p.exam_id=eq.exam_id and p.question_id=eq.question_id
  where eq.exam_id=p_exam_id and p.clo_id is not null
  group by p.clo_id;

  update public.exams
  set structure_mode=p_structure_mode,
      question_blueprint=coalesce(p_blueprint,'{}'::jsonb),
      chapter_ids=coalesce(p_chapter_ids,'{}'::uuid[]),
      topic_ids=coalesce(p_topic_ids,'{}'::uuid[]),
      clo_counts=coalesce(p_clo_counts,'{}'::jsonb),
      total_questions=p_total_questions
  where id=p_exam_id;

  return true;
end;
$$;
grant execute on function public.replace_exam_design(uuid,text,jsonb,uuid[],uuid[],jsonb,integer,jsonb,jsonb) to authenticated;

-- Pause semantics: an unfinished attempt is resumable even while the assessment is
-- paused/closed or after its public close time. Only NEW attempts require active status.
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

  -- Resume first. A pause blocks new attempts, never an attempt already started.
  select * into v_open
  from public.exam_attempts
  where exam_id=p_exam_id and student_id=auth.uid() and submitted_at is null
  order by attempt_number desc limit 1;
  if found then
    v_expired:=v_exam.duration_minutes is not null
      and now()>=v_open.started_at+make_interval(mins=>v_exam.duration_minutes);
    if not v_expired then
      perform public.populate_attempt_questions(v_open.id);
      return jsonb_build_object('attempt_id',v_open.id,'attempt_number',v_open.attempt_number,'resumed',true);
    end if;
    perform public.finalize_exam_attempt(v_open.id);
  end if;

  -- From here on we are creating a new attempt.
  if v_exam.status<>'active' then raise exception 'Bài kiểm tra đang tạm dừng hoặc chưa được phát hành'; end if;
  if v_exam.opens_at is not null and now()<v_exam.opens_at then raise exception 'Bài kiểm tra chưa đến thời gian mở'; end if;
  if v_exam.closes_at is not null and now()>v_exam.closes_at then raise exception 'Bài kiểm tra đã kết thúc'; end if;
  if not exists(select 1 from public.exam_question_pool where exam_id=p_exam_id) then raise exception 'Bài kiểm tra chưa có pool câu hỏi'; end if;

  select count(*) into v_count from public.exam_attempts where exam_id=p_exam_id and student_id=auth.uid();
  if v_count>=greatest(1,v_exam.max_attempts) then raise exception 'Bạn đã sử dụng hết số lần làm bài'; end if;
  v_next:=v_count+1;
  insert into public.exam_attempts(exam_id,student_id,attempt_number,started_at)
  values(p_exam_id,auth.uid(),v_next,now()) returning * into v_attempt;
  perform public.populate_attempt_questions(v_attempt.id);
  return jsonb_build_object('attempt_id',v_attempt.id,'attempt_number',v_attempt.attempt_number,'resumed',false);
end;
$$;
grant execute on function public.start_exam_attempt(uuid) to authenticated;

-- Final-exam packages have one canonical source in V12.2 and one canonical list of
-- variant codes. Existing legacy packages without metadata.variant_codes are repaired
-- from variants[].code; only as a last legacy fallback do they receive 101–104.
create or replace function public.normalize_final_exam_package()
returns trigger
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_codes jsonb;
  v_count integer;
  v_distinct integer;
begin
  new.source_scope:='secure_exam';
  new.metadata:=jsonb_set(coalesce(new.metadata,'{}'::jsonb),'{source_scope}','"secure_exam"'::jsonb,true);

  v_codes:=new.metadata->'variant_codes';
  if jsonb_typeof(v_codes)<>'array' or jsonb_array_length(v_codes)=0 then
    if jsonb_typeof(new.variants)='array' and jsonb_array_length(new.variants)>0 then
      select coalesce(jsonb_agg(to_jsonb(code) order by ord),'[]'::jsonb)
      into v_codes
      from (
        select nullif(trim(x.value->>'code'),'') as code,x.ord
        from jsonb_array_elements(new.variants) with ordinality x(value,ord)
        where nullif(trim(x.value->>'code'),'') is not null
      ) q;
    end if;
  end if;

  -- Legacy repair only. New V12.2 UI always sends an explicit 1–20 code list.
  if jsonb_typeof(v_codes)<>'array' or jsonb_array_length(v_codes)=0 then
    v_codes:='["101","102","103","104"]'::jsonb;
  end if;

  select count(*),count(distinct trim(value))
  into v_count,v_distinct
  from jsonb_array_elements_text(v_codes) s(value)
  where nullif(trim(value),'') is not null;

  if v_count<1 or v_count>20 then
    raise exception 'Số mã đề phải từ 1 đến 20';
  end if;
  if v_distinct<>v_count or v_count<>jsonb_array_length(v_codes) then
    raise exception 'Danh sách mã đề không được rỗng hoặc trùng mã';
  end if;

  new.metadata:=jsonb_set(new.metadata,'{variant_codes}',v_codes,true);
  new.metadata:=jsonb_set(new.metadata,'{variant_count}',to_jsonb(v_count),true);
  return new;
end;
$$;

drop trigger if exists trg_force_secure_final_exam_source on public.final_exam_packages;
drop trigger if exists trg_normalize_final_exam_package on public.final_exam_packages;
create trigger trg_normalize_final_exam_package
before insert or update on public.final_exam_packages
for each row execute function public.normalize_final_exam_package();

commit;

select 'ASSESSMENT_V12_2_OK' as trang_thai,
       count(*) filter(where structure_mode='topic_clo') as bai_topic_clo,
       count(*) filter(where structure_mode='chapter_pool') as bai_chapter_pool,
       count(*) filter(where counts_toward_grade) as bai_tinh_clo
from public.exams;
