# Sửa lỗi “Edge Function returned a non-2xx status code”

Lỗi xuất hiện vì giao diện gọi Edge Function `generate-questions`, nhưng gói cũ không chứa mã nguồn/hướng dẫn triển khai hàm này.

## Thực hiện

1. Đưa thư mục `supabase/functions/generate-questions` vào dự án Supabase CLI.
2. Chạy `supabase functions deploy generate-questions`.
3. Đặt secret `GEMINI_API_KEY`.
4. Đặt `GEMINI_MODEL=gemini-3.7-flash`, hoặc giữ model đang hoạt động.
5. Thử tạo 5 câu trước; nếu lỗi, xem Logs của function `generate-questions`.

Hàm mới trả thông báo cụ thể như thiếu API key, sai quyền, model không tồn tại, Gemini quá hạn mức hoặc dữ liệu trả về không hợp lệ; giao diện không còn chỉ nhận thông báo non-2xx chung.
