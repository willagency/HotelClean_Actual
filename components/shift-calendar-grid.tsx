import { cn } from "@/lib/utils";
import { getMonthDays } from "@/lib/date-utils";
import type { ShiftWithRelations } from "@/lib/types/database.types";

const WEEKDAY_LABELS = ["日", "月", "火", "水", "木", "金", "土"];

export function ShiftCalendarGrid({
  yearMonth,
  shifts,
  showStaffName,
}: {
  yearMonth: string;
  shifts: ShiftWithRelations[];
  showStaffName: boolean;
}) {
  const days = getMonthDays(yearMonth);
  const leadingBlankCount = days[0]?.weekday ?? 0;

  const shiftsByDate = new Map<string, ShiftWithRelations[]>();
  for (const shift of shifts) {
    const list = shiftsByDate.get(shift.work_date) ?? [];
    list.push(shift);
    shiftsByDate.set(shift.work_date, list);
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-100 bg-white shadow-sm">
      <div className="grid grid-cols-7 border-b border-border">
        {WEEKDAY_LABELS.map((label) => (
          <div
            key={label}
            className="border-r border-border px-2 py-2 text-center text-xs font-medium text-muted-foreground last:border-r-0"
          >
            {label}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {Array.from({ length: leadingBlankCount }).map((_, i) => (
          <div key={`blank-${i}`} className="min-h-[110px] border-b border-r border-border" />
        ))}

        {days.map(({ date, weekday }) => {
          const dayShifts = shiftsByDate.get(date) ?? [];
          const dayNumber = Number(date.slice(-2));

          return (
            <div
              key={date}
              className={cn(
                "min-h-[110px] border-b border-r border-border p-1.5 last:border-r-0",
                weekday === 0 && "bg-destructive/5",
                weekday === 6 && "bg-accent/5"
              )}
            >
              <p className="mb-1 text-xs font-medium text-muted-foreground">{dayNumber}</p>
              <div className="flex flex-col gap-1">
                {dayShifts.map((shift) => (
                  <div
                    key={shift.id}
                    className={cn(
                      "truncate rounded px-1.5 py-1 text-[11px] leading-tight font-semibold",
                      shift.status === "approved" && "bg-emerald-100 text-emerald-700",
                      shift.status === "requested" && "bg-blue-100 text-blue-700",
                      shift.status === "rejected" && "bg-rose-100 text-rose-700"
                    )}
                    title={`${shift.staff?.name ?? ""} ${shift.start_time.slice(0, 5)}-${shift.end_time.slice(0, 5)}`}
                  >
                    {showStaffName && <span className="font-medium">{shift.staff?.name} </span>}
                    {shift.start_time.slice(0, 5)}-{shift.end_time.slice(0, 5)}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
