-- =========================================================
-- ホテル別シフト時間帯マスタ(最大5つ) + 目標稼働人員数 + 充足差分集計
-- 前提: 001〜011 実行済み
-- =========================================================

-- ---------------------------------------------------------
-- 1. shift_templates: ホテルごとのシフト時間帯マスタ(最大5つ)
-- ---------------------------------------------------------
create table shift_templates (
  id                 uuid primary key default gen_random_uuid(),
  hotel_id           uuid not null references hotels (id) on delete cascade,
  label              text not null,
  start_time         time not null,
  end_time           time not null,
  target_headcount   int not null default 1,
  sort_order         int not null default 0,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  check (end_time > start_time),
  check (target_headcount >= 0)
);

create trigger trg_shift_templates_updated_at
  before update on shift_templates
  for each row execute function set_updated_at();

create index idx_shift_templates_hotel_id on shift_templates (hotel_id);

-- ホテルごとに登録できる時間帯は最大5つまでという制約をDB側でも保証する
create or replace function check_max_shift_templates_per_hotel()
returns trigger
language plpgsql
as $$
declare
  v_count int;
begin
  select count(*) into v_count from shift_templates where hotel_id = new.hotel_id;
  if v_count >= 5 then
    raise exception 'ホテルごとに登録できるシフト時間帯は最大5つまでです';
  end if;
  return new;
end;
$$;

create trigger trg_shift_templates_max_count
  before insert on shift_templates
  for each row execute function check_max_shift_templates_per_hotel();

-- RLS: 閲覧は当該ホテルに関係する全員(staffも含む。申請時の選択肢として必要)、
-- 登録・編集・削除はホテル管理と同じくsuper_adminのみ
alter table shift_templates enable row level security;

create policy shift_templates_select_admin on shift_templates
  for select using (auth_role() = 'super_admin');

create policy shift_templates_select_assigned on shift_templates
  for select using (hotel_id in (select auth_hotel_ids()));

create policy shift_templates_insert_admin on shift_templates
  for insert with check (auth_role() = 'super_admin');

create policy shift_templates_update_admin on shift_templates
  for update using (auth_role() = 'super_admin');

create policy shift_templates_delete_admin on shift_templates
  for delete using (auth_role() = 'super_admin');

-- ---------------------------------------------------------
-- 2. shifts: どのシフト時間帯を選んで申請したかの紐付け(任意)
--    テンプレートが削除された場合でも過去のシフト自体は残したいため
--    on delete set null にする(差分集計の対象からは外れる)
-- ---------------------------------------------------------
alter table shifts
  add column if not exists shift_template_id uuid references shift_templates (id) on delete set null;

-- ---------------------------------------------------------
-- 3. upsert_hotel_with_prices を拡張し、シフト時間帯もまとめて保存できるようにする
--    (パラメータ構成が変わるため、いったん既存関数を削除してから作り直す)
-- ---------------------------------------------------------
drop function if exists upsert_hotel_with_prices(uuid, text, text, text, text, text, text, text, jsonb);

create or replace function upsert_hotel_with_prices(
  p_hotel_id uuid,
  p_name text,
  p_parent_company_name text,
  p_address text,
  p_phone text,
  p_client_contact_name text,
  p_branch_name text,
  p_notes text,
  p_prices jsonb,
  p_shift_templates jsonb default '[]'::jsonb
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

  if jsonb_array_length(coalesce(p_shift_templates, '[]'::jsonb)) > 5 then
    raise exception 'シフト時間帯は最大5つまでです';
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

  -- 客室単価
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

  -- シフト時間帯: フォームから送られてこなかった(削除された)ものはここで削除する
  delete from shift_templates
  where hotel_id = v_hotel_id
    and id not in (
      select (t.item ->> 'id')::uuid
      from jsonb_array_elements(coalesce(p_shift_templates, '[]'::jsonb)) as t(item)
      where t.item ->> 'id' is not null and t.item ->> 'id' <> ''
    );

  for item in select * from jsonb_array_elements(coalesce(p_shift_templates, '[]'::jsonb))
  loop
    if (item ->> 'id') is null or (item ->> 'id') = '' then
      insert into shift_templates (hotel_id, label, start_time, end_time, target_headcount, sort_order)
      values (
        v_hotel_id,
        item ->> 'label',
        (item ->> 'start_time')::time,
        (item ->> 'end_time')::time,
        coalesce((item ->> 'target_headcount')::int, 1),
        coalesce((item ->> 'sort_order')::int, 0)
      );
    else
      update shift_templates set
        label = item ->> 'label',
        start_time = (item ->> 'start_time')::time,
        end_time = (item ->> 'end_time')::time,
        target_headcount = coalesce((item ->> 'target_headcount')::int, 1),
        sort_order = coalesce((item ->> 'sort_order')::int, 0),
        updated_at = now()
      where id = (item ->> 'id')::uuid and hotel_id = v_hotel_id;
    end if;
  end loop;

  return v_hotel_id;
end;
$$;

grant execute on function upsert_hotel_with_prices(uuid, text, text, text, text, text, text, text, jsonb, jsonb)
  to authenticated;

-- ---------------------------------------------------------
-- 4. 目標稼働人員数と承認済みシフト数の差分集計
--    ホテル×年月を指定し、時間帯×日付ごとに目標人数・承認済み人数・差分を返す
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
    st.target_headcount,
    d.work_date,
    coalesce(cnt.approved_count, 0) as approved_count,
    (coalesce(cnt.approved_count, 0) - st.target_headcount)::int as diff
  from shift_templates st
  cross join lateral (
    select generate_series(
      (p_year_month || '-01')::date,
      ((p_year_month || '-01')::date + interval '1 month' - interval '1 day')::date,
      interval '1 day'
    )::date as work_date
  ) d
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
