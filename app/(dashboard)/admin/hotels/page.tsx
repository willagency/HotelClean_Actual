import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus } from "lucide-react";
import { createClient, getCurrentProfile } from "@/lib/supabase/server";
import { buttonVariants } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DeleteButton } from "@/components/delete-button";
import { deleteHotelAction } from "@/app/(dashboard)/admin/hotels/actions";
import type { Hotel } from "@/lib/types/database.types";

export default async function HotelsPage() {
  const profile = await getCurrentProfile();

  // ホテル登録・編集はsuper_adminのみの機能
  if (profile?.role !== "super_admin") {
    redirect("/dashboard");
  }

  const supabase = createClient();
  const { data: hotels } = await supabase
    .from("hotels")
    .select("*")
    .order("created_at", { ascending: false })
    .returns<Hotel[]>();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">ホテル管理</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            登録済みホテルの一覧です。客室単価もここから設定できます。
          </p>
        </div>
        <Link
          href="/admin/hotels/new"
          className={buttonVariants({ className: "flex items-center gap-2" })}
        >
          <Plus className="h-4 w-4" />
          新規ホテル登録
        </Link>
      </div>

      <div className="rounded-xl border border-slate-100 bg-white shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ホテル名</TableHead>
              <TableHead>親会社名</TableHead>
              <TableHead>担当支店</TableHead>
              <TableHead>クライアント担当者</TableHead>
              <TableHead>電話番号</TableHead>
              <TableHead className="text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(hotels ?? []).map((hotel) => (
              <TableRow key={hotel.id}>
                <TableCell className="font-medium">{hotel.name}</TableCell>
                <TableCell>{hotel.parent_company_name || "-"}</TableCell>
                <TableCell>{hotel.branch_name || "-"}</TableCell>
                <TableCell>{hotel.client_contact_name || "-"}</TableCell>
                <TableCell>{hotel.phone || "-"}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Link
                      href={`/admin/hotels/${hotel.id}/edit`}
                      className={buttonVariants({ variant: "outline", size: "sm" })}
                    >
                      編集
                    </Link>
                    <DeleteButton
                      id={hotel.id}
                      confirmMessage={`「${hotel.name}」を削除しますか?この操作は取り消せません。関連するシフト・日報・請求明細等の履歴も削除されます。`}
                      onDelete={deleteHotelAction}
                    />
                  </div>
                </TableCell>
              </TableRow>
            ))}

            {(hotels ?? []).length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                  登録済みのホテルがありません。「新規ホテル登録」から追加してください。
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
