-- AI-CLO PTITHCM v10.2
-- Chạy một lần trong Supabase SQL Editor trước khi deploy frontend V10.2.

alter table public.clos add column if not exists short_description text;

create table if not exists public.final_exam_packages (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid not null references public.subjects(id) on delete cascade,
  title text not null,
  metadata jsonb not null default '{}'::jsonb,
  matrix jsonb not null default '[]'::jsonb,
  source_scope text not null default 'secure_exam' check (source_scope in ('practice','secure_exam','both')),
  selected_questions jsonb not null default '[]'::jsonb,
  variants jsonb not null default '[]'::jsonb,
  status text not null default 'draft' check (status in ('draft','reviewing','generated','archived')),
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists final_exam_packages_subject_idx on public.final_exam_packages(subject_id, created_at desc);
alter table public.final_exam_packages enable row level security;
grant select,insert,update,delete on public.final_exam_packages to authenticated;

drop policy if exists final_exam_packages_staff_select on public.final_exam_packages;
create policy final_exam_packages_staff_select on public.final_exam_packages for select to authenticated using(
  public.is_admin() or public.is_subject_teacher(subject_id)
);
drop policy if exists final_exam_packages_staff_insert on public.final_exam_packages;
create policy final_exam_packages_staff_insert on public.final_exam_packages for insert to authenticated with check(
  created_by=auth.uid() and (public.is_admin() or public.is_subject_teacher(subject_id))
);
drop policy if exists final_exam_packages_staff_update on public.final_exam_packages;
create policy final_exam_packages_staff_update on public.final_exam_packages for update to authenticated using(
  public.is_admin() or created_by=auth.uid()
) with check(public.is_admin() or created_by=auth.uid());
drop policy if exists final_exam_packages_staff_delete on public.final_exam_packages;
create policy final_exam_packages_staff_delete on public.final_exam_packages for delete to authenticated using(
  public.is_admin() or created_by=auth.uid()
);

-- Gợi ý mô tả ngắn ban đầu: nếu chưa có thì sao chép mô tả đầy đủ để giảng viên rút gọn sau.
update public.clos set short_description=description
where nullif(trim(coalesce(short_description,'')),'') is null;
