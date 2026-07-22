-- =========================================================
-- 日次(当日)の目標稼働人員数への対応
-- 前提: 001〜012 実行済み
-- =========================================================
--
-- shift_templates.target_headcount は「デフォルト目標人数」として残し、
-- 日毎の個別設定(daily_staffing_targets)があればそちらを優先する。

-- ---------------------------------------------------------
-- 1. daily_staffing_targets: 日付×シフト時間帯ごとの目標人数
-- ---------------------------------------------------------
create table daily_staffing_targets (
  id                 uuid primary key default gen_random_uuid(),
  hotel_id           uuid not null references hotels (id) on delete cascade,
  shift_template_id  uuid not null references shift_templates (id) on delete cascade,
  work_date          date not null,
  target_headcount   int not null default 0,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (shift_template_id, work_date),
  check (target_headcount >= 0)
);

create trigger trg_daily_staffing_targets_updated_at
  before update on daily_staffing_targets
  for each row execute function set_updated_at();

create index idx_daily_staffing_targets_hotel_date
  on daily_staffing_targets (hotel_id, work_date);

-- hotel_idはshift_template_idから自動的に補完する(整合性の不一致を防ぐため、
-- クライアントから送られてきた値は無視して常にDB側で導出する)
create or replace function set_daily_staffing_target_hotel_id()
returns trigger
language plpgsql
as $$
begin
  select hotel_id into new.hotel_id
  from shift_templates
  where id = new.shift_template_id;

  if new.hotel_id is null then
    raise exception '対象のシフト時間帯が見つかりません';
  end if;

  return new;
end;
$$;

create trigger trg_daily_staffing_targets_set_hotel
  before insert or update on daily_staffing_targets
  for each row execute function set_daily_staffing_target_hotel_id();

-- RLS: 閲覧はホテルに関係する全員、登録・編集・削除はsuper_admin/managerのみ
-- (現場のチェックアウト状況等で日々調整する運用のため、managerにも権限を与える)
alter table daily_staffing_targets enable row level security;

create policy daily_staffing_targets_select_admin on daily_staffing_targets
  for select using (auth_role() = 'super_admin');

create policy daily_staffing_targets_select_assigned on daily_staffing_targets
  for select using (hotel_id in (select auth_hotel_ids()));

create policy daily_staffing_targets_insert_admin on daily_staffing_targets
  for insert with check (auth_role() = 'super_admin');

create policy daily_staffing_targets_insert_manager on daily_staffing_targets
  for insert with check (
    auth_role() = 'manager' and hotel_id in (select auth_hotel_ids())
  );

create policy daily_staffing_targets_update_admin on daily_staffing_targets
  for update using (auth_role() = 'super_admin');

create policy daily_staffing_targets_update_manager on daily_staffing_targets
  for update using (
    auth_role() = 'manager' and hotel_id in (select auth_hotel_ids())
  );

create policy daily_staffing_targets_delete_admin on daily_staffing_targets
  for delete using (auth_role() = 'super_admin');

create policy daily_staffing_targets_delete_manager on daily_staffing_targets
  for delete using (
    auth_role() = 'manager' and hotel_id in (select auth_hotel_ids())
  );

-- ---------------------------------------------------------
-- 2. get_shift_template_staffing を「日次オーバーライド優先」に修正
--    (/shifts/calendar の月次一覧で使用)
-- ---------------------------------------------------------
create or replace function get_shift_template_staffing(
  p_hotel_id uuid,
  p_year_month text
)
returns table (
  shift_template_id uuid,
  label text,
  start_time time,
  end_time time,
  target_headcount int,
  work_date date,
  approved_count bigint,
  diff int
)
language sql
security invoker
stable
as $$
  select
    st.id as shift_template_id,
    st.label,
    st.start_time,
    st.end_time,
    coalesce(dst.target_headcount, st.target_headcount) as target_headcount,
    d.work_date,
    coalesce(cnt.approved_count, 0) as approved_count,
    (coalesce(cnt.approved_count, 0) - coalesce(dst.target_headcount, st.target_headcount))::int as diff
  from shift_templates st
  cross join lateral (
    select generate_series(
      (p_year_month || '-01')::date,
      ((p_year_month || '-01')::date + interval '1 month' - interval '1 day')::date,
      interval '1 day'
    )::date as work_date
  ) d
  left join daily_staffing_targets dst
    on dst.shift_template_id = st.id and dst.work_date = d.work_date
  left join lateral (
    select count(*) as approved_count
    from shifts s
    where s.shift_template_id = st.id
      and s.work_date = d.work_date
      and s.status = 'approved'
  ) cnt on true
  where st.hotel_id = p_hotel_id
  order by d.work_date, st.sort_order;
$$;

grant execute on function get_shift_template_staffing(uuid, text) to authenticated;

-- ---------------------------------------------------------
-- 3. get_daily_staffing: 特定の1日分の目標人数・承認済み人数・差分
--    (新設する「当日シフト状況」画面で使用)
-- ---------------------------------------------------------
create or replace function get_daily_staffing(
  p_hotel_id uuid,
  p_work_date date
)
returns table (
  shift_template_id uuid,
  label text,
  start_time time,
  end_time time,
  default_headcount int,
  target_headcount int,
  approved_count bigint,
  diff int
)
language sql
security invoker
stable
as $$
  select
    st.id as shift_template_id,
    st.label,
    st.start_time,
    st.end_time,
    st.target_headcount as default_headcount,
    coalesce(dst.target_headcount, st.target_headcount) as target_headcount,
    coalesce(cnt.approved_count, 0) as approved_count,
    (coalesce(cnt.approved_count, 0) - coalesce(dst.target_headcount, st.target_headcount))::int as diff
  from shift_templates st
  left join daily_staffing_targets dst
    on dst.shift_template_id = st.id and dst.work_date = p_work_date
  left join lateral (
    select count(*) as approved_count
    from shifts s
    where s.shift_template_id = st.id
      and s.work_date = p_work_date
      and s.status = 'approved'
  ) cnt on true
  where st.hotel_id = p_hotel_id
  order by st.sort_order;
$$;

grant execute on function get_daily_staffing(uuid, date) to authenticated;
