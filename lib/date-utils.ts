// 'YYYY-MM' 形式の年月を扱うためのユーティリティ。
// タイムゾーンのズレを避けるため、Date.UTC ベースで計算する。

export function getCurrentYearMonth(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

export function getMonthRange(yearMonth: string): { firstDay: string; lastDay: string } {
  const [year, month] = yearMonth.split("-").map(Number);
  const firstDay = `${yearMonth}-01`;
  const lastDayNum = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const lastDay = `${yearMonth}-${String(lastDayNum).padStart(2, "0")}`;
  return { firstDay, lastDay };
}

export function getMonthDays(yearMonth: string): { date: string; weekday: number }[] {
  const [year, month] = yearMonth.split("-").map(Number);
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();

  return Array.from({ length: daysInMonth }, (_, i) => {
    const day = i + 1;
    const date = `${yearMonth}-${String(day).padStart(2, "0")}`;
    const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
    return { date, weekday };
  });
}

export function shiftYearMonth(yearMonth: string, diff: number): string {
  const [year, month] = yearMonth.split("-").map(Number);
  const d = new Date(Date.UTC(year, month - 1 + diff, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

// 'YYYY-MM-DD' 形式の日付文字列に日数を加算する(負数も可)
export function addDaysStr(dateStr: string, diffDays: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + diffDays);
  return d.toISOString().slice(0, 10);
}
