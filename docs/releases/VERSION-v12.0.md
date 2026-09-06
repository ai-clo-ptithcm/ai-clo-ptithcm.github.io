# AI-CLO PTITHCM V12.0 — Đánh giá thống nhất

Cập nhật gần nhất: **05/09/2026**.

## 1. Kiến trúc trang Đánh giá đã chốt

Trang **Đánh giá** chỉ còn 2 loại người dùng nhìn thấy:

1. **Bài kiểm tra**
2. **Bài thi cuối kỳ**

Các loại legacy `chapter_test`, `clo_assessment`, `review_exam` vẫn được đọc tương thích nhưng trên giao diện đều được xem là **Bài kiểm tra**. Không xóa dữ liệu cũ.

### Toolbar chuẩn

- Tab **Bài kiểm tra** chỉ có đúng một nút: **+ Tạo bài kiểm tra**.
- Tab **Đề thi cuối kỳ** chỉ có đúng một nút: **+ Tạo bài thi cuối kỳ**.
- Các nút legacy `+ Tạo bài đánh giá CLO`, `+ Tạo bài ôn tập thi` không còn được phép xuất hiện trong UI.
- Không sửa riêng từng môn; mọi học phần dùng cùng một framework theo `state.subjectId`.

## 2. Wizard 4 bước dùng chung

Cả Bài kiểm tra và Bài thi cuối kỳ dùng cùng luồng:

1. **Thông tin**
2. **Phạm vi và cách gom câu**
3. **Ma trận câu hỏi**
4. **Xác nhận**

### Bước 2 — phạm vi

- Hiện trực tiếp danh sách Chương bằng checkbox; không có nút “Thêm chương”.
- Giảng viên tự chọn 1 hoặc nhiều Chương.
- Chương được chọn hiện các Mục con để tick.
- Mục không được chọn thì không tham gia pool, số câu khả dụng, ma trận hay rút câu.

Giữ đúng 2 kiểu ma trận:

- **CLO cho mỗi mục**: hàng = Mục, cột = CLO.
- **CLO chung các mục thuộc chương**: hàng = Chương, cột = CLO; chỉ gom các Mục đã chọn trong đúng Chương đó, tuyệt đối không gom xuyên Chương.

### Bước 3 — ma trận

- Không có ô nhập Tổng số câu độc lập.
- Tổng số câu = tổng các ô ma trận.
- Mỗi ô hiện số câu khả dụng trong ngoặc.
- Nếu số cần vượt số có sẵn thì không cho tiếp tục.

## 3. Bài kiểm tra

- Chỉ dùng **Ngân hàng luyện tập – kiểm tra** (`practice` hoặc `both`).
- Có các thiết lập online: thời gian, số lượt, cách rút, thời gian mở/đóng, xem đáp án, trộn câu, trộn đáp án và AI sinh viên.
- Có switch **Tính vào kết quả CLO học phần**.
  - Bật: đưa bài vào tổng hợp GPA/CLO học phần.
  - Tắt: bài vẫn chấm và xem kết quả riêng nhưng không đưa vào tổng hợp CLO học phần.
- AI giảng viên không bị switch AI sinh viên chi phối.
- **Tổng số câu** trong cửa sổ chỉnh sửa là read-only và lấy từ ma trận.

### Cửa sổ “Bài kiểm tra · Thông tin”

Đã chuẩn hóa theo app-window:

- chỉ cuộn dọc, không xuất hiện thanh cuộn ngang;
- input/select/date luôn co đúng chiều rộng;
- chỉ có một switch **Tính vào kết quả CLO học phần**;
- thay đổi switch chỉ được ghi DB khi bấm **Lưu thông tin**;
- bấm **Hủy/X** không lưu thay đổi chưa xác nhận;
- footer Hủy/Lưu ổn định khi resize.

## 4. Bài thi cuối kỳ

- Chỉ dùng **Ngân hàng đề thi – bảo mật** (`secure_exam` hoặc `both`).
- Bước 1 dùng thông tin đề thi: tên, mô tả/ghi chú, thời gian, số mã đề, ngày thi, ca thi, học kỳ, năm học.
- Không có các switch online của Bài kiểm tra.
- Sau Bước 4 tạo bản nháp và chuyển sang builder/engine xuất đề cuối kỳ hiện có.
- Giữ BM06/BM07/BM08, TeX và cơ chế Khóa/Mở khóa hiện hành.
- Nút tạo đề thi chỉ nằm trong tab **Đề thi cuối kỳ**.

## 5. Rút câu và đổi câu

Sau khi rút câu, màn hình builder không được tự kéo về đầu khi người dùng:

- bấm **Đổi câu**;
- dùng câu Gemini thay thế.

Cơ chế scroll-stability ghi nhớ vị trí trước thao tác và phục hồi vị trí sau render, để người dùng ở nguyên tại câu đang xử lý.

## 6. Ổn định hiệu năng trang Đánh giá

Đã loại bỏ kiến trúc `MutationObserver` chạy rộng liên tục từng gây treo trang Đánh giá.

Nguyên tắc hiện tại:

- observer chỉ dùng one-shot khi thực sự cần chờ DOM xuất hiện;
- ngắt observer trước khi sửa DOM;
- không chạy truy vấn Supabase lặp theo mỗi mutation;
- danh sách bài chỉ query một lần cho mỗi lần render;
- không dùng polling nền cho toolbar/trang con.

Các file chính liên quan:

- `js/exams/assessment-unified-v12.js`
- `js/exams/unified-list-adapter.js`
- `js/exams/assessment-subpages-v12.js`
- `js/core/feature-loader.js`

## 7. Trang chi tiết và trang con Đánh giá

- Tên legacy “Đánh giá CLO”, “Ôn tập thi” được chuẩn hóa thành **Bài kiểm tra**.
- Trang chi tiết bài kiểm tra hiện nguồn **Ngân hàng luyện tập – kiểm tra**.
- Trang Đề thi cuối kỳ hiện nguồn **Ngân hàng đề thi – bảo mật**.
- Bài không tính CLO học phần có badge **Không tính CLO học phần**.
- Nút hồ sơ đề thi dùng nhãn **Chi tiết →**.
- Mọi môn phải dùng cùng một cấu trúc giao diện, khác nhau chỉ ở dữ liệu Chương/Mục/CLO/câu hỏi/bài thi.

## 8. Kết quả CLO

`js/results/grade-scope-v119.js` chỉ lọc tại trang Kết quả CLO.

- Nếu Supabase có `counts_toward_grade`, bài có giá trị `false` bị loại khỏi tổng hợp học phần.
- Nếu chưa có cột này, frontend fallback về hành vi cũ và không làm hỏng trang.

SQL cần chạy một lần nếu chưa chạy trước đó: `docs/assessment-v12.0-migration.sql`.

## 9. Header các trang công khai

Ngày 04–05/09/2026 đã xử lý hiện tượng header “chớp/nhảy” trên Trang chủ, Hướng dẫn và Chấm thi CLO.

Nguyên nhân cũ:

- HTML render navbar theo layout ban đầu;
- sau `DOMContentLoaded`, `landing-v11.js` hoặc `ai-chat.js` tái cấu trúc DOM navbar, đổi flex → grid và chèn CSS động;
- tạo layout shift sau first paint;
- `backdrop-filter` trên header fixed có thể làm repaint/compositing rõ hơn.

Hướng xử lý mới:

- navbar được viết đúng cấu trúc cuối ngay trong HTML;
- CSS dùng chung tĩnh nằm ở `css/public-nav-static.css`;
- dùng `data-unified-nav="1"` để JS không tái cấu trúc navbar;
- AI Chat chỉ xử lý panel chat, không sở hữu layout navbar;
- bỏ `backdrop-filter` ở header tĩnh để giảm micro-flicker.

Áp dụng cho:

- `index.html`
- `huong-dan.html`
- `cham-thi-clo/index.html`
- `cham-thi-clo/guide.html`

## 10. Công cụ Chấm thi CLO

Đã sửa lỗi cấu trúc HTML tại `cham-thi-clo/index.html` do thiếu `</header>`, khiến toàn bộ phần nội dung bị trình duyệt hiểu là nằm trong header.

Sau sửa:

- cấu trúc `header → content → footer` hợp lệ;
- giữ nguyên logic chấm điểm;
- giữ nguyên các thư viện `xlsx.full.min.js`, `exceljs.min.js`;
- navbar dùng cùng chuẩn tĩnh với các trang công khai khác.

## 11. File chính V12

- `js/exams/create-wizard.js` — wizard 4 bước cho cả 2 loại.
- `css/exams/create-wizard.css` — giao diện wizard.
- `js/exams/assessment-unified-v12.js` — ownership trang Đánh giá và toolbar.
- `js/exams/assessment-subpages-v12.js` — chuẩn hóa trang con.
- `js/exams/unified-builder.js` — builder chỉnh cấu trúc/rút câu.
- `js/exams/unified-list-adapter.js` — danh sách và tương thích legacy.
- `js/ui/scroll-stability.js` — giữ vị trí khi đổi câu/render.
- `js/results/grade-scope-v119.js` — lọc tổng hợp CLO học phần.
- `js/core/feature-loader.js` — lazy-load các module Đánh giá.
- `css/public-nav-static.css` — navbar công khai tĩnh, tránh layout shift.

## 12. Backup đáng nhớ

- `backup-before-assessment-unification-v12-20260904`
- `backup-before-assessment-performance-fix-20260904`
- `backup-before-builder-scroll-fix-20260904`
- `backup-before-info-window-fix-20260904`
- `backup-before-assessment-toolbar-final-fix-20260904`
- `backup-before-cham-thi-clo-fix-20260904`
- `backup-before-public-header-static-fix-20260904`

## 13. Việc cần kiểm thử tiếp

- kiểm tra đổi học phần A → B khi đang ở Đánh giá, bảo đảm không bám dữ liệu/tab cũ;
- kiểm tra wizard Bài thi cuối kỳ từ tạo → rút câu → chỉnh → khóa → xuất;
- kiểm tra `counts_toward_grade` sau khi đã chạy migration trên Supabase;
- kiểm tra header công khai trên Chrome desktop/mobile và thao tác đổi tab nhiều lần;
- nếu vẫn còn micro-flicker nhưng không còn thay đổi vị trí/kích thước, xem xét repaint trình duyệt thay vì layout shift.
