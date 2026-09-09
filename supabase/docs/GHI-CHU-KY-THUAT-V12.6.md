# Ghi chú kỹ thuật Supabase — AI-CLO PTITHCM V12.6

Cập nhật: 09/09/2026.

Tài liệu này ghi lại các quy tắc backend Supabase đang áp dụng cho nhánh `main`, đặc biệt các sửa lỗi liên quan xóa lượt làm và xóa/lưu trữ câu hỏi. Các tài liệu phiên bản cũ trong `supabase/docs/` được giữ lại để tra cứu lịch sử, không dùng thay cho checklist migration hiện hành.

## 1. Nguyên tắc triển khai Supabase

- Supabase là nguồn dữ liệu chính thức của hệ thống.
- Thay đổi database/RPC phải được ghi thành migration mới trong `supabase/migrations/`; không sửa ngược migration cũ đã có khả năng được chạy trên production.
- Migration trong GitHub **không tự chạy vào database**. Sau khi commit, vẫn phải mở Supabase Dashboard → SQL Editor → New query và chạy file SQL tương ứng.
- Không đưa `service_role` key, API secret hoặc secret của Edge Function vào repository.
- Edge Function phải self-contained, có thể deploy độc lập và không phụ thuộc `_shared`.
- Trước thay đổi có ảnh hưởng dữ liệu hoặc logic xóa, tạo backup branch từ `main`.

## 2. Xóa lượt làm bài kiểm tra — V12.6.36

Migration:

`supabase/migrations/assessment-v12.6.36-admin-delete-attempt-positive-resequence.sql`

RPC:

`public.admin_delete_attempt(uuid)`

Quy tắc:

- Hiện tại chỉ Admin được gọi RPC xóa lượt làm.
- Khi xóa một lượt ở giữa lịch sử, các lượt còn lại được đánh lại số liên tục `1..N`.
- Không được dùng số âm làm giá trị tạm cho `attempt_number` vì production có `CHECK` yêu cầu số lượt làm luôn dương.
- Để tránh xung đột `UNIQUE(exam_id, student_id, attempt_number)`, RPC thực hiện hai pha: chuyển các lượt còn lại lên một vùng số dương phía trên `max(attempt_number)`, sau đó nén về `1..N`.
- `student_answers` được xóa rõ ràng; các bảng phụ có `ON DELETE CASCADE` tiếp tục tự dọn theo FK.

Dấu hiệu migration chạy thành công:

`MIGRATION_V12_6_36_ADMIN_DELETE_ATTEMPT_OK`

## 3. Xóa câu hỏi an toàn — quy tắc nghiệp vụ

Frontend hiện dùng RPC `public.safe_delete_question(uuid)` cho cả xóa một câu và xóa hàng loạt.

Quy tắc thống nhất:

- Câu hỏi **chưa từng được sử dụng/tham chiếu**: xóa vĩnh viễn khỏi database.
- Câu hỏi **đã được sử dụng hoặc còn được tham chiếu**: không hard-delete; chuyển sang trạng thái lưu trữ bằng `approval_status='archived'` để giữ lịch sử đề, bài làm và thống kê CLO.
- Một câu được xem là đã dùng/tham chiếu nếu còn xuất hiện trong ít nhất một trong các nguồn: `exam_questions`, `exam_question_pool`, `attempt_questions`, `student_answers`, hoặc `question_blueprint.fixed_question_ids` của bài kiểm tra.
- Nếu hard-delete gặp một FK chưa được liệt kê nhưng vẫn bảo vệ câu hỏi, RPC phải fallback sang lưu trữ thay vì để dữ liệu bị xóa dở dang.
- Câu lưu trữ không được dùng để sinh/rút bài mới.

## 4. Phân biệt `approval_status` và `status` của câu hỏi

Đây là quy tắc quan trọng sau lỗi production ngày 09/09/2026.

`public.questions` hiện có hai khái niệm khác nhau:

- `approval_status`: trạng thái quy trình duyệt, gồm các giá trị đang dùng như `draft`, `pending`, `approved`, `archived`.
- `status`: trường legacy độc lập, được bảo vệ bởi constraint `questions_status_check`.

Không được đồng nhất hai trường này.

Khi lưu trữ câu hỏi, chỉ thay:

`approval_status = 'archived'`

và **giữ nguyên `questions.status`**.

Lý do: V12.6.37 từng ghi `status='draft'` khi archive. Production từ chối giá trị này với lỗi:

`new row for relation "questions" violates check constraint "questions_status_check"`

## 5. Migration V12.6.37 và V12.6.38

### V12.6.37

`supabase/migrations/assessment-v12.6.37-safe-question-delete.sql`

Migration này đưa vào RPC xóa câu an toàn nhưng có lỗi tương thích production: khi archive có ghi thêm `questions.status='draft'`.

Không rollback migration này nếu đã chạy. Chạy tiếp V12.6.38 để thay thế cùng RPC.

### V12.6.38 — bản hiện hành

`supabase/migrations/assessment-v12.6.38-safe-question-archive-status-check.sql`

V12.6.38 thay thế `public.safe_delete_question(uuid)` và sửa đúng vấn đề trên:

- Không thêm bảng/cột/trạng thái mới.
- Không thay `questions.status`.
- Archive bằng `approval_status='archived'`.
- Xóa `approved_by`, `approved_at` khi archive và cập nhật `updated_at`.
- Giữ nguyên quy tắc hard-delete câu chưa dùng; fallback archive nếu FK vẫn tham chiếu.

Dấu hiệu migration chạy thành công:

`ASSESSMENT_V12_6_38_SAFE_QUESTION_ARCHIVE_OK`

Nếu V12.6.37 đã được chạy trên Supabase, chỉ cần chạy tiếp V12.6.38. Không cần rollback V12.6.37.

## 6. Vì sao câu `archived` không lọt vào bài mới

Loader Assessment hiện chỉ lấy câu thỏa đồng thời:

- `status = 'active'`
- `approval_status = 'approved'`

Vì vậy một câu có `approval_status='archived'` sẽ bị loại khỏi pool bài mới ngay cả khi trường legacy `status` vẫn giữ giá trị cũ.

Ngân hàng câu hỏi có bộ lọc `approval_status='archived'` để xem lại câu lưu trữ. Câu lưu trữ vẫn tồn tại nhằm bảo toàn lịch sử, nhưng không được xem là câu đã duyệt để dùng cho bài mới.

## 7. Kiểm tra sau khi chạy V12.6.38

Nên thử trên dữ liệu demo:

1. Xóa một câu chưa từng dùng → kỳ vọng thông báo xóa vĩnh viễn.
2. Xóa một câu đã nằm trong bài kiểm tra/pool/lượt làm → kỳ vọng chuyển sang Lưu trữ, không báo lỗi `questions_status_check`.
3. Mở bộ lọc Lưu trữ → câu đã archive còn xem được.
4. Tạo/rút bài mới → câu archive không xuất hiện trong pool.
5. Mở bài/lượt làm lịch sử có câu đó → dữ liệu lịch sử vẫn đọc được.

## 8. Quy tắc cho các lần sửa sau

- Không gán giá trị mới vào field có `CHECK` chỉ dựa trên tên field; phải kiểm tra schema/constraint trước.
- Không dùng `questions.status` để biểu diễn quy trình duyệt câu hỏi. Quy trình duyệt/lưu trữ thuộc `approval_status`.
- Không hard-delete câu đã tham gia dữ liệu đánh giá nếu việc xóa làm mất tính toàn vẹn lịch sử.
- Khi frontend cần thay đổi hành vi xóa, ưu tiên giữ một RPC transactional làm nguồn quyết định thay vì sao chép logic kiểm tra FK ở JavaScript.
- Sau mỗi sửa lỗi database quan trọng, cập nhật tài liệu này và `supabase/README.md`.
