-- AI-CLO PTITHCM V11.1
-- BƯỚC 1/5: SAO LƯU NỘI BỘ + KIỂM KÊ TRƯỚC KHI TÁCH NGÂN HÀNG CÂU HỎI
--
-- An toàn:
--   * Không sửa/xóa dữ liệu trong public.
--   * Không ghi đè nếu vùng backup đã tồn tại.
--   * Bản sao chỉ dành cho chủ sở hữu database; ứng dụng không được truy cập.
--   * Chạy riêng file này và lưu lại toàn bộ kết quả trước khi chạy bước 2.

begin;

do $$
begin
  if exists (
    select 1 from pg_namespace where nspname = 'backup_v111_20260903'
  ) then
    raise exception
      'DỪNG: schema backup_v111_20260903 đã tồn tại. Không ghi đè bản sao cũ.';
  end if;
end
$$;

create schema backup_v111_20260903;
comment on schema backup_v111_20260903 is
  'AI-CLO V11.1 snapshot trước khi tách ngân hàng câu hỏi; tạo ngày 2026-09-03.';

revoke all on schema backup_v111_20260903 from public;
revoke all on schema backup_v111_20260903 from anon;
revoke all on schema backup_v111_20260903 from authenticated;

create table backup_v111_20260903.manifest (
  source_schema text not null,
  source_table text not null primary key,
  backup_table text not null,
  row_count bigint not null,
  content_fingerprint text not null,
  backed_up_at timestamptz not null default now()
);

do $$
declare
  table_name text;
  copied_count bigint;
  copied_fingerprint text;
  tables_to_copy constant text[] := array[
    'subjects',
    'subject_members',
    'chapters',
    'topics',
    'clos',
    'questions',
    'question_options',
    'question_revisions',
    'question_edit_requests',
    'ai_generation_batches',
    'exams',
    'exam_chapters',
    'exam_clos',
    'exam_questions',
    'exam_question_pool',
    'exam_attempts',
    'attempt_questions',
    'final_exam_packages',
    'final_exam_history'
  ];
begin
  foreach table_name in array tables_to_copy loop
    if to_regclass(format('public.%I', table_name)) is null then
      continue;
    end if;

    -- CTAS giữ nguyên dữ liệu tại thời điểm snapshot nhưng không sao chép RLS,
    -- trigger hoặc khóa ngoại có thể tác động ngược tới dữ liệu đang chạy.
    execute format(
      'create table backup_v111_20260903.%I as table public.%I',
      table_name,
      table_name
    );

    -- Lớp bảo vệ thứ hai: CTAS không tự sao chép RLS. Bật RLS nhưng không tạo
    -- policy, nên anon/authenticated không thể đọc hoặc sửa dữ liệu backup.
    execute format(
      'alter table backup_v111_20260903.%I enable row level security',
      table_name
    );
    execute format(
      'alter table backup_v111_20260903.%I force row level security',
      table_name
    );

    execute format(
      'select count(*),
              md5(coalesce(string_agg(row_to_json(t)::text, ''''
                  order by row_to_json(t)::text), ''''))
         from backup_v111_20260903.%I t',
      table_name
    )
    into copied_count, copied_fingerprint;

    insert into backup_v111_20260903.manifest (
      source_schema,
      source_table,
      backup_table,
      row_count,
      content_fingerprint
    )
    values (
      'public',
      table_name,
      format('backup_v111_20260903.%I', table_name),
      copied_count,
      copied_fingerprint
    );
  end loop;
end
$$;

revoke all on all tables in schema backup_v111_20260903 from public;
revoke all on all tables in schema backup_v111_20260903 from anon;
revoke all on all tables in schema backup_v111_20260903 from authenticated;

-- Manifest cũng chỉ dành cho chủ sở hữu database/SQL Editor.
alter table backup_v111_20260903.manifest enable row level security;
alter table backup_v111_20260903.manifest force row level security;

-- Xác nhận ngay trong transaction rằng từng bảng nguồn vẫn giống bản sao.
do $$
declare
  item record;
  source_count bigint;
  source_fingerprint text;
begin
  for item in
    select * from backup_v111_20260903.manifest order by source_table
  loop
    execute format(
      'select count(*),
              md5(coalesce(string_agg(row_to_json(t)::text, ''''
                  order by row_to_json(t)::text), ''''))
         from public.%I t',
      item.source_table
    )
    into source_count, source_fingerprint;

    if source_count <> item.row_count
       or source_fingerprint is distinct from item.content_fingerprint then
      raise exception
        'DỪNG: bảng public.% không khớp bản sao (nguồn %, backup %).',
        item.source_table, source_count, item.row_count;
    end if;
  end loop;
end
$$;

commit;

-- ============================================================
-- KẾT QUẢ KIỂM KÊ: chụp lại hoặc sao chép toàn bộ các bảng dưới.
-- ============================================================

select
  source_table as bang,
  row_count as so_ban_ghi,
  content_fingerprint as dau_van_du_lieu,
  backed_up_at as thoi_diem_sao_luu
from backup_v111_20260903.manifest
order by source_table;

select
  count(*) as tong_cau_hoi,
  count(*) filter (where question_scope = 'practice') as cau_luyen_tap,
  count(*) filter (where question_scope = 'secure_exam') as cau_de_thi_bao_mat,
  count(*) filter (where question_scope = 'both') as cau_dung_chung,
  count(*) filter (where approval_status = 'approved') as cau_da_duyet,
  count(*) filter (where status = 'active') as cau_dang_hoat_dong
from public.questions;

select
  s.id as subject_id,
  s.name as hoc_phan,
  s.semester as hoc_ky,
  s.academic_year as nam_hoc,
  count(q.id) as so_cau,
  count(q.id) filter (where q.question_scope = 'secure_exam') as so_cau_bao_mat
from public.subjects s
left join public.questions q on q.subject_id = s.id
group by s.id, s.name, s.semester, s.academic_year
order by s.name, s.academic_year, s.semester;

with option_counts as (
  select q.id, count(o.id) as option_count
  from public.questions q
  left join public.question_options o on o.question_id = q.id
  group by q.id
)
select
  count(*) filter (where option_count = 4) as cau_du_4_phuong_an,
  count(*) filter (where option_count <> 4) as cau_khong_du_4_phuong_an
from option_counts;

select
  count(*) filter (where chapter_id is null) as cau_thieu_chuong,
  count(*) filter (where topic_id is null) as cau_thieu_chu_de,
  count(*) filter (where clo_id is null) as cau_thieu_clo,
  count(*) filter (where created_by is null) as cau_thieu_nguoi_tao
from public.questions;

select
  (select count(*) from public.exam_questions) as lien_ket_bai_kiem_tra,
  (select count(*) from public.exam_question_pool) as cau_trong_pool_dong_bang,
  (select count(*) from public.final_exam_packages) as ho_so_de_cuoi_ky;

-- Phải trả về 0 dòng. Có dòng nào thì chưa được chạy migration.
select q.id as question_id, q.subject_id, q.content
from public.questions q
left join public.subjects s on s.id = q.subject_id
where s.id is null;

select o.id as option_id, o.question_id
from public.question_options o
left join public.questions q on q.id = o.question_id
where q.id is null;

-- Dòng xác nhận cuối cùng.
select
  'BACKUP_OK' as trang_thai,
  'backup_v111_20260903' as schema_backup,
  now() as hoan_tat_luc;
