import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient, getCurrentProfile } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AttendanceRowEditor } from "@/components/attendance-row-editor";
import { saveAttendanceAction } from "@/app/(dashboard)/attendance/actions";
import { cn } from "@/lib/utils";
import { getCurrentYearMonth, getMonthRange, shiftYearMonth } from "@/lib/date-utils";
import type { AttendanceRow, Hotel } from "@/lib/types/database.types";

export default async function AttendancePage({
  searchParams,
}: {
  searchParams: { month?: string; hotel_id?: string };
}) {
  const profile = await getCurrentProfile();

  // 出勤状況確認はsuper_admin / managerのみ
  if (profile?.role !== "super_admin" && profile?.role !== "manager") {
    redirect("/dashboard");
  }

  const supabase = createClient();
  const { data: hotels } = await supabase
    .from("hotels")
    .select("*")
    .order("name")
    .returns<Hotel[]>();

  const yearMonth = searchParams.month || getCurrentYearMonth();
  const hotelId = searchParams.hotel_id || hotels?.[0]?.id || "";

  let rows: AttendanceRow[] = [];
  if (hotelId) {
    const { data } = await supabase.rpc("get_attendance_rows", {
      p_hotel_id: hotelId,
      p_year_month: yearMonth,
    });
    rows = (data as AttendanceRow[] | null) ?? [];
  }

  // スタッフ別の月間実働時間合計(未入力の日は含まない)
  const monthlyTotals = new Map<string, { name: string; total: number }>();
  for (const row of rows) {
    if (row.actual_hours === null) continue;
    const entry = monthlyTotals.get(row.staff_id) ?? { name: row.staff_name, total: 0 };
    entry.total += row.actual_hours;
    monthlyTotals.set(row.staff_id, entry);
  }

  const baseParams = { month: yearMonth, ...(hotelId ? { hotel_id: hotelId } : {}) };
  const buildHref = (params: Record<string, string>) =>
    `/attendance?${new URLSearchParams(params).toString()}`;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">出勤状況確認</h1>
        <p className="mt-1 text-sm text-slate-500">
          タイムカードの実働時間を入力し、シフト予定との差異・週の労働時間状況を確認できます。
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-100 bg-white p-3 text-xs">
        <span className="font-medium text-slate-600">凡例:</span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-full bg-amber-400" />
          留学生・週の残り時間4時間以内(警告)
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-full bg-rose-500" />
          留学生・週の上限を超過(アラート)
        </span>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <form className="flex flex-wrap items-center gap-2">
          <input type="hidden" name="month" value={yearMonth} />
          <select
            name="hotel_id"
            defaultValue={hotelId}
            className="h-9 rounded-md border border-input bg-background px-2 text-sm"
          >
            {(hotels ?? []).map((hotel) => (
              <option key={hotel.id} value={hotel.id}>
                {hotel.name}
              </option>
            ))}
          </select>
          <Button type="submit" variant="outline" size="sm">
            表示
          </Button>
        </form>

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
      </div>

      {monthlyTotals.size > 0 && (
        <div className="rounded-xl border border-slate-100 bg-white p-4">
          <p className="mb-2 text-sm font-semibold">当月の実働時間合計(スタッフ別)</p>
          <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-slate-600">
            {Array.from(monthlyTotals.values()).map((entry) => (
              <span key={entry.name}>
                {entry.name}: <span className="font-medium text-slate-900">{entry.total.toFixed(1)}h</span>
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-xl border border-slate-100 bg-white shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>氏名</TableHead>
              <TableHead>日付</TableHead>
              <TableHead>シフト予定</TableHead>
              <TableHead className="min-w-[280px]">実績入力(出勤〜退勤 / 休憩分)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow
                key={row.shift_id}
                className={cn(
                  row.is_international_student &&
                    row.rolling_total_hours > row.hour_limit &&
                    "bg-rose-50/60",
                  row.is_international_student &&
                    row.rolling_total_hours <= row.hour_limit &&
                    row.remaining_hours <= 4 &&
                    "bg-amber-50/60"
                )}
              >
                <TableCell className="font-medium">
                  {row.staff_name}
                  {row.is_international_student && (
                    <span className="ml-1.5 inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                      留学生
                    </span>
                  )}
                </TableCell>
                <TableCell>{row.work_date}</TableCell>
                <TableCell>
                  {row.planned_start.slice(0, 5)} 〜 {row.planned_end.slice(0, 5)}
                  <span className="ml-1 text-xs text-slate-400">({row.planned_hours.toFixed(1)}h)</span>
                </TableCell>
                <TableCell>
                  <AttendanceRowEditor row={row} action={saveAttendanceAction} />
                </TableCell>
              </TableRow>
            ))}

            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="py-10 text-center text-muted-foreground">
                  対象期間の承認済みシフトがありません。
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
