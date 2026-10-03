-- Run with Supabase SQL/management role. ALL fixture changes roll back.
begin;
set local role service_role;
do $$
declare a uuid;teacher uuid;mid uuid;rid uuid;v jsonb;claim jsonb;tok text;rec jsonb;expected boolean;
begin
 select id into a from public.profiles where role='admin' and is_active and locked_at is null limit 1;
 select id into teacher from public.profiles where role='teacher' and is_active and locked_at is null limit 1;
 assert a is not null;
 assert not has_table_privilege('anon','public.kpi_records','select');
 assert not has_table_privilege('authenticated','public.kpi_settings','select');
 assert not has_function_privilege('authenticated','public.kpi_gateway(text,jsonb,uuid)','execute');
 assert (public.kpi_gateway('view','{"token":"invalid"}',null)->>'status')::int=401;
 expected:=false;begin perform public.kpi_gateway('load','{}',null);exception when insufficient_privilege then expected:=true;end;assert expected;
 v:=public.kpi_gateway('metric','{"code":"TEST_KPI_ROLLBACK","name":"Test only","method":"sum","visible":true}',a);mid:=(v->>'id')::uuid;
 perform public.kpi_gateway('pin','{"code":"0012"}',a);v:=public.kpi_gateway('unlock','{"code":"0012","client":"test"}',null);tok:=v->>'token';assert length(tok)=64;
 v:=public.kpi_gateway('load','{}',a);assert v->>'current_code'='0012';assert not(v->'settings'?'pin_code');
 claim:=public.kpi_gateway('sync_claim','{"force":true}',a);assert (claim->>'claimed')::bool;
 rec:=jsonb_build_object('source_key','TEST_ROLLBACK','source_hash','v1','year',2026,'month',1,'code','TEST_KPI_ROLLBACK','effective',jsonb_build_object('title','From Form','quantity',1,'dedup_key','doi-1'));
 v:=public.kpi_gateway('sync_done',jsonb_build_object('lease',claim->>'lease','records',jsonb_build_array(rec)),a);assert (v->>'changed')::int=1;
 select id into rid from public.kpi_records where source_key='TEST_ROLLBACK';
 v:=public.kpi_gateway('view',jsonb_build_object('year',2026,'token',tok),null);assert not exists(select 1 from jsonb_array_elements(v->'records') x where x->>'id'=rid::text);
 perform public.kpi_gateway('record',jsonb_build_object('id',rid,'version',1,'metric_id',mid,'year',2026,'month',1,'status','approved','effective',jsonb_build_object('title','Manager edited','quantity',2,'dedup_key','doi-1')),a);
 v:=public.kpi_gateway('view',jsonb_build_object('year',2026,'token',tok),null);assert exists(select 1 from jsonb_array_elements(v->'records') x where x->>'id'=rid::text);assert not(v->'settings'?'sheet_id');assert v->'audit'='[]'::jsonb;assert v->'current_code'='null'::jsonb;assert not(v->'settings'?'pin_code');
 expected:=false;begin perform public.kpi_gateway('record',jsonb_build_object('metric_id',mid,'year',2026,'month',1,'status','approved','effective',jsonb_build_object('title','Duplicate','dedup_key','DOI-1')),a);exception when raise_exception then expected:=true;end;assert expected;
 claim:=public.kpi_gateway('sync_claim','{"force":true}',a);rec:=jsonb_set(rec,'{source_hash}','"v2"');perform public.kpi_gateway('sync_done',jsonb_build_object('lease',claim->>'lease','records',jsonb_build_array(rec)),a);
 assert (select effective->>'title'='Manager edited' and status='pending' and source_changed and version=3 from public.kpi_records where id=rid);
 claim:=public.kpi_gateway('sync_claim','{"force":true}',a);v:=public.kpi_gateway('sync_done',jsonb_build_object('lease',claim->>'lease','records',jsonb_build_array(rec)),a);assert (v->>'changed')::int=0;
 perform public.kpi_gateway('month',jsonb_build_object('metric_id',mid,'year',2026,'month',1,'value',0,'reason','Confirmed zero'),a);
 assert (select value=0 from public.kpi_months where metric_id=mid and year=2026 and month=1);
 perform public.kpi_gateway('plan',jsonb_build_object('metric_id',mid,'year',2026,'active',false),a);
 v:=public.kpi_gateway('view',jsonb_build_object('year',2026,'token',tok),null);assert not exists(select 1 from jsonb_array_elements(v->'metrics') x where x->>'id'=mid::text);
 if teacher is not null then
  expected:=false;begin perform public.kpi_gateway('load','{}',teacher);exception when insufficient_privilege then expected:=true;end;assert expected;
  perform public.kpi_gateway('delegate',jsonb_build_object('user_id',teacher,'enabled',true),a);v:=public.kpi_gateway('load','{}',teacher);assert v->'owner'='false'::jsonb;assert v->'current_code'='null'::jsonb;
  expected:=false;begin perform public.kpi_gateway('delegate',jsonb_build_object('user_id',teacher,'enabled',true),teacher);exception when insufficient_privilege then expected:=true;end;assert expected;
  perform public.kpi_gateway('pin','{"code":"9876"}',teacher);
  perform public.kpi_gateway('delegate',jsonb_build_object('user_id',teacher,'enabled',false),a);
 end if;
 v:=public.kpi_gateway('view',jsonb_build_object('token',tok),null);assert (v->>'status')::int=401;
end $$;
rollback;
