# Hướng dẫn cập nhật AI-CLO lên V10

## Cập nhật mã nguồn

Sao lưu bản đang chạy, sau đó thay toàn bộ mã nguồn bằng thư mục V10.

## Cơ sở dữ liệu

- Đang dùng V9.6: không cần chạy thêm SQL.
- Đang dùng V9.5 trở xuống: chạy `supabase/v9.6-question-bank.sql` trước khi dùng Ngân hàng câu hỏi V10.

## Kiểm tra nhanh

1. Mở Ngân hàng câu hỏi và nhấn **Chi tiết**: nội dung cùng nút Sửa/Xóa phải hiện ngay.
2. Nhấn **Sửa câu hỏi**: biểu mẫu phải thay nội dung chính của trang, không mở modal.
3. Nhấn **+ Thêm câu hỏi** và **Tạo bằng Gemini**: cả hai phải mở trong trang.
4. Sau khi Gemini tạo xong, màn hình duyệt từng câu vẫn nằm trong trang.
5. Nút **Quay lại ngân hàng** phải khôi phục các bộ lọc trước đó.
