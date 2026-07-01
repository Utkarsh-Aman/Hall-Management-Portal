/**
 * TypeScript interfaces matching the backend Pydantic schemas.
 */

// ─── Auth ──────────────────────────────────────────────
export interface UserBrief {
  id: number;
  identifier: string;
  name: string;
  role: "student" | "mess_staff" | "mess_worker" | "hall_office";
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
  user: UserBrief;
}

export interface MustChangePasswordResponse {
  must_change_password: true;
  change_token: string;
  message: string;
}

export type LoginResult = LoginResponse | MustChangePasswordResponse;

export function isMustChangePassword(
  data: LoginResult
): data is MustChangePasswordResponse {
  return "must_change_password" in data && data.must_change_password === true;
}

// ─── Extras Items ──────────────────────────────────────
export interface ExtrasItem {
  id: number;
  name: string;
  price: number;
  opens_at: string; // "HH:MM:SS"
  closes_at: string;
  prep_time_mins: number;
  is_recurring: boolean;
  recurring_weekday: number | null;
  is_active: boolean;
  created_at: string;
}

// ─── Bookings ──────────────────────────────────────────
export interface Booking {
  id: number;
  item_id: number;
  item_name: string;
  qty: number;
  total_price: number;
  status: "booked" | "served";
  qr_token: string;
  booked_at: string;
  qr_used_at: string | null;
}

export interface BookingListResponse {
  bookings: Booking[];
  running_total: number;
}

export interface StaffBooking {
  id: number;
  student_identifier: string;
  item_name: string;
  qty: number;
  total_price: number;
  status: "booked" | "served";
  booked_at: string;
  qr_used_at: string | null;
}

// ─── Menu ──────────────────────────────────────────────
export interface MenuSlot {
  id: number;
  day_of_week: number;
  meal_type: "breakfast" | "lunch" | "dinner";
  description: string;
  updated_by: number;
  updated_at: string;
}

export interface WeeklyMenuResponse {
  slots: MenuSlot[];
}

// ─── Wastage ───────────────────────────────────────────
export interface WastageLog {
  id: number;
  date: string;
  bdmr: number;
  plain_wastage: number;
  plate_wastage: number;
  entered_by: number;
  entered_at: string;
}

export interface DashboardSummary {
  avg_bdmr: number | null;
  plain_wastage: number | null;
  plate_wastage: number | null;
  last_updated: string | null;
}

// ─── Hall Office ───────────────────────────────────────
export interface StaffAccount {
  id: number;
  identifier: string;
  name: string;
  role: string;
  is_active: boolean;
  created_at: string;
}

export interface StaffCreateResponse {
  id: number;
  identifier: string;
  name: string;
  role: string;
  temp_password: string;
  message: string;
}

export interface RollNumberUploadResponse {
  count: number;
  message: string;
}

// ─── Worker ────────────────────────────────────────────
export interface ScanSuccess {
  message: string;
  booking_id: number;
  item_name: string;
  qty: number;
  student_identifier: string;
}

export interface ScanAlreadyUsed {
  already_served: true;
  served_at: string;
  message: string;
}

export type ScanResult = ScanSuccess | ScanAlreadyUsed;

export function isScanAlreadyUsed(
  data: ScanResult
): data is ScanAlreadyUsed {
  return "already_served" in data && data.already_served === true;
}

export interface TodayBooking {
  id: number;
  item_name: string;
  qty: number;
  student_identifier: string;
  qr_token: string;
  booked_at: string;
}
