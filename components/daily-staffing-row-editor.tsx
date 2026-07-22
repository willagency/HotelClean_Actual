"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import type { DailyStaffingRow } from "@/lib/types/database.types";

export function DailyStaffingRowEditor({
  row,
  workDate,
  action,
}: {
  row: DailyStaffingRow;
  workDate: string;
  action: (
    shiftTemplateId: string,
    workDate: string,
    targetHeadcount: number
  ) => Promise<{ error: string | null }>;
}) {
  const router = useRouter();
  const [value, setValue] = useState(row.target_headcount);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSave() {
    setErrorMessage(null);
    setIsSubmitting(true);
    const result = await action(row.shift_template_id, workDate, value);
    setIsSubmitting(false);

    if (result.error) {
      setErrorMessage(result.error);
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-1">
      {errorMessage && (
        <Alert variant="destructive" className="text-xs">
          {errorMessage}
        </Alert>
      )}
      <div className="flex items-center gap-2">
        <Input
          type="number"
          min={0}
          value={value}
          onChange={(e) => setValue(Number(e.target.value))}
          className="h-9 w-20"
        />
        <Button type="button" size="sm" variant="outline" onClick={handleSave} disabled={isSubmitting}>
          {isSubmitting ? "保存中..." : "保存"}
        </Button>
        {value !== row.default_headcount && (
          <span className="text-xs text-slate-400">(通常{row.default_headcount}人)</span>
        )}
      </div>
      <p
        className={cn(
          "text-xs font-medium",
          row.diff < 0 ? "text-rose-700" : row.diff > 0 ? "text-slate-500" : "text-slate-500"
        )}
      >
        承認済み{row.approved_count}人 /{" "}
        {row.diff < 0
          ? `不足 ${Math.abs(row.diff)}人`
          : row.diff > 0
            ? `余裕 +${row.diff}人`
            : "過不足なし"}
      </p>
    </div>
  );
}
