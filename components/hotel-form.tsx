"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert } from "@/components/ui/alert";
import { Textarea } from "@/components/ui/textarea";
import { RoomPriceEditor } from "@/components/room-price-editor";
import { ShiftTemplateEditor } from "@/components/shift-template-editor";
import type { Hotel, RoomType, ShiftTemplate } from "@/lib/types/database.types";

export function HotelForm({
  roomTypes,
  initialHotel,
  initialPrices,
  initialShiftTemplates,
  action,
}: {
  roomTypes: RoomType[];
  initialHotel?: Hotel;
  initialPrices?: Record<string, number>;
  initialShiftTemplates?: ShiftTemplate[];
  action: (formData: FormData) => Promise<{ error: string | null }>;
}) {
  const router = useRouter();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(formData: FormData) {
    setErrorMessage(null);
    setIsSubmitting(true);

    const result = await action(formData);

    if (result.error) {
      setErrorMessage(result.error);
      setIsSubmitting(false);
      return;
    }

    router.push("/admin/hotels");
    router.refresh();
  }

  return (
    <form action={handleSubmit} className="flex flex-col gap-6">
      {errorMessage && <Alert variant="destructive">{errorMessage}</Alert>}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="name">ホテル名 *</Label>
          <Input id="name" name="name" required defaultValue={initialHotel?.name} />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="parent_company_name">親会社名</Label>
          <Input
            id="parent_company_name"
            name="parent_company_name"
            defaultValue={initialHotel?.parent_company_name ?? ""}
          />
        </div>

        <div className="flex flex-col gap-2 sm:col-span-2">
          <Label htmlFor="address">住所</Label>
          <Input id="address" name="address" defaultValue={initialHotel?.address ?? ""} />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="phone">電話番号</Label>
          <Input id="phone" name="phone" defaultValue={initialHotel?.phone ?? ""} />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="client_contact_name">クライアント担当者名</Label>
          <Input
            id="client_contact_name"
            name="client_contact_name"
            defaultValue={initialHotel?.client_contact_name ?? ""}
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="branch_name">担当支店</Label>
          <Input
            id="branch_name"
            name="branch_name"
            defaultValue={initialHotel?.branch_name ?? ""}
          />
        </div>

        <div className="flex flex-col gap-2 sm:col-span-2">
          <Label htmlFor="notes">備考</Label>
          <Textarea id="notes" name="notes" defaultValue={initialHotel?.notes ?? ""} />
        </div>
      </div>

      <div>
        <h2 className="mb-3 text-sm font-semibold">客室タイプ別単価</h2>
        <RoomPriceEditor roomTypes={roomTypes} initialPrices={initialPrices} />
      </div>

      <div>
        <h2 className="mb-3 text-sm font-semibold">シフト時間帯(スタッフが申請時に選択)</h2>
        <ShiftTemplateEditor initialTemplates={initialShiftTemplates ?? []} />
      </div>

      <div className="flex justify-end gap-3">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "保存中..." : "保存する"}
        </Button>
      </div>
    </form>
  );
}
