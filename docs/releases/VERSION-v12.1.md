# AI-CLO PTITHCM — V12.1 Stability Fix

Ngày: 05/09/2026

V12.1 tập trung sửa 3 lỗi P1 phát hiện khi audit V12.0. Không bổ sung nghiệp vụ mới.

## 1. Ma trận V12 được lưu bền vững

V12.0 cho phép hai kiểu cấu trúc bài kiểm tra:

- `topic_clo`: CLO cho mỗi Mục;
- `chapter_pool`: CLO chung các Mục được chọn trong từng Chương.

V12.1 bổ sung vào `exams`:

- `structure_mode`;
- `question_blueprint` (JSONB).

Frontend mới lưu và khôi phục blueprint từ Supabase thay vì phụ thuộc localStorage. Local draft chỉ còn là lớp phục hồi dự phòng.

RPC `populate_attempt_questions()` được nâng cấp:

- `common_fixed`: giữ nguyên bộ câu mẫu đóng băng;
- `student_fixed`: lần đầu rút theo blueprint, các lần sau giữ bộ câu đầu tiên của sinh viên;
- `attempt_random`: rút lại theo blueprint và ưu tiên câu sinh viên chưa gặp;
- với `chapter_pool`, hệ thống giữ đúng **Chương × CLO** nhưng cho phép thay đổi Mục bên trong tập Mục đã chọn.

Bài cũ được backfill theo hành vi an toàn `topic_clo`. Nếu trình duyệt còn local draft V12 có cấu trúc `chapter_pool`, frontend V12.1 có thể phục hồi blueprint đó lên server khi mở bài.

## 2. Sửa Làm thử của giảng viên

`attempt-autosave.js` không còn ghi đè các hàm preview giảng viên theo chữ ký V10.3.

Preview giảng viên tiếp tục do `assessment.js` quản lý và đọc từ `exam_question_pool` đã đóng băng, tránh lệch câu/đáp án nếu ngân hàng câu hỏi được chỉnh sau đó.

Autosave trong file này chỉ còn phụ trách lượt làm của sinh viên.

## 3. AI dùng cùng phạm vi với Kết quả CLO

Các phân tích tổng hợp theo học phần được đồng bộ với `counts_toward_grade`:

- `analyze-student-clo`: chỉ lấy các bài `counts_toward_grade=true`;
- `analyze-assessment` ở scope `class` và `student`: loại bài không tính CLO.

AI cho một `exam` cụ thể hoặc một `attempt` cụ thể vẫn hoạt động kể cả khi bài đó không tính vào kết quả CLO học phần.

## File thay đổi chính

- `docs/assessment-v12.1-migration.sql`
- `js/exams/assessment-v12.1.js`
- `js/exams/attempt-autosave.js`
- `js/core/feature-loader.js`
- `app.html`
- `supabase/functions/analyze-assessment/index.ts`
- `supabase/functions/analyze-student-clo/index.ts`

## Thứ tự cập nhật Supabase

1. Đảm bảo đã chạy `docs/assessment-v12.0-migration.sql`.
2. Chạy `docs/assessment-v12.1-migration.sql` trong Supabase SQL Editor.
3. Deploy lại Edge Function `analyze-assessment` bằng file `supabase/functions/analyze-assessment/index.ts`.
4. Deploy lại Edge Function `analyze-student-clo` bằng file `supabase/functions/analyze-student-clo/index.ts`.
5. Sau đó mới kiểm thử frontend V12.1 trên GitHub Pages.

## Kiểm thử khuyến nghị

### Ma trận

- Tạo bài `topic_clo`, chọn nhiều Chương/Mục, lưu và mở lại trên cùng trình duyệt.
- Mở lại trên trình duyệt/máy khác: ma trận phải giống nhau.
- Tạo bài `chapter_pool`, chọn nhiều Mục trong một Chương; với `student_fixed` và `attempt_random`, tổng Chương × CLO phải giữ nguyên nhưng Mục có thể thay đổi.

### Làm thử giảng viên

- Mở Chi tiết bài → Làm thử.
- Chuyển câu, chọn đáp án, nộp bài thử.
- Chỉnh một câu trong ngân hàng sau khi bài đã tạo; preview bài cũ vẫn phải dùng snapshot đóng băng.

### AI

- Tạo một bài `counts_toward_grade=false` và một bài `true`.
- Kết quả CLO học phần và AI tổng hợp sinh viên/cả lớp chỉ dùng bài `true`.
- AI nhận xét riêng bài/lượt của bài `false` vẫn dùng được.

## Backup

Backup trước khi triển khai V12.1:

`backup-before-v12.1-stability-20260905`
