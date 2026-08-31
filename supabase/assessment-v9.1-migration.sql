-- AI-CLO PTITHCM v9.1 — Assessment UX + frozen pools + per-attempt question sets
-- Chạy SAU assessment-v9-migration.sql. File này có thể chạy lại an toàn phần lớn cấu trúc.
begin;

alter table public.exams add column if not exists question_mode text not null default 'common_fixed';
alter table public.exams drop constraint if exists exams_question_mode_check;
alter table public.exams add constraint exams_question_mode_check
  check (question_mode in ('common_fixed','student_fixed','attempt_random'));

-- Nếu chạy lại migration, tạm gỡ các trigger khóa trên bảng đã tồn tại.
drop trigger if exists trg_guard_exam_questions on public.exam_questions;
drop trigger if exists trg_guard_exam_structure on public.exams;

-- Pool đóng băng tại lúc tạo bài. Sinh viên không được đọc trực tiếp vì có đáp án đúng.
create table if not exists public.exam_question_pool (
  id uuid primary key default gen_random_uuid(),
  exam_id uuid not null references public.exams(id) on delete cascade,
  question_id uuid not null references public.questions(id) on delete restrict,
  chapter_id uuid null,
  chapter_name text null,
  topic_id uuid null,
  topic_name text null,
  clo_id uuid null,
  clo_code text null,
  content text not null,
  correct_answer character(1) not null,
  explanation text null,
  options jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  unique(exam_id,question_id),
  check (correct_answer in ('A','B','C','D'))
);

-- Snapshot thực sự của từng lượt làm. Đây là nguồn chấm/hiển thị của V9.1.
create table if not exists public.attempt_questions (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.exam_attempts(id) on delete cascade,
  question_id uuid not null references public.questions(id) on delete restrict,
  question_order integer not null,
  chapter_id uuid null,
  chapter_name text null,
  topic_id uuid null,
  topic_name text null,
  clo_id uuid null,
  clo_code text null,
  content text not null,
  correct_answer character(1) not null,
  explanation text null,
  options jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  unique(attempt_id,question_id),
  unique(attempt_id,question_order),
  check (correct_answer in ('A','B','C','D'))
);

-- exam_question_pool đã tồn tại ở thời điểm này; gỡ trigger khóa cũ nếu đây là lần chạy lại.
drop trigger if exists trg_guard_exam_pool on public.exam_question_pool;

alter table public.exam_question_pool enable row level security;
alter table public.attempt_questions enable row level security;

-- Quyền bảng tối thiểu; RLS bên dưới vẫn quyết định hàng nào được phép đọc/sửa.
grant select,insert,update,delete on table public.exam_question_pool to authenticated;
grant select on table public.attempt_questions to authenticated;

drop policy if exists exam_question_pool_staff_select on public.exam_question_pool;
create policy exam_question_pool_staff_select on public.exam_question_pool
for select to authenticated using (
  exists(select 1 from public.exams e where e.id=exam_id and (public.is_admin() or public.is_subject_teacher(e.subject_id)))
);
drop policy if exists exam_question_pool_staff_insert on public.exam_question_pool;
create policy exam_question_pool_staff_insert on public.exam_question_pool
for insert to authenticated with check (
  exists(select 1 from public.exams e where e.id=exam_id and (public.is_admin() or public.is_subject_teacher(e.subject_id)))
);
drop policy if exists exam_question_pool_staff_update on public.exam_question_pool;
create policy exam_question_pool_staff_update on public.exam_question_pool
for update to authenticated using (
  exists(select 1 from public.exams e where e.id=exam_id and (public.is_admin() or public.is_subject_teacher(e.subject_id)))
) with check (
  exists(select 1 from public.exams e where e.id=exam_id and (public.is_admin() or public.is_subject_teacher(e.subject_id)))
);
drop policy if exists exam_question_pool_staff_delete on public.exam_question_pool;
create policy exam_question_pool_staff_delete on public.exam_question_pool
for delete to authenticated using (
  exists(select 1 from public.exams e where e.id=exam_id and (public.is_admin() or public.is_subject_teacher(e.subject_id)))
);

drop policy if exists attempt_questions_staff_select on public.attempt_questions;
create policy attempt_questions_staff_select on public.attempt_questions
for select to authenticated using (
  exists(
    select 1 from public.exam_attempts ea join public.exams e on e.id=ea.exam_id
    where ea.id=attempt_id and (public.is_admin() or public.is_subject_teacher(e.subject_id))
  )
);

-- Backfill pool cho các bài V9 hiện có. Chúng mặc định common_fixed.
insert into public.exam_question_pool(
  exam_id,question_id,chapter_id,chapter_name,topic_id,topic_name,clo_id,clo_code,
  content,correct_answer,explanation,options
)
select eq.exam_id,q.id,q.chapter_id,ch.name,q.topic_id,t.name,q.clo_id,c.code,
       q.content,q.correct_answer,q.explanation,
       coalesce((select jsonb_agg(jsonb_build_object('key',qo.option_key,'content',qo.content) order by qo.option_key)
                 from public.question_options qo where qo.question_id=q.id),'[]'::jsonb)
from public.exam_questions eq
join public.questions q on q.id=eq.question_id
left join public.chapters ch on ch.id=q.chapter_id
left join public.topics t on t.id=q.topic_id
left join public.clos c on c.id=q.clo_id
on conflict(exam_id,question_id) do nothing;

-- Backfill snapshot cho các lượt V9 đã tồn tại tại thời điểm nâng cấp.
insert into public.attempt_questions(
  attempt_id,question_id,question_order,chapter_id,chapter_name,topic_id,topic_name,clo_id,clo_code,
  content,correct_answer,explanation,options
)
select ea.id,p.question_id,eq.question_order,p.chapter_id,p.chapter_name,p.topic_id,p.topic_name,p.clo_id,p.clo_code,
       p.content,p.correct_answer,p.explanation,p.options
from public.exam_attempts ea
join public.exam_questions eq on eq.exam_id=ea.exam_id
join public.exam_question_pool p on p.exam_id=ea.exam_id and p.question_id=eq.question_id
where not exists(select 1 from public.attempt_questions existing where existing.attempt_id=ea.id)
on conflict(attempt_id,question_id) do nothing;

-- Chặn thay đổi bộ câu/pool sau khi bài đã có lượt làm.
create or replace function public.guard_exam_question_changes()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare v_exam_id uuid;
begin
  if tg_op='DELETE' then
    v_exam_id:=old.exam_id;
  else
    v_exam_id:=new.exam_id;
  end if;
  if exists(select 1 from public.exam_attempts where exam_id=v_exam_id limit 1) then
    raise exception 'Bài kiểm tra đã có lượt làm; bộ câu hỏi đã được khóa';
  end if;
  if tg_op='DELETE' then
    return old;
  end if;
  return new;
end;$$;

drop trigger if exists trg_guard_exam_questions on public.exam_questions;
create trigger trg_guard_exam_questions before insert or update or delete on public.exam_questions
for each row execute function public.guard_exam_question_changes();
drop trigger if exists trg_guard_exam_pool on public.exam_question_pool;
create trigger trg_guard_exam_pool before insert or update or delete on public.exam_question_pool
for each row execute function public.guard_exam_question_changes();

-- Chặn sửa cấu trúc đo lường sau khi đã có lượt làm; vẫn cho đóng bài/đổi tiêu đề/đổi hạn xem kết quả.
create or replace function public.guard_exam_structure_update()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if exists(select 1 from public.exam_attempts where exam_id=old.id limit 1)
     and (new.total_questions is distinct from old.total_questions
       or new.chapter_ids is distinct from old.chapter_ids
       or new.topic_ids is distinct from old.topic_ids
       or new.clo_counts is distinct from old.clo_counts
       or new.question_mode is distinct from old.question_mode
       or new.duration_minutes is distinct from old.duration_minutes
       or new.max_attempts is distinct from old.max_attempts
       or new.shuffle_questions is distinct from old.shuffle_questions
       or new.shuffle_options is distinct from old.shuffle_options
       or new.opens_at is distinct from old.opens_at) then
    raise exception 'Bài kiểm tra đã có lượt làm; cấu trúc câu hỏi đã được khóa';
  end if;
  return new;
end;$$;
drop trigger if exists trg_guard_exam_structure on public.exams;
create trigger trg_guard_exam_structure before update on public.exams
for each row execute function public.guard_exam_structure_update();

-- Điền snapshot câu hỏi cho một lượt làm dựa trên chế độ của bài.
create or replace function public.populate_attempt_questions(p_attempt_id uuid)
returns integer
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_attempt public.exam_attempts%rowtype;
  v_exam public.exams%rowtype;
  v_previous uuid;
  v_code text;
  v_need integer;
  v_added integer;
  v_order integer:=0;
  r record;
begin
  select * into v_attempt from public.exam_attempts where id=p_attempt_id;
  if not found then raise exception 'Không tìm thấy lượt làm bài'; end if;
  select * into v_exam from public.exams where id=v_attempt.exam_id;
  if auth.uid()<>v_attempt.student_id and not public.is_admin() and not public.is_subject_teacher(v_exam.subject_id) then
    raise exception 'Không có quyền tạo bộ câu cho lượt làm này';
  end if;
  if exists(select 1 from public.attempt_questions where attempt_id=p_attempt_id) then
    return (select count(*) from public.attempt_questions where attempt_id=p_attempt_id);
  end if;

  -- Đề chung: luôn sao chép bộ exam_questions đã chốt.
  if coalesce(v_exam.question_mode,'common_fixed')='common_fixed' then
    insert into public.attempt_questions(
      attempt_id,question_id,question_order,chapter_id,chapter_name,topic_id,topic_name,clo_id,clo_code,
      content,correct_answer,explanation,options
    )
    select p_attempt_id,p.question_id,eq.question_order,p.chapter_id,p.chapter_name,p.topic_id,p.topic_name,p.clo_id,p.clo_code,
           p.content,p.correct_answer,p.explanation,p.options
    from public.exam_questions eq
    join public.exam_question_pool p on p.exam_id=eq.exam_id and p.question_id=eq.question_id
    where eq.exam_id=v_exam.id order by eq.question_order;

  -- Đề riêng cố định theo sinh viên: từ lần 2 sao chép đúng bộ của lần trước.
  elsif v_exam.question_mode='student_fixed' then
    select ea.id into v_previous
    from public.exam_attempts ea
    where ea.exam_id=v_exam.id and ea.student_id=v_attempt.student_id and ea.id<>p_attempt_id
      and exists(select 1 from public.attempt_questions aq where aq.attempt_id=ea.id)
    order by ea.attempt_number asc limit 1;
    if v_previous is not null then
      insert into public.attempt_questions(
        attempt_id,question_id,question_order,chapter_id,chapter_name,topic_id,topic_name,clo_id,clo_code,
        content,correct_answer,explanation,options
      )
      select p_attempt_id,question_id,question_order,chapter_id,chapter_name,topic_id,topic_name,clo_id,clo_code,
             content,correct_answer,explanation,options
      from public.attempt_questions where attempt_id=v_previous order by question_order;
    end if;
  end if;

  -- Nếu chưa có câu (student_fixed lần đầu hoặc attempt_random), rút theo CLO từ pool đóng băng.
  if not exists(select 1 from public.attempt_questions where attempt_id=p_attempt_id) then
    for v_code,v_need in select key,value::integer from jsonb_each_text(coalesce(v_exam.clo_counts,'{}'::jsonb)) loop
      v_added:=0;
      -- Với attempt_random, ưu tiên câu sinh viên chưa gặp ở các lượt trước.
      for r in
        select p.* from public.exam_question_pool p
        where p.exam_id=v_exam.id and p.clo_code=v_code
          and (v_exam.question_mode<>'attempt_random' or not exists(
            select 1 from public.exam_attempts ea2 join public.attempt_questions aq2 on aq2.attempt_id=ea2.id
            where ea2.exam_id=v_exam.id and ea2.student_id=v_attempt.student_id and aq2.question_id=p.question_id
          ))
        order by random() limit v_need
      loop
        v_order:=v_order+1; v_added:=v_added+1;
        insert into public.attempt_questions(attempt_id,question_id,question_order,chapter_id,chapter_name,topic_id,topic_name,clo_id,clo_code,content,correct_answer,explanation,options)
        values(p_attempt_id,r.question_id,v_order,r.chapter_id,r.chapter_name,r.topic_id,r.topic_name,r.clo_id,r.clo_code,r.content,r.correct_answer,r.explanation,r.options);
      end loop;
      -- Nếu pool chưa gặp không đủ, cho phép lặp lại câu cũ nhưng không trùng trong cùng lượt.
      if v_added<v_need then
        for r in
          select p.* from public.exam_question_pool p
          where p.exam_id=v_exam.id and p.clo_code=v_code
            and not exists(select 1 from public.attempt_questions aq where aq.attempt_id=p_attempt_id and aq.question_id=p.question_id)
          order by random() limit (v_need-v_added)
        loop
          v_order:=v_order+1; v_added:=v_added+1;
          insert into public.attempt_questions(attempt_id,question_id,question_order,chapter_id,chapter_name,topic_id,topic_name,clo_id,clo_code,content,correct_answer,explanation,options)
          values(p_attempt_id,r.question_id,v_order,r.chapter_id,r.chapter_name,r.topic_id,r.topic_name,r.clo_id,r.clo_code,r.content,r.correct_answer,r.explanation,r.options);
        end loop;
      end if;
      if v_added<v_need then raise exception 'Pool câu hỏi không đủ % câu cho %',v_need,v_code; end if;
    end loop;
  end if;

  if (select count(*) from public.attempt_questions where attempt_id=p_attempt_id)<>v_exam.total_questions then
    raise exception 'Không rút đủ số câu cho lượt làm';
  end if;
  return (select count(*) from public.attempt_questions where attempt_id=p_attempt_id);
end;
$$;

create or replace function public.get_exam_attempt_payload(p_attempt_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_attempt public.exam_attempts%rowtype;
  v_exam public.exams%rowtype;
  v_questions jsonb;
  v_answers jsonb;
  v_remaining integer;
begin
  select * into v_attempt from public.exam_attempts where id=p_attempt_id;
  if not found then raise exception 'Không tìm thấy lượt làm bài'; end if;
  select * into v_exam from public.exams where id=v_attempt.exam_id;
  if auth.uid()<>v_attempt.student_id and not public.is_admin() and not public.is_subject_teacher(v_exam.subject_id) then raise exception 'Không có quyền xem lượt làm bài'; end if;
  perform public.populate_attempt_questions(p_attempt_id);

  if v_exam.duration_minutes is null then v_remaining:=null;
  else v_remaining:=greatest(0,floor(extract(epoch from (v_attempt.started_at+make_interval(mins=>v_exam.duration_minutes)-now())))::integer); end if;

  select coalesce(jsonb_object_agg(question_id::text,selected_option) filter(where selected_option is not null),'{}'::jsonb)
  into v_answers from public.attempt_draft_answers where attempt_id=p_attempt_id;

  select coalesce(jsonb_agg(item order by sort_key),'[]'::jsonb) into v_questions
  from (
    select
      case when v_exam.shuffle_questions then md5(p_attempt_id::text||aq.question_id::text) else lpad(aq.question_order::text,10,'0') end sort_key,
      jsonb_build_object(
        'id',aq.question_id,'content',aq.content,'clo_code',aq.clo_code,'chapter',aq.chapter_name,'topic',aq.topic_name,
        'options',(
          select coalesce(jsonb_agg(e order by case when v_exam.shuffle_options then md5(p_attempt_id::text||(e->>'key')) else e->>'key' end),'[]'::jsonb)
          from jsonb_array_elements(aq.options) e
        )
      ) item
    from public.attempt_questions aq where aq.attempt_id=p_attempt_id
  ) s;

  return jsonb_build_object(
    'attempt_id',v_attempt.id,'attempt_number',v_attempt.attempt_number,'started_at',v_attempt.started_at,
    'submitted_at',v_attempt.submitted_at,'remaining_seconds',v_remaining,'answers',coalesce(v_answers,'{}'::jsonb),
    'exam',jsonb_build_object('id',v_exam.id,'title',v_exam.title,'duration_minutes',v_exam.duration_minutes,'show_answers',v_exam.show_answers,'allow_ai_feedback',v_exam.allow_ai_feedback,'question_mode',v_exam.question_mode),
    'questions',coalesce(v_questions,'[]'::jsonb)
  );
end;
$$;

create or replace function public.save_exam_progress(p_attempt_id uuid,p_question_id uuid,p_selected_option text)
returns boolean
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare v_attempt public.exam_attempts%rowtype; v_exam public.exams%rowtype;
begin
  select * into v_attempt from public.exam_attempts where id=p_attempt_id;
  if not found or v_attempt.student_id<>auth.uid() then raise exception 'Không có quyền lưu bài này'; end if;
  if v_attempt.submitted_at is not null then raise exception 'Bài đã được nộp'; end if;
  select * into v_exam from public.exams where id=v_attempt.exam_id;
  if v_exam.duration_minutes is not null and now()>v_attempt.started_at+make_interval(mins=>v_exam.duration_minutes)+interval '30 seconds' then raise exception 'Đã hết thời gian làm bài'; end if;
  if p_selected_option is not null and p_selected_option not in ('A','B','C','D') then raise exception 'Phương án không hợp lệ'; end if;
  perform public.populate_attempt_questions(p_attempt_id);
  if not exists(select 1 from public.attempt_questions where attempt_id=p_attempt_id and question_id=p_question_id) then raise exception 'Câu hỏi không thuộc lượt làm này'; end if;
  insert into public.attempt_draft_answers(attempt_id,question_id,selected_option,updated_at)
  values(p_attempt_id,p_question_id,p_selected_option::character(1),now())
  on conflict(attempt_id,question_id) do update set selected_option=excluded.selected_option,updated_at=now();
  return true;
end;
$$;

create or replace function public.get_attempt_result(p_attempt_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_attempt public.exam_attempts%rowtype; v_exam public.exams%rowtype;
  v_clos jsonb; v_chapters jsonb; v_review jsonb; v_total integer; v_correct integer; v_can_review boolean;
begin
  select * into v_attempt from public.exam_attempts where id=p_attempt_id;
  if not found then raise exception 'Không tìm thấy lượt làm bài'; end if;
  select * into v_exam from public.exams where id=v_attempt.exam_id;
  if auth.uid()<>v_attempt.student_id and not public.is_admin() and not public.is_subject_teacher(v_exam.subject_id) then raise exception 'Không có quyền xem kết quả'; end if;
  if v_attempt.submitted_at is null then raise exception 'Bài chưa được nộp'; end if;
  perform public.populate_attempt_questions(p_attempt_id);

  select count(*),count(*) filter(where sa.is_correct) into v_total,v_correct
  from public.attempt_questions aq left join public.student_answers sa on sa.attempt_id=p_attempt_id and sa.question_id=aq.question_id
  where aq.attempt_id=p_attempt_id;

  select coalesce(jsonb_agg(jsonb_build_object('code',code,'correct',correct_count,'total',total_count,'score',round(correct_count*10.0/nullif(total_count,0),2)) order by code),'[]'::jsonb)
  into v_clos from (
    select coalesce(aq.clo_code,'—') code,count(*) total_count,count(*) filter(where sa.is_correct) correct_count
    from public.attempt_questions aq left join public.student_answers sa on sa.attempt_id=p_attempt_id and sa.question_id=aq.question_id
    where aq.attempt_id=p_attempt_id group by aq.clo_code
  ) z;

  select coalesce(jsonb_agg(jsonb_build_object('chapter',chapter_name,'correct',correct_count,'total',total_count,'score',round(correct_count*10.0/nullif(total_count,0),2)) order by chapter_name),'[]'::jsonb)
  into v_chapters from (
    select coalesce(aq.chapter_name,'—') chapter_name,count(*) total_count,count(*) filter(where sa.is_correct) correct_count
    from public.attempt_questions aq left join public.student_answers sa on sa.attempt_id=p_attempt_id and sa.question_id=aq.question_id
    where aq.attempt_id=p_attempt_id group by aq.chapter_name
  ) z;

  v_can_review:=v_exam.show_answers or public.is_admin() or public.is_subject_teacher(v_exam.subject_id);
  if v_can_review then
    select coalesce(jsonb_agg(jsonb_build_object(
      'question_id',aq.question_id,'content',aq.content,'selected',sa.selected_option,'correct_answer',aq.correct_answer,
      'is_correct',coalesce(sa.is_correct,false),'explanation',aq.explanation,'options',aq.options,
      'clo_code',aq.clo_code,'chapter',aq.chapter_name,'topic',aq.topic_name
    ) order by aq.question_order),'[]'::jsonb)
    into v_review
    from public.attempt_questions aq left join public.student_answers sa on sa.attempt_id=p_attempt_id and sa.question_id=aq.question_id
    where aq.attempt_id=p_attempt_id;
  else v_review:='[]'::jsonb; end if;

  return jsonb_build_object('attempt_id',v_attempt.id,'exam_id',v_attempt.exam_id,'student_id',v_attempt.student_id,'attempt_number',v_attempt.attempt_number,
    'score',v_attempt.score,'correct',coalesce(v_correct,0),'total',coalesce(v_total,0),'submitted_at',v_attempt.submitted_at,
    'clo_scores',coalesce(v_clos,'[]'::jsonb),'chapter_scores',coalesce(v_chapters,'[]'::jsonb),'review',coalesce(v_review,'[]'::jsonb),'show_answers',v_can_review);
end;
$$;

create or replace function public.finalize_exam_attempt(p_attempt_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare v_attempt public.exam_attempts%rowtype; v_exam public.exams%rowtype; v_total integer; v_correct integer;
begin
  select * into v_attempt from public.exam_attempts where id=p_attempt_id for update;
  if not found then raise exception 'Không tìm thấy lượt làm bài'; end if;
  select * into v_exam from public.exams where id=v_attempt.exam_id;
  if auth.uid()<>v_attempt.student_id and not public.is_admin() and not public.is_subject_teacher(v_exam.subject_id) then raise exception 'Không có quyền nộp bài'; end if;
  if v_attempt.submitted_at is not null then return public.get_attempt_result(p_attempt_id); end if;
  perform public.populate_attempt_questions(p_attempt_id);

  delete from public.student_answers where attempt_id=p_attempt_id;
  insert into public.student_answers(attempt_id,question_id,selected_option,is_correct)
  select p_attempt_id,aq.question_id,d.selected_option::character(1),coalesce(d.selected_option=aq.correct_answer::text,false)
  from public.attempt_questions aq left join public.attempt_draft_answers d on d.attempt_id=p_attempt_id and d.question_id=aq.question_id
  where aq.attempt_id=p_attempt_id;
  select count(*),count(*) filter(where is_correct) into v_total,v_correct from public.student_answers where attempt_id=p_attempt_id;
  update public.exam_attempts set submitted_at=now(),score=round(coalesce(v_correct,0)*10.0/nullif(v_total,0),2) where id=p_attempt_id;
  return public.get_attempt_result(p_attempt_id);
end;
$$;

create or replace function public.start_exam_attempt(p_exam_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_exam public.exams%rowtype; v_open public.exam_attempts%rowtype; v_attempt public.exam_attempts%rowtype;
  v_count integer; v_next integer; v_expired boolean;
begin
  select * into v_exam from public.exams where id=p_exam_id;
  if not found then raise exception 'Không tìm thấy bài kiểm tra'; end if;
  if auth.uid() is null or not public.is_subject_student(v_exam.subject_id) then raise exception 'Bạn không thuộc học phần này'; end if;
  if v_exam.status<>'active' then raise exception 'Bài kiểm tra chưa được phát hành'; end if;
  if v_exam.opens_at is not null and now()<v_exam.opens_at then raise exception 'Bài kiểm tra chưa đến thời gian mở'; end if;
  if v_exam.closes_at is not null and now()>v_exam.closes_at then raise exception 'Bài kiểm tra đã kết thúc'; end if;
  if not exists(select 1 from public.exam_question_pool where exam_id=p_exam_id) then raise exception 'Bài kiểm tra chưa có pool câu hỏi'; end if;

  select * into v_open from public.exam_attempts
  where exam_id=p_exam_id and student_id=auth.uid() and submitted_at is null
  order by attempt_number desc limit 1;
  if found then
    v_expired:=v_exam.duration_minutes is not null and now()>=v_open.started_at+make_interval(mins=>v_exam.duration_minutes);
    if not v_expired then perform public.populate_attempt_questions(v_open.id); return jsonb_build_object('attempt_id',v_open.id,'attempt_number',v_open.attempt_number,'resumed',true); end if;
    perform public.finalize_exam_attempt(v_open.id);
  end if;

  select count(*) into v_count from public.exam_attempts where exam_id=p_exam_id and student_id=auth.uid();
  if v_count>=greatest(1,v_exam.max_attempts) then raise exception 'Bạn đã sử dụng hết số lần làm bài'; end if;
  v_next:=v_count+1;
  insert into public.exam_attempts(exam_id,student_id,attempt_number,started_at)
  values(p_exam_id,auth.uid(),v_next,now()) returning * into v_attempt;
  perform public.populate_attempt_questions(v_attempt.id);
  return jsonb_build_object('attempt_id',v_attempt.id,'attempt_number',v_attempt.attempt_number,'resumed',false);
end;
$$;

-- RPC hỗ trợ giảng viên xem thống kê số bài làm theo một bài kiểm tra không lộ dữ liệu ngoài học phần.
create or replace function public.get_exam_attempt_count(p_exam_id uuid)
returns integer language sql security definer set search_path=public,pg_temp as $$
  select case when public.is_admin() or public.is_subject_teacher(e.subject_id)
    then (select count(*)::integer from public.exam_attempts ea where ea.exam_id=e.id) else 0 end
  from public.exams e where e.id=p_exam_id;
$$;

grant execute on function public.populate_attempt_questions(uuid) to authenticated;
grant execute on function public.get_exam_attempt_payload(uuid) to authenticated;
grant execute on function public.save_exam_progress(uuid,uuid,text) to authenticated;
grant execute on function public.get_attempt_result(uuid) to authenticated;
grant execute on function public.finalize_exam_attempt(uuid) to authenticated;
grant execute on function public.start_exam_attempt(uuid) to authenticated;
grant execute on function public.get_exam_attempt_count(uuid) to authenticated;

commit;
