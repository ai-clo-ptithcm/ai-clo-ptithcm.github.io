-- Cho phép giảng viên chỉ đọc hồ sơ sinh viên thuộc học phần mình phụ trách.
-- Admin vẫn xem được toàn bộ; sinh viên chỉ xem được hồ sơ của chính mình.

create or replace function public.can_teacher_view_student(target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles target
    join public.subject_members student_membership
      on student_membership.user_id = target.id
     and student_membership.role = 'student'
    join public.subject_members teacher_membership
      on teacher_membership.subject_id = student_membership.subject_id
     and teacher_membership.user_id = auth.uid()
     and teacher_membership.role in ('teacher', 'lecturer', 'giangvien')
    where target.id = target_user_id
      and target.role = 'student'
  );
$$;

revoke all on function public.can_teacher_view_student(uuid) from public;
grant execute on function public.can_teacher_view_student(uuid) to authenticated;

drop policy if exists profiles_select_students_of_teacher on public.profiles;
create policy profiles_select_students_of_teacher
on public.profiles
for select
to authenticated
using (public.can_teacher_view_student(id));
