import { notFound, redirect } from "next/navigation";
import { createClient, getCurrentProfile } from "@/lib/supabase/server";
import { StaffForm } from "@/components/staff-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { updateStaffAction } from "@/app/(dashboard)/admin/staff/actions";
import { ALL_ROLES, MANAGER_CREATABLE_ROLES } from "@/lib/constants";
import type { Hotel, Profile } from "@/lib/types/database.types";

export default async function EditStaffPage({ params }: { params: { id: string } }) {
  const profile = await getCurrentProfile();

  if (profile?.role !== "super_admin" && profile?.role !== "manager") {
    redirect("/dashboard");
  }

  const supabase = createClient();

  const [{ data: targetProfile }, { data: hotels }, { data: hotelStaffRows }] =
    await Promise.all([
      supabase.from("profiles").select("*").eq("id", params.id).maybeSingle(),
      supabase.from("hotels").select("*").order("name").returns<Hotel[]>(),
      supabase.from("hotel_staff").select("hotel_id").eq("staff_id", params.id),
    ]);

  const typedTarget = targetProfile as Profile | null;

  // RLSで見えない(=他ホテルのスタッフ等)場合はここでnullになる
  if (!typedTarget) {
    notFound();
  }

  // managerは管理者・マネージャーの編集はできない(自ホテルのstaff/checkerのみ)
  if (profile.role === "manager" && !MANAGER_CREATABLE_ROLES.includes(typedTarget.role)) {
    redirect("/admin/staff");
  }

  const allowedRoles = profile.role === "super_admin" ? ALL_ROLES : MANAGER_CREATABLE_ROLES;
  const initialHotelIds = (hotelStaffRows ?? []).map((row) => row.hotel_id as string);
  const boundAction = updateStaffAction.bind(null, typedTarget.id);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">スタッフ編集</h1>
        <p className="mt-1 text-sm text-muted-foreground">{typedTarget.name}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>スタッフ情報</CardTitle>
        </CardHeader>
        <CardContent>
          <StaffForm
            mode="edit"
            hotels={hotels ?? []}
            allowedRoles={allowedRoles}
            initialProfile={typedTarget}
            initialHotelIds={initialHotelIds}
            action={boundAction}
          />
        </CardContent>
      </Card>
    </div>
  );
}
