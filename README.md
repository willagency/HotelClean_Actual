# ホテル客室清掃管理システム(フェーズ1〜6: 全機能実装済み)

このフェーズで実装済みの機能:

- メール/パスワードによるログイン・ログアウト(Supabase Auth)
- ログイン状態・権限に応じたルート保護(middleware)
- role別サイドバー表示(super_admin / manager / checker / staff)
- ホテル一覧・新規登録・編集(客室タイプ別単価・担当支店・備考の設定を含む、super_adminのみ)
- スタッフ一覧・新規登録・編集(super_admin / managerのみ。managerは自ホテル分のstaff/checkerのみ操作可)
- スタッフ本人によるパスワード変更(全role共通、現在のパスワード確認あり)
- シフト申請(staffのみ)・シフト確認(一覧/カレンダー切替、super_admin・managerは承認/却下・代理登録も可能、checkerは閲覧のみ)
- 日報入力・実績管理(ホテル単位、客室タイプ別清掃完了数+調整金。super_admin/managerは削除可、checkerは入力のみ)
- 売上・目標管理ダッシュボード(全社/ホテル別のKPI・売上推移・客室タイプ別実績・目標達成率、月次目標の設定)
- 帳票出力(月次請求明細のPDFダウンロード、super_admin/managerのみ)

これで要件定義書にあった機能は一通り実装済みです。今後の改善候補は本READMEの各実装メモを参照してください。

## UI/UXリファクタリング(レスポンシブ対応)について

管理者(PC)・スタッフ(スマホ)それぞれの利用シーンに合わせて、以下の見直しを行っています。

- **配色・カードデザイン**: 背景は`bg-slate-50`、セクションは`bg-white rounded-xl shadow-sm border border-slate-100`のカード型に統一(`components/ui/card.tsx`)
- **ステータスバッジ**: `emerald-100/emerald-700`(完了系)・`blue-100/blue-700`(処理中系)・`rose-100/rose-700`(要対応系)の3色ピルに統一(`components/shift-status-badge.tsx`)
- **PC向けダッシュボード**: `grid grid-cols-1 lg:grid-cols-3`で、左1列にKPI、右2列にグラフ+テーブルを配置(`/dashboard`, `/dashboard/hotels/[hotelId]`)
- **スマホ向けスタッフ画面**: `/shifts/request`で「申請済みシフト一覧」を最上部に配置し、フォームは下部に。タップ操作(取り消しボタン)はモバイル時`size="lg"`(h-12)のカード型リストに切り替え(`components/shift-table.tsx`)
- **Recharts**: `ResponsiveContainer width="100%" height={300}`で統一し、`CartesianGrid`は横線のみ(`vertical={false}`, `stroke="#e2e8f0"`)。折れ線は`#3b82f6`(blue-500)、棒グラフは`#10b981`(emerald-500)を使用

**設計上の注意点**: 「本日の担当客室リスト」「客室単位の清掃ステータスをタップで変更」という要望は、現在のDB設計(ホテル単位・日次集計の`daily_reports`)には存在しない「部屋1室ごとのステータス管理」を意味します。今回はスタッフのモバイル最優先画面として`/shifts/request`(シフト申請/確認)にこのデザインシステムを適用しましたが、部屋単位のリアルタイムステータス管理を実装する場合は、`rooms`テーブルの新設を含む追加設計が必要です(今回は対応不要とのことで見送りました)。

## スタッフ管理画面のホテル別絞り込みについて

`/admin/staff`に以下を追加しました。

- **「所属ホテル」列**: スタッフごとに所属する全ホテル名を表示(複数ホテル兼任の場合はカンマ区切りではなく読点区切りで並記)
- **ホテル絞り込みフィルタ**: 選択したホテルに所属するスタッフだけに絞り込み可能(ホテルが2件以上ある場合のみ表示)

以前の一覧には所属ホテルを示す列がなく、super_adminが複数ホテルを見るときに全スタッフが混在して見づらいという課題がありました。managerはRLSにより元々自ホテルのスタッフしか見えない設計になっているため、この課題は主にsuper_adminにとって影響がありましたが、修正後はどちらのroleでも同じ画面で快適に確認できます。

`/admin/staff`には氏名の部分一致検索(`q`パラメータ)も追加しています。ホテル絞り込みと同じフォームから同時に指定でき、`ilike`による大文字小文字を区別しない部分一致検索です。

**スタッフ数が数百人規模になる想定のため、`010_staff_name_trigram_search.sql`で`pg_trgm`拡張機能とGINトライグラムインデックス(`idx_profiles_name_trgm`)を追加しました。** アプリ側のコード変更は不要で、既存の`ilike`検索がそのままインデックスの恩恵を受けます。

**このインデックスの特性・トレードオフ**

- GINインデックスはbtreeよりinsert/update時の書き込みコストが高くなります(スタッフ登録・編集の頻度はそこまで高くないため、実運用上は問題にならない想定です)
- トライグラムは3文字単位のn-gramで文字列を扱うため、「田中」のような1〜2文字の検索語には絞り込み効果が薄くなります(動作はしますが、候補数がフルスキャンに近くなることがあります)。3文字以上の検索であれば十分な効果が出ます

## ホテル管理・スタッフ管理の削除機能について

`/admin/hotels`と`/admin/staff`にそれぞれ削除ボタンを追加しました
(`components/delete-button.tsx`、確認ダイアログ付き)。

**削除には設計上、意図的な制約があります。**

- **ホテル削除**: `hotel_room_prices` / `hotel_staff` / `shifts` /
  `daily_reports`(→`daily_report_details`) / `monthly_targets` /
  `invoices`(→`invoice_line_items`)は`on delete cascade`のため、
  ホテルを削除するとこれらの履歴も連鎖的に削除されます。一方
  `profiles.primary_hotel_id`は`on delete restrict`のため、**そのホテルを
  主所属としているスタッフが1人でも残っていると削除自体が失敗**します
  (エラーコード`23503`を検知し、分かりやすいメッセージに変換しています)。
- **スタッフ削除**: `admin.deleteUser()`で`auth.users`ごと削除します
  (`profiles`は`on delete cascade`で連動)。ただし`shifts.approved_by` /
  `daily_reports.created_by` / `invoices.generated_by`は`profiles(id)`を
  cascadeなしで参照しているため、**日報入力・シフト承認・請求明細発行の
  履歴が1件でもあると削除は失敗**します(履歴の入力者が消えるのを防ぐため
  の意図的な制約です)。削除できるのは`super_admin`のみで、自分自身も
  削除できないようにガードしています。

このため、**履歴のあるホテル/スタッフを「使わなくする」場合は、削除ではなく
既存の`is_active`(利用停止/退職)フラグの利用を推奨します。** 削除は主に
「登録直後で履歴が何もない、誤登録の取り消し」用途を想定した機能です。

## 留学生の週28時間ルール対応について(重要な訂正あり)

**旧バージョン(フェーズ10)の「月曜〜日曜の暦週」判定は、入管法上の解釈として誤りでした。**
正しくは「起算日を問わず、任意の連続7日間で合計28時間以内」であり、
`009_rolling_weekly_hours.sql`でローリング7日間判定に置き換えています。

### 実装内容

1. **ローリング7日間バリデーション**(`lib/rolling-hours.ts`)
   - シフト申請・代理登録の際、対象日を含みうる7通りの「7日間の窓」それぞれの
     合計時間を計算し、最大値が上限を超える場合は**登録自体をエラーで拒否**します
     (スタッフ自己申請・マネージャー代理登録の両方で同じロジックを使用)。
   - ダッシュボード側のアラート(`get_weekly_hour_alerts`)も同じ考え方で、
     「各シフト日を7日間窓の終値日として全てチェックする」方式に統一しています
     (数学的に、暦週ではなく実働日を窓の終了日として全て確認すれば、
     任意の7日間の違反を漏れなく検出できます)。
2. **長期休業期間モード**(`profiles.is_long_vacation_mode`)
   - スタッフ編集画面にトグルスイッチを追加。ONの間は上限が
     「1日8時間・任意の連続7日間で40時間」に緩和されます。
3. **他社勤務の自己申告(掛け持ち対応、スマホ向け)**
   - `shifts.other_company_hours`(その勤務日に他社で働く予定の時間)と
     `shifts.other_company_confirmed`(規定時間内であることの確認チェック)を追加。
   - スタッフ本人のシフト申請フォーム(`/shifts/request`)に、留学生フラグがONの
     場合のみ入力欄と確認チェックボックスを表示します。確認チェックが
     入っていない場合は申請できません。

### 引き続き残る制約(コンプライアンス運用上ご留意ください)

- 自己申告された他社勤務時間はあくまで**本人の申告ベース**であり、システムが
  他社の実際の勤務記録を検証することはできません。
- 長期休業期間モードのON/OFFは手動切り替えです。学校のカレンダーと連動した
  自動切り替えは行っていません(学期・休暇期間の管理は運用でカバーする想定)。
- managerは自分の担当ホテルのシフトしか見えないため、対象者が他のホテル
  (別のマネージャー担当)でも働いている場合、managerには合計時間の一部しか
  見えません。全ホテル横断の正確な合計を確認できるのは`super_admin`のみです。

## シフト確認画面のステータス絞り込みについて

`/shifts/calendar`に「ステータス」での絞り込み(申請中/承認済み/却下/すべて)を
追加しました。ホテル・月の絞り込みと同じフォームから一緒に指定できます。

- 承認者(super_admin/manager)向けに、その月の「申請中」件数を件数付きの
  クイックリンクとして画面上部に表示します(0件の場合は非表示)。クリックすると
  `status=requested`で絞り込んだ状態にジャンプします。
- 「申請中」件数はステータス絞り込みの選択状態に関わらず、ホテル・月の
  条件だけで常に正しい値を表示するよう別クエリで計算しています
  (絞り込みで表示が0件になっても、クイックリンクの数字がつられて
  0にならないようにするためです)。

---

## セットアップ手順

### 1. 依存パッケージのインストール

```bash
npm install
```

### 2. Supabaseプロジェクトの準備

1. Supabaseでプロジェクトを作成
2. `supabase/migrations/` 配下のSQLを **番号順に** SQL Editorで実行
   - `001_create_tables.sql`(テーブル定義)
   - `002_rls_policies.sql`(RLSポリシー)
   - `003_hotel_upsert_function.sql`(ホテル登録/編集用RPC)
   - `004_add_hotel_branch_and_notes.sql`(担当支店・備考カラム追加)
   - `005_daily_report_upsert_function.sql`(日報登録/更新用RPC)
   - `006_dashboard_summary_functions.sql`(ダッシュボード集計関数 + 目標テーブルのユニーク制約修正)
   - `007_invoice_snapshot_function.sql`(請求明細スナップショット生成用RPC)
   - `008_international_student_hours.sql`(留学生フラグ + 週28時間アラート集計関数)
   - `009_rolling_weekly_hours.sql`(★重要な訂正: 暦週判定→任意の連続7日間判定に修正、長期休業モード、他社勤務自己申告を追加)
   - `010_staff_name_trigram_search.sql`(スタッフ氏名検索用のpg_trgmトライグラムインデックス)
   - `011_attendance_tracking.sql`(出勤実績記録 + 週28/40時間判定を実績優先に変更)
   - `012_shift_templates.sql`(シフト時間帯マスタ + 目標稼働人員数 + 充足差分集計)

### 2-1. 請求明細PDF用の日本語フォントを配置(帳票出力機能に必須)

`public/fonts/README.md`の手順に従い、`NotoSansJP-Regular.ttf`を
`public/fonts/`に配置してください。配置しないと請求明細のPDFダウンロード時に
エラーになります(ビルド自体には影響しません)。

### 3. 環境変数の設定

`.env.local.example` を `.env.local` にコピーし、Supabaseダッシュボード
(Project Settings > API)の値を設定してください。

```bash
cp .env.local.example .env.local
```

**`SUPABASE_SERVICE_ROLE_KEY`はスタッフ登録機能(auth.users作成)で
必須になりました。** 設定を忘れると新規スタッフ登録時にエラーになります。
このキーは強い権限を持つため、`.env.local`をGit管理に含めない・
本番環境ではサーバー側のシークレット管理機能を使う、を徹底してください。

### 4. 最初のsuper_adminユーザーを作成(初回のみ・手動)

`profiles`への新規登録は「super_adminがmanagerを登録する」ような、
既にログイン済みのsuper_adminがいる前提のRLSになっています。
そのため**最初の1人だけ**は以下の手順で手動作成してください。

また、`profiles`には「月給スタッフ(全体管理者を含む)は必ず`primary_hotel_id`を
持つ」というDBトリガーによる制約が入っているため、**先にホテルを1件だけ
SQLで作成してから**、そのIDを管理者プロフィールに紐づける必要があります。

1. Supabaseダッシュボード > Authentication > Users から
   「Add user」で管理者用のメールアドレス・パスワードを作成
   (作成されたUserのUIDをコピーしておく)
2. SQL Editorで以下を実行し、まずホテルを1件作成してIDを控える
   (実際の1件目のホテル、または便宜上の「本社」扱いのレコードでも可。
   後から`/admin/hotels`の編集画面で内容は書き換えられます)

```sql
insert into hotels (name)
values ('本社')
returning id;
```

3. 控えたホテルのUUIDを使い、UIDとメールアドレスも実際の値に置き換えて実行

```sql
insert into profiles (id, name, email, role, salary_type, salary_amount, primary_hotel_id)
values (
  'コピーしたUID',
  '管理者 太郎',
  'admin@example.com',
  'super_admin',
  'monthly',
  0,
  '手順2で返ってきたホテルのUUID'
);
```

以降のスタッフ登録は、このsuper_adminでログインした状態で
(フェーズ2で実装予定の)スタッフ登録画面から行う想定です。

### 5. 開発サーバー起動

```bash
npm run dev
```

`http://localhost:3000` にアクセスし、作成したsuper_adminアカウントで
ログインしてください。ログイン後 `/admin/hotels` からホテルを登録できます。

---

## ディレクトリ構成(抜粋)

```
app/
  login/page.tsx                 … ログイン画面
  (dashboard)/
    layout.tsx                   … 認証チェック + サイドバー
    actions.ts                   … サインアウト
    dashboard/page.tsx           … ダッシュボード(プレースホルダー)
    admin/hotels/
      page.tsx                   … ホテル一覧
      new/page.tsx                … 新規登録
      [id]/edit/page.tsx          … 編集
      actions.ts                  … 登録/更新 Server Actions
    admin/staff/
      page.tsx                   … スタッフ一覧
      new/page.tsx                … 新規登録(auth.users作成込み)
      [id]/edit/page.tsx          … 編集
      actions.ts                  … 登録/更新 Server Actions
    account/password/page.tsx    … 本人によるパスワード変更(全role)
    shifts/
      request/page.tsx            … シフト申請(staffのみ)
      calendar/page.tsx            … シフト確認(一覧/カレンダー、承認・却下・代理登録)
      actions.ts                   … 申請/承認/却下/取消/代理登録 Server Actions
    reports/daily/
      page.tsx                     … 日報一覧(月・ホテルで絞り込み)
      new/page.tsx                  … 新規日報入力
      [id]/edit/page.tsx            … 日報編集
      actions.ts                    … 登録/更新/削除 Server Actions
    dashboard/
      page.tsx                       … ダッシュボードトップ(role別に出し分け)
      hotels/[hotelId]/page.tsx      … ホテル別ダッシュボード
    targets/
      page.tsx                       … 目標管理(設定フォーム+履歴)
      actions.ts                     … 目標保存 Server Action
    billing/
      page.tsx                       … 請求明細(集計プレビュー+確定発行+発行履歴)
      actions.ts                     … 発行/削除 Server Actions
  api/invoices/[invoiceId]/pdf/
    route.ts                         … 請求明細PDFダウンロード(Node.js Runtime)
components/
  login-form.tsx
  app-sidebar.tsx
  hotel-form.tsx
  room-price-editor.tsx
  staff-form.tsx
  change-password-form.tsx
  shift-request-form.tsx
  manager-shift-form.tsx
  shift-table.tsx
  shift-status-badge.tsx
  shift-calendar-grid.tsx
  daily-report-form.tsx
  daily-report-row-actions.tsx
  target-form.tsx
  billing-panel.tsx
  dashboard/
    kpi-card.tsx
    progress-bar.tsx
    sales-trend-chart.tsx
    room-type-breakdown-chart.tsx
    hotel-ranking-table.tsx
  ui/                             … button / input / label / card / table / alert / textarea
public/fonts/                     … 請求明細PDF用の日本語フォント配置場所(README参照)
lib/
  supabase/client.ts              … ブラウザ用クライアント
  supabase/server.ts              … サーバー用クライアント + getCurrentProfile()
  supabase/admin.ts               … service_role クライアント(スタッフ作成専用)
  types/database.types.ts         … DB型定義(手動)
  constants.ts                    … role/salary_type/shift statusの日本語ラベル等
  date-utils.ts                   … 月次カレンダー計算用ユーティリティ
middleware.ts                     … セッション維持 + 未ログインリダイレクト
supabase/migrations/              … これまで合意したSQL一式
```

## スタッフ登録の実装メモ

- `auth.users`の作成は`service_role`キーを使った管理者クライアント
  (`lib/supabase/admin.ts`)でのみ行います。
- `profiles` / `hotel_staff` への書き込みは、ログイン中ユーザーの
  セッション付きクライアント(通常のRLS)で行います。これにより
  「managerはstaff/checkerしか作成できない」「自ホテル以外には
  割り当てられない」といった権限チェックをDB(RLS)側に一元化しています。
- `profiles`または`hotel_staff`への書き込みに失敗した場合は、
  直前に作成した`auth.users`を削除してロールバックし、
  ログインだけできて実体のないアカウントが残らないようにしています。
- 初期パスワードは登録者(管理者/マネージャー)が設定してその場で
  本人に伝える方式です。招待メール経由のパスワード設定や、
  本人によるパスワード変更機能は未実装(今後のフェーズで対応予定)。

## パスワード変更の実装メモ

- `/account/password` は全role共通のページで、サイドバーからいつでも遷移できます。
- Supabaseの`auth.updateUser()`はログインセッションが有効なら現在の
  パスワードを知らなくても実行できてしまうため、離席中の悪用を防ぐ目的で
  **先に`signInWithPassword`で現在のパスワードを検証してから**
  `updateUser`を呼ぶ、という2段階の実装にしています。
- ブラウザ側のクライアント(`lib/supabase/client.ts`)のみで完結しており、
  Server Action・DBスキーマの変更はありません。

## シフト申請・シフト確認の実装メモ

- **申請(`/shifts/request`)はstaff roleのみ**アクセス可能です(RLSの
  `shifts_insert_staff`もrole='staff'限定のため、他roleは自分の申請ができません)。
  申請中(`requested`)のシフトのみ本人が取り消せます。
- **確認(`/shifts/calendar`)** は月・ホテル・表示形式(一覧/カレンダー)を
  URLクエリパラメータ(`?month=2026-07&view=calendar&hotel_id=...`)で
  管理しているため、リンクを直接共有・ブックマークできます。
- 承認・却下ボタンはsuper_admin/managerにのみ表示されます。
  checkerには承認系のUPDATEポリシー自体がRLSに存在しないため、
  画面側でボタンを出さないことで二重に防いでいます。
- super_admin/managerは「シフトを代理登録」フォームから、スタッフの
  シフトを直接(承認済み扱いで)登録できます。口頭連絡の代理入力などを想定。
- カレンダー表示は追加ライブラリを使わず、`lib/date-utils.ts`の
  素朴な日付計算のみで実装しています。

## 日報入力・実績管理の実装メモ

- 日報本体(`daily_reports`)と客室タイプ別実績(`daily_report_details`)は
  ホテル登録と同様に`upsert_daily_report`というRPC関数でアトミックに保存しています。
- **同一ホテル・同一日の日報が既に存在する場合は、新規作成のつもりで
  保存しても自動的に上書き更新されます**(`unique(hotel_id, report_date)`と
  `on conflict`を利用)。「後から同じ日の日報を直す」運用を自然に許容する設計です。
- 編集画面ではホテル・対象日は変更不可(表示のみ)にしています。日付を
  変えたい場合は新規作成としてやり直す想定です。
- 入力中の客室タイプ別室数と`hotel_room_prices`(単価)から、
  クライアント側でリアルタイムに「概算売上(人件費差引前)」をプレビュー表示しています。
  実際の人件費控除後の売上は今後実装予定のダッシュボード機能で計算します。
- 削除は`super_admin`/`manager`のみ(RLSの`daily_reports_delete_admin` /
  `_delete_manager`と一致)。checkerには削除ボタン自体を表示していません。

## 売上・目標管理ダッシュボードの実装メモ

- 集計ロジック(売上計算式・時給/月給人件費の按分)は**すべてPostgreSQL関数
  (`006_dashboard_summary_functions.sql`)側に実装**しています。
  アプリ側はRPCを呼んで結果を表示するだけなので、計算式を変更したい場合は
  このSQLファイルを直せば全画面に反映されます。
  - `get_hotel_monthly_summary` / `get_overall_monthly_summary`:
    ホテル単位・全社の月次サマリー(売上・清掃室数・人件費内訳・目標比較)
  - `get_all_hotels_monthly_summary`: 全ホテル分をまとめて取得(ランキング表示用)
  - `get_hotel_room_type_breakdown`: 客室タイプ別の当月実績
  - `get_hotel_sales_trend` / `get_overall_sales_trend`: 直近6ヶ月の売上推移
- これらの関数は`security invoker`のため、呼び出したユーザーのRLSがそのまま
  適用されます(managerが自分のホテル以外のIDを渡しても、その集計対象データが
  RLSで見えないため実質0件・0円になるだけで、情報漏洩にはなりません)。
- **`monthly_targets`のユニーク制約の不具合を合わせて修正しました。**
  `unique(hotel_id, year_month)`はSQLの仕様上「hotel_idがnull同士は
  区別される」ため、全社目標(`hotel_id is null`)が同じ年月で複数登録
  できてしまう欠陥がありました。生成列`hotel_key`(nullを固定UUIDに
  正規化)を使った制約に置き換えることで解消しています。
- 目標の保存(`saveMonthlyTargetAction`)は`supabase-js`標準の`.upsert()`
  (`onConflict: 'hotel_key,year_month'`)だけで実装しており、
  ホテル登録/日報のような専用RPC関数は不要でした。
- 全社ダッシュボードはsuper_adminのみ。manager/checkerは自分の担当ホテルの
  ダッシュボードに自動的に案内されます(担当が複数ある場合は選択画面を表示)。
- チャートは`recharts`を使用しています(折れ線グラフ: 売上推移、棒グラフ:
  客室タイプ別実績)。目標達成率は数値の変動が大きくなりがちなため、
  あえてシンプルなCSSベースのプログレスバーで表現しています。

## スマホ表示の崩れ修正について

**主な原因は、PC向けに固定幅(`w-60`)で常時表示していたサイドバーでした。**
スマホ幅(375px前後)だとサイドバーだけで画面の大半を占め、残りの
非常に狭い領域にテーブルやカードを詰め込もうとして表示が崩れていました。

### 対応内容

- `components/app-sidebar.tsx`を**ハンバーガーメニュー+ドロワー形式**に変更
  - `lg`未満: 常時は非表示。左上のハンバーガーボタンをタップすると、
    左からスライドインするドロワーメニューが開く(背景オーバーレイ付き、
    画面遷移時は自動的に閉じる)
  - `lg`以上: 従来通り常時表示の固定サイドバーのまま
- `app/(dashboard)/layout.tsx`のコンテンツ側に`min-w-0`を追加
  - flexboxの既知の仕様として、子要素は明示的に`min-w-0`を指定しない限り
    中身(表など)の実サイズより縮まないため、これが無いとテーブルを含む
    ページ全体が横方向にはみ出す原因になります。地味ですが重要な修正です。
- シフト確認・日報一覧・ホテル管理などの絞り込みフォームに`flex-wrap`が
  抜けていた箇所を修正し、スマホ幅でボタンや`<select>`が画面外にはみ出さず
  自然に折り返す/縦積みになるようにしました。

### 今後見ていただきたい点

- 上記は主要な原因(固定サイドバー・flexboxの縮小仕様・折り返し漏れ)への
  対応です。個別のフォームやテーブルでまだ窮屈に見える箇所があれば、
  スクリーンショット等で教えていただけると、ピンポイントで調整できます。

## シフト申請画面(スマホ)の使い勝手改善について

申請済みシフトが増えると「新規申請」フォームに辿り着くまでのスクロールが
長くなる、というご指摘への対応です。

- **「新規申請はこちら」ジャンプボタン**をページ上部(申請済みシフト一覧より前)
  に設置しました。タップすると`#new-request-form`までスムーズスクロールで
  移動します(`app/globals.css`に`scroll-behavior: smooth`を追加)。
  スティッキーなモバイル上部バーに隠れないよう、ジャンプ先のカードには
  `scroll-mt-20`で余白を持たせています。
- **「申請済みシフト」に月絞り込み(前月/翌月)を追加**し、既定では当月分のみ
  表示するようにしました。他の一覧画面(シフト確認・日報一覧など)と
  同じ操作感です。

## 出勤状況確認画面について(実績優先の週28/40時間判定への変更を含む)

`/attendance`(super_admin/managerのみ)を新規追加しました。タイムカードの
実働時間を手動入力し、シフト予定との差異・週の労働時間状況を確認できます。

### 実装内容

- `shifts`テーブルに`actual_start_time` / `actual_end_time` / `break_minutes`
  を追加(1シフトにつき1件の実績を記録する構造)。
- `get_attendance_rows(hotel_id, year_month)` RPCで、承認済みシフトごとに
  氏名・シフト予定・実績・差異・直近7日間合計・週の残り時間をまとめて取得。
- 各行にインライン編集フォーム(出勤/退勤時刻・休憩分)を表示し、
  その場で保存できます(`saveAttendanceAction`。既存のRLS
  `shifts_update_manager` / `_update_admin`をそのまま利用、追加のRLS変更は不要)。
- 留学生かつ「週の残り時間が4時間以内」の行はアンバー、
  「週の上限を超過」している行はローズで行全体をハイライトします。
- スタッフ別の当月実働時間合計も画面上部に表示します。

### 【重要】週28/40時間判定を「実績優先」に変更

これまでの判定(シフト確認画面のアラート・シフト申請時のチェック)は
**シフトの予定時間**を基準にしていましたが、予定と実績の乖離が問題になって
いるとのご相談を受け、**実績(タイムカード入力)が存在する日はそちらを優先し、
未入力の日(未来の予定など)はシフト予定時間で代用する**方式に変更しました。
`get_weekly_hour_alerts`関数と、シフト申請時のバリデーション
(`validateInternationalStudentHours`)の両方に反映済みです。

### 引き続き残る制約

- 実績はタイムカードからの手動入力のため、入力タイミングの遅れは避けられません。
- 実績はシフトの予定に対する1:1の記録のため、**シフト自体が存在しない日の
  実績は入力できません**(シフト申請・代理登録のない勤務は想定外です)。
- 深夜0時をまたぐ勤務には対応していません(既存のシフト予定と同じ制約です)。
- 出勤状況確認画面の閲覧・入力はsuper_admin/managerのみです。checkerを
  含めたい場合は追加対応が必要です。

## シフト時間帯マスタ・目標稼働人員数・充足差分について

### 実装内容

- **ホテル登録/編集画面に「シフト時間帯」の設定欄を追加**しました
  (最大5つ。時間帯名・開始/終了時刻・目標稼働人員数)。`shift_templates`
  テーブルに保存し、DBトリガーで「1ホテルにつき最大5つ」を強制しています。
- **スタッフのシフト申請画面は、ホテルに時間帯が1つでも登録されていれば
  「登録済み時間帯から選択」する方式に変わります。** まだ時間帯が登録されて
  いないホテルは、これまで通り自由入力にフォールバックします(移行期の互換性)。
  マネージャーの代理登録フォームも同様です。
- 申請・代理登録時に送られてくる`shift_template_id`は、**クライアントの
  自己申告(start_time/end_time)を信用せず、サーバー側でテンプレートから
  正しい時刻を引き直しています**(改ざん防止)。
- **`/shifts/calendar`で特定のホテルを選択している時のみ**、「人員充足状況
  (目標人数との差分)」テーブルを表示します。時間帯×日付ごとに、目標人数・
  承認済みシフト数・差分(不足/余裕)を確認できます(`get_shift_template_staffing`
  RPC)。複数ホテルをまたいだ比較はできないため、「すべてのホテル」表示時は
  この差分テーブル自体を表示しません。

### 引き続き残る制約

- 目標稼働人員数は時間帯ごとに固定の値です(曜日別・繁忙日別の目標設定は
  未対応。将来の拡張ポイントです)。
- この機能導入前に自由入力で登録済みだった過去のシフトには時間帯の紐付けが
  なく、差分集計・充足状況には反映されません(遡及的な紐付けは行いません)。

## 帳票出力(月次請求明細PDF)の実装メモ

- **「確定保存」と「PDF生成」を分離**しています。
  - 確定保存: `upsert_invoice_snapshot` RPC(security invoker)が
    `get_hotel_monthly_summary`の内容を`invoices`/`invoice_line_items`に
    スナップショットとして保存します。同一ホテル・同一年月であれば
    最新実績で上書きされます。
  - PDF生成: `app/api/invoices/[invoiceId]/pdf/route.ts`
    (Node.js Runtime)が、保存されたスナップショットから**ダウンロードの
    都度PDFを組み立てて返す**方式です。Supabase Storageへのファイル保存は
    行っていないため、追加のバケット設定は不要です。
- PDF生成には`pdf-lib` + `@pdf-lib/fontkit`を使用しています。
  `pdf-lib`の標準フォントは日本語に対応していないため、
  **日本語TTFフォント(`public/fonts/NotoSansJP-Regular.ttf`)を
  別途配置する必要があります**(ライセンスの関係でリポジトリには
  同梱していません。`public/fonts/README.md`に入手手順を記載しています)。
  配置し忘れた場合はダウンロード時にエラーメッセージが返り、
  ビルド自体は失敗しません。
- 請求明細PDFのダウンロードURL(`/api/invoices/{id}/pdf`)は、
  Route Handler内で`invoices`テーブルをRLS付きクライアントで
  取得しているため、閲覧権限のない請求明細には404が返ります。
- 削除は`super_admin`のみ(RLSの`invoices_delete_admin`と一致)。
  今回のUIには削除ボタンを設けていません(必要であれば追加できます)。

## 実装上のメモ

- ホテル登録/編集は `upsert_hotel_with_prices` というPostgres関数(RPC)を
  1回呼ぶことで、`hotels` と `hotel_room_prices` をアトミックに更新しています。
  この関数は `security invoker` のため、実行時にもRLS
  (`hotels_insert_admin` など)がそのまま効きます。
- Server Actionは `redirect()` を内部で呼ばず `{ error: string | null }` を
  返す設計にしています。クライアント側の `try/catch` で `redirect()` の
  例外を誤って握りつぶさないようにするためです。
- スタッフの新規作成(`auth.users`作成が必要)は `service_role` キーを使う
  サーバー処理が必要なため、フェーズ2でRoute Handlerとして実装予定です。
