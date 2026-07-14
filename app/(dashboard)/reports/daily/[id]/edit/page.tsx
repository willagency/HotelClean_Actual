import { notFound, redirect } from "next/navigation";
import { createClient, getCurrentProfile } from "@/lib/supabase/server";
import { DailyReportForm } from "@/components/daily-report-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { saveDailyReportAction } from "@/app/(dashboard)/reports/daily/actions";
import type {
  DailyReport,
  DailyReportDetail,
  Hotel,
  HotelRoomPrice,
  RoomType,
} from "@/lib/types/database.types";

export default async function EditDailyReportPage({ params }: { params: { id: string } }) {
  const profile = await getCurrentProfile();
  if (profile?.role === "staff") {
    redirect("/dashboard");
  }

  const supabase = createClient();

  const [
    { data: report },
    { data: details },
    { data: hotels },
    { data: roomTypes },
    { data: prices },
  ] = await Promise.all([
    supabase.from("daily_reports").select("*").eq("id", params.id).maybeSingle(),
    supabase
      .from("daily_report_details")
      .select("*")
      .eq("daily_report_id", params.id)
      .returns<DailyReportDetail[]>(),
    supabase.from("hotels").select("*").order("name").returns<Hotel[]>(),
    supabase.from("room_types").select("*").order("sort_order").returns<RoomType[]>(),
    supabase.from("hotel_room_prices").select("*").returns<HotelRoomPrice[]>(),
  ]);

  const typedReport = report as DailyReport | null;

  // RLSで見えない(=他ホテルの日報等)場合はここでnullになる
  if (!typedReport) {
    notFound();
  }

  const pricesByHotel: Record<string, Record<string, number>> = {};
  for (const price of prices ?? []) {
    pricesByHotel[price.hotel_id] ??= {};
    pricesByHotel[price.hotel_id][price.room_type_id] = price.unit_price;
  }

  const roomTypeIds = (roomTypes ?? []).map((rt) => rt.id);
  const boundAction = saveDailyReportAction.bind(null, typedReport.id, roomTypeIds);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">日報編集</h1>
        <p className="mt-1 text-sm text-muted-foreground">{typedReport.report_date}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>日報情報</CardTitle>
        </CardHeader>
        <CardContent>
          <DailyReportForm
            mode="edit"
            hotels={hotels ?? []}
            roomTypes={roomTypes ?? []}
            pricesByHotel={pricesByHotel}
            initialReport={typedReport}
            initialDetails={details ?? []}
            action={boundAction}
          />
        </CardContent>
      </Card>
    </div>
  );
}
