"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

// 注意: Next.jsのredirect()はクライアント側でtry/catchすると
// エラーとして誤検知されるため、この層ではredirectせず
// 呼び出し元(クライアントコンポーネント)にエラー有無だけを返す設計にする。
type ActionResult = { error: string | null };

function buildPricesPayload(formData: FormData, roomTypeIds: string[]) {
  return roomTypeIds.map((roomTypeId) => ({
    room_type_id: roomTypeId,
    unit_price: Number(formData.get(`price_${roomTypeId}`) ?? 0),
  }));
}

function buildShiftTemplatesPayload(formData: FormData) {
  const raw = String(formData.get("shift_templates_json") ?? "[]");
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function createHotelAction(
  roomTypeIds: string[],
  formData: FormData
): Promise<ActionResult> {
  const supabase = createClient();

  const { error } = await supabase.rpc("upsert_hotel_with_prices", {
    p_hotel_id: null,
    p_name: String(formData.get("name") ?? ""),
    p_parent_company_name: String(formData.get("parent_company_name") ?? ""),
    p_address: String(formData.get("address") ?? ""),
    p_phone: String(formData.get("phone") ?? ""),
    p_client_contact_name: String(formData.get("client_contact_name") ?? ""),
    p_branch_name: String(formData.get("branch_name") ?? ""),
    p_notes: String(formData.get("notes") ?? ""),
    p_prices: buildPricesPayload(formData, roomTypeIds),
    p_shift_templates: buildShiftTemplatesPayload(formData),
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/admin/hotels");
  return { error: null };
}

export async function updateHotelAction(
  hotelId: string,
  roomTypeIds: string[],
  formData: FormData
): Promise<ActionResult> {
  const supabase = createClient();

  const { error } = await supabase.rpc("upsert_hotel_with_prices", {
    p_hotel_id: hotelId,
    p_name: String(formData.get("name") ?? ""),
    p_parent_company_name: String(formData.get("parent_company_name") ?? ""),
    p_address: String(formData.get("address") ?? ""),
    p_phone: String(formData.get("phone") ?? ""),
    p_client_contact_name: String(formData.get("client_contact_name") ?? ""),
    p_branch_name: String(formData.get("branch_name") ?? ""),
    p_notes: String(formData.get("notes") ?? ""),
    p_prices: buildPricesPayload(formData, roomTypeIds),
    p_shift_templates: buildShiftTemplatesPayload(formData),
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/admin/hotels");
  revalidatePath(`/admin/hotels/${hotelId}/edit`);
  return { error: null };
}

// 削除はRLS(hotels_delete_admin)によりsuper_adminのみ実行可能。
// 以下の子テーブルは hotel_id に on delete cascade を設定しているため
// 削除時に自動的に消える: hotel_room_prices, hotel_staff, shifts,
// daily_reports(→daily_report_details), monthly_targets,
// invoices(→invoice_line_items)。
// 一方 profiles.primary_hotel_id は on delete restrict のため、
// このホテルを主所属とするスタッフが残っている場合は削除自体が失敗する。
export async function deleteHotelAction(hotelId: string): Promise<ActionResult> {
  const supabase = createClient();
  const { error, count } = await supabase
    .from("hotels")
    .delete({ count: "exact" })
    .eq("id", hotelId);

  if (error) {
    if (error.code === "23503") {
      return {
        error:
          "このホテルを主所属としているスタッフが残っているため削除できません。先にスタッフ管理画面で所属ホテルを変更するか、退職(在籍状況オフ)にしてください。",
      };
    }
    return { error: error.message };
  }
  if (!count) {
    return { error: "削除権限がないか、対象のホテルが見つかりません。" };
  }

  revalidatePath("/admin/hotels");
  return { error: null };
}
