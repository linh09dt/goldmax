/**
 * V148/V149 — LẬP KẾ HOẠCH CHO TỪNG CÔNG ĐOẠN **THEO NĂNG LỰC**, thứ tự do **ƯU TIÊN** quyết định.
 *
 * Nguyên tắc (nhà máy chốt 26/09/2026 — xem `KE_HOACH_THEO_CONG_DOAN_V147.md` mục 2.1):
 *   • NĂNG LỰC quyết định NGÀY: mỗi (công đoạn, ngày) chỉ nhận tối đa `capacity_per_day`.
 *     Hết chỗ → bộ trôi sang ngày làm việc kế tiếp. Bộ lớn hơn năng lực 1 ngày thì TRẢI qua
 *     nhiều ngày ⇒ số ngày công đoạn TRONG KẾ HOẠCH = ceil(tải / năng lực), KHÔNG phải lead time.
 *   • LEAD TIME **không** tham gia xếp ngày — chỉ để suy MỐC (target) và đối chiếu kịp/không kịp.
 *
 * **V149 — thứ tự xếp theo TỪNG CÔNG ĐOẠN:** mỗi công đoạn có bộ quy tắc ưu tiên riêng
 * (`priority.ts`): điểm ưu tiên + FIFO. Vì vậy thuật toán đi **theo từng công đoạn** (thay vì
 * theo từng bộ): với mỗi công đoạn, lấy các bộ ĐÃ ĐỦ ĐIỀU KIỆN, sắp theo điểm ưu tiên của
 * chính công đoạn đó, rồi lần lượt đặt vào năng lực.
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
import { snapToWorkingDay } from "@/lib/production/targets";
import type { ProductionConfig } from "@/lib/production/config";
import {
  applyGrouping,
  DEFAULT_PRIORITY_CONFIG,
  groupKeyOf,
  groupingOf,
  scoreSet,
  sortByPriorityScore,
  workshopDueOf,
  type OrderFacts,
  type PriorityConfig,
  type PriorityCriterionCode,
} from "@/lib/production/priority";

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
  const center = stage.workCenterCode ? workCenters.find((item) => item.code === stage.workCenterCode) : undefined;
  const centerCapacity = Number(center?.capacityPerDay);
  if (Number.isFinite(centerCapacity) && centerCapacity > 0) {
    return { value: Math.trunc(centerCapacity), source: "TO", workCenterCode: stage.workCenterCode };
  }
  return { value: null, source: "CHUA_KHAI", workCenterCode: stage.workCenterCode };
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
  /** V149 — điểm ưu tiên của bộ tại chính công đoạn này (càng cao càng làm trước). */
  priorityScore: number;
  /** Hạng trong lượt xếp ở công đoạn này (1 = làm trước). */
  priorityRank: number;
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
  /** V149 — công đoạn đầu tiên được xếp của bộ + điểm/hạng ưu tiên tại đó. */
  firstStageCode: string | null;
  firstStageScore: number;
  firstStageRank: number;
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
  /** V149 — quy tắc ưu tiên đã dùng cho từng công đoạn (để UI giải thích). */
  priorityUsed: Array<{
    stageCode: string;
    stageName: string;
    criteria: Array<{ code: PriorityCriterionCode; weight: number }>;
    /** V149.1 — chỉ tiêu GOM NHÓM đang áp dụng (mã đơn hàng / màu sơn / model). */
    grouping: { code: string; label: string; tolerance: number; direction: string } | null;
  }>;
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
  /** "Hôm nay" theo giờ VN — dùng cho các chỉ tiêu phụ thuộc thời gian. */
  today?: Date;
  /** V149 — cấu hình thứ tự ưu tiên (mặc định: bộ chuẩn của nhà máy). */
  priority?: PriorityConfig;
  /** Cột thật của `sales_orders` theo `order_id` — cho các chỉ tiêu mức đơn. */
  orders?: Map<number, OrderFacts>;
  /** Chỉ xếp các bộ này (mặc định: mọi bộ trong `sets`). */
  setIds?: number[];
};

/** Trạng thái bộ còn được lập kế hoạch (bỏ bộ đã xong / đã giao / đã huỷ / tạm dừng). */
export const PLANNABLE_SET_STATUSES = ["CHO_XEP_LICH", "DA_XEP_LICH", "DANG_SX"] as const;

const MAX_GUARD = 5000;

/**
 * Xếp kế hoạch tiến (forward) cho TỪNG CÔNG ĐOẠN theo năng lực, thứ tự theo ƯU TIÊN của
 * chính công đoạn đó (V149).
 */
export function buildStagePlan(options: BuildStagePlanOptions): StagePlanResult {
  const { calendar } = options;
  const from = snapToWorkingDay(options.from, calendar);
  const to = startOfDayUtc(options.to);
  const today = startOfDayUtc(options.today ?? options.from);
  const priority = options.priority ?? DEFAULT_PRIORITY_CONFIG;
  const overlap = Math.max(0, Math.trunc(Number(options.config.overlapDaysPerStep) || 0));

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
  const candidateIds = new Set(candidateSets.map((set) => set.id));
  const setById = new Map(candidateSets.map((set) => [set.id, set]));

  // ---- trạng thái chạy ----
  /** taskId → ngày đã chốt (đã xong từ trước, hoặc vừa xếp). */
  const placed = new Map<number, { start: Date | null; end: Date | null }>();
  const used = new Map<string, number>(); // `${stageCode}|${YYYY-MM-DD}` → tải đã xếp
  const setsInCell = new Map<string, Set<number>>();
  const rankOf = new Map<number, number>(); // setId → hạng FIFO trong lượt
  const firstStageOf = new Map<number, { code: string; score: number; rank: number }>();
  const setFirstDay = new Map<number, Date>();
  const setLastDay = new Map<number, Date>();
  const tasksPlannedBySet = new Map<number, number>();
  const centersOfSet = new Map<number, Set<string>>();
  let rankCounter = 0;

  const warnings: StagePlanWarning[] = [];
  const warnedCapacity = new Set<string>();
  const entries: StagePlanTaskEntry[] = [];

  const loadKey = (stageCode: string, day: Date) => `${stageCode}|${dateKeyUtc(day)}`;
  const usedIn = (stageCode: string, day: Date) => used.get(loadKey(stageCode, day)) ?? 0;

  const scoreContextBase = {
    today,
    calendar,
    config: priority,
    orders: options.orders,
    rankOf,
    totalSets: candidateSets.length,
    deliveryBufferDays: Number(options.config.deliveryBufferDays) || 0,
  };

  // ---- BƯỚC 0: chốt sẵn công đoạn ĐÃ XONG (không chiếm năng lực, nhưng dùng để tính "sẵn sàng") ----
  for (const task of options.tasks) {
    if (!candidateIds.has(task.setId)) continue;
    if (task.status !== "XONG" && task.status !== "BO_QUA") continue;
    const stage = stageByCode.get(task.stageCode);
    if (!stage || !stage.active) continue;
    const demand = setById.get(task.setId) ? demandOfTask(setById.get(task.setId)!, stage) : 0;
    const unit = loadUnitOfStage(stage);

    if (task.status === "BO_QUA") {
      entries.push({
        taskId: task.id,
        setId: task.setId,
        stageCode: task.stageCode,
        seq: task.seq,
        scope: task.scope as TaskScope,
        workCenterCode: stage.workCenterCode,
        state: "BO_QUA",
        start: null,
        end: null,
        days: 0,
        demand,
        unit,
        capacity: null,
        capacitySource: "CHUA_KHAI",
        priorityScore: 0,
        priorityRank: 0,
      });
      continue;
    }

    const end = task.actualEnd ?? task.plannedEnd ?? task.plannedStart ?? null;
    const start = task.plannedStart ?? task.actualStart ?? end;
    placed.set(task.id, { start, end });
    if (end) {
      setFirstDay.set(task.setId, minDefined(setFirstDay.get(task.setId), start ?? end) ?? (start ?? end));
      setLastDay.set(task.setId, maxDefined(setLastDay.get(task.setId), end) ?? end);
    }
    entries.push({
      taskId: task.id,
      setId: task.setId,
      stageCode: task.stageCode,
      seq: task.seq,
      scope: task.scope as TaskScope,
      workCenterCode: stage.workCenterCode ?? task.workCenterCode ?? null,
      state: "GIU_NGUYEN",
      start,
      end,
      days: daysBetween(start, end, calendar),
      demand,
      unit,
      capacity: null,
      capacitySource: "TO",
      priorityScore: 0,
      priorityRank: 0,
    });
  }

  // ---- BƯỚC 1: đi THEO TỪNG CÔNG ĐOẠN (theo `seq`) ----
  const stageOrder = options.stages
    .filter((stage) => stage.active)
    .slice()
    .sort((a, b) => a.seq - b.seq || a.code.localeCompare(b.code));

  const priorityUsed: StagePlanResult["priorityUsed"] = [];

  for (const stage of stageOrder) {
    const rule = priority.stageRules[stage.code] ?? priority.defaultRule;
    const grouping = groupingOf(rule);
    priorityUsed.push({
      stageCode: stage.code,
      stageName: stage.name,
      criteria: rule.criteria
        .filter((item) => item.weight > 0)
        .map((item) => ({ code: item.code, weight: item.weight })),
      grouping: grouping ? { code: grouping.code, label: grouping.label, tolerance: grouping.tolerance, direction: grouping.direction } : null,
    });

    // Các task của công đoạn này cần xếp (bỏ XONG / BO_QUA).
    const work: Array<{ set: ProductionSetRow; task: ProductionTaskRow; score: number }> = [];
    for (const [setId, tasks] of tasksBySet) {
      const set = setById.get(setId);
      if (!set) continue;
      for (const task of tasks) {
        if (task.stageCode !== stage.code) continue;
        if (task.status === "XONG" || task.status === "BO_QUA") continue;
        work.push({ set, task, score: scoreSet(set, stage.code, scoreContextBase).score });
      }
    }
    if (!work.length) continue;

    const byScore = sortByPriorityScore(
      work,
      (item) => item.score,
      (item) => startOfDayUtc(item.set.createdAt).getTime() || item.set.id,
    );
    // V149.1 — gom nhóm (mã đơn hàng / màu sơn / model) sau khi đã sắp theo điểm.
    const ordered = grouping
      ? applyGrouping(byScore, grouping, {
          keyOf: (item) => groupKeyOf(grouping.code, item.set),
          scoreOf: (item) => item.score,
        })
      : byScore;

    let stageRank = 0;
    for (const item of ordered) {
      const { set, task } = item;
      const unit = loadUnitOfStage(stage);
      const demand = demandOfTask(set, stage);
      // Tổ hiện tại của CÔNG ĐOẠN thắng ảnh chụp trên task (danh mục có thể đã đổi tổ).
      const center = stage.workCenterCode ?? task.workCenterCode ?? null;
      const capacity = capacityOfStage({ capacityPerDay: stage.capacityPerDay, workCenterCode: center }, options.workCenters);
      if (center) {
        const bucket = centersOfSet.get(set.id) ?? new Set<string>();
        bucket.add(center);
        centersOfSet.set(set.id, bucket);
      }

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
        priorityScore: item.score,
        priorityRank: stageRank + 1,
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

      if (task.status === "BO_QUA") continue;

      const ready = readyDayFor({ set, task, stage, placed, calendar, from, overlap, tasksBySet });
      const placedResult = allocate({
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

      if (!placedResult) {
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
          message: `Bộ ${set.setNo ?? set.id} cần ${demand} ${unitLabel(unit)} ở ${stage.name} > năng lực ${capacity.value} ${unitLabel(unit)}/ngày → trải ${placedResult.days} ngày.`,
        });
      }

      placed.set(task.id, { start: placedResult.start, end: placedResult.end });
      setFirstDay.set(set.id, minDefined(setFirstDay.get(set.id), placedResult.start) ?? placedResult.start);
      setLastDay.set(set.id, maxDefined(setLastDay.get(set.id), placedResult.end) ?? placedResult.end);
      tasksPlannedBySet.set(set.id, (tasksPlannedBySet.get(set.id) ?? 0) + 1);
      stageRank += 1;

      if (!rankOf.has(set.id)) {
        rankCounter += 1;
        rankOf.set(set.id, rankCounter);
      }
      if (!firstStageOf.has(set.id)) {
        firstStageOf.set(set.id, {
          code: stage.code,
          score: item.score,
          rank: rankOf.get(set.id) ?? 0,
        });
      }

      entries.push({
        ...base,
        state: "XEP",
        start: placedResult.start,
        end: placedResult.end,
        days: placedResult.days,
        priorityRank: stageRank,
      });
    }
  }

  // ---- BƯỚC 2: tổng hợp theo bộ ----
  const summaries: StagePlanSetSummary[] = [];
  for (const set of candidateSets) {
    const setTasks = (tasksBySet.get(set.id) ?? []).filter((task) => {
      const stage = stageByCode.get(task.stageCode);
      return Boolean(stage) && stage!.active;
    });
    if (!setTasks.length) continue;

    let targetEnd: Date | null = null;
    for (const task of setTasks) {
      if (task.status === "BO_QUA") continue;
      if (task.targetEnd) targetEnd = maxDefined(targetEnd, task.targetEnd) ?? task.targetEnd;
    }
    const plannedStart = setFirstDay.get(set.id) ?? null;
    const plannedEnd = setLastDay.get(set.id) ?? null;
    const due = set.dueDate ? startOfDayUtc(set.dueDate) : null;
    const workshopDue = workshopDueOf(due, Number(options.config.deliveryBufferDays) || 0, calendar);
    const first = firstStageOf.get(set.id);

    summaries.push({
      setId: set.id,
      setNo: set.setNo,
      orderCode: set.orderCode,
      customerName: set.customerName,
      paintColor: set.paintColor,
      dueDate: set.dueDate,
      plannedStart,
      plannedEnd,
      canh: canhEquivalentOf(set),
      tasksPlanned: tasksPlannedBySet.get(set.id) ?? 0,
      tasksTotal: setTasks.length,
      targetEnd,
      lateVsTarget: Boolean(plannedEnd && targetEnd && plannedEnd.getTime() > targetEnd.getTime()),
      workshopDue,
      lateVsDue: Boolean(plannedEnd && workshopDue && plannedEnd.getTime() > workshopDue.getTime()),
      workCenterCodes: Array.from(centersOfSet.get(set.id) ?? []),
      firstStageCode: first?.code ?? null,
      firstStageScore: first?.score ?? 0,
      firstStageRank: first?.rank ?? 0,
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

  return { tasks: entries, loads, warnings, sets: summaries, stats, priorityUsed };
}

// ---------------------------------------------------------------------------
// 5) SẴN SÀNG (điều kiện bắt đầu của một công đoạn)
// ---------------------------------------------------------------------------

type ReadyArgs = {
  set: ProductionSetRow;
  task: ProductionTaskRow;
  stage: ProductionStageRow;
  placed: Map<number, { start: Date | null; end: Date | null }>;
  calendar: WorkingCalendar;
  from: Date;
  overlap: number;
  tasksBySet: Map<number, ProductionTaskRow[]>;
};

/**
 * Ngày sớm nhất công đoạn này được bắt đầu:
 *   = ngày xong của các công đoạn trong `requires_stage` + 1 ngày làm việc − gối công đoạn.
 * Quy tắc phạm vi giống `taskUnlockState`: nếu công đoạn đang xét thuộc một phần (CÁNH/KHUNG/PHAO)
 * và công đoạn bắt buộc cũng có phần đó → chỉ cần phần đó xong (vd Ép cánh ← Hàn **cánh**).
 */
export function readyDayFor(args: ReadyArgs): Date {
  const base = snapToWorkingDay(maxDate(args.from, args.set.startedAt ?? args.from), args.calendar);
  const requiredCodes = String(args.stage.requiresStage ?? "")
    .split(",")
    .map((code) => code.trim())
    .filter(Boolean);
  if (!requiredCodes.length) return base;

  const setTasks = args.tasksBySet.get(args.set.id) ?? [];
  const sameScope = setTasks.filter((item) => requiredCodes.includes(item.stageCode) && item.scope === args.task.scope);
  const pool = sameScope.length ? sameScope : setTasks.filter((item) => requiredCodes.includes(item.stageCode));

  const done = pool
    .map((item) => args.placed.get(item.id))
    .filter((value): value is { start: Date | null; end: Date | null } => Boolean(value?.end));
  if (!done.length) return base;

  const lastEnd = done.reduce((max, value) => (value.end!.getTime() > max.getTime() ? value.end! : max), done[0].end!);
  const prevStart = done.reduce(
    (min, value) => (value.start && value.start.getTime() < min.getTime() ? value.start : min),
    (done[0].start ?? done[0].end)!,
  );

  const next = addWorkingDays(lastEnd, 1, args.calendar);
  const candidate = args.overlap > 0 ? subtractWorkingDays(next, args.overlap, args.calendar) : next;
  const floor = maxDate(base, prevStart);
  return snapToWorkingDay(candidate.getTime() < floor.getTime() ? floor : candidate, args.calendar);
}

// ---------------------------------------------------------------------------
// 6) ĐẶT TẢI VÀO NGÀY
// ---------------------------------------------------------------------------

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
    const capacity =
      capacityByStage.get(stageCode) ?? { value: null, source: "CHUA_KHAI" as const, workCenterCode: stage.workCenterCode };
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
// 7) TIỆN ÍCH
// ---------------------------------------------------------------------------

export function unitLabel(unit: LoadUnit): string {
  return unit === "BO" ? "bộ" : "cánh";
}

function minDefined(a: Date | undefined, b: Date): Date | undefined {
  if (!a) return b;
  return a.getTime() <= b.getTime() ? a : b;
}

function maxDefined(a: Date | null | undefined, b: Date): Date | null {
  if (!a) return b;
  return a.getTime() >= b.getTime() ? a : b;
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
