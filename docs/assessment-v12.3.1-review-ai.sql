-- AI-CLO PTITHCM V12.3.1 — post-submit review permissions + attempt AI contract.
-- Run after V12.2. Idempotent and safe to run again.

begin;

alter table public.exams add column if not exists show_review boolean not null default false;
update public.exams set show_review=true where coalesce(show_answers,false)=true and coalesce(show_review,false)=false;
comment on column public.exams.show_review is 'Student may review submitted questions, selected options and right/wrong state. Does not reveal the correct answer.';
comment on column public.exams.show_answers is 'Student may additionally see correct answers and explanations after submission.';

alter table public.exams drop constraint if exists exams_status_check;
alter table public.exams add constraint exams_status_check
  check (status in ('draft','active','closed','published','paused','archived'));

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
  v_staff boolean;
  v_can_review boolean;
  v_can_answers boolean;
begin
  select * into v_attempt from public.exam_attempts where id=p_attempt_id;
  if not found then raise exception 'Không tìm thấy lượt làm bài'; end if;
  select * into v_exam from public.exams where id=v_attempt.exam_id;
  if auth.uid()<>v_attempt.student_id and not public.is_admin() and not public.is_subject_teacher(v_exam.subject_id) then raise exception 'Không có quyền xem kết quả'; end if;
  if v_attempt.submitted_at is null then raise exception 'Bài chưa được nộp'; end if;
  perform public.populate_attempt_questions(p_attempt_id);

  select count(*),count(*) filter(where sa.is_correct) into v_total,v_correct
  from public.attempt_questions aq left join public.student_answers sa on sa.attempt_id=p_attempt_id and sa.question_id=aq.question_id
  where aq.attempt_id=p_attempt_id;

  select coalesce(jsonb_agg(jsonb_build_object('code',code,'correct',correct_count,'total',total_count,'score',round(correct_count*10.0/nullif(total_count,0),2)) order by code),'[]'::jsonb)
  into v_clos from (
    select coalesce(aq.clo_code,'—') code,count(*) total_count,count(*) filter(where sa.is_correct) correct_count
    from public.attempt_questions aq left join public.student_answers sa on sa.attempt_id=p_attempt_id and sa.question_id=aq.question_id
    where aq.attempt_id=p_attempt_id group by aq.clo_code
  ) z;

  select coalesce(jsonb_agg(jsonb_build_object('chapter',chapter_name,'correct',correct_count,'total',total_count,'score',round(correct_count*10.0/nullif(total_count,0),2)) order by chapter_name),'[]'::jsonb)
  into v_chapters from (
    select coalesce(aq.chapter_name,'—') chapter_name,count(*) total_count,count(*) filter(where sa.is_correct) correct_count
    from public.attempt_questions aq left join public.student_answers sa on sa.attempt_id=p_attempt_id and sa.question_id=aq.question_id
    where aq.attempt_id=p_attempt_id group by aq.chapter_name
  ) z;

  v_staff:=public.is_admin() or public.is_subject_teacher(v_exam.subject_id);
  v_can_answers:=v_staff or coalesce(v_exam.show_answers,false);
  v_can_review:=v_staff or coalesce(v_exam.show_review,false) or coalesce(v_exam.show_answers,false);

  if v_can_review then
    select coalesce(jsonb_agg(jsonb_build_object(
      'question_id',aq.question_id,'content',aq.content,'selected',sa.selected_option,'is_correct',coalesce(sa.is_correct,false),
      'options',aq.options,'clo_code',aq.clo_code,'chapter',aq.chapter_name,'topic',aq.topic_name,
      'correct_answer',case when v_can_answers then aq.correct_answer else null end,
      'explanation',case when v_can_answers then aq.explanation else null end
    ) order by aq.question_order),'[]'::jsonb)
    into v_review
    from public.attempt_questions aq left join public.student_answers sa on sa.attempt_id=p_attempt_id and sa.question_id=aq.question_id
    where aq.attempt_id=p_attempt_id;
  else
    v_review:='[]'::jsonb;
  end if;

  return jsonb_build_object(
    'attempt_id',v_attempt.id,'exam_id',v_attempt.exam_id,'subject_id',v_exam.subject_id,'student_id',v_attempt.student_id,
    'attempt_number',v_attempt.attempt_number,'score',v_attempt.score,'correct',coalesce(v_correct,0),'total',coalesce(v_total,0),
    'submitted_at',v_attempt.submitted_at,'clo_scores',coalesce(v_clos,'[]'::jsonb),'chapter_scores',coalesce(v_chapters,'[]'::jsonb),
    'review',coalesce(v_review,'[]'::jsonb),'show_review',v_can_review,'show_answers',v_can_answers,
    'allow_ai_feedback',coalesce(v_exam.allow_ai_feedback,true)
  );
end;
$$;
grant execute on function public.get_attempt_result(uuid) to authenticated;

create or replace function public.assessment_schema_version()
returns text language sql stable security definer set search_path=public,pg_temp
as $$ select '12.3.1'::text $$;
grant execute on function public.assessment_schema_version() to authenticated;

commit;
select 'ASSESSMENT_V12_3_1_REVIEW_AI_OK' as trang_thai,
       count(*) filter(where show_review) as bai_cho_xem_lai,
       count(*) filter(where show_answers) as bai_hien_dap_an,
       count(*) filter(where allow_ai_feedback) as bai_cho_ai
from public.exams;
