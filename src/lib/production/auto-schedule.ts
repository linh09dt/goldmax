/**
 * V136 — Xếp lịch tự động (bản đợt B gọn).
 *
 * Cách làm: xếp TIẾN (forward) từ một ngày bắt đầu, theo đúng thứ tự ưu tiên đã chốt:
 *   1. Đơn làm lại chen trước, 2. Hạn giao gần nhất trước (EDD)  — A7/KH17.
 *
 * Ràng buộc có mô hình hoá:
 *   - Năng lực TỪNG TỔ theo ngày (giới hạn số cánh) — KH6/KH7.
 *   - Ngày làm việc: bỏ Chủ nhật + ngày lễ — A2.
 *   - Một bộ đi tuần tự qua các công đoạn, mỗi công đoạn 1 ngày làm việc (bảo thủ, đúng
 *     cách xưởng đang gối 1 ngày/bước — C6: đặt `overlapHoursPerStep` > 0 để cho phép
 *     gối nhiều hơn ở tầng tính đường găng).
 *   - Công đoạn tách khung/cánh/phào chạy SONG SONG trong cùng ngày.
 *   - Công đoạn CHỜ chiếm 1 ngày nhưng không tiêu năng lực tổ.
 *
 * CHƯA mô hình hoá (ghi rõ để đợt sau): gom lô màu sơn (SON7), giới hạn 2 lượt đổi khuôn/ngày
 * (CH4), giới hạn chỗ để hàng chờ. Đây là các ràng buộc gợi ý — app CẢNH BÁO, người dùng tự
 * điều chỉnh; J8: không tự ý đổi lịch đã chốt.
 *
 * Hàm THUẦN — không truy vấn DB.
 */

import { addWorkingDays, isWorkingDay, startOfDayUtc, type WorkingCalendar } from "@/lib/production/calendar";
import { canhEquivalentOf, type ProductionSetRow, type ProductionTaskRow, type ProductionWorkCenterRow } from "@/lib/production/catalog";
import type { ProductionConfig } from "@/lib/production/config";
import { sortSetsForPlanning } from "@/lib/production/scheduling";

export type ScheduleTaskInput = Pick<ProductionTaskRow, "id" | "stageCode" | "stageKind" | "scope" | "seq" | "workCenterCode" | "status">;
export type ScheduleSetInput = ProductionSetRow & { tasks: ScheduleTaskInput[] };

export type ScheduledTask = { id: number; plannedStart: Date };
export type ScheduledSet = { id: number; plannedStart: Date; plannedEnd: Date };

export type ScheduleResult = {
  tasks: ScheduledTask[];
  sets: ScheduledSet[];
  skippedSets: number;
  /** Số ngày (tổ + ngày) vượt năng lực trong lịch vừa xếp → để hiện cảnh báo. */
  overloadCells: number;
  lastDay: Date | null;
};

function dayKey(value: Date): string {
  return value.toISOString().slice(0, 10);
}

/** Ngày làm việc kế tiếp (không tính ngày hiện tại). */
function nextWorking(value: Date, calendar: WorkingCalendar): Date {
  return addWorkingDays(value, 1, calendar);
}

/** Ngày làm việc không sớm hơn `value` (nếu `value` là ngày nghỉ thì nhảy tới ngày làm việc gần nhất). */
function atOrAfterWorking(value: Date, calendar: WorkingCalendar): Date {
  let cursor = startOfDayUtc(value);
  let guard = 0;
  while (!isWorkingDay(cursor, calendar) && guard < 400) {
    cursor = addWorkingDays(cursor, 1, calendar);
    guard += 1;
  }
  return cursor;
}

export function autoSchedule(options: {
  sets: ScheduleSetInput[];
  workCenters: ProductionWorkCenterRow[];
  /** Giữ trong chữ ký để đợt sau dùng cho ràng buộc gom lô màu sơn / đổi khuôn (chưa ép ở đây). */
  config: ProductionConfig;
  calendar: WorkingCalendar;
  startDate: Date;
}): ScheduleResult {
  const { sets, workCenters, calendar, startDate } = options;
  const capacityByCenter = new Map(workCenters.map((center) => [center.code, center.capacityPerDay ?? null]));
  // Tải đã dùng theo (tổ | ngày) — đơn vị CÁNH.
  const used = new Map<string, number>();

  const ordered = sortSetsForPlanning(sets);
  const scheduledTasks: ScheduledTask[] = [];
  const scheduledSets: ScheduledSet[] = [];
  let overloadCells = 0;
  let lastDay: Date | null = null;
  let skippedSets = 0;

  for (const set of ordered) {
    const tasks = [...set.tasks]
      .filter((task) => task.status !== "BO_QUA" && task.status !== "XONG")
      .sort((a, b) => a.seq - b.seq || a.stageCode.localeCompare(b.stageCode));
    if (!tasks.length) {
      skippedSets += 1;
      continue;
    }

    // Gom theo CÔNG ĐOẠN: khung / cánh / phào của cùng một công đoạn chạy SONG SONG trong
    // cùng một ngày (HAN5: "làm độc lập") → tiến con trỏ 1 lần cho cả công đoạn.
    const byStage = new Map<string, ScheduleTaskInput[]>();
    for (const task of tasks) {
      const group = byStage.get(task.stageCode);
      if (group) group.push(task);
      else byStage.set(task.stageCode, [task]);
    }
    const stageOrder = [...byStage.keys()].sort((a, b) => {
      const firstA = byStage.get(a)![0];
      const firstB = byStage.get(b)![0];
      return firstA.seq - firstB.seq || a.localeCompare(b);
    });

    const canh = canhEquivalentOf(set);
    let cursor = atOrAfterWorking(startDate, calendar);
    const firstDay = cursor;
    let lastAssigned = cursor;
    const countedCenters = new Set<string>();

    for (const stageCode of stageOrder) {
      const group = byStage.get(stageCode)!;
      const stageKind = group[0].stageKind;
      const centerCode = group[0].workCenterCode;

      if (stageKind === "CHO") {
        for (const task of group) scheduledTasks.push({ id: task.id, plannedStart: cursor });
        lastAssigned = cursor;
        cursor = nextWorking(cursor, calendar);
        continue;
      }

      const capacity = centerCode ? capacityByCenter.get(centerCode) ?? null : null;

      // Tìm ngày sớm nhất mà tổ còn đủ năng lực cho bộ này.
      let placed = cursor;
      let guard = 0;
      while (centerCode && capacity !== null && capacity > 0 && guard < 400) {
        const key = `${centerCode}|${dayKey(placed)}`;
        const already = used.get(key) ?? 0;
        // Bộ solo lớn hơn năng lực 1 ngày thì vẫn phải nhận (không thể chờ vô hạn) — sẽ thành cảnh báo quá tải.
        if (already === 0 || already + canh <= capacity) break;
        placed = nextWorking(placed, calendar);
        guard += 1;
      }

      for (const task of group) scheduledTasks.push({ id: task.id, plannedStart: placed });

      if (centerCode && capacity !== null && capacity > 0) {
        const key = `${centerCode}|${dayKey(placed)}`;
        if (!countedCenters.has(key)) {
          countedCenters.add(key);
          const nextUsed = (used.get(key) ?? 0) + canh;
          used.set(key, nextUsed);
          if (nextUsed > capacity) overloadCells += 1;
        }
      }

      lastAssigned = placed;
      cursor = nextWorking(placed, calendar);
    }

    scheduledSets.push({ id: set.id, plannedStart: firstDay, plannedEnd: lastAssigned });
    if (!lastDay || lastAssigned.getTime() > lastDay.getTime()) lastDay = lastAssigned;
  }

  return { tasks: scheduledTasks, sets: scheduledSets, skippedSets, overloadCells, lastDay };
}
