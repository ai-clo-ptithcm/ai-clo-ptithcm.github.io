-- AI-CLO PTITHCM V12.6.38 — Fix safe question archive against questions_status_check.
--
-- Production keeps two different concepts on public.questions:
--   * approval_status: draft / pending / approved / archived
--   * status: an older independent field protected by questions_status_check
--
-- V12.6.37 incorrectly wrote status='draft' while archiving. On databases whose
-- questions_status_check does not allow that value, the archive update fails.
-- This replacement changes ONLY the existing approval_status to 'archived' and
-- deliberately preserves questions.status exactly as it is.
--
-- This is safe for assessment selection because the current assessment loader
-- requires approval_status='approved' as well as status='active'; therefore an
-- archived question cannot be selected into a new assessment even if its legacy
-- status value remains active.
--
-- No table, column, enum-like value, or new question status is added.
-- Safe to run again: only replaces public.safe_delete_question(uuid).

begin;

create or replace function public.safe_delete_question(p_question_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_question public.questions%rowtype;
  v_is_used boolean := false;
  v_now timestamptz := now();
begin
  select *
  into v_question
  from public.questions
  where id=p_question_id
  for update;

  if not found then
    raise exception 'Không tìm thấy câu hỏi';
  end if;

  if not public.is_admin() and v_question.created_by<>auth.uid() then
    raise exception 'Chỉ người nhập hoặc Admin được xóa câu hỏi này';
  end if;

  -- A question is considered used/referenced even after all exam attempts have
  -- been deleted if an exam mapping, frozen pool, historical snapshot, answer,
  -- or mixed-mode fixed-question blueprint still points to it.
  v_is_used :=
       exists(select 1 from public.exam_questions      where question_id=p_question_id)
    or exists(select 1 from public.exam_question_pool  where question_id=p_question_id)
    or exists(select 1 from public.attempt_questions   where question_id=p_question_id)
    or exists(select 1 from public.student_answers     where question_id=p_question_id)
    or exists(
         select 1
         from public.exams e
         where jsonb_typeof(coalesce(e.question_blueprint->'fixed_question_ids','[]'::jsonb))='array'
           and coalesce(e.question_blueprint->'fixed_question_ids','[]'::jsonb)
               @> jsonb_build_array(p_question_id::text)
       );

  if v_is_used then
    update public.questions
    set approval_status='archived',
        approved_by=null,
        approved_at=null,
        updated_at=v_now
    where id=p_question_id;

    return jsonb_build_object(
      'action','archived',
      'question_id',p_question_id,
      'approval_status','archived',
      'legacy_status',v_question.status
    );
  end if;

  -- Delete a truly unused question atomically. If an unlisted FK still protects
  -- it, the nested block rolls the option deletion back and archives the question
  -- instead. The legacy questions.status value is never rewritten.
  begin
    delete from public.question_options where question_id=p_question_id;
    delete from public.questions where id=p_question_id;

    if not found then
      raise exception 'Không tìm thấy câu hỏi';
    end if;

    return jsonb_build_object(
      'action','deleted',
      'question_id',p_question_id
    );
  exception
    when foreign_key_violation then
      update public.questions
      set approval_status='archived',
          approved_by=null,
          approved_at=null,
          updated_at=v_now
      where id=p_question_id;

      return jsonb_build_object(
        'action','archived',
        'question_id',p_question_id,
        'approval_status','archived',
        'legacy_status',v_question.status,
        'reason','referenced'
      );
  end;
end;
$$;

revoke all on function public.safe_delete_question(uuid) from public,anon;
grant execute on function public.safe_delete_question(uuid) to authenticated;

comment on function public.safe_delete_question(uuid) is
  'Delete an unused question permanently; archive a referenced question via approval_status only, preserving legacy questions.status.';

commit;

select 'ASSESSMENT_V12_6_38_SAFE_QUESTION_ARCHIVE_OK' as trang_thai,
       now() as hoan_tat_luc;
