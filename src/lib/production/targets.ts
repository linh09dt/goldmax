/**
 * V144 — MỐC SẢN XUẤT (target) TỪNG CÔNG ĐOẠN, tự suy từ MỘT mốc "ngày bắt đầu sản xuất".
 *
 * Nhà máy chốt 26/09/2026: **không nhập ngày cho từng công đoạn**. Chỉ nhập ngày bắt đầu →
 * hệ thống đi theo THỨ TỰ BƯỚC (`seq`) và SỐ GIỜ của bước:
 *   - số ngày của bước = làm tròn lên(số giờ ÷ giờ-ngày), giờ-ngày = số ca × giờ/ca (2 × 8 = 16);
 *   - bước sau bắt đầu NGÀY LÀM VIỆC kế tiếp sau khi bước trước xong (bỏ Chủ nhật + ngày lễ);
 *     nếu Cấu hình có "gối công đoạn" (giờ) thì lùi lại đúng số ngày gối;
 *   - các công đoạn CÙNG BƯỚC (Cắt khung/cánh/phào, Vân khung/cánh/phào…) → **cùng ngày**;
 *   - bước 0 giờ (bước xưởng để 0) **không chiếm ngày** — dùng chung ngày với bước liền kề;
 *   - công đoạn `BO_QUA` (vd Vân với màu sơn 11/14) **không tính ngày**.
 *
 * Module THUẦN (không truy vấn DB) để test được và dùng lại ở cả server lẫn UI.
 */

import {
  addWorkingDays,
  countWorkingDays,
  hoursPerWorkingDay,
  hoursToWorkingDays,
  isWorkingDay,
  startOfDayUtc,
  subtractWorkingDays,
  type WorkingCalendar,
} from "./calendar";
import type { ProductionConfig } from "./config";

export type TargetStep = {
  /** bước trong danh mục công đoạn */
  seq: number;
  /** giờ của bước (lấy theo công đoạn dài nhất trong bước) */
  hours: number;
  /** các mã công đoạn của bước — cùng bước thì cùng ngày */
  codes: string[];
};

export type StepTarget = TargetStep & {
  /** số ngày làm việc mà bước chiếm (0 = không chiếm ngày) */
  days: number;
  start: Date;
  end: Date;
};

export type TargetConfig = Pick<ProductionConfig, "shiftsPerDay" | "hoursPerShift" | "overlapHoursPerStep">;

/** Các bước cần tính của một bộ, suy từ chính công đoạn của bộ (bỏ công đoạn BỎ QUA). */
export function targetStepsFromTasks(
  tasks: Array<{ stageCode: string; seq: number; status: string }>,
  stageByCode: Map<string, { code: string; leadTimeHours: number | null }>,
): TargetStep[] {
  const bySeq = new Map<number, TargetStep>();
  for (const task of tasks) {
    if (task.status === "BO_QUA") continue;
    const stage = stageByCode.get(task.stageCode);
    if (!stage) continue;
    const hours = Math.max(0, Number(stage.leadTimeHours) || 0);
    const current = bySeq.get(task.seq);
    if (current) {
      current.hours = Math.max(current.hours, hours);
      if (!current.codes.includes(stage.code)) current.codes.push(stage.code);
    } else {
      bySeq.set(task.seq, { seq: task.seq, hours, codes: [stage.code] });
    }
  }
  return Array.from(bySeq.values()).sort((a, b) => a.seq - b.seq);
}

/** Dời một mốc về NGÀY LÀM VIỆC kế tiếp (nếu rơi vào Chủ nhật / ngày lễ). */
export function snapToWorkingDay(value: Date, calendar: WorkingCalendar): Date {
  let cursor = startOfDayUtc(value);
  let guard = 0;
  while (!isWorkingDay(cursor, calendar) && guard < 400) {
    cursor = addWorkingDays(cursor, 1, calendar);
    guard += 1;
  }
  return cursor;
}

/**
 * Suy mốc bắt đầu / kết thúc của TỪNG BƯỚC từ ngày bắt đầu sản xuất.
 * Trả về theo đúng thứ tự bước. Mốc là NGÀY (UTC, `Date`).
 */
export function computeStepTargets(args: {
  start: Date;
  steps: TargetStep[];
  config: TargetConfig;
  calendar: WorkingCalendar;
}): StepTarget[] {
  const perDay = hoursPerWorkingDay(args.config);
  const overlapDays = Math.max(0, Math.floor((Number(args.config.overlapHoursPerStep) || 0) / perDay));
  const planStart = snapToWorkingDay(args.start, args.calendar);
  let cursor = planStart;
  /** Ngày kết thúc của bước CÓ ngày gần nhất — bước 0 giờ dùng chung ngày này. */
  let lastEnd: Date | null = null;

  const out: StepTarget[] = [];
  for (const step of args.steps.slice().sort((a, b) => a.seq - b.seq)) {
    const days = hoursToWorkingDays(step.hours, args.config);
    if (days <= 0) {
      // Bước 0 giờ KHÔNG chiếm ngày — nằm cùng ngày với bước liền trước (không đẩy ngày xong ra sau).
      const day = lastEnd ?? cursor;
      out.push({ ...step, days: 0, start: day, end: day });
      continue;
    }
    const end = addWorkingDays(cursor, days - 1, args.calendar);
    out.push({ ...step, days, start: cursor, end });
    lastEnd = end;
    const next = addWorkingDays(end, 1, args.calendar);
    // Gối công đoạn: lùi lại — nhưng KHÔNG lùi quá số ngày của chính bước này
    // và KHÔNG lùi trước ngày bắt đầu kế hoạch (tránh mốc trước cả ngày vào sản xuất).
    const cappedOverlap = Math.min(overlapDays, days - 1);
    const candidate = cappedOverlap > 0 ? subtractWorkingDays(next, cappedOverlap, args.calendar) : next;
    cursor = candidate.getTime() < planStart.getTime() ? planStart : candidate;
  }
  return out;
}

/**
 * Số NGÀY LÀM VIỆC thực tế từ mốc bắt đầu tới mốc xong của cả bộ (đã tính gối công đoạn).
 * KHÔNG phải tổng công lao động — dùng `countWorkingDays` giữa 2 mốc.
 */
export function targetTotalDays(targets: StepTarget[], calendar: WorkingCalendar): number {
  if (!targets.length) return 0;
  const start = targets[0].start;
  const end = targets[targets.length - 1].end;
  return Math.max(0, countWorkingDays(start, end, calendar));
}
