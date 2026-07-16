// これまでのDB設計(001_create_tables.sql)に対応する型定義。
// Supabase CLIの型自動生成(`supabase gen types typescript`)に
// 置き換えても良いが、フェーズ1では手動定義で進める。

export type UserRole = "super_admin" | "manager" | "checker" | "staff";
export type SalaryType = "monthly" | "hourly";

export interface Profile {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: UserRole;
  salary_type: SalaryType;
  salary_amount: number;
  primary_hotel_id: string | null;
  is_international_student: boolean;
  is_long_vacation_mode: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Hotel {
  id: string;
  name: string;
  parent_company_name: string | null;
  address: string | null;
  phone: string | null;
  client_contact_name: string | null;
  branch_name: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface RoomType {
  id: string;
  name: string;
  sort_order: number;
  created_at: string;
}

export interface HotelRoomPrice {
  id: string;
  hotel_id: string;
  room_type_id: string;
  unit_price: number;
  created_at: string;
  updated_at: string;
}

export type ShiftStatus = "requested" | "approved" | "rejected";

export interface Shift {
  id: string;
  staff_id: string;
  hotel_id: string;
  work_date: string;
  start_time: string;
  end_time: string;
  status: ShiftStatus;
  approved_by: string | null;
  note: string | null;
  other_company_hours: number;
  other_company_confirmed: boolean;
  actual_start_time: string | null;
  actual_end_time: string | null;
  break_minutes: number;
  created_at: string;
  updated_at: string;
}

export interface ShiftWithRelations extends Shift {
  hotel: { name: string } | null;
  staff: {
    name: string;
    is_international_student?: boolean;
    is_long_vacation_mode?: boolean;
  } | null;
}

export interface WeeklyHourAlert {
  staff_id: string;
  staff_name: string;
  window_end: string;
  total_hours: number;
  hour_limit: number;
}

export interface DailyReport {
  id: string;
  hotel_id: string;
  report_date: string;
  adjustment_amount: number;
  adjustment_note: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface DailyReportDetail {
  id: string;
  daily_report_id: string;
  room_type_id: string;
  completed_count: number;
}

export interface DailyReportWithRelations extends DailyReport {
  hotel: { name: string } | null;
  daily_report_details: (DailyReportDetail & { room_type: { name: string } | null })[];
}

export interface MonthlyTarget {
  id: string;
  hotel_id: string | null;
  year_month: string;
  target_rooms: number;
  target_sales: number;
  created_at: string;
  updated_at: string;
}

export interface HotelMonthlySummary {
  total_rooms: number;
  gross_sales: number;
  hourly_labor_cost: number;
  monthly_labor_cost: number;
  adjustment_total: number;
  net_sales: number;
  target_rooms: number;
  target_sales: number;
}

export interface HotelRankingRow extends HotelMonthlySummary {
  hotel_id: string;
  hotel_name: string;
}

export interface RoomTypeBreakdownRow {
  room_type_name: string;
  completed_count: number;
}

export interface SalesTrendRow {
  year_month: string;
  net_sales: number;
  total_rooms: number;
}

export type InvoiceStatus = "draft" | "confirmed" | "sent";

export interface Invoice {
  id: string;
  hotel_id: string;
  year_month: string;
  total_rooms: number;
  gross_sales: number;
  labor_cost: number;
  adjustment_total: number;
  net_sales: number;
  status: InvoiceStatus;
  pdf_url: string | null;
  generated_by: string | null;
  generated_at: string | null;
  created_at: string;
}

export interface InvoiceWithHotel extends Invoice {
  hotel: { name: string } | null;
}

export interface AttendanceRow {
  shift_id: string;
  staff_id: string;
  staff_name: string;
  is_international_student: boolean;
  work_date: string;
  planned_start: string;
  planned_end: string;
  planned_hours: number;
  actual_start: string | null;
  actual_end: string | null;
  break_minutes: number;
  actual_hours: number | null;
  variance_hours: number | null;
  other_company_hours: number;
  rolling_total_hours: number;
  hour_limit: number;
  remaining_hours: number;
}

export interface HotelWithPrices extends Hotel {
  hotel_room_prices: (HotelRoomPrice & { room_types: RoomType })[];
}
