# AI-CLO PTITHCM — V9.1

V9.1 mở rộng V9 theo hướng hoàn thiện quy trình bài kiểm tra, giữ lịch sử câu hỏi/bài làm ổn định và hạn chế mở cửa sổ mới.

## Điểm mới chính

- Landing page luôn hiển thị kể cả khi người dùng đã đăng nhập; khi đó nút chính đổi thành **Vào hệ thống**.
- Trang Bài kiểm tra dùng **drawer/panel bên phải** để xem cấu trúc đề, danh sách bài làm, chi tiết bài làm và hồ sơ sinh viên.
- Danh sách bài làm có nút **Xem bài**; bấm tên sinh viên mở hồ sơ ngay trong panel.
- Các thao tác quan trọng có hộp xác nhận: bắt đầu/nộp bài, phát hành/đóng/xóa, chỉnh cấu trúc, rút lại/đổi câu.
- Ba chế độ rút câu:
  - `common_fixed`: một bộ câu chung cố định;
  - `student_fixed`: mỗi sinh viên có bộ câu riêng và giữ nguyên qua các lần làm;
  - `attempt_random`: mỗi lượt làm rút lại, ưu tiên tránh câu đã gặp.
- Có `exam_question_pool` để đóng băng nguồn câu khi tạo bài và `attempt_questions` để lưu snapshot từng lượt làm.
- Trước khi có sinh viên làm, giảng viên có thể xem ma trận Chương/Chủ đề/CLO, đổi riêng câu hoặc rút lại bộ câu mẫu/chung.
- Sau khi đã có lượt làm, cấu trúc đo lường và bộ câu bị khóa để bảo toàn kết quả.
- Hồ sơ sinh viên có lịch sử bài kiểm tra, tiến bộ CLO và thống kê theo chương.
- Gemini vẫn **on-demand**: không dùng để chấm điểm, tính CLO hay xuất báo cáo; chỉ gọi khi sinh viên/giảng viên chủ động nhấn nút AI.

## Nâng từ V9 lên V9.1

Nếu hệ thống hiện tại đã chạy V9, **không chạy lại migration V9**.

1. Chạy `docs/assessment-v9.1-migration.sql` trong Supabase SQL Editor.
2. Redeploy `supabase/functions/analyze-assessment/index.ts` bằng code V9.1.
3. Đưa toàn bộ mã nguồn V9.1 lên GitHub Pages.
4. Kiểm thử bằng một tài khoản giảng viên và ít nhất hai tài khoản sinh viên nếu muốn đối chiếu ba chế độ rút câu.

Xem chi tiết trong `UPGRADE-V9.1.md`.

## Cấu hình Supabase/Gemini

- `js/config.js` chỉ chứa thông tin public dành cho frontend; không đưa `service_role` key lên GitHub.
- Edge Function `analyze-assessment` dùng `GEMINI_API_KEY` đã cấu hình trong Supabase Secrets.
- V9.1 không yêu cầu đổi Gemini key nếu V9 đã chạy AI thành công.

## File quan trọng

```text
index.html
css/app.css
css/question-exam.css
css/public.css
js/app.js
js/assessment.js
js/assessment-v91.js
docs/assessment-v9.1-migration.sql
supabase/functions/analyze-assessment/index.ts
UPGRADE-V9.1.md
VERSION-v9.1.txt
```

`js/assessment.js` của V9 vẫn được giữ làm nền tương thích; `js/assessment-v91.js` được nạp sau để cung cấp luồng Bài kiểm tra V9.1.
