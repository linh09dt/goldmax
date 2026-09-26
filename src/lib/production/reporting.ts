/**
 * V137 — Số liệu BÁO CÁO SẢN XUẤT: giao đúng hạn (OTD) · năng suất tổ · thời gian thực tế ·
 * lỗi & làm lại · lý do trễ · tồn thành phẩm.
 *
 * Toàn bộ hàm là hàm THUẦN (không truy vấn DB) — trang chỉ lấy dữ liệu thô rồi gọi `buildProductionReport`,
 * cùng cách `src/lib/reporting.ts` và `src/lib/dashboard.ts` đang làm.
 *
 * ⚠️ Các chỉ số về thời gian chỉ có nghĩa khi xưởng ĐÃ ghi mốc thực tế (Bắt đầu / Xong) từng công đoạn.
 * Bộ chưa ghi mốc sẽ bị loại khỏi phần thời gian (không tính là 0).
 */

import { dateKeyUtc, MS_DAY, startOfDayUtc } from "@/lib/production/calendar";
import {
  canhEquivalentOf,
  COMPONENT_KINDS,
  COMPONENT_LABELS,
  componentProgress,
  STAGE,
  type ProductionSetRow,
  type ProductionStageRow,
  type ProductionTaskRow,
} from "@/lib/production/catalog";

export type ReportReason = { code: string; name: string; group: string };

export type OtdRow = {
  key: string;
  label: string;
  orders: number;
  delivered: number;
  onTime: number;
  late: number;
  onTimeRate: number;
  avgLateDays: number;
};

export type WorkCenterStat = {
  code: string;
  name: string;
  completedTasks: number;
  sets: number;
  reworkTasks: number;
  avgHours: number | null;
  canh: number;
  percentOfLoad: number;
};

export type StageStat = {
  code: string;
  name: string;
  completedTasks: number;
  quotedHours: number | null;
  avgActualHours: number | null;
  reworkTasks: number;
  waitHours: number | null;
};

export type ReasonStat = { code: string; name: string; group: string; count: number; scope: "CÔNG ĐOẠN" | "BỘ" };

export type LateSet = {
  id: number;
  setNo: string | null;
  orderCode: string | null;
  customerName: string | null;
  dueDate: Date | null;
  finishedAt: Date | null;
  deliveredAt: Date | null;
  daysLate: number;
  status: string;
  percentDone: number;
};

export type ProductionReport = {
  totals: {
    sets: number;
    setsInPlan: number;
    canh: number;
    delivered: number;
    onTime: number;
    late: number;
    onTimeRate: number;
    inProgress: number;
    waiting: number;
    paused: number;
    cancelled: number;
    overdueOpen: number;
    reworkTasks: number;
    totalTasks: number;
    reworkRate: number;
    avgProductionDays: number | null;
    avgTaskHours: number | null;
  };
  weeklyOtd: OtdRow[];
  byWorkCenter: WorkCenterStat[];
  byStage: StageStat[];
  reasons: ReasonStat[];
  lateSets: LateSet[];
  staleStock: Array<{ id: number; setNo: string | null; customerName: string | null; finishedAt: Date | null; daysInStock: number }>;
  byComponent: Array<{ kind: string; label: string; percent: number; done: number; total: number }>;
};

function dayOf(value: Date | null | undefined): Date | null {
  return value ? startOfDayUtc(value) : null;
}

function daysBetween(from: Date, to: Date): number {
  return Math.round((startOfDayUtc(to).getTime() - startOfDayUtc(from).getTime()) / MS_DAY);
}

function hoursBetween(from: Date | null, to: Date | null): number | null {
  if (!from || !to) return null;
  const diff = (to.getTime() - from.getTime()) / 3_600_000;
  return Number.isFinite(diff) && diff >= 0 ? diff : null;
}

function weekKeyOf(date: Date): string {
  const base = startOfDayUtc(date);
  const weekday = (base.getUTCDay() + 6) % 7; // Thứ 2 = 0
  const monday = new Date(base.getTime() - weekday * MS_DAY);
  return dateKeyUtc(monday);
}

function weekLabelOf(key: string): string {
  const monday = new Date(`${key}T00:00:00.000Z`);
  const sunday = new Date(monday.getTime() + 6 * MS_DAY);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${pad(monday.getUTCDate())}/${pad(monday.getUTCMonth() + 1)} – ${pad(sunday.getUTCDate())}/${pad(sunday.getUTCMonth() + 1)}`;
}

export function buildProductionReport(input: {
  sets: ProductionSetRow[];
  tasks: ProductionTaskRow[];
  stages: ProductionStageRow[];
  workCenters: Array<{ code: string; name: string }>;
  reasons: ReportReason[];
  today: Date;
  staleStockDays?: number;
}): ProductionReport {
  const { sets, tasks, stages, workCenters, reasons, today } = input;
  const staleDays = input.staleStockDays ?? 60;
  const todayDay = startOfDayUtc(today);
  const reasonByCode = new Map(reasons.map((reason) => [reason.code, reason]));
  const centerName = new Map(workCenters.map((center) => [center.code, center.name]));

  const tasksBySet = new Map<number, ProductionTaskRow[]>();
  for (const task of tasks) {
    const list = tasksBySet.get(task.setId);
    if (list) list.push(task);
    else tasksBySet.set(task.setId, [task]);
  }

  // ---- Tổng quan ----
  const canh = sets.reduce((sum, set) => sum + canhEquivalentOf(set), 0);
  const delivered = sets.filter((set) => set.status === "DA_GIAO" && set.actualDeliveredAt);
  const late: LateSet[] = [];
  let onTime = 0;

  for (const set of delivered) {
    const due = dayOf(set.dueDate);
    const deliveredDay = dayOf(set.actualDeliveredAt);
    if (!due || !deliveredDay) continue;
    const daysLate = daysBetween(due, deliveredDay);
    if (daysLate > 0) {
      late.push({
        id: set.id,
        setNo: set.setNo,
        orderCode: set.orderCode,
        customerName: set.customerName,
        dueDate: set.dueDate,
        finishedAt: set.actualCompletedAt,
        deliveredAt: set.actualDeliveredAt,
        daysLate,
        status: set.status,
        percentDone: set.percentDone,
      });
    } else {
      onTime += 1;
    }
  }

  // Bộ CHƯA giao mà đã quá hạn
  const overdueOpen = sets.filter(
    (set) =>
      set.status !== "DA_GIAO" &&
      set.status !== "HUY" &&
      set.dueDate &&
      startOfDayUtc(set.dueDate).getTime() < todayDay.getTime(),
  );

  const reworkTasks = tasks.filter((task) => task.isRework);
  const finishedTasks = tasks.filter((task) => task.status === "XONG" && task.actualStart && task.actualEnd);
  const taskHours = finishedTasks
    .map((task) => hoursBetween(task.actualStart, task.actualEnd))
    .filter((value): value is number => value !== null);

  // Thời gian sản xuất thực tế: từ công đoạn đầu tiên bắt đầu đến khi đóng gói xong.
  const productionDurations: number[] = [];
  for (const set of sets) {
    const setTasks = tasksBySet.get(set.id) ?? [];
    const starts = setTasks.map((task) => task.actualStart).filter((value): value is Date => Boolean(value));
    const endTask = setTasks.find((task) => task.stageCode === STAGE.DONG_GOI);
    const finished = endTask?.actualEnd ?? set.actualCompletedAt;
    if (!starts.length || !finished) continue;
    const first = new Date(Math.min(...starts.map((value) => value.getTime())));
    productionDurations.push(Math.max(0, (startOfDayUtc(finished).getTime() - startOfDayUtc(first).getTime()) / MS_DAY));
  }

  // ---- OTD theo tuần (theo tuần hạn giao của các bộ ĐÃ GIAO) ----
  const weekMap = new Map<string, OtdRow>();
  for (const set of delivered) {
    if (!set.dueDate || !set.actualDeliveredAt) continue;
    const key = weekKeyOf(set.dueDate);
    const row = weekMap.get(key) ?? { key, label: weekLabelOf(key), orders: 0, delivered: 0, onTime: 0, late: 0, onTimeRate: 0, avgLateDays: 0 };
    row.delivered += 1;
    const daysLate = daysBetween(set.dueDate, set.actualDeliveredAt);
    if (daysLate > 0) {
      row.late += 1;
      row.avgLateDays += daysLate;
    } else {
      row.onTime += 1;
    }
    weekMap.set(key, row);
  }
  const weeklyOtd = [...weekMap.values()]
    .map((row) => ({
      ...row,
      onTimeRate: row.delivered ? (row.onTime / row.delivered) * 100 : 0,
      avgLateDays: row.late ? row.avgLateDays / row.late : 0,
    }))
    .sort((a, b) => b.key.localeCompare(a.key))
    .slice(0, 10);

  // ---- Năng suất theo tổ ----
  const centerMap = new Map<string, WorkCenterStat>();
  const setIdsByCenter = new Map<string, Set<number>>();
  const canhByCenter = new Map<string, number>();
  const reworkByCenter = new Map<string, number>();
  for (const set of sets) {
    const seen = new Set<string>();
    for (const task of tasksBySet.get(set.id) ?? []) {
      if (!task.workCenterCode || task.status === "BO_QUA" || task.stageKind === "CHO") continue;
      const ids = setIdsByCenter.get(task.workCenterCode) ?? new Set<number>();
      if (!ids.has(set.id)) {
        ids.add(set.id);
        canhByCenter.set(task.workCenterCode, (canhByCenter.get(task.workCenterCode) ?? 0) + canhEquivalentOf(set));
      }
      setIdsByCenter.set(task.workCenterCode, ids);
      if (task.isRework) reworkByCenter.set(task.workCenterCode, (reworkByCenter.get(task.workCenterCode) ?? 0) + 1);
      seen.add(task.workCenterCode);
    }
  }
  const totalLoadCanh = Array.from(canhByCenter.values()).reduce((sum, value) => sum + value, 0);
  for (const [code, ids] of setIdsByCenter.entries()) {
    const centerTasks = tasks.filter((task) => task.workCenterCode === code);
    const done = centerTasks.filter((task) => task.status === "XONG");
    const hours = done
      .map((task) => hoursBetween(task.actualStart, task.actualEnd))
      .filter((value): value is number => value !== null);
    centerMap.set(code, {
      code,
      name: centerName.get(code) ?? code,
      completedTasks: done.length,
      sets: ids.size,
      reworkTasks: reworkByCenter.get(code) ?? 0,
      avgHours: hours.length ? hours.reduce((sum, value) => sum + value, 0) / hours.length : null,
      canh: canhByCenter.get(code) ?? 0,
      percentOfLoad: totalLoadCanh ? ((canhByCenter.get(code) ?? 0) / totalLoadCanh) * 100 : 0,
    });
  }
  const byWorkCenter = [...centerMap.values()].sort((a, b) => b.canh - a.canh);

  // ---- Theo công đoạn: thực tế vs định mức ----
  const stageStats: StageStat[] = stages
    .filter((stage) => stage.kind !== "CHO")
    .map((stage) => {
      const stageTasks = tasks.filter((task) => task.stageCode === stage.code && task.status !== "BO_QUA");
      const done = stageTasks.filter((task) => task.status === "XONG");
      const hours = done
        .map((task) => hoursBetween(task.actualStart, task.actualEnd))
        .filter((value): value is number => value !== null);
      return {
        code: stage.code,
        name: stage.name,
        completedTasks: done.length,
        quotedHours: stage.leadTimeHours,
        avgActualHours: hours.length ? hours.reduce((sum, value) => sum + value, 0) / hours.length : null,
        reworkTasks: stageTasks.filter((task) => task.isRework).length,
        waitHours: null,
      };
    })
    .sort((a, b) => stages.findIndex((stage) => stage.code === a.code) - stages.findIndex((stage) => stage.code === b.code));

  // ---- Lý do (trễ / tạm dừng / lỗi) ----
  const reasonCount = new Map<string, number>();
  for (const task of tasks) {
    if (!task.reasonCode) continue;
    reasonCount.set(task.reasonCode, (reasonCount.get(task.reasonCode) ?? 0) + 1);
  }
  const setReasonCount = new Map<string, number>();
  for (const set of sets) {
    const note = String(set.note ?? "");
    for (const reason of reasons) {
      if (note.includes(reason.code)) setReasonCount.set(reason.code, (setReasonCount.get(reason.code) ?? 0) + 1);
    }
  }
  const reasonStats: ReasonStat[] = [
    ...[...reasonCount.entries()].map(([code, count]) => ({
      code,
      name: reasonByCode.get(code)?.name ?? code,
      group: reasonByCode.get(code)?.group ?? "KHAC",
      count,
      scope: "CÔNG ĐOẠN" as const,
    })),
    ...[...setReasonCount.entries()].map(([code, count]) => ({
      code,
      name: reasonByCode.get(code)?.name ?? code,
      group: reasonByCode.get(code)?.group ?? "KHAC",
      count,
      scope: "BỘ" as const,
    })),
  ].sort((a, b) => b.count - a.count);

  // ---- Tồn thành phẩm lâu chưa giao (GH9: quá 2 tháng coi là tồn) ----
  const staleStock = sets
    .filter((set) => set.status === "HOAN_THANH" && set.actualCompletedAt)
    .map((set) => ({
      id: set.id,
      setNo: set.setNo,
      customerName: set.customerName,
      finishedAt: set.actualCompletedAt,
      daysInStock: daysBetween(set.actualCompletedAt as Date, todayDay),
    }))
    .filter((row) => row.daysInStock >= staleDays)
    .sort((a, b) => b.daysInStock - a.daysInStock);

  // ---- Theo lệnh con: tỷ lệ hoàn thành từng phần ----
  const byComponent = COMPONENT_KINDS.map((kind) => {
    let done = 0;
    let total = 0;
    for (const set of sets) {
      if (set.status === "HUY") continue;
      const progress = componentProgress(tasksBySet.get(set.id) ?? [], kind);
      done += progress.done;
      total += progress.total;
    }
    return { kind, label: COMPONENT_LABELS[kind], percent: total ? Math.round((done / total) * 100) : 0, done, total };
  });

  const deliveredCount = delivered.length;
  const setsInPlan = sets.filter((set) => set.status !== "HUY").length;

  return {
    totals: {
      sets: sets.length,
      setsInPlan,
      canh,
      delivered: deliveredCount,
      onTime,
      late: late.length,
      onTimeRate: deliveredCount ? (onTime / deliveredCount) * 100 : 0,
      inProgress: sets.filter((set) => set.status === "DANG_SX" || set.status === "DA_XEP_LICH").length,
      waiting: sets.filter((set) => set.status === "CHO_XEP_LICH").length,
      paused: sets.filter((set) => set.status === "TAM_DUNG").length,
      cancelled: sets.filter((set) => set.status === "HUY").length,
      overdueOpen: overdueOpen.length,
      reworkTasks: reworkTasks.length,
      totalTasks: tasks.filter((task) => task.stageKind !== "CHO" && task.status !== "BO_QUA").length,
      reworkRate: tasks.length
        ? (reworkTasks.length / Math.max(1, tasks.filter((task) => task.stageKind !== "CHO").length)) * 100
        : 0,
      avgProductionDays: productionDurations.length
        ? productionDurations.reduce((sum, value) => sum + value, 0) / productionDurations.length
        : null,
      avgTaskHours: taskHours.length ? taskHours.reduce((sum, value) => sum + value, 0) / taskHours.length : null,
    },
    weeklyOtd,
    byWorkCenter,
    byStage: stageStats,
    reasons: reasonStats,
    lateSets: late.sort((a, b) => b.daysLate - a.daysLate).slice(0, 50),
    staleStock: staleStock.slice(0, 50),
    byComponent,
  };
}
