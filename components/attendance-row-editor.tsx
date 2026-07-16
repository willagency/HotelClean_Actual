"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import type { AttendanceRow } from "@/lib/types/database.types";

export function AttendanceRowEditor({
  row,
  action,
}: {
  row: AttendanceRow;
  action: (shiftId: string, formData: FormData) => Promise<{ error: string | null }>;
}) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSubmit(formData: FormData) {
    setErrorMessage(null);
    setIsSubmitting(true);
    const result = await action(row.shift_id, formData);
    setIsSubmitting(false);

    if (result.error) {
      setErrorMessage(result.error);
      return;
    }
    router.refresh();
  }

  // 留学生のみ、直近7日間合計の状況に応じて色分けする
  // (超過=アラート / 残り4時間以内=警告)
  const alertLevel = !row.is_international_student
    ? "none"
    : row.rolling_total_hours > row.hour_limit
      ? "danger"
      : row.remaining_hours <= 4
        ? "warning"
        : "none";

  return (
    <form action={handleSubmit} className="flex flex-col gap-1">
      {errorMessage && (
        <Alert variant="destructive" className="text-xs">
          {errorMessage}
        </Alert>
      )}
      <div className="flex flex-wrap items-center gap-1.5">
        <Input
          type="time"
          name="actual_start_time"
          defaultValue={row.actual_start?.slice(0, 5) ?? ""}
          className="h-8 w-[110px] text-xs"
        />
        <span className="text-xs text-slate-400">〜</span>
        <Input
          type="time"
          name="actual_end_time"
          defaultValue={row.actual_end?.slice(0, 5) ?? ""}
          className="h-8 w-[110px] text-xs"
        />
        <Input
          type="number"
          name="break_minutes"
          min={0}
          step={5}
          defaultValue={row.break_minutes}
          placeholder="休憩(分)"
          className="h-8 w-[90px] text-xs"
        />
        <Button type="submit" size="sm" variant="outline" disabled={isSubmitting}>
          {isSubmitting ? "保存中..." : "保存"}
        </Button>
      </div>

      <div
        className={cn(
          "mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs",
          alertLevel === "danger" && "font-semibold text-rose-700",
          alertLevel === "warning" && "font-semibold text-amber-700",
          alertLevel === "none" && "text-slate-500"
        )}
      >
        <span>実働: {row.actual_hours !== null ? `${row.actual_hours.toFixed(1)}h` : "未入力"}</span>
        <span>
          差異:{" "}
          {row.variance_hours !== null
            ? `${row.variance_hours >= 0 ? "+" : ""}${row.variance_hours.toFixed(1)}h`
            : "-"}
        </span>
        {row.is_international_student && (
          <>
            <span>
              直近7日合計: {row.rolling_total_hours.toFixed(1)}h / {row.hour_limit}h
            </span>
            <span>残り: {row.remaining_hours.toFixed(1)}h</span>
          </>
        )}
      </div>
    </form>
  );
}
