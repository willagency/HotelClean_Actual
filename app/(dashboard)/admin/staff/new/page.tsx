import { redirect } from "next/navigation";
import { createClient, getCurrentProfile } from "@/lib/supabase/server";
import { StaffForm } from "@/components/staff-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createStaffAction } from "@/app/(dashboard)/admin/staff/actions";
import { ALL_ROLES, MANAGER_CREATABLE_ROLES } from "@/lib/constants";
import type { Hotel } from "@/lib/types/database.types";

export default async function NewStaffPage() {
  const profile = await getCurrentProfile();

  if (profile?.role !== "super_admin" && profile?.role !== "manager") {
    redirect("/dashboard");
  }

  const supabase = createClient();
  // hotelsもRLSでスコープされているため、managerには自ホテルのみ返る
  const { data: hotels } = await supabase
    .from("hotels")
    .select("*")
    .order("name")
    .returns<Hotel[]>();

  const allowedRoles = profile.role === "super_admin" ? ALL_ROLES : MANAGER_CREATABLE_ROLES;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">新規スタッフ登録</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          ログインアカウントと合わせて登録します。初期パスワードは本人にお伝えください。
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>スタッフ情報</CardTitle>
        </CardHeader>
        <CardContent>
          <StaffForm
            mode="create"
            hotels={hotels ?? []}
            allowedRoles={allowedRoles}
            action={createStaffAction}
          />
        </CardContent>
      </Card>
    </div>
  );
}
