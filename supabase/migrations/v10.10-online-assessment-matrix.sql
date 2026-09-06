-- AI-CLO PTITHCM V10.10
-- Giữ đúng ma trận Mục · CLO khi rút đề riêng hoặc rút lại mỗi lần làm.
-- Chạy một lần sau assessment-v9.1-migration.sql.

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
  v_added integer;
  v_order integer:=0;
  cell record;
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

  -- Dùng bộ câu mẫu exam_questions làm ma trận chuẩn, không cần thêm cột database.
  if not exists(select 1 from public.attempt_questions where attempt_id=p_attempt_id) then
    for cell in
      select p.topic_id,p.clo_id,p.clo_code,count(*)::integer as need
      from public.exam_questions eq
      join public.exam_question_pool p on p.exam_id=eq.exam_id and p.question_id=eq.question_id
      where eq.exam_id=v_exam.id
      group by p.topic_id,p.clo_id,p.clo_code
      order by min(eq.question_order)
    loop
      v_added:=0;
      for r in
        select p.* from public.exam_question_pool p
        where p.exam_id=v_exam.id and p.topic_id=cell.topic_id and p.clo_id=cell.clo_id
          and (v_exam.question_mode<>'attempt_random' or not exists(
            select 1 from public.exam_attempts ea2 join public.attempt_questions aq2 on aq2.attempt_id=ea2.id
            where ea2.exam_id=v_exam.id and ea2.student_id=v_attempt.student_id and aq2.question_id=p.question_id
          ))
        order by random() limit cell.need
      loop
        v_order:=v_order+1;v_added:=v_added+1;
        insert into public.attempt_questions(attempt_id,question_id,question_order,chapter_id,chapter_name,topic_id,topic_name,clo_id,clo_code,content,correct_answer,explanation,options)
        values(p_attempt_id,r.question_id,v_order,r.chapter_id,r.chapter_name,r.topic_id,r.topic_name,r.clo_id,r.clo_code,r.content,r.correct_answer,r.explanation,r.options);
      end loop;
      if v_added<cell.need then
        for r in
          select p.* from public.exam_question_pool p
          where p.exam_id=v_exam.id and p.topic_id=cell.topic_id and p.clo_id=cell.clo_id
            and not exists(select 1 from public.attempt_questions aq where aq.attempt_id=p_attempt_id and aq.question_id=p.question_id)
          order by random() limit (cell.need-v_added)
        loop
          v_order:=v_order+1;v_added:=v_added+1;
          insert into public.attempt_questions(attempt_id,question_id,question_order,chapter_id,chapter_name,topic_id,topic_name,clo_id,clo_code,content,correct_answer,explanation,options)
          values(p_attempt_id,r.question_id,v_order,r.chapter_id,r.chapter_name,r.topic_id,r.topic_name,r.clo_id,r.clo_code,r.content,r.correct_answer,r.explanation,r.options);
        end loop;
      end if;
      if v_added<cell.need then raise exception 'Pool không đủ % câu cho ô Mục · CLO',cell.need; end if;
    end loop;
  end if;

  if (select count(*) from public.attempt_questions where attempt_id=p_attempt_id)<>v_exam.total_questions then
    raise exception 'Không rút đủ số câu cho lượt làm';
  end if;
  return (select count(*) from public.attempt_questions where attempt_id=p_attempt_id);
end;
$$;

grant execute on function public.populate_attempt_questions(uuid) to authenticated;
