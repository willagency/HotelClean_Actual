import { redirect } from "next/navigation";
import { createClient, getCurrentProfile } from "@/lib/supabase/server";
import { DailyReportForm } from "@/components/daily-report-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { saveDailyReportAction } from "@/app/(dashboard)/reports/daily/actions";
import type { Hotel, HotelRoomPrice, RoomType } from "@/lib/types/database.types";

export default async function NewDailyReportPage() {
  const profile = await getCurrentProfile();
  if (profile?.role === "staff") {
    redirect("/dashboard");
  }

  const supabase = createClient();

  const [{ data: hotels }, { data: roomTypes }, { data: prices }] = await Promise.all([
    supabase.from("hotels").select("*").order("name").returns<Hotel[]>(),
    supabase.from("room_types").select("*").order("sort_order").returns<RoomType[]>(),
    supabase.from("hotel_room_prices").select("*").returns<HotelRoomPrice[]>(),
  ]);

  const pricesByHotel: Record<string, Record<string, number>> = {};
  for (const price of prices ?? []) {
    pricesByHotel[price.hotel_id] ??= {};
    pricesByHotel[price.hotel_id][price.room_type_id] = price.unit_price;
  }

  const roomTypeIds = (roomTypes ?? []).map((rt) => rt.id);
  const boundAction = saveDailyReportAction.bind(null, null, roomTypeIds);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">新規日報入力</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          その日の清掃実績をホテル単位で入力してください。
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>日報情報</CardTitle>
        </CardHeader>
        <CardContent>
          <DailyReportForm
            mode="create"
            hotels={hotels ?? []}
            roomTypes={roomTypes ?? []}
            pricesByHotel={pricesByHotel}
            action={boundAction}
          />
        </CardContent>
      </Card>
    </div>
  );
}
