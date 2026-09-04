# AI-CLO PTITHCM V12.0 — Đánh giá thống nhất

## Kiến trúc đã chốt

Trang **Đánh giá** chỉ còn 2 loại người dùng nhìn thấy:

1. **Bài kiểm tra**
2. **Bài thi cuối kỳ**

Các loại legacy `chapter_test`, `clo_assessment`, `review_exam` vẫn được đọc tương thích nhưng trên giao diện đều được xem là **Bài kiểm tra**. Không xóa dữ liệu cũ.

## Wizard 4 bước dùng chung

Cả Bài kiểm tra và Bài thi cuối kỳ dùng cùng luồng:

1. **Thông tin**
2. **Phạm vi và cách gom câu**
3. **Ma trận câu hỏi**
4. **Xác nhận**

### Bước 2 — phạm vi

- Hiện trực tiếp danh sách Chương bằng checkbox; không có nút “Thêm chương”.
- Giảng viên tự chọn 1 hoặc nhiều Chương.
- Chương được chọn hiện các Mục con để tick.
- Mục không được chọn thì không tham gia pool và không được rút câu.

Giữ đúng 2 kiểu ma trận:

- **CLO cho mỗi mục**: hàng = Mục, cột = CLO.
- **CLO chung các mục thuộc chương**: hàng = Chương, cột = CLO; chỉ gom các Mục đã chọn trong đúng Chương đó, tuyệt đối không gom xuyên Chương.

### Bước 3 — ma trận

- Không có ô nhập Tổng số câu độc lập.
- Tổng số câu = tổng các ô ma trận.
- Mỗi ô hiện số câu khả dụng trong ngoặc.
- Nếu số cần vượt số có sẵn thì không cho tiếp tục.

## Bài kiểm tra

- Chỉ dùng **Ngân hàng luyện tập – kiểm tra**.
- Có các thiết lập online: thời gian, số lượt, cách ghi nhận, cách rút, mở/đóng, xem đáp án, trộn câu, trộn đáp án, AI sinh viên.
- Có switch **Tính vào kết quả CLO học phần**.
  - Bật: đưa bài vào tổng hợp GPA/CLO học phần.
  - Tắt: bài vẫn chấm và xem kết quả riêng nhưng không đưa vào tổng hợp CLO học phần.
- AI giảng viên không bị switch AI sinh viên chi phối.

## Bài thi cuối kỳ

- Chỉ dùng **Ngân hàng đề thi – bảo mật**.
- Bước 1 dùng thông tin đề thi: tên, mô tả/ghi chú, thời gian, số mã đề, ngày thi, ca thi, học kỳ, năm học.
- Không có các switch online của Bài kiểm tra.
- Sau Bước 4 tạo bản nháp và chuyển sang builder/engine xuất đề cuối kỳ hiện có.
- Giữ BM07, BM08, TeX và cơ chế Khóa/Mở khóa hiện hành.

## Trang danh sách và trang con

- Menu đổi tên thành **Đánh giá**.
- Toolbar chỉ còn 2 nút tạo: **+ Tạo bài kiểm tra** và **+ Tạo bài thi cuối kỳ**.
- Các nút tạo legacy Đánh giá CLO/Ôn tập thi/kiểm tra cũ bị ẩn khỏi luồng người dùng.
- Các bài online legacy được gắn nhãn thống nhất **Bài kiểm tra**.
- Bài không tính CLO học phần có badge **Không tính CLO học phần**.
- Trang chi tiết Bài kiểm tra hiển thị rõ nguồn **Ngân hàng luyện tập – kiểm tra**.

## Kết quả CLO

`js/results/grade-scope-v119.js` được nâng logic lên V12 và chỉ lọc tại trang Kết quả CLO.

- Nếu Supabase có `counts_toward_grade`, bài có giá trị `false` bị loại khỏi tổng hợp học phần.
- Nếu chưa có cột này, frontend fallback về hành vi cũ và không làm hỏng trang.

SQL cần chạy một lần nếu chưa chạy trước đó: `docs/assessment-v11.9-migration.sql`.

## File chính

- `js/exams/create-wizard.js` — wizard 4 bước cho cả 2 loại.
- `css/exams/create-wizard.css` — giao diện wizard theo chuẩn app-window.
- `js/exams/assessment-unified-v12.js` — ownership trang Đánh giá và toolbar mới.
- `js/exams/unified-list-adapter.js` — tương thích dữ liệu legacy.
- `js/results/grade-scope-v119.js` — lọc tổng hợp CLO học phần.
- `js/core/feature-loader.js` — load các module V12 theo nhu cầu.

Backup trước thay đổi: `backup-before-assessment-unification-v12-20260904`.