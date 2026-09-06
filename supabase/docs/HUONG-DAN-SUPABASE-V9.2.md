# Cập nhật AI-CLO từ v9.1 lên v9.2

Bản này dùng nguyên v9.1 đầy đủ làm nền. Không chạy lại migration v9.1 và không xóa bảng cũ.

## 1. Chạy SQL bổ sung

1. Mở Supabase Dashboard → **SQL Editor** → **New query**.
2. Mở file `supabase/v9.2-addon.sql`, dán toàn bộ và nhấn **Run** một lần.
3. Nếu phần cuối báo lỗi liên quan `pg_cron`, bật extension **pg_cron** trong Database → Extensions rồi chỉ chạy lại khối cuối từ `create extension if not exists pg_cron;`. Các bảng và RPC phía trên có thể chạy lại an toàn.

SQL này chỉ bổ sung bảng thông báo, nhật ký, `last_login_at`, chính sách RLS và RPC quản trị. Nhật ký cũ hơn 6 tháng được dọn mỗi ngày.

## 2. Cập nhật Edge Function admin-users

Không xóa chức năng cũ. File mới giữ nguyên các thao tác tạo hàng loạt, sửa, đặt lại mật khẩu, khóa/mở khóa và chỉ bổ sung `delete`.

1. Mở Supabase Dashboard → **Edge Functions** → `admin-users`.
2. Thay nội dung bằng `supabase/functions/admin-users/index.ts`.
3. Deploy lại function.

Nếu dùng Supabase CLI:

```bash
supabase functions deploy admin-users
```

Không cần thay `analyze-assessment`; bản v9.1 hiện tại vẫn được giữ nguyên.

## 3. Đưa giao diện lên GitHub Pages

Sao chép toàn bộ nội dung bản v9.2 vào repository, commit và push. Đặc biệt phải có:

- `js/assessment-v91.js` (toàn bộ chức năng bài kiểm tra v9.1)
- `js/v92.js`
- `css/v92.css`
- `index.html` mới

Không đưa file `js/config.example.js` đè lên `js/config.js` đang chứa URL và publishable key của dự án.

## 4. Kiểm tra sau cập nhật

1. Đăng nhập, chờ vài giây và tải lại trang: vẫn ở trong phiên, không bị trả về trang chủ.
2. Giảng viên: tạo/làm thử bài, mở danh sách lượt làm, xem kết quả CLO và AI như v9.1.
3. Sinh viên: bắt đầu bài, chọn đáp án, tải lại và tiếp tục bài đang làm.
4. Mở **Thông báo**, kiểm tra bài mới/hạn bài; giảng viên kiểm tra nhắc hoạt động và CLO.
5. Admin: mở **Nhật ký** và xuất Excel; thử xóa một lượt làm demo.
6. Admin: mở chi tiết một tài khoản demo và thử khóa/mở khóa trước khi kiểm tra xóa.

Các thao tác xóa bài đã có lượt làm, xóa lượt làm và xóa tài khoản đều yêu cầu xác nhận hai lần. Nên thử trên dữ liệu demo trước.
