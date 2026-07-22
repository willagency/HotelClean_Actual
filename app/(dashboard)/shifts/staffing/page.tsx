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
import { DailyStaffingRowEditor } from "@/components/daily-staffing-row-editor";
import { saveDailyStaffingTargetAction } from "@/app/(dashboard)/shifts/staffing/actions";
import { addDaysStr } from "@/lib/date-utils";
import { cn } from "@/lib/utils";
import type { DailyStaffingRow, Hotel } from "@/lib/types/database.types";

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

export default async function ShiftStaffingPage({
  searchParams,
}: {
  searchParams: { date?: string; hotel_id?: string };
}) {
  const profile = await getCurrentProfile();

  // 当日シフト状況はsuper_admin / managerのみ
  if (profile?.role !== "super_admin" && profile?.role !== "manager") {
    redirect("/dashboard");
  }

  const supabase = createClient();
  const { data: hotels } = await supabase
    .from("hotels")
    .select("*")
    .order("name")
    .returns<Hotel[]>();

  const workDate = searchParams.date || todayStr();
  const hotelId = searchParams.hotel_id || hotels?.[0]?.id || "";

  let rows: DailyStaffingRow[] = [];
  if (hotelId) {
    const { data } = await supabase.rpc("get_daily_staffing", {
      p_hotel_id: hotelId,
      p_work_date: workDate,
    });
    rows = (data as DailyStaffingRow[] | null) ?? [];
  }

  const buildHref = (params: Record<string, string>) =>
    `/shifts/staffing?${new URLSearchParams(params).toString()}`;
  const baseParams = { date: workDate, ...(hotelId ? { hotel_id: hotelId } : {}) };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">当日シフト状況</h1>
        <p className="mt-1 text-sm text-slate-500">
          チェックアウト状況等に応じて、日ごとに必要な人数を登録し、不足状況を確認できます。
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <form className="flex flex-wrap items-center gap-2">
          {(hotels ?? []).length > 1 && (
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
          )}
          <input
            type="date"
            name="date"
            defaultValue={workDate}
            className="h-9 rounded-md border border-input bg-background px-2 text-sm"
          />
          <Button type="submit" variant="outline" size="sm">
            表示
          </Button>
        </form>

        <div className="flex items-center gap-2">
          <Link href={buildHref({ ...baseParams, date: addDaysStr(workDate, -1) })}>
            <Button type="button" variant="outline" size="sm">
              前日
            </Button>
          </Link>
          <span className="min-w-[110px] text-center text-sm font-medium">{workDate}</span>
          <Link href={buildHref({ ...baseParams, date: addDaysStr(workDate, 1) })}>
            <Button type="button" variant="outline" size="sm">
              翌日
            </Button>
          </Link>
        </div>
      </div>

      <div className="rounded-xl border border-slate-100 bg-white shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>シフト時間帯</TableHead>
              <TableHead>当日の目標人数 / 状況</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.shift_template_id} className={cn(row.diff < 0 && "bg-rose-50/60")}>
                <TableCell className="font-medium">
                  {row.label}
                  <span className="ml-1.5 text-xs text-slate-400">
                    ({row.start_time.slice(0, 5)}〜{row.end_time.slice(0, 5)})
                  </span>
                </TableCell>
                <TableCell>
                  <DailyStaffingRowEditor
                    row={row}
                    workDate={workDate}
                    action={saveDailyStaffingTargetAction}
                  />
                </TableCell>
              </TableRow>
            ))}

            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={2} className="py-10 text-center text-muted-foreground">
                  このホテルにはシフト時間帯が登録されていません。ホテル編集画面から登録してください。
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
