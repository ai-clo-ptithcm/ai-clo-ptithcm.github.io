-- AI-CLO PTITHCM v10.4
-- Lịch sử thao tác hồ sơ đề thi cuối kỳ. Không thêm Edge Function mới.

create table if not exists public.final_exam_history (
  id uuid primary key default gen_random_uuid(),
  package_id uuid not null references public.final_exam_packages(id) on delete cascade,
  subject_id uuid not null references public.subjects(id) on delete cascade,
  actor_id uuid not null references public.profiles(id) on delete restrict,
  action text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists final_exam_history_package_idx on public.final_exam_history(package_id, created_at desc);
create index if not exists final_exam_history_subject_idx on public.final_exam_history(subject_id, created_at desc);
alter table public.final_exam_history enable row level security;
grant select,insert on public.final_exam_history to authenticated;

drop policy if exists final_exam_history_staff_select on public.final_exam_history;
create policy final_exam_history_staff_select on public.final_exam_history for select to authenticated using(
  public.is_admin() or public.is_subject_teacher(subject_id)
);
drop policy if exists final_exam_history_staff_insert on public.final_exam_history;
create policy final_exam_history_staff_insert on public.final_exam_history for insert to authenticated with check(
  actor_id=auth.uid() and (public.is_admin() or public.is_subject_teacher(subject_id))
);
