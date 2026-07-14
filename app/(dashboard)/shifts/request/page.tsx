import Link from "next/link";
import { ArrowDown } from "lucide-react";
import { redirect } from "next/navigation";
import { createClient, getCurrentProfile } from "@/lib/supabase/server";
import { ShiftRequestForm } from "@/components/shift-request-form";
import { ShiftTable } from "@/components/shift-table";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentYearMonth, getMonthRange, shiftYearMonth } from "@/lib/date-utils";
import { createShiftRequestAction, cancelShiftRequestAction } from "@/app/(dashboard)/shifts/actions";
import type { Hotel, ShiftWithRelations } from "@/lib/types/database.types";

export default async function ShiftRequestPage({
  searchParams,
}: {
  searchParams: { month?: string };
}) {
  const profile = await getCurrentProfile();

  // シフト申請はstaff roleのみ(RLS上もshifts_insert_staffがrole='staff'限定)
  if (profile?.role !== "staff") {
    redirect("/shifts/calendar");
  }

  const yearMonth = searchParams.month || getCurrentYearMonth();
  const { firstDay, lastDay } = getMonthRange(yearMonth);

  const supabase = createClient();

  const [{ data: hotels }, { data: shifts }] = await Promise.all([
    supabase.from("hotels").select("*").order("name").returns<Hotel[]>(),
    supabase
      .from("shifts")
      .select("*, hotel:hotels(name), staff:profiles!shifts_staff_id_fkey(name)")
      .eq("staff_id", profile.id)
      .gte("work_date", firstDay)
      .lte("work_date", lastDay)
      .order("work_date", { ascending: false })
      .returns<ShiftWithRelations[]>(),
  ]);

  const buildHref = (month: string) => `/shifts/request?month=${month}`;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">シフト申請</h1>
        <p className="mt-1 text-sm text-slate-500">
          希望する勤務日・時間を申請してください。承認されるまでは内容の取り消しができます。
        </p>
      </div>

      {/* ファーストビューで「新規申請」まで一気にジャンプできるボタン。
          申請済みシフトが増えてもスクロールに悩まないようにするため。 */}
      <a
        href="#new-request-form"
        className={buttonVariants({ size: "lg", className: "w-full justify-center gap-2 sm:w-auto" })}
      >
        <ArrowDown className="h-4 w-4" />
        新規申請はこちら
      </a>

      <div>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">申請済みシフト</h2>
          <div className="flex items-center gap-2">
            <Link href={buildHref(shiftYearMonth(yearMonth, -1))}>
              <Button type="button" variant="outline" size="sm">
                前月
              </Button>
            </Link>
            <span className="min-w-[90px] text-center text-sm font-medium">{yearMonth}</span>
            <Link href={buildHref(shiftYearMonth(yearMonth, 1))}>
              <Button type="button" variant="outline" size="sm">
                翌月
              </Button>
            </Link>
          </div>
        </div>

        <ShiftTable
          shifts={shifts ?? []}
          mode="self"
          onCancel={cancelShiftRequestAction}
        />
      </div>

      <Card id="new-request-form" className="scroll-mt-20">
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
