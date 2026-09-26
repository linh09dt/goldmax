/**
 * V148 — LẬP KẾ HOẠCH CHO TỪNG CÔNG ĐOẠN **THEO NĂNG LỰC**.
 *
 * Nguyên tắc (nhà máy chốt 26/09/2026 — xem `KE_HOACH_THEO_CONG_DOAN_V147.md` mục 2.1):
 *   • NĂNG LỰC quyết định NGÀY: mỗi (công đoạn, ngày) chỉ nhận tối đa `capacity_per_day`.
 *     Hết chỗ → bộ trôi sang ngày làm việc kế tiếp. Một bộ lớn hơn năng lực 1 ngày thì
 *     TRẢI qua nhiều ngày ⇒ số ngày công đoạn TRONG KẾ HOẠCH = ceil(tải / năng lực),
 *     KHÔNG phải `lead_time_days`.
 *   • LEAD TIME **không** tham gia xếp ngày. Nó chỉ dùng để suy MỐC (target) và đối chiếu
 *     "đơn có kịp hay không" (xem `targets.ts` + cảnh báo `KE_HOACH_VUOT_MOC` ở service).
 *
 * Module THUẦN — không truy vấn DB, test được, dùng lại ở server lẫn UI.
 */

import {
  canhEquivalentOf,
  type ProductionSetRow,
  type ProductionStageRow,
  type ProductionTaskRow,
  type ProductionWorkCenterRow,
  type TaskScope,
} from "@/lib/production/catalog";
import {
  addWorkingDays,
  dateKeyUtc,
  startOfDayUtc,
  subtractWorkingDays,
  type WorkingCalendar,
} from "@/lib/production/calendar";
import { sortSetsForPlanning } from "@/lib/production/scheduling";
import { snapToWorkingDay } from "@/lib/production/targets";
import type { ProductionConfig } from "@/lib/production/config";

// ---------------------------------------------------------------------------
// 1) ĐƠN VỊ TẢI CỦA CÔNG ĐOẠN (Q2/Q3/Q4 — 26/09/2026)
// ---------------------------------------------------------------------------

/** Đơn vị tải: `CANH` = theo cánh (phần gia công), `BO` = theo bộ (cả bộ 1 lượt). */
export type LoadUnit = "CANH" | "BO";

/**
 * Công đoạn làm cho TỪNG PHẦN (Cắt/Chấn/Hàn/Ép/Vân) → tải theo **cánh**.
 * Công đoạn làm cho CẢ BỘ (Thiết kế, Bồi Lares, Test, **Sơn**, Lắp kính, Đóng gói, Kho)
 * → tải theo **bộ**. Riêng Sơn: nhà máy chốt "1 đơn vị sơn = cánh + khung + phào" (Q2)
 * nên tính theo bộ, tránh nhân tải 2 lần.
 */
export function loadUnitOfStage(stage: Pick<ProductionStageRow, "scopeMode">): LoadUnit {
  return stage.scopeMode === "PART" || stage.scopeMode === "PARTS" ? "CANH" : "BO";
}

/** Số bộ của một dòng `production_sets` (mặc định 1). */
export function soBoOf(set: Pick<ProductionSetRow, "quantity">): number {
  const value = Number(set.quantity);
  return Number.isFinite(value) && value > 0 ? Math.trunc(value) : 1;
}

/** Tải mà MỘT BỘ chiếm ở công đoạn này, theo đơn vị của công đoạn. */
export function demandOfTask(
  set: Pick<ProductionSetRow, "quantity" | "leavesPerSet" | "productName">,
  stage: Pick<ProductionStageRow, "scopeMode">,
): number {
  return loadUnitOfStage(stage) === "BO" ? soBoOf(set) : canhEquivalentOf(set);
}

// ---------------------------------------------------------------------------
// 2) NĂNG LỰC: công đoạn → tổ → chưa khai
// ---------------------------------------------------------------------------

export type CapacitySource = "CONG_DOAN" | "TO" | "CHUA_KHAI";

export type CapacityInfo = {
  /** Cùng đơn vị với `loadUnitOfStage(stage)`. `null` = không giới hạn (chưa khai). */
  value: number | null;
  source: CapacitySource;
  workCenterCode: string | null;
};

/**
 * Năng lực/ngày của công đoạn, ưu tiên năng lực khai RIÊNG cho công đoạn, rồi mới tới tổ.
 * (`scheduling.ts` cũng dùng đúng thứ tự này — xem `buildStageLoad`.)
 */
export function capacityOfStage(
  stage: Pick<ProductionStageRow, "capacityPerDay" | "workCenterCode">,
  workCenters: Array<Pick<ProductionWorkCenterRow, "code" | "capacityPerDay">>,
): CapacityInfo {
  const stageCapacity = Number(stage.capacityPerDay);
  if (Number.isFinite(stageCapacity) && stageCapacity > 0) {
    return { value: Math.trunc(stageCapacity), source: "CONG_DOAN", workCenterCode: stage.workCenterCode };
  }
  const center = jobCenter(stage.workCenterCode, workCenters);
  const centerCapacity = Number(center?.capacityPerDay);
  if (Number.isFinite(centerCapacity) && centerCapacity > 0) {
    return { value: Math.trunc(centerCapacity), source: "TO", workCenterCode: stage.workCenterCode };
  }
  return { value: null, source: "CHUA_KHAI", workCenterCode: stage.workCenterCode };
}

function jobCenter(
  code: string | null,
  workCenters: Array<Pick<ProductionWorkCenterRow, "code" | "capacityPerDay">>,
): Pick<ProductionWorkCenterRow, "code" | "capacityPerDay"> | undefined {
  if (!code) return undefined;
  return workCenters.find((center) => center.code === code);
}

// ---------------------------------------------------------------------------
// 3) KẾT QUẢ
// ---------------------------------------------------------------------------

export type PlannedTaskState =
  /** Xếp mới ngày kế hoạch. */
  | "XEP"
  /** Đã XONG từ trước — giữ nguyên ngày, không chiếm năng lực tương lai. */
  | "GIU_NGUYEN"
  /** Công đoạn bỏ qua (màu 11/14, model đã có chương trình…) — không chiếm lịch. */
  | "BO_QUA"
  /** Tràn khỏi khoảng kế hoạch — cần mở rộng khoảng. */
  | "TRAN";

export type StagePlanTaskEntry = {
  taskId: number;
  setId: number;
  stageCode: string;
  seq: number;
  scope: string;
  workCenterCode: string | null;
  state: PlannedTaskState;
  start: Date | null;
  end: Date | null;
  /** Số NGÀY LÀM VIỆC công đoạn chiếm trong kế hoạch (do năng lực quyết định). */
  days: number;
  demand: number;
  unit: LoadUnit;
  capacity: number | null;
  capacitySource: CapacitySource;
};

export type StagePlanLoadCell = {
  day: Date;
  stageCode: string;
  stageName: string;
  seq: number;
  workCenterCode: string | null;
  /** Tổng tải đã xếp trong ngày, theo `unit`. */
  worked: number;
  unit: LoadUnit;
  capacity: number | null;
  capacitySource: CapacitySource;
  ratio: number | null;
  tone: "ok" | "warn" | "bad";
  /** Số bộ khác nhau đi qua công đoạn này trong ngày. */
  sets: number;
};

export type StagePlanWarningKind =
  | "CHUA_KHAI_NANG_LUC"
  | "VUOT_NANG_LUC_MOT_BO"
  | "TRAN_KHOANG_KE_HOACH";

export type StagePlanWarning = {
  kind: StagePlanWarningKind;
  stageCode: string | null;
  setId: number | null;
  message: string;
};

export type StagePlanSetSummary = {
  setId: number;
  setNo: string | null;
  orderCode: string | null;
  customerName: string | null;
  paintColor: string | null;
  dueDate: Date | null;
  plannedStart: Date | null;
  plannedEnd: Date | null;
  /** Số bộ × cánh quy đổi — để xếp thứ tự và đối chiếu tải. */
  canh: number;
  tasksPlanned: number;
  tasksTotal: number;
  /** Mốc muộn nhất trong các công đoạn (suy từ lead time — chỉ để đối chiếu). */
  targetEnd: Date | null;
  /** Kế hoạch (năng lực) có vượt mốc (lead time) không. */
  lateVsTarget: boolean;
  /** Ngày xưởng phải xong = hạn giao − đệm vận chuyển. */
  workshopDue: Date | null;
  /** Kế hoạch (năng lực) có trễ hạn giao không. */
  lateVsDue: boolean;
  workCenterCodes: string[];
};

export type StagePlanStats = {
  setsPlanned: number;
  tasksPlanned: number;
  tasksKept: number;
  tasksSkipped: number;
  tasksOverflow: number;
  firstDay: Date | null;
  lastDay: Date | null;
  workingDays: number;
};

export type StagePlanResult = {
  tasks: StagePlanTaskEntry[];
  loads: StagePlanLoadCell[];
  warnings: StagePlanWarning[];
  sets: StagePlanSetSummary[];
  stats: StagePlanStats;
};

// ---------------------------------------------------------------------------
// 4) THUẬT TOÁN
// ---------------------------------------------------------------------------

export type BuildStagePlanOptions = {
  sets: ProductionSetRow[];
  tasks: ProductionTaskRow[];
  stages: ProductionStageRow[];
  workCenters: ProductionWorkCenterRow[];
  calendar: WorkingCalendar;
  config: Pick<ProductionConfig, "overlapDaysPerStep" | "deliveryBufferDays">;
  /** Ngày bắt đầu xếp (thường là hôm nay). */
  from: Date;
  /** Biên trên — quá ngày này thì dừng và cảnh báo tràn. */
  to: Date;
  /** Chỉ xếp các bộ này (mặc định: mọi bộ trong `sets`). */
  setIds?: number[];
};

/** Trạng thái bộ còn được lập kế hoạch (bỏ bộ đã xong / đã giao / đã huỷ / tạm dừng). */
export const PLANNABLE_SET_STATUSES = ["CHO_XEP_LICH", "DA_XEP_LICH", "DANG_SX"] as const;

const MAX_GUARD = 5000;

/**
 * Xếp kế hoạch tiến (forward) cho TỪNG CÔNG ĐOẠN của từng bộ theo năng lực.
 *
 * Thứ tự xử lý bộ: `sortSetsForPlanning` (đơn làm lại chen trước → hạn giao gần nhất trước).
 * Trong một bộ: đi theo BƯỚC (`seq`); công đoạn cùng `seq` chạy SONG SONG (chuẩn bị cùng ngày).
 */
export function buildStagePlan(options: BuildStagePlanOptions): StagePlanResult {
  const { calendar } = options;
  const from = snapToWorkingDay(options.from, calendar);
  const to = startOfDayUtc(options.to);

  const stageByCode = new Map(options.stages.map((stage) => [stage.code, stage]));

  const inScope = options.setIds?.length ? new Set(options.setIds) : null;
  const tasksBySet = new Map<number, ProductionTaskRow[]>();
  for (const task of options.tasks) {
    if (inScope && !inScope.has(task.setId)) continue;
    const list = tasksBySet.get(task.setId);
    if (list) list.push(task);
    else tasksBySet.set(task.setId, [task]);
  }

  const candidateSets = options.sets.filter((set) => {
    if (inScope && !inScope.has(set.id)) return false;
    if (!PLANNABLE_SET_STATUSES.includes(set.status as (typeof PLANNABLE_SET_STATUSES)[number])) return false;
    return (tasksBySet.get(set.id)?.length ?? 0) > 0;
  });

  // Trạng thái tải: `${stageCode}|${YYYY-MM-DD}` → tải đã xếp
  const used = new Map<string, number>();
  const setsInCell = new Map<string, Set<number>>();
  const warnings: StagePlanWarning[] = [];
  const warnedCapacity = new Set<string>();
  const entries: StagePlanTaskEntry[] = [];
  const summaries: StagePlanSetSummary[] = [];

  const loadKey = (stageCode: string, day: Date) => `${stageCode}|${dateKeyUtc(day)}`;
  const usedIn = (stageCode: string, day: Date) => used.get(loadKey(stageCode, day)) ?? 0;

  for (const set of sortSetsForPlanning(candidateSets)) {
    const setTasks = (tasksBySet.get(set.id) ?? [])
      .filter((task) => {
        const stage = stageByCode.get(task.stageCode);
        return Boolean(stage) && stage!.active;
      })
      .sort((a, b) => a.seq - b.seq || a.scope.localeCompare(b.scope) || a.stageCode.localeCompare(b.stageCode));

    if (!setTasks.length) continue;

    const planStart = snapToWorkingDay(maxDate(from, set.startedAt ?? from), calendar);
    let prevStepStart: Date | null = null;
    let prevStepEnd: Date | null = null;
    let setFirstDay: Date | null = null;
    let setLastDay: Date | null = null;
    let tasksPlanned = 0;
    let targetEnd: Date | null = null;
    const centerCodes = new Set<string>();

    // Gom theo BƯỚC (seq): cùng seq = chạy song song.
    const steps = groupBySeq(setTasks);
    for (const step of steps) {
      // Ngày sẵn sàng: sau khi bước trước xong (+1 ngày làm việc), lùi theo "gối công đoạn".
      const overlap = Math.max(0, Math.trunc(Number(options.config.overlapDaysPerStep) || 0));
      let ready: Date;
      if (prevStepEnd) {
        const next = addWorkingDays(prevStepEnd, 1, calendar);
        const candidate = overlap > 0 ? subtractWorkingDays(next, overlap, calendar) : next;
        const floor = maxDate(planStart, prevStepStart ?? planStart);
        ready = snapToWorkingDay(candidate.getTime() < floor.getTime() ? floor : candidate, calendar);
      } else {
        ready = planStart;
      }

      let stepEnd: Date | null = null;
      for (const task of step) {
        const stage = stageByCode.get(task.stageCode)!;
        const unit = loadUnitOfStage(stage);
        const demand = demandOfTask(set, stage);
        // Tổ hiện tại của CÔNG ĐOẠN thắng ảnh chụp trên task: danh mục có thể đã đổi tổ
        // (vd Đóng gói chuyển từ TO_DONG_GOI về KHO) mà task cũ vẫn giữ mã tổ cũ.
        const center = stage.workCenterCode ?? task.workCenterCode ?? null;
        const capacity = capacityOfStage(
          { capacityPerDay: stage.capacityPerDay, workCenterCode: center },
          options.workCenters,
        );
        if (center) centerCodes.add(center);

        const base = {
          taskId: task.id,
          setId: set.id,
          stageCode: task.stageCode,
          seq: task.seq,
          scope: task.scope as TaskScope,
          workCenterCode: center,
          demand,
          unit,
          capacity: capacity.value,
          capacitySource: capacity.source,
        } as const;

        if (capacity.source === "CHUA_KHAI" && !warnedCapacity.has(task.stageCode)) {
          warnedCapacity.add(task.stageCode);
          warnings.push({
            kind: "CHUA_KHAI_NANG_LUC",
            stageCode: task.stageCode,
            setId: null,
            message: `Công đoạn ${stage.name} (${task.stageCode}) chưa khai năng lực/ngày — kế hoạch của công đoạn này không giới hạn, chỉ mang tính tham khảo.`,
          });
        }

        // Đã xong trước đó: giữ nguyên ngày, không chiếm năng lực tương lai.
        if (task.status === "XONG") {
          const end = task.actualEnd ?? task.plannedEnd ?? task.plannedStart ?? null;
          const start = task.plannedStart ?? task.actualStart ?? end;
          if (end) {
            stepEnd = maxDate(stepEnd ?? end, end);
            setFirstDay = setFirstDay ? minDate(setFirstDay, start ?? end) : start ?? end;
            setLastDay = setLastDay ? maxDate(setLastDay, end) : end;
          }
          if (task.targetEnd) targetEnd = targetEnd ? maxDate(targetEnd, task.targetEnd) : task.targetEnd;
          entries.push({ ...base, state: "GIU_NGUYEN", start, end, days: daysBetween(start, end, calendar) });
          continue;
        }

        if (task.status === "BO_QUA") {
          entries.push({ ...base, state: "BO_QUA", start: null, end: null, days: 0 });
          continue;
        }

        const placed = allocate({
          setId: set.id,
          stageCode: task.stageCode,
          demand,
          capacity: capacity.value,
          ready,
          limit: to,
          calendar,
          usedIn,
          register: (day, amount) => {
            const cellKey = loadKey(task.stageCode, day);
            used.set(cellKey, usedIn(task.stageCode, day) + amount);
            const bucket = setsInCell.get(cellKey) ?? new Set<number>();
            bucket.add(set.id);
            setsInCell.set(cellKey, bucket);
          },
        });

        if (!placed) {
          warnings.push({
            kind: "TRAN_KHOANG_KE_HOACH",
            stageCode: task.stageCode,
            setId: set.id,
            message: `Bộ ${set.setNo ?? set.id} — công đoạn ${stage.name} không xếp hết trước ${dateKeyUtc(to)}; hãy mở rộng khoảng kế hoạch hoặc bổ sung năng lực.`,
          });
          entries.push({ ...base, state: "TRAN", start: null, end: null, days: 0 });
          continue;
        }

        if (capacity.value !== null && demand > capacity.value) {
          warnings.push({
            kind: "VUOT_NANG_LUC_MOT_BO",
            stageCode: task.stageCode,
            setId: set.id,
            message: `Bộ ${set.setNo ?? set.id} cần ${demand} ${unitLabel(unit)} ở ${stage.name} > năng lực ${capacity.value} ${unitLabel(unit)}/ngày → trải ${placed.days} ngày.`,
          });
        }

        if (task.targetEnd) targetEnd = targetEnd ? maxDate(targetEnd, task.targetEnd) : task.targetEnd;
        stepEnd = stepEnd ? maxDate(stepEnd, placed.end) : placed.end;
        setFirstDay = setFirstDay ? minDate(setFirstDay, placed.start) : placed.start;
        setLastDay = setLastDay ? maxDate(setLastDay, placed.end) : placed.end;
        tasksPlanned += 1;
        entries.push({ ...base, state: "XEP", start: placed.start, end: placed.end, days: placed.days });
      }

      prevStepStart = ready;
      prevStepEnd = stepEnd ?? prevStepEnd;
    }

    const plannedEnd = setLastDay ?? null;
    const workshopDue = set.dueDate
      ? subtractWorkingDays(set.dueDate, Math.max(0, Math.trunc(Number(options.config.deliveryBufferDays) || 0)), calendar)
      : null;
    summaries.push({
      setId: set.id,
      setNo: set.setNo,
      orderCode: set.orderCode,
      customerName: set.customerName,
      paintColor: set.paintColor,
      dueDate: set.dueDate,
      plannedStart: setFirstDay,
      plannedEnd,
      canh: canhEquivalentOf(set),
      tasksPlanned,
      tasksTotal: setTasks.length,
      targetEnd,
      lateVsTarget: Boolean(plannedEnd && targetEnd && plannedEnd.getTime() > targetEnd.getTime()),
      workshopDue,
      lateVsDue: Boolean(plannedEnd && workshopDue && plannedEnd.getTime() > workshopDue.getTime()),
      workCenterCodes: Array.from(centerCodes),
    });
  }

  const loads = buildLoads({
    used,
    setsInCell,
    stageByCode,
    capacityOf: (stage) => capacityOfStage(stage, options.workCenters),
    calendar,
  });

  const placedDays = entries.filter((entry) => entry.start && entry.end);
  const firstDay = placedDays.length
    ? placedDays.reduce((min, entry) => (entry.start!.getTime() < min.getTime() ? entry.start! : min), placedDays[0].start!)
    : null;
  const lastDay = placedDays.length
    ? placedDays.reduce((max, entry) => (entry.end!.getTime() > max.getTime() ? entry.end! : max), placedDays[0].end!)
    : null;

  const stats: StagePlanStats = {
    setsPlanned: summaries.length,
    tasksPlanned: entries.filter((entry) => entry.state === "XEP").length,
    tasksKept: entries.filter((entry) => entry.state === "GIU_NGUYEN").length,
    tasksSkipped: entries.filter((entry) => entry.state === "BO_QUA").length,
    tasksOverflow: entries.filter((entry) => entry.state === "TRAN").length,
    firstDay,
    lastDay,
    workingDays: firstDay && lastDay ? countWorkingDays(firstDay, lastDay, calendar) : 0,
  };

  return { tasks: entries, loads, warnings, sets: summaries, stats };
}

/** Tham số cho `allocate`. */
type AllocateArgs = {
  setId: number;
  stageCode: string;
  demand: number;
  capacity: number | null;
  ready: Date;
  limit: Date;
  calendar: WorkingCalendar;
  usedIn: (stageCode: string, day: Date) => number;
  register: (day: Date, amount: number) => void;
};

/**
 * Đặt `demand` vào (công đoạn, ngày) theo năng lực:
 *   - ngày sớm nhất ≥ `ready` còn chỗ;
 *   - hết chỗ → sang ngày làm việc kế tiếp;
 *   - `demand > capacity` → trải qua nhiều ngày (mỗi ngày ≤ capacity).
 * Trả `null` nếu không xếp hết trước `limit`.
 */
function allocate(args: AllocateArgs): { start: Date; end: Date; days: number } | null {
  const { demand, capacity, calendar, limit } = args;
  if (demand <= 0) return null;

  let cursor = snapToWorkingDay(args.ready, calendar);
  let remaining = demand;
  let first: Date | null = null;
  let last: Date | null = null;
  let guard = 0;

  while (remaining > 0 && cursor.getTime() <= limit.getTime() && guard < MAX_GUARD) {
    const free = capacity === null ? remaining : Math.max(0, capacity - args.usedIn(args.stageCode, cursor));
    if (free > 0) {
      const take = Math.min(remaining, free);
      args.register(cursor, take);
      remaining -= take;
      if (!first) first = new Date(cursor);
      last = new Date(cursor);
    }
    if (remaining > 0) cursor = addWorkingDays(cursor, 1, calendar);
    guard += 1;
  }

  if (remaining > 0 || !first || !last) return null;
  return { start: first, end: last, days: countWorkingDays(first, last, calendar) };
}

function buildLoads(args: {
  used: Map<string, number>;
  setsInCell: Map<string, Set<number>>;
  stageByCode: Map<string, ProductionStageRow>;
  capacityOf: (stage: ProductionStageRow) => CapacityInfo;
  calendar: WorkingCalendar;
}): StagePlanLoadCell[] {
  const capacityByStage = new Map<string, CapacityInfo>();
  for (const [code, stage] of args.stageByCode) capacityByStage.set(code, args.capacityOf(stage));

  const cells: StagePlanLoadCell[] = [];
  for (const [key, worked] of args.used) {
    const [stageCode, dayKey] = key.split("|");
    const stage = args.stageByCode.get(stageCode);
    if (!stage) continue;
    const day = new Date(`${dayKey}T00:00:00.000Z`);
    const capacity = capacityByStage.get(stageCode) ?? { value: null, source: "CHUA_KHAI" as const, workCenterCode: stage.workCenterCode };
    const ratio = capacity.value && capacity.value > 0 ? worked / capacity.value : null;
    const setsCount = args.setsInCell.get(key)?.size ?? 0;
    cells.push({
      day,
      stageCode,
      stageName: stage.name,
      seq: stage.seq,
      workCenterCode: stage.workCenterCode,
      worked,
      unit: loadUnitOfStage(stage),
      capacity: capacity.value,
      capacitySource: capacity.source,
      ratio,
      tone: ratio === null ? "ok" : ratio >= 0.999 ? "bad" : ratio >= 0.9 ? "warn" : "ok",
      sets: setsCount,
    });
  }
  return cells.sort(
    (a, b) => a.day.getTime() - b.day.getTime() || a.seq - b.seq || a.stageCode.localeCompare(b.stageCode),
  );
}

// ---------------------------------------------------------------------------
// 5) TIỆN ÍCH
// ---------------------------------------------------------------------------

export function unitLabel(unit: LoadUnit): string {
  return unit === "BO" ? "bộ" : "cánh";
}

function groupBySeq<T extends { seq: number }>(rows: T[]): T[][] {
  const groups: T[][] = [];
  for (const row of rows) {
    const last = groups[groups.length - 1];
    if (last && last[0].seq === row.seq) last.push(row);
    else groups.push([row]);
  }
  return groups;
}

function minDate(a: Date, b: Date): Date {
  return a.getTime() <= b.getTime() ? a : b;
}

function maxDate(a: Date, b: Date): Date {
  return a.getTime() >= b.getTime() ? a : b;
}

/** Số NGÀY LÀM VIỆC giữa 2 mốc (tính cả 2 đầu) — an toàn với null. */
export function daysBetween(start: Date | null, end: Date | null, calendar: WorkingCalendar): number {
  if (!start || !end) return 0;
  return countWorkingDays(start, end, calendar);
}

/** Đếm số ngày làm việc trong [from, to] — bản sao nhỏ để tránh import vòng. */
function countWorkingDays(start: Date, end: Date, calendar: WorkingCalendar): number {
  const from = startOfDayUtc(start);
  const to = startOfDayUtc(end);
  if (to.getTime() < from.getTime()) return 0;
  let total = 0;
  const cursor = new Date(from);
  let guard = 0;
  while (cursor.getTime() <= to.getTime() && guard < MAX_GUARD) {
    if (calendar.workingDays.includes(cursor.getUTCDay()) && !calendar.holidays.has(dateKeyUtc(cursor))) total += 1;
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    guard += 1;
  }
  return total;
}
