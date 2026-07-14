import type { SalaryType, UserRole, ShiftStatus } from "@/lib/types/database.types";

export const ROLE_LABEL: Record<UserRole, string> = {
  super_admin: "全体管理者",
  manager: "ホテルマネージャー",
  checker: "チェッカー",
  staff: "スタッフ",
};

export const SALARY_TYPE_LABEL: Record<SalaryType, string> = {
  monthly: "月給",
  hourly: "時給",
};

export const SHIFT_STATUS_LABEL: Record<ShiftStatus, string> = {
  requested: "申請中",
  approved: "承認済み",
  rejected: "却下",
};

// マネージャーが新規作成できるroleは staff / checker のみ(RLSのprofiles_insert_managerと一致させる)
export const MANAGER_CREATABLE_ROLES: UserRole[] = ["staff", "checker"];
export const ALL_ROLES: UserRole[] = ["super_admin", "manager", "checker", "staff"];
