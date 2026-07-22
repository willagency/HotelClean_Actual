import Link from "next/link";
import { createClient, getCurrentProfile } from "@/lib/supabase/server";
import { ShiftTable } from "@/components/shift-table";
import { ShiftCalendarGrid } from "@/components/shift-calendar-grid";
import { ManagerShiftForm } from "@/components/manager-shift-form";
import { WeeklyHourAlertBanner } from "@/components/weekly-hour-alert-banner";
import { ShiftStaffingTable } from "@/components/shift-staffing-table";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { getCurrentYearMonth, getMonthRange, shiftYearMonth } from "@/lib/date-utils";
import {
  approveShiftAction,
  cancelShiftRequestAction,
  createShiftForStaffAction,
  rejectShiftAction,
} from "@/app/(dashboard)/shifts/actions";
import type {
  Hotel,
  Profile,
  ShiftTemplate,
  ShiftTemplateStaffingRow,
  ShiftWithRelations,
  UserRole,
  WeeklyHourAlert,
} from "@/lib/types/database.types";

function buildHref(params: Record<string, string>) {
  const search = new URLSearchParams(params).toString();
  return `/shifts/calendar?${search}`;
}

export default async function ShiftCalendarPage({
  searchParams,
}: {
  searchParams: { month?: string; view?: string; hotel_id?: string; status?: string };
}) {
  const profile = await getCurrentProfile();
  const role = profile?.role as UserRole;

  const yearMonth = searchParams.month || getCurrentYearMonth();
  const view = searchParams.view === "calendar" ? "calendar" : "list";
  const hotelId = searchParams.hotel_id || "";
  const status =
    searchParams.status === "requested" ||
    searchParams.status === "approved" ||
    searchParams.status === "rejected"
      ? searchParams.status
      : "";
  const { firstDay, lastDay } = getMonthRange(yearMonth);

  const supabase = createClient();

  // hotelsはRLSでスコープされる(super_admin全件 / manager・checker・staffは自ホテルのみ)
  const { data: hotels } = await supabase
    .from("hotels")
    .select("*")
    .order("name")
    .returns<Hotel[]>();

  let shiftQuery = supabase
    .from("shifts")
    .select(
      "*, hotel:hotels(name), staff:profiles!shifts_staff_id_fkey(name, is_international_student)"
    )
    .gte("work_date", firstDay)
    .lte("work_date", lastDay)
    .order("work_date", { ascending: true });

  if (hotelId) {
    shiftQuery = shiftQuery.eq("hotel_id", hotelId);
  }
  if (status) {
    shiftQuery = shiftQuery.eq("status", status);
  }

  const { data: shifts } = await shiftQuery.returns<ShiftWithRelations[]>();

  // 「申請中」件数は、ステータス絞り込みの選択状態に関わらず常に正しい値を出したいため、
  // 上記とは別にstatus='requested'固定でカウントする(ホテル・月の絞り込みは反映する)。
  let pendingCountQuery = supabase
    .from("shifts")
    .select("id", { count: "exact", head: true })
    .eq("status", "requested")
    .gte("work_date", firstDay)
    .lte("work_date", lastDay);
  if (hotelId) {
    pendingCountQuery = pendingCountQuery.eq("hotel_id", hotelId);
  }
  const { count: pendingCount } = await pendingCountQuery;

  const isApprover = role === "super_admin" || role === "manager";
  const mode = isApprover ? "approver" : role === "staff" ? "self" : "readonly";

  let staffOptions: Profile[] = [];
  let weeklyHourAlerts: WeeklyHourAlert[] = [];
  let templatesByHotel: Record<string, ShiftTemplate[]> = {};
  let staffingRows: ShiftTemplateStaffingRow[] = [];
  if (isApprover) {
    const [{ data: staffData }, { data: alertData }, { data: templateData }] = await Promise.all([
      supabase
        .from("profiles")
        .select("*")
        .in("role", ["staff", "checker"])
        .order("name")
        .returns<Profile[]>(),
      supabase.rpc("get_weekly_hour_alerts", { p_year_month: yearMonth }),
      supabase.from("shift_templates").select("*").order("sort_order").returns<ShiftTemplate[]>(),
    ]);
    staffOptions = staffData ?? [];
    weeklyHourAlerts = (alertData as WeeklyHourAlert[] | null) ?? [];

    templatesByHotel = {};
    for (const template of templateData ?? []) {
      templatesByHotel[template.hotel_id] ??= [];
      templatesByHotel[template.hotel_id].push(template);
    }

    // 目標稼働人員数との差分は、特定の1ホテルを選んでいる時のみ意味を持つため
    // hotelIdが指定されている場合だけ取得する
    if (hotelId) {
      const { data: staffingData } = await supabase.rpc("get_shift_template_staffing", {
        p_hotel_id: hotelId,
        p_year_month: yearMonth,
      });
      staffingRows = (staffingData as ShiftTemplateStaffingRow[] | null) ?? [];
    }
  }

  const baseParams = {
    month: yearMonth,
    view,
    ...(hotelId ? { hotel_id: hotelId } : {}),
    ...(status ? { status } : {}),
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">シフト確認</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {isApprover
              ? "申請中のシフトを確認し、承認・却下できます。"
              : role === "checker"
                ? "シフトの状況を確認できます(閲覧のみ)。"
                : "自分のシフトを確認できます。"}
          </p>
        </div>

        {isApprover && (pendingCount ?? 0) > 0 && (
          <Link
            href={buildHref({ month: yearMonth, view, ...(hotelId ? { hotel_id: hotelId } : {}), status: "requested" })}
            className="inline-flex items-center gap-2 rounded-full bg-amber-100 px-3 py-1.5 text-sm font-semibold text-amber-800 hover:bg-amber-200"
          >
            申請中が{pendingCount}件あります →
          </Link>
        )}
      </div>

      {isApprover && <WeeklyHourAlertBanner alerts={weeklyHourAlerts} />}

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Link href={buildHref({ ...baseParams, month: shiftYearMonth(yearMonth, -1) })}>
            <Button type="button" variant="outline" size="sm">
              前月
            </Button>
          </Link>
          <span className="min-w-[90px] text-center text-sm font-medium">{yearMonth}</span>
          <Link href={buildHref({ ...baseParams, month: shiftYearMonth(yearMonth, 1) })}>
            <Button type="button" variant="outline" size="sm">
              翌月
            </Button>
          </Link>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          <form className="flex flex-wrap items-center gap-2">
            <input type="hidden" name="month" value={yearMonth} />
            <input type="hidden" name="view" value={view} />

            {(hotels ?? []).length > 1 && (
              <select
                name="hotel_id"
                defaultValue={hotelId}
                className="h-9 rounded-md border border-input bg-background px-2 text-sm"
              >
                <option value="">すべてのホテル</option>
                {(hotels ?? []).map((hotel) => (
                  <option key={hotel.id} value={hotel.id}>
                    {hotel.name}
                  </option>
                ))}
              </select>
            )}

            <select
              name="status"
              defaultValue={status}
              className="h-9 rounded-md border border-input bg-background px-2 text-sm"
            >
              <option value="">すべてのステータス</option>
              <option value="requested">申請中</option>
              <option value="approved">承認済み</option>
              <option value="rejected">却下</option>
            </select>

            <Button type="submit" variant="outline" size="sm">
              絞り込み
            </Button>
          </form>

          <div className="flex overflow-hidden rounded-md border border-input">
            <Link
              href={buildHref({ ...baseParams, view: "list" })}
              className={cn(
                "px-3 py-2 text-sm",
                view === "list" ? "bg-primary text-primary-foreground" : "bg-background"
              )}
            >
              一覧
            </Link>
            <Link
              href={buildHref({ ...baseParams, view: "calendar" })}
              className={cn(
                "px-3 py-2 text-sm",
                view === "calendar" ? "bg-primary text-primary-foreground" : "bg-background"
              )}
            >
              カレンダー
            </Link>
          </div>
        </div>
      </div>

      {view === "list" ? (
        <ShiftTable
          shifts={shifts ?? []}
          mode={mode}
          onCancel={mode === "self" ? cancelShiftRequestAction : undefined}
          onApprove={mode === "approver" ? approveShiftAction : undefined}
          onReject={mode === "approver" ? rejectShiftAction : undefined}
        />
      ) : (
        <ShiftCalendarGrid
          yearMonth={yearMonth}
          shifts={shifts ?? []}
          showStaffName={mode !== "self"}
        />
      )}

      {isApprover && hotelId && (
        <div>
          <h2 className="mb-3 text-lg font-semibold">人員充足状況(目標人数との差分)</h2>
          <ShiftStaffingTable rows={staffingRows} />
        </div>
      )}

      {isApprover && (
        <Card>
          <CardHeader>
            <CardTitle>シフトを代理登録</CardTitle>
          </CardHeader>
          <CardContent>
            <ManagerShiftForm
              hotels={hotels ?? []}
              staffOptions={staffOptions}
              templatesByHotel={templatesByHotel}
              action={createShiftForStaffAction}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
