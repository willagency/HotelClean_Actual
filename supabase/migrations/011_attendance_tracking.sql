-- =========================================================
-- 出勤状況確認機能: 実働時間の記録 + 週28/40時間判定を実績優先に修正
-- 前提: 001〜010 実行済み
-- =========================================================
--
-- 【重要な設計変更】
-- これまでの週28時間(長期休業期間モードは週40時間)判定は「シフトの予定時間」を
-- 基準に計算していたが、予定と実績(タイムカード)に乖離が生じる問題があるため、
-- 「実績が入力されている日はそちらを優先し、未入力の日は予定時間で代用する」
-- 方式に修正する。

-- ---------------------------------------------------------
-- 1. shifts: 実際の出退勤時刻・休憩時間(タイムカードの手動入力用)
-- ---------------------------------------------------------
alter table shifts
  add column if not exists actual_start_time time,
  add column if not exists actual_end_time time,
  add column if not exists break_minutes int not null default 0;

alter table shifts
  add constraint shifts_break_minutes_check check (break_minutes >= 0);

comment on column shifts.actual_start_time is 'タイムカード等から手動入力する実際の出勤時刻';
comment on column shifts.actual_end_time is 'タイムカード等から手動入力する実際の退勤時刻';
comment on column shifts.break_minutes is '休憩時間(分)。実働時間の計算時に差し引く';

-- ---------------------------------------------------------
-- 2. 週の労働時間アラート関数を「実績優先」に修正
--    (実績が入力されていればそちらを、未入力ならシフト予定時間を使う)
-- ---------------------------------------------------------
drop function if exists get_weekly_hour_alerts(text);

create or replace function get_weekly_hour_alerts(
  p_year_month text
)
returns table (
  staff_id uuid,
  staff_name text,
  window_end date,
  total_hours numeric,
  hour_limit numeric
)
language sql
security invoker
stable
as $$
  with candidates as (
    select
      s.staff_id,
      p.name as staff_name,
      s.work_date as window_end,
      (
        select coalesce(sum(
          coalesce(
            case
              when sx.actual_start_time is not null and sx.actual_end_time is not null then
                greatest(
                  extract(epoch from (sx.actual_end_time - sx.actual_start_time)) / 3600.0
                    - coalesce(sx.break_minutes, 0) / 60.0,
                  0
                )
              else extract(epoch from (sx.end_time - sx.start_time)) / 3600.0
            end,
            0
          ) + sx.other_company_hours
        ), 0)
        from shifts sx
        where sx.staff_id = s.staff_id
          and sx.status in ('requested', 'approved')
          and sx.work_date between (s.work_date - 6) and s.work_date
      ) as total_hours,
      case when p.is_long_vacation_mode then 40 else 28 end as hour_limit
    from shifts s
    join profiles p on p.id = s.staff_id
    where p.is_international_student = true
      and s.status in ('requested', 'approved')
      and s.work_date between
        (p_year_month || '-01')::date
        and ((p_year_month || '-01')::date + interval '1 month' - interval '1 day')::date
  )
  select staff_id, staff_name, window_end, total_hours, hour_limit
  from candidates
  where total_hours > hour_limit
  order by window_end desc, staff_name;
$$;

grant execute on function get_weekly_hour_alerts(text) to authenticated;

-- ---------------------------------------------------------
-- 3. 出勤状況確認画面用のデータ取得関数
--    ホテル×年月を指定し、承認済みシフト単位で
--    予定/実績/差異/直近7日合計/残り時間をまとめて返す。
-- ---------------------------------------------------------
create or replace function get_attendance_rows(
  p_hotel_id uuid,
  p_year_month text
)
returns table (
  shift_id uuid,
  staff_id uuid,
  staff_name text,
  is_international_student boolean,
  work_date date,
  planned_start time,
  planned_end time,
  planned_hours numeric,
  actual_start time,
  actual_end time,
  break_minutes int,
  actual_hours numeric,
  variance_hours numeric,
  other_company_hours numeric,
  rolling_total_hours numeric,
  hour_limit numeric,
  remaining_hours numeric
)
language sql
security invoker
stable
as $$
  select
    s.id as shift_id,
    s.staff_id,
    p.name as staff_name,
    p.is_international_student,
    s.work_date,
    s.start_time as planned_start,
    s.end_time as planned_end,
    round((extract(epoch from (s.end_time - s.start_time)) / 3600.0)::numeric, 2) as planned_hours,
    s.actual_start_time as actual_start,
    s.actual_end_time as actual_end,
    s.break_minutes,
    round(effective.actual_hours::numeric, 2) as actual_hours,
    round(
      (effective.actual_hours - (extract(epoch from (s.end_time - s.start_time)) / 3600.0))::numeric,
      2
    ) as variance_hours,
    s.other_company_hours,
    round(rolling.total_hours::numeric, 2) as rolling_total_hours,
    (case when p.is_long_vacation_mode then 40 else 28 end)::numeric as hour_limit,
    round(
      ((case when p.is_long_vacation_mode then 40 else 28 end) - rolling.total_hours)::numeric,
      2
    ) as remaining_hours
  from shifts s
  join profiles p on p.id = s.staff_id
  cross join lateral (
    select
      case
        when s.actual_start_time is not null and s.actual_end_time is not null then
          greatest(
            extract(epoch from (s.actual_end_time - s.actual_start_time)) / 3600.0
              - coalesce(s.break_minutes, 0) / 60.0,
            0
          )
        else null
      end as actual_hours
  ) effective
  cross join lateral (
    select coalesce(sum(
      coalesce(
        case
          when sx.actual_start_time is not null and sx.actual_end_time is not null then
            greatest(
              extract(epoch from (sx.actual_end_time - sx.actual_start_time)) / 3600.0
                - coalesce(sx.break_minutes, 0) / 60.0,
              0
            )
          else extract(epoch from (sx.end_time - sx.start_time)) / 3600.0
        end,
        0
      ) + sx.other_company_hours
    ), 0) as total_hours
    from shifts sx
    where sx.staff_id = s.staff_id
      and sx.status in ('requested', 'approved')
      and sx.work_date between (s.work_date - 6) and s.work_date
  ) rolling
  where s.hotel_id = p_hotel_id
    and s.status = 'approved'
    and s.work_date between
      (p_year_month || '-01')::date
      and ((p_year_month || '-01')::date + interval '1 month' - interval '1 day')::date
  order by p.name, s.work_date;
$$;

grant execute on function get_attendance_rows(uuid, text) to authenticated;
