# Tiến độ dự án AI-CLO PTITHCM — 07/09/2026

## Mốc hiện tại

Dự án đang ở chuỗi nâng cấp V12.6.x, tập trung vào hai việc:

1. bổ sung chế độ rút đề **Cố định và rút ngẫu nhiên**;
2. hoàn thiện mô hình **Ngân hàng câu hỏi dùng chung cho nhiều học phần/lớp**.

`main` vẫn là nhánh triển khai chính. Trước mỗi đợt sửa runtime/backend đã tạo nhánh backup theo thỏa thuận với người dùng.

## V12.6.1 — Cố định và rút ngẫu nhiên

Đã bổ sung loại rút đề thứ tư:

- Đề chung cố định;
- Đề riêng theo sinh viên;
- Rút lại mỗi lần làm;
- **Cố định và rút ngẫu nhiên**.

Quy tắc UX đã chốt:

- với hai chế độ random thuần, Builder **không hiển thị câu hỏi cụ thể**;
- với chế độ hỗn hợp, giảng viên phải **chọn ít nhất một câu cố định trước**;
- sau đó mới bấm **Rút phần còn lại**;
- phần random chỉ hiển thị thống kê, ví dụ `3 cố định + 17 ngẫu nhiên = 20 câu`, không liệt kê 17 câu cụ thể;
- câu cố định tiêu thụ quota đúng ô Chương/Mục × CLO;
- phần còn lại được rút ngẫu nhiên theo ma trận.

Dữ liệu câu cố định được lưu trong:

```text
exams.question_blueprint.fixed_question_ids
```

Không dùng mô hình slot Câu 1/Câu 2 nữa.

## V12.6.2 — Ownership theo ngân hàng câu hỏi

Phát hiện lớp mới dùng chung ngân hàng Giải tích 1 có thể nhìn thấy Chương · Mục · CLO nhưng các module cũ vẫn lọc theo `subject_id`.

Đã bổ sung compatibility bridge:

```text
js/core/question-bank-ownership.js
```

Nguyên tắc kiến trúc:

> **Chương · CLO · Câu hỏi thuộc Question Bank.**  
> **Bài kiểm tra · lượt làm · kết quả thuộc Subject/Học phần.**

Các truy vấn legacy trên `chapters`, `clos`, `questions` dùng `subject_id` của học phần hiện tại được chuyển sang `question_bank_id` khi học phần có ngân hàng dùng chung.

## V12.6.3 — Sửa foreign key khi ghi câu hỏi

Khi lưu câu Gemini ở lớp mới, PostgreSQL báo lỗi foreign key trên bảng `questions`.

Nguyên nhân xác định:

- database vẫn có các FK legacy `fk_questions_chapter_subject` và `fk_questions_clo_subject`;
- `questions.subject_id` phải khớp với `subject_id` legacy của Chapter/CLO;
- lớp mới dùng cùng ngân hàng nhưng có `subject_id` khác học phần nguồn.

Migration đã thêm:

```text
supabase/migrations/v12.6.3-question-bank-legacy-subject.sql
```

Giải pháp:

- **không xóa FK**;
- giữ `question_bank_id` là ownership thật;
- trigger trước INSERT/UPDATE tự chuẩn hóa `questions.subject_id` legacy theo Chapter/CLO nguồn;
- áp dụng chung cho nhập tay, Gemini, import Excel và các đường ghi cũ.

Sau khi chạy migration cần kiểm tra marker:

```text
V12.6.3_OK
```

## V12.6.4 — Assessment dùng question_bank_id

Sau V12.6.3, tạo bài kiểm tra vẫn bị backend từ chối với thông báo:

```text
Pool bài trực tuyến chỉ được dùng câu đã duyệt từ Ngân hàng luyện tập - kiểm tra
```

Nguyên nhân nằm trong RPC `replace_exam_design()` của Assessment V12.2: backend còn điều kiện legacy

```text
q.subject_id = exam.subject_id
```

Điều kiện này sai khi nhiều học phần dùng chung một Question Bank.

Migration mới:

```text
supabase/migrations/assessment-v12.6.4-question-bank-scope.sql
```

Đã sửa:

- `replace_exam_design()` — online assessment kiểm tra câu theo `question_bank_id` của học phần;
- `save_final_exam_package()` — đề cuối kỳ cũng kiểm tra theo `question_bank_id`;
- vẫn giữ các điều kiện `status='active'`, `approval_status='approved'` và đúng `question_scope`;
- không đổi `populate_attempt_questions()` vì phần này chỉ làm việc trên pool đã đóng băng.

Sau khi chạy migration cần có marker:

```text
ASSESSMENT_V12.6.4_OK
```

## V12.6.5 — Tối ưu màn hình sinh viên làm bài

Đã chỉnh lớp giao diện `css/exams/student-attempt.css` sau khi kiểm tra thực tế trên desktop:

- phương án đang được trộn vẫn hiển thị nhãn theo thứ tự **A · B · C · D** trên màn hình;
- ẩn CLO, Chương và Mục khỏi màn hình đang làm bài;
- câu hỏi dùng trọng lượng chữ bình thường thay vì in đậm;
- thu gọn header, khoảng cách, padding của card, đáp án, thanh điều hướng và đồng hồ để giảm cuộn;
- nút quay về màn hình trước hiển thị ngắn gọn **“← Quay lại”**;
- không thay đổi RPC, autosave, chấm điểm hay cơ chế sinh câu.

Đã rà cơ chế giữ màn hình khi chuyển tab trình duyệt:

- workspace lưu `answers`, `pending`, `deadline`, `currentQuestionIndex` trong localStorage;
- `subpage-state.js` ghi lại subpage/scroll khi `visibilitychange` và `pagehide`;
- khi tab chỉ bị ẩn, `.live-exam` vẫn tồn tại nên không render lại workspace;
- đồng hồ dùng deadline tuyệt đối nên vẫn đúng sau khi browser throttling tab nền;
- nếu trang bị reload/discard, subpage persistence có thể mở lại đúng attempt, còn pending local được gộp với dữ liệu server.

Backup trước thay đổi:

```text
backup-before-student-attempt-ux-v12-6-5-20260907
```

## Backup quan trọng

Các backup gần nhất cần giữ:

- `backup-before-bank-ownership-v12-6-2-20260906`
- `backup-before-bank-write-v12-6-3-20260906`
- `backup-before-assessment-bank-scope-v12-6-4-20260906`
- `backup-before-student-attempt-ux-v12-6-5-20260907`

## Quy ước làm việc đã chốt

- Khi đang trao đổi/góp ý: **không sửa GitHub**.
- Chỉ khi người dùng xác nhận rõ kiểu **“OK, bắt đầu” / “bắt đầu viết” / “làm nhé”** mới triển khai thay đổi runtime/backend.
- Trước khi sửa runtime/backend: tạo branch backup từ `main` hiện tại.
- Sau đó mới viết lên `main` và rà diff.

## Việc cần kiểm tra tiếp

Sau khi chạy migration V12.6.3 và V12.6.4 trên Supabase:

1. lớp mới dùng ngân hàng Giải tích 1 thêm câu thủ công;
2. lớp mới lưu câu Gemini;
3. import Excel vào ngân hàng dùng chung;
4. tạo bài kiểm tra common_fixed;
5. tạo bài student_fixed;
6. tạo bài attempt_random;
7. tạo bài mixed_fixed_random;
8. tạo đề cuối kỳ từ secure bank;
9. sinh lượt làm sinh viên và kiểm tra snapshot câu;
10. kiểm tra CLO/GPA vẫn gắn đúng học phần hiện tại;
11. smoke màn hình sinh viên V12.6.5 trên desktop/mobile và thử chuyển tab trình duyệt trong lúc đang làm bài.

Nếu các kịch bản trên đều ổn thì có thể coi V12.6.x đạt mốc ổn định đầu tiên cho Question Bank dùng chung.
