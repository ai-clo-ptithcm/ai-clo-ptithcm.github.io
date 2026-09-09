-- AI-CLO PTITHCM V12.6.36 — Fix deleting historical assessment attempts.
--
-- Root cause in V12.5:
--   admin_delete_attempt() temporarily assigned negative attempt_number values
--   to avoid the UNIQUE(exam_id, student_id, attempt_number) constraint while
--   resequencing. The production schema also has a CHECK constraint requiring
--   attempt_number to remain positive, so that temporary state is rejected.
--
-- This replacement keeps every intermediate attempt_number positive. It first
-- moves the remaining rows above the current maximum, then compacts them back
-- to 1..N. The RPC signature and frontend contract are unchanged.
-- Safe to run again: only replaces public.admin_delete_attempt(uuid).

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
  v_offset integer;
begin
  if not public.is_admin() then
    raise exception 'Chỉ Admin được thực hiện';
  end if;

  select exam_id, student_id
  into v_exam_id, v_student_id
  from public.exam_attempts
  where id=p_attempt_id
  for update;

  if not found then
    raise exception 'Không tìm thấy lượt làm';
  end if;

  -- Explicit answer cleanup retained for compatibility. Other attempt-owned
  -- tables such as attempt_questions / attempt_draft_answers use ON DELETE CASCADE.
  delete from public.student_answers where attempt_id=p_attempt_id;
  delete from public.exam_attempts where id=p_attempt_id;

  -- Choose a temporary range strictly above every remaining attempt number.
  -- Adding the row count + 1 guarantees enough separation from the final 1..N
  -- range and keeps the CHECK(attempt_number > 0) valid throughout.
  select coalesce(max(attempt_number), 0) + count(*)::integer + 1
  into v_offset
  from public.exam_attempts
  where exam_id=v_exam_id
    and student_id=v_student_id;

  -- Phase 1: move all remaining attempts into a collision-free positive range.
  with ranked as (
    select id,
           row_number() over (
             order by attempt_number, started_at, created_at, id
           )::integer as next_number
    from public.exam_attempts
    where exam_id=v_exam_id
      and student_id=v_student_id
  )
  update public.exam_attempts ea
  set attempt_number=v_offset + ranked.next_number
  from ranked
  where ea.id=ranked.id;

  -- Phase 2: compact the temporary range back to contiguous 1..N.
  update public.exam_attempts
  set attempt_number=attempt_number-v_offset
  where exam_id=v_exam_id
    and student_id=v_student_id
    and attempt_number>v_offset;
end;
$$;

revoke all on function public.admin_delete_attempt(uuid) from public,anon;
grant execute on function public.admin_delete_attempt(uuid) to authenticated;

commit;

select 'MIGRATION_V12_6_36_ADMIN_DELETE_ATTEMPT_OK' as trang_thai,
       now() as hoan_tat_luc;
