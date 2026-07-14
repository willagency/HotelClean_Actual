-- =========================================================
-- 日報(daily_reports + daily_report_details)登録/更新用 RPC関数
-- 前提: 001〜004 実行済み
-- =========================================================
--
-- ホテル単位の日報本体と、客室タイプ別の清掃完了数を
-- 1回のRPC呼び出しでまとめて登録/更新する。
-- security invoker のため、呼び出したユーザーの権限で内部の
-- insert/updateが実行され、001/002で定義したRLS
-- (daily_reports_insert_hotel_scoped 等)がそのまま効く。
--
-- p_report_id: 新規登録時は null、編集時は対象日報のid
-- 新規登録時に同一ホテル・同一日の日報が既に存在する場合は、
-- unique(hotel_id, report_date) 制約により上書き更新される
-- (「その日の日報を後から直す」運用を自然に許容するため)
create or replace function upsert_daily_report(
  p_report_id uuid,
  p_hotel_id uuid,
  p_report_date date,
  p_adjustment_amount numeric,
  p_adjustment_note text,
  p_room_counts jsonb
)
returns uuid
language plpgsql
security invoker
as $$
declare
  v_report_id uuid;
  item jsonb;
begin
  if p_hotel_id is null or p_report_date is null then
    raise exception 'ホテルと対象日は必須です';
  end if;

  if p_report_id is null then
    insert into daily_reports (hotel_id, report_date, adjustment_amount, adjustment_note, created_by)
    values (p_hotel_id, p_report_date, coalesce(p_adjustment_amount, 0), p_adjustment_note, auth.uid())
    on conflict (hotel_id, report_date)
    do update set
      adjustment_amount = excluded.adjustment_amount,
      adjustment_note = excluded.adjustment_note,
      updated_at = now()
    returning id into v_report_id;
  else
    update daily_reports set
      adjustment_amount = coalesce(p_adjustment_amount, 0),
      adjustment_note = p_adjustment_note
    where id = p_report_id
    returning id into v_report_id;

    if v_report_id is null then
      raise exception '日報が見つからないか、更新権限がありません';
    end if;
  end if;

  for item in select * from jsonb_array_elements(coalesce(p_room_counts, '[]'::jsonb))
  loop
    insert into daily_report_details (daily_report_id, room_type_id, completed_count)
    values (
      v_report_id,
      (item ->> 'room_type_id')::uuid,
      (item ->> 'completed_count')::int
    )
    on conflict (daily_report_id, room_type_id)
    do update set completed_count = excluded.completed_count;
  end loop;

  return v_report_id;
end;
$$;

grant execute on function upsert_daily_report(uuid, uuid, date, numeric, text, jsonb)
  to authenticated;
