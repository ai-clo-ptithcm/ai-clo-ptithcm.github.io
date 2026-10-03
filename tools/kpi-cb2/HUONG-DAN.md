# KPI Khoa Cơ bản 2

## Lần đầu sử dụng

1. Mở `/tools/kpi-cb2/`, chọn **Đăng nhập quản lý**. Dùng tài khoản admin AI-CLO PTITHCM hiện có.
2. Vào **Thiết lập & phân quyền**, đặt mã xem đúng 4 chữ số (có thể bắt đầu bằng 0). Chưa đặt mã thì trang xem luôn khóa.
3. Phần kết nối hiển thị email tài khoản Google của máy chủ. Chia sẻ Sheet quyền **Người xem** cho email này. Không cần công khai Sheet lên Internet.
4. Bấm **Đồng bộ ngay**, xem **Hồ sơ & duyệt → Chờ duyệt**. Chọn KPI, kỳ ghi nhận và sửa thông tin trước khi chuyển trạng thái **Đã duyệt**.
5. Đặt chỉ tiêu năm, hạn và số liệu nhập tay theo từng KPI. Để trống chỉ tiêu nếu chưa được giao.

Form và Sheet đã được điền sẵn theo liên kết chủ sở hữu cung cấp. Tên tab: `Câu trả lời biểu mẫu 1`.

## Form 5 câu hỏi

Theo thứ tự: **Tên nội dung/Kết quả** (có thể trống); **Loại nội dung** (bắt buộc); **Người khai báo** (bắt buộc); **Thông tin thêm** (có thể trống); **Tải minh chứng** (bắt buộc). Sheet có cột **Dấu thời gian** đứng đầu.

Không đổi thứ tự và tên cột đang kết nối. Tên kết quả trống được lấy từ loại nội dung và người khai báo. Loại “Khác” cần cán bộ phân loại thủ công. Lao động mới, tỷ lệ tiến sĩ, tỷ lệ hài lòng nhập ở **Số liệu tháng**, không lấy từ Form.

## Cách tính

- **Cộng dồn:** tổng số lượng hồ sơ đã duyệt theo tháng; cộng các tháng đến tháng đang chọn.
- **Người duy nhất:** dùng định danh chuyên gia thống nhất; ghi nhận mỗi người một lần trong năm. Không duyệt lặp cùng định danh trong cùng KPI/năm.
- **Đang thực hiện:** đếm nhiệm vụ đang hoạt động tại ngày cuối tháng. Cần ngày bắt đầu; ngày kết thúc là ngày ngừng tính. Có thể ghi nhận nhiệm vụ từ năm trước. Không cộng các tháng.
- **Tỷ lệ:** nhập trực tiếp 0–100% hoặc tử số/mẫu số. “Lũy kế / hiện tại” dùng lần nhập gần nhất đến tháng đang chọn. Không cộng các tỷ lệ.
- **Số liệu tháng:** số nhập thay thế kết quả hồ sơ của tháng đó, không cộng thêm. Ghi nguồn hoặc lý do. Để trống và bỏ tử/mẫu để khôi phục cách tính từ hồ sơ. Nhập 0 khi xác nhận không phát sinh; “—” nghĩa là chưa có số liệu.
- **Chỉ tiêu trống:** hiện “Chưa giao chỉ tiêu”; không tính phần trăm. Chỉ tiêu 0 vẫn được lưu riêng, không chia cho 0.

Định danh DOI, mã đơn hoặc mã nhiệm vụ giúp chặn hồ sơ trùng. Nếu không nhập định danh, cán bộ cần rà soát trùng bằng nội dung và minh chứng. Chuyên gia bắt buộc có định danh để đếm người.

## Đồng bộ và chỉnh sửa

**Đồng bộ ngay** đọc Sheet qua tài khoản dịch vụ Google ở máy chủ. Chu kỳ tự động mặc định 15 phút, chỉ chạy khi cán bộ mở trang quản lý và tab đang hiển thị. Không có tác vụ nền chạy liên tục khi mọi người đóng trang. Nút tải lại chỉ tải dữ liệu KPI đã lưu.

Hồ sơ mới luôn vào Chờ duyệt. Dòng nguồn thay đổi đưa hồ sơ về Chờ duyệt; giữ nguyên thông tin đã chỉnh sửa trên web và hiển thị bản nguồn mới để so sánh. Bấm duyệt sau khi rà soát. Đồng bộ lặp không tạo lại dòng đã biết. Xóa dòng trên Sheet không xóa hồ sơ đã lưu; cán bộ lưu trữ hồ sơ trên web khi cần.

Dấu thời gian Form là khóa nhận diện (các câu trả lời có cùng thời gian được phân biệt bằng thứ tự xuất hiện). Giữ nguyên cột này và thứ tự các câu trả lời có cùng thời gian. Không chuyển một nguồn đã dùng sang bản sao Sheet nếu không muốn nhập lại hồ sơ. Nguồn khác được coi là nguồn mới và vẫn cần rà soát trùng trước khi duyệt.

Một phiên đồng bộ có khóa chống chạy chồng. Lưu hồ sơ dùng số phiên bản để tránh ghi đè thay đổi của cán bộ khác. Đồng bộ lỗi không xóa dữ liệu đã có.

## Danh mục, quyền và minh chứng

Admin/cán bộ có thể thêm, sửa, đổi thứ tự, ẩn hoặc lưu trữ KPI. Bỏ “Theo dõi trong năm này” để ngừng theo dõi một năm. Lưu trữ giữ lịch sử và có thể phục hồi. KPI đã có hồ sơ duyệt không đổi cách tính; tạo mục mới nếu cần cách tính khác.

Chỉ admin được bổ nhiệm hoặc thu hồi quyền một tài khoản giảng viên đang hoạt động. Cán bộ có toàn bộ quyền nghiệp vụ KPI, gồm đổi mã xem và kết nối; không được cấp quyền cho người khác. Phân quyền chỉ áp dụng công cụ KPI, không đổi vai trò AI-CLO.

Minh chứng mở bằng liên kết lấy từ Sheet. Chủ sở hữu Google Drive phải cấp quyền phù hợp cho người xem; mã KPI không cấp quyền Drive. Mã xem có phiên 2 giờ; đổi mã hủy mọi phiên xem cũ. Giới hạn số lần thử mã được thực thi ở máy chủ.

## Vận hành kỹ thuật

Ứng dụng sử dụng Supabase AI-CLO PTITHCM. Các bảng `kpi_*` bật RLS, thu hồi toàn bộ quyền trực tiếp của `anon`/`authenticated`; chỉ Edge Function gọi gateway với quyền máy chủ. Edge xác minh JWT bằng `auth.getUser`, sau đó gateway đối chiếu tài khoản đang hoạt động và quyền được admin cấp. Khóa dịch vụ và JSON Google không nằm trong JavaScript phía trình duyệt.

Triển khai: áp dụng `sql/setup.sql` một lần vào dự án mới có `public.profiles`; deploy `supabase/functions/kpi-cb2/` với `verify_jwt=false` vì có hai thao tác mã xem công khai và xác thực JWT riêng trong function. Gán secret `KPI_GOOGLE_SERVICE_ACCOUNT_JSON`, hoặc dùng lại `GRADE_GOOGLE_SERVICE_ACCOUNT_JSON` hiện có. Tài khoản cần quyền đọc Sheet và bật Google Sheets API. Đổi dữ liệu/cấu hình bằng giao diện quản lý, không chạy lại SQL tạo bảng trên hệ thống đã có dữ liệu.

Chỉ cho phép nguồn `https://ai-clo-ptithcm.github.io`. Bản này dùng Supabase PTITHCM `rraooqedkpyhokattwdz`; dữ liệu và mã xem độc lập với APMaths. Phần đầu trang dùng head/nav chung của các công cụ PTITHCM. Không có dữ liệu KPI, chỉ tiêu hay minh chứng nhúng sẵn trong HTML trước đăng nhập/mã xem.

Kiểm tra: `node tools/kpi-cb2/tests/core.mjs`; Playwright: `node tools/kpi-cb2/tests/browser.mjs`; SQL quyền/sync chạy `tests/gateway.sql` (toàn bộ dữ liệu thử rollback). GitHub Actions kiểm tra tính toán và giao diện.

## Khi chỉnh sửa sau này

Đọc KY-THUAT.md để xác định file cần sửa, quy trình cập nhật SQL/Edge Function và kiểm tra. Chỉ chỉnh fork; chủ sở hữu pull/merge để đưa lên website gốc. Backend đã triển khai riêng, không chạy lại setup.sql. JSON Google cần thêm riêng ở Supabase PTITHCM nếu chưa có.
