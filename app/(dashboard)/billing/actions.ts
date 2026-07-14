"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

type ActionResult = { error: string | null; invoiceId?: string };

// 集計スナップショットをinvoices/invoice_line_itemsに確定保存する。
// 同一ホテル・同一年月であれば、その時点の最新実績で上書きされる。
export async function generateInvoiceAction(
  hotelId: string,
  yearMonth: string
): Promise<ActionResult> {
  if (!hotelId || !yearMonth) {
    return { error: "ホテルと対象年月を指定してください。" };
  }

  const supabase = createClient();
  const { data, error } = await supabase.rpc("upsert_invoice_snapshot", {
    p_hotel_id: hotelId,
    p_year_month: yearMonth,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/billing");
  return { error: null, invoiceId: data as string };
}

// 削除はsuper_adminのみ(RLS: invoices_delete_admin)
export async function deleteInvoiceAction(invoiceId: string): Promise<ActionResult> {
  const supabase = createClient();
  const { error, count } = await supabase
    .from("invoices")
    .delete({ count: "exact" })
    .eq("id", invoiceId);

  if (error) {
    return { error: error.message };
  }
  if (!count) {
    return { error: "削除権限がありません。" };
  }

  revalidatePath("/billing");
  return { error: null };
}
