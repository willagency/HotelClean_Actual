import { AlertTriangle } from "lucide-react";
import type { WeeklyHourAlert } from "@/lib/types/database.types";

export function WeeklyHourAlertBanner({ alerts }: { alerts: WeeklyHourAlert[] }) {
  if (alerts.length === 0) return null;

  return (
    <div className="rounded-xl border border-rose-200 bg-rose-50 p-4">
      <div className="flex items-center gap-2 text-rose-800">
        <AlertTriangle className="h-4 w-4 shrink-0" />
        <p className="text-sm font-semibold">留学生の労働時間超過アラート(任意の連続7日間で判定)</p>
      </div>
      <ul className="mt-2 flex flex-col gap-1">
        {alerts.map((alert) => (
          <li key={`${alert.staff_id}-${alert.window_end}`} className="text-sm text-rose-700">
            <span className="font-medium">{alert.staff_name}</span> さん:{" "}
            {alert.window_end}までの直近7日間で
            <span className="font-semibold"> {alert.total_hours.toFixed(1)}時間</span>
            (上限{alert.hour_limit}時間を超過)
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-rose-600">
        ※本システムに登録された勤務先(ホテル)の時間+本人が自己申告した他社勤務時間の合計です。自己申告がない他社勤務は含まれないため、実際の合計時間は別途ご確認ください。
      </p>
    </div>
  );
}
