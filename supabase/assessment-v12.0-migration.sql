-- AI-CLO PTITHCM V12.0
-- Cho phép từng Bài kiểm tra được tính hoặc không tính vào kết quả CLO học phần.
-- Chạy đúng một lần trong Supabase SQL Editor. An toàn khi chạy lại.

alter table public.exams
  add column if not exists counts_toward_grade boolean not null default true;

comment on column public.exams.counts_toward_grade is
  'True: bài kiểm tra được tính vào tổng hợp GPA/CLO học phần. False: bài vẫn chấm riêng nhưng không đưa vào tổng hợp CLO học phần.';

update public.exams
set counts_toward_grade = true
where counts_toward_grade is null;
