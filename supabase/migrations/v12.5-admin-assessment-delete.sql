-- AI-CLO PTITHCM V12.5.0 — Admin Assessment delete hardening.
-- Run after the existing V9.2/V12.x assessment migrations.
-- Safe to run again: only replaces the existing admin_delete_attempt RPC.

begin;

create or replace function public.admin_delete_attempt(p_attempt_id uuid)
returns void
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_exam_id uuid;
  v_student_id uuid;
begin
  if not public.is_admin() then
    raise exception 'Chỉ Admin được thực hiện';
  end if;

  select exam_id,student_id
  into v_exam_id,v_student_id
  from public.exam_attempts
  where id=p_attempt_id
  for update;

  if not found then
    raise exception 'Không tìm thấy lượt làm';
  end if;

  -- Explicit answer cleanup retained for compatibility; other attempt-owned
  -- tables such as attempt_questions / attempt_draft_answers use ON DELETE CASCADE.
  delete from public.student_answers where attempt_id=p_attempt_id;
  delete from public.exam_attempts where id=p_attempt_id;

  -- Keep attempt_number contiguous after deleting any historical attempt.
  -- Two-phase negative numbering avoids unique(exam_id,student_id,attempt_number)
  -- collisions while rows are being resequenced in the same transaction.
  with ranked as (
    select id,
           row_number() over (
             order by attempt_number,started_at,created_at,id
           )::integer as next_number
    from public.exam_attempts
    where exam_id=v_exam_id and student_id=v_student_id
  )
  update public.exam_attempts ea
  set attempt_number=-ranked.next_number
  from ranked
  where ea.id=ranked.id;

  update public.exam_attempts
  set attempt_number=-attempt_number
  where exam_id=v_exam_id
    and student_id=v_student_id
    and attempt_number<0;
end;
$$;

revoke all on function public.admin_delete_attempt(uuid) from public,anon;
grant execute on function public.admin_delete_attempt(uuid) to authenticated;

commit;

select 'MIGRATION_V12_5_ADMIN_ASSESSMENT_DELETE_OK' as trang_thai, now() as hoan_tat_luc;
