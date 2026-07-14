-- =========================================================
-- ホテル客室清掃管理システム RLS(Row Level Security)ポリシー
-- 前提: 001_create_tables.sql 実行済みであること
-- =========================================================

-- ---------------------------------------------------------
-- 0. ヘルパー関数
--    RLSポリシー内でprofilesを直接参照すると再帰的に
--    RLS評価が走ってしまうため、SECURITY DEFINERで
--    RLSをバイパスして判定する関数を用意する。
-- ---------------------------------------------------------

-- ログイン中ユーザーのroleを返す
create or replace function auth_role()
returns text
language sql
security definer
stable
set search_path = public
as $$
  select role from profiles where id = auth.uid();
$$;

-- ログイン中ユーザーが担当する(紐づく)ホテルID一覧を返す
-- primary_hotel_id と hotel_staff の割当の両方を統合する
create or replace function auth_hotel_ids()
returns setof uuid
language sql
security definer
stable
set search_path = public
as $$
  select hotel_id from hotel_staff where staff_id = auth.uid()
  union
  select primary_hotel_id from profiles
    where id = auth.uid() and primary_hotel_id is not null;
$$;

-- role昇格・給与改ざん防止用トリガー(profiles更新時に非super_adminが
-- role / salary_type / salary_amount / primary_hotel_id を変更できないようにする)
create or replace function prevent_profile_privilege_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth_role() <> 'super_admin' then
    if new.role is distinct from old.role
       or new.salary_type is distinct from old.salary_type
       or new.salary_amount is distinct from old.salary_amount then
      raise exception 'insufficient privilege to change role/salary fields';
    end if;
  end if;
  return new;
end;
$$;

create trigger trg_profiles_privilege_guard
  before update on profiles
  for each row execute function prevent_profile_privilege_escalation();

-- ---------------------------------------------------------
-- 1. hotels
-- ---------------------------------------------------------
alter table hotels enable row level security;

create policy hotels_select_admin on hotels
  for select using (auth_role() = 'super_admin');

create policy hotels_select_assigned on hotels
  for select using (id in (select auth_hotel_ids()));

create policy hotels_insert_admin on hotels
  for insert with check (auth_role() = 'super_admin');

create policy hotels_update_admin on hotels
  for update using (auth_role() = 'super_admin');

create policy hotels_delete_admin on hotels
  for delete using (auth_role() = 'super_admin');

-- ---------------------------------------------------------
-- 2. profiles
-- ---------------------------------------------------------
alter table profiles enable row level security;

create policy profiles_select_admin on profiles
  for select using (auth_role() = 'super_admin');

create policy profiles_select_self on profiles
  for select using (id = auth.uid());

create policy profiles_select_same_hotel on profiles
  for select using (
    auth_role() in ('manager', 'checker')
    and primary_hotel_id in (select auth_hotel_ids())
  );

create policy profiles_insert_admin on profiles
  for insert with check (auth_role() = 'super_admin');

-- managerは自ホテルの staff/checker のみ新規登録可能(管理者・マネージャーの新規作成は不可)
create policy profiles_insert_manager on profiles
  for insert with check (
    auth_role() = 'manager'
    and primary_hotel_id in (select auth_hotel_ids())
    and role in ('staff', 'checker')
  );

create policy profiles_update_admin on profiles
  for update using (auth_role() = 'super_admin');

create policy profiles_update_manager on profiles
  for update using (
    auth_role() = 'manager'
    and primary_hotel_id in (select auth_hotel_ids())
  )
  with check (
    role in ('staff', 'checker')
    and primary_hotel_id in (select auth_hotel_ids())
  );

-- 本人による基本情報(電話番号など)更新。role/salary系は上記トリガーでガード。
create policy profiles_update_self on profiles
  for update using (id = auth.uid())
  with check (id = auth.uid());

create policy profiles_delete_admin on profiles
  for delete using (auth_role() = 'super_admin');

-- ---------------------------------------------------------
-- 3. hotel_staff
-- ---------------------------------------------------------
alter table hotel_staff enable row level security;

create policy hotel_staff_select on hotel_staff
  for select using (
    auth_role() = 'super_admin'
    or hotel_id in (select auth_hotel_ids())
    or staff_id = auth.uid()
  );

create policy hotel_staff_insert_admin on hotel_staff
  for insert with check (auth_role() = 'super_admin');

create policy hotel_staff_insert_manager on hotel_staff
  for insert with check (
    auth_role() = 'manager'
    and hotel_id in (select auth_hotel_ids())
  );

create policy hotel_staff_delete_admin on hotel_staff
  for delete using (auth_role() = 'super_admin');

create policy hotel_staff_delete_manager on hotel_staff
  for delete using (
    auth_role() = 'manager'
    and hotel_id in (select auth_hotel_ids())
  );

-- ---------------------------------------------------------
-- 4. room_types(マスタ。閲覧は全認証ユーザーに許可)
-- ---------------------------------------------------------
alter table room_types enable row level security;

create policy room_types_select_all on room_types
  for select using (auth.uid() is not null);

create policy room_types_insert_admin on room_types
  for insert with check (auth_role() = 'super_admin');

create policy room_types_update_admin on room_types
  for update using (auth_role() = 'super_admin');

create policy room_types_delete_admin on room_types
  for delete using (auth_role() = 'super_admin');

-- ---------------------------------------------------------
-- 5. hotel_room_prices
-- ---------------------------------------------------------
alter table hotel_room_prices enable row level security;

create policy hotel_room_prices_select_admin on hotel_room_prices
  for select using (auth_role() = 'super_admin');

create policy hotel_room_prices_select_assigned on hotel_room_prices
  for select using (
    auth_role() in ('manager', 'checker')
    and hotel_id in (select auth_hotel_ids())
  );

create policy hotel_room_prices_insert_admin on hotel_room_prices
  for insert with check (auth_role() = 'super_admin');

create policy hotel_room_prices_update_admin on hotel_room_prices
  for update using (auth_role() = 'super_admin');

create policy hotel_room_prices_delete_admin on hotel_room_prices
  for delete using (auth_role() = 'super_admin');

-- ---------------------------------------------------------
-- 6. shifts
-- ---------------------------------------------------------
alter table shifts enable row level security;

-- SELECT: super_admin全件 / manager・checkerは自ホテル分(checkerは閲覧のみ) / staffは本人分
create policy shifts_select_admin on shifts
  for select using (auth_role() = 'super_admin');

create policy shifts_select_hotel_scoped on shifts
  for select using (
    auth_role() in ('manager', 'checker')
    and hotel_id in (select auth_hotel_ids())
  );

create policy shifts_select_self on shifts
  for select using (staff_id = auth.uid());

-- INSERT: staffは本人の申請(status=requested)のみ / managerは自ホテル分 / super_admin全件
create policy shifts_insert_admin on shifts
  for insert with check (auth_role() = 'super_admin');

create policy shifts_insert_manager on shifts
  for insert with check (
    auth_role() = 'manager'
    and hotel_id in (select auth_hotel_ids())
  );

create policy shifts_insert_staff on shifts
  for insert with check (
    auth_role() = 'staff'
    and staff_id = auth.uid()
    and status = 'requested'
  );

-- UPDATE: super_admin全件 / managerは自ホテル分(承認・却下含む)
-- staffは本人の未承認分のみ編集可(承認自体はできない= statusをapprovedに変更不可)
create policy shifts_update_admin on shifts
  for update using (auth_role() = 'super_admin');

create policy shifts_update_manager on shifts
  for update using (
    auth_role() = 'manager'
    and hotel_id in (select auth_hotel_ids())
  );

create policy shifts_update_self on shifts
  for update using (
    staff_id = auth.uid()
    and status = 'requested'
  )
  with check (
    staff_id = auth.uid()
    and status = 'requested'
  );

-- DELETE: super_admin全件 / managerは自ホテル分 / staffは本人の未承認分
create policy shifts_delete_admin on shifts
  for delete using (auth_role() = 'super_admin');

create policy shifts_delete_manager on shifts
  for delete using (
    auth_role() = 'manager'
    and hotel_id in (select auth_hotel_ids())
  );

create policy shifts_delete_self on shifts
  for delete using (
    staff_id = auth.uid()
    and status = 'requested'
  );

-- checkerにはINSERT/UPDATE/DELETEのポリシーを設定しない(=閲覧のみに限定される)

-- ---------------------------------------------------------
-- 7. daily_reports
-- ---------------------------------------------------------
alter table daily_reports enable row level security;

create policy daily_reports_select_admin on daily_reports
  for select using (auth_role() = 'super_admin');

create policy daily_reports_select_hotel_scoped on daily_reports
  for select using (
    auth_role() in ('manager', 'checker')
    and hotel_id in (select auth_hotel_ids())
  );

create policy daily_reports_insert_admin on daily_reports
  for insert with check (auth_role() = 'super_admin');

create policy daily_reports_insert_hotel_scoped on daily_reports
  for insert with check (
    auth_role() in ('manager', 'checker')
    and hotel_id in (select auth_hotel_ids())
  );

create policy daily_reports_update_admin on daily_reports
  for update using (auth_role() = 'super_admin');

create policy daily_reports_update_hotel_scoped on daily_reports
  for update using (
    auth_role() in ('manager', 'checker')
    and hotel_id in (select auth_hotel_ids())
  );

-- 削除は super_admin / manager のみ(checkerは入力・修正はできるが削除は不可)
create policy daily_reports_delete_admin on daily_reports
  for delete using (auth_role() = 'super_admin');

create policy daily_reports_delete_manager on daily_reports
  for delete using (
    auth_role() = 'manager'
    and hotel_id in (select auth_hotel_ids())
  );

-- ---------------------------------------------------------
-- 8. daily_report_details
--    (daily_report_id経由でhotel_idを判定するためEXISTSで親を参照)
-- ---------------------------------------------------------
alter table daily_report_details enable row level security;

create policy daily_report_details_select on daily_report_details
  for select using (
    exists (
      select 1 from daily_reports dr
      where dr.id = daily_report_details.daily_report_id
        and (
          auth_role() = 'super_admin'
          or (auth_role() in ('manager', 'checker')
              and dr.hotel_id in (select auth_hotel_ids()))
        )
    )
  );

create policy daily_report_details_insert on daily_report_details
  for insert with check (
    exists (
      select 1 from daily_reports dr
      where dr.id = daily_report_details.daily_report_id
        and (
          auth_role() = 'super_admin'
          or (auth_role() in ('manager', 'checker')
              and dr.hotel_id in (select auth_hotel_ids()))
        )
    )
  );

create policy daily_report_details_update on daily_report_details
  for update using (
    exists (
      select 1 from daily_reports dr
      where dr.id = daily_report_details.daily_report_id
        and (
          auth_role() = 'super_admin'
          or (auth_role() in ('manager', 'checker')
              and dr.hotel_id in (select auth_hotel_ids()))
        )
    )
  );

create policy daily_report_details_delete on daily_report_details
  for delete using (
    exists (
      select 1 from daily_reports dr
      where dr.id = daily_report_details.daily_report_id
        and (
          auth_role() = 'super_admin'
          or (auth_role() = 'manager'
              and dr.hotel_id in (select auth_hotel_ids()))
        )
    )
  );

-- ---------------------------------------------------------
-- 9. monthly_targets
--    checkerは仕様上アクセス不可のためポリシーを設定しない
-- ---------------------------------------------------------
alter table monthly_targets enable row level security;

create policy monthly_targets_select_admin on monthly_targets
  for select using (auth_role() = 'super_admin');

create policy monthly_targets_select_manager on monthly_targets
  for select using (
    auth_role() = 'manager'
    and hotel_id in (select auth_hotel_ids())
  );

create policy monthly_targets_insert_admin on monthly_targets
  for insert with check (auth_role() = 'super_admin');

create policy monthly_targets_insert_manager on monthly_targets
  for insert with check (
    auth_role() = 'manager'
    and hotel_id in (select auth_hotel_ids())
  );

create policy monthly_targets_update_admin on monthly_targets
  for update using (auth_role() = 'super_admin');

create policy monthly_targets_update_manager on monthly_targets
  for update using (
    auth_role() = 'manager'
    and hotel_id in (select auth_hotel_ids())
  );

create policy monthly_targets_delete_admin on monthly_targets
  for delete using (auth_role() = 'super_admin');

-- ---------------------------------------------------------
-- 10. invoices
-- ---------------------------------------------------------
alter table invoices enable row level security;

create policy invoices_select_admin on invoices
  for select using (auth_role() = 'super_admin');

create policy invoices_select_manager on invoices
  for select using (
    auth_role() = 'manager'
    and hotel_id in (select auth_hotel_ids())
  );

create policy invoices_insert_admin on invoices
  for insert with check (auth_role() = 'super_admin');

create policy invoices_insert_manager on invoices
  for insert with check (
    auth_role() = 'manager'
    and hotel_id in (select auth_hotel_ids())
  );

create policy invoices_update_admin on invoices
  for update using (auth_role() = 'super_admin');

create policy invoices_update_manager on invoices
  for update using (
    auth_role() = 'manager'
    and hotel_id in (select auth_hotel_ids())
  );

create policy invoices_delete_admin on invoices
  for delete using (auth_role() = 'super_admin');

-- ---------------------------------------------------------
-- 11. invoice_line_items(親invoiceのアクセス権に準拠)
-- ---------------------------------------------------------
alter table invoice_line_items enable row level security;

create policy invoice_line_items_select on invoice_line_items
  for select using (
    exists (
      select 1 from invoices inv
      where inv.id = invoice_line_items.invoice_id
        and (
          auth_role() = 'super_admin'
          or (auth_role() = 'manager'
              and inv.hotel_id in (select auth_hotel_ids()))
        )
    )
  );

create policy invoice_line_items_insert on invoice_line_items
  for insert with check (
    exists (
      select 1 from invoices inv
      where inv.id = invoice_line_items.invoice_id
        and (
          auth_role() = 'super_admin'
          or (auth_role() = 'manager'
              and inv.hotel_id in (select auth_hotel_ids()))
        )
    )
  );

create policy invoice_line_items_update on invoice_line_items
  for update using (
    exists (
      select 1 from invoices inv
      where inv.id = invoice_line_items.invoice_id
        and (
          auth_role() = 'super_admin'
          or (auth_role() = 'manager'
              and inv.hotel_id in (select auth_hotel_ids()))
        )
    )
  );

create policy invoice_line_items_delete on invoice_line_items
  for delete using (
    exists (
      select 1 from invoices inv
      where inv.id = invoice_line_items.invoice_id
        and auth_role() = 'super_admin'
    )
  );

-- =========================================================
-- 補足(実装メモ)
-- =========================================================
-- 1. スタッフ新規登録は Supabase Auth の auth.users 作成が必要なため、
--    実運用では「Supabase Admin API(service_role キー)」を使った
--    サーバーサイド処理(Next.js Route Handler等)で
--    auth.users作成 + profiles作成 をトランザクション的に行う想定。
--    service_role キーはRLSを完全にバイパスするため、上記の
--    profiles_insert_manager 等のポリシーは「クライアントから
--    直接操作するケース」への保険的な設定という位置付け。
--
-- 2. 月次請求明細(invoices)の生成ロジックは、月給スタッフの給与など
--    複数テーブルを横断して集計するため、Supabase Edge Function
--    (service_role実行)側で計算しinsertする方式を推奨。
--    その場合はRLSは適用されないが、生成トリガーとなるAPI呼び出し
--    自体をどのroleが実行できるかはアプリ側(Edge Function内)で
--    auth_role()相当のチェックを行うこと。
-- =========================================================
