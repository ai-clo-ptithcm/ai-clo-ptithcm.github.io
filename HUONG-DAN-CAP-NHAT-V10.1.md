# Hướng dẫn cập nhật AI-CLO PTITHCM V10.1

## 1. Cập nhật GitHub Pages

Đưa các tệp giao diện V10.1 lên repository như bình thường. Khi chỉ đưa frontend lên GitHub, không đưa thư mục `supabase` lên repository công khai nếu quy trình hiện tại của dự án không sử dụng thư mục này.

## 2. Redeploy hàm sinh câu hỏi

V10.1 giữ nguyên schema cơ sở dữ liệu nhưng cần redeploy mã trong:

`supabase/functions/generate-questions/index.ts`

Secret bắt buộc:

- `GEMINI_API_KEY`

Secret tùy chọn:

- `GEMINI_MODEL` — nếu không đặt, hệ thống dùng `gemini-3.6-flash`.

Ví dụ với Supabase CLI:

```bash
supabase functions deploy generate-questions
```

## 3. Kiểm tra sau cập nhật

1. Mở ứng dụng trên điện thoại và xác nhận thanh đầu trang có hai hàng, không xuất hiện thanh cuộn ngang.
2. Vào Ngân hàng câu hỏi, chọn **Tạo bằng Gemini**, tạo thử 5 câu và duyệt một câu vào ngân hàng.
3. Nếu Gemini báo lỗi, đọc thông báo chi tiết ngay dưới biểu mẫu; đối chiếu thêm Supabase → Edge Functions → `generate-questions` → Logs.
4. Tạo một bài kiểm tra 10 câu, chọn đúng nguồn **Luyện tập · Kiểm tra** hoặc **Đề thi · Bảo mật**. Hệ thống chỉ tính các câu đã duyệt, đang dùng và có đủ phương án A–D.

## 4. Cơ sở dữ liệu

V10.1 không có migration SQL mới. Nếu nâng từ trước V9.6, vẫn cần chạy các migration cũ theo đúng thứ tự được ghi trong README.
