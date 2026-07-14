import { redirect } from "next/navigation";
import { createClient, getCurrentProfile } from "@/lib/supabase/server";
import { HotelForm } from "@/components/hotel-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createHotelAction } from "@/app/(dashboard)/admin/hotels/actions";
import type { RoomType } from "@/lib/types/database.types";

export default async function NewHotelPage() {
  const profile = await getCurrentProfile();
  if (profile?.role !== "super_admin") {
    redirect("/dashboard");
  }

  const supabase = createClient();
  const { data: roomTypes } = await supabase
    .from("room_types")
    .select("*")
    .order("sort_order")
    .returns<RoomType[]>();

  const roomTypeIds = (roomTypes ?? []).map((rt) => rt.id);
  const boundAction = createHotelAction.bind(null, roomTypeIds);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">新規ホテル登録</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          基本情報と客室タイプ別の単価を設定してください。
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>ホテル情報</CardTitle>
        </CardHeader>
        <CardContent>
          <HotelForm roomTypes={roomTypes ?? []} action={boundAction} />
        </CardContent>
      </Card>
    </div>
  );
}
