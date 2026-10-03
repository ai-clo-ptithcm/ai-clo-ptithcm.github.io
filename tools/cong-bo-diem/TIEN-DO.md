# Tiến độ Công bố điểm PTITHCM — 01/10/2026

## Phạm vi và nguồn
- Sao chép từ APMatHS/apmaths.github.io, tools/cong-bo-diem; giữ các màn hình danh sách, quản lý, tra cứu và LOGIN.
- Đích: APMatHS/ai-clo-ptithcm.github.io, tools/cong-bo-diem/.
- Dùng Supabase riêng rraooqedkpyhokattwdz, bảng grade_* và bucket grade-publications riêng tư.
- Không di chuyển dữ liệu công bố APMaths; bản mới bắt đầu với danh sách trống.

## Đã chỉnh frontend và mã backend
- Cấu hình dùng /js/config.js của PTITHCM; logo, favicon và link Công cụ theo website đích.
- Thêm thẻ Công bố điểm vào tools/index.html.
- Link quản lý, tra cứu, QR và danh sách origin chỉ dùng tên miền PTITHCM; không nhận link APMaths.
- Phiên Admin có storageKey riêng ptithcm-grade-admin.
- Giữ hộp thoại giữa màn hình, thông báo lỗi, dữ liệu bảng, xem thử và luồng mã tạo 4 chữ số.
- Giữ đồng bộ Google Sheets theo nhu cầu, lưu tạm 15 phút, Excel/bảng dán sửa và lưu giữ link.
- Backend index.ts self-contained để copy/deploy độc lập trên Dashboard.
- SQL, workflow kiểm tra và hướng dẫn cấu hình đi kèm trong repo. Không thêm JS vá phiên bản.

## Cần người dùng thực hiện
- Sau triển khai, LOGIN bằng Admin PTITHCM và thiết lập mã tạo chung 4 chữ số.
- Thêm GRADE_GOOGLE_SERVICE_ACCOUNT_JSON sau khi cần Google Sheets. Excel/CSV và dán bảng không phụ thuộc secret này.
- Thử một bảng điểm mẫu trước khi công bố lớp thật.

## Kiểm tra và triển khai
- Đã áp dụng SQL trên Supabase PTITHCM: bốn bảng grade_* và bucket grade-publications riêng tư, quyền đọc trực tiếp anon/authenticated bị thu hồi.
- Đã deploy Edge Function grade-publications, version 1, origin PTITHCM và xác thực tùy theo thao tác.
- Kiểm tra API thật: list 200, connector 200 (chưa có JSON); settings không đăng nhập bị 403; origin APMaths bị 403.
- Kiểm tra SQL trong giao dịch rollback: mã đúng/sai, tạo bài, bảo vệ bản nháp, lưu bảng, tra cứu chỉ một dòng/cột, từ chối MSSV sai, đặt lại mật khẩu thu hồi phiên, xóa Admin. Không giữ dữ liệu thử hay mã thử.
- Core kiểm tra dữ liệu, cú pháp JavaScript và đường dẫn script/CSS/favicon đạt.
- Bảng grade_* có RLS không có policy là chủ đích: chỉ backend service_role được truy cập, không mở quyền trực tiếp cho anon/authenticated.
- Chưa thử Google Sheets thật; JSON sẽ được người dùng thêm sau.

- Kiểm thử Chromium đạt các luồng danh sách, mã tạo sai/đúng, hộp thoại, nhập bảng, xem thử, sửa ô, lưu, tra cứu riêng tư và LOGIN Admin. Giao diện mobile 375px không tràn ngang; đã xem ảnh desktop/mobile.

## GitHub và bước đưa lên website gốc
- Đã đẩy mã vào main của fork APMatHS/ai-clo-ptithcm.github.io, commit 0af798097dbadae9e09ec79298d8ba00cfaa3df2.
- GitHub Actions Công bố điểm checks đã đạt core và Chromium: https://github.com/APMatHS/ai-clo-ptithcm.github.io/actions/runs/36863347344.
- Fork này chưa bật GitHub Pages. Website ai-clo-ptithcm.github.io được triển khai từ repo gốc ai-clo-ptithcm/ai-clo-ptithcm.github.io.
- Người dùng cần đưa commit từ fork vào repo gốc (pull/cherry-pick hoặc merge PR) và chờ GitHub Pages triển khai. Chỉ chỉnh fork theo phạm vi yêu cầu; chưa sửa repo gốc.
- Supabase backend đã sẵn sàng, không cần chạy lại SQL. Sau website triển khai: vào LOGIN đặt mã chung; thêm JSON sau khi cần Google Sheets.

## Đồng bộ nav PTITHCM
- Cả bốn trang danh sách, quản lý, tra cứu và LOGIN dùng trực tiếp /css/public-shell.css và /js/public-shell.js của website.
- Thay header/footer riêng bằng data-public-header/data-public-footer; không dựng bản sao nav trong JS công cụ.
- Liên kết Công bố điểm, Quản lý công bố và LOGIN Admin giữ ở thanh điều hướng công cụ dưới nav chung.
- css/header.css chỉ định dạng thanh điều hướng công cụ, không ghi đè nav toàn website; không sửa backend hoặc dữ liệu.
