-- AI-CLO PTITHCM V11.2
-- Chạy một lần trong Supabase SQL Editor sau v9.2-addon.sql.
-- Tinh chỉnh thời điểm phát sinh và đích đến của thông báo giảng viên/sinh viên.

create or replace function public.refresh_my_notifications()
returns integer language plpgsql security definer set search_path=public as $$
declare
  uid uuid:=auth.uid();
  urole text;
  inserted_count integer:=0;
  affected integer:=0;
  week_key text:=to_char(timezone('Asia/Ho_Chi_Minh',now()),'IYYY-IW');
begin
  if uid is null then raise exception 'Chưa đăng nhập'; end if;
  select role into urole from public.profiles where id=uid and is_active=true;
  if urole is null then raise exception 'Tài khoản không hoạt động'; end if;
  insert into public.notification_settings(user_id) values(uid) on conflict(user_id) do nothing;

  if urole='student' then
    insert into public.notifications(user_id,subject_id,category,title,message,target_view,target_id,dedupe_key,expires_at)
    select uid,e.subject_id,'exam','Có bài kiểm tra mới',e.title,'exams',e.id,
      'exam-new:'||e.id::text,e.closes_at
    from public.exams e
    join public.subject_members sm on sm.subject_id=e.subject_id and sm.user_id=uid and sm.role='student'
    join public.notification_settings ns on ns.user_id=uid and ns.exam_new
    where e.status='active'
      and coalesce(e.opens_at,e.created_at)<=now()
      and coalesce(e.opens_at,e.created_at)>=now()-interval '14 days'
      and (e.closes_at is null or e.closes_at>now())
    on conflict(user_id,dedupe_key) do nothing;
    get diagnostics affected=row_count; inserted_count:=inserted_count+affected;

    insert into public.notifications(user_id,subject_id,category,severity,title,message,target_view,target_id,dedupe_key,expires_at)
    select uid,e.subject_id,'exam','warning','Bài kiểm tra sắp hết hạn',
      e.title||' sẽ hết hạn trong vòng 24 giờ.','exams',e.id,
      'exam-deadline:'||e.id::text,e.closes_at
    from public.exams e
    join public.subject_members sm on sm.subject_id=e.subject_id and sm.user_id=uid and sm.role='student'
    join public.notification_settings ns on ns.user_id=uid and ns.exam_deadline
    where e.status='active' and e.closes_at between now() and now()+interval '24 hours'
      and not exists(select 1 from public.exam_attempts a where a.exam_id=e.id and a.student_id=uid and a.submitted_at is not null)
    on conflict(user_id,dedupe_key) do nothing;
    get diagnostics affected=row_count; inserted_count:=inserted_count+affected;

    insert into public.notifications(user_id,subject_id,category,severity,title,message,target_view,target_id,dedupe_key)
    select uid,e.subject_id,'clo','warning','Nhắc cải thiện '||aq.clo_code,
      'Điểm quy đổi gần đây của bạn ở '||aq.clo_code||' là '||round(10.0*avg(case when sa.is_correct then 1 else 0 end),1)||'/10. Hãy xem lại các chủ đề liên quan.',
      'results',null,'student-clo:'||e.subject_id::text||':'||aq.clo_code||':'||week_key
    from public.student_answers sa
    join public.exam_attempts a on a.id=sa.attempt_id and a.student_id=uid and a.submitted_at is not null
    join public.exams e on e.id=a.exam_id
    join public.attempt_questions aq on aq.attempt_id=a.id and aq.question_id=sa.question_id
    join public.notification_settings ns on ns.user_id=uid and ns.weekly_improvement
    where a.submitted_at>=now()-interval '30 days' and aq.clo_code is not null
    group by e.subject_id,aq.clo_code
    having 10.0*avg(case when sa.is_correct then 1 else 0 end)<4
    on conflict(user_id,dedupe_key) do nothing;
    get diagnostics affected=row_count; inserted_count:=inserted_count+affected;

  elsif urole in ('admin','teacher','lecturer','giangvien') then
    insert into public.notifications(user_id,subject_id,category,severity,title,message,target_view,dedupe_key)
    select uid,s.id,'activity','warning','Sinh viên ít hoạt động',
      count(*)||' sinh viên của '||s.name||' chưa đăng nhập trong 30 ngày.',
      'users','inactive:'||s.id::text||':'||week_key
    from public.subjects s
    join public.subject_members learner on learner.subject_id=s.id and learner.role='student'
    join public.profiles p on p.id=learner.user_id
    join public.notification_settings ns on ns.user_id=uid and ns.teacher_activity
    where (urole='admin' or exists(select 1 from public.subject_members mine where mine.subject_id=s.id and mine.user_id=uid and mine.role in ('teacher','lecturer','giangvien')))
      and (p.last_login_at is null or p.last_login_at<now()-interval '30 days') and p.is_active
    group by s.id,s.name having count(*)>0
    on conflict(user_id,dedupe_key) do nothing;
    get diagnostics affected=row_count; inserted_count:=inserted_count+affected;

    insert into public.notifications(user_id,subject_id,category,severity,title,message,target_view,target_id,dedupe_key)
    select uid,e.subject_id,'exam','info','Bài kiểm tra cần xem kết quả',
      e.title||' có '||count(*)||' lượt nộp mới trong 7 ngày qua.',
      'results',e.id,'review-exam:'||e.id::text||':'||week_key
    from public.exams e
    join public.exam_attempts a on a.exam_id=e.id and a.submitted_at>=now()-interval '7 days'
    where (urole='admin' or exists(select 1 from public.subject_members mine where mine.subject_id=e.subject_id and mine.user_id=uid and mine.role in ('teacher','lecturer','giangvien')))
    group by e.id,e.subject_id,e.title
    on conflict(user_id,dedupe_key) do nothing;
    get diagnostics affected=row_count; inserted_count:=inserted_count+affected;

    insert into public.notifications(user_id,subject_id,category,severity,title,message,target_view,target_id,dedupe_key,expires_at)
    select uid,e.subject_id,'exam','warning','Sinh viên chưa hoàn thành bài kiểm tra',
      count(*)||' sinh viên chưa nộp “'||e.title||'”.','exams',e.id,
      'unfinished-exam:'||e.id::text||':'||week_key,e.closes_at
    from public.exams e
    join public.subject_members learner on learner.subject_id=e.subject_id and learner.role='student'
    where e.status='active' and coalesce(e.opens_at,e.created_at)<=now()
      and (e.closes_at is null or e.closes_at>now())
      and (urole='admin' or exists(select 1 from public.subject_members mine where mine.subject_id=e.subject_id and mine.user_id=uid and mine.role in ('teacher','lecturer','giangvien')))
      and not exists(select 1 from public.exam_attempts a where a.exam_id=e.id and a.student_id=learner.user_id and a.submitted_at is not null)
    group by e.id,e.subject_id,e.title,e.closes_at having count(*)>0
    on conflict(user_id,dedupe_key) do nothing;
    get diagnostics affected=row_count; inserted_count:=inserted_count+affected;

    insert into public.notifications(user_id,subject_id,category,severity,title,message,target_view,target_id,dedupe_key)
    select uid,e.subject_id,'clo','warning','CLO của lớp cần chú ý',
      aq.clo_code||' hiện có điểm quy đổi trung bình '||round(10.0*avg(case when sa.is_correct then 1 else 0 end),1)||'/10.',
      'results',null,'class-clo:'||e.subject_id::text||':'||aq.clo_code||':'||week_key
    from public.student_answers sa
    join public.exam_attempts a on a.id=sa.attempt_id and a.submitted_at is not null
    join public.exams e on e.id=a.exam_id
    join public.attempt_questions aq on aq.attempt_id=a.id and aq.question_id=sa.question_id
    join public.notification_settings ns on ns.user_id=uid and ns.teacher_clo
    where (urole='admin' or exists(select 1 from public.subject_members mine where mine.subject_id=e.subject_id and mine.user_id=uid and mine.role in ('teacher','lecturer','giangvien')))
      and a.submitted_at>=now()-interval '30 days' and aq.clo_code is not null
    group by e.subject_id,aq.clo_code
    having 10.0*avg(case when sa.is_correct then 1 else 0 end)<4
    on conflict(user_id,dedupe_key) do nothing;
    get diagnostics affected=row_count; inserted_count:=inserted_count+affected;

    insert into public.notifications(user_id,subject_id,category,severity,title,message,target_view,target_id,dedupe_key)
    select uid,b.subject_id,'ai','warning','Phiên AI còn chờ duyệt',
      count(d.id)||' câu hỏi vẫn đang chờ duyệt.','questions',b.id,'ai-pending:'||b.id::text
    from public.ai_generation_batches b
    join public.ai_question_drafts d on d.batch_id=b.id and d.review_status='pending'
    join public.notification_settings ns on ns.user_id=uid and ns.ai_pending
    where (urole='admin' or exists(select 1 from public.subject_members mine where mine.subject_id=b.subject_id and mine.user_id=uid and mine.role in ('teacher','lecturer','giangvien')))
      and b.created_at<now()-interval '3 days'
    group by b.id,b.subject_id
    on conflict(user_id,dedupe_key) do nothing;
    get diagnostics affected=row_count; inserted_count:=inserted_count+affected;
  end if;

  delete from public.notifications
  where user_id=uid and expires_at is not null and expires_at<now()-interval '7 days';
  return inserted_count;
end$$;

revoke all on function public.refresh_my_notifications() from public,anon;
grant execute on function public.refresh_my_notifications() to authenticated;

