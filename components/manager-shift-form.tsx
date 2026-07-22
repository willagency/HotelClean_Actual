"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert } from "@/components/ui/alert";
import type { Hotel, Profile, ShiftTemplate } from "@/lib/types/database.types";

const selectClassName =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";

export function ManagerShiftForm({
  hotels,
  staffOptions,
  templatesByHotel,
  action,
}: {
  hotels: Hotel[];
  staffOptions: Profile[];
  templatesByHotel: Record<string, ShiftTemplate[]>;
  action: (formData: FormData) => Promise<{ error: string | null }>;
}) {
  const router = useRouter();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedHotelId, setSelectedHotelId] = useState(hotels[0]?.id ?? "");

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
    (document.getElementById("manager-shift-form") as HTMLFormElement | null)?.reset();
  }

  return (
    <form id="manager-shift-form" action={handleSubmit} className="flex flex-col gap-4">
      {errorMessage && <Alert variant="destructive">{errorMessage}</Alert>}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="staff_id">スタッフ *</Label>
          <select id="staff_id" name="staff_id" required className={selectClassName}>
            {staffOptions.map((staff) => (
              <option key={staff.id} value={staff.id}>
                {staff.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="hotel_id">ホテル *</Label>
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
          <Label htmlFor="work_date">勤務日 *</Label>
          <Input id="work_date" name="work_date" type="date" required />
        </div>

        <div className="flex flex-col gap-2" />

        {hasTemplates ? (
          <div className="flex flex-col gap-2 sm:col-span-2">
            <Label htmlFor="shift_template_id">シフト時間帯 *</Label>
            <select id="shift_template_id" name="shift_template_id" required className={selectClassName}>
              {templatesForHotel.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.label}({template.start_time.slice(0, 5)}〜
                  {template.end_time.slice(0, 5)})
                </option>
              ))}
            </select>
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

      <p className="text-xs text-muted-foreground">
        ここから登録したシフトは承認済み扱いで即座に登録されます。
      </p>

      <div className="flex justify-end">
        <Button type="submit" disabled={isSubmitting || staffOptions.length === 0}>
          {isSubmitting ? "登録中..." : "シフトを登録する"}
        </Button>
      </div>
    </form>
  );
}
