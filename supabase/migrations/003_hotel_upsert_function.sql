-- =========================================================
-- ホテル登録・編集用 RPC関数
-- 前提: 001_create_tables.sql, 002_rls_policies.sql 実行済み
-- =========================================================
--
-- ホテル本体(hotels)と客室タイプ別単価(hotel_room_prices)を
-- 1回のRPC呼び出しでまとめて登録/更新するための関数。
-- SECURITY INVOKER(デフォルト)のため、呼び出したユーザーの権限で
-- 内部のinsert/updateが実行される => 001/002で定義したRLS
-- (hotels_insert_admin, hotel_room_prices_insert_admin 等)がそのまま効き、
-- super_admin以外が呼び出した場合は内部のinsert/updateで権限エラーになる。
--
-- p_hotel_id: 新規登録時は null、編集時は対象ホテルのid
-- p_prices: [{ "room_type_id": "uuid", "unit_price": 12000 }, ...] 形式のJSONB配列
create or replace function upsert_hotel_with_prices(
  p_hotel_id uuid,
  p_name text,
  p_parent_company_name text,
  p_address text,
  p_phone text,
  p_client_contact_name text,
  p_prices jsonb
)
returns uuid
language plpgsql
security invoker
as $$
declare
  v_hotel_id uuid;
  item jsonb;
begin
  if p_name is null or length(trim(p_name)) = 0 then
    raise exception 'ホテル名は必須です';
  end if;

  if p_hotel_id is null then
    insert into hotels (name, parent_company_name, address, phone, client_contact_name)
    values (p_name, p_parent_company_name, p_address, p_phone, p_client_contact_name)
    returning id into v_hotel_id;
  else
    update hotels set
      name = p_name,
      parent_company_name = p_parent_company_name,
      address = p_address,
      phone = p_phone,
      client_contact_name = p_client_contact_name
    where id = p_hotel_id
    returning id into v_hotel_id;

    if v_hotel_id is null then
      raise exception 'ホテルが見つからないか、更新権限がありません';
    end if;
  end if;

  for item in select * from jsonb_array_elements(coalesce(p_prices, '[]'::jsonb))
  loop
    insert into hotel_room_prices (hotel_id, room_type_id, unit_price)
    values (
      v_hotel_id,
      (item ->> 'room_type_id')::uuid,
      (item ->> 'unit_price')::numeric
    )
    on conflict (hotel_id, room_type_id)
    do update set
      unit_price = excluded.unit_price,
      updated_at = now();
  end loop;

  return v_hotel_id;
end;
$$;

-- 認証済みユーザーからRPC経由で呼び出せるようにする
grant execute on function upsert_hotel_with_prices(uuid, text, text, text, text, text, jsonb)
  to authenticated;
