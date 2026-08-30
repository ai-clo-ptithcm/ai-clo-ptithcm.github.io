# Hướng dẫn triển khai AI-CLO PTITHCM v9.2

## 1. Sao lưu trước khi cập nhật

1. Tải bản mã nguồn đang chạy từ GitHub.
2. Trong Supabase, vào **Database → Backups** và kiểm tra bản sao lưu gần nhất.
3. Không xóa các bảng hiện có. File nâng cấp chỉ bổ sung cột, bảng và chính sách mới.

## 2. Nâng cấp cơ sở dữ liệu

1. Mở Supabase Dashboard của dự án.
2. Chọn **SQL Editor → New query**.
3. Mở file `supabase/v9.2-upgrade.sql` trong gói mã nguồn.
4. Sao chép toàn bộ nội dung vào SQL Editor và bấm **Run**.
5. Kết quả phải hiện `Success. No rows returned` hoặc hoàn tất không có lỗi đỏ.

File SQL thực hiện:

- Thêm lịch mở/đóng cho bài kiểm tra.
- Thêm trạng thái tài khoản và lần đăng nhập gần nhất.
- Tạo `activity_logs`, `notifications`, `notification_settings`.
- Bật RLS và phân quyền đúng người dùng.
- Tạo thông báo trong website theo hoạt động, hạn bài và CLO.
- Tạo hàm Admin xóa bài kiểm tra/lượt làm có dữ liệu liên quan.
- Tự dọn nhật ký quá 6 tháng mỗi ngày.

Nếu phần `pg_cron` báo lỗi, vào **Database → Extensions**, bật `pg_cron`, rồi chạy lại riêng đoạn cuối file bắt đầu từ `create extension if not exists pg_cron;`.

## 3. Triển khai Edge Function quản trị người dùng

Edge Function là bắt buộc nếu muốn Admin tạo, khóa, mở khóa và xóa tài khoản ngay trên website.

### Cách dùng Supabase CLI

Tại thư mục gốc của dự án, chạy:

```bash
supabase login
supabase link --project-ref MA_DU_AN
supabase functions deploy admin-users
```

`MA_DU_AN` là chuỗi trong địa chỉ Supabase, ví dụ `https://MA_DU_AN.supabase.co`.

Supabase tự cung cấp cho Edge Function các biến `SUPABASE_URL`, `SUPABASE_ANON_KEY` và `SUPABASE_SERVICE_ROLE_KEY`. Không đưa service role key vào GitHub hoặc `js/config.js`.

Sau khi triển khai, vào **Edge Functions → admin-users → Invocations** để kiểm tra function đã sẵn sàng.

## 4. Đưa frontend lên GitHub Pages

1. Giữ nguyên `js/config.js` đang dùng nếu URL và publishable key của Supabase không đổi.
2. Thay nội dung repository GitHub Pages bằng toàn bộ thư mục `ai-clo-ptithcm.github.io` trong gói v9.2.
3. Commit và Push.
4. Chờ GitHub Pages cập nhật, sau đó tải lại trang bằng `Ctrl + F5` trên máy tính hoặc xóa dữ liệu website trên điện thoại.

Không đưa các khóa bí mật vào mã frontend.

## 5. Tạo ba tài khoản Sinh viên Demo

Sau khi Edge Function hoạt động:

1. Đăng nhập bằng Admin.
2. Mở **Người dùng → Tạo người dùng**.
3. Tạo lần lượt `Sinh viên Demo 1`, `Sinh viên Demo 2`, `Sinh viên Demo 3` với ba email thật.
4. Chọn vai trò **Sinh viên** và gán vào học phần demo.
5. Dùng mật khẩu ban đầu khác nhau, tối thiểu 8 ký tự.
6. Đăng nhập thử từng tài khoản và đổi mật khẩu khi cần.

Nên chuẩn bị dữ liệu:

- Demo 1: đã làm bài, kết quả tốt.
- Demo 2: có bài mới hoặc bài sắp hết hạn nhưng chưa làm.
- Demo 3: đã làm bài và có một CLO dưới 4/10.

## 6. Kiểm tra chức năng

### Tài khoản Admin

- Tạo, khóa, mở khóa một tài khoản demo.
- Tạo và xóa CLO chưa được sử dụng.
- Tạo bài kiểm tra có thời điểm mở và hết hạn.
- Xóa một lượt làm demo; hệ thống phải hỏi xác nhận hai lần.
- Xóa bài kiểm tra đã có lượt làm; dữ liệu liên quan chỉ bị xóa sau hai lần xác nhận.
- Mở Nhật ký hoạt động và xuất Excel.

### Tài khoản giảng viên

- Sinh câu hỏi Gemini và duyệt liên tục mà không quay về trang công khai.
- Các biểu mẫu xuất hiện trong vùng nội dung trang, không mở hộp thoại.
- Xem thông báo về sinh viên ít hoạt động, bài cần xem và CLO lớp.
- Chỉ xem nhật ký của chính mình.

### Tài khoản sinh viên

- Xem bài kiểm tra mới và bài sắp hết hạn.
- Xem nhắc cải thiện CLO hằng tuần khi có đủ dữ liệu.
- Không xem được dữ liệu hoặc nhật ký của người khác.

## 7. Quy tắc vận hành

- Nhật ký được giữ 6 tháng.
- Thông báo hiện trong website, không gửi email.
- Ngưỡng CLO chưa đạt là dưới 4/10.
- Sinh viên ít hoạt động là chưa đăng nhập trong 30 ngày.
- Nhắc hết hạn được tạo trong 24 giờ trước hạn.
- Các thông báo trùng sự kiện không được tạo lại.
- AI chỉ đưa ra bản nháp/nhận xét; giảng viên quyết định nội dung cuối cùng.

## 8. Xử lý lỗi thường gặp

- **Không thấy mục Thông báo/Nhật ký:** tải lại mạnh trình duyệt và kiểm tra `js/v92.js` đã được đưa lên GitHub.
- **Báo không tìm thấy bảng `notifications`:** chưa chạy hoặc chạy chưa hết file SQL.
- **Admin không tạo được người dùng:** kiểm tra Edge Function `admin-users` đã triển khai và tài khoản hiện tại có `profiles.role = 'admin'`.
- **Không xóa được CLO:** CLO đang được câu hỏi hoặc đề thi tham chiếu; cần giữ CLO hoặc xử lý dữ liệu liên quan trước.
- **Không có nhắc CLO:** cần có bài đã nộp và `student_answers.is_correct` đã được cập nhật.
- **Phiên đăng nhập trên điện thoại:** xóa cache của website một lần sau khi nâng cấp từ v9.1.

