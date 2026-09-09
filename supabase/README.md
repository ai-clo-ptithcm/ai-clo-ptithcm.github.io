# Supabase — AI-CLO PTITHCM

Thư mục backend Supabase được tổ chức theo chức năng:

- `migrations/` — các SQL migration, upgrade và thay đổi schema theo phiên bản.
- `schema/` — các file CSV snapshot/mô tả cấu trúc database, constraint, RLS và policy.
- `policies/` — các SQL policy riêng lẻ không thuộc chuỗi migration phiên bản.
- `functions/` — mã nguồn Supabase Edge Functions. Mỗi function phải self-contained và có thể deploy độc lập; không phụ thuộc `_shared`.
- `docs/` — hướng dẫn triển khai, cấu hình Supabase/Gemini và ghi chú vận hành.

## Nguyên tắc

- Supabase là nguồn dữ liệu chính thức của hệ thống.
- Không đưa `service_role` key hoặc secret vào repository.
- Migration mới đặt trong `migrations/`.
- Snapshot schema mới đặt trong `schema/`.
- Policy SQL độc lập đặt trong `policies/`.
- Edge Function mới đặt trong `functions/<function-name>/index.ts` và phải tự chứa đầy đủ dependency dùng chung cần thiết.
- Migration đã có khả năng chạy trên production không sửa ngược; tạo migration mới để thay thế/sửa hành vi.
- Commit migration lên GitHub không đồng nghĩa migration đã chạy trên Supabase; SQL vẫn phải được áp dụng trong Supabase Dashboard/CLI.
- Trước thay đổi có ảnh hưởng dữ liệu hoặc logic xóa, tạo backup branch từ `main`.

## Tài liệu kỹ thuật hiện hành

- `docs/GHI-CHU-KY-THUAT-V12.6.md` — ghi chú kỹ thuật hiện hành cho V12.6: xóa lượt làm, xóa/lưu trữ câu hỏi, constraint production và checklist migration V12.6.36–V12.6.38.
- `docs/HUONG-DAN-SUPABASE-V9.2.md` — tài liệu triển khai lịch sử của V9.2; giữ để tra cứu, không dùng thay cho checklist migration hiện hành.
- `docs/HUONG-DAN-SUA-LOI-GEMINI.md` — ghi chú xử lý Gemini/Edge Function theo phạm vi tài liệu đó.

## Quy tắc quan trọng với câu hỏi

`questions.approval_status` và `questions.status` là hai trường khác nhau. Quy trình duyệt/lưu trữ dùng `approval_status`; không tự gán giá trị quy trình duyệt sang field legacy `status` nếu chưa kiểm tra constraint production.

Bản hiện hành của RPC xóa câu an toàn nằm trong:

`migrations/assessment-v12.6.38-safe-question-archive-status-check.sql`

Quy tắc: câu chưa dùng có thể xóa vĩnh viễn; câu đã dùng/tham chiếu phải được giữ lại và chuyển `approval_status='archived'`, đồng thời giữ nguyên `questions.status`.
