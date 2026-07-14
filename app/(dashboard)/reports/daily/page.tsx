import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus } from "lucide-react";
import { createClient, getCurrentProfile } from "@/lib/supabase/server";
import { buttonVariants, Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getCurrentYearMonth, getMonthRange, shiftYearMonth } from "@/lib/date-utils";
import { deleteDailyReportAction } from "@/app/(dashboard)/reports/daily/actions";
import { DailyReportRowActions } from "@/components/daily-report-row-actions";
import type { DailyReportWithRelations, Hotel } from "@/lib/types/database.types";

export default async function DailyReportsPage({
  searchParams,
}: {
  searchParams: { month?: string; hotel_id?: string };
}) {
  const profile = await getCurrentProfile();

  // 日報はsuper_admin / manager / checkerのみ(staffはアクセス不可)
  if (profile?.role === "staff") {
    redirect("/dashboard");
  }

  const yearMonth = searchParams.month || getCurrentYearMonth();
  const hotelId = searchParams.hotel_id || "";
  const { firstDay, lastDay } = getMonthRange(yearMonth);

  const supabase = createClient();

  const { data: hotels } = await supabase
    .from("hotels")
    .select("*")
    .order("name")
    .returns<Hotel[]>();

  let reportQuery = supabase
    .from("daily_reports")
    .select("*, hotel:hotels(name), daily_report_details(completed_count)")
    .gte("report_date", firstDay)
    .lte("report_date", lastDay)
    .order("report_date", { ascending: false });

  if (hotelId) {
    reportQuery = reportQuery.eq("hotel_id", hotelId);
  }

  const { data: reports } = await reportQuery.returns<DailyReportWithRelations[]>();

  const canDelete = profile?.role === "super_admin" || profile?.role === "manager";
  const baseParams = { month: yearMonth, ...(hotelId ? { hotel_id: hotelId } : {}) };
  const buildHref = (params: Record<string, string>) =>
    `/reports/daily?${new URLSearchParams(params).toString()}`;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">日報一覧</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            ホテル単位の清掃実績・調整金の入力履歴です。
          </p>
        </div>
        <Link
          href="/reports/daily/new"
          className={buttonVariants({ className: "flex items-center gap-2" })}
        >
          <Plus className="h-4 w-4" />
          新規日報入力
        </Link>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
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

        {(hotels ?? []).length > 1 && (
          <form className="flex flex-wrap items-center gap-2">
            <input type="hidden" name="month" value={yearMonth} />
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
            <Button type="submit" variant="outline" size="sm">
              絞り込み
            </Button>
          </form>
        )}
      </div>

      <div className="rounded-xl border border-slate-100 bg-white shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>対象日</TableHead>
              <TableHead>ホテル</TableHead>
              <TableHead>清掃完了室数</TableHead>
              <TableHead>調整金</TableHead>
              <TableHead className="text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(reports ?? []).map((report) => {
              const totalRooms = report.daily_report_details.reduce(
                (sum, d) => sum + d.completed_count,
                0
              );
              return (
                <TableRow key={report.id}>
                  <TableCell>{report.report_date}</TableCell>
                  <TableCell>{report.hotel?.name ?? "-"}</TableCell>
                  <TableCell>{totalRooms}室</TableCell>
                  <TableCell>{report.adjustment_amount.toLocaleString()}円</TableCell>
                  <TableCell className="text-right">
                    <DailyReportRowActions
                      reportId={report.id}
                      canDelete={canDelete}
                      onDelete={deleteDailyReportAction}
                    />
                  </TableCell>
                </TableRow>
              );
            })}

            {(reports ?? []).length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                  対象期間の日報がありません。
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
