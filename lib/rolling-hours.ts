// 留学生の資格外活動許可(週28時間ルール)は「起算日を問わず、任意の連続7日間で
// 合計28時間以内」が正しい法解釈である(暦週=月曜〜日曜という区切りではない)。
//
// このモジュールは、ある1件のシフト(対象日)を含みうる7通りの
// 「7日間の窓」それぞれについて合計時間を計算し、最大値を返す。
// この最大値が対象日を含む全ての7日間窓のうち最も厳しい値になる。

export interface HourEntry {
  work_date: string; // 'YYYY-MM-DD'
  hours: number; // このシステム上の勤務時間
  other_company_hours: number; // 自己申告された他社勤務時間
}

function toDateNumber(dateStr: string): number {
  return new Date(`${dateStr}T00:00:00Z`).getTime();
}

function addDays(dateStr: string, diff: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().slice(0, 10);
}

/**
 * existingEntries(対象スタッフの既存シフト実績・申請)に newEntry を仮想的に加えた上で、
 * newEntry.work_date を含みうる7通りの7日間窓それぞれの合計時間を計算し、
 * その最大値を返す。
 */
export function computeMaxRollingWindowHours(
  existingEntries: HourEntry[],
  newEntry: HourEntry
): number {
  const allEntries = [...existingEntries, newEntry];
  const targetDate = toDateNumber(newEntry.work_date);

  let maxTotal = 0;

  // newEntry.work_date を含む7日間窓は、窓の終了日が
  // newEntry.work_date 〜 newEntry.work_date+6 の7通り存在する。
  for (let offset = 0; offset <= 6; offset++) {
    const windowEnd = addDays(newEntry.work_date, offset);
    const windowStart = addDays(windowEnd, -6);
    const startNum = toDateNumber(windowStart);
    const endNum = toDateNumber(windowEnd);

    const total = allEntries
      .filter((e) => {
        const d = toDateNumber(e.work_date);
        return d >= startNum && d <= endNum;
      })
      .reduce((sum, e) => sum + e.hours + e.other_company_hours, 0);

    if (total > maxTotal) {
      maxTotal = total;
    }
    void targetDate;
  }

  return maxTotal;
}

export function calcShiftHours(startTime: string, endTime: string): number {
  const [sh, sm] = startTime.split(":").map(Number);
  const [eh, em] = endTime.split(":").map(Number);
  return (eh * 60 + em - (sh * 60 + sm)) / 60;
}
