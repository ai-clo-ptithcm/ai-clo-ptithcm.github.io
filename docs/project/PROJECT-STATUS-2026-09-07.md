# Trạng thái dự án AI-CLO PTITHCM — 07/09/2026

## Trạng thái tổng quát

- Nhánh triển khai: `main`.
- Mốc chức năng hiện tại: **V12.6.x**.
- Trọng tâm: Assessment + Question Bank dùng chung.
- Frontend V12.6.1 đã có mode **Cố định và rút ngẫu nhiên**.
- Backend cần chạy đủ migration V12.6.3 và V12.6.4 trên Supabase để hoàn tất luồng dùng chung ngân hàng.

## Mô hình dữ liệu đang áp dụng

### Thuộc Question Bank

- Chapters
- Topics
- CLOs
- Questions

### Thuộc Subject/Học phần

- Exams
- Exam attempts
- Results / CLO scores
- Final exam packages

Nguyên tắc kiểm tra quyền và phạm vi câu hỏi phải ưu tiên `question_bank_id`, không giả định `questions.subject_id = exams.subject_id`.

## Assessment modes

1. `common_fixed` — đề chung cố định.
2. `student_fixed` — đề riêng theo sinh viên.
3. `attempt_random` — rút lại mỗi lượt làm.
4. `mixed_fixed_random` — một số câu cố định, phần còn lại rút ngẫu nhiên.

Với mode random thuần, Builder không hiển thị câu cụ thể. Với `mixed_fixed_random`, chỉ hiển thị câu cố định; phần random chỉ hiển thị thống kê.

## Migration cần có trên Supabase

### V12.6.3

```text
supabase/migrations/v12.6.3-question-bank-legacy-subject.sql
```

Mục tiêu: tương thích các foreign key legacy của `questions.subject_id` khi câu thuộc Question Bank dùng chung.

### V12.6.4

```text
supabase/migrations/assessment-v12.6.4-question-bank-scope.sql
```

Mục tiêu: sửa RPC Assessment và Final Exam để kiểm tra câu theo `question_bank_id`.

## Điểm chưa tuyên bố hoàn tất

Chưa coi V12.6.x là stable cho tới khi test đủ:

- thêm/lưu câu ở lớp mới dùng chung bank;
- Gemini question save;
- online assessment 4 modes;
- final exam secure bank;
- student attempt generation;
- kết quả CLO/GPA đúng subject.

## Quy tắc an toàn khi tiếp tục phát triển

- Không sửa runtime chỉ từ một ý đang trao đổi.
- Khi người dùng xác nhận bắt đầu triển khai, tạo backup branch trước.
- Chỉ sau backup mới commit lên `main`.
- Mỗi migration Supabase phải có thể chạy an toàn và có marker kiểm tra kết quả.
