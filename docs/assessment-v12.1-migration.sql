-- AI-CLO PTITHCM V12.1
-- Stability migration: persist assessment blueprint and keep random draws faithful to V12 structure.
-- Run after docs/assessment-v12.0-migration.sql and supabase/v10.10-online-assessment-matrix.sql.

begin;

alter table public.exams
  add column if not exists structure_mode text not null default 'topic_clo';

alter table public.exams
  drop constraint if exists exams_structure_mode_check;
alter table public.exams
  add constraint exams_structure_mode_check
  check (structure_mode in ('topic_clo','chapter_pool'));

alter table public.exams
  add column if not exists question_blueprint jsonb not null default '{"version":1,"source":"legacy","matrix":{}}'::jsonb;

comment on column public.exams.structure_mode is
  'V12.1 assessment structure: topic_clo = Mục x CLO; chapter_pool = Chương x CLO over selected topic_ids.';
comment on column public.exams.question_blueprint is
  'Persisted V12 assessment blueprint. Expected shape: {version,source,matrix}, where matrix keys are t:<topic_uuid>:<clo_uuid> or c:<chapter_uuid>:<clo_uuid>.';

-- Backfill legacy/current exams conservatively from the frozen sample set.
-- This preserves the exact old behaviour (Mục x CLO). If a V12 browser still has
-- the original chapter_pool draft in localStorage, the V12.1 frontend can recover
-- and promote that client blueprint back to the server on the next open.
update public.exams e
set structure_mode='topic_clo',
    question_blueprint=jsonb_build_object(
      'version',1,
      'source','backfill-v12.1',
      'matrix',coalesce((
        select jsonb_object_agg(
          't:'||x.topic_id::text||':'||x.clo_id::text,
          x.need
        )
        from (
          select p.topic_id,p.clo_id,count(*)::integer as need
          from public.exam_questions eq
          join public.exam_question_pool p
            on p.exam_id=eq.exam_id and p.question_id=eq.question_id
          where eq.exam_id=e.id
            and p.topic_id is not null
            and p.clo_id is not null
          group by p.topic_id,p.clo_id
        ) x
      ),'{}'::jsonb)
    )
where coalesce(e.question_blueprint->'matrix','{}'::jsonb)='{}'::jsonb;

-- Do not replace the existing structure guard: later releases intentionally allow
-- changing some non-blueprint fields (for example max_attempts). Protect only the
-- new canonical blueprint once any attempt exists.
create or replace function public.guard_exam_blueprint_update()
returns trigger
language plpgsql
security definer
set search_path=public,pg_temp
as $$
begin
  if exists(select 1 from public.exam_attempts where exam_id=old.id limit 1)
     and (
       new.structure_mode is distinct from old.structure_mode
       or new.question_blueprint is distinct from old.question_blueprint
     ) then
    raise exception 'Bài kiểm tra đã có lượt làm; ma trận câu hỏi đã được khóa';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_guard_exam_blueprint on public.exams;
create trigger trg_guard_exam_blueprint
before update of structure_mode,question_blueprint on public.exams
for each row execute function public.guard_exam_blueprint_update();

-- V12.1: draw student_fixed/attempt_random from the persisted blueprint.
-- chapter_pool keeps Chapter x CLO fixed while allowing the selected topics inside
-- that chapter to vary randomly on each draw.
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

  -- Common fixed: copy the exact frozen sample set.
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

  -- Student fixed: attempts after the first one reuse that student's first set.
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

    -- Safety fallback for a legacy row that somehow has no persisted blueprint.
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

      v_added:=0;

      -- attempt_random first prefers questions not seen by this student before.
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
          and (
            v_exam.question_mode<>'attempt_random'
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

      -- If unseen questions are insufficient, allow older questions but never
      -- duplicate a question inside the current attempt.
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
        raise exception 'Pool không đủ % câu cho ô %',v_need,cell.key;
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

select
  'MIGRATION_V12_1_OK' as trang_thai,
  count(*) filter(where structure_mode='topic_clo') as bai_topic_clo,
  count(*) filter(where structure_mode='chapter_pool') as bai_chapter_pool,
  count(*) filter(where coalesce(question_blueprint->'matrix','{}'::jsonb)<>'{}'::jsonb) as bai_co_blueprint
from public.exams;
