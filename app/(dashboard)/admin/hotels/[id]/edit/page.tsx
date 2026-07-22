import { notFound, redirect } from "next/navigation";
import { createClient, getCurrentProfile } from "@/lib/supabase/server";
import { HotelForm } from "@/components/hotel-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { updateHotelAction } from "@/app/(dashboard)/admin/hotels/actions";
import type {
  Hotel,
  HotelRoomPrice,
  RoomType,
  ShiftTemplate,
} from "@/lib/types/database.types";

export default async function EditHotelPage({ params }: { params: { id: string } }) {
  const profile = await getCurrentProfile();
  if (profile?.role !== "super_admin") {
    redirect("/dashboard");
  }

  const supabase = createClient();

  const [{ data: hotel }, { data: roomTypes }, { data: prices }, { data: shiftTemplates }] =
    await Promise.all([
      supabase.from("hotels").select("*").eq("id", params.id).single(),
      supabase.from("room_types").select("*").order("sort_order").returns<RoomType[]>(),
      supabase
        .from("hotel_room_prices")
        .select("*")
        .eq("hotel_id", params.id)
        .returns<HotelRoomPrice[]>(),
      supabase
        .from("shift_templates")
        .select("*")
        .eq("hotel_id", params.id)
        .order("sort_order")
        .returns<ShiftTemplate[]>(),
    ]);

  const typedHotel = hotel as Hotel | null;

  if (!typedHotel) {
    notFound();
  }

  const initialPrices = Object.fromEntries(
    (prices ?? []).map((p) => [p.room_type_id, p.unit_price])
  );

  const roomTypeIds = (roomTypes ?? []).map((rt) => rt.id);
  const boundAction = updateHotelAction.bind(null, typedHotel.id, roomTypeIds);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">ホテル編集</h1>
        <p className="mt-1 text-sm text-muted-foreground">{typedHotel.name}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>ホテル情報</CardTitle>
        </CardHeader>
        <CardContent>
          <HotelForm
            roomTypes={roomTypes ?? []}
            initialHotel={typedHotel}
            initialPrices={initialPrices}
            initialShiftTemplates={shiftTemplates ?? []}
            action={boundAction}
          />
        </CardContent>
      </Card>
    </div>
  );
}
