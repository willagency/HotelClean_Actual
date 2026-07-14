-- =========================================================
-- 留学生の週28時間ルール対応
-- 前提: 001〜007 実行済み
-- =========================================================
--
-- 【重要な前提・制約】
-- ・「週28時間」は資格外活動許可における全勤務先合算の上限であり、
--   本システムはこのシステムに登録された勤務先(ホテル)の合計時間しか
--   把握できない。対象者が他のアルバイトを掛け持ちしている場合は
--   合算できないため、あくまで「本システム上の合計時間の目安」として扱う。
-- ・「週」は月曜始まり(date_trunc('week', ...)のPostgresデフォルト仕様)
--   として計算する。
-- ・長期休暇期間中は1日8時間まで週28時間の制限が緩和される制度があるが、
--   今回のバージョンでは考慮していない(将来的な拡張ポイント)。

-- ---------------------------------------------------------
-- 1. profiles に留学生フラグを追加
-- ---------------------------------------------------------
alter table profiles
  add column if not exists is_international_student boolean not null default false;

comment on column profiles.is_international_student is
  '留学生(資格外活動許可・週28時間ルール対象)かどうか';

-- ---------------------------------------------------------
-- 2. 週28時間を超過している留学生を検出する関数
--    集計対象:status in ('requested','approved') のシフト(却下は除外)
--    ホテルによる絞り込みは行わない(全勤務先合算の趣旨のため)
-- ---------------------------------------------------------
create or replace function get_weekly_hour_alerts(
  p_year_month text
)
returns table (
  staff_id uuid,
  staff_name text,
  week_start date,
  total_hours numeric
)
language sql
security invoker
stable
as $$
  select
    p.id,
    p.name,
    date_trunc('week', s.work_date)::date as week_start,
    sum(extract(epoch from (s.end_time - s.start_time)) / 3600.0) as total_hours
  from shifts s
  join profiles p on p.id = s.staff_id
  where p.is_international_student = true
    and s.status in ('requested', 'approved')
    and s.work_date between
      ((p_year_month || '-01')::date - interval '7 days')
      and (((p_year_month || '-01')::date + interval '1 month' - interval '1 day') + interval '7 days')
  group by p.id, p.name, date_trunc('week', s.work_date)
  having sum(extract(epoch from (s.end_time - s.start_time)) / 3600.0) > 28
  order by week_start desc, p.name;
$$;

grant execute on function get_weekly_hour_alerts(text) to authenticated;
