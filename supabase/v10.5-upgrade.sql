-- AI-CLO PTITHCM V10.5
-- 1) Một câu có thể lưu ở Luyện tập, Đề thi, hoặc Cả hai.
-- 2) Câu chỉ thuộc Ngân hàng đề thi (secure_exam) bị chặn ở tầng DB,
--    không thể đưa vào bài kiểm tra trực tuyến (exam_questions / exam_question_pool).
-- Chạy SAU v10.4-upgrade.sql.

begin;

alter table public.questions drop constraint if exists questions_scope_check;
alter table public.questions add constraint questions_scope_check
  check(question_scope in ('practice','secure_exam','both'));

comment on column public.questions.question_scope is
  'practice = luyện tập/kiểm tra; secure_exam = đề thi bảo mật; both = thuộc cả hai ngân hàng';

-- Hai trigger exam_questions và exam_question_pool đã dùng chung hàm này từ v9.1.
-- Bổ sung kiểm tra nguồn câu để bảo vệ cả khi người dùng can thiệp trực tiếp từ console/API.
create or replace function public.guard_exam_question_changes()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare
  v_exam_id uuid;
  v_scope text;
begin
  if tg_op='DELETE' then
    v_exam_id:=old.exam_id;
  else
    v_exam_id:=new.exam_id;
  end if;

  if exists(select 1 from public.exam_attempts where exam_id=v_exam_id limit 1) then
    raise exception 'Bài kiểm tra đã có lượt làm; bộ câu hỏi đã được khóa';
  end if;

  if tg_op<>'DELETE' then
    select q.question_scope into v_scope
    from public.questions q where q.id=new.question_id;
    if v_scope is null then
      raise exception 'Không tìm thấy câu hỏi';
    end if;
    if v_scope='secure_exam' then
      raise exception 'Câu hỏi thuộc Ngân hàng đề thi - bảo mật, không được dùng cho bài kiểm tra trực tuyến';
    end if;
  end if;

  if tg_op='DELETE' then return old; end if;
  return new;
end;$$;

-- Bảo đảm trigger vẫn tồn tại, kể cả project từng chạy migration không đầy đủ.
drop trigger if exists trg_guard_exam_questions on public.exam_questions;
create trigger trg_guard_exam_questions
before insert or update or delete on public.exam_questions
for each row execute function public.guard_exam_question_changes();

drop trigger if exists trg_guard_exam_pool on public.exam_question_pool;
create trigger trg_guard_exam_pool
before insert or update or delete on public.exam_question_pool
for each row execute function public.guard_exam_question_changes();

commit;
