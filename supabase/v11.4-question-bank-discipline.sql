-- AI-CLO PTITHCM V11.4
-- Phân nhóm ngân hàng câu hỏi theo lĩnh vực môn học.

begin;

do $$
begin
 if to_regclass('public.question_banks') is null then
  raise exception 'DỪNG: chưa có bảng question_banks. Hãy hoàn tất V11.1 trước.';
 end if;
end
$$;

alter table public.question_banks
 add column if not exists discipline_group text not null default 'other';

alter table public.question_banks
 drop constraint if exists question_banks_discipline_group_check;
alter table public.question_banks
 add constraint question_banks_discipline_group_check
 check(discipline_group in ('math','physics','philosophy','other'));

-- Chỉ tự phân loại các bản ghi chưa được phân nhóm.
update public.question_banks
set discipline_group=case
 when lower(name) like any(array['%giải tích%','%giai tich%','%đại số%','%dai so%','%toán%','%toan%','%xác suất%','%xac suat%']) then 'math'
 when lower(name) like any(array['%vật lý%','%vat ly%','%vật lí%','%vat li%']) then 'physics'
 when lower(name) like any(array['%triết%','%triet%']) then 'philosophy'
 else 'other'
end
where discipline_group='other';

create index if not exists question_banks_discipline_idx
 on public.question_banks(discipline_group,name);

comment on column public.question_banks.discipline_group is
 'math: Toán; physics: Vật lý; philosophy: Triết học; other: Khác.';

commit;

select
 'MIGRATION_V11_4_OK' as trang_thai,
 discipline_group as nhom_mon,
 count(*) as so_ngan_hang
from public.question_banks
group by discipline_group
order by discipline_group;
