# Hướng dẫn cập nhật AI-CLO PTITHCM v9.5

## 1. Sao lưu

Giữ nguyên bản v9.4.2 và sao lưu cơ sở dữ liệu trước khi cập nhật.

## 2. Cập nhật website

Đưa toàn bộ nội dung thư mục `ai-clo-v9.5` lên GitHub Pages. Không bỏ các tệp CSS/JS phiên bản cũ vì v9.5 là lớp nâng cấp tương thích đặt phía sau chúng.

## 3. Cập nhật Supabase

Mở Supabase SQL Editor và chạy toàn bộ tệp `supabase/v9.5-addon.sql`.

Tệp này tạo hàm bảo mật để giảng viên hoặc Admin gửi thông báo riêng cho sinh viên thuộc đúng lớp đang phụ trách. Không cần sửa dữ liệu cũ.

## 4. Kiểm tra nhanh

- Đăng nhập và kiểm tra trang Tổng quan hệ thống.
- Mở một môn học và thử nút trở về Tổng quan cạnh chuông.
- Kiểm tra Chương · CLO ở cả chế độ xem và chỉnh sửa.
- Kiểm tra bộ lọc Người tạo trong Ngân hàng câu hỏi.
- Mở Danh sách lớp, xem GPA, lần đăng nhập gần nhất và gửi một thông báo thử.
- Kiểm tra trang chủ trên điện thoại và laptop.

## 5. Quên mật khẩu

Nút Quên mật khẩu hiện hướng dẫn liên hệ Admin qua `namph@ptithcm.edu.vn`. Bản v9.5 không dùng dịch vụ gửi email mặc định của Supabase.
