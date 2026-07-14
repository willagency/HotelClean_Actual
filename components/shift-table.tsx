"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { ShiftStatusBadge } from "@/components/shift-status-badge";
import { cn } from "@/lib/utils";
import type { ShiftWithRelations } from "@/lib/types/database.types";

type ActionResult = { error: string | null };

export function ShiftTable({
  shifts,
  mode,
  onCancel,
  onApprove,
  onReject,
}: {
  shifts: ShiftWithRelations[];
  mode: "self" | "approver" | "readonly";
  onCancel?: (shiftId: string) => Promise<ActionResult>;
  onApprove?: (shiftId: string) => Promise<ActionResult>;
  onReject?: (shiftId: string) => Promise<ActionResult>;
}) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleAction(shiftId: string, fn?: (id: string) => Promise<ActionResult>) {
    if (!fn) return;
    setErrorMessage(null);
    setPendingId(shiftId);
    const result = await fn(shiftId);
    setPendingId(null);

    if (result.error) {
      setErrorMessage(result.error);
      return;
    }
    router.refresh();
  }

  const showStaffColumn = mode !== "self";
  const showActionsColumn = mode !== "readonly";
  // スタッフ本人操作(モバイル)は大きめ、承認者操作(PC)は通常サイズにする
  const actionButtonSize = mode === "self" ? "lg" : "sm";

  return (
    <div className="flex flex-col gap-3">
      {errorMessage && <Alert variant="destructive">{errorMessage}</Alert>}

      {/* モバイル(self)は縦積みカード、PC(approver/readonly)はテーブルのまま */}
      {mode === "self" ? (
        <div className="flex flex-col gap-3 sm:hidden">
          {shifts.map((shift) => {
            const isPending = pendingId === shift.id;
            const canCancel = shift.status === "requested";
            return (
              <div
                key={shift.id}
                className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm"
              >
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold">{shift.work_date}</p>
                  <ShiftStatusBadge status={shift.status} />
                </div>
                <p className="mt-1 text-sm text-slate-600">{shift.hotel?.name ?? "-"}</p>
                <p className="mt-0.5 text-sm text-slate-600">
                  {shift.start_time.slice(0, 5)} 〜 {shift.end_time.slice(0, 5)}
                </p>
                {shift.note && <p className="mt-1 text-xs text-slate-400">{shift.note}</p>}
                {canCancel && (
                  <Button
                    type="button"
                    variant="outline"
                    size="lg"
                    disabled={isPending}
                    className="mt-3 w-full"
                    onClick={() => handleAction(shift.id, onCancel)}
                  >
                    取り消す
                  </Button>
                )}
              </div>
            );
          })}

          {shifts.length === 0 && (
            <div className="rounded-xl border border-slate-100 bg-white p-6 text-center text-sm text-slate-500 shadow-sm">
              該当するシフトはありません。
            </div>
          )}
        </div>
      ) : null}

      <div className={cn("rounded-xl border border-slate-100 bg-white shadow-sm", mode === "self" && "hidden sm:block")}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>日付</TableHead>
              {showStaffColumn && <TableHead>スタッフ</TableHead>}
              <TableHead>ホテル</TableHead>
              <TableHead>時間</TableHead>
              <TableHead>ステータス</TableHead>
              <TableHead>備考</TableHead>
              {showActionsColumn && <TableHead className="text-right">操作</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {shifts.map((shift) => {
              const isPending = pendingId === shift.id;
              const canCancel = mode === "self" && shift.status === "requested";
              const canApproveReject = mode === "approver" && shift.status === "requested";

              return (
                <TableRow key={shift.id}>
                  <TableCell>{shift.work_date}</TableCell>
                  {showStaffColumn && (
                    <TableCell>
                      {shift.staff?.name ?? "-"}
                      {shift.staff?.is_international_student && (
                        <span className="ml-1.5 inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                          留学生
                        </span>
                      )}
                    </TableCell>
                  )}
                  <TableCell>{shift.hotel?.name ?? "-"}</TableCell>
                  <TableCell>
                    {shift.start_time.slice(0, 5)} 〜 {shift.end_time.slice(0, 5)}
                  </TableCell>
                  <TableCell>
                    <ShiftStatusBadge status={shift.status} />
                  </TableCell>
                  <TableCell className="max-w-[200px] truncate text-muted-foreground">
                    {shift.note || "-"}
                  </TableCell>
                  {showActionsColumn && (
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        {canCancel && (
                          <Button
                            type="button"
                            variant="outline"
                            size={actionButtonSize}
                            disabled={isPending}
                            onClick={() => handleAction(shift.id, onCancel)}
                          >
                            取り消す
                          </Button>
                        )}
                        {canApproveReject && (
                          <>
                            <Button
                              type="button"
                              size={actionButtonSize}
                              disabled={isPending}
                              onClick={() => handleAction(shift.id, onApprove)}
                            >
                              承認
                            </Button>
                            <Button
                              type="button"
                              variant="destructive"
                              size={actionButtonSize}
                              disabled={isPending}
                              onClick={() => handleAction(shift.id, onReject)}
                            >
                              却下
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              );
            })}

            {shifts.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={showStaffColumn ? (showActionsColumn ? 7 : 6) : showActionsColumn ? 6 : 5}
                  className="py-10 text-center text-muted-foreground"
                >
                  該当するシフトはありません。
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
