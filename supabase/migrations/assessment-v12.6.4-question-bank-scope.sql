-- AI-CLO PTITHCM V12.6.4 — shared question-bank scope for Assessment.
-- Run after V12.6.3 and the existing Assessment migrations. Safe to run again.
-- This migration keeps exams/final packages owned by subject_id, but validates
-- question sources through subjects.question_bank_id instead of legacy questions.subject_id.

begin;

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='subjects' and column_name='question_bank_id'
  ) then
    raise exception 'DỪNG: subjects.question_bank_id chưa tồn tại. Hãy hoàn tất migration V11.1 trước.';
  end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='questions' and column_name='question_bank_id'
  ) then
    raise exception 'DỪNG: questions.question_bank_id chưa tồn tại. Hãy hoàn tất migration V11.1 trước.';
  end if;
end
$$;

-- Atomic online-assessment design replacement.
create or replace function public.replace_exam_design(
  p_exam_id uuid,
  p_structure_mode text,
  p_blueprint jsonb,
  p_chapter_ids uuid[],
  p_topic_ids uuid[],
  p_clo_counts jsonb,
  p_total_questions integer,
  p_pool jsonb,
  p_selected jsonb
)
returns boolean
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_exam public.exams%rowtype;
  v_bank_id uuid;
  v_pool_count integer;
  v_selected_count integer;
  v_selected_distinct integer;
begin
  select * into v_exam from public.exams where id=p_exam_id for update;
  if not found then raise exception 'Không tìm thấy bài kiểm tra'; end if;

  if not public.is_admin() and not public.is_subject_teacher(v_exam.subject_id) then
    raise exception 'Không có quyền chỉnh cấu trúc bài kiểm tra';
  end if;
  if exists(select 1 from public.exam_attempts where exam_id=p_exam_id limit 1) then
    raise exception 'Bài kiểm tra đã có lượt làm; cấu trúc và bộ câu đã được khóa';
  end if;

  select s.question_bank_id into v_bank_id
  from public.subjects s
  where s.id=v_exam.subject_id;
  if v_bank_id is null then
    raise exception 'Học phần chưa được gán ngân hàng câu hỏi';
  end if;

  if p_structure_mode not in ('topic_clo','chapter_pool') then
    raise exception 'Chế độ cấu trúc không hợp lệ';
  end if;
  if coalesce(p_total_questions,0)<1 then raise exception 'Tổng số câu phải lớn hơn 0'; end if;
  if coalesce(jsonb_typeof(p_pool),'')<>'array' then raise exception 'Pool câu hỏi không hợp lệ'; end if;
  if coalesce(jsonb_typeof(p_selected),'')<>'array' then raise exception 'Bộ câu được chọn không hợp lệ'; end if;
  if coalesce(p_blueprint->'matrix','{}'::jsonb)='{}'::jsonb then raise exception 'Ma trận câu hỏi không được rỗng'; end if;

  select count(*) into v_pool_count from jsonb_array_elements(p_pool);
  select count(*),count(distinct value)
  into v_selected_count,v_selected_distinct
  from jsonb_array_elements_text(p_selected);

  if v_selected_count<>p_total_questions then raise exception 'Số câu được chọn không khớp tổng số câu'; end if;
  if v_selected_distinct<>p_total_questions then raise exception 'Bộ câu được chọn có câu trùng'; end if;
  if v_pool_count<p_total_questions then raise exception 'Pool câu hỏi nhỏ hơn bộ đề'; end if;

  -- V12.6.4: source ownership is the shared question bank, not the legacy subject_id on questions.
  if exists(
    select 1
    from jsonb_array_elements(p_pool) x
    left join public.questions q on q.id=(x->>'question_id')::uuid
    where q.id is null
       or q.question_bank_id is distinct from v_bank_id
       or q.status<>'active'
       or coalesce(q.approval_status,'')<>'approved'
       or coalesce(q.question_scope,'practice') not in ('practice','both')
  ) then
    raise exception 'Pool bài trực tuyến chỉ được dùng câu đã duyệt từ Ngân hàng luyện tập - kiểm tra của học phần';
  end if;

  delete from public.exam_questions where exam_id=p_exam_id;
  delete from public.exam_question_pool where exam_id=p_exam_id;
  delete from public.exam_chapters where exam_id=p_exam_id;
  delete from public.exam_clos where exam_id=p_exam_id;

  insert into public.exam_question_pool(
    exam_id,question_id,chapter_id,chapter_name,topic_id,topic_name,clo_id,clo_code,
    content,correct_answer,explanation,options
  )
  select p_exam_id,
         (x->>'question_id')::uuid,
         nullif(x->>'chapter_id','')::uuid,
         nullif(x->>'chapter_name',''),
         nullif(x->>'topic_id','')::uuid,
         nullif(x->>'topic_name',''),
         nullif(x->>'clo_id','')::uuid,
         nullif(x->>'clo_code',''),
         x->>'content',
         upper(x->>'correct_answer')::character(1),
         nullif(x->>'explanation',''),
         coalesce(x->'options','[]'::jsonb)
  from jsonb_array_elements(p_pool) x;

  if exists(
    select 1 from jsonb_array_elements_text(p_selected) s(value)
    where not exists(
      select 1 from public.exam_question_pool p
      where p.exam_id=p_exam_id and p.question_id=s.value::uuid
    )
  ) then
    raise exception 'Có câu được chọn không nằm trong pool đóng băng';
  end if;

  insert into public.exam_questions(exam_id,question_id,question_order)
  select p_exam_id,value::uuid,ord::integer
  from jsonb_array_elements_text(p_selected) with ordinality s(value,ord);

  insert into public.exam_chapters(exam_id,chapter_id,question_count)
  select p_exam_id,p.chapter_id,count(*)::integer
  from public.exam_questions eq
  join public.exam_question_pool p on p.exam_id=eq.exam_id and p.question_id=eq.question_id
  where eq.exam_id=p_exam_id and p.chapter_id is not null
  group by p.chapter_id;

  insert into public.exam_clos(exam_id,clo_id,weight)
  select p_exam_id,p.clo_id,count(*)*100.0/p_total_questions
  from public.exam_questions eq
  join public.exam_question_pool p on p.exam_id=eq.exam_id and p.question_id=eq.question_id
  where eq.exam_id=p_exam_id and p.clo_id is not null
  group by p.clo_id;

  update public.exams
  set structure_mode=p_structure_mode,
      question_blueprint=coalesce(p_blueprint,'{}'::jsonb),
      chapter_ids=coalesce(p_chapter_ids,'{}'::uuid[]),
      topic_ids=coalesce(p_topic_ids,'{}'::uuid[]),
      clo_counts=coalesce(p_clo_counts,'{}'::jsonb),
      total_questions=p_total_questions
  where id=p_exam_id;

  return true;
end;
$$;

grant execute on function public.replace_exam_design(uuid,text,jsonb,uuid[],uuid[],jsonb,integer,jsonb,jsonb) to authenticated;

-- Final-exam package save contract with the same shared-bank boundary.
create or replace function public.save_final_exam_package(
  p_package_id uuid,
  p_subject_id uuid,
  p_title text,
  p_metadata jsonb,
  p_matrix jsonb,
  p_selected_questions jsonb,
  p_variants jsonb,
  p_status text default 'draft'
)
returns public.final_exam_packages
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_row public.final_exam_packages%rowtype;
  v_title text;
  v_bank_id uuid;
begin
  if auth.uid() is null then raise exception 'Bạn chưa đăng nhập'; end if;
  if p_subject_id is null then raise exception 'Thiếu học phần'; end if;
  if not public.is_admin() and not public.is_subject_teacher(p_subject_id) then
    raise exception 'Không có quyền chỉnh hồ sơ đề thi cuối kỳ';
  end if;

  select s.question_bank_id into v_bank_id
  from public.subjects s
  where s.id=p_subject_id;
  if v_bank_id is null then raise exception 'Học phần chưa được gán ngân hàng câu hỏi'; end if;

  v_title:=nullif(trim(coalesce(p_title,'')),'');
  if v_title is null then raise exception 'Cần nhập tên hồ sơ đề thi'; end if;
  if p_status not in ('draft','reviewing','generated','archived') then
    raise exception 'Trạng thái hồ sơ đề thi không hợp lệ';
  end if;
  if coalesce(jsonb_typeof(p_matrix),'')<>'array' then raise exception 'Ma trận đề thi không hợp lệ'; end if;
  if coalesce(jsonb_typeof(p_selected_questions),'')<>'array' then raise exception 'Danh sách câu đã chọn không hợp lệ'; end if;
  if coalesce(jsonb_typeof(p_variants),'')<>'array' then raise exception 'Danh sách mã đề đã sinh không hợp lệ'; end if;

  if exists(
    select 1
    from jsonb_array_elements(p_selected_questions) x
    left join public.questions q on q.id=(x->>'question_id')::uuid
    where q.id is null
       or q.question_bank_id is distinct from v_bank_id
       or q.status<>'active'
       or coalesce(q.approval_status,'')<>'approved'
       or coalesce(q.question_scope,'') not in ('secure_exam','both')
  ) then
    raise exception 'Hồ sơ đề cuối kỳ chỉ được dùng câu đã duyệt từ Ngân hàng đề thi - bảo mật của học phần';
  end if;

  if p_status='generated' then
    if jsonb_array_length(p_selected_questions)=0 then raise exception 'Không thể sinh đề khi chưa có bộ câu'; end if;
    if jsonb_array_length(p_variants)<>jsonb_array_length(coalesce(p_metadata->'variant_codes','[]'::jsonb)) then
      raise exception 'Số phiên bản đã sinh không khớp danh sách mã đề';
    end if;
  end if;

  if p_package_id is null then
    insert into public.final_exam_packages(
      subject_id,title,metadata,matrix,source_scope,selected_questions,variants,status,
      created_by,created_at,updated_at
    )
    values(
      p_subject_id,v_title,coalesce(p_metadata,'{}'::jsonb),coalesce(p_matrix,'[]'::jsonb),
      'secure_exam',coalesce(p_selected_questions,'[]'::jsonb),coalesce(p_variants,'[]'::jsonb),
      p_status,auth.uid(),now(),now()
    ) returning * into v_row;
  else
    select * into v_row from public.final_exam_packages where id=p_package_id for update;
    if not found then raise exception 'Không tìm thấy hồ sơ đề thi'; end if;
    if v_row.subject_id<>p_subject_id then raise exception 'Hồ sơ đề thi không thuộc học phần hiện tại'; end if;
    if not public.is_admin() and v_row.created_by<>auth.uid() then
      raise exception 'Chỉ người tạo hoặc Admin được chỉnh hồ sơ đề thi';
    end if;

    update public.final_exam_packages
    set title=v_title,
        metadata=coalesce(p_metadata,'{}'::jsonb),
        matrix=coalesce(p_matrix,'[]'::jsonb),
        source_scope='secure_exam',
        selected_questions=coalesce(p_selected_questions,'[]'::jsonb),
        variants=coalesce(p_variants,'[]'::jsonb),
        status=p_status,
        updated_at=now()
    where id=p_package_id
    returning * into v_row;
  end if;

  return v_row;
end;
$$;

grant execute on function public.save_final_exam_package(uuid,uuid,text,jsonb,jsonb,jsonb,jsonb,text) to authenticated;

create or replace function public.assessment_shared_bank_scope_version()
returns text
language sql
stable
security definer
set search_path=public,pg_temp
as $$ select '12.6.4'::text $$;
revoke all on function public.assessment_shared_bank_scope_version() from public,anon;
grant execute on function public.assessment_shared_bank_scope_version() to authenticated;

commit;

select
  'ASSESSMENT_V12.6.4_OK' as trang_thai,
  count(*) filter(where question_bank_id is null) as hoc_phan_chua_co_ngan_hang
from public.subjects;
