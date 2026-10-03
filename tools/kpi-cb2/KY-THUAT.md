# KPI CB2 — hướng dẫn chỉnh sửa và bảo trì

## Bản đồ file

| Phần cần sửa | File | Lưu ý |
| --- | --- | --- |
| Nội dung, nút, các panel và hộp thoại | tools/kpi-cb2/index.html | Không nhúng mã xem, chỉ tiêu hoặc hồ sơ vào HTML |
| Giao diện bảng, sidebar, dialog | tools/kpi-cb2/css/app.css | Giữ nút Lưu mã căn cuối ô nhập, kiểm tra mobile |
| Head/nav công cụ | /css/public-shell.css, /js/public-shell.js và index.html | Dùng trực tiếp nav chung PTITHCM; nút riêng của KPI sửa tại app.css |
| Thao tác và hiển thị | tools/kpi-cb2/js/app.js | Giữ năm/tháng/panel khi lưu; tránh ghi đè form đang sửa |
| Kết nối và đăng nhập | tools/kpi-cb2/js/api.js | Dùng /js/config.js; đúng project rraooqedkpyhokattwdz, storageKey riêng |
| Cách tính, xử lý Form, CSV | tools/kpi-cb2/js/core.js | Hàm thuần, không chứa khóa; cập nhật cả bản backend nếu sửa |
| API, Google, xác thực | supabase/functions/kpi-cb2/index.ts | Deploy lại Edge Function sau sửa; không tin role do trình duyệt gửi |
| Hàm dùng chung phía máy chủ | supabase/functions/kpi-cb2/core.js | Nội dung phải trùng tools/kpi-cb2/js/core.js; CI kiểm tra cmp |
| Cấu trúc và gateway ban đầu | tools/kpi-cb2/sql/setup.sql | Chỉ chạy một lần trên dự án mới; đã có sửa lưu PIN |
| Kiểm tra nghiệp vụ / quyền | tools/kpi-cb2/tests/ | core.mjs, browser.mjs, gateway.sql; SQL fixture rollback |
| Thẻ công cụ trên danh mục | tools/index.html | Giữ public-shell của PTITHCM |

## Quy trình chỉnh sửa

1. Đọc TIEN-DO.md và file liên quan, lấy main mới nhất của fork trước khi sửa. Website gốc chỉ đổi sau khi chủ sở hữu pull/merge.
2. Sửa trực tiếp file JS/CSS theo chức năng. Không thêm app-v2.js, patch.js hoặc tham số phiên bản để vá chức năng.
3. Nếu chỉ đổi giao diện: không cần sửa Supabase. Chạy core và browser; kiểm tra desktop/mobile, thứ tự tab và hộp thoại.
4. Nếu đổi cách tính / xử lý Form: sửa core.js frontend, sao chép chính xác sang core.js backend, chạy core, cmp và browser; deploy lại Edge Function.
5. Nếu đổi database: tạo file SQL nâng cấp mới có tên mô tả trong sql/, dùng ALTER / CREATE OR REPLACE và bảo toàn dữ liệu. Cập nhật setup.sql cho cài mới, nhưng **không chạy lại setup.sql trên hệ thống đang dùng**. Không áp dụng lại một file ALTER ADD COLUMN đã chạy.
6. Nếu đổi quyền: kiểm tra cả gateway SQL và Edge auth.getUser. Vai trò người dùng lấy từ profiles; chỉ Admin cấp/thu hồi cán bộ. Không mở SELECT bảng kpi_* cho anon/authenticated.
7. Chạy gateway.sql trên đúng PTITHCM, dùng giao dịch rollback và quyền service_role để gần với REST. Giữ điều kiện WHERE rõ ràng khi UPDATE/DELETE; kết nối REST có safeupdate.
8. Ghi kết quả và việc còn lại vào TIEN-DO.md, đẩy fork. Kiểm tra GitHub Actions trước khi đưa lên repo gốc.

## Triển khai backend

- Dự án: rraooqedkpyhokattwdz. Endpoint: https://rraooqedkpyhokattwdz.supabase.co/functions/v1/kpi-cb2.
- Edge Function tên kpi-cb2, tải index.ts **và core.js**. CLI: chạy `supabase functions deploy kpi-cb2 --project-ref rraooqedkpyhokattwdz --no-verify-jwt` từ root repo. Verify JWT gateway tắt vì unlock/view không đăng nhập; mọi thao tác quản lý được xác minh JWT và profiles trong thân hàm/gateway.
- Dashboard: deploy đầy đủ hai file. Không chỉ dán index.ts vì file này import ./core.js. Nếu dùng trình chỉnh sửa một file, cần công cụ hỗ trợ thêm file hoặc dùng CLI.
- JSON Google là secret KPI_GOOGLE_SERVICE_ACCOUNT_JSON; có thể dùng lại GRADE_GOOGLE_SERVICE_ACCOUNT_JSON trong **cùng Supabase PTITHCM**. Không có secret thì chỉ phần đồng bộ Google chưa hoạt động; quản lý và nhập tay vẫn dùng được.
- Nếu đổi tên miền: sửa whitelist origins trong Edge, deploy lại, rồi kiểm tra CORS. Không tự cho phép mọi origin.
- Không thêm service_role key hoặc JSON Google vào GitHub/JS. Admin thấy mã xem qua API được bảo vệ; cán bộ/người xem không nhận mã hiện tại, pin_hash hay pin_code.

## Ranh giới dữ liệu

Bản APMaths và PTITHCM độc lập. Cùng link Form/Sheet không có nghĩa hai database dùng chung hồ sơ, mã xem hoặc quyền. Đồng bộ nguồn vào Chờ duyệt của từng project. Không nhập lại dữ liệu đã duyệt bằng cách copy cả database hoặc chạy lại SQL seed.

## Kiểm tra

- `node tools/kpi-cb2/tests/core.mjs`
- `cmp tools/kpi-cb2/js/core.js supabase/functions/kpi-cb2/core.js`
- Cài Playwright để chạy `node tools/kpi-cb2/tests/browser.mjs`; GitHub Actions đã cấu hình Chromium.
- Chạy `tools/kpi-cb2/tests/gateway.sql` trên đúng database. Không xóa ROLLBACK và không bỏ kiểm tra quyền.
