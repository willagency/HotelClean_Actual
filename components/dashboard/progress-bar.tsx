import { cn } from "@/lib/utils";

export function ProgressBar({
  label,
  current,
  target,
  formatValue,
}: {
  label: string;
  current: number;
  target: number;
  formatValue: (value: number) => string;
}) {
  const rate = target > 0 ? Math.min((current / target) * 100, 999) : null;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between text-sm">
        <span className="font-medium">{label}</span>
        <span className="text-muted-foreground">
          {formatValue(current)} / 目標 {target > 0 ? formatValue(target) : "未設定"}
        </span>
      </div>
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-secondary">
        <div
          className={cn(
            "h-full rounded-full transition-all",
            rate === null ? "bg-muted-foreground/30" : rate >= 100 ? "bg-emerald-600" : "bg-primary"
          )}
          style={{ width: `${rate === null ? 0 : Math.min(rate, 100)}%` }}
        />
      </div>
      {rate !== null && (
        <span className="text-xs text-muted-foreground">達成率 {rate.toFixed(1)}%</span>
      )}
    </div>
  );
}
