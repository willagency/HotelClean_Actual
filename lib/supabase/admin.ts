import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// service_role キーを使った管理者クライアント。
// auth.users の作成・削除など、通常のRLS付きクライアントでは
// 実行できない操作にのみ使用する。
//
// 重要: このファイルは Server Action / Route Handler など
// サーバー専用のコードからのみ import すること。
// クライアントコンポーネントに混ざるとservice_roleキーが
// バンドルに含まれてしまうため絶対に避けること。
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}
