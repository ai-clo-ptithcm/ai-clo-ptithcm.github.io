-- AI-CLO PTITHCM V11.2
-- Ngày học phần và bảo vệ quyền sở hữu câu hỏi.
-- Migration cộng thêm: không xóa, không di chuyển và không nhân bản câu hỏi.

begin;

do $$
begin
 if to_regclass('public.question_banks') is null
    or not exists(select 1 from information_schema.columns
                  where table_schema='public' and table_name='subjects' and column_name='question_bank_id') then
  raise exception 'DỪNG: cần hoàn tất migration V11.1 trước.';
 end if;
end
$$;

alter table public.subjects add column if not exists starts_on date;
alter table public.subjects add column if not exists ends_on date;
alter table public.subjects drop constraint if exists subjects_course_date_range;
alter table public.subjects add constraint subjects_course_date_range
 check(starts_on is null or ends_on is null or ends_on>=starts_on);

comment on column public.subjects.starts_on is 'Ngày bắt đầu học phần theo lịch đào tạo.';
comment on column public.subjects.ends_on is 'Ngày kết thúc học phần theo lịch đào tạo.';

-- RLS rõ ràng: giảng viên chỉ sửa/xóa câu do chính mình nhập; Admin quản lý toàn bộ.
drop policy if exists questions_teacher_or_admin_update on public.questions;
drop policy if exists questions_creator_or_admin_update on public.questions;
create policy questions_creator_or_admin_update on public.questions
 for update to authenticated
 using(public.is_admin() or created_by=auth.uid())
 with check(public.is_admin() or created_by=auth.uid());

drop policy if exists questions_teacher_or_admin_delete on public.questions;
drop policy if exists questions_creator_or_admin_delete on public.questions;
create policy questions_creator_or_admin_delete on public.questions
 for delete to authenticated
 using(public.is_admin() or created_by=auth.uid());

drop policy if exists question_options_teacher_or_admin_insert on public.question_options;
drop policy if exists question_options_creator_or_admin_insert on public.question_options;
create policy question_options_creator_or_admin_insert on public.question_options
 for insert to authenticated with check(
  public.is_admin() or exists(
   select 1 from public.questions q
   where q.id=question_id and q.created_by=auth.uid()
  )
 );

drop policy if exists question_options_teacher_or_admin_update on public.question_options;
drop policy if exists question_options_creator_or_admin_update on public.question_options;
create policy question_options_creator_or_admin_update on public.question_options
 for update to authenticated using(
  public.is_admin() or exists(
   select 1 from public.questions q
   where q.id=question_id and q.created_by=auth.uid()
  )
 ) with check(
  public.is_admin() or exists(
   select 1 from public.questions q
   where q.id=question_id and q.created_by=auth.uid()
  )
 );

drop policy if exists question_options_teacher_or_admin_delete on public.question_options;
drop policy if exists question_options_creator_or_admin_delete on public.question_options;
create policy question_options_creator_or_admin_delete on public.question_options
 for delete to authenticated using(
  public.is_admin() or exists(
   select 1 from public.questions q
   where q.id=question_id and q.created_by=auth.uid()
  )
 );

-- Lớp bảo vệ thứ hai bằng trigger, không phụ thuộc tên các policy cũ.
create or replace function public.guard_question_owner()
returns trigger language plpgsql security definer
set search_path=public,pg_temp as $$
begin
 if tg_op='INSERT' then
  if not public.is_admin() then new.created_by=auth.uid(); end if;
  return new;
 end if;
 if not public.is_admin() and old.created_by is distinct from auth.uid() then
  raise exception 'Chỉ người nhập hoặc Admin được sửa/xóa câu hỏi';
 end if;
 if tg_op='UPDATE' and not public.is_admin() and new.created_by is distinct from old.created_by then
  raise exception 'Giảng viên không được chuyển quyền sở hữu câu hỏi';
 end if;
 if tg_op='DELETE' then return old; end if;
 return new;
end
$$;

drop trigger if exists guard_question_owner_trigger on public.questions;
create trigger guard_question_owner_trigger
 before insert or update or delete on public.questions
 for each row execute function public.guard_question_owner();

create or replace function public.guard_question_option_owner()
returns trigger language plpgsql security definer
set search_path=public,pg_temp as $$
declare qid uuid; owner_id uuid;
begin
 qid=case when tg_op='DELETE' then old.question_id else new.question_id end;
 select created_by into owner_id from public.questions where id=qid;
 if owner_id is null then raise exception 'Không tìm thấy câu hỏi của phương án'; end if;
 if not public.is_admin() and owner_id is distinct from auth.uid() then
  raise exception 'Chỉ người nhập hoặc Admin được sửa phương án';
 end if;
 if tg_op='DELETE' then return old; end if;
 return new;
end
$$;

drop trigger if exists guard_question_option_owner_trigger on public.question_options;
create trigger guard_question_option_owner_trigger
 before insert or update or delete on public.question_options
 for each row execute function public.guard_question_option_owner();

commit;

select
 'MIGRATION_V11_2_OK' as trang_thai,
 (select count(*) from public.subjects) as so_hoc_phan,
 (select count(*) from public.questions) as so_cau_hoi,
 now() as hoan_tat_luc;
