/**
 * V153 — NGUYÊN HÀM "DANH SÁCH THỨ TỰ → NGÀY" (điều độ từ hàng đợi).
 *
 * Đúng luồng nhà máy chốt:
 *   1. **Tiêu chí ưu tiên** sắp **danh sách đợi từ trên xuống dưới** (hàng đợi có thứ tự).
 *   2. Từ hàng đợi đó, dùng **GOM NHÓM + NĂNG LỰC SẢN XUẤT** để **điều độ tự động** ra các ngày.
 *   3. Người dùng **xác nhận** → ghi vào điều độ.
 *   4. Sau đó mới **thêm/bớt thủ công** trên điều độ đã xác nhận.
 *
 * Hàm ở đây làm đúng bước 2 cho MỘT công đoạn: nhận hàng đợi (đã sắp theo ưu tiên, kèm ngày sẵn sàng
 * của từng bộ) và trả về ngày cho từng bộ. Module THUẦN — không truy vấn DB.
 */

import { addWorkingDays, dateKeyUtc, startOfDayUtc, type WorkingCalendar } from "@/lib/production/calendar";

export type DispatchItem = {
  taskId: number;
  setId: number;
  /** Điểm ưu tiên (càng cao càng làm trước). Hàng đợi đã theo thứ tự này. */
  score: number;
  /** Tải của bộ ở công đoạn này (cánh hoặc bộ — tuỳ công đoạn). */
  demand: number;
  /** Ngày sớm nhất được bắt đầu (công đoạn trước xong/lên kế hoạch). */
  ready: Date;
  /** Khoá nhóm khi GOM LÔ (nhóm màu / màu / model). `null` = không gom. */
  groupKey: string | null;
};

export type DispatchAssignment = {
  taskId: number;
  setId: number;
  day: Date;
  /** Thứ tự xếp trong lượt (1 = xếp trước). */
  rank: number;
  groupKey: string | null;
};

export type DispatchDay = {
  day: Date;
  worked: number;
  assignments: DispatchAssignment[];
};

export type DispatchResult = {
  assignments: DispatchAssignment[];
  days: DispatchDay[];
  /** Task không xếp được trong khoảng `to`. */
  overflow: number[];
  /** Chế độ đã dùng: xếp lần lượt theo hàng đợi, hay GOM LÔ theo nhóm. */
  mode: "HANG_DOI" | "GOM_LO";
  /** Số ngày làm việc phải dùng. */
  usedDays: number;
};

export type DispatchOptions = {
  items: DispatchItem[];
  /** Năng lực/ngày (cùng đơn vị với `demand`). `null` = chưa khai → không giới hạn. */
  capacity: number | null;
  from: Date;
  to: Date;
  calendar: WorkingCalendar;
  /**
   * GOM LÔ: tối đa bao nhiêu NHÓM mỗi ngày (`changeover_max_per_day`).
   * Bỏ trống / 0 = xếp lần lượt theo hàng đợi, không gom lô.
   */
  maxGroupsPerDay?: number | null;
  /** Lô tối thiểu để ưu tiên bắt đầu một nhóm (`batch_min_qty`). */
  minLot?: number | null;
};

const MAX_GUARD = 5000;

/**
 * Điều độ tự động cho MỘT công đoạn từ hàng đợi đã sắp thứ tự.
 *
 * `mode = HANG_DOI`: đi từ trên xuống, mỗi bộ vào ngày sớm nhất ≥ `ready` còn chỗ.
 * `mode = GOM_LO`:  mô phỏng theo từng ngày — mỗi ngày chỉ chạy tối đa `maxGroupsPerDay` nhóm
 *                  (ưu tiên nhóm đã đủ `minLot`, rồi tới nhóm có điểm cao nhất).
 */
export function scheduleQueue(options: DispatchOptions): DispatchResult {
  const items = [...options.items].sort((a, b) => b.score - a.score || a.setId - b.setId);
  if (!items.length) {
    return { assignments: [], days: [], overflow: [], mode: "HANG_DOI", usedDays: 0 };
  }

  const groupLimit = Math.max(0, Math.trunc(Number(options.maxGroupsPerDay) || 0));
  const useBatch = groupLimit >= 1 && items.some((item) => item.groupKey !== null);

  const assignments = useBatch ? scheduleBatch(items, { ...options, maxGroupsPerDay: groupLimit }) : scheduleQueueFifo(items, options);
  const placedIds = new Set(assignments.map((item) => item.taskId));
  const overflow = items.filter((item) => !placedIds.has(item.taskId)).map((item) => item.taskId);

  const byDay = new Map<string, DispatchDay>();
  for (const assignment of assignments) {
    const key = dateKeyUtc(assignment.day);
    const bucket = byDay.get(key) ?? { day: startOfDayUtc(assignment.day), worked: 0, assignments: [] };
    bucket.worked += items.find((item) => item.taskId === assignment.taskId)?.demand ?? 0;
    bucket.assignments.push(assignment);
    byDay.set(key, bucket);
  }
  const days = Array.from(byDay.values()).sort((a, b) => a.day.getTime() - b.day.getTime());

  return {
    assignments,
    days,
    overflow,
    mode: useBatch ? "GOM_LO" : "HANG_DOI",
    usedDays: days.length,
  };
}

/**
 * Xếp lần lượt theo HÀNG ĐỢI: bộ trên trước, vào **một ngày** sớm nhất còn đủ chỗ.
 *
 * Một bộ nằm GỌN trong MỘT ngày (không chia đôi qua 2 ngày) — để bảng điều độ nói đúng
 * "bộ nào làm ngày nào" và tải mỗi ngày đọc là biết ngay. Bộ lớn hơn năng lực 1 ngày
 * (hiếm) thì cho vào ngày sớm nhất một mình và đánh dấu tràn năng lực ở màn hình.
 */
function scheduleQueueFifo(items: DispatchItem[], options: DispatchOptions): DispatchAssignment[] {
  const used = new Map<string, number>();
  const out: DispatchAssignment[] = [];
  let rank = 0;

  for (const item of items) {
    if (item.demand <= 0) continue;
    const oversized = options.capacity !== null && item.demand > options.capacity;
    let cursor = snap(item.ready, options.calendar);
    let placed = false;
    let guard = 0;

    while (cursor.getTime() <= startOfDayUtc(options.to).getTime() && guard < MAX_GUARD) {
      const key = dateKeyUtc(cursor);
      const current = used.get(key) ?? 0;
      const enough = options.capacity === null || current === 0 || current + item.demand <= options.capacity;
      if (enough) {
        used.set(key, current + item.demand);
        rank += 1;
        out.push({ taskId: item.taskId, setId: item.setId, day: new Date(cursor), rank, groupKey: item.groupKey });
        placed = true;
        break;
      }
      cursor = addWorkingDays(cursor, 1, options.calendar);
      guard += 1;
    }

    if (!placed && oversized && options.capacity !== null) {
      // Bộ lớn hơn năng lực 1 ngày: vẫn xếp vào ngày sớm nhất (một mình) để không kẹt hàng đợi.
      const day = snap(item.ready, options.calendar);
      used.set(dateKeyUtc(day), (used.get(dateKeyUtc(day)) ?? 0) + item.demand);
      rank += 1;
      out.push({ taskId: item.taskId, setId: item.setId, day, rank, groupKey: item.groupKey });
    }
  }
  return out;
}

/** GOM LÔ: mỗi ngày tối đa `maxGroupsPerDay` nhóm; ưu tiên nhóm đủ lô rồi tới nhóm điểm cao. */
function scheduleBatch(items: DispatchItem[], options: DispatchOptions & { maxGroupsPerDay: number }): DispatchAssignment[] {
  const minLot = Math.max(0, Math.trunc(Number(options.minLot) || 0));
  const byId = new Map(items.map((item) => [item.taskId, item]));
  const remaining = new Set(items.map((item) => item.taskId));
  const firstReady = items.reduce((min, item) => (item.ready.getTime() < min.getTime() ? item.ready : min), items[0].ready);
  let day = snap(firstReady.getTime() < options.from.getTime() ? options.from : firstReady, options.calendar);
  const out: DispatchAssignment[] = [];
  let rank = 0;
  let guard = 0;

  while (remaining.size > 0 && day.getTime() <= startOfDayUtc(options.to).getTime() && guard < MAX_GUARD) {
    const available = Array.from(remaining)
      .map((id) => byId.get(id)!)
      .filter((item) => snap(item.ready, options.calendar).getTime() <= day.getTime());

    if (!available.length) {
      day = addWorkingDays(day, 1, options.calendar);
      guard += 1;
      continue;
    }

    const groups = new Map<string, DispatchItem[]>();
    for (const item of available) {
      const key = item.groupKey ?? `ZZZ-${item.taskId}`;
      const list = groups.get(key);
      if (list) list.push(item);
      else groups.set(key, [item]);
    }
    const ranked = Array.from(groups.entries()).map(([key, list]) => ({
      key,
      list: [...list].sort((a, b) => b.score - a.score || a.setId - b.setId),
      best: list.reduce((max, item) => Math.max(max, item.score), Number.NEGATIVE_INFINITY),
      qty: list.reduce((sum, item) => sum + item.demand, 0),
    }));
    ranked.sort(
      (a, b) => Number(b.qty >= minLot) - Number(a.qty >= minLot) || b.best - a.best || a.key.localeCompare(b.key, "vi"),
    );

    let capacityLeft = options.capacity === null ? Number.POSITIVE_INFINITY : options.capacity;
    let usedGroups = 0;
    for (const group of ranked) {
      if (usedGroups >= options.maxGroupsPerDay || capacityLeft <= 0) break;
      let took = 0;
      for (const item of group.list) {
        const oversized = options.capacity !== null && item.demand > options.capacity;
        if (item.demand > capacityLeft && !oversized) continue; // chờ ngày sau — vẫn CÙNG nhóm
        capacityLeft = oversized ? 0 : capacityLeft - item.demand;
        remaining.delete(item.taskId);
        rank += 1;
        out.push({ taskId: item.taskId, setId: item.setId, day: new Date(day), rank, groupKey: item.groupKey });
        took += 1;
      }
      if (took > 0) usedGroups += 1;
    }

    day = addWorkingDays(day, 1, options.calendar);
    guard += 1;
  }

  return out;
}

function snap(value: Date, calendar: WorkingCalendar): Date {
  let cursor = startOfDayUtc(value);
  let guard = 0;
  while (!isWorking(cursor, calendar) && guard < MAX_GUARD) {
    cursor = addWorkingDays(cursor, 1, calendar);
    guard += 1;
  }
  return cursor;
}

function isWorking(day: Date, calendar: WorkingCalendar): boolean {
  return calendar.workingDays.includes(day.getUTCDay()) && !calendar.holidays.has(dateKeyUtc(day));
}
