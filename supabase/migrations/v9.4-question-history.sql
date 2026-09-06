-- AI-CLO PTITHCM v9.4 — lịch sử chỉnh sửa câu hỏi.
-- Chạy một lần trong Supabase SQL Editor. Có thể chạy lại an toàn.

alter table public.questions add column if not exists updated_at timestamptz;
update public.questions set updated_at=coalesce(updated_at,created_at,now()) where updated_at is null;
alter table public.questions alter column updated_at set default now();
alter table public.questions alter column updated_at set not null;

create table if not exists public.question_revisions (
 id uuid primary key default gen_random_uuid(),
 question_id uuid not null references public.questions(id) on delete cascade,
 revision_no integer not null,
 changed_by uuid references public.profiles(id) on delete set null,
 changed_at timestamptz not null default now(),
 snapshot jsonb not null,
 unique(question_id,revision_no)
);
create index if not exists question_revisions_question_idx on public.question_revisions(question_id,revision_no desc);

alter table public.question_revisions enable row level security;
grant select on public.question_revisions to authenticated;

drop policy if exists question_revisions_staff_select on public.question_revisions;
create policy question_revisions_staff_select on public.question_revisions for select to authenticated
using (exists(
 select 1 from public.questions q
 where q.id=question_id and (public.is_admin() or public.is_subject_teacher(q.subject_id))
));

create or replace function public.archive_question_revision(p_question_id uuid)
returns integer
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
 qrow public.questions%rowtype;
 next_no integer;
 snap jsonb;
begin
 select * into qrow from public.questions where id=p_question_id for update;
 if not found then raise exception 'Không tìm thấy câu hỏi'; end if;
 if not (public.is_admin() or public.is_subject_teacher(qrow.subject_id)) then
   raise exception 'Bạn không có quyền sửa câu hỏi này';
 end if;
 select coalesce(max(revision_no),0)+1 into next_no from public.question_revisions where question_id=p_question_id;
 snap:=to_jsonb(qrow)||jsonb_build_object(
   'options',coalesce((select jsonb_agg(jsonb_build_object('key',option_key,'content',content) order by option_key) from public.question_options where question_id=p_question_id),'[]'::jsonb)
 );
 insert into public.question_revisions(question_id,revision_no,changed_by,snapshot)
 values(p_question_id,next_no,auth.uid(),snap);
 return next_no;
end;
$$;
revoke all on function public.archive_question_revision(uuid) from public,anon;
grant execute on function public.archive_question_revision(uuid) to authenticated;
