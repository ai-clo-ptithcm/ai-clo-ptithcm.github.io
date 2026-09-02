-- AI-CLO PTITHCM V11: giới hạn dò trùng theo Chủ đề/Chương.
-- Chạy một lần trong Supabase SQL Editor.

create or replace function public.find_similar_questions_scoped(
 p_subject_id uuid,
 p_chapter_id uuid,
 p_topic_id uuid,
 p_content text,
 p_exclude_id uuid default null,
 p_limit integer default 5
) returns table(
 id uuid, code text, content text, similarity_score real,
 question_scope text, approval_status text, chapter_id uuid, topic_id uuid
) language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if not public.is_admin() and not public.is_subject_teacher(p_subject_id) then
  raise exception 'Bạn không có quyền kiểm tra ngân hàng này';
 end if;
 return query
 select q.id,'Q-'||upper(left(replace(q.id::text,'-',''),6)),q.content,
   similarity(public.normalize_question_text(q.content),public.normalize_question_text(p_content))::real,
   q.question_scope,q.approval_status,q.chapter_id,q.topic_id
 from public.questions q
 where q.subject_id=p_subject_id
   and q.chapter_id=p_chapter_id
   and (p_topic_id is null or q.topic_id=p_topic_id)
   and (p_exclude_id is null or q.id<>p_exclude_id)
   and coalesce(q.approval_status,'')<>'archived'
   and similarity(public.normalize_question_text(q.content),public.normalize_question_text(p_content))>=0.45
 order by 4 desc limit greatest(1,least(coalesce(p_limit,5),20));
end$$;

revoke all on function public.find_similar_questions_scoped(uuid,uuid,uuid,text,uuid,integer) from public,anon;
grant execute on function public.find_similar_questions_scoped(uuid,uuid,uuid,text,uuid,integer) to authenticated;
