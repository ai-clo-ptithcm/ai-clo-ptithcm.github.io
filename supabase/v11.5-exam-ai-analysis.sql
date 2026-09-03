-- AI-CLO PTITHCM V11.5
-- Cho phép lưu nhận xét AI cho riêng từng bài kiểm tra.
begin;

alter table public.assessment_ai_feedback
  add column if not exists exam_id uuid references public.exams(id) on delete cascade;

alter table public.assessment_ai_feedback
  drop constraint if exists assessment_ai_feedback_scope_check;

alter table public.assessment_ai_feedback
  add constraint assessment_ai_feedback_scope_check
  check (scope in ('attempt','student','class','exam'));

create index if not exists assessment_ai_feedback_exam_idx
  on public.assessment_ai_feedback(exam_id, generated_at desc)
  where exam_id is not null;

commit;

select 'MIGRATION_V11_5_OK' as trang_thai, now() as hoan_tat_luc;
