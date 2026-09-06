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
