-- =========================================================
-- 留学生の労働時間ルール: ローリング7日間判定への修正 + 長期休業モード + 他社勤務自己申告
-- 前提: 001〜008 実行済み
-- =========================================================
--
-- 【重要】008で実装した「月曜〜日曜の暦週」判定は入管法上の解釈として誤りであり、
-- 正しくは「起算日を問わず、任意の連続7日間で合計28時間以内」である。
-- このマイグレーションで get_weekly_hour_alerts をローリング7日間判定に置き換える。

-- ---------------------------------------------------------
-- 1. profiles: 長期休業期間モード(1日8時間/週40時間に緩和)
-- ---------------------------------------------------------
alter table profiles
  add column if not exists is_long_vacation_mode boolean not null default false;

comment on column profiles.is_long_vacation_mode is
  '長期休業期間モード(学校の長期休暇中。true時は1日8時間/週40時間、false時は週28時間が上限)';

-- ---------------------------------------------------------
-- 2. shifts: 他社勤務の自己申告(掛け持ち対応)
--    「その勤務日に他社でも働く(予定の)時間」を自己申告してもらう。
--    週28/40時間の判定には、このシステム上のシフト時間に加えて
--    この自己申告時間を合算する。
-- ---------------------------------------------------------
alter table shifts
  add column if not exists other_company_hours numeric not null default 0,
  add column if not exists other_company_confirmed boolean not null default false;

comment on column shifts.other_company_hours is
  '同日に他社で勤務する(予定の)自己申告時間。週の労働時間判定に合算する。';
comment on column shifts.other_company_confirmed is
  '「他社勤務を含めて規定時間内である」ことをスタッフが確認済みかどうか(自己申告のチェック)';

-- ---------------------------------------------------------
-- 3. 週の労働時間アラート関数をローリング7日間判定に置き換え
--    各シフト日を「窓の終了日」として、その日からさかのぼる7日間
--    (work_date - 6 〜 work_date)の合計時間を計算し、
--    long_vacation_modeに応じた上限(28h or 40h)を超えていれば検出する。
--    (数学的に、暦週ではなく実際に働いた日を窓の終了日として全て
--    チェックすれば、任意の7日間の違反を漏れなく検出できる)
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
          extract(epoch from (sx.end_time - sx.start_time)) / 3600.0 + sx.other_company_hours
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
