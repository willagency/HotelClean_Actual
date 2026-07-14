"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert } from "@/components/ui/alert";
import type { DailyReport, DailyReportDetail, Hotel, RoomType } from "@/lib/types/database.types";

const selectClassName =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";

export function DailyReportForm({
  mode,
  hotels,
  roomTypes,
  pricesByHotel,
  initialReport,
  initialDetails,
  action,
}: {
  mode: "create" | "edit";
  hotels: Hotel[];
  roomTypes: RoomType[];
  pricesByHotel: Record<string, Record<string, number>>;
  initialReport?: DailyReport;
  initialDetails?: DailyReportDetail[];
  action: (formData: FormData) => Promise<{ error: string | null }>;
}) {
  const router = useRouter();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [selectedHotelId, setSelectedHotelId] = useState(
    initialReport?.hotel_id ?? hotels[0]?.id ?? ""
  );
  const [adjustmentAmount, setAdjustmentAmount] = useState(
    initialReport?.adjustment_amount ?? 0
  );
  const [counts, setCounts] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {};
    for (const detail of initialDetails ?? []) {
      initial[detail.room_type_id] = detail.completed_count;
    }
    return initial;
  });

  const grossSales = useMemo(() => {
    const prices = pricesByHotel[selectedHotelId] ?? {};
    return roomTypes.reduce((sum, rt) => {
      const count = counts[rt.id] ?? 0;
      const price = prices[rt.id] ?? 0;
      return sum + count * price;
    }, 0);
  }, [counts, selectedHotelId, roomTypes, pricesByHotel]);

  const totalRooms = roomTypes.reduce((sum, rt) => sum + (counts[rt.id] ?? 0), 0);
  const netPreview = grossSales + (Number(adjustmentAmount) || 0);

  async function handleSubmit(formData: FormData) {
    setErrorMessage(null);
    setIsSubmitting(true);

    const result = await action(formData);

    if (result.error) {
      setErrorMessage(result.error);
      setIsSubmitting(false);
      return;
    }

    router.push("/reports/daily");
    router.refresh();
  }

  return (
    <form action={handleSubmit} className="flex flex-col gap-6">
      {errorMessage && <Alert variant="destructive">{errorMessage}</Alert>}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="hotel_id">ホテル *</Label>
          {mode === "create" ? (
            <select
              id="hotel_id"
              name="hotel_id"
              required
              value={selectedHotelId}
              onChange={(e) => setSelectedHotelId(e.target.value)}
              className={selectClassName}
            >
              {hotels.map((hotel) => (
                <option key={hotel.id} value={hotel.id}>
                  {hotel.name}
                </option>
              ))}
            </select>
          ) : (
            <>
              <input type="hidden" name="hotel_id" value={selectedHotelId} />
              <p className="flex h-10 items-center text-sm text-muted-foreground">
                {hotels.find((h) => h.id === selectedHotelId)?.name ?? "-"}(変更不可)
              </p>
            </>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="report_date">対象日 *</Label>
          {mode === "create" ? (
            <Input id="report_date" name="report_date" type="date" required />
          ) : (
            <>
              <input type="hidden" name="report_date" value={initialReport?.report_date} />
              <p className="flex h-10 items-center text-sm text-muted-foreground">
                {initialReport?.report_date}(変更不可)
              </p>
            </>
          )}
        </div>
      </div>

      <div>
        <h2 className="mb-3 text-sm font-semibold">客室タイプ別 清掃完了室数</h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {roomTypes.map((rt) => (
            <div key={rt.id} className="flex flex-col gap-2">
              <Label htmlFor={`count_${rt.id}`}>{rt.name}</Label>
              <Input
                id={`count_${rt.id}`}
                name={`count_${rt.id}`}
                type="number"
                min={0}
                step={1}
                value={counts[rt.id] ?? 0}
                onChange={(e) =>
                  setCounts((prev) => ({ ...prev, [rt.id]: Number(e.target.value) }))
                }
              />
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="adjustment_amount">調整金(円、インセンティブ+ / イレギュラー費用-)</Label>
          <Input
            id="adjustment_amount"
            name="adjustment_amount"
            type="number"
            step={1}
            value={adjustmentAmount}
            onChange={(e) => setAdjustmentAmount(Number(e.target.value))}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="adjustment_note">調整金の理由メモ</Label>
          <Input
            id="adjustment_note"
            name="adjustment_note"
            defaultValue={initialReport?.adjustment_note ?? ""}
            placeholder="任意"
          />
        </div>
      </div>

      <div className="rounded-lg border border-border bg-secondary/50 p-4 text-sm">
        <p className="text-muted-foreground">
          清掃完了室数合計: <span className="font-medium text-foreground">{totalRooms}室</span>
        </p>
        <p className="text-muted-foreground">
          概算売上(単価×室数 + 調整金、人件費差引前):{" "}
          <span className="font-medium text-foreground">{netPreview.toLocaleString()}円</span>
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          ※人件費を差し引いた最終的な売上はダッシュボード機能(今後実装予定)で確認できます。
        </p>
      </div>

      <div className="flex justify-end gap-3">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "保存中..." : "保存する"}
        </Button>
      </div>
    </form>
  );
}
