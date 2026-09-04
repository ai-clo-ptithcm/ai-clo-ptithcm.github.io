-- AI-CLO PTITHCM V11.9
-- Chạy đúng 1 lần trong Supabase SQL Editor.
-- An toàn khi chạy lại nhờ IF NOT EXISTS.

alter table public.exams
  add column if not exists counts_toward_grade boolean not null default true;

comment on column public.exams.counts_toward_grade is
  'True: bài kiểm tra được tính vào GPA/Kết quả CLO học phần. False: chỉ là kết quả tham khảo; không đưa vào tổng hợp học phần.';

-- Dữ liệu cũ giữ nguyên hành vi hiện tại: tất cả bài cũ mặc định được tính.
update public.exams
set counts_toward_grade = true
where counts_toward_grade is null;
