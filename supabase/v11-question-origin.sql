-- AI-CLO PTITHCM V11: nguồn câu hỏi, xác nhận câu Học viện và bảo vệ câu chính thức.
-- Chạy một lần trong Supabase SQL Editor.

alter table public.questions add column if not exists origin_type text not null default 'lecturer';
alter table public.questions add column if not exists ai_batch_id uuid references public.ai_generation_batches(id) on delete set null;
alter table public.questions add column if not exists is_official boolean not null default false;
alter table public.questions add column if not exists verified_by uuid references public.profiles(id) on delete set null;
alter table public.questions add column if not exists verified_at timestamptz;

alter table public.questions drop constraint if exists questions_origin_type_check;
alter table public.questions add constraint questions_origin_type_check
 check(origin_type in ('lecturer','gemini','academy'));
create index if not exists questions_origin_idx on public.questions(subject_id,origin_type,is_official);

create or replace function public.guard_question_origin()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if tg_op='DELETE' then
  if old.is_official and not public.is_admin() then
   raise exception 'Câu hỏi Học viện đã xác nhận chỉ Admin được xóa';
  end if;
  return old;
 end if;

 if tg_op='UPDATE' and old.is_official and not public.is_admin() then
  raise exception 'Câu hỏi Học viện đã xác nhận chỉ Admin được chỉnh sửa';
 end if;

 if not public.is_admin() then
  if tg_op='UPDATE' and (new.is_official is distinct from old.is_official
      or new.verified_by is distinct from old.verified_by
      or new.verified_at is distinct from old.verified_at) then
   raise exception 'Chỉ Admin được xác nhận nguồn Học viện';
  end if;
  new.is_official=false; new.verified_by=null; new.verified_at=null;
 end if;

 if new.origin_type='academy' then
  new.question_scope='secure_exam';
  if not new.is_official then
   new.approval_status='pending'; new.status='draft';
   new.approved_by=null; new.approved_at=null;
  end if;
 else
  new.is_official=false; new.verified_by=null; new.verified_at=null;
 end if;
 return new;
end$$;

drop trigger if exists guard_question_origin_trigger on public.questions;
create trigger guard_question_origin_trigger before insert or update or delete on public.questions
for each row execute function public.guard_question_origin();

create or replace function public.guard_official_question_option()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare qid uuid;
begin
 qid=case when tg_op='DELETE' then old.question_id else new.question_id end;
 if exists(select 1 from public.questions where id=qid and is_official) and not public.is_admin() then
  raise exception 'Phương án của câu hỏi Học viện đã xác nhận chỉ Admin được chỉnh sửa';
 end if;
 if tg_op='DELETE' then return old; end if;
 return new;
end$$;
drop trigger if exists guard_official_question_option_trigger on public.question_options;
create trigger guard_official_question_option_trigger before insert or update or delete on public.question_options
for each row execute function public.guard_official_question_option();

create or replace function public.verify_academy_question(p_question_id uuid,p_approve boolean)
returns public.questions language plpgsql security definer set search_path=public,pg_temp as $$
declare q public.questions%rowtype;
begin
 if not public.is_admin() then raise exception 'Chỉ Admin được xác nhận nguồn Học viện'; end if;
 select * into q from public.questions where id=p_question_id for update;
 if not found then raise exception 'Không tìm thấy câu hỏi'; end if;
 if q.origin_type<>'academy' then raise exception 'Câu hỏi chưa được đề xuất là nguồn Học viện'; end if;
 if p_approve then
  update public.questions set is_official=true,verified_by=auth.uid(),verified_at=now(),
   question_scope='secure_exam',approval_status='approved',status='active',approved_by=auth.uid(),approved_at=now(),updated_at=now()
  where id=p_question_id returning * into q;
 else
  update public.questions set origin_type='lecturer',is_official=false,verified_by=null,verified_at=null,
   approval_status='draft',status='draft',approved_by=null,approved_at=null,updated_at=now()
  where id=p_question_id returning * into q;
 end if;
 return q;
end$$;
revoke all on function public.verify_academy_question(uuid,boolean) from public,anon;
grant execute on function public.verify_academy_question(uuid,boolean) to authenticated;

comment on column public.questions.created_by is 'Tài khoản nhập câu hỏi vào hệ thống, không mặc nhiên là tác giả.';
comment on column public.questions.origin_type is 'lecturer: giảng viên biên soạn; gemini: Gemini hỗ trợ; academy: đề xuất/đã xác nhận nguồn Học viện.';
comment on column public.questions.is_official is 'Admin đã xác nhận đây là câu hỏi chính thức của Học viện.';
