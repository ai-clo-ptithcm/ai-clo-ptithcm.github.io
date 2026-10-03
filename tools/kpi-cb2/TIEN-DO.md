# KPI CB2 — bản AI-CLO PTITHCM

## Phạm vi
- Nguồn: APMatHS/apmaths.github.io/tools/kpi-cb2, gồm bản sửa lưu mã và hiển thị mã hiện tại cho Admin.
- Đích: main của fork APMatHS/ai-clo-ptithcm.github.io, tools/kpi-cb2/.
- Supabase riêng: rraooqedkpyhokattwdz; không dùng tài khoản, mã xem hoặc dữ liệu KPI của APMaths.
- Giữ công cụ APMaths hiện có; bản PTITHCM có dữ liệu và quyền quản lý độc lập.

## Giao diện và kỹ thuật
- Đọc /js/config.js của website đích; kiểm tra đúng project PTITHCM trước khi khởi tạo API.
- Logo chữ AI-CLO PTITHCM, favicon /assets/images/favicon.ico, head/nav cùng bố cục với Công bố điểm PTITHCM.
- Header CSS dùng tools/css/header.css; CSS/JS theo chức năng, không thêm bản vá JS hoặc tham số phiên bản.
- Phiên đăng nhập dùng storageKey ptithcm-kpi-manager; mã xem lưu sessionStorage, không sao chép phiên từ APMaths.
- Bổ sung thẻ KPI CB2 vào tools/index.html, giữ nguyên các công cụ và public head/nav của danh mục.
- Edge chỉ chấp nhận origin https://ai-clo-ptithcm.github.io; xác thực tài khoản PTITHCM và quyền trong profiles.
- SQL setup đã gồm sửa safeupdate khi đổi mã; chỉ chạy một lần cho dự án chưa có kpi_*.
- Form và Sheet của chủ sở hữu điền sẵn; đồng bộ vào Chờ duyệt, chỉ hồ sơ duyệt mới tính.

## Triển khai và kiểm tra
- SQL và Edge Function kpi-cb2 version 1 đã triển khai riêng trên Supabase PTITHCM. Không chạy lại SQL tạo bảng sau khi đã có dữ liệu.
- Kiểm tra SQL theo quyền service_role trong giao dịch rollback: mã xem, phân quyền, chống trùng, duyệt, đồng bộ và bảo vệ mã hiện tại.
- Core đã đạt; kiểm tra gateway service_role có rollback đã đạt, 9 bảng bật RLS, chưa có mã xem/hồ sơ/chỉ tiêu. Playwright kiểm tra trên GitHub Actions; workflow kpi-cb2-check.yml.
- Chưa chuyển mã xem hoặc hồ sơ của APMaths, không giữ mã/dữ liệu thử.
- Chưa xác nhận đọc Google Sheet thật; cần tài khoản dịch vụ được chia sẻ quyền xem Sheet.

## Đưa lên website gốc
- Chỉ chỉnh fork APMatHS/ai-clo-ptithcm.github.io theo yêu cầu.
- Chủ sở hữu pull/merge thay đổi vào ai-clo-ptithcm/ai-clo-ptithcm.github.io để website gốc triển khai.
- Sau khi website triển khai: Admin PTITHCM đăng nhập, đặt mã xem; thêm JSON Google nếu Supabase PTITHCM chưa có, rồi Đồng bộ ngay.
- Xem KY-THUAT.md để biết bản đồ file và quy trình chỉnh sửa sau này.

## Kết quả kiểm tra bản sao
- GitHub Actions KPI CB2 checks đã đạt core, đối chiếu core frontend/backend và Chromium desktop/mobile (gồm căn nút Lưu mã và hiện mã cho Admin): https://github.com/APMatHS/ai-clo-ptithcm.github.io/actions/runs/36891683221.
- API thật PTITHCM: phiên xem sai bị 401, quản lý chưa đăng nhập bị 401, origin APMaths bị 403.
- Commit mã công cụ trong fork: 1dbe95a598553068cc0fe20c87d64549ac4f807c.

## Đồng bộ nav chung
- KPI dùng trực tiếp /js/public-shell.js và /css/public-shell.css, header/footer cùng website PTITHCM.
- Bỏ header chữ riêng; không sao chép nav hoặc thêm JS vá. Các nút quản lý KPI giữ trong trang.
