# AI-CLO PTITHCM — Trạng thái dự án 05/09/2026

## Mốc hiện tại

Dự án đang ở giai đoạn **V12 — thống nhất trang Đánh giá và ổn định giao diện công khai**.

Các thay đổi lớn trong ngày 04–05/09/2026 đã tập trung vào:

- hợp nhất nghiệp vụ Đánh giá;
- ổn định hiệu năng;
- chuẩn hóa các trang con;
- sửa scroll khi đổi câu;
- sửa cửa sổ Thông tin;
- đồng nhất toolbar giữa các môn;
- sửa công cụ Chấm thi CLO;
- loại bỏ layout shift của header công khai.

## 1. Trang Đánh giá

Chỉ còn 2 nhóm người dùng nhìn thấy:

- **Bài kiểm tra**
- **Bài thi cuối kỳ**

Không còn tạo mới trực tiếp các loại legacy “Đánh giá CLO” và “Ôn tập thi”. Dữ liệu cũ vẫn tương thích.

### Bài kiểm tra

- chỉ dùng Ngân hàng luyện tập – kiểm tra;
- tạo bằng wizard 4 bước;
- chọn nhiều Chương/Mục;
- 2 kiểu ma trận: CLO theo Mục hoặc CLO chung trong từng Chương;
- tổng số câu lấy từ ma trận;
- có switch tính vào CLO học phần.

### Bài thi cuối kỳ

- chỉ dùng Ngân hàng đề thi – bảo mật;
- tạo từ tab Đề thi cuối kỳ;
- dùng wizard 4 bước;
- sau xác nhận chuyển vào builder/engine đề cuối kỳ;
- giữ BM06/BM07/BM08/TeX và quy trình Khóa/Mở khóa.

## 2. Hiệu năng Đánh giá

Đã loại bỏ các observer rộng gây loop DOM → DB query → DOM.

Nguyên tắc mới:

- one-shot observer;
- không polling nền;
- không query Supabase theo mỗi mutation;
- list adapter query một lần cho một lần render;
- tránh overlay chồng chéo cùng ownership UI.

## 3. Đổi câu

Đã sửa lỗi sau khi rút câu, bấm **Đổi câu** hoặc thay bằng Gemini làm builder kéo lên đầu.

Hiện phải giữ nguyên vị trí câu đang thao tác sau render.

## 4. Cửa sổ Thông tin

Đã sửa:

- thanh cuộn ngang;
- switch tính CLO bị trùng;
- layout khi resize;
- footer sticky;
- logic lưu switch chỉ khi bấm Lưu thông tin.

## 5. Đồng nhất giữa các môn

Trang Đánh giá không có UI riêng theo môn.

Mọi môn dùng cùng framework; khác biệt chỉ do dữ liệu theo `state.subjectId`.

Toolbar chuẩn:

- Bài kiểm tra: một nút tạo bài kiểm tra;
- Đề thi cuối kỳ: một nút tạo bài thi cuối kỳ.

## 6. Chấm thi CLO

Đã sửa lỗi HTML thiếu `</header>` tại `cham-thi-clo/index.html`.

Logic chấm thi không thay đổi.

Các thư viện Excel/XLSX vẫn giữ nguyên.

## 7. Header công khai

Đã xác định nguyên nhân chớp header là JavaScript tái cấu trúc navbar sau first paint.

Đã chuyển sang navbar tĩnh:

- HTML là trạng thái cuối ngay từ đầu;
- CSS chung: `css/public-nav-static.css`;
- dùng `data-unified-nav="1"` để JS không rebuild nav;
- bỏ `backdrop-filter` trên nav tĩnh.

Áp dụng cho Trang chủ, Hướng dẫn, Chấm thi CLO và hướng dẫn Chấm thi CLO.

## 8. Supabase

Migration V12 cần chạy nếu chưa có:

`docs/assessment-v12.0-migration.sql`

Thêm cột:

`counts_toward_grade boolean not null default true`

Không có yêu cầu Edge Function mới cho các thay đổi frontend trong đợt này.

## 9. Các backup quan trọng

- `backup-before-assessment-unification-v12-20260904`
- `backup-before-assessment-performance-fix-20260904`
- `backup-before-builder-scroll-fix-20260904`
- `backup-before-info-window-fix-20260904`
- `backup-before-assessment-toolbar-final-fix-20260904`
- `backup-before-cham-thi-clo-fix-20260904`
- `backup-before-public-header-static-fix-20260904`

## 10. Việc tiếp theo nên ưu tiên

1. Kiểm thử hoàn chỉnh Đề thi cuối kỳ: tạo → rút → đổi → khóa → xuất.
2. Kiểm thử đổi học phần khi đang ở trang Đánh giá.
3. Kiểm tra `counts_toward_grade` trên dữ liệu thực sau migration.
4. Theo dõi header công khai trên desktop/mobile và khi đổi tab Chrome.
5. Nếu còn micro-flicker nhưng không còn layout shift, xem xét repaint/GPU compositing của trình duyệt.

## 11. Tài liệu liên quan

- `VERSION-v12.0.md`
- `HUONG-DAN-CAP-NHAT-V12.md`
- `PROJECT-NOTES-AI-CLO.md`
- `docs/assessment-v12.0-migration.sql`
