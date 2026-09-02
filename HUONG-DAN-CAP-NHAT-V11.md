# HƯỚNG DẪN CẬP NHẬT AI-CLO PTITHCM — V11

Ngày chốt checkpoint: **02/09/2026**.

## 1. Mục tiêu V11

V11 là đợt tái cấu trúc và tối ưu hiệu năng frontend, ưu tiên ba nguyên tắc:

1. Giữ nguyên tính đúng đắn của nghiệp vụ và khả năng nâng cấp về sau.
2. Giảm mã legacy/versioned, chuyển file sang tên semantic theo chức năng.
3. Cải thiện cảm nhận người dùng khi mở hệ thống và chuyển giữa các mục sidebar.

V11 **không yêu cầu migration Supabase mới**, **không yêu cầu deploy Edge Function mới** và **không thay đổi cấu hình/model Gemini** trong đợt tối ưu này.

## 2. Checkpoint ổn định hiện tại

- Commit runtime V11 đã kiểm tra Pages: `e71e973bea14c09d561eb86d2a9c542e693829d3`.
- GitHub Pages run **#169**: `completed / success`.
- PR UX gần nhất: **#58 — V11: làm mượt chuyển mục sidebar**.

Đây là mốc nên dùng làm điểm đối chiếu khi tiếp tục sửa giao diện hoặc hiệu năng.

## 3. Tái cấu trúc CSS/JS

Các file versioned chính đã được đổi/gộp sang tên semantic theo chức năng. Một số file tiêu biểu:

```text
css/exams/final-workflow.css
css/questions/bank.css
css/courses/class-list.css
css/ui/final-layer.css
css/students/profile.css

js/exams/final-workflow.js
js/exams/attempt-autosave.js
js/questions/bank.js
js/ui/final-layer.js
js/students/profile.js
```

Các tên compatibility nội bộ như `AICLO_V108`, `AICLO_V1053`, `v95*`, `v96*`, `v102*` có thể vẫn tồn tại để bảo đảm tương thích. Không tự ý xóa chỉ vì tên còn mang số phiên bản.

## 4. Tối ưu tải ban đầu

### XLSX và JSZip

PR **#56** chuyển `XLSX` và `JSZip` từ tải eager sang lazy-load.

- Không còn tải hai thư viện này ngay khi mở `app.html`.
- Module `js/core/office-libs.js` chỉ tải thư viện khi người dùng thực sự nhập/xuất Excel, DOCX hoặc ZIP.
- Không sửa logic nghiệp vụ của `js/exams/final-workflow.js`.

### MathJax

PR **#57** chuyển MathJax sang lazy-load.

- `app.html` không tải MathJax ngay khi mở hệ thống.
- `js/core/math.js` giữ API `renderMath()`.
- Chỉ tải MathJax khi vùng cần render thật sự chứa LaTeX.
- Dùng `startup.typeset=false` và chỉ typeset container được yêu cầu.

## 5. Cải thiện UX chuyển sidebar

PR **#58** thêm `js/ui/view-transition.js`.

Mục tiêu là giảm hiện tượng khi bấm sidebar, toàn bộ nội dung bị thay bằng dòng **“Đang tải dữ liệu…”** rồi mới hiện trang mới.

Cơ chế hiện tại:

- Nếu `#content` đã có nội dung ổn định, giữ nội dung cũ trong lúc view mới tải dữ liệu.
- Chỉ phục hồi snapshot khi app vừa thay nội dung bằng đúng placeholder loading toàn cục.
- Trong lúc refresh, vùng nội dung khóa tương tác nhẹ và giảm opacity rất ít.
- Khi view mới render xong, nội dung mới thay trực tiếp.
- Lần đầu chưa có nội dung thì vẫn dùng loading bình thường.

Module này được tách riêng để có thể chỉnh hoặc rollback độc lập mà không sửa `app.js` lõi.

## 6. Các lỗi/điểm đã lưu ý trong V11

- Nhận xét AI theo CLO phải lọc đúng `subject_id`, tránh lấy nhận xét của học phần khác.
- Student profile dùng cache ngắn hạn; dữ liệu phản hồi AI vẫn phải gắn đúng học phần hiện tại.
- Question bank giữ trạng thái tab/bộ lọc/draft khi quay lại.
- Không thay đổi model Gemini hoặc cơ chế quota/fallback trong đợt tối ưu frontend V11.

## 7. Kiểm thử sau V11

Sau khi mở web trên Chrome desktop và mobile, ưu tiên kiểm tra:

- Chuyển nhanh qua lại: Tổng quan → Ngân hàng câu hỏi → Đánh giá → Kết quả CLO → Danh sách thành viên.
- Có còn nháy placeholder “Đang tải dữ liệu…” toàn trang hay không.
- Công thức toán có render ở lần đầu mở trang chứa LaTeX hay không.
- Xuất DOCX/Excel/ZIP có tải thư viện và chạy đúng ở lần bấm đầu tiên hay không.
- Quay lại tab Chrome/app có còn chớp màn hình đáng kể hay không.
- Trên mobile: sidebar/nav không tràn, bảng câu hỏi không làm vỡ chiều ngang.

## 8. Việc có thể làm tiếp

Chỉ tiếp tục sau khi có phản hồi sử dụng thực tế. Thứ tự ưu tiên đề xuất:

1. Sửa các màn hình cụ thể còn loading/nháy mạnh.
2. Cache theo view cho dữ liệu ít đổi như chương, chủ đề, CLO nếu cần.
3. Audit duplicate CSS giữa các file semantic.
4. Audit JS theo vai trò để cân nhắc lazy-load module — chỉ làm nếu lợi ích rõ và không làm kiến trúc khó bảo trì.

## 9. Supabase

**Không cần thao tác Supabase để áp dụng checkpoint V11 này.**

Các Edge Function vẫn theo nguyên tắc self-contained và được deploy độc lập trên Supabase Dashboard khi có thay đổi nghiệp vụ AI trong tương lai.
