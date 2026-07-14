-- =========================================================
-- ホテル客室清掃管理システム DBスキーマ作成SQL
-- 対象: Supabase (PostgreSQL)
-- 実行順: このファイルの上から順に実行してください
-- =========================================================

-- 拡張機能(uuid生成用)
create extension if not exists "pgcrypto";

-- -----------------------------------------------------------
-- 共通: updated_at 自動更新用トリガー関数
-- -----------------------------------------------------------
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- =========================================================
-- 1. hotels (ホテルマスタ)
-- =========================================================
create table hotels (
  id                   uuid primary key default gen_random_uuid(),
  name                 text not null,
  parent_company_name  text,
  address              text,
  phone                text,
  client_contact_name  text,
  is_active            boolean not null default true,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create trigger trg_hotels_updated_at
  before update on hotels
  for each row execute function set_updated_at();

-- =========================================================
-- 2. profiles (スタッフ・ユーザー情報 / auth.usersを拡張)
-- =========================================================
create table profiles (
  id                uuid primary key references auth.users (id) on delete cascade,
  name              text not null,
  email             text not null,
  phone             text,
  role              text not null
                      check (role in ('super_admin', 'manager', 'checker', 'staff')),
  salary_type       text not null
                      check (salary_type in ('monthly', 'hourly')),
  salary_amount     numeric(12, 2) not null default 0,
  primary_hotel_id  uuid references hotels (id) on delete restrict,
  is_active         boolean not null default true,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- 月給スタッフ(全体管理者含む)は必ずホテルに紐づける(人件費按分先のため)
create or replace function check_monthly_staff_has_hotel()
returns trigger as $$
begin
  if new.salary_type = 'monthly' and new.primary_hotel_id is null then
    raise exception 'monthly salary staff must have primary_hotel_id set';
  end if;
  return new;
end;
$$ language plpgsql;

create trigger trg_profiles_monthly_hotel_check
  before insert or update on profiles
  for each row execute function check_monthly_staff_has_hotel();

create trigger trg_profiles_updated_at
  before update on profiles
  for each row execute function set_updated_at();

create index idx_profiles_primary_hotel_id on profiles (primary_hotel_id);

-- =========================================================
-- 3. hotel_staff (ホテル⇔スタッフ 割当。複数ホテル兼任に対応)
-- =========================================================
create table hotel_staff (
  id          uuid primary key default gen_random_uuid(),
  hotel_id    uuid not null references hotels (id) on delete cascade,
  staff_id    uuid not null references profiles (id) on delete cascade,
  created_at  timestamptz not null default now(),
  unique (hotel_id, staff_id)
);

create index idx_hotel_staff_staff_id on hotel_staff (staff_id);

-- =========================================================
-- 4. room_types (客室タイプマスタ)
-- =========================================================
create table room_types (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  sort_order  int not null default 0,
  created_at  timestamptz not null default now()
);

-- =========================================================
-- 5. hotel_room_prices (ホテル×客室タイプの単価 / 改定履歴は保持しない)
-- =========================================================
create table hotel_room_prices (
  id             uuid primary key default gen_random_uuid(),
  hotel_id       uuid not null references hotels (id) on delete cascade,
  room_type_id   uuid not null references room_types (id) on delete restrict,
  unit_price     numeric(12, 2) not null default 0,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (hotel_id, room_type_id)
);

create trigger trg_hotel_room_prices_updated_at
  before update on hotel_room_prices
  for each row execute function set_updated_at();

-- =========================================================
-- 6. shifts (シフト申請 兼 実績)
-- =========================================================
create table shifts (
  id            uuid primary key default gen_random_uuid(),
  staff_id      uuid not null references profiles (id) on delete cascade,
  hotel_id      uuid not null references hotels (id) on delete cascade,
  work_date     date not null,
  start_time    time not null,
  end_time      time not null,
  status        text not null default 'requested'
                  check (status in ('requested', 'approved', 'rejected')),
  approved_by   uuid references profiles (id),
  note          text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  check (end_time > start_time)
);

create trigger trg_shifts_updated_at
  before update on shifts
  for each row execute function set_updated_at();

create index idx_shifts_hotel_date on shifts (hotel_id, work_date);
create index idx_shifts_staff_date on shifts (staff_id, work_date);

-- =========================================================
-- 7. daily_reports (日報:ホテル単位)
-- =========================================================
create table daily_reports (
  id                  uuid primary key default gen_random_uuid(),
  hotel_id            uuid not null references hotels (id) on delete cascade,
  report_date         date not null,
  adjustment_amount   numeric(12, 2) not null default 0,
  adjustment_note     text,
  created_by          uuid not null references profiles (id),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (hotel_id, report_date)
);

create trigger trg_daily_reports_updated_at
  before update on daily_reports
  for each row execute function set_updated_at();

create index idx_daily_reports_hotel_date on daily_reports (hotel_id, report_date);

-- =========================================================
-- 8. daily_report_details (客室タイプ別の清掃完了数)
-- =========================================================
create table daily_report_details (
  id                 uuid primary key default gen_random_uuid(),
  daily_report_id    uuid not null references daily_reports (id) on delete cascade,
  room_type_id       uuid not null references room_types (id) on delete restrict,
  completed_count    int not null default 0 check (completed_count >= 0),
  unique (daily_report_id, room_type_id)
);

-- =========================================================
-- 9. monthly_targets (月次目標 / hotel_idがnullの場合は全社目標)
-- =========================================================
create table monthly_targets (
  id             uuid primary key default gen_random_uuid(),
  hotel_id       uuid references hotels (id) on delete cascade,
  year_month     char(7) not null check (year_month ~ '^\d{4}-\d{2}$'),
  target_rooms   int not null default 0,
  target_sales   numeric(14, 2) not null default 0,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (hotel_id, year_month)
);

create trigger trg_monthly_targets_updated_at
  before update on monthly_targets
  for each row execute function set_updated_at();

-- =========================================================
-- 10. invoices (月次請求明細:生成結果の保存)
-- =========================================================
create table invoices (
  id                 uuid primary key default gen_random_uuid(),
  hotel_id           uuid not null references hotels (id) on delete cascade,
  year_month         char(7) not null check (year_month ~ '^\d{4}-\d{2}$'),
  total_rooms        int not null default 0,
  gross_sales        numeric(14, 2) not null default 0,
  labor_cost         numeric(14, 2) not null default 0,
  adjustment_total   numeric(14, 2) not null default 0,
  net_sales          numeric(14, 2) not null default 0,
  status             text not null default 'draft'
                       check (status in ('draft', 'confirmed', 'sent')),
  pdf_url            text,
  generated_by       uuid references profiles (id),
  generated_at       timestamptz,
  created_at         timestamptz not null default now(),
  unique (hotel_id, year_month)
);

create index idx_invoices_hotel_month on invoices (hotel_id, year_month);

-- =========================================================
-- 11. invoice_line_items (請求明細の客室タイプ別内訳スナップショット)
-- =========================================================
create table invoice_line_items (
  id             uuid primary key default gen_random_uuid(),
  invoice_id     uuid not null references invoices (id) on delete cascade,
  room_type_id   uuid not null references room_types (id) on delete restrict,
  room_count     int not null default 0,
  unit_price     numeric(12, 2) not null default 0,
  subtotal       numeric(14, 2) not null default 0,
  unique (invoice_id, room_type_id)
);

-- =========================================================
-- 初期マスタデータ例(必要に応じて調整・削除してください)
-- =========================================================
insert into room_types (name, sort_order) values
  ('シングル', 1),
  ('ダブル', 2),
  ('ツイン', 3),
  ('スイート', 4);

-- =========================================================
-- 備考:
-- ・RLS(Row Level Security)ポリシーは本ファイルには含めていません。
--   フェーズ1の認証実装と合わせて別途設計・追加します。
-- =========================================================
