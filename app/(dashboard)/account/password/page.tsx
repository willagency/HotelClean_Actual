import { getCurrentProfile } from "@/lib/supabase/server";
import { ChangePasswordForm } from "@/components/change-password-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default async function ChangePasswordPage() {
  const profile = await getCurrentProfile();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">パスワード変更</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          ログイン用パスワードを変更します。
        </p>
      </div>

      <Card className="max-w-md">
        <CardHeader>
          <CardTitle>{profile?.name}</CardTitle>
          <CardDescription>{profile?.email}</CardDescription>
        </CardHeader>
        <CardContent>
          <ChangePasswordForm email={profile?.email ?? ""} />
        </CardContent>
      </Card>
    </div>
  );
}
