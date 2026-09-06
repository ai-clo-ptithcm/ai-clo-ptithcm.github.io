-- AI-CLO PTITHCM v9.6 — ngân hàng câu hỏi nâng cao và bảo mật đề thi.
-- Chạy sau các migration v9.1, v9.2, v9.4 và v9.5.

create extension if not exists pg_trgm;

alter table public.questions add column if not exists question_scope text not null default 'practice';
alter table public.questions add column if not exists approval_status text not null default 'draft';
alter table public.questions add column if not exists approved_by uuid references public.profiles(id) on delete set null;
alter table public.questions add column if not exists approved_at timestamptz;

update public.questions
set question_scope=coalesce(question_scope,'practice'),
    approval_status=case when status='active' then 'approved' else 'draft' end,
    approved_by=case when status='active' then coalesce(approved_by,created_by) else approved_by end,
    approved_at=case when status='active' then coalesce(approved_at,updated_at,created_at,now()) else approved_at end
where approval_status is null or approval_status='draft';

do $$ begin
 if not exists(select 1 from pg_constraint where conname='questions_scope_check') then
  alter table public.questions add constraint questions_scope_check check(question_scope in ('practice','secure_exam'));
 end if;
 if not exists(select 1 from pg_constraint where conname='questions_approval_check') then
  alter table public.questions add constraint questions_approval_check check(approval_status in ('draft','pending','approved','archived'));
 end if;
end $$;

create index if not exists questions_subject_scope_idx on public.questions(subject_id,question_scope,approval_status);

create table if not exists public.question_edit_requests (
 id uuid primary key default gen_random_uuid(),
 question_id uuid not null references public.questions(id) on delete cascade,
 requested_by uuid not null references public.profiles(id) on delete cascade,
 assigned_to uuid references public.profiles(id) on delete set null,
 message text not null check(length(trim(message)) between 1 and 1200),
 response text,
 status text not null default 'open' check(status in ('open','accepted','completed','rejected')),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index if not exists question_edit_requests_question_idx on public.question_edit_requests(question_id,created_at desc);
alter table public.question_edit_requests enable row level security;
grant select,insert,update,delete on public.question_edit_requests to authenticated;

drop policy if exists question_edit_requests_staff_select on public.question_edit_requests;
create policy question_edit_requests_staff_select on public.question_edit_requests for select to authenticated using(
 public.is_admin() or exists(
  select 1 from public.questions q where q.id=question_id and public.is_subject_teacher(q.subject_id)
 )
);
drop policy if exists question_edit_requests_staff_insert on public.question_edit_requests;
create policy question_edit_requests_staff_insert on public.question_edit_requests for insert to authenticated with check(
 requested_by=auth.uid() and (public.is_admin() or exists(
  select 1 from public.questions q where q.id=question_id and public.is_subject_teacher(q.subject_id)
 ))
);
drop policy if exists question_edit_requests_manage on public.question_edit_requests;
create policy question_edit_requests_manage on public.question_edit_requests for update to authenticated using(
 public.is_admin() or requested_by=auth.uid() or exists(
  select 1 from public.questions q where q.id=question_id and q.created_by=auth.uid()
 )
) with check(
 public.is_admin() or requested_by=auth.uid() or exists(
  select 1 from public.questions q where q.id=question_id and q.created_by=auth.uid()
 )
);

-- Giảng viên cùng phụ trách một môn được nhìn thấy thông tin đồng nghiệp.
drop policy if exists profiles_subject_colleagues_view on public.profiles;
create policy profiles_subject_colleagues_view on public.profiles for select to authenticated using(
 id=auth.uid() or public.is_admin() or exists(
  select 1 from public.subject_members mine
  join public.subject_members colleague on colleague.subject_id=mine.subject_id
  where mine.user_id=auth.uid() and mine.role in ('teacher','lecturer','giangvien')
    and colleague.user_id=profiles.id and colleague.role in ('teacher','lecturer','giangvien')
 )
);

-- Không cho sinh viên đọc trực tiếp nội dung/đáp án trong ngân hàng.
-- Bài kiểm tra tiếp tục cấp snapshot an toàn qua các RPC security definer.
drop policy if exists questions_select_subject_members on public.questions;
drop policy if exists questions_staff_select on public.questions;
create policy questions_staff_select on public.questions for select to authenticated using(
 public.is_admin() or public.is_subject_teacher(subject_id)
);
drop policy if exists question_options_select_subject_members on public.question_options;
drop policy if exists question_options_staff_select on public.question_options;
create policy question_options_staff_select on public.question_options for select to authenticated using(
 public.is_admin() or public.is_subject_teacher(public.question_subject_id(question_id))
);

-- Chỉ người tạo hoặc Admin sửa/xóa câu hỏi và phương án; đồng nghiệp dùng đề nghị chỉnh sửa.
drop policy if exists questions_teacher_or_admin_update on public.questions;
drop policy if exists questions_creator_or_admin_update on public.questions;
create policy questions_creator_or_admin_update on public.questions for update to authenticated using(
 public.is_admin() or created_by=auth.uid()
) with check(public.is_admin() or created_by=auth.uid());
drop policy if exists questions_teacher_or_admin_delete on public.questions;
drop policy if exists questions_creator_or_admin_delete on public.questions;
create policy questions_creator_or_admin_delete on public.questions for delete to authenticated using(
 public.is_admin() or created_by=auth.uid()
);

drop policy if exists question_options_teacher_or_admin_update on public.question_options;
drop policy if exists question_options_creator_or_admin_update on public.question_options;
create policy question_options_creator_or_admin_update on public.question_options for update to authenticated using(
 public.is_admin() or exists(select 1 from public.questions q where q.id=question_id and q.created_by=auth.uid())
) with check(
 public.is_admin() or exists(select 1 from public.questions q where q.id=question_id and q.created_by=auth.uid())
);
drop policy if exists question_options_teacher_or_admin_insert on public.question_options;
drop policy if exists question_options_creator_or_admin_insert on public.question_options;
create policy question_options_creator_or_admin_insert on public.question_options for insert to authenticated with check(
 public.is_admin() or exists(select 1 from public.questions q where q.id=question_id and q.created_by=auth.uid())
);
drop policy if exists question_options_teacher_or_admin_delete on public.question_options;
drop policy if exists question_options_creator_or_admin_delete on public.question_options;
create policy question_options_creator_or_admin_delete on public.question_options for delete to authenticated using(
 public.is_admin() or exists(select 1 from public.questions q where q.id=question_id and q.created_by=auth.uid())
);

create or replace function public.normalize_question_text(p_text text)
returns text language sql immutable parallel safe as $$
 select trim(regexp_replace(lower(coalesce(p_text,'')),'[[:space:]]+',' ','g'))
$$;

create or replace function public.find_similar_questions(
 p_subject_id uuid,
 p_content text,
 p_exclude_id uuid default null,
 p_limit integer default 5
) returns table(
 id uuid, code text, content text, similarity_score real,
 question_scope text, approval_status text
) language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if not public.is_admin() and not public.is_subject_teacher(p_subject_id) then
  raise exception 'Bạn không có quyền kiểm tra ngân hàng này';
 end if;
 return query
 select q.id,'Q-'||upper(left(replace(q.id::text,'-',''),6)),q.content,
   similarity(public.normalize_question_text(q.content),public.normalize_question_text(p_content))::real,
   q.question_scope,q.approval_status
 from public.questions q
 where q.subject_id=p_subject_id and (p_exclude_id is null or q.id<>p_exclude_id)
   and q.approval_status<>'archived'
   and similarity(public.normalize_question_text(q.content),public.normalize_question_text(p_content))>=0.55
 order by 4 desc limit greatest(1,least(coalesce(p_limit,5),20));
end$$;
revoke all on function public.find_similar_questions(uuid,text,uuid,integer) from public,anon;
grant execute on function public.find_similar_questions(uuid,text,uuid,integer) to authenticated;

-- Lịch sử v9.4 lưu thêm nhóm sử dụng và trạng thái duyệt.
create or replace function public.archive_question_revision(p_question_id uuid)
returns integer language plpgsql security definer set search_path=public as $$
declare qrow public.questions%rowtype; next_no integer;
begin
 select * into qrow from public.questions where id=p_question_id for update;
 if not found then raise exception 'Không tìm thấy câu hỏi'; end if;
 if not public.is_admin() and qrow.created_by<>auth.uid() then raise exception 'Bạn không có quyền sửa câu hỏi này'; end if;
 select coalesce(max(revision_no),0)+1 into next_no from public.question_revisions where question_id=p_question_id;
 insert into public.question_revisions(question_id,revision_no,changed_by,snapshot)
 values(p_question_id,next_no,auth.uid(),jsonb_build_object(
   'content',qrow.content,'explanation',qrow.explanation,'correct_answer',qrow.correct_answer,
   'chapter_id',qrow.chapter_id,'topic_id',qrow.topic_id,'clo_id',qrow.clo_id,
   'status',qrow.status,'question_scope',qrow.question_scope,'approval_status',qrow.approval_status,
   'options',coalesce((select jsonb_agg(jsonb_build_object('key',option_key,'content',content) order by option_key) from public.question_options where question_id=p_question_id),'[]'::jsonb)
 ));
 return next_no;
end$$;
revoke all on function public.archive_question_revision(uuid) from public,anon;
grant execute on function public.archive_question_revision(uuid) to authenticated;
