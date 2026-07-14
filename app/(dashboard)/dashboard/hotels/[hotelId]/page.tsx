import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient, getCurrentProfile } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { ProgressBar } from "@/components/dashboard/progress-bar";
import { SalesTrendChart } from "@/components/dashboard/sales-trend-chart";
import { RoomTypeBreakdownChart } from "@/components/dashboard/room-type-breakdown-chart";
import { getCurrentYearMonth, shiftYearMonth } from "@/lib/date-utils";
import type {
  Hotel,
  HotelMonthlySummary,
  RoomTypeBreakdownRow,
  SalesTrendRow,
} from "@/lib/types/database.types";

export default async function HotelDashboardPage({
  params,
  searchParams,
}: {
  params: { hotelId: string };
  searchParams: { month?: string };
}) {
  const profile = await getCurrentProfile();
  if (profile?.role === "staff") {
    redirect("/dashboard");
  }

  const supabase = createClient();

  // hotelsはRLSでスコープされているため、権限がないホテルはここでnullになる
  const { data: hotel } = await supabase
    .from("hotels")
    .select("*")
    .eq("id", params.hotelId)
    .maybeSingle();

  const typedHotel = hotel as Hotel | null;
  if (!typedHotel) {
    notFound();
  }

  const yearMonth = searchParams.month || getCurrentYearMonth();

  const [{ data: summaryRows }, { data: trend }, { data: breakdown }, { data: allHotels }] =
    await Promise.all([
      supabase.rpc("get_hotel_monthly_summary", {
        p_hotel_id: params.hotelId,
        p_year_month: yearMonth,
      }),
      supabase.rpc("get_hotel_sales_trend", {
        p_hotel_id: params.hotelId,
        p_year_month: yearMonth,
        p_months_back: 5,
      }),
      supabase.rpc("get_hotel_room_type_breakdown", {
        p_hotel_id: params.hotelId,
        p_year_month: yearMonth,
      }),
      supabase.from("hotels").select("*").order("name").returns<Hotel[]>(),
    ]);

  const summary = (summaryRows as HotelMonthlySummary[] | null)?.[0];
  const trendData = (trend as SalesTrendRow[] | null) ?? [];
  const breakdownData = (breakdown as RoomTypeBreakdownRow[] | null) ?? [];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{typedHotel.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{yearMonth} の実績です。</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/dashboard/hotels/${params.hotelId}?month=${shiftYearMonth(yearMonth, -1)}`}>
            <Button type="button" variant="outline" size="sm">
              前月
            </Button>
          </Link>
          <span className="min-w-[90px] text-center text-sm font-medium">{yearMonth}</span>
          <Link href={`/dashboard/hotels/${params.hotelId}?month=${shiftYearMonth(yearMonth, 1)}`}>
            <Button type="button" variant="outline" size="sm">
              翌月
            </Button>
          </Link>
        </div>
      </div>

      {(allHotels ?? []).length > 1 && (
        <div className="flex flex-wrap gap-2">
          {(allHotels ?? []).map((h) => (
            <Link key={h.id} href={`/dashboard/hotels/${h.id}?month=${yearMonth}`}>
              <Button
                type="button"
                variant={h.id === params.hotelId ? "default" : "outline"}
                size="sm"
              >
                {h.name}
              </Button>
            </Link>
          ))}
        </div>
      )}

      {/* PC: 左1列にKPI+目標達成状況、右2列にグラフ類 / モバイル: 上から縦積み */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-4 lg:col-span-1">
          <KpiCard label="売上" value={`${(summary?.net_sales ?? 0).toLocaleString()}円`} />
          <KpiCard label="清掃室数" value={`${(summary?.total_rooms ?? 0).toLocaleString()}室`} />
          <KpiCard
            label="人件費(時給分)"
            value={`${(summary?.hourly_labor_cost ?? 0).toLocaleString()}円`}
          />
          <KpiCard
            label="人件費(月給分)"
            value={`${(summary?.monthly_labor_cost ?? 0).toLocaleString()}円`}
            sub="このホテル所属の月給スタッフ分"
          />

          <Card>
            <CardHeader>
              <CardTitle className="text-base">目標達成状況</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-5">
              <ProgressBar
                label="売上"
                current={summary?.net_sales ?? 0}
                target={summary?.target_sales ?? 0}
                formatValue={(v) => `${v.toLocaleString()}円`}
              />
              <ProgressBar
                label="清掃室数"
                current={summary?.total_rooms ?? 0}
                target={summary?.target_rooms ?? 0}
                formatValue={(v) => `${v.toLocaleString()}室`}
              />
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col gap-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>売上推移(直近6ヶ月)</CardTitle>
            </CardHeader>
            <CardContent>
              <SalesTrendChart data={trendData} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>客室タイプ別 清掃実績</CardTitle>
            </CardHeader>
            <CardContent>
              <RoomTypeBreakdownChart data={breakdownData} />
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Link
              href={`/reports/daily?month=${yearMonth}&hotel_id=${params.hotelId}`}
              className="text-sm font-medium text-blue-600 underline-offset-2 hover:underline"
            >
              この月の日報一覧を見る →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
