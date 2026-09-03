-- AI-CLO PTITHCM V11.6.21
-- Cho phép người dùng "xóa" thông báo theo kiểu dismiss để thông báo tự sinh
-- không xuất hiện lại ở lần refresh_my_notifications kế tiếp.

alter table public.notifications
  add column if not exists dismissed_at timestamptz;

create index if not exists notifications_user_active_idx
  on public.notifications(user_id, dismissed_at, read_at, created_at desc);

comment on column public.notifications.dismissed_at is
  'Thời điểm người nhận ẩn/xóa thông báo khỏi trung tâm thông báo. Bản ghi được giữ để dedupe không tái sinh.';
