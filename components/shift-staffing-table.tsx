import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { ShiftTemplateStaffingRow } from "@/lib/types/database.types";

export function ShiftStaffingTable({ rows }: { rows: ShiftTemplateStaffingRow[] }) {
  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        このホテルにはシフト時間帯が登録されていません。ホテル編集画面から登録してください。
      </p>
    );
  }

  return (
    <div className="rounded-xl border border-slate-100 bg-white shadow-sm">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>日付</TableHead>
            <TableHead>シフト時間帯</TableHead>
            <TableHead>目標人数</TableHead>
            <TableHead>承認済み人数</TableHead>
            <TableHead>差分</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow
              key={`${row.shift_template_id}-${row.work_date}`}
              className={cn(row.diff < 0 && "bg-rose-50/60")}
            >
              <TableCell>{row.work_date}</TableCell>
              <TableCell>
                {row.label}
                <span className="ml-1 text-xs text-slate-400">
                  ({row.start_time.slice(0, 5)}〜{row.end_time.slice(0, 5)})
                </span>
              </TableCell>
              <TableCell>{row.target_headcount}人</TableCell>
              <TableCell>{row.approved_count}人</TableCell>
              <TableCell>
                {row.diff < 0 ? (
                  <span className="font-semibold text-rose-700">不足 {Math.abs(row.diff)}人</span>
                ) : row.diff > 0 ? (
                  <span className="font-medium text-slate-500">余裕 +{row.diff}人</span>
                ) : (
                  <span className="text-slate-500">過不足なし</span>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
