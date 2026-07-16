"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { calcShiftHours } from "@/lib/rolling-hours";

type ActionResult = { error: string | null };

// 実際の出退勤時刻・休憩時間(タイムカードの手動入力)を保存する。
// RLS(shifts_update_manager / shifts_update_admin)によりsuper_admin/managerのみ実行可能。
export async function saveAttendanceAction(
  shiftId: string,
  formData: FormData
): Promise<ActionResult> {
  const actualStartRaw = String(formData.get("actual_start_time") ?? "").trim();
  const actualEndRaw = String(formData.get("actual_end_time") ?? "").trim();
  const breakMinutes = Number(formData.get("break_minutes") ?? 0);

  if (breakMinutes < 0) {
    return { error: "休憩時間は0以上で入力してください。" };
  }

  const actualStartTime = actualStartRaw || null;
  const actualEndTime = actualEndRaw || null;

  if ((actualStartTime && !actualEndTime) || (!actualStartTime && actualEndTime)) {
    return { error: "出勤時刻・退勤時刻はどちらも入力してください。" };
  }
  if (actualStartTime && actualEndTime && actualEndTime <= actualStartTime) {
    return { error: "退勤時刻は出勤時刻より後にしてください。" };
  }
  if (actualStartTime && actualEndTime) {
    const workedHours = calcShiftHours(actualStartTime, actualEndTime);
    if (breakMinutes / 60 >= workedHours) {
      return { error: "休憩時間が実働時間を超えています。時刻を確認してください。" };
    }
  }

  const supabase = createClient();
  const { error } = await supabase
    .from("shifts")
    .update({
      actual_start_time: actualStartTime,
      actual_end_time: actualEndTime,
      break_minutes: breakMinutes,
    })
    .eq("id", shiftId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/attendance");
  return { error: null };
}
