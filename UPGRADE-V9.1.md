# AI-CLO PTITHCM — Nâng cấp V9 → V9.1

V9.1 được thiết kế để nâng trực tiếp từ V9 mà không xóa dữ liệu cũ.

## 1. Chạy migration V9.1

Bạn đã chạy `docs/assessment-v9-migration.sql` ở V9 thì **không chạy lại file V9**.

Mở **Supabase → SQL Editor**, chạy toàn bộ:

`docs/assessment-v9.1-migration.sql`

Migration sẽ:

- thêm `exams.question_mode`;
- tạo `exam_question_pool` để đóng băng nguồn câu khi tạo bài;
- tạo `attempt_questions` để lưu snapshot câu của từng lượt làm;
- backfill các bài/lượt làm V9 hiện có;
- khóa thay đổi cấu trúc/bộ câu sau khi đã có lượt làm;
- cập nhật RPC start / payload / save / submit / result để chấm từ snapshot.

Các bài kiểm tra V9 cũ được giữ ở chế độ mặc định **Đề chung cố định**.

## 2. Redeploy Edge Function Gemini

V9.1 cập nhật file:

`supabase/functions/analyze-assessment/index.ts`

Nếu bạn đã deploy `analyze-assessment` ở V9, hãy mở function này trên Supabase và **dán lại code V9.1 rồi Deploy**.

Không cần đổi `GEMINI_API_KEY`. V9.1 chỉ đổi nguồn thống kê: Gemini đọc metadata từ snapshot `attempt_questions` để kết quả không bị thay đổi khi ngân hàng câu hỏi được chỉnh sau này.

## 3. Đưa code V9.1 lên GitHub Pages

Thay toàn bộ mã nguồn bằng thư mục V9.1. File mới quan trọng:

- `js/assessment-v91.js`
- `docs/assessment-v9.1-migration.sql`
- phần drawer/confirm trong `index.html`, `css/app.css`, `css/question-exam.css`

V9.1 vẫn giữ `js/assessment.js` của V9 làm nền tương thích; `assessment-v91.js` được nạp sau và thay thế module Bài kiểm tra bằng giao diện/logic V9.1.

## 4. Kiểm thử đề nghị

### Giảng viên

1. Mở website khi đã đăng nhập: phải vẫn thấy landing page.
2. Nhấn **Vào hệ thống**.
3. Tạo một bài kiểm tra 10 câu, chọn một trong 3 chế độ rút câu.
4. Xem ma trận Chương · Chủ đề · CLO.
5. Với Đề chung cố định, thử **Đổi câu** và **Rút lại toàn bộ** trước khi sinh viên làm.
6. Phát hành và xác nhận.
7. Sau khi có sinh viên bắt đầu, kiểm tra bộ câu/cấu trúc đã bị khóa.
8. Nhấn tên bài kiểm tra → xem danh sách bài làm.
9. Nhấn **Xem bài** → kiểm tra đáp án, điểm tổng, CLO, chương và AI.
10. Nhấn tên sinh viên → kiểm tra hồ sơ và tiến bộ CLO.

### Sinh viên

1. Nhấn **Làm bài** và xác nhận bắt đầu.
2. Chọn đáp án; kiểm tra tự lưu và đồng hồ.
3. Nhấn **Nộp bài**; phải luôn có xác nhận.
4. Kiểm tra điểm tổng + CLO.
5. AI chỉ chạy khi nhấn **Nhận xét bằng AI**.

### Ba chế độ rút câu

- `common_fixed`: mọi sinh viên cùng bộ câu (có thể khác thứ tự nếu bật trộn).
- `student_fixed`: sinh viên A và B có thể khác bộ câu; mỗi sinh viên giữ bộ của mình qua các lần làm.
- `attempt_random`: mỗi lượt làm rút lại; ưu tiên câu chưa gặp cho đến khi pool không đủ.

## 5. Lưu ý

- Không xóa `attempt_questions` hoặc `exam_question_pool`: đây là dữ liệu bảo toàn lịch sử bài kiểm tra.
- Sau khi đã có lượt làm, không sửa trực tiếp database để đổi cấu trúc/bộ câu.
- Các báo cáo và thống kê CLO không gọi Gemini.
- Gemini chỉ dùng cho nhận xét bằng ngôn ngữ tự nhiên khi người dùng nhấn nút.
