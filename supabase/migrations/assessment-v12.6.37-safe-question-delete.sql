-- AI-CLO PTITHCM V12.6.37 — Safe question deletion.
--
-- Business rule:
--   * A question that has never been used/referenced may be deleted permanently.
--   * A question that is still referenced by an assessment, frozen pool, attempt,
--     answer, or fixed-question blueprint is preserved and moved to the existing
--     approval_status = 'archived' state.
--
-- No new question status is introduced. The existing approval_status values remain:
-- draft / pending / approved / archived.
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

  -- Keep any question that participates in an assessment/history. This remains
  -- true even when every exam_attempt row has later been deleted, because the
  -- frozen exam pool / exam mapping can still reference the question.
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
        status='draft',
        approved_by=null,
        approved_at=null,
        updated_at=v_now
    where id=p_question_id;

    return jsonb_build_object(
      'action','archived',
      'question_id',p_question_id,
      'approval_status','archived'
    );
  end if;

  -- Delete truly unused questions atomically. If another FK that is not covered
  -- above still protects the row, roll this block back and archive instead of
  -- leaving a question with its options partially deleted.
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
          status='draft',
          approved_by=null,
          approved_at=null,
          updated_at=v_now
      where id=p_question_id;

      return jsonb_build_object(
        'action','archived',
        'question_id',p_question_id,
        'approval_status','archived',
        'reason','referenced'
      );
  end;
end;
$$;

revoke all on function public.safe_delete_question(uuid) from public,anon;
grant execute on function public.safe_delete_question(uuid) to authenticated;

comment on function public.safe_delete_question(uuid) is
  'Delete an unused question permanently; archive a referenced/used question while preserving assessment history.';

commit;

select 'ASSESSMENT_V12_6_37_SAFE_QUESTION_DELETE_OK' as trang_thai,
       now() as hoan_tat_luc;
