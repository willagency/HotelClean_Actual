"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

type ActionResult = { error: string | null };

function buildRoomCountsPayload(formData: FormData, roomTypeIds: string[]) {
  return roomTypeIds.map((roomTypeId) => ({
    room_type_id: roomTypeId,
    completed_count: Number(formData.get(`count_${roomTypeId}`) ?? 0),
  }));
}

// reportIdがnullなら新規作成、指定があれば更新(同ホテル・同日が既にあれば上書き)
export async function saveDailyReportAction(
  reportId: string | null,
  roomTypeIds: string[],
  formData: FormData
): Promise<ActionResult> {
  const hotelId = String(formData.get("hotel_id") ?? "");
  const reportDate = String(formData.get("report_date") ?? "");
  const adjustmentAmount = Number(formData.get("adjustment_amount") ?? 0);
  const adjustmentNote = String(formData.get("adjustment_note") ?? "").trim();

  if (!hotelId || !reportDate) {
    return { error: "ホテルと対象日は必須です。" };
  }

  const supabase = createClient();
  const { error } = await supabase.rpc("upsert_daily_report", {
    p_report_id: reportId,
    p_hotel_id: hotelId,
    p_report_date: reportDate,
    p_adjustment_amount: adjustmentAmount,
    p_adjustment_note: adjustmentNote || null,
    p_room_counts: buildRoomCountsPayload(formData, roomTypeIds),
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/reports/daily");
  if (reportId) {
    revalidatePath(`/reports/daily/${reportId}/edit`);
  }
  return { error: null };
}

// 削除はsuper_admin/managerのみ(RLS: daily_reports_delete_admin / _delete_manager)
// checkerが呼び出した場合はRLSにより0件更新となりエラーメッセージを返す
export async function deleteDailyReportAction(reportId: string): Promise<ActionResult> {
  const supabase = createClient();
  const { error, count } = await supabase
    .from("daily_reports")
    .delete({ count: "exact" })
    .eq("id", reportId);

  if (error) {
    return { error: error.message };
  }
  if (!count) {
    return { error: "削除権限がありません。" };
  }

  revalidatePath("/reports/daily");
  return { error: null };
}
