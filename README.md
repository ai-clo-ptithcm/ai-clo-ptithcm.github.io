# AI-CLO PTITHCM — bản chạy thử GitHub Pages

Ứng dụng web tĩnh kết nối trực tiếp với Supabase hiện có. Bản này bám theo schema 14 bảng và chính sách RLS được xuất ngày 26/08/2026.

## Chức năng

- Đăng nhập, đăng xuất và đặt lại mật khẩu bằng Supabase Auth.
- Giao diện theo vai trò `admin`, `teacher`/`lecturer` và `student`.
- Quản lý học phần; chọn học phần làm việc.
- Quản lý chương, chủ đề và CLO theo quyền RLS.
- Thêm, sửa, xóa, tìm câu hỏi; quản lý bốn phương án A–D và đáp án đúng.
- Tạo 1–10 câu bằng Gemini theo chương, chủ đề tùy chọn và CLO.
- Lưu phiên AI, duyệt từng câu, sửa trực tiếp, xác nhận hoặc bỏ qua.
- Admin tạo tài khoản teacher/student thủ công hoặc từ CSV, sinh mật khẩu tạm và xuất kết quả.
- Admin thêm hoặc xóa nhiều giảng viên, sinh viên khỏi học phần đang chọn.
- Tạo và theo dõi đề thi.
- Xem lượt làm bài, điểm và trạng thái nộp bài.
- Quản trị viên xem hồ sơ người dùng và số học phần tham gia.
- Responsive cho máy tính và điện thoại.

## Đưa lên GitHub Pages

1. Giải nén toàn bộ nội dung ZIP vào repository GitHub cá nhân.
2. Vào **Settings → Pages**.
3. Chọn **Deploy from a branch**, nhánh `main`, thư mục `/ (root)`.
4. Chờ GitHub cung cấp đường dẫn website.

Ứng dụng dùng đường dẫn tương đối nên chạy được cả ở repository dạng `username.github.io` và project Pages.

## Cấu hình Supabase

Thông tin public nằm trong `js/config.js`. Publishable key được phép đặt ở frontend; bảo mật dữ liệu dựa vào Auth và RLS. Tuyệt đối không đưa `service_role` key lên GitHub.

Trong Supabase Authentication, thêm URL GitHub Pages vào **URL Configuration → Redirect URLs** để đặt lại mật khẩu hoạt động đúng.

## Lưu ý về quyền hiện tại

- Chỉ `admin` được tạo/sửa/xóa `subjects` và CLO theo RLS hiện có.
- Giảng viên của học phần được quản lý chương, chủ đề, câu hỏi và đề thi.
- Sinh viên chủ yếu có quyền đọc nội dung học phần và làm bài.
- Tạo tài khoản Auth mới từ trình duyệt không an toàn nếu cần quyền quản trị. Nên tạo trong Supabase Dashboard hoặc bổ sung Edge Function riêng.

## Cấu trúc

```text
index.html
css/app.css
js/config.js
js/app.js
docs/schema-columns.csv
docs/schema-constraints.csv
docs/schema-rls.csv
docs/schema-policies.csv
```
