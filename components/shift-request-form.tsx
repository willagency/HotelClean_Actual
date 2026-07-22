"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert } from "@/components/ui/alert";
import type { Hotel, ShiftTemplate } from "@/lib/types/database.types";

const selectClassName =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";

export function ShiftRequestForm({
  hotels,
  templatesByHotel,
  isInternationalStudent,
  isLongVacationMode,
  action,
}: {
  hotels: Hotel[];
  templatesByHotel: Record<string, ShiftTemplate[]>;
  isInternationalStudent: boolean;
  isLongVacationMode: boolean;
  action: (formData: FormData) => Promise<{ error: string | null }>;
}) {
  const router = useRouter();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedHotelId, setSelectedHotelId] = useState(hotels[0]?.id ?? "");

  const hourLimit = isLongVacationMode ? 40 : 28;
  const templatesForHotel = templatesByHotel[selectedHotelId] ?? [];
  const hasTemplates = templatesForHotel.length > 0;

  async function handleSubmit(formData: FormData) {
    setErrorMessage(null);
    setIsSubmitting(true);

    const result = await action(formData);

    setIsSubmitting(false);
    if (result.error) {
      setErrorMessage(result.error);
      return;
    }

    router.refresh();
    (document.getElementById("shift-request-form") as HTMLFormElement | null)?.reset();
  }

  return (
    <form id="shift-request-form" action={handleSubmit} className="flex flex-col gap-4">
      {errorMessage && <Alert variant="destructive">{errorMessage}</Alert>}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="hotel_id">勤務先ホテル *</Label>
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
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="work_date">希望日 *</Label>
          <Input id="work_date" name="work_date" type="date" required />
        </div>

        {hasTemplates ? (
          <div className="flex flex-col gap-2 sm:col-span-2">
            <Label htmlFor="shift_template_id">勤務シフト *</Label>
            <select id="shift_template_id" name="shift_template_id" required className={selectClassName}>
              {templatesForHotel.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.label}({template.start_time.slice(0, 5)}〜
                  {template.end_time.slice(0, 5)})
                </option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">
              このホテルに登録されているシフト時間帯から選択してください。
            </p>
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-2">
              <Label htmlFor="start_time">開始時刻 *</Label>
              <Input id="start_time" name="start_time" type="time" required />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="end_time">終了時刻 *</Label>
              <Input id="end_time" name="end_time" type="time" required />
            </div>
          </>
        )}

        <div className="flex flex-col gap-2 sm:col-span-2">
          <Label htmlFor="note">備考</Label>
          <Input id="note" name="note" placeholder="任意" />
        </div>
      </div>

      {isInternationalStudent && (
        <div className="flex flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm font-semibold text-amber-800">
            資格外活動許可(週28時間ルール)対象者向けの確認事項
          </p>
          <p className="text-xs text-amber-700">
            週の上限時間は他社(掛け持ち先)での勤務時間も合算されます。
            {isLongVacationMode
              ? "現在は長期休業期間モードのため、1日8時間・任意の連続7日間で合計40時間が上限です。"
              : `任意の連続7日間で合計${hourLimit}時間が上限です。`}
          </p>

          <div className="flex flex-col gap-2">
            <Label htmlFor="other_company_hours">
              この勤務日に他社で勤務する(予定の)時間(時間)
            </Label>
            <Input
              id="other_company_hours"
              name="other_company_hours"
              type="number"
              min={0}
              step={0.5}
              defaultValue={0}
            />
          </div>

          <label className="flex items-start gap-2 text-sm text-amber-800">
            <input
              id="other_company_confirmed"
              name="other_company_confirmed"
              type="checkbox"
              required
              className="mt-0.5 h-5 w-5 rounded border-amber-300"
            />
            他社での勤務を含めて、週{hourLimit}時間以内であることを確認しました
          </label>
        </div>
      )}

      <div className="flex justify-end">
        <Button
          type="submit"
          size="lg"
          className="w-full sm:w-auto"
          disabled={isSubmitting || hotels.length === 0}
        >
          {isSubmitting ? "申請中..." : "シフトを申請する"}
        </Button>
      </div>
    </form>
  );
}
