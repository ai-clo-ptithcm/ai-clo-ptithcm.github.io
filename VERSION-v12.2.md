# AI-CLO PTITHCM V12.2 — Assessment Stability

V12.2 ổn định lại toàn bộ khu vực **Đánh giá** theo nguyên tắc một owner frontend duy nhất: `js/assessment.js`.

## Kiến trúc frontend

Trang Đánh giá không còn nạp các lớp vá/adapter cũ như `final-workflow.js`, `unified-builder.js`, `unified-list-adapter.js`, `create-wizard.js`, `assessment-unified-v12.js`, `assessment-subpages-v12.js`, `assessment-v12.1*.js`, `attempt-autosave.js`, `detail-enhancements.js`, `assessment-window.js`, `max-attempts-unlocked.js` hay `subpage-bootstrap.js`.

Các file cũ vẫn được giữ trong repo để đối chiếu lịch sử nhưng **không tham gia runtime Đánh giá V12.2**.

`js/exams/final-export.js` chỉ được tải khi giảng viên thực sự xuất hồ sơ đề cuối kỳ; file này chỉ làm nhiệm vụ xuất BM06/BM07/BM08/TeX/Excel/ZIP và không điều khiển giao diện Đánh giá.

## Các lỗi P1/P2 đã xử lý

- Cấu trúc, blueprint, pool đóng băng và bộ câu mẫu được cập nhật nguyên tử bằng RPC `replace_exam_design`.
- Builder/Chi tiết/Làm thử đọc từ snapshot `exam_question_pool`, không đọc lại nội dung sống của ngân hàng.
- Đổi câu và dùng câu Gemini đồng bộ cùng pool đóng băng, tránh tình trạng `exam_questions` và pool lệch nhau.
- Chỉnh cấu trúc luôn hiển thị Chương + Mục và không tồn tại trạng thái “ma trận mới, bộ câu cũ”.
- `score_policy` (`highest`, `latest`, `average`) được áp dụng thật khi tổng hợp GPA/CLO.
- `counts_toward_grade` độc lập với `allow_ai_feedback` và được lưu cùng giao dịch cập nhật cài đặt.
- Autosave sinh viên được tích hợp trong `js/assessment.js`: lưu local + RPC Supabase, không còn module ghi đè hàm runtime.
- Tạm dừng (`closed`) chặn lượt làm **mới**, nhưng lượt đang làm được phép tiếp tục/resume.
- Phát hành ghi `published_at` lần đầu.
- Đề thi cuối kỳ chỉ dùng Ngân hàng đề thi – bảo mật.
- Số mã đề 1–20 được giữ xuyên suốt đến lúc tạo biến thể/xuất hồ sơ.
- Bỏ cơ chế ưu tiên mơ hồ `server || local` cho nháp đề cuối kỳ; server package là nguồn chuẩn.
- Lỗi đồng bộ/export được báo rõ thay vì im lặng.
- Bỏ tải trùng `system-performance.js` trong `app.html`.

## Cập nhật Supabase bắt buộc

Sau khi frontend V12.2 được deploy, chạy **một lần** trong Supabase SQL Editor:

`docs/assessment-v12.2-migration.sql`

Migration tạo/chuẩn hóa contract V12.2 và RPC `assessment_schema_version()`. Frontend V12.2 sẽ chủ động báo cần migration nếu backend chưa trả phiên bản `12.2`.

## Edge Functions

V12.2 không yêu cầu Edge Function mới. Tiếp tục dùng các function hiện có, trong đó `analyze-assessment` và `analyze-student-clo` nên là bản V12.1 đã lọc đúng `counts_toward_grade` cho phân tích tổng hợp.

## Smoke test sau deploy

1. Tạo bài kiểm tra → chỉ có một nút tạo → lưu bản nháp.
2. Phát hành → trở về trang Chi tiết → Tạm dừng → Mở lại.
3. Khi tạm dừng: SV chưa làm không bắt đầu được; SV đang làm vẫn resume được.
4. Chỉnh Thông tin: `Tính CLO` và `AI feedback` độc lập.
5. Chỉnh Cấu trúc trước khi có lượt làm → pool + bộ mẫu đổi cùng lúc.
6. Đổi một câu / Gemini sinh câu → Làm thử và bài SV dùng đúng snapshot mới.
7. Tạo nhiều lượt làm và kiểm `highest / latest / average` ở Kết quả CLO.
8. Tạo đề cuối kỳ với 2 và 6 mã đề; kiểm đúng số mã, chỉ lấy ngân hàng bảo mật và xuất BM06/BM07/BM08/TeX/Excel/ZIP.
