create or replace function public.grade_check_creation_code(p_code text)
returns boolean language plpgsql security invoker
set search_path=public,extensions,pg_temp as $$
declare code_hash text;
begin
 if coalesce(p_code,'') !~ '^[0-9]{4}$' then return false; end if;
 select creation_code_hash into code_hash from public.grade_settings where id;
 if code_hash is null then raise exception 'Admin chưa thiết lập mã tạo công bố'; end if;
 return crypt(p_code,code_hash)=code_hash;
end $$;
revoke all on function public.grade_check_creation_code(text) from public,anon,authenticated;
grant execute on function public.grade_check_creation_code(text) to service_role;

