-- =========================================================
-- hotelsテーブルに「担当支店」「備考」を追加
-- 前提: 001〜003 実行済み
-- =========================================================

alter table hotels
  add column if not exists branch_name text,
  add column if not exists notes text;

comment on column hotels.branch_name is '自社側の担当支店名';
comment on column hotels.notes is '備考(自由記述)';

-- ---------------------------------------------------------
-- upsert_hotel_with_prices を新しいカラムに対応させて再定義
-- パラメータ構成が変わるため、いったん既存関数を削除してから作り直す
-- ---------------------------------------------------------
drop function if exists upsert_hotel_with_prices(uuid, text, text, text, text, text, jsonb);

create or replace function upsert_hotel_with_prices(
  p_hotel_id uuid,
  p_name text,
  p_parent_company_name text,
  p_address text,
  p_phone text,
  p_client_contact_name text,
  p_branch_name text,
  p_notes text,
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
    insert into hotels (name, parent_company_name, address, phone, client_contact_name, branch_name, notes)
    values (p_name, p_parent_company_name, p_address, p_phone, p_client_contact_name, p_branch_name, p_notes)
    returning id into v_hotel_id;
  else
    update hotels set
      name = p_name,
      parent_company_name = p_parent_company_name,
      address = p_address,
      phone = p_phone,
      client_contact_name = p_client_contact_name,
      branch_name = p_branch_name,
      notes = p_notes
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

grant execute on function upsert_hotel_with_prices(uuid, text, text, text, text, text, text, text, jsonb)
  to authenticated;
