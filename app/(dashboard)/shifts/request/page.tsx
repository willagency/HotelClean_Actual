import { redirect } from "next/navigation";
import { createClient, getCurrentProfile } from "@/lib/supabase/server";
import { ShiftRequestForm } from "@/components/shift-request-form";
import { ShiftTable } from "@/components/shift-table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createShiftRequestAction, cancelShiftRequestAction } from "@/app/(dashboard)/shifts/actions";
import type { Hotel, ShiftWithRelations } from "@/lib/types/database.types";

export default async function ShiftRequestPage() {
  const profile = await getCurrentProfile();

  // シフト申請はstaff roleのみ(RLS上もshifts_insert_staffがrole='staff'限定)
  if (profile?.role !== "staff") {
    redirect("/shifts/calendar");
  }

  const supabase = createClient();

  const [{ data: hotels }, { data: shifts }] = await Promise.all([
    supabase.from("hotels").select("*").order("name").returns<Hotel[]>(),
    supabase
      .from("shifts")
      .select("*, hotel:hotels(name), staff:profiles!shifts_staff_id_fkey(name)")
      .eq("staff_id", profile.id)
      .order("work_date", { ascending: false })
      .returns<ShiftWithRelations[]>(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">シフト申請</h1>
        <p className="mt-1 text-sm text-slate-500">
          希望する勤務日・時間を申請してください。承認されるまでは内容の取り消しができます。
        </p>
      </div>

      <div>
        <h2 className="mb-3 text-lg font-semibold">申請済みシフト</h2>
        <ShiftTable
          shifts={shifts ?? []}
          mode="self"
          onCancel={cancelShiftRequestAction}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>新規申請</CardTitle>
        </CardHeader>
        <CardContent>
          <ShiftRequestForm
            hotels={hotels ?? []}
            isInternationalStudent={profile.is_international_student}
            isLongVacationMode={profile.is_long_vacation_mode}
            action={createShiftRequestAction}
          />
        </CardContent>
      </Card>
    </div>
  );
}
