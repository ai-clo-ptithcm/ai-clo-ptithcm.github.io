-- Freeze exam preparation data after an exam is finalized (status != draft).
-- Edge Functions use service_role and remain able to perform lifecycle transitions.

create or replace function private.exam_is_draft(p_exam_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(
    select 1 from public.exams e
    where e.id = p_exam_id and e.status = 'draft'
  );
$$;

revoke all on function private.exam_is_draft(uuid) from public;
grant execute on function private.exam_is_draft(uuid) to authenticated, service_role;

-- Sessions: editable only while the parent exam is draft.
drop policy if exists sessions_insert on public.exam_sessions;
drop policy if exists sessions_update on public.exam_sessions;
create policy sessions_insert on public.exam_sessions for insert to authenticated
with check (private.can_exam(exam_id,'manage_sessions') and private.exam_is_draft(exam_id));
create policy sessions_update on public.exam_sessions for update to authenticated
using (private.can_exam(exam_id,'manage_sessions') and private.exam_is_draft(exam_id))
with check (private.can_exam(exam_id,'manage_sessions') and private.exam_is_draft(exam_id));

-- Rooms.
drop policy if exists rooms_write on public.exam_rooms;
drop policy if exists rooms_insert on public.exam_rooms;
drop policy if exists rooms_update on public.exam_rooms;
drop policy if exists rooms_delete on public.exam_rooms;
create policy rooms_insert on public.exam_rooms for insert to authenticated
with check (exists(select 1 from public.exam_sessions s where s.id=session_id and private.can_exam(s.exam_id,'manage_sessions') and private.exam_is_draft(s.exam_id)));
create policy rooms_update on public.exam_rooms for update to authenticated
using (exists(select 1 from public.exam_sessions s where s.id=session_id and private.can_exam(s.exam_id,'manage_sessions') and private.exam_is_draft(s.exam_id)))
with check (exists(select 1 from public.exam_sessions s where s.id=session_id and private.can_exam(s.exam_id,'manage_sessions') and private.exam_is_draft(s.exam_id)));
create policy rooms_delete on public.exam_rooms for delete to authenticated
using (exists(select 1 from public.exam_sessions s where s.id=session_id and private.can_exam(s.exam_id,'manage_sessions') and private.exam_is_draft(s.exam_id)));

-- Student roster and codes.
drop policy if exists students_write on public.exam_students;
drop policy if exists students_insert on public.exam_students;
drop policy if exists students_update on public.exam_students;
drop policy if exists students_delete on public.exam_students;
create policy students_insert on public.exam_students for insert to authenticated
with check (private.can_exam(exam_id,'manage_roster') and private.exam_is_draft(exam_id));
create policy students_update on public.exam_students for update to authenticated
using (private.can_exam(exam_id,'manage_roster') and private.exam_is_draft(exam_id))
with check (private.can_exam(exam_id,'manage_roster') and private.exam_is_draft(exam_id));
create policy students_delete on public.exam_students for delete to authenticated
using (private.can_exam(exam_id,'manage_roster') and private.exam_is_draft(exam_id));

drop policy if exists codes_write on public.exam_student_codes;
drop policy if exists codes_insert on public.exam_student_codes;
drop policy if exists codes_update on public.exam_student_codes;
drop policy if exists codes_delete on public.exam_student_codes;
create policy codes_insert on public.exam_student_codes for insert to authenticated
with check (exists(select 1 from public.exam_students s where s.id=exam_student_id and private.can_exam(s.exam_id,'manage_roster') and private.exam_is_draft(s.exam_id)));
create policy codes_update on public.exam_student_codes for update to authenticated
using (exists(select 1 from public.exam_students s where s.id=exam_student_id and private.can_exam(s.exam_id,'manage_roster') and private.exam_is_draft(s.exam_id)))
with check (exists(select 1 from public.exam_students s where s.id=exam_student_id and private.can_exam(s.exam_id,'manage_roster') and private.exam_is_draft(s.exam_id)));
create policy codes_delete on public.exam_student_codes for delete to authenticated
using (exists(select 1 from public.exam_students s where s.id=exam_student_id and private.can_exam(s.exam_id,'manage_roster') and private.exam_is_draft(s.exam_id)));

-- Paper shell.
drop policy if exists papers_write on public.exam_papers;
drop policy if exists papers_insert on public.exam_papers;
drop policy if exists papers_update on public.exam_papers;
drop policy if exists papers_delete on public.exam_papers;
create policy papers_insert on public.exam_papers for insert to authenticated
with check (exists(select 1 from public.exam_sessions s where s.id=session_id and private.can_exam(s.exam_id,'manage_paper') and private.exam_is_draft(s.exam_id)));
create policy papers_update on public.exam_papers for update to authenticated
using (exists(select 1 from public.exam_sessions s where s.id=session_id and private.can_exam(s.exam_id,'manage_paper') and private.exam_is_draft(s.exam_id)))
with check (exists(select 1 from public.exam_sessions s where s.id=session_id and private.can_exam(s.exam_id,'manage_paper') and private.exam_is_draft(s.exam_id)));
create policy papers_delete on public.exam_papers for delete to authenticated
using (exists(select 1 from public.exam_sessions s where s.id=session_id and private.can_exam(s.exam_id,'manage_paper') and private.exam_is_draft(s.exam_id)));

-- Paper versions.
drop policy if exists paper_versions_access on public.exam_paper_versions;
drop policy if exists paper_versions_select on public.exam_paper_versions;
drop policy if exists paper_versions_insert on public.exam_paper_versions;
drop policy if exists paper_versions_update on public.exam_paper_versions;
drop policy if exists paper_versions_delete on public.exam_paper_versions;
create policy paper_versions_select on public.exam_paper_versions for select to authenticated
using (exists(select 1 from public.exam_papers p join public.exam_sessions s on s.id=p.session_id where p.id=paper_id and private.can_exam(s.exam_id,'manage_paper')));
create policy paper_versions_insert on public.exam_paper_versions for insert to authenticated
with check (exists(select 1 from public.exam_papers p join public.exam_sessions s on s.id=p.session_id where p.id=paper_id and private.can_exam(s.exam_id,'manage_paper') and private.exam_is_draft(s.exam_id)));
create policy paper_versions_update on public.exam_paper_versions for update to authenticated
using (exists(select 1 from public.exam_papers p join public.exam_sessions s on s.id=p.session_id where p.id=paper_id and private.can_exam(s.exam_id,'manage_paper') and private.exam_is_draft(s.exam_id)))
with check (exists(select 1 from public.exam_papers p join public.exam_sessions s on s.id=p.session_id where p.id=paper_id and private.can_exam(s.exam_id,'manage_paper') and private.exam_is_draft(s.exam_id)));
create policy paper_versions_delete on public.exam_paper_versions for delete to authenticated
using (exists(select 1 from public.exam_papers p join public.exam_sessions s on s.id=p.session_id where p.id=paper_id and private.can_exam(s.exam_id,'manage_paper') and private.exam_is_draft(s.exam_id)));

-- Question groups and versions.
drop policy if exists groups_access on public.question_groups;
drop policy if exists groups_select on public.question_groups;
drop policy if exists groups_insert on public.question_groups;
drop policy if exists groups_update on public.question_groups;
drop policy if exists groups_delete on public.question_groups;
create policy groups_select on public.question_groups for select to authenticated
using (exists(select 1 from public.exam_papers p join public.exam_sessions s on s.id=p.session_id where p.id=paper_id and private.can_exam(s.exam_id,'manage_paper')));
create policy groups_insert on public.question_groups for insert to authenticated
with check (exists(select 1 from public.exam_papers p join public.exam_sessions s on s.id=p.session_id where p.id=paper_id and private.can_exam(s.exam_id,'manage_paper') and private.exam_is_draft(s.exam_id)));
create policy groups_update on public.question_groups for update to authenticated
using (exists(select 1 from public.exam_papers p join public.exam_sessions s on s.id=p.session_id where p.id=paper_id and private.can_exam(s.exam_id,'manage_paper') and private.exam_is_draft(s.exam_id)))
with check (exists(select 1 from public.exam_papers p join public.exam_sessions s on s.id=p.session_id where p.id=paper_id and private.can_exam(s.exam_id,'manage_paper') and private.exam_is_draft(s.exam_id)));
create policy groups_delete on public.question_groups for delete to authenticated
using (exists(select 1 from public.exam_papers p join public.exam_sessions s on s.id=p.session_id where p.id=paper_id and private.can_exam(s.exam_id,'manage_paper') and private.exam_is_draft(s.exam_id)));

drop policy if exists group_versions_access on public.question_group_versions;
drop policy if exists group_versions_select on public.question_group_versions;
drop policy if exists group_versions_insert on public.question_group_versions;
drop policy if exists group_versions_update on public.question_group_versions;
drop policy if exists group_versions_delete on public.question_group_versions;
create policy group_versions_select on public.question_group_versions for select to authenticated
using (exists(select 1 from public.question_groups g join public.exam_papers p on p.id=g.paper_id join public.exam_sessions s on s.id=p.session_id where g.id=group_id and private.can_exam(s.exam_id,'manage_paper')));
create policy group_versions_insert on public.question_group_versions for insert to authenticated
with check (exists(select 1 from public.question_groups g join public.exam_papers p on p.id=g.paper_id join public.exam_sessions s on s.id=p.session_id where g.id=group_id and private.can_exam(s.exam_id,'manage_paper') and private.exam_is_draft(s.exam_id)));
create policy group_versions_update on public.question_group_versions for update to authenticated
using (exists(select 1 from public.question_groups g join public.exam_papers p on p.id=g.paper_id join public.exam_sessions s on s.id=p.session_id where g.id=group_id and private.can_exam(s.exam_id,'manage_paper') and private.exam_is_draft(s.exam_id)))
with check (exists(select 1 from public.question_groups g join public.exam_papers p on p.id=g.paper_id join public.exam_sessions s on s.id=p.session_id where g.id=group_id and private.can_exam(s.exam_id,'manage_paper') and private.exam_is_draft(s.exam_id)));
create policy group_versions_delete on public.question_group_versions for delete to authenticated
using (exists(select 1 from public.question_groups g join public.exam_papers p on p.id=g.paper_id join public.exam_sessions s on s.id=p.session_id where g.id=group_id and private.can_exam(s.exam_id,'manage_paper') and private.exam_is_draft(s.exam_id)));

-- Questions and versions.
drop policy if exists questions_access on public.questions;
drop policy if exists questions_select on public.questions;
drop policy if exists questions_insert on public.questions;
drop policy if exists questions_update on public.questions;
drop policy if exists questions_delete on public.questions;
create policy questions_select on public.questions for select to authenticated
using (exists(select 1 from public.exam_papers p join public.exam_sessions s on s.id=p.session_id where p.id=paper_id and private.can_exam(s.exam_id,'manage_paper')));
create policy questions_insert on public.questions for insert to authenticated
with check (exists(select 1 from public.exam_papers p join public.exam_sessions s on s.id=p.session_id where p.id=paper_id and private.can_exam(s.exam_id,'manage_paper') and private.exam_is_draft(s.exam_id)));
create policy questions_update on public.questions for update to authenticated
using (exists(select 1 from public.exam_papers p join public.exam_sessions s on s.id=p.session_id where p.id=paper_id and private.can_exam(s.exam_id,'manage_paper') and private.exam_is_draft(s.exam_id)))
with check (exists(select 1 from public.exam_papers p join public.exam_sessions s on s.id=p.session_id where p.id=paper_id and private.can_exam(s.exam_id,'manage_paper') and private.exam_is_draft(s.exam_id)));
create policy questions_delete on public.questions for delete to authenticated
using (exists(select 1 from public.exam_papers p join public.exam_sessions s on s.id=p.session_id where p.id=paper_id and private.can_exam(s.exam_id,'manage_paper') and private.exam_is_draft(s.exam_id)));

drop policy if exists question_versions_access on public.question_versions;
drop policy if exists question_versions_select on public.question_versions;
drop policy if exists question_versions_insert on public.question_versions;
drop policy if exists question_versions_update on public.question_versions;
drop policy if exists question_versions_delete on public.question_versions;
create policy question_versions_select on public.question_versions for select to authenticated
using (exists(select 1 from public.questions q join public.exam_papers p on p.id=q.paper_id join public.exam_sessions s on s.id=p.session_id where q.id=question_id and (private.can_exam(s.exam_id,'manage_paper') or private.can_exam(s.exam_id,'view_correct_answers'))));
create policy question_versions_insert on public.question_versions for insert to authenticated
with check (exists(select 1 from public.questions q join public.exam_papers p on p.id=q.paper_id join public.exam_sessions s on s.id=p.session_id where q.id=question_id and private.can_exam(s.exam_id,'manage_paper') and private.exam_is_draft(s.exam_id)));
create policy question_versions_update on public.question_versions for update to authenticated
using (exists(select 1 from public.questions q join public.exam_papers p on p.id=q.paper_id join public.exam_sessions s on s.id=p.session_id where q.id=question_id and private.can_exam(s.exam_id,'manage_paper') and private.exam_is_draft(s.exam_id)))
with check (exists(select 1 from public.questions q join public.exam_papers p on p.id=q.paper_id join public.exam_sessions s on s.id=p.session_id where q.id=question_id and private.can_exam(s.exam_id,'manage_paper') and private.exam_is_draft(s.exam_id)));
create policy question_versions_delete on public.question_versions for delete to authenticated
using (exists(select 1 from public.questions q join public.exam_papers p on p.id=q.paper_id join public.exam_sessions s on s.id=p.session_id where q.id=question_id and private.can_exam(s.exam_id,'manage_paper') and private.exam_is_draft(s.exam_id)));

-- Links from paper versions to exact question versions.
drop policy if exists pvq_access on public.paper_version_questions;
drop policy if exists pvq_select on public.paper_version_questions;
drop policy if exists pvq_insert on public.paper_version_questions;
drop policy if exists pvq_update on public.paper_version_questions;
drop policy if exists pvq_delete on public.paper_version_questions;
create policy pvq_select on public.paper_version_questions for select to authenticated
using (exists(select 1 from public.exam_paper_versions pv join public.exam_papers p on p.id=pv.paper_id join public.exam_sessions s on s.id=p.session_id where pv.id=paper_version_id and private.can_exam(s.exam_id,'manage_paper')));
create policy pvq_insert on public.paper_version_questions for insert to authenticated
with check (exists(select 1 from public.exam_paper_versions pv join public.exam_papers p on p.id=pv.paper_id join public.exam_sessions s on s.id=p.session_id where pv.id=paper_version_id and private.can_exam(s.exam_id,'manage_paper') and private.exam_is_draft(s.exam_id)));
create policy pvq_update on public.paper_version_questions for update to authenticated
using (exists(select 1 from public.exam_paper_versions pv join public.exam_papers p on p.id=pv.paper_id join public.exam_sessions s on s.id=p.session_id where pv.id=paper_version_id and private.can_exam(s.exam_id,'manage_paper') and private.exam_is_draft(s.exam_id)))
with check (exists(select 1 from public.exam_paper_versions pv join public.exam_papers p on p.id=pv.paper_id join public.exam_sessions s on s.id=p.session_id where pv.id=paper_version_id and private.can_exam(s.exam_id,'manage_paper') and private.exam_is_draft(s.exam_id)));
create policy pvq_delete on public.paper_version_questions for delete to authenticated
using (exists(select 1 from public.exam_paper_versions pv join public.exam_papers p on p.id=pv.paper_id join public.exam_sessions s on s.id=p.session_id where pv.id=paper_version_id and private.can_exam(s.exam_id,'manage_paper') and private.exam_is_draft(s.exam_id)));
