import { cn } from "@/lib/utils";
import { SHIFT_STATUS_LABEL } from "@/lib/constants";
import type { ShiftStatus } from "@/lib/types/database.types";

// approved(承認済み)= 完了系 → emerald / requested(申請中)= 処理中系 → blue
// / rejected(却下)= 要対応系 → rose という3系統の配色にマッピングしている。
export function ShiftStatusBadge({ status }: { status: ShiftStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold",
        status === "approved" && "bg-emerald-100 text-emerald-700",
        status === "requested" && "bg-blue-100 text-blue-700",
        status === "rejected" && "bg-rose-100 text-rose-700"
      )}
    >
      {SHIFT_STATUS_LABEL[status]}
    </span>
  );
}
