import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus } from "lucide-react";
import { createClient, getCurrentProfile } from "@/lib/supabase/server";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ROLE_LABEL, SALARY_TYPE_LABEL } from "@/lib/constants";
import { DeleteButton } from "@/components/delete-button";
import { deleteStaffAction } from "@/app/(dashboard)/admin/staff/actions";
import type { Hotel, Profile } from "@/lib/types/database.types";

interface StaffRow extends Profile {
  hotel_staff: { hotel: { name: string } | null }[];
}

export default async function StaffPage({
  searchParams,
}: {
  searchParams: { hotel_id?: string; q?: string };
}) {
  const profile = await getCurrentProfile();

  // スタッフ管理はsuper_admin / managerのみ(checker・staffはアクセス不可)
  if (profile?.role !== "super_admin" && profile?.role !== "manager") {
    redirect("/dashboard");
  }

  const supabase = createClient();

  // hotelsはRLSでスコープされる(super_admin全件 / managerは自ホテルのみ)。
  // フィルタ用の選択肢としてそのまま使える。
  const { data: hotels } = await supabase
    .from("hotels")
    .select("*")
    .order("name")
    .returns<Hotel[]>();

  const hotelId = searchParams.hotel_id || "";
  const nameQuery = (searchParams.q || "").trim();

  // 所属ホテル名を一覧に表示するため hotel_staff を埋め込みで取得する。
  // ホテルで絞り込む場合は !inner を使い、該当ホテルに所属しないスタッフを除外する。
  let staffQuery = hotelId
    ? supabase
        .from("profiles")
        .select("*, hotel_staff!inner(hotel:hotels(name))")
        .eq("hotel_staff.hotel_id", hotelId)
    : supabase.from("profiles").select("*, hotel_staff(hotel:hotels(name))");

  if (nameQuery) {
    // ilike + %検索%: 大文字小文字を区別しない部分一致検索
    staffQuery = staffQuery.ilike("name", `%${nameQuery}%`);
  }

  const { data: staffList } = await staffQuery
    .order("created_at", { ascending: false })
    .returns<StaffRow[]>();

  const buildHref = (params: Record<string, string>) =>
    `/admin/staff?${new URLSearchParams(params).toString()}`;

  const hasActiveFilter = Boolean(hotelId || nameQuery);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">スタッフ管理</h1>
          <p className="mt-1 text-sm text-slate-500">
            登録済みスタッフの一覧です。役職・給与形態・所属ホテルを管理できます。
          </p>
        </div>
        <Link
          href="/admin/staff/new"
          className={buttonVariants({ className: "flex items-center gap-2" })}
        >
          <Plus className="h-4 w-4" />
          新規スタッフ登録
        </Link>
      </div>

      <form className="flex flex-wrap items-center gap-2">
        <Input
          type="text"
          name="q"
          defaultValue={nameQuery}
          placeholder="氏名で検索"
          className="h-9 w-48"
        />

        {(hotels ?? []).length > 1 && (
          <select
            name="hotel_id"
            defaultValue={hotelId}
            className="h-9 rounded-md border border-input bg-background px-2 text-sm"
          >
            <option value="">すべてのホテル</option>
            {(hotels ?? []).map((hotel) => (
              <option key={hotel.id} value={hotel.id}>
                {hotel.name}
              </option>
            ))}
          </select>
        )}

        <Button type="submit" variant="outline" size="sm">
          検索
        </Button>
        {hasActiveFilter && (
          <Link href={buildHref({})} className="text-sm text-slate-500 underline-offset-2 hover:underline">
            解除
          </Link>
        )}
      </form>

      <div className="rounded-xl border border-slate-100 bg-white shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>氏名</TableHead>
              <TableHead>メールアドレス</TableHead>
              <TableHead>役職</TableHead>
              <TableHead>所属ホテル</TableHead>
              <TableHead>給与形態</TableHead>
              <TableHead>在籍状況</TableHead>
              <TableHead className="text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(staffList ?? []).map((staff) => {
              const hotelNames = staff.hotel_staff
                .map((hs) => hs.hotel?.name)
                .filter(Boolean)
                .join("、");

              return (
                <TableRow key={staff.id}>
                  <TableCell className="font-medium">{staff.name}</TableCell>
                  <TableCell>{staff.email}</TableCell>
                  <TableCell>{ROLE_LABEL[staff.role]}</TableCell>
                  <TableCell>{hotelNames || "-"}</TableCell>
                  <TableCell>
                    {SALARY_TYPE_LABEL[staff.salary_type]}(
                    {staff.salary_amount.toLocaleString()}円)
                  </TableCell>
                  <TableCell>
                    {staff.is_active ? (
                      <span className="text-slate-900">在籍中</span>
                    ) : (
                      <span className="text-slate-400">退職</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Link
                        href={`/admin/staff/${staff.id}/edit`}
                        className={buttonVariants({ variant: "outline", size: "sm" })}
                      >
                        編集
                      </Link>
                      {profile.role === "super_admin" && staff.id !== profile.id && (
                        <DeleteButton
                          id={staff.id}
                          confirmMessage={`「${staff.name}」を削除しますか?この操作は取り消せません。ログインアカウントごと削除されます。`}
                          onDelete={deleteStaffAction}
                        />
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}

            {(staffList ?? []).length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                  該当するスタッフがいません。
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
