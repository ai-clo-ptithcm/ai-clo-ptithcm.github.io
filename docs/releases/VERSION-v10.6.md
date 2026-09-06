# AI-CLO PTITHCM — V10.6

**Ngày chốt phiên bản:** 31/08/2026

V10.6 là phiên bản tổng hợp các thay đổi sau V10.5, tập trung vào trải nghiệm làm việc với ngân hàng câu hỏi, quản lý học phần/lớp và tích hợp công cụ Chấm thi CLO.

## 1. Ngân hàng câu hỏi

- Giữ trạng thái khi đang thêm hoặc sửa câu hỏi.
- Tự lưu nháp tạm trong phiên trình duyệt để hạn chế mất nội dung khi chuyển màn hình hoặc tab bị tải lại.
- Khi quay lại Ngân hàng câu hỏi, khôi phục màn hình đang soạn nếu còn nháp chưa hủy/lưu.
- Giữ bộ lọc, tab ngân hàng và vị trí cuộn khi mở chi tiết/sửa rồi quay lại danh sách.
- Tối ưu độ rộng bảng câu hỏi trên desktop, giảm cuộn ngang và thu gọn các cột mã câu, nội dung, chương/chủ đề, phân loại và thao tác.
- Bổ sung xóa nhiều câu hỏi đã chọn theo quyền hiện có của người dùng.

## 2. Quản lý người dùng và Danh sách lớp

- Trang quản lý người dùng của Admin hiển thị đầy đủ Admin, Giảng viên và Sinh viên.
- Bổ sung lọc theo vai trò, tìm kiếm và nút Quản lý.
- Tách rõ chức năng quản lý tài khoản toàn hệ thống và quản lý thành viên của từng học phần.
- Trong trang **Danh sách lớp**, Admin chỉ thêm tài khoản đã tồn tại vào lớp hoặc gỡ tài khoản khỏi lớp; không tạo/xóa tài khoản hệ thống tại đây.
- Thu gọn 5 ô thống kê để hiển thị gọn trên một hàng ở desktop.
- Thống kê Danh sách lớp chỉ phản ánh học phần hiện tại.

## 3. Tổng quan học phần

- Mọi số liệu trên trang Tổng quan được tính riêng theo học phần đang chọn.
- Khi đổi học phần, các thống kê Chương, Câu hỏi, CLO và Bài kiểm tra được cập nhật theo học phần mới.
- Tiêu đề phụ hiển thị rõ tên học phần, học kỳ và năm học hiện tại.

## 4. Tích hợp Chấm thi CLO

- Tích hợp ứng dụng chấm thi vào thư mục độc lập:
  - `cham-thi-clo/index.html`
  - `cham-thi-clo/css/`
  - `cham-thi-clo/js/`
  - `cham-thi-clo/libs/`
  - `cham-thi-clo/templates/`
- Giữ độc lập toàn bộ CSS/JS nghiệp vụ của công cụ Chấm thi CLO, không trộn với mã chính của AI-CLO.
- Giữ các thư viện Excel, template và module OCR/phách trong thư mục con.
- Đồng bộ favicon, màu sắc và nhận diện với AI-CLO PTITHCM.
- Đồng bộ nav và footer của Chấm thi CLO theo phong cách `gioi-thieu.html`.
- Các link điều hướng trong nav/footer của Chấm thi CLO mở ở tab mới; link tải file mẫu vẫn giữ hành vi tải file.
- Bổ sung liên kết **Chấm thi CLO** vào footer của các trang chính của hệ thống.

## 5. Nguyên tắc giữ nguyên

- Không thay đổi model Gemini trong đợt nâng cấp này.
- Không thay đổi Supabase schema chỉ để phục vụ các chỉnh sửa giao diện trên.
- Không thay đổi logic nghiệp vụ cốt lõi của công cụ Chấm thi CLO khi tích hợp vào AI-CLO.

## Trạng thái

**V10.6 được xem là phiên bản chuẩn hiện tại của AI-CLO PTITHCM kể từ ngày 31/08/2026.**

Các thay đổi tiếp theo sẽ được phát triển trên nền V10.6.
