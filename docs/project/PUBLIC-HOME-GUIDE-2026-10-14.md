# Trang chủ và hướng dẫn công khai — 14/10/2026

## Phạm vi
Chỉ cập nhật giao diện công khai trong **fork** `APMatHS/ai-clo-ptithcm.github.io`: `index.html`, `huong-dan.html`, `css/guide-v2.css` và `assets/guide/*`. Không đổi `app.html`, logic đánh giá, Supabase/RLS hoặc Edge Functions.

Đã tạo nhánh backup trước chỉnh sửa: `backup/before-public-guide-2026-10-14` từ commit `b159b11ce228cd237f8051437856b06801323fbb`.

## Nguồn số liệu
Đọc trực tiếp project Supabase `rraooqedkpyhokattwdz` ngày 14/10/2026:
- `public.subjects`: **10** học phần.
- `public.question_banks`: **5** ngân hàng dùng chung.
- `public.questions`, `question_scope='practice'`, `status='active'`, `approval_status='approved'`: **1.998** câu.
- `public.questions`, `question_scope='secure_exam'`, `status='active'`, `approval_status='approved'`: **300** câu.
- Ngoài hai nhóm đã duyệt còn **1** câu luyện tập ở trạng thái `draft`; không tính vào thống kê công khai.

Các số liệu trên là **ảnh chụp có ngày**, không phải đồng bộ realtime. Khi số liệu thay đổi, chạy lại các truy vấn đếm và cập nhật `index.html`. Không mở rộng quyền SELECT/RLS hoặc đưa service-role key lên trình duyệt chỉ để làm bộ đếm công khai.

```sql
select count(*) from public.subjects;
select count(*) from public.question_banks;
select question_scope, count(*) from public.questions
where status='active' and approval_status='approved'
group by question_scope;
```

## Nguồn ảnh và nội dung hướng dẫn
Google Drive: `Tro-ly/Ai-clo-ptithcm/HUONG DAN AI CLO PTITHCM`, từ các bộ ảnh của người xây dựng quy trình.
Ảnh đã được chọn từ các màn hình minh họa nghiệp vụ và lưu **cục bộ trong repo** dưới `assets/guide/` để website không phụ thuộc quyền chia sẻ file Drive.

Nhóm ảnh:
- Admin, học phần, CLO: `admin-course-list.png`, `admin-new-course.png`, `admin-outline.png`, `teacher-clo.png`.
- Cấu trúc và câu hỏi: `teacher-start.png`, `teacher-chapter.png`, `teacher-structure.png`, `bank-ai-generate.png`, `bank-ai-review.png`.
- Giảng viên đánh giá/kết quả: `teacher-assessments.jpg`, `teacher-clo-report.png`.
- Sinh viên: `student-start.png`, `student-answer.png`, `student-result.png`, `student-clo.png`, `student-ai.png`.

Quy trình nội dung đối chiếu thêm với bản thảo `APMatHS/huong-dan-ai-clo-ptithcm` (các chương Admin, Teacher, Student). Không nhúng hoặc liên kết hình ảnh từ kho Drive riêng tư trên trang công khai.

## Kiểm thử sau cập nhật
- `index.html` chỉ có 4 bộ đếm: 10, 5, 1998, 300; có ngày thống kê.
- `huong-dan.html` có 6 điểm neo nội dung; ảnh dùng đúng đường dẫn `assets/guide/` hoặc ảnh có sẵn `assets/images/`.
- Link công cụ: `tools/cham-thi-clo/`, `tools/exam-shuffler/`, `tools/cong-bo-diem/`.
- Ảnh không cắt mất nội dung (`object-fit: contain`) và có thể mở kích thước đầy đủ.
- Responsive trên mobile; không thêm JS nghiệp vụ; không sửa giao diện app đang sử dụng.
