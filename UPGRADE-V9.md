# AI-CLO PTITHCM v9 — Complete Assessment Flow

Bản v9 mở rộng trực tiếp từ mã nguồn ngày 28/08/2026. Bốn khối được nối thành một luồng:

**Giảng viên tạo bài kiểm tra → rút câu từ ngân hàng → sinh viên làm → chấm/CLO → dashboard & báo cáo.**

## 1. Việc bắt buộc làm một lần ở Supabase

Mở **Supabase Dashboard → SQL Editor**, tạo query mới và chạy toàn bộ:

`docs/assessment-v9-migration.sql`

Migration bổ sung cấu hình bài kiểm tra, bảng tự lưu bài, cache nhận xét AI và các RPC an toàn để sinh viên làm/nộp bài mà không tải `correct_answer` về trình duyệt trước khi nộp.

Sau khi chạy SQL, reload website.

## 2. Gemini theo yêu cầu (không bắt buộc để chấm bài)

Toàn bộ tạo bài, làm bài, chấm điểm, tính CLO, thống kê và xuất báo cáo chạy **không cần Gemini**.

Để bật các nút **Nhận xét bằng AI / AI nhận xét sinh viên / AI phân tích cả lớp**, deploy Edge Function:

`supabase/functions/analyze-assessment/index.ts`

Với Supabase CLI:

```bash
supabase functions deploy analyze-assessment
supabase secrets set GEMINI_API_KEY=YOUR_KEY
supabase secrets set GEMINI_MODEL=gemini-3.6-flash
```

Function chỉ gọi Gemini khi người dùng chủ động nhấn nút và cache kết quả theo dữ liệu. Nếu dữ liệu chưa thay đổi, lần nhấn sau đọc cache thay vì gọi Gemini lại.

## 3. Luồng Giảng viên

Trong **Bài kiểm tra → Tạo bài kiểm tra**:

- Chọn Chương.
- Chọn Chủ đề hoặc toàn bộ chủ đề của chương.
- Nhập tổng số câu.
- Nhập số câu từng CLO.
- Hệ thống hiển thị số câu đang có trong ngân hàng để xác nhận đủ/thiếu.
- Chọn thời gian làm bài.
- Chọn số lần được làm.
- Chọn cách ghi nhận nhiều lần: cao nhất / lần cuối / trung bình.
- Chọn thời gian mở/đóng.
- Chọn cho xem đáp án sau khi nộp hay không.
- Chọn trộn câu/trộn phương án.
- Có thể tạo bản nháp hoặc phát hành ngay.

Sau khi tạo, **Chi tiết** hiển thị toàn bộ câu đã rút. Khi chưa có sinh viên nộp bài, giảng viên có thể **Đổi câu** cùng CLO/Chương/Chủ đề.

## 4. Luồng Sinh viên

Sinh viên vào **Bài kiểm tra** và nhấn **Làm bài**:

- Server kiểm tra thời gian mở/đóng và số lượt còn lại.
- Câu hỏi/phương án có thể được trộn ổn định theo lượt làm.
- Đồng hồ đếm ngược.
- Mỗi đáp án được tự lưu lên Supabase.
- Hết giờ tự nộp.
- Điểm được chấm phía Supabase.
- Hiển thị điểm tổng + điểm từng CLO + thống kê theo chương.
- Chỉ hiển thị đáp án/lời giải nếu giảng viên cho phép.
- Gemini không chạy tự động.

## 5. Kết quả và báo cáo

Giảng viên vào **Kết quả CLO** để xem:

- Số sinh viên, lượt đã nộp, điểm trung bình.
- CLO toàn lớp.
- Thống kê theo chương.
- Bảng từng sinh viên với điểm CLO.
- Hồ sơ học tập từng sinh viên: lịch sử bài, CLO, chương.
- Xuất báo cáo Excel gồm các sheet: `Tong_hop_lop`, `Bai_kiem_tra`, `CLO`, `Chuong`.

Nếu CDN SheetJS không tải được, hệ thống tự fallback sang CSV.

## 6. Lưu ý khi nâng cấp

- Không xóa các bảng/dữ liệu cũ.
- Bài kiểm tra cũ không có cấu hình mới sẽ nhận giá trị mặc định khi migration chạy.
- Không đặt `service_role` key trong frontend/GitHub.
- Nên thử với 1 tài khoản giảng viên + 1–2 sinh viên trước khi phát hành rộng.
