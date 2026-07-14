import { redirect } from "next/navigation";
import { createClient, getCurrentProfile } from "@/lib/supabase/server";
import { TargetForm } from "@/components/target-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { saveMonthlyTargetAction } from "@/app/(dashboard)/targets/actions";
import type { Hotel, MonthlyTarget } from "@/lib/types/database.types";

export default async function TargetsPage() {
  const profile = await getCurrentProfile();

  // 目標管理はsuper_admin / managerのみ
  if (profile?.role !== "super_admin" && profile?.role !== "manager") {
    redirect("/dashboard");
  }

  const supabase = createClient();

  const [{ data: hotels }, { data: targets }] = await Promise.all([
    supabase.from("hotels").select("*").order("name").returns<Hotel[]>(),
    supabase
      .from("monthly_targets")
      .select("*, hotel:hotels(name)")
      .order("year_month", { ascending: false }),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">目標管理</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          月次の目標客室数・目標売上を設定します。同じ対象・年月で再度保存すると上書き更新されます。
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>目標を設定</CardTitle>
        </CardHeader>
        <CardContent>
          <TargetForm
            hotels={hotels ?? []}
            canSetCompanyWide={profile.role === "super_admin"}
            action={saveMonthlyTargetAction}
          />
        </CardContent>
      </Card>

      <div>
        <h2 className="mb-3 text-lg font-semibold">設定済みの目標</h2>
        <div className="rounded-xl border border-slate-100 bg-white shadow-sm">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>対象年月</TableHead>
                <TableHead>対象</TableHead>
                <TableHead>目標客室数</TableHead>
                <TableHead>目標売上</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {((targets ?? []) as (MonthlyTarget & { hotel: { name: string } | null })[]).map(
                (target) => (
                  <TableRow key={target.id}>
                    <TableCell>{target.year_month}</TableCell>
                    <TableCell>{target.hotel_id ? target.hotel?.name : "全社"}</TableCell>
                    <TableCell>{target.target_rooms.toLocaleString()}室</TableCell>
                    <TableCell>{target.target_sales.toLocaleString()}円</TableCell>
                  </TableRow>
                )
              )}

              {(targets ?? []).length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="py-10 text-center text-muted-foreground">
                    設定済みの目標がありません。
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
