/**
 * V136 — Xếp lịch & tính tải cho module Lên kế hoạch sản xuất.
 *
 * Nguyên tắc bám khảo sát nhà máy:
 *  - A7/KH4: ưu tiên HẠN GIAO gần nhất trước (EDD).
 *  - KH17: đơn làm lại chen trước đơn thường.
 *  - KH6/KH7: quá 70 cánh/ngày là quá nhiều, tối đa 80 cánh/ngày.
 *  - KH29: chỉ cần 2 cảnh báo — QUÁ TẢI TỔ và BỘ SẮP TRỄ.
 *  - J8: trễ hạn chỉ BÁO ĐỎ, không tự đề xuất lại lịch.
 *
 * Hàm THUẦN — không truy vấn DB.
 */

import {
  dateKeyUtc,
  hoursToWorkingDays,
  latestStartDate,
  startOfDayUtc,
  subtractWorkingDays,
  workingDaysBetween,
  type WorkingCalendar,
} from "@/lib/production/calendar";
import {
  canhEquivalentOf,
  parseSkipCondition,
  percentDoneOf,
  STAGE,
  type ProductionSetRow,
  type ProductionStageRow,
  type ProductionTaskRow,
  type ProductionWorkCenterRow,
} from "@/lib/production/catalog";
import type { ProductionConfig } from "@/lib/production/config";

export const ALL_WORKSHOP = "__TOAN_XUONG__";

// ---------------------------------------------------------------------------
// 1) Thứ tự xếp lịch
// ---------------------------------------------------------------------------

/**
 * Xếp thứ tự bộ để đưa vào kế hoạch:
 * 1. `priority` nhỏ trước (đơn làm lại = 0 chen trước — KH17).
 * 2. Hạn giao gần nhất trước (EDD — A7/KH4).
 * 3. Mã đơn / bộ số nhỏ trước cho ổn định.
 */
export function sortSetsForPlanning<T extends Pick<ProductionSetRow, "priority" | "dueDate" | "orderCode" | "setNo">>(
  sets: T[],
): T[] {
  return [...sets].sort((a, b) => {
    const priority = Number(a.priority) - Number(b.priority);
    if (priority !== 0) return priority;
    const dueA = a.dueDate ? startOfDayUtc(a.dueDate).getTime() : Number.POSITIVE_INFINITY;
    const dueB = b.dueDate ? startOfDayUtc(b.dueDate).getTime() : Number.POSITIVE_INFINITY;
    if (dueA !== dueB) return dueA - dueB;
    return String(a.orderCode ?? "").localeCompare(String(b.orderCode ?? ""), "vi") || String(a.setNo ?? "").localeCompare(String(b.setNo ?? ""), "vi");
  });
}

/** Ưu tiên mặc định theo loại đơn: đơn làm lại chen trước, đơn hàng mẫu xếp sau. */
export function defaultPriorityForOrderType(orderType: string | null | undefined): number {
  const code = String(orderType ?? "").trim().toUpperCase();
  if (code === "LAM_LAI") return 0;
  if (code === "SAN_XUAT") return 5;
  if (code === "MAU") return 8;
  return 5;
}

// ---------------------------------------------------------------------------
// 2) Kiểm tra điều kiện & cảnh báo đầu vào
// ---------------------------------------------------------------------------

/** Thiếu thông tin nào để chưa xếp được lịch (B3/KH5). */
export function missingInfoForPlanning(
  set: ProductionSetRow,
  config: Pick<ProductionConfig, "requireInfoBeforePlan">,
): string[] {
  const labels: Record<string, string> = {
    heightMm: "Cao",
    widthMm: "Rộng",
    openingDirection: "Hướng mở",
    paintColor: "Màu sơn",
  };
  const missing: string[] = [];
  for (const field of config.requireInfoBeforePlan) {
    const value = (set as Record<string, unknown>)[field];
    if (value === null || value === undefined || value === "") missing.push(labels[field] ?? field);
  }
  return missing;
}

/** Thời lượng đường găng của một bộ, suy từ chính các công đoạn đã sinh. */
export function setLeadHoursFromTasks(
  tasks: Array<Pick<ProductionTaskRow, "stageCode" | "seq" | "status">>,
  stages: ProductionStageRow[],
  config: ProductionConfig,
): number {
  const byCode = new Map(stages.map((stage) => [stage.code, stage]));
  // V139: các công đoạn CÙNG BƯỚC (cùng `seq`) chạy SONG SONG → chỉ tính 1 lần.
  const seen = new Set<number>();
  const durations: number[] = [];
  for (const task of tasks) {
    if (task.status === "BO_QUA" || seen.has(task.seq)) continue;
    seen.add(task.seq);
    const stage = byCode.get(task.stageCode);
    if (!stage) continue;
    durations.push(Math.max(0, Number(stage.leadTimeHours) || 0));
  }
  const total = durations.reduce((sum, value) => sum + value, 0);
  const overlap = Math.max(0, Number(config.overlapHoursPerStep) || 0);
  return Math.max(0, total - overlap * Math.max(0, durations.length - 1));
}

// ---------------------------------------------------------------------------
// 3) Tải theo tổ theo ngày
// ---------------------------------------------------------------------------

export type LoadCell = {
  workCenterCode: string;
  workCenterName: string;
  day: Date;
  /** Số cánh quy đổi xếp vào tổ trong ngày (mỗi bộ đếm 1 lần cho mỗi tổ). */
  canh: number;
  /** Số bộ khác nhau đi qua tổ trong ngày. */
  sets: number;
  capacity: number | null;
  ratio: number | null;
  tone: "ok" | "warn" | "bad";
};

export type BuildLoadOptions = {
  sets: ProductionSetRow[];
  tasks: ProductionTaskRow[];
  workCenters: ProductionWorkCenterRow[];
  from: Date;
  to: Date;
  config: ProductionConfig;
};

/** Tải mỗi tổ mỗi ngày. Bỏ công đoạn CHỜ (không chiếm máy/người) và công đoạn BO_QUA. */
export function buildWorkCenterLoad({ sets, tasks, workCenters, from, to, config }: BuildLoadOptions): LoadCell[] {
  const setById = new Map(sets.map((set) => [set.id, set]));
  const centerByCode = new Map(workCenters.map((center) => [center.code, center]));
  const fromDay = startOfDayUtc(from).getTime();
  const toDay = startOfDayUtc(to).getTime();

  // Khóa: tổ + ngày + bộ → mỗi bộ chỉ chiếm tổ 1 lần trong ngày dù đi qua nhiều công đoạn.
  const seen = new Set<string>();
  // Khóa: ngày + bộ → dùng cho dòng TOÀN XƯỞNG (đếm mỗi bộ MỘT lần/ngày, không cộng dồn theo tổ).
  const workshopSeen = new Set<string>();
  const bucket = new Map<string, { day: Date; centerCode: string; setIds: Set<number>; canh: number }>();
  const workshop = new Map<string, { day: Date; setIds: Set<number>; canh: number }>();

  for (const task of tasks) {
    if (task.status === "BO_QUA" || task.stageKind === "CHO") continue;
    if (!task.workCenterCode || !task.plannedStart) continue;
    const day = startOfDayUtc(task.plannedStart);
    if (day.getTime() < fromDay || day.getTime() > toDay) continue;
    const set = setById.get(task.setId);
    if (!set) continue;

    const workshopKey = `${dateKeyUtc(day)}|${set.id}`;
    if (!workshopSeen.has(workshopKey)) {
      workshopSeen.add(workshopKey);
      const dayKey = dateKeyUtc(day);
      const current = workshop.get(dayKey) ?? { day, setIds: new Set<number>(), canh: 0 };
      current.setIds.add(set.id);
      current.canh += canhEquivalentOf(set);
      workshop.set(dayKey, current);
    }

    const key = `${task.workCenterCode}|${dateKeyUtc(day)}|${set.id}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const bucketKey = `${task.workCenterCode}|${dateKeyUtc(day)}`;
    const current = bucket.get(bucketKey) ?? { day, centerCode: task.workCenterCode, setIds: new Set<number>(), canh: 0 };
    current.setIds.add(set.id);
    current.canh += canhEquivalentOf(set);
    bucket.set(bucketKey, current);
  }

  const cells: LoadCell[] = [];
  for (const entry of bucket.values()) {
    const center = centerByCode.get(entry.centerCode);
    const capacity = center?.capacityPerDay ?? null;
    cells.push({
      workCenterCode: entry.centerCode,
      workCenterName: center?.name ?? entry.centerCode,
      day: entry.day,
      canh: entry.canh,
      sets: entry.setIds.size,
      capacity,
      ratio: capacity && capacity > 0 ? entry.canh / capacity : null,
      tone: toneFor(entry.canh, capacity, config),
    });
  }

  // Dòng tổng toàn xưởng theo ngày (KH6/KH7) — mỗi bộ đếm MỘT lần trong ngày.
  for (const entry of workshop.values()) {
    cells.push({
      workCenterCode: ALL_WORKSHOP,
      workCenterName: "Toàn xưởng",
      day: entry.day,
      canh: entry.canh,
      sets: entry.setIds.size,
      capacity: config.dailyMaxCanh,
      ratio: config.dailyMaxCanh > 0 ? entry.canh / config.dailyMaxCanh : null,
      tone:
        entry.canh > config.dailyMaxCanh ? "bad" : entry.canh > config.dailyWarnCanh ? "warn" : "ok",
    });
  }

  return cells.sort((a, b) => a.day.getTime() - b.day.getTime() || a.workCenterName.localeCompare(b.workCenterName, "vi"));
}

function toneFor(canh: number, capacity: number | null, config: ProductionConfig): "ok" | "warn" | "bad" {
  if (capacity && capacity > 0) {
    if (canh > capacity) return "bad";
    if (canh > capacity * 0.85) return "warn";
    return "ok";
  }
  if (canh > config.dailyMaxCanh) return "bad";
  if (canh > config.dailyWarnCanh) return "warn";
  return "ok";
}

// ---------------------------------------------------------------------------
// 3b) Tải theo CÔNG ĐOẠN (V139.1 — nhà máy muốn năng lực tách theo công đoạn)
// ---------------------------------------------------------------------------

export type StageLoadCell = {
  workCenterCode: string;
  stageCode: string;
  stageName: string;
  seq: number;
  day: Date;
  /** Số cánh quy đổi xếp vào công đoạn trong ngày (mỗi bộ đếm 1 lần). */
  canh: number;
  sets: number;
  capacity: number | null;
  capacityUnit: string;
  /** Năng lực này khai ở CÔNG ĐOẠN hay kế thừa từ TỔ. */
  capacitySource: "CONG_DOAN" | "TO" | "CHUA_KHAI";
  ratio: number | null;
  tone: "ok" | "warn" | "bad";
};

export type BuildStageLoadOptions = {
  sets: ProductionSetRow[];
  tasks: ProductionTaskRow[];
  workCenters: ProductionWorkCenterRow[];
  stages: ProductionStageRow[];
  from: Date;
  to: Date;
  config: ProductionConfig;
};

/**
 * Tải mỗi CÔNG ĐOẠN mỗi ngày. Năng lực dùng theo thứ tự:
 *   1. `production_stages.capacity_per_day` (khai riêng cho công đoạn — V139.1)
 *   2. `production_work_centers.capacity_per_day` (năng lực tổ)
 *   3. không khai → chỉ so với ngưỡng toàn xưởng.
 * Bỏ công đoạn CHỜ và công đoạn BO_QUA. Một bộ chỉ đếm 1 lần cho mỗi công đoạn/ngày.
 */
export function buildStageLoad({ sets, tasks, workCenters, stages, from, to, config }: BuildStageLoadOptions): StageLoadCell[] {
  const setById = new Map(sets.map((set) => [set.id, set]));
  const centerByCode = new Map(workCenters.map((center) => [center.code, center]));
  const stageByCode = new Map(stages.map((stage) => [stage.code, stage]));
  const fromDay = startOfDayUtc(from).getTime();
  const toDay = startOfDayUtc(to).getTime();

  const bucket = new Map<string, { day: Date; stageCode: string; setIds: Set<number>; canh: number }>();
  for (const task of tasks) {
    if (task.status === "BO_QUA" || task.stageKind === "CHO") continue;
    if (!task.plannedStart) continue;
    const day = startOfDayUtc(task.plannedStart);
    if (day.getTime() < fromDay || day.getTime() > toDay) continue;
    const set = setById.get(task.setId);
    if (!set) continue;

    const key = `${task.stageCode}|${dateKeyUtc(day)}`;
    const current = bucket.get(key) ?? { day, stageCode: task.stageCode, setIds: new Set<number>(), canh: 0 };
    if (current.setIds.has(set.id)) continue;
    current.setIds.add(set.id);
    current.canh += canhEquivalentOf(set);
    bucket.set(key, current);
  }

  const cells: StageLoadCell[] = [];
  for (const entry of bucket.values()) {
    const stage = stageByCode.get(entry.stageCode);
    const center = stage?.workCenterCode ? centerByCode.get(stage.workCenterCode) : undefined;
    const stageCapacity = stage?.capacityPerDay && stage.capacityPerDay > 0 ? stage.capacityPerDay : null;
    const centerCapacity = center?.capacityPerDay && center.capacityPerDay > 0 ? center.capacityPerDay : null;
    const capacity = stageCapacity ?? centerCapacity;
    const capacitySource: StageLoadCell["capacitySource"] = stageCapacity ? "CONG_DOAN" : centerCapacity ? "TO" : "CHUA_KHAI";
    cells.push({
      workCenterCode: stage?.workCenterCode ?? "",
      stageCode: entry.stageCode,
      stageName: stage?.name ?? entry.stageCode,
      seq: stage?.seq ?? 0,
      day: entry.day,
      canh: entry.canh,
      sets: entry.setIds.size,
      capacity,
      capacityUnit: stage?.capacityUnit ?? center?.capacityUnit ?? "CANH",
      capacitySource,
      ratio: capacity && capacity > 0 ? entry.canh / capacity : null,
      tone: toneFor(entry.canh, capacity, config),
    });
  }

  return cells.sort(
    (a, b) => a.day.getTime() - b.day.getTime() || a.seq - b.seq || a.stageCode.localeCompare(b.stageCode),
  );
}

// ---------------------------------------------------------------------------
// 4) Cảnh báo (KH29 — chỉ 2 loại nhà máy cần, cộng vài cảnh báo phụ có sẵn dữ liệu)
// ---------------------------------------------------------------------------

export type ProductionWarning = {
  kind:
    | "QUA_TAI_TO"
    | "QUA_TAI_CONG_DOAN"
    | "SAP_TRE"
    | "CHAM_CONG_DOAN"
    | "KHONG_KIP"
    | "CHUA_DU_THONG_TIN"
    | "CHUA_CO_CHUONG_TRINH"
    | "MAY_DUNG";
  level: "warn" | "bad";
  title: string;
  detail: string;
  setId?: number;
  href?: string;
};

export type BuildWarningsOptions = {
  sets: ProductionSetRow[];
  tasks: ProductionTaskRow[];
  stages: ProductionStageRow[];
  config: ProductionConfig;
  calendar: WorkingCalendar;
  loadCells: LoadCell[];
  /** V139.1 — tải theo công đoạn (chỉ để cảnh báo công đoạn có năng lực khai riêng bị vượt). */
  stageLoadCells?: StageLoadCell[];
  today: Date;
  /** Model đã có chương trình máy cắt. */
  modelsWithProgram: Set<string>;
  /** Máy đang dừng (chưa có `toAt`). */
  openDowntimes?: Array<{ workCenterCode: string; machine: string | null; reasonCode: string | null }>;
};

export function buildWarnings(options: BuildWarningsOptions): ProductionWarning[] {
  const { sets, tasks, stages, config, calendar, loadCells, stageLoadCells = [], today, modelsWithProgram, openDowntimes = [] } = options;
  const todayStart = startOfDayUtc(today);
  const stageByCode = new Map(stages.map((stage) => [stage.code, stage]));
  const warnings: ProductionWarning[] = [];

  // --- 4.1 Quá tải tổ (KH29) ---
  const overloads = loadCells
    .filter((cell) => cell.tone !== "ok")
    .sort((a, b) => (b.ratio ?? 0) - (a.ratio ?? 0))
    .slice(0, 10);
  for (const cell of overloads) {
    const isWorkshop = cell.workCenterCode === ALL_WORKSHOP;
    const capacityText = cell.capacity ? `${Math.round(cell.capacity)} cánh` : "chưa khai năng lực";
    warnings.push({
      kind: "QUA_TAI_TO",
      level: cell.tone === "bad" ? "bad" : "warn",
      title: isWorkshop
        ? `Toàn xưởng quá tải ngày ${formatDay(cell.day)}`
        : `Tổ ${cell.workCenterName} quá tải ngày ${formatDay(cell.day)}`,
      detail: `${Math.round(cell.canh)} cánh / năng lực ${capacityText} (${cell.sets} bộ)`,
    });
  }

  // --- 4.1b Quá tải CÔNG ĐOẠN (V139.1: công đoạn có năng lực khai riêng) ---
  const stageOverloads = stageLoadCells
    .filter((cell) => cell.tone !== "ok" && cell.capacitySource === "CONG_DOAN")
    .sort((a, b) => (b.ratio ?? 0) - (a.ratio ?? 0))
    .slice(0, 10);
  for (const cell of stageOverloads) {
    warnings.push({
      kind: "QUA_TAI_CONG_DOAN",
      level: cell.tone === "bad" ? "bad" : "warn",
      title: `Công đoạn ${cell.stageName} quá tải ngày ${formatDay(cell.day)}`,
      detail: `${Math.round(cell.canh)} cánh / năng lực công đoạn ${Math.round(cell.capacity!)} ${cell.capacityUnit} (${cell.sets} bộ)`,
    });
  }

  // --- 4.2 Bộ sắp trễ / đã trễ (KH29 · J8: chỉ báo, không tự sửa) ---
  const tasksBySet = new Map<number, ProductionTaskRow[]>();
  for (const task of tasks) {
    const list = tasksBySet.get(task.setId);
    if (list) list.push(task);
    else tasksBySet.set(task.setId, [task]);
  }

  for (const set of sets) {
    if (set.status === "HOAN_THANH" || set.status === "DA_GIAO" || set.status === "HUY") continue;
    const setTasks = tasksBySet.get(set.id) ?? [];
    const workshopDue = set.dueDate ? subtractWorkingDays(set.dueDate, config.deliveryBufferDays, calendar) : null;

    if (set.dueDate && startOfDayUtc(set.dueDate).getTime() < todayStart.getTime()) {
      const late = workingDaysBetween(set.dueDate, todayStart, calendar);
      warnings.push({
        kind: "SAP_TRE",
        level: "bad",
        title: `Bộ ${labelOf(set)} đã quá hạn ${late} ngày làm việc`,
        detail: `Hạn giao ${formatDay(set.dueDate)} · tiến độ ${set.percentDone}%`,
        setId: set.id,
        href: `/ke-hoach-san-xuat/bo/${set.id}`,
      });
      continue;
    }

    if (set.status === "CHO_XEP_LICH" && set.dueDate) {
      const leadHours = setLeadHoursFromTasks(setTasks, stages, config);
      const mustStart = latestStartDate(set.dueDate, leadHours, config, calendar);
      if (mustStart.getTime() < todayStart.getTime()) {
        const late = workingDaysBetween(mustStart, todayStart, calendar);
        warnings.push({
          kind: "SAP_TRE",
          level: "bad",
          title: `Bộ ${labelOf(set)} cần bắt đầu trước ${formatDay(mustStart)} (đã trễ ${late} ngày)`,
          detail: `Hạn giao ${formatDay(set.dueDate)} · đường găng ${hoursToWorkingDays(leadHours, config)} ngày làm việc`,
          setId: set.id,
          href: `/ke-hoach-san-xuat/bo/${set.id}`,
        });
      } else {
        const daysLeft = workingDaysBetween(todayStart, mustStart, calendar);
        if (daysLeft <= 2) {
          warnings.push({
            kind: "SAP_TRE",
            level: "warn",
            title: `Bộ ${labelOf(set)} chỉ còn ${daysLeft} ngày là phải bắt đầu`,
            detail: `Hạn giao ${formatDay(set.dueDate)} · nên xếp lịch ngay`,
            setId: set.id,
            href: `/ke-hoach-san-xuat/bo/${set.id}`,
          });
        }
      }
    }

    if (workshopDue && set.plannedEnd && !set.startedAt && startOfDayUtc(set.plannedEnd).getTime() > workshopDue.getTime()) {
      warnings.push({
        kind: "SAP_TRE",
        level: "bad",
        title: `Bộ ${labelOf(set)} xếp xong sau ngày xưởng phải xong`,
        detail: `Kế hoạch xong ${formatDay(set.plannedEnd)} · cần xong trước ${formatDay(workshopDue)} (hạn giao ${formatDay(set.dueDate!)} − ${config.deliveryBufferDays} ngày đệm)`,
        setId: set.id,
        href: `/ke-hoach-san-xuat/bo/${set.id}`,
      });
    }
  }

  // --- 4.2b V144: KHÔNG KỊP (bộ đã vào sản xuất, dự kiến xong sau hạn xưởng) ---
  for (const set of sets) {
    const startedAt = set.startedAt;
    const targetEnd = set.targetEnd;
    const dueDate = set.dueDate;
    if (!startedAt || !targetEnd || !dueDate) continue;
    if (set.status === "HOAN_THANH" || set.status === "DA_GIAO" || set.status === "HUY") continue;
    const workshopDue = subtractWorkingDays(dueDate, config.deliveryBufferDays, calendar);
    if (startOfDayUtc(targetEnd).getTime() > startOfDayUtc(workshopDue).getTime()) {
      const late = Math.max(1, workingDaysBetween(workshopDue, targetEnd, calendar));
      warnings.push({
        kind: "KHONG_KIP",
        level: "bad",
        title: `Bộ ${labelOf(set)} KHÔNG KỊP — dự kiến xong ${formatDay(targetEnd)}`,
        detail: `Hạn xưởng phải xong ${formatDay(workshopDue)} (hạn giao ${formatDay(dueDate)} − ${config.deliveryBufferDays} ngày đệm) · muộn ${late} ngày làm việc · bắt đầu từ ${formatDay(startedAt)}`,
        setId: set.id,
        href: `/ke-hoach-san-xuat/bo/${set.id}`,
      });
    }
  }

  // --- 4.2c V144: CHẬM — công đoạn đã quá MỐC (target) mà chưa xong ---
  for (const set of sets) {
    if (set.status === "HOAN_THANH" || set.status === "DA_GIAO" || set.status === "HUY") continue;
    const setTasks = tasksBySet.get(set.id) ?? [];
    const lateTasks = setTasks.filter(
      (task): task is typeof task & { targetEnd: Date } =>
        task.targetEnd !== null &&
        task.status !== "XONG" &&
        task.status !== "BO_QUA" &&
        startOfDayUtc(task.targetEnd).getTime() < todayStart.getTime(),
    );
    if (!lateTasks.length) continue;
    const worst = lateTasks.reduce((min, task) =>
      startOfDayUtc(task.targetEnd).getTime() < startOfDayUtc(min.targetEnd).getTime() ? task : min,
    );
    const worstStage = stageByCode.get(worst.stageCode)?.name ?? worst.stageCode;
    const late = Math.max(1, workingDaysBetween(worst.targetEnd, todayStart, calendar));
    warnings.push({
      kind: "CHAM_CONG_DOAN",
      level: "bad",
      title: `Bộ ${labelOf(set)} CHẬM ${lateTasks.length} công đoạn quá mốc`,
      detail: `Chậm nhất: ${worstStage} — mốc xong ${formatDay(worst.targetEnd)} (chậm ${late} ngày làm việc) · mốc cả bộ ${set.targetEnd ? formatDay(set.targetEnd) : "—"}`,
      setId: set.id,
      href: `/ke-hoach-san-xuat/bo/${set.id}`,
    });
  }

  // --- 4.3 Bộ chưa đủ thông tin để xếp lịch (B3/KH5) ---
  const incomplete = sets.filter(
    (set) =>
      set.status !== "HOAN_THANH" &&
      set.status !== "DA_GIAO" &&
      set.status !== "HUY" &&
      missingInfoForPlanning(set, config).length > 0,
  );
  if (incomplete.length) {
    warnings.push({
      kind: "CHUA_DU_THONG_TIN",
      level: "warn",
      title: `${incomplete.length} bộ chưa đủ thông tin để xếp lịch`,
      detail: `Thiếu ${Array.from(new Set(incomplete.flatMap((set) => missingInfoForPlanning(set, config)))).join(", ")} — cần sale bổ sung trước khi vào kế hoạch`,
    });
  }

  // --- 4.4 Bộ chờ chương trình máy cắt (Bồi Lares chặn Cắt — BL4) ---
  const waitingProgram = sets.filter((set) => {
    if (set.status === "HOAN_THANH" || set.status === "DA_GIAO" || set.status === "HUY") return false;
    const model = String(set.model ?? "").trim();
    if (model && modelsWithProgram.has(model.toUpperCase())) return false;
    const programTask = (tasksBySet.get(set.id) ?? []).find((task) => task.stageCode === STAGE.BOI_LARES);
    return Boolean(programTask) && programTask!.status !== "XONG" && programTask!.status !== "BO_QUA";
  });
  if (waitingProgram.length) {
    warnings.push({
      kind: "CHUA_CO_CHUONG_TRINH",
      level: "warn",
      title: `${waitingProgram.length} bộ chờ chương trình máy cắt`,
      detail: `Model chưa có chương trình → máy cắt không chạy được. Danh mục chương trình ở Cấu hình sản xuất.`,
    });
  }

  // --- 4.5 Máy đang dừng (KH28) ---
  for (const downtime of openDowntimes.slice(0, 5)) {
    warnings.push({
      kind: "MAY_DUNG",
      level: "warn",
      title: `Máy đang dừng ở ${downtime.workCenterCode}`,
      detail: [downtime.machine, downtime.reasonCode].filter(Boolean).join(" · ") || "Chưa ghi lý do",
    });
  }

  return warnings.sort((a, b) => (a.level === b.level ? 0 : a.level === "bad" ? -1 : 1));
}

function labelOf(set: Pick<ProductionSetRow, "setNo" | "orderCode">): string {
  const setNo = String(set.setNo ?? "").trim();
  const orderCode = String(set.orderCode ?? "").trim();
  if (setNo) return setNo;
  return orderCode || "(chưa có bộ số)";
}

function formatDay(value: Date): string {
  const day = startOfDayUtc(value);
  const pad = (number: number) => String(number).padStart(2, "0");
  return `${pad(day.getUTCDate())}/${pad(day.getUTCMonth() + 1)}`;
}

/** Tổng quan nhanh cho màn hình chính. */
export function buildProductionSummary(sets: ProductionSetRow[], tasks: ProductionTaskRow[]) {
  const tasksBySet = new Map<number, ProductionTaskRow[]>();
  for (const task of tasks) {
    const list = tasksBySet.get(task.setId);
    if (list) list.push(task);
    else tasksBySet.set(task.setId, [task]);
  }
  const waiting = sets.filter((set) => set.status === "CHO_XEP_LICH").length;
  const inProgress = sets.filter((set) => set.status === "DANG_SX" || set.status === "DA_XEP_LICH").length;
  const completed = sets.filter((set) => set.status === "HOAN_THANH").length;
  const delivered = sets.filter((set) => set.status === "DA_GIAO").length;
  const paused = sets.filter((set) => set.status === "TAM_DUNG").length;
  const totalCanh = sets.reduce((sum, set) => sum + canhEquivalentOf(set), 0);
  const avgPercent = sets.length
    ? Math.round(sets.reduce((sum, set) => sum + percentDoneOf(tasksBySet.get(set.id) ?? []), 0) / sets.length)
    : 0;
  return { total: sets.length, waiting, inProgress, completed, delivered, paused, totalCanh, avgPercent };
}

export { parseSkipCondition };
