-- AI-CLO PTITHCM v9.2
-- Chạy toàn bộ file trong Supabase SQL Editor bằng tài khoản chủ dự án.

create extension if not exists pgcrypto;

alter table public.profiles add column if not exists is_active boolean not null default true;
alter table public.profiles add column if not exists last_login_at timestamptz;
alter table public.exams add column if not exists opens_at timestamptz;
alter table public.exams add column if not exists closes_at timestamptz;
alter table public.exams add column if not exists published_at timestamptz;

create table if not exists public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  subject_id uuid references public.subjects(id) on delete set null,
  action text not null,
  entity_type text not null default 'system',
  entity_id uuid,
  summary text not null default '',
  status text not null default 'success' check (status in ('success','failed')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists activity_logs_created_at_idx on public.activity_logs(created_at desc);
create index if not exists activity_logs_user_id_idx on public.activity_logs(user_id,created_at desc);
create index if not exists activity_logs_subject_id_idx on public.activity_logs(subject_id,created_at desc);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  subject_id uuid references public.subjects(id) on delete cascade,
  category text not null check (category in ('exam','clo','activity','ai','system')),
  severity text not null default 'info' check (severity in ('info','warning')),
  title text not null,
  message text not null,
  target_view text,
  target_id uuid,
  dedupe_key text not null,
  read_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  unique(user_id,dedupe_key)
);
create index if not exists notifications_user_unread_idx on public.notifications(user_id,read_at,created_at desc);

create table if not exists public.notification_settings (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  exam_new boolean not null default true,
  exam_deadline boolean not null default true,
  weekly_improvement boolean not null default true,
  teacher_activity boolean not null default true,
  teacher_clo boolean not null default true,
  ai_pending boolean not null default true,
  updated_at timestamptz not null default now()
);

alter table public.activity_logs enable row level security;
alter table public.notifications enable row level security;
alter table public.notification_settings enable row level security;
grant select,insert on public.activity_logs to authenticated;
grant select,update on public.notifications to authenticated;
grant select,insert,update,delete on public.notification_settings to authenticated;

drop policy if exists activity_logs_select_own_or_admin on public.activity_logs;
create policy activity_logs_select_own_or_admin on public.activity_logs for select to authenticated
using (user_id=auth.uid() or public.is_admin());
drop policy if exists activity_logs_insert_own on public.activity_logs;
create policy activity_logs_insert_own on public.activity_logs for insert to authenticated
with check (user_id=auth.uid());

drop policy if exists notifications_select_own on public.notifications;
create policy notifications_select_own on public.notifications for select to authenticated using (user_id=auth.uid());
drop policy if exists notifications_update_own on public.notifications;
create policy notifications_update_own on public.notifications for update to authenticated using (user_id=auth.uid()) with check (user_id=auth.uid());

drop policy if exists notification_settings_own on public.notification_settings;
create policy notification_settings_own on public.notification_settings for all to authenticated using (user_id=auth.uid()) with check (user_id=auth.uid());

-- Giảng viên được xem hồ sơ sinh viên thuộc học phần được phân công.
drop policy if exists profiles_teacher_view_subject_students on public.profiles;
create policy profiles_teacher_view_subject_students on public.profiles for select to authenticated
using (exists (
  select 1 from public.subject_members learner
  join public.subject_members teacher on teacher.subject_id=learner.subject_id
  where learner.user_id=profiles.id and teacher.user_id=auth.uid()
    and teacher.role in ('teacher','lecturer','giangvien')
));

create or replace function public.touch_last_login_from_log()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if new.action='login' and new.status='success' and new.user_id is not null then
    update public.profiles set last_login_at=new.created_at where id=new.user_id;
  end if;
  return new;
end$$;
drop trigger if exists trg_touch_last_login on public.activity_logs;
create trigger trg_touch_last_login after insert on public.activity_logs for each row execute function public.touch_last_login_from_log();

create or replace function public.refresh_my_notifications()
returns integer language plpgsql security definer set search_path=public as $$
declare
  uid uuid:=auth.uid();
  urole text;
  inserted_count integer:=0;
  week_key text:=to_char(timezone('Asia/Ho_Chi_Minh',now()),'IYYY-IW');
begin
  if uid is null then raise exception 'Chưa đăng nhập'; end if;
  select role into urole from public.profiles where id=uid and is_active=true;
  if urole is null then raise exception 'Tài khoản không hoạt động'; end if;
  insert into public.notification_settings(user_id) values(uid) on conflict(user_id) do nothing;

  if urole='student' then
    insert into public.notifications(user_id,subject_id,category,title,message,target_view,target_id,dedupe_key,expires_at)
    select uid,e.subject_id,'exam','Có bài kiểm tra mới',e.title,'exams',e.id,'exam-new:'||e.id::text,e.closes_at
    from public.exams e join public.subject_members sm on sm.subject_id=e.subject_id and sm.user_id=uid
    join public.notification_settings ns on ns.user_id=uid and ns.exam_new
    where e.status='active' and coalesce(e.opens_at,e.created_at)<=now()
      and e.created_at>=now()-interval '14 days'
    on conflict(user_id,dedupe_key) do nothing;
    get diagnostics inserted_count=row_count;

    insert into public.notifications(user_id,subject_id,category,severity,title,message,target_view,target_id,dedupe_key,expires_at)
    select uid,e.subject_id,'exam','warning','Bài kiểm tra sắp hết hạn',e.title||' sẽ hết hạn trong vòng 24 giờ.','exams',e.id,'exam-deadline:'||e.id::text,e.closes_at
    from public.exams e join public.subject_members sm on sm.subject_id=e.subject_id and sm.user_id=uid
    join public.notification_settings ns on ns.user_id=uid and ns.exam_deadline
    where e.status='active' and e.closes_at between now() and now()+interval '24 hours'
      and not exists(select 1 from public.exam_attempts a where a.exam_id=e.id and a.student_id=uid and a.submitted_at is not null)
    on conflict(user_id,dedupe_key) do nothing;

    insert into public.notifications(user_id,subject_id,category,severity,title,message,target_view,target_id,dedupe_key)
    select uid,e.subject_id,'clo','warning','Nhắc cải thiện '||c.code,
      'Điểm quy đổi gần đây của bạn ở '||c.code||' là '||round(10.0*avg(case when sa.is_correct then 1 else 0 end),1)||'/10. Hãy xem lại các chủ đề liên quan.',
      'results',c.id,'student-clo:'||c.id::text||':'||week_key
    from public.student_answers sa
    join public.exam_attempts a on a.id=sa.attempt_id and a.student_id=uid and a.submitted_at is not null
    join public.exams e on e.id=a.exam_id
    join public.questions q on q.id=sa.question_id
    join public.clos c on c.id=q.clo_id
    join public.notification_settings ns on ns.user_id=uid and ns.weekly_improvement
    where a.submitted_at>=now()-interval '30 days'
    group by e.subject_id,c.id,c.code
    having 10.0*avg(case when sa.is_correct then 1 else 0 end)<4
    on conflict(user_id,dedupe_key) do nothing;
  elsif urole in ('admin','teacher','lecturer','giangvien') then
    insert into public.notifications(user_id,subject_id,category,severity,title,message,target_view,dedupe_key)
    select uid,s.id,'activity','warning','Sinh viên ít hoạt động',count(*)||' sinh viên của '||s.name||' chưa đăng nhập trong 30 ngày.','dashboard','inactive:'||s.id::text||':'||week_key
    from public.subjects s join public.subject_members learner on learner.subject_id=s.id and learner.role='student'
    join public.profiles p on p.id=learner.user_id
    join public.notification_settings ns on ns.user_id=uid and ns.teacher_activity
    where (urole='admin' or exists(select 1 from public.subject_members mine where mine.subject_id=s.id and mine.user_id=uid and mine.role in ('teacher','lecturer','giangvien')))
      and (p.last_login_at is null or p.last_login_at<now()-interval '30 days') and p.is_active
    group by s.id,s.name having count(*)>0
    on conflict(user_id,dedupe_key) do nothing;

    insert into public.notifications(user_id,subject_id,category,severity,title,message,target_view,target_id,dedupe_key)
    select uid,e.subject_id,'exam','info','Bài kiểm tra cần xem kết quả',e.title||' đã có '||count(*)||' lượt nộp.','results',e.id,'review-exam:'||e.id::text||':'||week_key
    from public.exams e join public.exam_attempts a on a.exam_id=e.id and a.submitted_at is not null
    where (urole='admin' or exists(select 1 from public.subject_members mine where mine.subject_id=e.subject_id and mine.user_id=uid and mine.role in ('teacher','lecturer','giangvien')))
    group by e.id,e.subject_id,e.title
    on conflict(user_id,dedupe_key) do nothing;

    insert into public.notifications(user_id,subject_id,category,severity,title,message,target_view,target_id,dedupe_key)
    select uid,e.subject_id,'clo','warning','CLO của lớp cần chú ý',c.code||' hiện có điểm quy đổi trung bình '||round(10.0*avg(case when sa.is_correct then 1 else 0 end),1)||'/10.','results',c.id,'class-clo:'||e.subject_id::text||':'||c.id::text||':'||week_key
    from public.student_answers sa join public.exam_attempts a on a.id=sa.attempt_id and a.submitted_at is not null
    join public.exams e on e.id=a.exam_id
    join public.questions q on q.id=sa.question_id join public.clos c on c.id=q.clo_id
    join public.notification_settings ns on ns.user_id=uid and ns.teacher_clo
    where (urole='admin' or exists(select 1 from public.subject_members mine where mine.subject_id=e.subject_id and mine.user_id=uid and mine.role in ('teacher','lecturer','giangvien')))
      and a.submitted_at>=now()-interval '30 days'
    group by e.subject_id,c.id,c.code having 10.0*avg(case when sa.is_correct then 1 else 0 end)<4
    on conflict(user_id,dedupe_key) do nothing;

    insert into public.notifications(user_id,subject_id,category,severity,title,message,target_view,target_id,dedupe_key)
    select uid,b.subject_id,'ai','warning','Phiên AI còn chờ duyệt',count(d.id)||' câu hỏi vẫn đang chờ duyệt.','questions',b.id,'ai-pending:'||b.id::text
    from public.ai_generation_batches b join public.ai_question_drafts d on d.batch_id=b.id and d.review_status='pending'
    join public.notification_settings ns on ns.user_id=uid and ns.ai_pending
    where (urole='admin' or exists(select 1 from public.subject_members mine where mine.subject_id=b.subject_id and mine.user_id=uid and mine.role in ('teacher','lecturer','giangvien')))
      and b.created_at<now()-interval '3 days'
    group by b.id,b.subject_id
    on conflict(user_id,dedupe_key) do nothing;
  end if;
  delete from public.notifications where user_id=uid and expires_at is not null and expires_at<now()-interval '7 days';
  return inserted_count;
end$$;
revoke all on function public.refresh_my_notifications() from public,anon;
grant execute on function public.refresh_my_notifications() to authenticated;

create or replace function public.admin_delete_attempt(p_attempt_id uuid)
returns void language plpgsql security definer set search_path=public as $$
begin
 if not public.is_admin() then raise exception 'Chỉ Admin được thực hiện'; end if;
 delete from public.student_answers where attempt_id=p_attempt_id;
 delete from public.exam_attempts where id=p_attempt_id;
end$$;
revoke all on function public.admin_delete_attempt(uuid) from public,anon;
grant execute on function public.admin_delete_attempt(uuid) to authenticated;

create or replace function public.admin_delete_exam(p_exam_id uuid)
returns void language plpgsql security definer set search_path=public as $$
begin
 if not public.is_admin() then raise exception 'Chỉ Admin được thực hiện'; end if;
 delete from public.student_answers where attempt_id in (select id from public.exam_attempts where exam_id=p_exam_id);
 delete from public.exam_attempts where exam_id=p_exam_id;
 delete from public.exam_questions where exam_id=p_exam_id;
 delete from public.exam_chapters where exam_id=p_exam_id;
 delete from public.exam_clos where exam_id=p_exam_id;
 delete from public.exams where id=p_exam_id;
end$$;
revoke all on function public.admin_delete_exam(uuid) from public,anon;
grant execute on function public.admin_delete_exam(uuid) to authenticated;

create or replace function public.cleanup_aiclo_logs()
returns integer language plpgsql security definer set search_path=public as $$
declare n integer;
begin
 delete from public.activity_logs where created_at<now()-interval '6 months';
 get diagnostics n=row_count;
 return n;
end$$;
revoke all on function public.cleanup_aiclo_logs() from public,anon,authenticated;

-- Dọn nhật ký mỗi ngày. Nếu dự án chưa bật pg_cron, SQL Editor có thể báo ở khối này;
-- khi đó bật extension pg_cron rồi chạy lại riêng phần dưới.
create extension if not exists pg_cron;
do $$
declare jid bigint;
begin
 for jid in select jobid from cron.job where jobname='aiclo-cleanup-logs' loop perform cron.unschedule(jid); end loop;
 perform cron.schedule('aiclo-cleanup-logs','17 2 * * *','select public.cleanup_aiclo_logs();');
end$$;
