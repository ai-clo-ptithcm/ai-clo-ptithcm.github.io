-- AI-CLO PTITHCM V12.6.3
-- Shared question-bank write compatibility.
--
-- V11.1 introduced question_bank_id while legacy composite foreign keys on
-- questions still require questions.subject_id to match the subject_id carried
-- by chapter/CLO rows. A new course may reuse an existing question bank, so its
-- active subject_id is not necessarily the legacy subject_id of that bank.
--
-- This migration keeps the legacy constraints intact and normalizes the legacy
-- questions.subject_id BEFORE PostgreSQL checks those foreign keys.

begin;

-- Preconditions: shared-bank schema must already exist.
do $$
begin
  if to_regclass('public.question_banks') is null
     or not exists (
       select 1 from information_schema.columns
       where table_schema='public' and table_name='questions' and column_name='question_bank_id'
     ) then
    raise exception 'DỪNG: cần hoàn tất migration Question Bank V11.1 trước.';
  end if;
end
$$;

create or replace function public.normalize_question_legacy_subject()
returns trigger
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  chapter_subject uuid;
  chapter_bank uuid;
  clo_subject uuid;
  clo_bank uuid;
  topic_chapter uuid;
begin
  if new.chapter_id is null then
    raise exception 'Câu hỏi phải thuộc một Chương';
  end if;
  if new.clo_id is null then
    raise exception 'Câu hỏi phải thuộc một CLO';
  end if;

  select c.subject_id, c.question_bank_id
    into chapter_subject, chapter_bank
  from public.chapters c
  where c.id = new.chapter_id;

  if chapter_subject is null or chapter_bank is null then
    raise exception 'Không tìm thấy Chương hoặc Chương chưa thuộc ngân hàng câu hỏi';
  end if;

  select c.subject_id, c.question_bank_id
    into clo_subject, clo_bank
  from public.clos c
  where c.id = new.clo_id;

  if clo_subject is null or clo_bank is null then
    raise exception 'Không tìm thấy CLO hoặc CLO chưa thuộc ngân hàng câu hỏi';
  end if;

  if chapter_bank is distinct from clo_bank then
    raise exception 'Chương và CLO không thuộc cùng ngân hàng câu hỏi';
  end if;

  if chapter_subject is distinct from clo_subject then
    raise exception 'Dữ liệu legacy của Chương và CLO không cùng học phần nguồn';
  end if;

  if new.topic_id is not null then
    select t.chapter_id into topic_chapter
    from public.topics t
    where t.id = new.topic_id;
    if topic_chapter is null then
      raise exception 'Không tìm thấy Chủ đề';
    end if;
    if topic_chapter is distinct from new.chapter_id then
      raise exception 'Chủ đề không thuộc Chương đã chọn';
    end if;
  end if;

  -- Ownership thật: question_bank_id.
  -- subject_id chỉ còn là trường tương thích cho các FK legacy.
  new.question_bank_id := chapter_bank;
  new.subject_id := chapter_subject;

  return new;
end
$$;

revoke all on function public.normalize_question_legacy_subject() from public,anon;
grant execute on function public.normalize_question_legacy_subject() to authenticated;

-- Use a deterministic early trigger name so normalization happens before other
-- question BEFORE triggers that may rely on a consistent bank/legacy subject.
drop trigger if exists a_questions_normalize_legacy_subject on public.questions;
create trigger a_questions_normalize_legacy_subject
before insert or update of subject_id,question_bank_id,chapter_id,topic_id,clo_id
on public.questions
for each row execute function public.normalize_question_legacy_subject();

-- Safe repair for pre-existing rows whose bank is already known but legacy
-- subject_id drifted. The function/trigger above will normalize each row.
update public.questions q
set subject_id = q.subject_id
where q.question_bank_id is not null
  and exists (
    select 1 from public.chapters c
    where c.id=q.chapter_id
      and c.question_bank_id=q.question_bank_id
      and c.subject_id is distinct from q.subject_id
  );

commit;

select
  'V12.6.3_OK' as status,
  count(*) filter (
    where q.subject_id is distinct from c.subject_id
  ) as questions_still_mismatched,
  now() as completed_at
from public.questions q
join public.chapters c on c.id=q.chapter_id;
