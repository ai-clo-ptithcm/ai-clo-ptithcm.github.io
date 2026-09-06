# AI-CLO PTITHCM — V11.6

V11.6 hoàn thiện ma trận cấu hình câu hỏi khi tạo **Bài kiểm tra trực tuyến**.

## Ma trận Mục × CLO

- Khi giảng viên nhấn **Tạo bài kiểm tra**, phần phân bổ số câu theo CLO cũ được thay bằng ma trận có **Mục (chủ đề) theo hàng** và **CLO theo cột**.
- Mỗi ô là một input số câu cần rút cho đúng cặp Mục × CLO.
- Mỗi ô hiển thị số câu khả dụng trong Ngân hàng luyện tập - kiểm tra.
- Ô không có câu được khóa; giá trị nhập không thể vượt số câu khả dụng.
- Hệ thống tự tính **tổng từng hàng, tổng từng CLO và tổng toàn bài**.
- Tổng số câu của bài được suy ra trực tiếp từ ma trận, tránh lệch giữa tổng bài và cấu trúc.
- Có nút **Xóa phân bổ** để đưa toàn bộ ma trận về 0.
- Khi đổi Chương trong lúc đang tạo bài, phân bổ đã nhập của từng Chương được giữ trong phiên form.

## Thuật toán rút câu

- Bộ câu mẫu `exam_questions` được rút riêng theo từng ô Mục × CLO.
- `exam_question_pool` chỉ chứa các nhóm Mục × CLO thực sự được dùng trong ma trận, nhưng giữ toàn bộ câu khả dụng của các nhóm đó để phục vụ rút ngẫu nhiên.
- `clo_counts`, `topic_ids`, `exam_chapters` và `exam_clos` được tính lại từ chính ma trận.
- Cơ chế backend hiện có trong `supabase/v10.10-online-assessment-matrix.sql` dùng bộ câu mẫu làm blueprint, nên ba chế độ **Đề chung cố định**, **Đề riêng cố định theo sinh viên** và **Rút lại mỗi lần làm** đều giữ được cấu trúc Mục × CLO.

## Tệp mới / thay đổi

- `js/exams/blueprint-matrix.js`
- `css/exams/blueprint-matrix.css`
- `app.html` nạp module và stylesheet V11.6 sau `assessment.js`.

## Supabase

V11.6 **không có migration Supabase mới**. Bản này sử dụng cơ chế `populate_attempt_questions()` đã có từ V10.10.
