-- AI-CLO PTITHCM V12.6 — mixed fixed + random online assessment mode.
-- Run after assessment-v12.3.1-review-ai.sql and assessment-v12.2-migration.sql.
-- No new table/column. Fixed question ids live in exams.question_blueprint.fixed_question_ids.
-- Safe to run again.

begin;

alter table public.exams drop constraint if exists exams_question_mode_check;
alter table public.exams add constraint exams_question_mode_check
  check (question_mode in ('common_fixed','student_fixed','attempt_random','mixed_fixed_random'));

create or replace function public.assessment_mixed_random_version()
returns text
language sql
stable
security definer
set search_path=public,pg_temp
as $$ select '12.6'::text $$;
revoke all on function public.assessment_mixed_random_version() from public,anon;
grant execute on function public.assessment_mixed_random_version() to authenticated;

comment on function public.assessment_mixed_random_version() is
  'Capability marker for V12.6 mixed_fixed_random assessments.';

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
  v_matrix jsonb;
  v_fixed jsonb;
  v_fixed_count integer;
  v_kind text;
  v_scope_id uuid;
  v_clo_id uuid;
  v_need integer;
  cell record;
  r record;
begin
  select * into v_attempt from public.exam_attempts where id=p_attempt_id;
  if not found then raise exception 'Không tìm thấy lượt làm bài'; end if;

  select * into v_exam from public.exams where id=v_attempt.exam_id;
  if auth.uid()<>v_attempt.student_id
     and not public.is_admin()
     and not public.is_subject_teacher(v_exam.subject_id) then
    raise exception 'Không có quyền tạo bộ câu cho lượt làm này';
  end if;

  if exists(select 1 from public.attempt_questions where attempt_id=p_attempt_id) then
    return (select count(*) from public.attempt_questions where attempt_id=p_attempt_id);
  end if;

  -- Đề chung cố định: sao chép đúng bộ exam_questions đã chốt.
  if coalesce(v_exam.question_mode,'common_fixed')='common_fixed' then
    insert into public.attempt_questions(
      attempt_id,question_id,question_order,chapter_id,chapter_name,topic_id,topic_name,clo_id,clo_code,
      content,correct_answer,explanation,options
    )
    select p_attempt_id,p.question_id,eq.question_order,p.chapter_id,p.chapter_name,p.topic_id,p.topic_name,p.clo_id,p.clo_code,
           p.content,p.correct_answer,p.explanation,p.options
    from public.exam_questions eq
    join public.exam_question_pool p
      on p.exam_id=eq.exam_id and p.question_id=eq.question_id
    where eq.exam_id=v_exam.id
    order by eq.question_order;

  -- Đề riêng theo sinh viên: từ lần 2 dùng lại đúng bộ của lần đầu.
  elsif v_exam.question_mode='student_fixed' then
    select ea.id into v_previous
    from public.exam_attempts ea
    where ea.exam_id=v_exam.id
      and ea.student_id=v_attempt.student_id
      and ea.id<>p_attempt_id
      and exists(select 1 from public.attempt_questions aq where aq.attempt_id=ea.id)
    order by ea.attempt_number asc
    limit 1;

    if v_previous is not null then
      insert into public.attempt_questions(
        attempt_id,question_id,question_order,chapter_id,chapter_name,topic_id,topic_name,clo_id,clo_code,
        content,correct_answer,explanation,options
      )
      select p_attempt_id,question_id,question_order,chapter_id,chapter_name,topic_id,topic_name,clo_id,clo_code,
             content,correct_answer,explanation,options
      from public.attempt_questions
      where attempt_id=v_previous
      order by question_order;
    end if;
  end if;

  if not exists(select 1 from public.attempt_questions where attempt_id=p_attempt_id) then
    v_matrix:=coalesce(v_exam.question_blueprint->'matrix','{}'::jsonb);

    -- Legacy fallback when an old row has no persisted matrix.
    if v_matrix='{}'::jsonb then
      v_matrix:=coalesce((
        select jsonb_object_agg('t:'||x.topic_id::text||':'||x.clo_id::text,x.need)
        from (
          select p.topic_id,p.clo_id,count(*)::integer as need
          from public.exam_questions eq
          join public.exam_question_pool p
            on p.exam_id=eq.exam_id and p.question_id=eq.question_id
          where eq.exam_id=v_exam.id
            and p.topic_id is not null
            and p.clo_id is not null
          group by p.topic_id,p.clo_id
        ) x
      ),'{}'::jsonb);
    end if;

    -- Mixed mode: insert every fixed question first. They consume quota from their own matrix cell.
    if v_exam.question_mode='mixed_fixed_random' then
      v_fixed:=coalesce(v_exam.question_blueprint->'fixed_question_ids','[]'::jsonb);
      if jsonb_typeof(v_fixed)<>'array' then
        raise exception 'Danh sách câu cố định không hợp lệ';
      end if;

      if exists(
        select 1
        from jsonb_array_elements_text(v_fixed) f(value)
        group by value
        having count(*)>1
      ) then
        raise exception 'Danh sách câu cố định có câu trùng';
      end if;

      if exists(
        select 1
        from jsonb_array_elements_text(v_fixed) f(value)
        where not exists(
          select 1 from public.exam_question_pool p
          where p.exam_id=v_exam.id and p.question_id=f.value::uuid
        )
      ) then
        raise exception 'Có câu cố định không nằm trong pool đóng băng';
      end if;

      for r in
        select p.*
        from jsonb_array_elements_text(v_fixed) with ordinality as f(value,ord)
        join public.exam_question_pool p
          on p.question_id=f.value::uuid and p.exam_id=v_exam.id
        order by f.ord
      loop
        v_order:=v_order+1;
        insert into public.attempt_questions(
          attempt_id,question_id,question_order,chapter_id,chapter_name,topic_id,topic_name,clo_id,clo_code,
          content,correct_answer,explanation,options
        ) values(
          p_attempt_id,r.question_id,v_order,r.chapter_id,r.chapter_name,r.topic_id,r.topic_name,r.clo_id,r.clo_code,
          r.content,r.correct_answer,r.explanation,r.options
        );
      end loop;
    end if;

    for cell in select key,value from jsonb_each_text(v_matrix)
    loop
      v_kind:=split_part(cell.key,':',1);
      begin
        v_scope_id:=split_part(cell.key,':',2)::uuid;
        v_clo_id:=split_part(cell.key,':',3)::uuid;
        v_need:=greatest(0,cell.value::integer);
      exception when others then
        raise exception 'Blueprint bài kiểm tra không hợp lệ tại ô %',cell.key;
      end;

      if v_need=0 then continue; end if;
      if v_exam.structure_mode='topic_clo' and v_kind<>'t' then
        raise exception 'Blueprint không khớp chế độ Mục x CLO';
      end if;
      if v_exam.structure_mode='chapter_pool' and v_kind<>'c' then
        raise exception 'Blueprint không khớp chế độ Chương x CLO';
      end if;

      select count(*)::integer into v_fixed_count
      from public.attempt_questions aq
      where aq.attempt_id=p_attempt_id
        and aq.clo_id=v_clo_id
        and (
          (v_kind='t' and aq.topic_id=v_scope_id)
          or
          (v_kind='c' and aq.chapter_id=v_scope_id and aq.topic_id=any(v_exam.topic_ids))
        );

      if v_fixed_count>v_need then
        raise exception 'Số câu cố định vượt chỉ tiêu tại ô %',cell.key;
      end if;

      v_need:=v_need-v_fixed_count;
      if v_need=0 then continue; end if;
      v_added:=0;

      -- attempt_random and mixed_fixed_random prefer unseen questions for this student.
      for r in
        select p.*
        from public.exam_question_pool p
        where p.exam_id=v_exam.id
          and p.clo_id=v_clo_id
          and (
            (v_kind='t' and p.topic_id=v_scope_id)
            or
            (v_kind='c' and p.chapter_id=v_scope_id and p.topic_id=any(v_exam.topic_ids))
          )
          and not exists(
            select 1 from public.attempt_questions aq
            where aq.attempt_id=p_attempt_id and aq.question_id=p.question_id
          )
          and (
            v_exam.question_mode not in ('attempt_random','mixed_fixed_random')
            or not exists(
              select 1
              from public.exam_attempts ea2
              join public.attempt_questions aq2 on aq2.attempt_id=ea2.id
              where ea2.exam_id=v_exam.id
                and ea2.student_id=v_attempt.student_id
                and aq2.question_id=p.question_id
            )
          )
        order by random()
        limit v_need
      loop
        v_order:=v_order+1;
        v_added:=v_added+1;
        insert into public.attempt_questions(
          attempt_id,question_id,question_order,chapter_id,chapter_name,topic_id,topic_name,clo_id,clo_code,
          content,correct_answer,explanation,options
        ) values(
          p_attempt_id,r.question_id,v_order,r.chapter_id,r.chapter_name,r.topic_id,r.topic_name,r.clo_id,r.clo_code,
          r.content,r.correct_answer,r.explanation,r.options
        );
      end loop;

      -- If unseen questions are insufficient, permit previously seen questions but never duplicate inside this attempt.
      if v_added<v_need then
        for r in
          select p.*
          from public.exam_question_pool p
          where p.exam_id=v_exam.id
            and p.clo_id=v_clo_id
            and (
              (v_kind='t' and p.topic_id=v_scope_id)
              or
              (v_kind='c' and p.chapter_id=v_scope_id and p.topic_id=any(v_exam.topic_ids))
            )
            and not exists(
              select 1 from public.attempt_questions aq
              where aq.attempt_id=p_attempt_id and aq.question_id=p.question_id
            )
          order by random()
          limit (v_need-v_added)
        loop
          v_order:=v_order+1;
          v_added:=v_added+1;
          insert into public.attempt_questions(
            attempt_id,question_id,question_order,chapter_id,chapter_name,topic_id,topic_name,clo_id,clo_code,
            content,correct_answer,explanation,options
          ) values(
            p_attempt_id,r.question_id,v_order,r.chapter_id,r.chapter_name,r.topic_id,r.topic_name,r.clo_id,r.clo_code,
            r.content,r.correct_answer,r.explanation,r.options
          );
        end loop;
      end if;

      if v_added<v_need then
        raise exception 'Pool không đủ câu ngẫu nhiên cho ô %',cell.key;
      end if;
    end loop;
  end if;

  if (select count(*) from public.attempt_questions where attempt_id=p_attempt_id)<>v_exam.total_questions then
    raise exception 'Không rút đủ số câu cho lượt làm';
  end if;

  return (select count(*) from public.attempt_questions where attempt_id=p_attempt_id);
end;
$$;

grant execute on function public.populate_attempt_questions(uuid) to authenticated;

commit;

select 'ASSESSMENT_V12_6_MIXED_FIXED_RANDOM_OK' as trang_thai,
       count(*) filter(where question_mode='mixed_fixed_random') as bai_hon_hop
from public.exams;
