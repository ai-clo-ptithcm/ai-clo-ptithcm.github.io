-- AI-CLO PTITHCM v9.5
-- Chạy một lần trong Supabase SQL Editor sau các migration v9.1, v9.2 và v9.4.

create or replace function public.send_teacher_notification(
  p_recipient_id uuid,
  p_subject_id uuid,
  p_title text,
  p_message text
) returns uuid
language plpgsql
security definer
set search_path=public
as $$
declare
  uid uuid:=auth.uid();
  notification_id uuid;
begin
  if uid is null then raise exception 'Bạn chưa đăng nhập'; end if;
  if length(trim(coalesce(p_title,'')))<1 or length(trim(coalesce(p_message,'')))<1 then
    raise exception 'Tiêu đề và nội dung không được để trống';
  end if;
  if length(p_title)>120 or length(p_message)>1000 then
    raise exception 'Nội dung thông báo vượt quá giới hạn';
  end if;
  if not public.is_admin() and not exists(
    select 1 from public.subject_members mine
    where mine.subject_id=p_subject_id and mine.user_id=uid
      and mine.role in ('teacher','lecturer','giangvien')
  ) then raise exception 'Bạn không có quyền gửi thông báo cho lớp này'; end if;
  if not exists(
    select 1 from public.subject_members learner
    where learner.subject_id=p_subject_id and learner.user_id=p_recipient_id
      and learner.role='student'
  ) then raise exception 'Người nhận không thuộc lớp hiện tại'; end if;

  insert into public.notifications(
    user_id,subject_id,category,severity,title,message,target_view,dedupe_key
  ) values(
    p_recipient_id,p_subject_id,'activity','info',trim(p_title),trim(p_message),
    'notifications','teacher-message:'||uid::text||':'||gen_random_uuid()::text
  ) returning id into notification_id;
  return notification_id;
end$$;

revoke all on function public.send_teacher_notification(uuid,uuid,text,text) from public,anon;
grant execute on function public.send_teacher_notification(uuid,uuid,text,text) to authenticated;
