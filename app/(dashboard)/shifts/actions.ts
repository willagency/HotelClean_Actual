"use server";

import { revalidatePath } from "next/cache";
import { createClient, getCurrentProfile } from "@/lib/supabase/server";
import { calcShiftHours, computeMaxRollingWindowHours } from "@/lib/rolling-hours";
import { addDaysStr } from "@/lib/date-utils";

type ActionResult = { error: string | null };

// -----------------------------------------------------------
// 留学生の週28時間ルール(長期休業期間モード時は週40時間・1日8時間)を
// 「任意の連続7日間」で判定する共通バリデーション。
// 対象が留学生でない場合は常にnull(問題なし)を返す。
// -----------------------------------------------------------
async function validateInternationalStudentHours(params: {
  staffId: string;
  workDate: string;
  startTime: string;
  endTime: string;
  otherCompanyHours: number;
  excludeShiftId?: string;
}): Promise<string | null> {
  const supabase = createClient();

  const { data: staffProfile } = await supabase
    .from("profiles")
    .select("is_international_student, is_long_vacation_mode")
    .eq("id", params.staffId)
    .maybeSingle();

  if (!staffProfile?.is_international_student) {
    return null;
  }

  const isLongVacationMode = !!staffProfile.is_long_vacation_mode;
  const hourLimit = isLongVacationMode ? 40 : 28;
  const thisShiftHours = calcShiftHours(params.startTime, params.endTime);

  // 長期休業期間モードは1日8時間の上限も追加でチェックする
  if (isLongVacationMode && thisShiftHours + params.otherCompanyHours > 8) {
    return `長期休業期間モードは1日8時間が上限です(このシフト${thisShiftHours.toFixed(
      1
    )}時間 + 他社勤務${params.otherCompanyHours.toFixed(1)}時間で超過しています)。`;
  }

  // 対象日の前後6日分(=最大7通りの7日間窓を評価するのに必要な範囲)を取得
  const rangeStart = addDaysStr(params.workDate, -6);
  const rangeEnd = addDaysStr(params.workDate, 6);

  let existingQuery = supabase
    .from("shifts")
    .select("work_date, start_time, end_time, other_company_hours")
    .eq("staff_id", params.staffId)
    .in("status", ["requested", "approved"])
    .gte("work_date", rangeStart)
    .lte("work_date", rangeEnd);

  if (params.excludeShiftId) {
    existingQuery = existingQuery.neq("id", params.excludeShiftId);
  }

  const { data: existingShifts } = await existingQuery;

  const existingEntries = (existingShifts ?? []).map((s) => ({
    work_date: s.work_date as string,
    hours: calcShiftHours(s.start_time as string, s.end_time as string),
    other_company_hours: Number(s.other_company_hours ?? 0),
  }));

  const maxHours = computeMaxRollingWindowHours(existingEntries, {
    work_date: params.workDate,
    hours: thisShiftHours,
    other_company_hours: params.otherCompanyHours,
  });

  if (maxHours > hourLimit) {
    return (
      `この登録により、連続7日間の合計労働時間が${maxHours.toFixed(1)}時間となり、` +
      `上限の${hourLimit}時間(${
        isLongVacationMode ? "長期休業期間モード" : "通常期間"
      })を超えます。他社での勤務時間も含めた合計です。日程の調整をお願いします。`
    );
  }

  return null;
}

// -----------------------------------------------------------
// スタッフ本人によるシフト申請(新規)
// RLS(shifts_insert_staff)により、role='staff'かつ
// staff_id=自分自身、status='requested'のみ許可される
// -----------------------------------------------------------
export async function createShiftRequestAction(formData: FormData): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) {
    return { error: "ログイン情報が確認できませんでした。" };
  }

  const hotelId = String(formData.get("hotel_id") ?? "");
  const workDate = String(formData.get("work_date") ?? "");
  const startTime = String(formData.get("start_time") ?? "");
  const endTime = String(formData.get("end_time") ?? "");
  const note = String(formData.get("note") ?? "").trim();
  const otherCompanyHours = Number(formData.get("other_company_hours") ?? 0);
  const otherCompanyConfirmed = formData.get("other_company_confirmed") === "on";

  if (!hotelId || !workDate || !startTime || !endTime) {
    return { error: "必須項目が入力されていません。" };
  }
  if (endTime <= startTime) {
    return { error: "終了時刻は開始時刻より後にしてください。" };
  }
  if (otherCompanyHours < 0) {
    return { error: "他社勤務時間は0以上で入力してください。" };
  }
  if (!otherCompanyConfirmed) {
    return {
      error: "「他社の勤務を含めて規定時間内である」ことの確認チェックが必要です。",
    };
  }

  const validationError = await validateInternationalStudentHours({
    staffId: profile.id,
    workDate,
    startTime,
    endTime,
    otherCompanyHours,
  });
  if (validationError) {
    return { error: validationError };
  }

  const supabase = createClient();
  const { error } = await supabase.from("shifts").insert({
    staff_id: profile.id,
    hotel_id: hotelId,
    work_date: workDate,
    start_time: startTime,
    end_time: endTime,
    status: "requested",
    note: note || null,
    other_company_hours: otherCompanyHours,
    other_company_confirmed: otherCompanyConfirmed,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/shifts/request");
  revalidatePath("/shifts/calendar");
  return { error: null };
}

// -----------------------------------------------------------
// スタッフ本人による申請中シフトの取り消し(削除)
// RLS(shifts_delete_self)により status='requested' の自分の申請のみ削除可
// -----------------------------------------------------------
export async function cancelShiftRequestAction(shiftId: string): Promise<ActionResult> {
  const supabase = createClient();
  const { error } = await supabase.from("shifts").delete().eq("id", shiftId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/shifts/request");
  revalidatePath("/shifts/calendar");
  return { error: null };
}

// -----------------------------------------------------------
// マネージャー/全体管理者によるシフト承認・却下
// RLS(shifts_update_manager / shifts_update_admin)によりスコープされる
// (checkerには対応するUPDATEポリシーがないため、呼び出しても0件更新でエラーにはならないが
//  画面側でボタン自体を表示しないことで抑止する)
// -----------------------------------------------------------
export async function approveShiftAction(shiftId: string): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  const supabase = createClient();

  const { error } = await supabase
    .from("shifts")
    .update({ status: "approved", approved_by: profile?.id })
    .eq("id", shiftId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/shifts/calendar");
  return { error: null };
}

export async function rejectShiftAction(shiftId: string): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  const supabase = createClient();

  const { error } = await supabase
    .from("shifts")
    .update({ status: "rejected", approved_by: profile?.id })
    .eq("id", shiftId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/shifts/calendar");
  return { error: null };
}

// -----------------------------------------------------------
// マネージャー/全体管理者による直接のシフト登録(代理登録)
// 例: スタッフからの口頭連絡を代理で入力するケースなど
// こちらも留学生の労働時間ルールを同様にチェックする。
// -----------------------------------------------------------
export async function createShiftForStaffAction(formData: FormData): Promise<ActionResult> {
  const staffId = String(formData.get("staff_id") ?? "");
  const hotelId = String(formData.get("hotel_id") ?? "");
  const workDate = String(formData.get("work_date") ?? "");
  const startTime = String(formData.get("start_time") ?? "");
  const endTime = String(formData.get("end_time") ?? "");
  const note = String(formData.get("note") ?? "").trim();

  if (!staffId || !hotelId || !workDate || !startTime || !endTime) {
    return { error: "必須項目が入力されていません。" };
  }
  if (endTime <= startTime) {
    return { error: "終了時刻は開始時刻より後にしてください。" };
  }

  const validationError = await validateInternationalStudentHours({
    staffId,
    workDate,
    startTime,
    endTime,
    otherCompanyHours: 0,
  });
  if (validationError) {
    return { error: validationError };
  }

  const profile = await getCurrentProfile();
  const supabase = createClient();
  const { error } = await supabase.from("shifts").insert({
    staff_id: staffId,
    hotel_id: hotelId,
    work_date: workDate,
    start_time: startTime,
    end_time: endTime,
    status: "approved",
    approved_by: profile?.id,
    note: note || null,
    other_company_confirmed: true,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/shifts/calendar");
  return { error: null };
}
