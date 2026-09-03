-- AI-CLO PTITHCM V11.3
-- Admin gửi yêu cầu chỉnh sửa câu hỏi đến đúng người nhập.

begin;

create or replace function public.admin_request_question_edit(
 p_question_id uuid,
 p_message text
) returns uuid
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
 q public.questions%rowtype;
 request_id uuid;
 target_subject_id uuid;
begin
 if not public.is_admin() then
  raise exception 'Chỉ Admin được gửi yêu cầu từ trang quản lý ngân hàng';
 end if;
 if length(trim(coalesce(p_message,'')))<1 or length(p_message)>1200 then
  raise exception 'Nội dung yêu cầu phải từ 1 đến 1200 ký tự';
 end if;

 select * into q from public.questions where id=p_question_id;
 if not found then raise exception 'Không tìm thấy câu hỏi'; end if;
 if q.created_by is null then raise exception 'Câu hỏi chưa xác định người nhập'; end if;

 -- Chọn một học phần mà người nhập vẫn đang được phân công và đang dùng ngân hàng.
 select s.id into target_subject_id
 from public.subjects s
 join public.subject_members m on m.subject_id=s.id
 where s.question_bank_id=q.question_bank_id
   and m.user_id=q.created_by
   and m.role in ('teacher','lecturer','giangvien')
 order by (s.id=q.subject_id) desc,s.academic_year desc nulls last,s.id
 limit 1;

 insert into public.question_edit_requests(
  question_id,requested_by,assigned_to,message,status
 ) values(
  q.id,auth.uid(),q.created_by,trim(p_message),'open'
 ) returning id into request_id;

 insert into public.notifications(
  user_id,subject_id,category,severity,title,message,
  target_view,target_id,dedupe_key
 ) values(
  q.created_by,target_subject_id,'activity','warning',
  'Admin yêu cầu chỉnh sửa câu hỏi '||coalesce(q.display_code,'')::text,
  trim(p_message),'questions',q.id,
  'question-edit-request:'||request_id::text
 );

 return request_id;
end
$$;

revoke all on function public.admin_request_question_edit(uuid,text) from public,anon;
grant execute on function public.admin_request_question_edit(uuid,text) to authenticated;

commit;

select 'MIGRATION_V11_3_OK' as trang_thai,now() as hoan_tat_luc;
