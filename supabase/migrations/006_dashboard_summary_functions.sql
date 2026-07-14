-- =========================================================
-- 売上・目標管理ダッシュボード用の集計関数
-- 前提: 001〜005 実行済み
-- =========================================================

-- ---------------------------------------------------------
-- 0. monthly_targets のユニーク制約修正
--    unique(hotel_id, year_month) は、hotel_id が null の場合
--    (全社目標)に「null同士は等しくない」というSQLの仕様により
--    同一年月で複数の全社目標が登録できてしまう欠陥があったため修正する。
--    generated column で hotel_id の null を固定UUIDに正規化してから
--    ユニーク制約をかける。
-- ---------------------------------------------------------
alter table monthly_targets
  drop constraint if exists monthly_targets_hotel_id_year_month_key;

alter table monthly_targets
  add column if not exists hotel_key uuid
  generated always as (coalesce(hotel_id, '00000000-0000-0000-0000-000000000000'::uuid)) stored;

alter table monthly_targets
  add constraint monthly_targets_hotel_key_year_month_key unique (hotel_key, year_month);

-- ---------------------------------------------------------
-- 1. ホテル単位の月次サマリー
--    売上 = (担当客室総数 × 客室単価) - 人件費 +/- 調整金
--    人件費 = 時給スタッフの承認済みシフト実働分 + 月給スタッフ(このホテル所属分)の月給
-- ---------------------------------------------------------
create or replace function get_hotel_monthly_summary(
  p_hotel_id uuid,
  p_year_month text
)
returns table (
  total_rooms bigint,
  gross_sales numeric,
  hourly_labor_cost numeric,
  monthly_labor_cost numeric,
  adjustment_total numeric,
  net_sales numeric,
  target_rooms int,
  target_sales numeric
)
language plpgsql
security invoker
stable
as $$
declare
  v_first_day date := (p_year_month || '-01')::date;
  v_last_day date := (v_first_day + interval '1 month' - interval '1 day')::date;
  v_total_rooms bigint := 0;
  v_gross_sales numeric := 0;
  v_hourly_labor numeric := 0;
  v_monthly_labor numeric := 0;
  v_adjustment numeric := 0;
  v_target_rooms int := 0;
  v_target_sales numeric := 0;
begin
  select coalesce(sum(dr.adjustment_amount), 0)
  into v_adjustment
  from daily_reports dr
  where dr.hotel_id = p_hotel_id
    and dr.report_date between v_first_day and v_last_day;

  select coalesce(sum(drd.completed_count), 0),
         coalesce(sum(drd.completed_count * hrp.unit_price), 0)
  into v_total_rooms, v_gross_sales
  from daily_reports dr
  join daily_report_details drd on drd.daily_report_id = dr.id
  join hotel_room_prices hrp on hrp.hotel_id = dr.hotel_id and hrp.room_type_id = drd.room_type_id
  where dr.hotel_id = p_hotel_id
    and dr.report_date between v_first_day and v_last_day;

  select coalesce(sum(
    extract(epoch from (s.end_time - s.start_time)) / 3600.0 * p.salary_amount
  ), 0)
  into v_hourly_labor
  from shifts s
  join profiles p on p.id = s.staff_id
  where s.hotel_id = p_hotel_id
    and s.work_date between v_first_day and v_last_day
    and s.status = 'approved'
    and p.salary_type = 'hourly';

  select coalesce(sum(p.salary_amount), 0)
  into v_monthly_labor
  from profiles p
  where p.primary_hotel_id = p_hotel_id
    and p.salary_type = 'monthly'
    and p.is_active = true;

  select coalesce(mt.target_rooms, 0), coalesce(mt.target_sales, 0)
  into v_target_rooms, v_target_sales
  from monthly_targets mt
  where mt.hotel_id = p_hotel_id and mt.year_month = p_year_month;

  return query select
    v_total_rooms,
    v_gross_sales,
    v_hourly_labor,
    v_monthly_labor,
    v_adjustment,
    (v_gross_sales - v_hourly_labor - v_monthly_labor + v_adjustment),
    v_target_rooms,
    v_target_sales;
end;
$$;

grant execute on function get_hotel_monthly_summary(uuid, text) to authenticated;

-- ---------------------------------------------------------
-- 2. 全社(全ホテル合算)の月次サマリー
--    月給人件費は「全社の月次集計時のみ全額差し引く」という仕様どおり、
--    ここでは全ホテル分の月給スタッフを合算する。
-- ---------------------------------------------------------
create or replace function get_overall_monthly_summary(
  p_year_month text
)
returns table (
  total_rooms bigint,
  gross_sales numeric,
  hourly_labor_cost numeric,
  monthly_labor_cost numeric,
  adjustment_total numeric,
  net_sales numeric,
  target_rooms int,
  target_sales numeric
)
language plpgsql
security invoker
stable
as $$
declare
  v_first_day date := (p_year_month || '-01')::date;
  v_last_day date := (v_first_day + interval '1 month' - interval '1 day')::date;
  v_total_rooms bigint := 0;
  v_gross_sales numeric := 0;
  v_hourly_labor numeric := 0;
  v_monthly_labor numeric := 0;
  v_adjustment numeric := 0;
  v_target_rooms int := 0;
  v_target_sales numeric := 0;
begin
  select coalesce(sum(dr.adjustment_amount), 0)
  into v_adjustment
  from daily_reports dr
  where dr.report_date between v_first_day and v_last_day;

  select coalesce(sum(drd.completed_count), 0),
         coalesce(sum(drd.completed_count * hrp.unit_price), 0)
  into v_total_rooms, v_gross_sales
  from daily_reports dr
  join daily_report_details drd on drd.daily_report_id = dr.id
  join hotel_room_prices hrp on hrp.hotel_id = dr.hotel_id and hrp.room_type_id = drd.room_type_id
  where dr.report_date between v_first_day and v_last_day;

  select coalesce(sum(
    extract(epoch from (s.end_time - s.start_time)) / 3600.0 * p.salary_amount
  ), 0)
  into v_hourly_labor
  from shifts s
  join profiles p on p.id = s.staff_id
  where s.work_date between v_first_day and v_last_day
    and s.status = 'approved'
    and p.salary_type = 'hourly';

  select coalesce(sum(p.salary_amount), 0)
  into v_monthly_labor
  from profiles p
  where p.salary_type = 'monthly'
    and p.is_active = true;

  select coalesce(mt.target_rooms, 0), coalesce(mt.target_sales, 0)
  into v_target_rooms, v_target_sales
  from monthly_targets mt
  where mt.hotel_id is null and mt.year_month = p_year_month;

  return query select
    v_total_rooms,
    v_gross_sales,
    v_hourly_labor,
    v_monthly_labor,
    v_adjustment,
    (v_gross_sales - v_hourly_labor - v_monthly_labor + v_adjustment),
    v_target_rooms,
    v_target_sales;
end;
$$;

grant execute on function get_overall_monthly_summary(text) to authenticated;

-- ---------------------------------------------------------
-- 3. 全ホテル分の月次サマリーを1回で取得(ランキング表示用)
-- ---------------------------------------------------------
create or replace function get_all_hotels_monthly_summary(
  p_year_month text
)
returns table (
  hotel_id uuid,
  hotel_name text,
  total_rooms bigint,
  gross_sales numeric,
  hourly_labor_cost numeric,
  monthly_labor_cost numeric,
  adjustment_total numeric,
  net_sales numeric,
  target_rooms int,
  target_sales numeric
)
language plpgsql
security invoker
as $$
declare
  h record;
begin
  for h in select id, name from hotels order by name loop
    return query
      select h.id, h.name, s.total_rooms, s.gross_sales, s.hourly_labor_cost,
             s.monthly_labor_cost, s.adjustment_total, s.net_sales,
             s.target_rooms, s.target_sales
      from get_hotel_monthly_summary(h.id, p_year_month) s;
  end loop;
end;
$$;

grant execute on function get_all_hotels_monthly_summary(text) to authenticated;

-- ---------------------------------------------------------
-- 4. ホテル単位の客室タイプ別 清掃実績内訳(当月)
-- ---------------------------------------------------------
create or replace function get_hotel_room_type_breakdown(
  p_hotel_id uuid,
  p_year_month text
)
returns table (room_type_name text, completed_count bigint)
language sql
security invoker
stable
as $$
  select rt.name, coalesce(sum(x.completed_count), 0)
  from room_types rt
  left join (
    select drd.room_type_id, drd.completed_count
    from daily_report_details drd
    join daily_reports dr on dr.id = drd.daily_report_id
    where dr.hotel_id = p_hotel_id
      and dr.report_date between (p_year_month || '-01')::date
          and ((p_year_month || '-01')::date + interval '1 month' - interval '1 day')::date
  ) x on x.room_type_id = rt.id
  group by rt.name, rt.sort_order
  order by rt.sort_order;
$$;

grant execute on function get_hotel_room_type_breakdown(uuid, text) to authenticated;

-- ---------------------------------------------------------
-- 5. 売上推移(直近Nヶ月、ホテル単位/全社)
-- ---------------------------------------------------------
create or replace function get_hotel_sales_trend(
  p_hotel_id uuid,
  p_year_month text,
  p_months_back int default 5
)
returns table (year_month text, net_sales numeric, total_rooms bigint)
language plpgsql
security invoker
as $$
declare
  i int;
  ym text;
  s record;
begin
  for i in reverse p_months_back..0 loop
    ym := to_char((p_year_month || '-01')::date - (i || ' months')::interval, 'YYYY-MM');
    select * into s from get_hotel_monthly_summary(p_hotel_id, ym);
    year_month := ym;
    net_sales := s.net_sales;
    total_rooms := s.total_rooms;
    return next;
  end loop;
end;
$$;

grant execute on function get_hotel_sales_trend(uuid, text, int) to authenticated;

create or replace function get_overall_sales_trend(
  p_year_month text,
  p_months_back int default 5
)
returns table (year_month text, net_sales numeric, total_rooms bigint)
language plpgsql
security invoker
as $$
declare
  i int;
  ym text;
  s record;
begin
  for i in reverse p_months_back..0 loop
    ym := to_char((p_year_month || '-01')::date - (i || ' months')::interval, 'YYYY-MM');
    select * into s from get_overall_monthly_summary(ym);
    year_month := ym;
    net_sales := s.net_sales;
    total_rooms := s.total_rooms;
    return next;
  end loop;
end;
$$;

grant execute on function get_overall_sales_trend(text, int) to authenticated;
