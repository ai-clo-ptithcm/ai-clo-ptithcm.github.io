# AI-CLO PTITHCM V11.7

## Bài đánh giá CLO

- Thêm nút **Tạo bài đánh giá CLO** cạnh **Tạo bài kiểm tra** ở tab Bài kiểm tra.
- Mở trang con trong vùng nội dung hiện tại; không thay sidebar/header hay luồng bài kiểm tra cũ.
- Trang gồm 3 khối có nút **Xếp lại / Mở ra**:
  1. Thông tin bài đánh giá — chỉnh sửa bằng window/modal.
  2. Ma trận **Chương × CLO**.
  3. Danh sách câu hỏi đã rút.
- Ô ma trận hiển thị `[số câu chọn] (n)`, trong đó `n` là tổng số câu hiện có của đúng Chương × CLO.
- Có hàng tổng theo từng CLO và tổng toàn bài.
- Câu được rút trong đúng khối Chương × CLO, cho phép trộn các mục thuộc cùng chương.
- **Đổi câu** luôn giữ đúng Chương × CLO.
- **Gemini sinh câu** dùng Edge Function `generate-one-question`; giảng viên có quyền chọn lưu câu sinh mới vào Ngân hàng luyện tập - kiểm tra.
- Khi tạo bài, hệ thống tiếp tục dùng schema `exams`, `exam_question_pool`, `exam_questions`, `exam_chapters`, `exam_clos` hiện có.

## Tương thích

- Không thay đổi cấu trúc database/Supabase.
- Không thay đổi chức năng bài kiểm tra thường và đề thi cuối kỳ.
- Module mới được tách riêng ở `js/exams/clo-assessment-builder.js` và `css/exams/clo-assessment-builder.css`.
