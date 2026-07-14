import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient, getCurrentProfile } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { SalesTrendChart } from "@/components/dashboard/sales-trend-chart";
import { HotelRankingTable } from "@/components/dashboard/hotel-ranking-table";
import { getCurrentYearMonth, shiftYearMonth } from "@/lib/date-utils";
import { ROLE_LABEL } from "@/lib/constants";
import type {
  Hotel,
  HotelMonthlySummary,
  HotelRankingRow,
  SalesTrendRow,
  UserRole,
} from "@/lib/types/database.types";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: { month?: string };
}) {
  const profile = await getCurrentProfile();

  if (!profile) {
    redirect("/login");
  }

  if (profile.role === "staff") {
    return (
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-semibold">ダッシュボード</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {profile.name} さん({ROLE_LABEL[profile.role as UserRole]})としてログイン中
          </p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>シフト申請はメニューの「シフト申請」から行えます</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            売上・実績の集計はマネージャー以上の権限が必要です。
          </CardContent>
        </Card>
      </div>
    );
  }

  const supabase = createClient();

  if (profile.role === "manager" || profile.role === "checker") {
    const { data: hotels } = await supabase
      .from("hotels")
      .select("*")
      .order("name")
      .returns<Hotel[]>();

    if (!hotels || hotels.length === 0) {
      return (
        <div>
          <h1 className="text-2xl font-semibold">ダッシュボード</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            所属ホテルが設定されていません。管理者にお問い合わせください。
          </p>
        </div>
      );
    }

    if (hotels.length === 1) {
      redirect(`/dashboard/hotels/${hotels[0].id}`);
    }

    return (
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-semibold">ダッシュボード</h1>
          <p className="mt-1 text-sm text-muted-foreground">担当ホテルを選択してください。</p>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {hotels.map((hotel) => (
            <Link key={hotel.id} href={`/dashboard/hotels/${hotel.id}`}>
              <Card className="transition-colors hover:bg-secondary/50">
                <CardHeader>
                  <CardTitle className="text-base">{hotel.name}</CardTitle>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    );
  }

  // super_admin: 全社ダッシュボード
  const yearMonth = searchParams.month || getCurrentYearMonth();

  const [{ data: overallRows }, { data: trend }, { data: ranking }] = await Promise.all([
    supabase.rpc("get_overall_monthly_summary", { p_year_month: yearMonth }),
    supabase.rpc("get_overall_sales_trend", { p_year_month: yearMonth, p_months_back: 5 }),
    supabase.rpc("get_all_hotels_monthly_summary", { p_year_month: yearMonth }),
  ]);

  const overall = (overallRows as HotelMonthlySummary[] | null)?.[0];
  const trendData = (trend as SalesTrendRow[] | null) ?? [];
  const rankingRows = (ranking as HotelRankingRow[] | null) ?? [];

  const salesRate =
    overall && overall.target_sales > 0 ? (overall.net_sales / overall.target_sales) * 100 : null;
  const roomsRate =
    overall && overall.target_rooms > 0 ? (overall.total_rooms / overall.target_rooms) * 100 : null;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">全社ダッシュボード</h1>
          <p className="mt-1 text-sm text-slate-500">{yearMonth} の実績です。</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/dashboard?month=${shiftYearMonth(yearMonth, -1)}`}>
            <Button type="button" variant="outline" size="sm">
              前月
            </Button>
          </Link>
          <span className="min-w-[90px] text-center text-sm font-medium">{yearMonth}</span>
          <Link href={`/dashboard?month=${shiftYearMonth(yearMonth, 1)}`}>
            <Button type="button" variant="outline" size="sm">
              翌月
            </Button>
          </Link>
        </div>
      </div>

      {/* PC: 左1列にKPI、右2列にグラフ+テーブル / モバイル: 上から縦積み */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-4 lg:col-span-1">
          <KpiCard label="売上" value={`${(overall?.net_sales ?? 0).toLocaleString()}円`} />
          <KpiCard label="清掃室数" value={`${(overall?.total_rooms ?? 0).toLocaleString()}室`} />
          <KpiCard
            label="売上目標達成率"
            value={salesRate === null ? "目標未設定" : `${salesRate.toFixed(1)}%`}
            tone={salesRate !== null && salesRate >= 100 ? "positive" : "default"}
          />
          <KpiCard
            label="客室数目標達成率"
            value={roomsRate === null ? "目標未設定" : `${roomsRate.toFixed(1)}%`}
            tone={roomsRate !== null && roomsRate >= 100 ? "positive" : "default"}
          />
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

          <div>
            <h2 className="mb-3 text-lg font-semibold">ホテル別ランキング</h2>
            <HotelRankingTable rows={rankingRows} yearMonth={yearMonth} />
          </div>
        </div>
      </div>
    </div>
  );
}
