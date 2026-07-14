"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

type ActionResult = { error: string | null };

// hotel_id が空文字の場合は全社目標(null)として扱う(super_adminのみRLSで許可される)
export async function saveMonthlyTargetAction(formData: FormData): Promise<ActionResult> {
  const hotelIdRaw = String(formData.get("hotel_id") ?? "");
  const hotelId = hotelIdRaw === "" ? null : hotelIdRaw;
  const yearMonth = String(formData.get("year_month") ?? "");
  const targetRooms = Number(formData.get("target_rooms") ?? 0);
  const targetSales = Number(formData.get("target_sales") ?? 0);

  if (!yearMonth) {
    return { error: "対象年月は必須です。" };
  }

  const supabase = createClient();
  const { error } = await supabase
    .from("monthly_targets")
    .upsert(
      {
        hotel_id: hotelId,
        year_month: yearMonth,
        target_rooms: targetRooms,
        target_sales: targetSales,
      },
      { onConflict: "hotel_key,year_month" }
    );

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/targets");
  revalidatePath("/dashboard");
  return { error: null };
}
