# AI-CLO PTITHCM — Trạng thái dự án 06/09/2026

## Mốc hiện tại

Dự án đang ở checkpoint **V12.4.3**, sau khi hoàn tất chuỗi ổn định Assessment và persistence.

Code checkpoint trước cập nhật tài liệu:

`568166f8489c9583d28d83fd5d6634ca13be5b2f`

Backend vẫn ở:

`assessment_schema_version = 12.3.1`

Không có migration Supabase hay Edge Function mới cho V12.4.x.

## Đã hoàn thành

- Sửa cache-busting cho persistence dùng chung.
- Student Attempt chuyển sang full-width subpage.
- Sinh viên reload/mở lại bài được đưa về đúng câu đang làm bằng `currentQuestionIndex`.
- Attempt vẫn giữ Supabase autosave, pending local khi lỗi mạng và deadline không bị kéo dài do reload.
- Assessment đã đăng ký các workspace Detail / Builder / Attempt / Attempt Result / Results / Export với `AICLO_SUBPAGE_STATE`.
- Builder/Detail theo dõi đúng `exam_id` xuyên qua các lần render.
- Các nút quay lại/hủy/đóng Result xóa workspace state để không tự restore ngược.
- Không thêm `MutationObserver` trong Assessment modules.
- README và checkpoint đã được đồng bộ với V12.4.3.

## Kiến trúc giữ nguyên

- `js/assessment.js` là owner runtime duy nhất.
- Child modules nằm trong `js/assessment/`.
- Shared persistence chỉ dùng:
  - `js/ui/subpage-state.js`
  - `js/ui/form-persistence.js`
- Local attempt draft chỉ giữ recovery bên trong lượt làm: pending answer, deadline, current question.
- Supabase là nguồn dữ liệu chính thức.
- Edge Functions phải self-contained, không phụ thuộc `_shared`.

## Trạng thái các hạng mục ưu tiên ngày 06/09

1. Cache-busting persistence — hoàn thành.
2. Attempt full-width — hoàn thành.
3. Restore đúng câu đang làm — hoàn thành.
4. Assessment shared persistence registration — hoàn thành.
5. Đồng bộ tài liệu — hoàn thành.

## Việc tiếp theo

Ưu tiên **kiểm thử tích hợp**, chưa nên refactor lớn:

1. Live-smoke teacher/student với Supabase/RLS.
2. Reload/discard tại Detail, Builder, Attempt và Export Center.
3. Kiểm tra chủ động Quay lại rồi reload không bị restore ngược.
4. Test đổi học phần trong Assessment để chắc chắn state không lẫn môn.
5. Test Excel đáp án+CLO với `/cham-thi-clo`.
6. Compile TeX với dữ liệu thật có công thức phức tạp.

Chi tiết kỹ thuật đầy đủ xem:

- `PROJECT-PROGRESS-2026-09-06.md`
- `README.md`
- `PROJECT-PROGRESS-2026-09-05.md` (checkpoint lịch sử trước V12.4.x)
