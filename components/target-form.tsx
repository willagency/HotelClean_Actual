"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert } from "@/components/ui/alert";
import type { Hotel } from "@/lib/types/database.types";

const selectClassName =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";

export function TargetForm({
  hotels,
  canSetCompanyWide,
  action,
}: {
  hotels: Hotel[];
  canSetCompanyWide: boolean;
  action: (formData: FormData) => Promise<{ error: string | null }>;
}) {
  const router = useRouter();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(formData: FormData) {
    setErrorMessage(null);
    setSuccessMessage(null);
    setIsSubmitting(true);

    const result = await action(formData);
    setIsSubmitting(false);

    if (result.error) {
      setErrorMessage(result.error);
      return;
    }

    setSuccessMessage("目標を保存しました。");
    router.refresh();
  }

  return (
    <form action={handleSubmit} className="flex flex-col gap-4">
      {errorMessage && <Alert variant="destructive">{errorMessage}</Alert>}
      {successMessage && <Alert>{successMessage}</Alert>}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="hotel_id">対象 *</Label>
          <select id="hotel_id" name="hotel_id" required className={selectClassName}>
            {canSetCompanyWide && <option value="">全社(会社全体の目標)</option>}
            {hotels.map((hotel) => (
              <option key={hotel.id} value={hotel.id}>
                {hotel.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="year_month">対象年月 *</Label>
          <Input id="year_month" name="year_month" type="month" required />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="target_rooms">目標客室数(室)</Label>
          <Input id="target_rooms" name="target_rooms" type="number" min={0} step={1} defaultValue={0} />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="target_sales">目標売上(円)</Label>
          <Input id="target_sales" name="target_sales" type="number" min={0} step={1} defaultValue={0} />
        </div>
      </div>

      <div className="flex justify-end">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "保存中..." : "目標を保存する"}
        </Button>
      </div>
    </form>
  );
}
