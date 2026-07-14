"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert } from "@/components/ui/alert";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { ROLE_LABEL, SALARY_TYPE_LABEL } from "@/lib/constants";
import type { Hotel, Profile, SalaryType, UserRole } from "@/lib/types/database.types";

const selectClassName =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";

export function StaffForm({
  mode,
  hotels,
  allowedRoles,
  initialProfile,
  initialHotelIds,
  action,
}: {
  mode: "create" | "edit";
  hotels: Hotel[];
  allowedRoles: UserRole[];
  initialProfile?: Profile;
  initialHotelIds?: string[];
  action: (formData: FormData) => Promise<{ error: string | null }>;
}) {
  const router = useRouter();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [salaryType, setSalaryType] = useState<SalaryType>(
    initialProfile?.salary_type ?? "hourly"
  );

  async function handleSubmit(formData: FormData) {
    setErrorMessage(null);
    setIsSubmitting(true);

    const result = await action(formData);

    if (result.error) {
      setErrorMessage(result.error);
      setIsSubmitting(false);
      return;
    }

    router.push("/admin/staff");
    router.refresh();
  }

  return (
    <form action={handleSubmit} className="flex flex-col gap-6">
      {errorMessage && <Alert variant="destructive">{errorMessage}</Alert>}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="name">スタッフ名 *</Label>
          <Input id="name" name="name" required defaultValue={initialProfile?.name} />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="phone">電話番号</Label>
          <Input id="phone" name="phone" defaultValue={initialProfile?.phone ?? ""} />
        </div>

        {mode === "create" ? (
          <>
            <div className="flex flex-col gap-2">
              <Label htmlFor="email">メールアドレス *</Label>
              <Input id="email" name="email" type="email" required />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="initial_password">初期パスワード *</Label>
              <Input
                id="initial_password"
                name="initial_password"
                type="text"
                required
                minLength={8}
                placeholder="8文字以上"
              />
            </div>
          </>
        ) : (
          <div className="flex flex-col gap-2">
            <Label>メールアドレス</Label>
            <p className="flex h-10 items-center text-sm text-muted-foreground">
              {initialProfile?.email}(変更不可)
            </p>
          </div>
        )}

        <div className="flex flex-col gap-2">
          <Label htmlFor="role">役職 *</Label>
          <select
            id="role"
            name="role"
            required
            defaultValue={initialProfile?.role ?? allowedRoles[0]}
            className={selectClassName}
          >
            {allowedRoles.map((role) => (
              <option key={role} value={role}>
                {ROLE_LABEL[role]}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="salary_type">給与形態 *</Label>
          <select
            id="salary_type"
            name="salary_type"
            required
            value={salaryType}
            onChange={(e) => setSalaryType(e.target.value as SalaryType)}
            className={selectClassName}
          >
            <option value="hourly">{SALARY_TYPE_LABEL.hourly}</option>
            <option value="monthly">{SALARY_TYPE_LABEL.monthly}</option>
          </select>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="salary_amount">
            {salaryType === "monthly" ? "月給額(円)" : "時給額(円)"} *
          </Label>
          <Input
            id="salary_amount"
            name="salary_amount"
            type="number"
            min={0}
            step={1}
            required
            defaultValue={initialProfile?.salary_amount ?? 0}
          />
        </div>

        {mode === "edit" && (
          <div className="flex flex-col gap-2">
            <Label htmlFor="is_active">在籍状況</Label>
            <label className="flex h-10 items-center gap-2 text-sm">
              <input
                id="is_active"
                name="is_active"
                type="checkbox"
                defaultChecked={initialProfile?.is_active ?? true}
                className="h-4 w-4 rounded border-input"
              />
              在籍中(チェックを外すと退職扱いになります)
            </label>
          </div>
        )}

        <div className="flex flex-col gap-2">
          <Label htmlFor="is_international_student">留学生(週28時間ルール)</Label>
          <label className="flex h-10 items-center gap-2 text-sm">
            <input
              id="is_international_student"
              name="is_international_student"
              type="checkbox"
              defaultChecked={initialProfile?.is_international_student ?? false}
              className="h-4 w-4 rounded border-input"
            />
            資格外活動許可(週28時間まで)の対象者
          </label>
          <p className="text-xs text-muted-foreground">
            チェックすると、シフト確認画面で週28時間超過時にアラート表示されます(本システム上の勤務時間合計のみが対象です)。
          </p>
        </div>

        <div className="sm:col-span-2">
          <Switch
            id="is_long_vacation_mode"
            name="is_long_vacation_mode"
            defaultChecked={initialProfile?.is_long_vacation_mode ?? false}
            label="長期休業期間モード"
            description="学校の夏休み等の長期休業期間中はON推奨:上限が「1日8時間・週40時間」に緩和されます(留学生フラグがONの人のみ適用)。"
          />
        </div>
      </div>

      <div>
        <Label>所属ホテル(複数選択可) *</Label>
        <p className="mt-1 text-xs text-muted-foreground">
          月給スタッフは人件費按分のため、先頭に選択したホテルが主所属ホテルとして登録されます。
        </p>
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {hotels.map((hotel) => (
            <label
              key={hotel.id}
              className={cn(
                "flex items-center gap-2 rounded-md border border-input px-3 py-2 text-sm"
              )}
            >
              <input
                type="checkbox"
                name="hotel_ids"
                value={hotel.id}
                defaultChecked={initialHotelIds?.includes(hotel.id) ?? false}
                className="h-4 w-4 rounded border-input"
              />
              {hotel.name}
            </label>
          ))}

          {hotels.length === 0 && (
            <p className="text-sm text-muted-foreground">
              選択可能なホテルがありません。先にホテルを登録してください。
            </p>
          )}
        </div>
      </div>

      <div className="flex justify-end gap-3">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "保存中..." : "保存する"}
        </Button>
      </div>
    </form>
  );
}
