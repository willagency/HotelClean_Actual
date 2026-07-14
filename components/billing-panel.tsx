"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import type { HotelMonthlySummary, InvoiceWithHotel } from "@/lib/types/database.types";

export function BillingPanel({
  hotelId,
  yearMonth,
  summary,
  existingInvoice,
  generateAction,
}: {
  hotelId: string;
  yearMonth: string;
  summary: HotelMonthlySummary;
  existingInvoice: InvoiceWithHotel | null;
  generateAction: (
    hotelId: string,
    yearMonth: string
  ) => Promise<{ error: string | null; invoiceId?: string }>;
}) {
  const router = useRouter();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const laborCost = summary.hourly_labor_cost + summary.monthly_labor_cost;

  async function handleGenerate() {
    setErrorMessage(null);
    setIsSubmitting(true);

    const result = await generateAction(hotelId, yearMonth);
    setIsSubmitting(false);

    if (result.error) {
      setErrorMessage(result.error);
      return;
    }

    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{yearMonth} の集計内容</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {errorMessage && <Alert variant="destructive">{errorMessage}</Alert>}

        <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
          <div>
            <p className="text-muted-foreground">清掃売上</p>
            <p className="text-lg font-semibold">{summary.gross_sales.toLocaleString()}円</p>
          </div>
          <div>
            <p className="text-muted-foreground">人件費</p>
            <p className="text-lg font-semibold">-{laborCost.toLocaleString()}円</p>
          </div>
          <div>
            <p className="text-muted-foreground">調整金</p>
            <p className="text-lg font-semibold">
              {summary.adjustment_total >= 0 ? "+" : ""}
              {summary.adjustment_total.toLocaleString()}円
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">ご請求金額</p>
            <p className="text-lg font-semibold text-primary">
              {summary.net_sales.toLocaleString()}円
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
          <div className="text-sm text-muted-foreground">
            {existingInvoice ? (
              <span>
                この月の請求明細は発行済みです(最終更新:{" "}
                {existingInvoice.generated_at
                  ? new Date(existingInvoice.generated_at).toLocaleString("ja-JP")
                  : "-"}
                )
              </span>
            ) : (
              <span>まだこの月の請求明細は発行されていません。</span>
            )}
          </div>

          <div className="flex gap-2">
            <Button type="button" onClick={handleGenerate} disabled={isSubmitting}>
              {isSubmitting
                ? "処理中..."
                : existingInvoice
                  ? "最新実績で再発行する"
                  : "確定して発行する"}
            </Button>
            {existingInvoice && (
              <a
                href={`/api/invoices/${existingInvoice.id}/pdf`}
                className="inline-flex h-10 items-center justify-center rounded-md border border-input bg-background px-4 text-sm font-medium hover:bg-secondary"
              >
                PDFダウンロード
              </a>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
