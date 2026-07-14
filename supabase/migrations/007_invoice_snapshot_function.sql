-- =========================================================
-- 月次請求明細(invoices / invoice_line_items)スナップショット生成用RPC関数
-- 前提: 001〜006 実行済み
-- =========================================================
--
-- get_hotel_monthly_summary() で計算した内容を invoices に確定保存し、
-- 客室タイプ別の内訳(単価・室数のスナップショット)を invoice_line_items
-- に保存する。PDF自体はここでは生成せず、ダウンロード時にRoute Handler側
-- でこのスナップショットから都度組み立てる。
--
-- 同一ホテル・同一年月で再実行した場合は、その時点の最新実績で上書きされる
-- (unique(hotel_id, year_month) を利用したupsert)。
create or replace function upsert_invoice_snapshot(
  p_hotel_id uuid,
  p_year_month text
)
returns uuid
language plpgsql
security invoker
as $$
declare
  v_invoice_id uuid;
  v_summary record;
  v_item record;
begin
  select * into v_summary from get_hotel_monthly_summary(p_hotel_id, p_year_month);

  insert into invoices (
    hotel_id, year_month, total_rooms, gross_sales, labor_cost,
    adjustment_total, net_sales, status, generated_by, generated_at
  )
  values (
    p_hotel_id,
    p_year_month,
    v_summary.total_rooms,
    v_summary.gross_sales,
    (v_summary.hourly_labor_cost + v_summary.monthly_labor_cost),
    v_summary.adjustment_total,
    v_summary.net_sales,
    'confirmed',
    auth.uid(),
    now()
  )
  on conflict (hotel_id, year_month)
  do update set
    total_rooms = excluded.total_rooms,
    gross_sales = excluded.gross_sales,
    labor_cost = excluded.labor_cost,
    adjustment_total = excluded.adjustment_total,
    net_sales = excluded.net_sales,
    status = excluded.status,
    generated_by = excluded.generated_by,
    generated_at = excluded.generated_at
  returning id into v_invoice_id;

  delete from invoice_line_items where invoice_id = v_invoice_id;

  for v_item in
    select drd.room_type_id, sum(drd.completed_count) as room_count, hrp.unit_price
    from daily_reports dr
    join daily_report_details drd on drd.daily_report_id = dr.id
    join hotel_room_prices hrp on hrp.hotel_id = dr.hotel_id and hrp.room_type_id = drd.room_type_id
    where dr.hotel_id = p_hotel_id
      and dr.report_date between (p_year_month || '-01')::date
          and ((p_year_month || '-01')::date + interval '1 month' - interval '1 day')::date
    group by drd.room_type_id, hrp.unit_price
  loop
    insert into invoice_line_items (invoice_id, room_type_id, room_count, unit_price, subtotal)
    values (
      v_invoice_id,
      v_item.room_type_id,
      v_item.room_count,
      v_item.unit_price,
      v_item.room_count * v_item.unit_price
    );
  end loop;

  return v_invoice_id;
end;
$$;

grant execute on function upsert_invoice_snapshot(uuid, text) to authenticated;
