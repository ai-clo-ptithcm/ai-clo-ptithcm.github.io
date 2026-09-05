# HƯỚNG DẪN CẬP NHẬT AI-CLO PTITHCM V12

Cập nhật: **05/09/2026**.

## 1. Frontend

Cập nhật toàn bộ source trên nhánh `main`, đặc biệt các file:

- `js/exams/create-wizard.js`
- `js/exams/assessment-unified-v12.js`
- `js/exams/assessment-subpages-v12.js`
- `js/exams/unified-builder.js`
- `js/exams/unified-list-adapter.js`
- `js/ui/scroll-stability.js`
- `js/results/grade-scope-v119.js`
- `js/core/feature-loader.js`
- `css/exams/create-wizard.css`
- `css/exams/assessment-window.css`
- `css/public-nav-static.css`
- `index.html`
- `huong-dan.html`
- `cham-thi-clo/index.html`
- `cham-thi-clo/guide.html`

## 2. Supabase

Nếu chưa chạy migration V12, mở **Supabase SQL Editor** và chạy:

`docs/assessment-v12.0-migration.sql`

Migration thêm:

```sql
counts_toward_grade boolean not null default true
```

Ý nghĩa:

- `true`: bài được tính vào tổng hợp GPA/CLO học phần;
- `false`: bài vẫn có kết quả riêng nhưng không tham gia tổng hợp CLO học phần.

Không cần deploy Edge Function mới cho các chỉnh sửa UI/Assessment nêu trong tài liệu này.

## 3. Kiểm tra trang Đánh giá

Sau khi deploy, kiểm tra với ít nhất 2 học phần khác nhau.

### Tab Bài kiểm tra

Phải chỉ có:

- **+ Tạo bài kiểm tra**

Không được xuất hiện:

- + Tạo bài đánh giá CLO
- + Tạo bài ôn tập thi
- + Tạo bài thi cuối kỳ

### Tab Đề thi cuối kỳ

Phải chỉ có:

- **+ Tạo bài thi cuối kỳ**

Nút này phải mở wizard 4 bước dành cho đề thi cuối kỳ.

## 4. Kiểm tra wizard

### Bài kiểm tra

- nguồn câu: Ngân hàng luyện tập – kiểm tra;
- chọn nhiều Chương được;
- chỉ Mục được tick mới tham gia;
- có đúng 2 kiểu ma trận;
- tổng số câu tự tính từ ma trận;
- không được yêu cầu vượt số câu khả dụng.

### Bài thi cuối kỳ

- nguồn câu cố định: Ngân hàng đề thi – bảo mật;
- không có switch online của bài kiểm tra;
- có thông tin ngày thi, ca thi, học kỳ, năm học, số mã đề;
- sau xác nhận chuyển sang builder đề thi cuối kỳ.

## 5. Kiểm tra đổi câu

Sau khi rút câu:

1. cuộn xuống một câu ở giữa/cuối danh sách;
2. bấm **Đổi câu**;
3. kiểm tra màn hình vẫn đứng tại câu đó;
4. thử tương tự khi dùng câu Gemini thay thế.

Không được bị kéo về đầu trang.

## 6. Kiểm tra cửa sổ Thông tin

Mở **Bài kiểm tra · Thông tin** và kiểm tra:

- không có thanh cuộn ngang;
- resize window không phá layout;
- chỉ có một switch **Tính vào kết quả CLO học phần**;
- Tổng số câu là read-only;
- bật/tắt switch rồi bấm Hủy thì không lưu;
- chỉ bấm **Lưu thông tin** mới ghi thay đổi.

## 7. Kiểm tra hiệu năng

Khi vào **Đánh giá**:

- trang không được đứng/treo;
- không có vòng lặp observer liên tục;
- không phát sinh truy vấn DB lặp lại theo DOM mutation;
- chuyển Bài kiểm tra ↔ Đề thi cuối kỳ phải phản hồi nhanh.

## 8. Kiểm tra Chấm thi CLO

Mở:

`/cham-thi-clo/index.html`

Kiểm tra:

- header không bao trùm nội dung;
- chọn file UnT được;
- chọn/nhập đáp án được;
- nút **Đọc dữ liệu và chấm bài** hoạt động;
- 3 nút xuất Excel hoạt động sau khi chấm thành công.

## 9. Kiểm tra header công khai

Kiểm tra lần lượt:

- Trang chủ
- Hướng dẫn AI-CLO
- Chấm thi CLO
- Hướng dẫn Chấm thi CLO

Navbar phải xuất hiện đúng layout ngay từ first paint, không có giai đoạn hiện layout cũ rồi đổi sang layout mới.

Nếu thấy nháy nhẹ nhưng vị trí/kích thước header không đổi, cần phân biệt với repaint/compositing của trình duyệt.

## 10. Backup V12 đáng nhớ

- `backup-before-assessment-unification-v12-20260904`
- `backup-before-assessment-performance-fix-20260904`
- `backup-before-builder-scroll-fix-20260904`
- `backup-before-info-window-fix-20260904`
- `backup-before-assessment-toolbar-final-fix-20260904`
- `backup-before-cham-thi-clo-fix-20260904`
- `backup-before-public-header-static-fix-20260904`

## 11. Nguyên tắc tiếp tục phát triển

- Không quay lại observer rộng, liên tục trên `#content`.
- Không tạo UI riêng cho từng môn.
- Không để JS tái cấu trúc navbar sau first paint.
- Không tạo lại các nút legacy Đánh giá CLO/Ôn tập thi.
- Bài thi cuối kỳ chỉ lấy từ ngân hàng bảo mật.
- Bài kiểm tra chỉ lấy từ ngân hàng luyện tập – kiểm tra.
- Giữ mọi Edge Function Gemini self-contained.
