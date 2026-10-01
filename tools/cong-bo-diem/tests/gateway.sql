
do $test$
declare a uuid; created jsonb; gid uuid; tok text; p jsonb; out jsonb; denied boolean; i int;
begin
 begin
  select id into a from profiles where role='admin' and is_active and locked_at is null limit 1;
  if a is null then raise exception 'No active admin available for authorization test'; end if;
  if has_function_privilege('anon','public.grade_gateway(text,jsonb,uuid)','EXECUTE') or
   has_function_privilege('authenticated','public.grade_gateway(text,jsonb,uuid)','EXECUTE') then raise exception 'Gateway exposed'; end if;
  if has_table_privilege('anon','public.grade_publications','SELECT') or has_table_privilege('authenticated','public.grade_publications','SELECT') then raise exception 'Table exposed'; end if;
  if (select public from storage.buckets where id='grade-publications') then raise exception 'Bucket public'; end if;
  perform grade_gateway('set_code','{"code":"9012"}',a);
  denied:=false;
  begin perform grade_gateway('create','{"title":"TEST","teacher":"TEST","class_name":"TEST","code":"1111","password":"test-password"}');
  exception when others then denied:=true; end;
  if not denied then raise exception 'Wrong shared code accepted'; end if;
  created:=grade_gateway('create','{"title":"TEST","teacher":"TEST","class_name":"TEST","code":"9012","password":"test-password"}');
  gid:=(created->>'id')::uuid;tok:=created->>'token';
  denied:=false;
  begin perform grade_gateway('read',jsonb_build_object('id',gid));
  exception when others then denied:=true;end;
  if not denied then raise exception 'Private editor exposed'; end if;
  denied:=false;
  begin perform grade_gateway('meta',jsonb_build_object('id',gid));
  exception when others then denied:=true;end;
  if not denied then raise exception 'Draft metadata exposed';end if;
  out:=grade_gateway('read',jsonb_build_object('id',gid,'token',tok));
  if out ? 'password_hash' then raise exception 'Password hash exposed';end if;
  p:=jsonb_build_object('id',gid,'token',tok,'revision',1,'title','TEST','teacher','TEST','class_name','TEST','semester','',
   'note','Test note','source','paste','published',true,'columns','["MSSV","Điểm","Ngày sinh"]'::jsonb,'rows','[["001","8","01/02/2000"]]'::jsonb,
   'visible_columns','[1]'::jsonb,'verification','[{"type":"mssv","column":0,"label":"MSSV"}]'::jsonb);
  perform grade_gateway('save',p);
  out:=grade_gateway('meta',jsonb_build_object('id',gid));
  if out ? 'rows' or out ? 'password_hash' then raise exception 'Metadata leakage';end if;
  denied:=false;
  begin perform grade_gateway('save',p);
  exception when others then denied:=true;end;
  if not denied then raise exception 'Stale revision accepted';end if;
  
  out:=grade_gateway('lookup',jsonb_build_object('id',gid,'values','["001"]'::jsonb));
  if out->'fields'->0->>'value'<>'8' or out ? 'rows' or jsonb_array_length(out->'fields')<>1 then raise exception 'Lookup did not return only selected field';end if;
  denied:=false;
  begin perform grade_gateway('lookup',jsonb_build_object('id',gid,'values','["002"]'::jsonb));
  exception when others then denied:=true;end;
  if not denied then raise exception 'Incorrect student identity accepted';end if;
  if grade_normalize('01/02/2000','dob')<>'2000-02-01' or grade_normalize('31/02/2000','dob')<>'' or
   grade_normalize('+84 912 345 678','phone')<>'0912345678' or grade_normalize('001','mssv')<>'001' then raise exception 'SQL normalization failed';end if;
  p:=p||'{"revision":2,"rows":[["001","9","01/02/2000"]]}'::jsonb;
  perform grade_gateway('save',p);
  perform grade_gateway('restore',jsonb_build_object('id',gid,'token',tok));
  out:=grade_gateway('read',jsonb_build_object('id',gid,'token',tok));
  if out->'rows'->0->>1<>'8' or (out->>'published')::boolean then raise exception 'Restore failed';end if;
  perform grade_gateway('reset_password',jsonb_build_object('id',gid,'password','new-test-password'),a);
  denied:=false;
  begin perform grade_gateway('read',jsonb_build_object('id',gid,'token',tok));
  exception when others then denied:=true;end;
  if not denied then raise exception 'Reset left old session alive';end if;
  perform grade_gateway('unlock',jsonb_build_object('id',gid,'password','new-test-password'));
  for i in 1..3 loop
   out:=grade_gateway('rate','{"key":"grade-test-transaction","limit":2}');
  end loop;
  if (out->>'allowed')::boolean then raise exception 'Rate limit failed';end if;
  update grade_publications set source='google',published=true,sync_attempt_at=null where id=gid;
  out:=grade_gateway('sync_claim',jsonb_build_object('id',gid));
  if not (out->>'claimed')::boolean then raise exception 'Sync claim failed';end if;
  if (grade_gateway('sync_claim',jsonb_build_object('id',gid))->>'claimed')::boolean then raise exception 'Concurrent sync claimed';end if;
  perform grade_gateway('sync_done',jsonb_build_object('id',gid,'lease',out->>'lease','error','test'));
  if (grade_gateway('sync_claim',jsonb_build_object('id',gid))->>'claimed')::boolean then raise exception 'Cache interval failed';end if;
  denied:=false;
  begin perform grade_gateway('delete',jsonb_build_object('id',gid));
  exception when others then denied:=true;end;
  if not denied then raise exception 'Anonymous deletion accepted';end if;
  perform grade_gateway('delete',jsonb_build_object('id',gid),a);
  if exists(select 1 from grade_publications where id=gid) then raise exception 'Admin delete failed';end if;
  raise exception using errcode='P0002',message='GRADE_TEST_ROLLBACK';
 exception when no_data_found then
  if sqlerrm<>'GRADE_TEST_ROLLBACK' then raise;end if;
 end;
end
$test$;
select 'passed' as status, 'private grants, shared code, password session, drafts, hash exclusion, revision conflict, restore, reset revocation, limits, sync lease/cache, admin deletion; all test writes rolled back' as checks;
