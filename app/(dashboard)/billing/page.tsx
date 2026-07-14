import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient, getCurrentProfile } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { BillingPanel } from "@/components/billing-panel";
import { getCurrentYearMonth, shiftYearMonth } from "@/lib/date-utils";
import { generateInvoiceAction } from "@/app/(dashboard)/billing/actions";
import type { Hotel, HotelMonthlySummary, InvoiceWithHotel } from "@/lib/types/database.types";

export default async function BillingPage({
  searchParams,
}: {
  searchParams: { month?: string; hotel_id?: string };
}) {
  const profile = await getCurrentProfile();

  // 請求明細はsuper_admin / managerのみ
  if (profile?.role !== "super_admin" && profile?.role !== "manager") {
    redirect("/dashboard");
  }

  const supabase = createClient();
  const { data: hotels } = await supabase
    .from("hotels")
    .select("*")
    .order("name")
    .returns<Hotel[]>();

  const yearMonth = searchParams.month || getCurrentYearMonth();
  const hotelId = searchParams.hotel_id || hotels?.[0]?.id || "";

  let summary: HotelMonthlySummary | undefined;
  let existingInvoice: InvoiceWithHotel | null = null;

  if (hotelId) {
    const [{ data: summaryRows }, { data: invoiceRow }] = await Promise.all([
      supabase.rpc("get_hotel_monthly_summary", {
        p_hotel_id: hotelId,
        p_year_month: yearMonth,
      }),
      supabase
        .from("invoices")
        .select("*, hotel:hotels(name)")
        .eq("hotel_id", hotelId)
        .eq("year_month", yearMonth)
        .maybeSingle(),
    ]);
    summary = (summaryRows as HotelMonthlySummary[] | null)?.[0];
    existingInvoice = invoiceRow as InvoiceWithHotel | null;
  }

  const { data: allInvoices } = await supabase
    .from("invoices")
    .select("*, hotel:hotels(name)")
    .order("year_month", { ascending: false })
    .returns<InvoiceWithHotel[]>();

  const baseParams = { month: yearMonth, hotel_id: hotelId };
  const buildHref = (params: Record<string, string>) =>
    `/billing?${new URLSearchParams(params).toString()}`;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">請求明細</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          月次の集計内容を確認し、確定後にPDFをダウンロードできます。
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <form className="flex items-center gap-2">
          <input type="hidden" name="month" value={yearMonth} />
          <select
            name="hotel_id"
            defaultValue={hotelId}
            className="h-9 rounded-md border border-input bg-background px-2 text-sm"
          >
            {(hotels ?? []).map((hotel) => (
              <option key={hotel.id} value={hotel.id}>
                {hotel.name}
              </option>
            ))}
          </select>
          <Button type="submit" variant="outline" size="sm">
            表示
          </Button>
        </form>

        <div className="flex items-center gap-2">
          <Link href={buildHref({ ...baseParams, month: shiftYearMonth(yearMonth, -1) })}>
            <Button type="button" variant="outline" size="sm">
              前月
            </Button>
          </Link>
          <span className="min-w-[90px] text-center text-sm font-medium">{yearMonth}</span>
          <Link href={buildHref({ ...baseParams, month: shiftYearMonth(yearMonth, 1) })}>
            <Button type="button" variant="outline" size="sm">
              翌月
            </Button>
          </Link>
        </div>
      </div>

      {hotelId && summary ? (
        <BillingPanel
          hotelId={hotelId}
          yearMonth={yearMonth}
          summary={summary}
          existingInvoice={existingInvoice}
          generateAction={generateInvoiceAction}
        />
      ) : (
        <p className="text-sm text-muted-foreground">
          ホテルが登録されていません。先にホテルを登録してください。
        </p>
      )}

      <div>
        <h2 className="mb-3 text-lg font-semibold">発行履歴</h2>
        <div className="rounded-xl border border-slate-100 bg-white shadow-sm">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>対象年月</TableHead>
                <TableHead>ホテル</TableHead>
                <TableHead>清掃室数</TableHead>
                <TableHead>ご請求金額</TableHead>
                <TableHead className="text-right">PDF</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(allInvoices ?? []).map((invoice) => (
                <TableRow key={invoice.id}>
                  <TableCell>{invoice.year_month}</TableCell>
                  <TableCell>{invoice.hotel?.name ?? "-"}</TableCell>
                  <TableCell>{invoice.total_rooms.toLocaleString()}室</TableCell>
                  <TableCell>{invoice.net_sales.toLocaleString()}円</TableCell>
                  <TableCell className="text-right">
                    <a
                      href={`/api/invoices/${invoice.id}/pdf`}
                      className="text-sm font-medium text-primary underline-offset-2 hover:underline"
                    >
                      ダウンロード
                    </a>
                  </TableCell>
                </TableRow>
              ))}

              {(allInvoices ?? []).length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                    発行済みの請求明細がありません。
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
