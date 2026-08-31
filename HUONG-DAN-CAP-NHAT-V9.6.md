# Hướng dẫn cập nhật AI-CLO lên V9.6

## 1. Sao lưu

Sao lưu mã nguồn đang chạy và cơ sở dữ liệu Supabase trước khi cập nhật.

## 2. Cập nhật mã nguồn

Đưa toàn bộ nội dung thư mục V9.6 lên GitHub Pages, thay cho mã nguồn V9.5. Không xóa cấu hình Supabase hiện có.

## 3. Cập nhật Supabase

Mở Supabase → SQL Editor và chạy:

`supabase/v9.6-question-bank.sql`

Chỉ chạy tệp này sau khi các migration đến V9.5 đã hoàn tất. Tệp sẽ:

- bổ sung nhóm sử dụng và trạng thái duyệt cho câu hỏi;
- tạo bảng đề nghị chỉnh sửa;
- bổ sung kiểm tra câu hỏi tương tự;
- giới hạn sinh viên đọc trực tiếp ngân hàng/đáp án;
- chỉ cho người tạo hoặc Admin sửa, xóa câu hỏi.

## 4. Kiểm tra sau cập nhật

1. Đăng nhập bằng tài khoản giảng viên, mở Ngân hàng câu hỏi.
2. Tạo một câu luyện tập đã duyệt và thử tạo câu gần giống để kiểm tra cảnh báo.
3. Chuyển một câu sang nhóm Đề thi · Bảo mật và xác nhận bài kiểm tra thường không rút câu đó.
4. Đăng nhập bằng tài khoản sinh viên, mở Kết quả CLO và thử nút Gemini nhận xét.
5. Trên điện thoại, thử chạm vào email/mật khẩu: trang không được tự phóng to hoặc xuất hiện thanh cuộn ngang.
6. Trên trang chủ điện thoại, nút video phải mở video ở chế độ toàn màn hình ổn định.

## Lưu ý bảo mật

Không đưa `service_role` key vào mã nguồn trình duyệt. V9.6 dùng RLS để chặn sinh viên đọc trực tiếp câu hỏi bảo mật và đáp án; vẫn cần kiểm thử bằng tài khoản sinh viên thật trước khi vận hành.
