import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LoginForm } from "@/components/login-form";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: { redirectedFrom?: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/dashboard");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>ホテル客室清掃管理システム</CardTitle>
          <CardDescription>登録済みのメールアドレスでログインしてください。</CardDescription>
        </CardHeader>
        <CardContent>
          <LoginForm redirectedFrom={searchParams.redirectedFrom} />
        </CardContent>
      </Card>
    </div>
  );
}
