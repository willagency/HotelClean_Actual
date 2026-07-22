"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

type ActionResult = { error: string | null };

// hotel_idはDB側のトリガーでshift_template_idから自動補完されるため、ここでは送らない。
// RLS(daily_staffing_targets_insert/update_manager 等)によりsuper_admin/managerのみ実行可能。
export async function saveDailyStaffingTargetAction(
  shiftTemplateId: string,
  workDate: string,
  targetHeadcount: number
): Promise<ActionResult> {
  if (targetHeadcount < 0) {
    return { error: "目標人数は0以上で入力してください。" };
  }

  const supabase = createClient();
  const { error } = await supabase.from("daily_staffing_targets").upsert(
    {
      shift_template_id: shiftTemplateId,
      work_date: workDate,
      target_headcount: targetHeadcount,
    },
    { onConflict: "shift_template_id,work_date" }
  );

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/shifts/staffing");
  revalidatePath("/shifts/calendar");
  return { error: null };
}
