# AI-CLO PTITHCM V11.8

## Framework chung cho 4 loại bài

V11.8 đưa phần Bài kiểm tra về cùng một framework giao diện:

1. **Thông tin bài**
2. **Cấu trúc câu hỏi**
3. **Danh sách câu hỏi**
4. **Xuất** (chỉ Ôn tập thi và Thi cuối kỳ)

### Bài kiểm tra
- Ngân hàng luyện tập – kiểm tra.
- Chọn phạm vi Chương ở Mục 2.
- Ma trận **CLO cho mỗi mục**.

### Bài đánh giá CLO
- Ngân hàng luyện tập – kiểm tra.
- Chọn phạm vi Chương và các mục con ở Mục 2.
- Ma trận **CLO chung các mục được chọn**, tách theo từng Chương.

### Bài ôn tập thi
- Ngân hàng luyện tập – kiểm tra.
- Hai chế độ: **CLO cho mỗi mục** hoặc **CLO chung các mục được chọn**.
- Có Mục 4 xuất TeX.
- Có thể phát hành để sinh viên làm trên web.
- Cho xem đáp án/lời giải là tùy chọn ở Mục 1.

### Bài thi cuối kỳ
- Chỉ Ngân hàng đề thi – bảo mật.
- Hai chế độ: **CLO cho mỗi mục** hoặc **CLO chung các mục được chọn**.
- Không phát hành cho sinh viên.
- Trạng thái builder: **Bản nháp / Khóa / Mở khóa**.
- Mục 4 giữ engine BM07/BM08/TeX hiện hành để bảo đảm tương thích biểu mẫu.

## Quy tắc số lần làm
`max_attempts` luôn chỉnh được dù đã có lượt làm. Nếu giảm xuống thấp hơn số lượt lịch sử của sinh viên, hệ thống không xóa/đổi dữ liệu cũ; sinh viên chỉ không được tạo thêm lượt mới.

## UI
- Mọi `modal()` dùng cùng AI-CLO app-window với header đỏ.
- Chỉnh cấu trúc bài online đi vào builder mới, không mở drawer cấu trúc legacy.
- Trạng thái `closed` hiển thị là **Tạm đóng** và có thể **Mở lại**.

## An toàn tương thích
- Không thay schema Supabase trong V11.8.
- Không xóa engine dữ liệu/biểu mẫu legacy; chỉ ngừng routing UI mới vào phần cấu trúc cũ.
- BM07/BM08/TeX cuối kỳ tiếp tục dùng engine xuất đã kiểm nghiệm.
