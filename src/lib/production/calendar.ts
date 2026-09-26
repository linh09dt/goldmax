/**
 * V136 — Lịch làm việc: bỏ Chủ nhật + ngày lễ (A2: "không tính chủ nhật và ngày lễ").
 *
 * Toàn bộ hàm là hàm THUẦN, chỉ dùng UTC (đúng quy ước của repo: cột DATE của Prisma
 * trả về mốc UTC nửa đêm, xem `src/lib/reporting.ts`).
 */

import type { ProductionConfig } from "@/lib/production/config";

export type WorkingCalendar = {
  /** Ngày làm việc trong tuần: 0 = Chủ nhật … 6 = Thứ 7. */
  workingDays: number[];
  /** Ngày nghỉ/lễ, khóa dạng "YYYY-MM-DD". */
  holidays: Set<string>;
};

export const MS_DAY = 86_400_000;

export function startOfDayUtc(value: Date): Date {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}

export function dateKeyUtc(value: Date): string {
  const day = startOfDayUtc(value);
  return `${day.getUTCFullYear()}-${String(day.getUTCMonth() + 1).padStart(2, "0")}-${String(day.getUTCDate()).padStart(2, "0")}`;
}

export function buildCalendar(
  config: Pick<ProductionConfig, "workingDays">,
  holidayDates: Date[] = [],
): WorkingCalendar {
  return {
    workingDays: [...config.workingDays].sort(),
    holidays: new Set(holidayDates.map(dateKeyUtc)),
  };
}

/**
 * Đọc ngày dạng `YYYY-MM-DD` CHO CHẶT: sai định dạng, ngày không tồn tại (31/02) hoặc tháng 13 → null.
 * (Regex một mình cho qua "2026-13-45" → `new Date` ra Invalid Date → sập trang lúc render.)
 */
export function parseIsoDateStrict(value: string | null | undefined): Date | null {
  const text = String(value ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return null;
  const date = new Date(`${text}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10) === text ? date : null;
}

export function isWorkingDay(value: Date, calendar: WorkingCalendar): boolean {
  const day = startOfDayUtc(value);
  if (!calendar.workingDays.includes(day.getUTCDay())) return false;
  return !calendar.holidays.has(dateKeyUtc(day));
}

/** Cộng `count` NGÀY LÀM VIỆC (count ≥ 0). Nếu ngày xuất phát là ngày nghỉ thì vẫn đếm từ mốc đó. */
export function addWorkingDays(value: Date, count: number, calendar: WorkingCalendar): Date {
  const step = Math.max(0, Math.trunc(count));
  const cursor = startOfDayUtc(value);
  let remaining = step;
  let guard = 0;
  while (remaining > 0 && guard < 4000) {
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    if (isWorkingDay(cursor, calendar)) remaining -= 1;
    guard += 1;
  }
  return cursor;
}

/** Lùi `count` NGÀY LÀM VIỆC (count ≥ 0). */
export function subtractWorkingDays(value: Date, count: number, calendar: WorkingCalendar): Date {
  const step = Math.max(0, Math.trunc(count));
  const cursor = startOfDayUtc(value);
  let remaining = step;
  let guard = 0;
  while (remaining > 0 && guard < 4000) {
    cursor.setUTCDate(cursor.getUTCDate() - 1);
    if (isWorkingDay(cursor, calendar)) remaining -= 1;
    guard += 1;
  }
  return cursor;
}

/** Số ngày làm việc trong khoảng [from, to] (tính cả 2 đầu). */
export function countWorkingDays(from: Date, to: Date, calendar: WorkingCalendar): number {
  const start = startOfDayUtc(from);
  const end = startOfDayUtc(to);
  if (end.getTime() < start.getTime()) return 0;
  let total = 0;
  const cursor = new Date(start);
  let guard = 0;
  while (cursor.getTime() <= end.getTime() && guard < 4000) {
    if (isWorkingDay(cursor, calendar)) total += 1;
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    guard += 1;
  }
  return total;
}

/** Số ngày làm việc giữa 2 mốc (to − from), không tính 2 đầu. */
export function workingDaysBetween(from: Date, to: Date, calendar: WorkingCalendar): number {
  const start = startOfDayUtc(from);
  const end = startOfDayUtc(to);
  if (end.getTime() <= start.getTime()) return 0;
  let total = 0;
  const cursor = new Date(start);
  let guard = 0;
  while (guard < 4000) {
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    if (cursor.getTime() > end.getTime()) break;
    if (isWorkingDay(cursor, calendar)) total += 1;
    guard += 1;
  }
  return total;
}

/**
 * Ngày cần bắt đầu MUỘN NHẤT để kịp hạn giao.
 * = hạn giao − đệm vận chuyển − tổng SỐ NGÀY của đường găng.
 * (V145: đường găng tính bằng NGÀY — danh mục công đoạn lưu `lead_time_days`, không quy đổi giờ.)
 */
export function latestStartDate(
  dueDate: Date,
  totalLeadDays: number,
  config: Pick<ProductionConfig, "deliveryBufferDays">,
  calendar: WorkingCalendar,
): Date {
  const workshopDue = subtractWorkingDays(dueDate, config.deliveryBufferDays, calendar);
  const leadDays = Math.max(0, Math.round(Number(totalLeadDays) || 0));
  return subtractWorkingDays(workshopDue, leadDays, calendar);
}

export function formatDateVn(value: Date | null | undefined): string {
  if (!value) return "—";
  const day = startOfDayUtc(value);
  const pad = (number: number) => String(number).padStart(2, "0");
  return `${pad(day.getUTCDate())}/${pad(day.getUTCMonth() + 1)}/${day.getUTCFullYear()}`;
}

/**
 * "Hôm nay" theo giờ Việt Nam (UTC+7), trả về mốc UTC nửa đêm để so với cột DATE.
 * Dùng cái này chứ không dùng `new Date()` trực tiếp: server Vercel chạy UTC, nên từ
 * 00:00–07:00 giờ VN mà lấy ngày server sẽ bị lùi 1 ngày (bài học V77 bên module đơn hàng).
 */
export function todayInVietnam(now: Date = new Date()): Date {
  const text = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  return new Date(`${text}T00:00:00.000Z`);
}

/** Nhãn thứ trong tuần + ngày, vd "T2 29/09". */
export function shortDayLabel(value: Date): string {
  const day = startOfDayUtc(value);
  const weekdays = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];
  const pad = (number: number) => String(number).padStart(2, "0");
  return `${weekdays[day.getUTCDay()]} ${pad(day.getUTCDate())}/${pad(day.getUTCMonth() + 1)}`;
}

/** Danh sách ngày trong khoảng [from, to]. */
export function eachDay(from: Date, to: Date): Date[] {
  const days: Date[] = [];
  const cursor = startOfDayUtc(from);
  const end = startOfDayUtc(to);
  let guard = 0;
  while (cursor.getTime() <= end.getTime() && guard < 400) {
    days.push(new Date(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    guard += 1;
  }
  return days;
}
