# AI-CLO PTITHCM V11.9

## Mục tiêu

V11.9 đơn giản hóa phần bài kiểm tra trực tuyến thành **2 loại dễ chọn** nhưng dùng chung một framework:

1. **Kiểm tra 1 chương**
2. **Kiểm tra nhiều chương**

Thi cuối kỳ giữ workflow riêng hiện có.

## Hai bài kiểm tra trực tuyến dùng chung giao diện

Cả hai đều có cùng 4 mục:

1. **Thông tin bài**
2. **Cấu trúc câu hỏi**
3. **Danh sách câu hỏi**
4. **Xuất TeX**

Hai loại dùng chung `unified-builder.js`, app-window, switch, lưu nháp và cơ chế xuất TeX. V11.9 bổ sung lớp UX dùng chung tại:

- `js/exams/online-assessment-v119.js`
- `css/exams/online-assessment-v119.css`

### Kiểm tra 1 chương

- Nút tạo màu đỏ PTIT.
- Lần đầu nhấn mở AI-CLO window nhập thông tin trước, sau đó mới vào builder.
- Chỉ cho phép một Chương.
- Cấu trúc mặc định: **CLO cho mỗi mục**.
- Có Mục 4 xuất TeX như bài nhiều chương.

### Kiểm tra nhiều chương

- Nút tạo màu xanh đậm, đặt cạnh nút Kiểm tra 1 chương ở đúng vị trí tạo bài cũ.
- Lần đầu nhấn cũng mở cùng kiểu AI-CLO window.
- Chọn từ 2 Chương trở lên.
- Có 2 cách phân bố:
  - **CLO cho mỗi mục**;
  - **CLO chung các mục thuộc chương**.
- Với CLO chung, vẫn tách riêng từng Chương.
- Có Mục 4 xuất TeX.

## Danh sách bài kiểm tra

Tab bài kiểm tra trực tuyến hiển thị **2 bảng riêng**:

- Kiểm tra 1 chương
- Kiểm tra nhiều chương

Các bài `clo_assessment` và `review_exam` cũ được hiển thị tương thích trong nhóm **Kiểm tra nhiều chương**, không xóa/migrate dữ liệu cũ.

Nút **Chi tiết** và chữ trong bảng được tăng tương phản. Thêm nút **Cấu hình** để mở panel đọc nhanh cấu hình bài mà không vào trang chỉnh sửa.

## Trang Chi tiết

- Thêm nút **Cấu hình**.
- Danh sách lượt làm giữ tìm kiếm/sắp xếp hiện có.
- Bảng lượt làm được ép layout gọn, giảm chiều rộng cột/nút và tránh thanh kéo ngang trên desktop.
- AI của giảng viên luôn có ở mọi bài kiểm tra.

## Tính vào kết quả học phần

Mục 1 có switch iPhone:

**Tính vào kết quả học phần**

- Bật: bài được đưa vào GPA/tổng hợp CLO học phần.
- Tắt: bài vẫn chấm đúng/sai và có kết quả tham khảo, nhưng không đưa vào tổng hợp GPA/CLO học phần.

Cần chạy một lần:

`docs/assessment-v11.9-migration.sql`

Migration chỉ thêm:

`exams.counts_toward_grade boolean not null default true`

Dữ liệu cũ mặc định vẫn được tính, nên không làm thay đổi kết quả hiện có.

`js/results/grade-scope-v119.js` chỉ lọc các bài có `counts_toward_grade = false` khi đang ở trang **Kết quả CLO**. Nếu Supabase chưa có cột mới, hệ thống tự fallback về hành vi cũ thay vì làm hỏng trang.

## AI sinh viên và AI giảng viên

Switch được đặt tên rõ:

**Cho phép sinh viên nhận xét AI**

- Chỉ điều khiển nút AI phía sinh viên.
- Giảng viên luôn giữ mọi nút AI ở mọi bài kiểm tra, không phụ thuộc switch này.
- Khi chuyển **Tính vào kết quả học phần** từ Bật → Tắt, hệ thống tự tắt AI sinh viên một lần.
- Switch AI không bị khóa; giảng viên có thể bật lại ngay.
- AI chỉ được gọi khi người dùng chủ động nhấn nút.

## Window và xử lý lỗi

- `js/ui/app-window-geometry.js` được load trong luồng Bài kiểm tra để giữ nguyên width/height/position khi nội dung bên trong modal render lại.
- Chuyển tab Chrome không được tự reset kích thước cửa sổ cấu hình.
- Lỗi kỹ thuật kiểu `Cannot read properties...` được đổi sang thông báo tiếng Việt dễ hiểu ở banner phía trên; lỗi kỹ thuật thật vẫn giữ trong console.
- Nếu lỗi xảy ra trong lúc nút **Rút câu hỏi** đang ở trạng thái loading, lớp V11.9 tự mở lại builder từ state đã lưu để tránh nút bị kẹt vô hạn.

## An toàn tương thích

- Đã tạo nhánh backup trước khi sửa:
  `backup-v11.9-online-assessment-unification-20260904`
- Không đổi/xóa dữ liệu cũ.
- Không đổi enum/constraint `exam_type`; bài mới dùng các giá trị hiện có để tránh migration rủi ro:
  - `chapter_test` → Kiểm tra 1 chương
  - `review_exam` → Kiểm tra nhiều chương
  - `clo_assessment` cũ → hiển thị tương thích như Kiểm tra nhiều chương
- Thi cuối kỳ không bị thay schema hay engine xuất.
