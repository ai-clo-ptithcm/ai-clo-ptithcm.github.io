# AI-CLO PTITHCM — cập nhật V10.2

## 1. Supabase SQL
Chạy toàn bộ file `supabase/v10.2-upgrade.sql` trong SQL Editor.

Thay đổi chính:
- thêm `clos.short_description` cho nội dung CLO ngắn trong BM08;
- thêm `final_exam_packages` để lưu bộ đề cuối kỳ, ma trận, tập câu đã duyệt và các mã đề.

## 2. Gemini Edge Functions
Giữ secret `GEMINI_API_KEY` hiện có.

Có thể bỏ `GEMINI_MODEL`. V10.2 tự thử theo thứ tự mặc định:
1. gemini-3.7-flash
2. gemini-3.6-flash
3. gemini-3.5-flash
4. gemini-3.5-flash-lite

Nếu muốn đổi thứ tự mà không sửa code, tạo secret `GEMINI_MODELS`, ví dụ:
`gemini-3.6-flash,gemini-3.5-flash-lite,gemini-3.5-flash`

Deploy lại:
- `generate-questions`
- `analyze-assessment`
- `analyze-student-clo`
- `generate-one-question` (mới)

Các hàm dùng chung `supabase/functions/_shared/gemini.ts`.
Fallback chỉ xảy ra với lỗi quota/rate limit, model unavailable/not found hoặc lỗi máy chủ tạm thời. Lỗi request không hợp lệ không bị che bởi việc đổi model.

## 3. GitHub Pages
Đưa toàn bộ frontend V10.2 lên repository. Các file mới/chỉnh chính:
- `js/v102.js`
- `css/v102.css`
- `app.html`
- `js/v96.js`
- `js/app.js`
- `js/v10.js`

## 4. Ngân hàng câu hỏi
Nút `Nhập hàng loạt` nhận Excel `.xlsx/.xls`.
Tải file mẫu ngay trong giao diện. Các cột chính:
`Chương | Chủ đề | CLO | Nội dung | A | B | C | D | Đáp án | Lời giải | Nhóm sử dụng | Trạng thái`.

Hệ thống luôn xem trước và báo dòng lỗi trước khi nhập.

## 5. Đề thi cuối kỳ
Trong trang Bài kiểm tra có thêm `Tạo đề thi cuối kỳ`.
Luồng:
1. Nhập thông tin hồ sơ.
2. Chọn nguồn: Ngân hàng đề thi / luyện tập / cả hai.
3. Nhập ma trận chi tiết `Chương -> Mục/Chủ đề x CLO`.
4. Hệ thống kiểm tra số câu khả dụng ở từng ô.
5. Rút đề gốc và hiện toàn bộ câu để giảng viên duyệt.
6. Mỗi câu có `Đổi câu` và `Gemini sinh câu này`.
7. Gemini sinh câu chỉ là đề xuất; mặc định không lưu ngân hàng.
8. Giảng viên chốt mới tạo các mã đề.
9. Xuất BM06, BM07 TeX, BM08 và `Dap_an_CLO.xlsx`.

`Dap_an_CLO.xlsx` được sinh từ chính các mã đề sau khi trộn, vì vậy đáp án và CLO bám cùng cấu trúc câu/phương án của từng đề.

## 6. Mẫu biểu
Ba file mẫu người dùng cung cấp được giữ trong thư mục `templates/` để đối chiếu:
- `BM06-mau.docx`
- `BM07-mau.docx`
- `BM08-mau.docx`

Bản xuất V10.2 hiện tạo BM06/BM08 dạng Word-compatible `.doc` và BM07 dạng `.tex`. Mẫu gốc vẫn được giữ để tiếp tục tinh chỉnh bố cục 1:1 nếu cần.
