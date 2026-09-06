-- AI-CLO PTITHCM V11.1
-- BƯỚC 2/5: TẠO NGÂN HÀNG CÂU HỎI ĐỘC LẬP (MIGRATION CỘNG THÊM)
--
-- CHỈ CHẠY SAU KHI:
--   1) v11.1-step1-backup-precheck.sql trả về BACKUP_OK;
--   2) đã lưu file Excel ngân hàng câu hỏi ở máy.
--
-- File này không xóa subject_id, không xóa câu hỏi và không đổi liên kết đề cũ.

begin;

do $$
begin
 if to_regnamespace('backup_v111_20260903') is null then
  raise exception 'DỪNG: chưa có backup_v111_20260903. Hãy chạy bước 1 trước.';
 end if;
 if not exists(
  select 1 from backup_v111_20260903.manifest
  where source_table='questions'
 ) then
  raise exception 'DỪNG: manifest backup không có bảng questions.';
 end if;
end
$$;

create table if not exists public.question_banks(
 id uuid primary key default gen_random_uuid(),
 name text not null,
 code text not null unique,
 description text,
 source_subject_id uuid references public.subjects(id) on delete restrict,
 is_active boolean not null default true,
 created_by uuid references public.profiles(id) on delete set null,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 constraint question_banks_name_not_blank check(length(trim(name))>0),
 constraint question_banks_code_format check(code ~ '^[A-Z0-9][A-Z0-9_-]{1,31}$')
);

alter table public.subjects add column if not exists question_bank_id uuid
 references public.question_banks(id) on delete restrict;
alter table public.chapters add column if not exists question_bank_id uuid
 references public.question_banks(id) on delete restrict;
alter table public.topics add column if not exists question_bank_id uuid
 references public.question_banks(id) on delete restrict;
alter table public.clos add column if not exists question_bank_id uuid
 references public.question_banks(id) on delete restrict;
alter table public.questions add column if not exists question_bank_id uuid
 references public.question_banks(id) on delete restrict;
alter table public.questions add column if not exists display_code varchar(6);

-- Mỗi học phần hiện tại được cấp một ngân hàng riêng. Không tự ghép chỉ dựa
-- vào tên để tránh trộn nhầm dữ liệu của hai học phần đang hoạt động.
insert into public.question_banks(name,code,description,source_subject_id)
select
 trim(s.name)||' — Ngân hàng câu hỏi',
 'BANK_'||upper(left(replace(s.id::text,'-',''),8)),
 'Được tạo tự động từ học phần '||trim(s.name),
 s.id
from public.subjects s
where not exists(
 select 1 from public.question_banks b where b.source_subject_id=s.id
);

update public.subjects s
set question_bank_id=b.id
from public.question_banks b
where b.source_subject_id=s.id
  and s.question_bank_id is null;

update public.chapters x set question_bank_id=s.question_bank_id
from public.subjects s where s.id=x.subject_id and x.question_bank_id is null;
update public.clos x set question_bank_id=s.question_bank_id
from public.subjects s where s.id=x.subject_id and x.question_bank_id is null;
update public.questions x set question_bank_id=s.question_bank_id
from public.subjects s where s.id=x.subject_id and x.question_bank_id is null;
update public.topics x set question_bank_id=c.question_bank_id
from public.chapters c where c.id=x.chapter_id and x.question_bank_id is null;

-- Mã hiển thị 6 chữ số, tăng độc lập trong từng ngân hàng.
with numbered as(
 select id,row_number() over(
  partition by question_bank_id order by created_at nulls last,id
 ) as number
 from public.questions
 where display_code is null
)
update public.questions q
set display_code=lpad(numbered.number::text,6,'0')
from numbered where numbered.id=q.id;

do $$
begin
 if exists(select 1 from public.subjects where question_bank_id is null) then
  raise exception 'DỪNG: còn học phần chưa được gán ngân hàng.';
 end if;
 if exists(select 1 from public.chapters where question_bank_id is null)
 or exists(select 1 from public.topics where question_bank_id is null)
 or exists(select 1 from public.clos where question_bank_id is null)
 or exists(select 1 from public.questions where question_bank_id is null) then
  raise exception 'DỪNG: còn dữ liệu nội dung chưa được gán ngân hàng.';
 end if;
 if exists(select 1 from public.questions where display_code is null or display_code !~ '^[0-9]{6}$') then
  raise exception 'DỪNG: mã câu hỏi 6 số chưa hợp lệ.';
 end if;
 if exists(
  select 1 from public.questions group by question_bank_id,display_code having count(*)>1
 ) then
  raise exception 'DỪNG: phát hiện mã câu hỏi trùng trong một ngân hàng.';
 end if;
end
$$;

create unique index if not exists questions_bank_display_code_uidx
 on public.questions(question_bank_id,display_code);
create index if not exists subjects_question_bank_idx
 on public.subjects(question_bank_id);
create index if not exists chapters_question_bank_idx
 on public.chapters(question_bank_id,order_index);
create index if not exists topics_question_bank_idx
 on public.topics(question_bank_id,chapter_id,order_index);
create index if not exists clos_question_bank_idx
 on public.clos(question_bank_id,code);
create index if not exists questions_question_bank_idx
 on public.questions(question_bank_id,created_at desc);

alter table public.subjects alter column question_bank_id set not null;
alter table public.chapters alter column question_bank_id set not null;
alter table public.topics alter column question_bank_id set not null;
alter table public.clos alter column question_bank_id set not null;
alter table public.questions alter column question_bank_id set not null;
alter table public.questions alter column display_code set not null;
alter table public.questions drop constraint if exists questions_display_code_format;
alter table public.questions add constraint questions_display_code_format
 check(display_code ~ '^[0-9]{6}$');

-- Phân quyền được suy ra từ các học phần đang sử dụng ngân hàng.
create or replace function public.is_question_bank_member(p_bank_id uuid)
returns boolean language sql stable security definer
set search_path=public,pg_temp as $$
 select public.is_admin() or exists(
  select 1 from public.subjects s
  join public.subject_members m on m.subject_id=s.id
  where s.question_bank_id=p_bank_id and m.user_id=auth.uid()
 )
$$;

create or replace function public.is_question_bank_teacher(p_bank_id uuid)
returns boolean language sql stable security definer
set search_path=public,pg_temp as $$
 select public.is_admin() or exists(
  select 1 from public.subjects s
  join public.subject_members m on m.subject_id=s.id
  where s.question_bank_id=p_bank_id and m.user_id=auth.uid()
    and m.role in ('teacher','lecturer','giangvien')
 )
$$;

revoke all on function public.is_question_bank_member(uuid) from public,anon;
revoke all on function public.is_question_bank_teacher(uuid) from public,anon;
grant execute on function public.is_question_bank_member(uuid) to authenticated;
grant execute on function public.is_question_bank_teacher(uuid) to authenticated;

alter table public.question_banks enable row level security;
grant select on public.question_banks to authenticated;
grant insert,update,delete on public.question_banks to authenticated;
drop policy if exists question_banks_member_select on public.question_banks;
create policy question_banks_member_select on public.question_banks for select
 to authenticated using(public.is_question_bank_member(id));
drop policy if exists question_banks_admin_insert on public.question_banks;
create policy question_banks_admin_insert on public.question_banks for insert
 to authenticated with check(public.is_admin());
drop policy if exists question_banks_admin_update on public.question_banks;
create policy question_banks_admin_update on public.question_banks for update
 to authenticated using(public.is_admin()) with check(public.is_admin());
drop policy if exists question_banks_admin_delete on public.question_banks;
create policy question_banks_admin_delete on public.question_banks for delete
 to authenticated using(public.is_admin());

-- Tự gán ngân hàng khi code cũ vẫn chỉ gửi subject_id.
create or replace function public.assign_content_question_bank()
returns trigger language plpgsql security definer
set search_path=public,pg_temp as $$
begin
 if new.question_bank_id is null then
  select question_bank_id into new.question_bank_id
  from public.subjects where id=new.subject_id;
 end if;
 if new.question_bank_id is null then
  raise exception 'Học phần chưa có ngân hàng câu hỏi';
 end if;
 return new;
end
$$;

drop trigger if exists chapters_assign_question_bank on public.chapters;
create trigger chapters_assign_question_bank before insert or update of subject_id,question_bank_id
 on public.chapters for each row execute function public.assign_content_question_bank();
drop trigger if exists clos_assign_question_bank on public.clos;
create trigger clos_assign_question_bank before insert or update of subject_id,question_bank_id
 on public.clos for each row execute function public.assign_content_question_bank();
drop trigger if exists questions_assign_question_bank on public.questions;
create trigger questions_assign_question_bank before insert or update of subject_id,question_bank_id
 on public.questions for each row execute function public.assign_content_question_bank();

create or replace function public.assign_topic_question_bank()
returns trigger language plpgsql security definer
set search_path=public,pg_temp as $$
begin
 if new.question_bank_id is null then
  select question_bank_id into new.question_bank_id
  from public.chapters where id=new.chapter_id;
 end if;
 if new.question_bank_id is null then raise exception 'Chương chưa có ngân hàng câu hỏi'; end if;
 return new;
end
$$;
drop trigger if exists topics_assign_question_bank on public.topics;
create trigger topics_assign_question_bank before insert or update of chapter_id,question_bank_id
 on public.topics for each row execute function public.assign_topic_question_bank();

-- Cấp mã 6 số an toàn khi thêm câu mới; khóa theo ngân hàng chống trùng khi
-- nhiều người nhập đồng thời.
create or replace function public.assign_question_display_code()
returns trigger language plpgsql security definer
set search_path=public,pg_temp as $$
declare next_number integer;
begin
 if new.display_code is not null then return new; end if;
 perform pg_advisory_xact_lock(hashtext(new.question_bank_id::text));
 select coalesce(max(display_code::integer),0)+1 into next_number
 from public.questions where question_bank_id=new.question_bank_id;
 if next_number>999999 then raise exception 'Ngân hàng đã hết dải mã 6 số'; end if;
 new.display_code=lpad(next_number::text,6,'0');
 return new;
end
$$;
drop trigger if exists questions_assign_display_code on public.questions;
drop trigger if exists questions_z_assign_display_code on public.questions;
create trigger questions_z_assign_display_code before insert
 on public.questions for each row execute function public.assign_question_display_code();

-- RLS cộng thêm: không xóa các policy cũ trong giai đoạn tương thích.
do $$
declare t text;
begin
 foreach t in array array['chapters','topics','clos'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('drop policy if exists %I on public.%I',t||'_bank_member_select',t);
  execute format(
   'create policy %I on public.%I for select to authenticated using(public.is_question_bank_member(question_bank_id))',
   t||'_bank_member_select',t
  );
  execute format('drop policy if exists %I on public.%I',t||'_bank_teacher_insert',t);
  execute format(
   'create policy %I on public.%I for insert to authenticated with check(public.is_question_bank_teacher(question_bank_id))',
   t||'_bank_teacher_insert',t
  );
  execute format('drop policy if exists %I on public.%I',t||'_bank_teacher_update',t);
  execute format(
   'create policy %I on public.%I for update to authenticated using(public.is_question_bank_teacher(question_bank_id)) with check(public.is_question_bank_teacher(question_bank_id))',
   t||'_bank_teacher_update',t
  );
  execute format('drop policy if exists %I on public.%I',t||'_bank_teacher_delete',t);
  execute format(
   'create policy %I on public.%I for delete to authenticated using(public.is_question_bank_teacher(question_bank_id))',
   t||'_bank_teacher_delete',t
  );
 end loop;
end
$$;

drop policy if exists questions_bank_staff_select on public.questions;
create policy questions_bank_staff_select on public.questions for select
 to authenticated using(public.is_question_bank_teacher(question_bank_id));
drop policy if exists questions_bank_creator_insert on public.questions;
create policy questions_bank_creator_insert on public.questions for insert
 to authenticated with check(
  public.is_question_bank_teacher(question_bank_id)
  and (public.is_admin() or created_by=auth.uid())
 );

-- Các bảng con của câu hỏi dùng ngân hàng của câu cha.
create or replace function public.question_bank_for_question(p_question_id uuid)
returns uuid language sql stable security definer
set search_path=public,pg_temp as $$
 select question_bank_id from public.questions where id=p_question_id
$$;
revoke all on function public.question_bank_for_question(uuid) from public,anon;
grant execute on function public.question_bank_for_question(uuid) to authenticated;

drop policy if exists question_options_bank_staff_select on public.question_options;
create policy question_options_bank_staff_select on public.question_options for select
 to authenticated using(
  public.is_question_bank_teacher(public.question_bank_for_question(question_id))
 );
drop policy if exists question_revisions_bank_staff_select on public.question_revisions;
create policy question_revisions_bank_staff_select on public.question_revisions for select
 to authenticated using(
  public.is_question_bank_teacher(public.question_bank_for_question(question_id))
 );

-- Hàm dò trùng cũ giữ nguyên chữ ký nhưng so sánh trong ngân hàng đã chọn.
create or replace function public.find_similar_questions(
 p_subject_id uuid,
 p_content text,
 p_exclude_id uuid default null,
 p_limit integer default 5
) returns table(
 id uuid, code text, content text, similarity_score real,
 question_scope text, approval_status text
) language plpgsql security definer set search_path=public,pg_temp as $$
declare bank_id uuid;
begin
 select question_bank_id into bank_id from public.subjects where subjects.id=p_subject_id;
 if bank_id is null or not public.is_question_bank_teacher(bank_id) then
  raise exception 'Bạn không có quyền kiểm tra ngân hàng này';
 end if;
 return query
 select q.id,q.display_code::text,q.content,
  similarity(public.normalize_question_text(q.content),public.normalize_question_text(p_content))::real,
  q.question_scope,q.approval_status
 from public.questions q
 where q.question_bank_id=bank_id
  and (p_exclude_id is null or q.id<>p_exclude_id)
  and q.approval_status<>'archived'
  and similarity(public.normalize_question_text(q.content),public.normalize_question_text(p_content))>=0.55
 order by 4 desc limit greatest(1,least(coalesce(p_limit,5),20));
end
$$;

revoke all on function public.find_similar_questions(uuid,text,uuid,integer) from public,anon;
grant execute on function public.find_similar_questions(uuid,text,uuid,integer) to authenticated;

create or replace function public.find_similar_questions_scoped(
 p_subject_id uuid,
 p_chapter_id uuid,
 p_topic_id uuid,
 p_content text,
 p_exclude_id uuid default null,
 p_limit integer default 5
) returns table(
 id uuid, code text, content text, similarity_score real,
 question_scope text, approval_status text, chapter_id uuid, topic_id uuid
) language plpgsql security definer set search_path=public,pg_temp as $$
declare bank_id uuid;
begin
 select question_bank_id into bank_id from public.subjects where subjects.id=p_subject_id;
 if bank_id is null or not public.is_question_bank_teacher(bank_id) then
  raise exception 'Bạn không có quyền kiểm tra ngân hàng này';
 end if;
 return query
 select q.id,q.display_code::text,q.content,
  similarity(public.normalize_question_text(q.content),public.normalize_question_text(p_content))::real,
  q.question_scope,q.approval_status,q.chapter_id,q.topic_id
 from public.questions q
 where q.question_bank_id=bank_id
  and q.chapter_id=p_chapter_id
  and (p_topic_id is null or q.topic_id=p_topic_id)
  and (p_exclude_id is null or q.id<>p_exclude_id)
  and coalesce(q.approval_status,'')<>'archived'
  and similarity(public.normalize_question_text(q.content),public.normalize_question_text(p_content))>=0.45
 order by 4 desc limit greatest(1,least(coalesce(p_limit,5),20));
end
$$;
revoke all on function public.find_similar_questions_scoped(uuid,uuid,uuid,text,uuid,integer) from public,anon;
grant execute on function public.find_similar_questions_scoped(uuid,uuid,uuid,text,uuid,integer) to authenticated;

-- Kiểm tra bảo toàn trước khi COMMIT.
do $$
declare backup_questions bigint; current_questions bigint;
declare backup_options bigint; current_options bigint;
begin
 select row_count into backup_questions from backup_v111_20260903.manifest where source_table='questions';
 select count(*) into current_questions from public.questions;
 select row_count into backup_options from backup_v111_20260903.manifest where source_table='question_options';
 select count(*) into current_options from public.question_options;
 if current_questions<>backup_questions then
  raise exception 'DỪNG: số câu hiện tại (%) khác backup (%).',current_questions,backup_questions;
 end if;
 if backup_options is not null and current_options<>backup_options then
  raise exception 'DỪNG: số phương án hiện tại (%) khác backup (%).',current_options,backup_options;
 end if;
 if exists(
  select 1 from public.questions q
  join public.chapters c on c.id=q.chapter_id
  where q.question_bank_id<>c.question_bank_id
 ) or exists(
  select 1 from public.questions q
  join public.clos c on c.id=q.clo_id
  where q.question_bank_id<>c.question_bank_id
 ) then
  raise exception 'DỪNG: phát hiện câu hỏi lệch ngân hàng với Chương hoặc CLO.';
 end if;
end
$$;

commit;

select
 b.id as question_bank_id,b.code,b.name,b.source_subject_id,
 count(distinct s.id) as so_hoc_phan_su_dung,
 count(distinct q.id) as so_cau,
 count(distinct q.id) filter(where q.question_scope='secure_exam') as cau_bao_mat,
 min(q.display_code) as ma_dau,
 max(q.display_code) as ma_cuoi
from public.question_banks b
left join public.subjects s on s.question_bank_id=b.id
left join public.questions q on q.question_bank_id=b.id
group by b.id,b.code,b.name,b.source_subject_id
order by b.name;

select 'MIGRATION_V11_1_OK' as trang_thai,now() as hoan_tat_luc;
