"use server";

import { revalidatePath } from "next/cache";
import { createClient, getCurrentProfile } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { SalaryType, UserRole } from "@/lib/types/database.types";

type ActionResult = { error: string | null };

function parseHotelIds(formData: FormData): string[] {
  return formData.getAll("hotel_ids").map(String).filter(Boolean);
}

// -----------------------------------------------------------
// 新規スタッフ登録
// 1. service_roleクライアントで auth.users を作成(通常クライアントでは不可)
// 2. 以降は「ログイン中ユーザーのセッション付きクライアント」でprofiles /
//    hotel_staff に書き込む => RLS(profiles_insert_manager等)が
//    そのまま効くため、role・所属ホテルの権限チェックはDB側に一元化される
// 3. profiles/hotel_staffの書き込みに失敗した場合は、作成済みのauth.usersを
//    削除してロールバックする(orphanなログインアカウントを残さないため)
// -----------------------------------------------------------
export async function createStaffAction(formData: FormData): Promise<ActionResult> {
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const role = String(formData.get("role") ?? "") as UserRole;
  const salaryType = String(formData.get("salary_type") ?? "") as SalaryType;
  const salaryAmount = Number(formData.get("salary_amount") ?? 0);
  const initialPassword = String(formData.get("initial_password") ?? "");
  const isInternationalStudent = formData.get("is_international_student") === "on";
  const isLongVacationMode = formData.get("is_long_vacation_mode") === "on";
  const hotelIds = parseHotelIds(formData);

  if (!name || !email || !role || !salaryType) {
    return { error: "必須項目が入力されていません。" };
  }
  if (initialPassword.length < 8) {
    return { error: "初期パスワードは8文字以上で設定してください。" };
  }
  if (hotelIds.length === 0) {
    return { error: "所属ホテルを1つ以上選択してください。" };
  }

  const admin = createAdminClient();

  const { data: created, error: createUserError } = await admin.auth.admin.createUser({
    email,
    password: initialPassword,
    email_confirm: true,
  });

  if (createUserError || !created.user) {
    return {
      error:
        createUserError?.message ??
        "アカウント作成に失敗しました。メールアドレスが既に使われていないか確認してください。",
    };
  }

  const newUserId = created.user.id;
  const supabase = createClient();

  const { error: profileError } = await supabase.from("profiles").insert({
    id: newUserId,
    name,
    email,
    phone: phone || null,
    role,
    salary_type: salaryType,
    salary_amount: salaryAmount,
    primary_hotel_id: hotelIds[0],
    is_international_student: isInternationalStudent,
    is_long_vacation_mode: isLongVacationMode,
  });

  if (profileError) {
    await admin.auth.admin.deleteUser(newUserId);
    return { error: profileError.message };
  }

  const { error: hotelStaffError } = await supabase
    .from("hotel_staff")
    .insert(hotelIds.map((hotelId) => ({ hotel_id: hotelId, staff_id: newUserId })));

  if (hotelStaffError) {
    // profiles は auth.users への on delete cascade で連動して削除される
    await admin.auth.admin.deleteUser(newUserId);
    return { error: hotelStaffError.message };
  }

  revalidatePath("/admin/staff");
  return { error: null };
}

// -----------------------------------------------------------
// スタッフ情報の更新(氏名・電話番号・役職・給与・在籍フラグ・所属ホテル)
// メールアドレス変更・パスワード再設定はフェーズ3以降で対応予定
// -----------------------------------------------------------
export async function updateStaffAction(
  staffId: string,
  formData: FormData
): Promise<ActionResult> {
  const name = String(formData.get("name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const role = String(formData.get("role") ?? "") as UserRole;
  const salaryType = String(formData.get("salary_type") ?? "") as SalaryType;
  const salaryAmount = Number(formData.get("salary_amount") ?? 0);
  const isActive = formData.get("is_active") === "on";
  const isInternationalStudent = formData.get("is_international_student") === "on";
  const isLongVacationMode = formData.get("is_long_vacation_mode") === "on";
  const hotelIds = parseHotelIds(formData);

  if (!name || !role || !salaryType) {
    return { error: "必須項目が入力されていません。" };
  }
  if (hotelIds.length === 0) {
    return { error: "所属ホテルを1つ以上選択してください。" };
  }

  const supabase = createClient();

  const { error: profileError } = await supabase
    .from("profiles")
    .update({
      name,
      phone: phone || null,
      role,
      salary_type: salaryType,
      salary_amount: salaryAmount,
      primary_hotel_id: hotelIds[0],
      is_active: isActive,
      is_international_student: isInternationalStudent,
      is_long_vacation_mode: isLongVacationMode,
    })
    .eq("id", staffId);

  if (profileError) {
    return { error: profileError.message };
  }

  const { error: deleteError } = await supabase
    .from("hotel_staff")
    .delete()
    .eq("staff_id", staffId);

  if (deleteError) {
    return { error: deleteError.message };
  }

  const { error: insertError } = await supabase
    .from("hotel_staff")
    .insert(hotelIds.map((hotelId) => ({ hotel_id: hotelId, staff_id: staffId })));

  if (insertError) {
    return { error: insertError.message };
  }

  revalidatePath("/admin/staff");
  revalidatePath(`/admin/staff/${staffId}/edit`);
  return { error: null };
}

// -----------------------------------------------------------
// スタッフの削除(ログインアカウントごと削除)
//
// service_roleクライアントの admin.deleteUser() は auth.users を削除し、
// profiles.id が auth.users(id) を on delete cascade で参照しているため
// profiles / hotel_staff は自動的に連動して消える。
//
// ただし以下は profiles(id) を「cascadeなし(NO ACTION)」で参照しているため、
// このスタッフが過去に日報入力・シフト承認・請求明細発行を行っていた場合、
// 削除はPostgres側の外部キー制約違反で失敗する(履歴の入力者が消えるのを防ぐため):
//   - shifts.approved_by
//   - daily_reports.created_by
//   - invoices.generated_by
//
// service_roleはRLSを完全にバイパスするため、権限チェック(super_adminのみ)は
// このアクション内で明示的に行う。
export async function deleteStaffAction(staffId: string): Promise<ActionResult> {
  const profile = await getCurrentProfile();

  if (profile?.role !== "super_admin") {
    return { error: "削除権限がありません。" };
  }
  if (profile.id === staffId) {
    return { error: "自分自身のアカウントは削除できません。" };
  }

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.deleteUser(staffId);

  if (error) {
    return {
      error:
        `削除に失敗しました(${error.message})。日報入力・シフト承認・請求明細発行などの` +
        "履歴にこのスタッフの記録が残っている場合は削除できません。かわりに編集画面で「在籍状況」を退職にしてください。",
    };
  }

  revalidatePath("/admin/staff");
  return { error: null };
}
