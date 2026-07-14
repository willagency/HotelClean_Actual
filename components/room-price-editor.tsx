"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { RoomType } from "@/lib/types/database.types";

export function RoomPriceEditor({
  roomTypes,
  initialPrices,
}: {
  roomTypes: RoomType[];
  initialPrices?: Record<string, number>;
}) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
      {roomTypes.map((roomType) => (
        <div key={roomType.id} className="flex flex-col gap-2">
          <Label htmlFor={`price_${roomType.id}`}>{roomType.name} 単価(円)</Label>
          <Input
            id={`price_${roomType.id}`}
            name={`price_${roomType.id}`}
            type="number"
            min={0}
            step={100}
            defaultValue={initialPrices?.[roomType.id] ?? 0}
            required
          />
        </div>
      ))}
    </div>
  );
}
