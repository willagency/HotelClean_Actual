import { createBrowserClient } from "@supabase/ssr";

// クライアントコンポーネント(フォームの送信処理など)から使用する。
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
