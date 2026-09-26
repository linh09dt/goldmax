/**
 * V136 — Tầng truy cập dữ liệu module Lên kế hoạch sản xuất.
 *
 * Quy ước ghi DB (bài học V111): DB production là Supabase pooler, mỗi lượt round trip
 * 40–100 ms → KHÔNG ghi từng dòng. Mọi cập nhật tiến độ đi bằng:
 *   - 1 câu UPDATE ... FROM jsonb_to_recordset(...)  cho bảng `production_tasks`
 *   - 1 câu createMany                              cho bảng `production_logs`
 */

import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { ORDER_WRITE_TRANSACTION } from "@/lib/db-transaction";
import { CONFIRMED_STATUS_CODES } from "@/lib/order-form";
import {
  buildCalendar,
  parseIsoDateStrict,
  startOfDayUtc,
  subtractWorkingDays,
  workingDaysBetween,
  type WorkingCalendar,
} from "@/lib/production/calendar";

export { parseIsoDateStrict };
import {
  canhEquivalentOf,
  deriveSetStatus,
  percentDoneOf,
  STAGE,
  taskUnlockState,
  type ProductionSetRow,
  type ProductionStageRow,
  type ProductionTaskRow,
  type ProductionWorkCenterRow,
  type TaskStatus,
} from "@/lib/production/catalog";
import {
  DEFAULT_PRODUCTION_CONFIG,
  normalizeProductionConfig,
  PRODUCTION_CONFIG_SETTING_KEY,
  type ProductionConfig,
} from "@/lib/production/config";
import { buildComponentOrderDrafts, buildTaskDrafts } from "@/lib/production/routing";
import { defaultPriorityForOrderType } from "@/lib/production/scheduling";
import {
  assignWorkOrderCodes,
  resolveWorkOrderTemplate,
  workOrderCodeInputsForSet,
} from "@/lib/production/work-order";
import {
  computeStepTargets,
  targetStepsFromTasks,
  targetTotalDays,
  type StepTarget,
} from "@/lib/production/targets";

export const SET_INCLUDE_TASKS = {
  tasks: { orderBy: [{ seq: "asc" }, { scope: "asc" }] },
  componentOrders: { orderBy: { kind: "asc" } },
} satisfies Prisma.ProductionSetInclude;

/**
 * V142 — sinh dòng LỆNH SẢN XUẤT cho MỘT bộ: 1 lệnh cha → 3 lệnh con → 1 lệnh mỗi công đoạn.
 * Mã lệnh theo mẫu trong Cấu hình; lệnh công đoạn gắn `taskId` để tra cứu ngược.
 */
function buildWorkOrderRows(args: {
  setId: number;
  orderCode: string | null;
  setNo: string | null;
  tasks: Array<{ id: number; seq: number; scope: string; stageCode: string }>;
  config: ProductionConfig;
}): Prisma.ProductionWorkOrderCreateManyInput[] {
  const template = resolveWorkOrderTemplate(args.orderCode, args.config.workOrderCodeTemplate);
  const inputs = workOrderCodeInputsForSet({
    setId: args.setId,
    orderCode: args.orderCode,
    setNo: args.setNo,
    tasks: args.tasks,
  });
  const codes = assignWorkOrderCodes(inputs, template);

  const rows: Prisma.ProductionWorkOrderCreateManyInput[] = inputs.map((input, index) => ({
    code: codes[index],
    setId: args.setId,
    taskId: null,
    kind: input.kind,
    stageCode: input.kind === "CONG_DOAN" ? input.stageCode ?? null : null,
    scope: input.kind === "CONG_DOAN" ? input.scope ?? null : null,
    seq: input.kind === "CONG_DOAN" ? input.seq ?? null : null,
  }));

  // Gắn taskId: các lệnh công đoạn đi đúng thứ tự `tasks` truyền vào.
  let taskIndex = 0;
  for (const row of rows) {
    if (row.kind !== "CONG_DOAN") continue;
    row.taskId = args.tasks[taskIndex]?.id ?? null;
    taskIndex += 1;
  }
  return rows;
}

// ---------------------------------------------------------------------------
// Cấu hình & danh mục
// ---------------------------------------------------------------------------

export async function readProductionConfig(): Promise<ProductionConfig> {
  const setting = await prisma.systemSetting.findUnique({
    where: { key: PRODUCTION_CONFIG_SETTING_KEY },
    select: { value: true },
  });
  if (!setting?.value) return { ...DEFAULT_PRODUCTION_CONFIG, workingDays: [...DEFAULT_PRODUCTION_CONFIG.workingDays] };
  try {
    return normalizeProductionConfig(JSON.parse(setting.value));
  } catch {
    return { ...DEFAULT_PRODUCTION_CONFIG, workingDays: [...DEFAULT_PRODUCTION_CONFIG.workingDays] };
  }
}

export async function saveProductionConfig(config: ProductionConfig): Promise<ProductionConfig> {
  const normalized = normalizeProductionConfig(config);
  await prisma.systemSetting.upsert({
    where: { key: PRODUCTION_CONFIG_SETTING_KEY },
    create: { key: PRODUCTION_CONFIG_SETTING_KEY, value: JSON.stringify(normalized) },
    update: { value: JSON.stringify(normalized) },
  });
  return normalized;
}

export async function loadWorkCenters(): Promise<ProductionWorkCenterRow[]> {
  return prisma.productionWorkCenter.findMany({ orderBy: [{ sortOrder: "asc" }, { code: "asc" }] });
}

export async function loadActiveWorkCenters(): Promise<ProductionWorkCenterRow[]> {
  return prisma.productionWorkCenter.findMany({ where: { active: true }, orderBy: [{ sortOrder: "asc" }, { code: "asc" }] });
}

export async function loadStages(): Promise<ProductionStageRow[]> {
  return prisma.productionStage.findMany({ orderBy: [{ seq: "asc" }, { code: "asc" }] });
}

export async function loadActiveStages(): Promise<ProductionStageRow[]> {
  return prisma.productionStage.findMany({ where: { active: true }, orderBy: [{ seq: "asc" }, { code: "asc" }] });
}

export async function loadReasons() {
  return prisma.productionReason.findMany({ orderBy: [{ group: "asc" }, { sortOrder: "asc" }] });
}

/** Model đã có chương trình máy cắt (Bồi Lares tái dùng — V121). */
export async function loadProgramModels(): Promise<Set<string>> {
  const rows = await prisma.productionProgram.findMany({ select: { model: true } });
  return new Set(rows.map((row) => String(row.model ?? "").trim().toUpperCase()).filter(Boolean));
}

/** Lịch làm việc: ngày trong tuần theo cấu hình + các ngày nghỉ/lễ trong bảng production_calendar. */
export async function loadCalendar(config?: ProductionConfig): Promise<WorkingCalendar> {
  const effective = config ?? (await readProductionConfig());
  const holidays = await prisma.productionCalendar.findMany({
    where: { isWorkingDay: false },
    select: { date: true },
  });
  return buildCalendar(effective, holidays.map((row) => row.date));
}

// ---------------------------------------------------------------------------
// Nạp bộ cửa từ đơn hàng vào kế hoạch
// ---------------------------------------------------------------------------

export type SyncResult = { createdSets: number; createdTasks: number; skipped: number };

/**
 * Tạo `production_sets` + `production_tasks` cho các bộ cửa của đơn ĐÃ XÁC NHẬN
 * mà chưa có trong kế hoạch. Idempotent: bộ đã có thì bỏ qua.
 */
export async function syncProductionSets(options: {
  orderItemIds?: number[];
  orderIds?: number[];
  limit?: number;
} = {}): Promise<SyncResult> {
  const config = await readProductionConfig();
  const stages = await loadActiveStages();
  const programModels = await loadProgramModels();

  const orderItems = await prisma.salesOrderItem.findMany({
    where: {
      ...(options.orderItemIds?.length ? { id: { in: options.orderItemIds } } : {}),
      ...(options.orderIds?.length ? { orderId: { in: options.orderIds } } : {}),
      order: {
        status: { in: CONFIRMED_STATUS_CODES },
        orderType: { in: config.entryOrderTypes },
      },
    },
    select: {
      id: true,
      orderId: true,
      setNo: true,
      model: true,
      productName: true,
      openingDirection: true,
      paintColor: true,
      heightMm: true,
      widthMm: true,
      leavesPerSet: true,
      trimBarsPerSet: true,
      quantity: true,
      pricingQuantity: true,
      order: { select: { orderCode: true, orderType: true, customerName: true, requiredDeliveryDate: true } },
    },
    orderBy: [{ id: "asc" }],
    take: options.limit && options.limit > 0 ? options.limit : undefined,
  });
  if (!orderItems.length) return { createdSets: 0, createdTasks: 0, skipped: 0 };

  const existing = await prisma.productionSet.findMany({
    where: {
      OR: [
        { orderItemId: { in: orderItems.map((item) => item.id) } },
        { orderId: { in: Array.from(new Set(orderItems.map((item) => item.orderId))) } },
      ],
    },
    select: { orderItemId: true, orderId: true, setNo: true },
  });
  // Chống trùng theo 2 cách: theo id dòng hàng, VÀ theo (mã đơn + Bộ số).
  // Cách thứ 2 cần thiết vì khi SỬA ĐƠN, route cập nhật XOÁ dòng hàng cũ rồi tạo lại
  // (id mới) → nếu chỉ so id thì bộ sẽ bị đưa vào kế hoạch lần thứ hai.
  const plannedItemIds = new Set(existing.map((row) => row.orderItemId).filter((value): value is number => value !== null));
  const plannedOrderSetNo = new Set(
    existing
      .filter((row) => String(row.setNo ?? "").trim())
      .map((row) => `${row.orderId}|${String(row.setNo).trim().toUpperCase()}`),
  );
  // Trong CÙNG một lượt đưa vào kế hoạch: 2 dòng hàng cùng đơn + cùng Bộ số là dữ liệu lỗi.
  // Chỉ lấy dòng ĐẦU — nếu lấy cả hai thì 2 bộ sẽ trùng mã lệnh và cả transaction bị huỷ (V142).
  const seenOrderSetNo = new Set<string>();
  const pending = orderItems.filter((item) => {
    if (plannedItemIds.has(item.id)) return false;
    const setNo = String(item.setNo ?? "").trim().toUpperCase();
    if (setNo && plannedOrderSetNo.has(`${item.orderId}|${setNo}`)) return false;
    if (setNo && seenOrderSetNo.has(`${item.orderId}|${setNo}`)) return false;
    if (setNo) seenOrderSetNo.add(`${item.orderId}|${setNo}`);
    return true;
  });
  if (!pending.length) return { createdSets: 0, createdTasks: 0, skipped: orderItems.length };

  return prisma.$transaction(async (tx) => {
    const createdSets = await tx.productionSet.createManyAndReturn({
      data: pending.map((item) => {
        const leaves = item.leavesPerSet ?? null;
        const quantity = item.quantity ?? null;
        return {
          orderId: item.orderId,
          orderItemId: item.id,
          orderCode: item.order?.orderCode ?? null,
          setNo: item.setNo ?? null,
          orderType: item.order?.orderType ?? "SAN_XUAT",
          customerName: item.order?.customerName ?? null,
          productName: item.productName ?? null,
          model: item.model ?? null,
          openingDirection: item.openingDirection ?? null,
          paintColor: item.paintColor ?? null,
          heightMm: item.heightMm ?? null,
          widthMm: item.widthMm ?? null,
          leavesPerSet: leaves,
          trimBarsPerSet: item.trimBarsPerSet ?? null,
          quantity,
          pricingQuantity: item.pricingQuantity ?? null,
          canhEquivalent: canhEquivalentOf({ leavesPerSet: leaves, quantity }),
          dueDate: item.order?.requiredDeliveryDate ?? null,
          priority: defaultPriorityForOrderType(item.order?.orderType),
          status: "CHO_XEP_LICH",
        };
      }),
      select: { id: true, orderItemId: true },
    });

    // Sinh công đoạn cho từng bộ — mỗi BẢNG một lượt ghi (bài học V111).
    const setByOrderItem = new Map(createdSets.map((row) => [row.orderItemId, row.id]));
    // Mã đơn / bộ số của từng bộ vừa tạo — dùng để sinh mã lệnh.
    const setMetaById = new Map<number, { orderCode: string | null; setNo: string | null }>();
    for (const item of pending) {
      const setId = setByOrderItem.get(item.id);
      if (!setId) continue;
      setMetaById.set(setId, { orderCode: item.order?.orderCode ?? null, setNo: item.setNo ?? null });
    }
    const taskRows: Prisma.ProductionTaskCreateManyInput[] = [];
    const componentRows: Prisma.ProductionComponentOrderCreateManyInput[] = [];
    for (const item of pending) {
      const setId = setByOrderItem.get(item.id);
      if (!setId) continue;
      const setRow = {
        leavesPerSet: item.leavesPerSet ?? null,
        quantity: item.quantity ?? null,
        trimBarsPerSet: item.trimBarsPerSet ?? null,
        productName: item.productName ?? null,
        paintColor: item.paintColor ?? null,
        veneerCode: null,
        model: item.model ?? null,
      } as ProductionSetRow;

      // LỆNH CON: đúng 3 lệnh — CÁNH / KHUNG / PHÀO.
      for (const draft of buildComponentOrderDrafts(setRow, config)) {
        componentRows.push({ setId, kind: draft.kind, qtyExpected: draft.qtyExpected });
      }

      const drafts = buildTaskDrafts({
        set: setRow,
        stages,
        config,
        modelHasProgram: programModels.has(String(item.model ?? "").trim().toUpperCase()),
      });
      for (const draft of drafts) {
        taskRows.push({
          setId,
          orderItemId: item.id,
          stageCode: draft.stageCode,
          stageKind: draft.stageKind,
          scope: draft.scope,
          seq: draft.seq,
          workCenterCode: draft.workCenterCode,
          status: draft.status,
          qtyExpected: draft.qtyExpected,
        });
      }
    }
    if (componentRows.length) {
      await tx.productionComponentOrder.createMany({ data: componentRows });
    }

    // LỆNH SẢN XUẤT (V142): 1 lệnh cha + 3 lệnh con + 1 lệnh mỗi công đoạn — vẫn 1 lượt ghi.
    // Lệnh cha/3 lệnh con có NGAY cả khi bộ chưa có công đoạn nào (danh mục công đoạn trống).
    const tasksBySet = new Map<number, Array<{ id: number; seq: number; scope: string; stageCode: string }>>();
    if (taskRows.length) {
      const createdTasks = await tx.productionTask.createManyAndReturn({
        data: taskRows,
        select: { id: true, setId: true, seq: true, scope: true, stageCode: true },
      });
      for (const task of createdTasks) {
        const list = tasksBySet.get(task.setId) ?? [];
        list.push({ id: task.id, seq: task.seq, scope: task.scope, stageCode: task.stageCode });
        tasksBySet.set(task.setId, list);
      }
    }
    const workOrderRows: Prisma.ProductionWorkOrderCreateManyInput[] = [];
    for (const created of createdSets) {
      const meta = setMetaById.get(created.id);
      // Sắp theo (bước, bộ phận) để mã lệnh ổn định dù DB trả về thứ tự nào.
      const tasks = (tasksBySet.get(created.id) ?? []).sort(
        (a, b) => a.seq - b.seq || a.scope.localeCompare(b.scope) || a.id - b.id,
      );
      workOrderRows.push(
        ...buildWorkOrderRows({
          setId: created.id,
          orderCode: meta?.orderCode ?? null,
          setNo: meta?.setNo ?? null,
          tasks,
          config,
        }),
      );
    }
    if (workOrderRows.length) {
      await tx.productionWorkOrder.createMany({ data: workOrderRows });
    }

    return { createdSets: createdSets.length, createdTasks: taskRows.length, skipped: orderItems.length - pending.length };
  }, ORDER_WRITE_TRANSACTION);
}

/** Sinh lại công đoạn cho MỘT bộ đã có (dùng khi danh mục công đoạn thay đổi). */
export async function rebuildTasksForSet(setId: number): Promise<{ createdTasks: number; createdWorkOrders: number }> {
  const config = await readProductionConfig();
  const stages = await loadActiveStages();
  const programModels = await loadProgramModels();
  const set = await prisma.productionSet.findUnique({
    where: { id: setId },
    include: { componentOrders: true },
  });
  if (!set) throw new Error("Không tìm thấy bộ cửa.");
  if (set.startedAt) {
    throw new Error("Bộ đã vào sản xuất — không sinh lại công đoạn (sẽ mất tiến độ và mốc sản xuất).");
  }

  const drafts = buildTaskDrafts({
    set: set as ProductionSetRow,
    stages,
    config,
    modelHasProgram: programModels.has(String(set.model ?? "").trim().toUpperCase()),
  });

  return prisma.$transaction(async (tx) => {
    // Lệnh sản xuất sinh lại theo công đoạn mới → xoá hết lệnh cũ của bộ (lệnh công đoạn
    // còn bị xoá theo khoá ngoại khi xoá công đoạn, nhưng lệnh cha/con thì không).
    await tx.productionWorkOrder.deleteMany({ where: { setId } });
    await tx.productionTask.deleteMany({ where: { setId } });
    await tx.productionComponentOrder.deleteMany({ where: { setId } });
    await tx.productionComponentOrder.createMany({
      data: buildComponentOrderDrafts(set as ProductionSetRow, config).map((draft) => ({
        setId,
        kind: draft.kind,
        qtyExpected: draft.qtyExpected,
      })),
    });
    if (!drafts.length) {
      // Vẫn phải có lệnh cha + 3 lệnh con cho bộ (danh mục công đoạn đang trống).
      const emptyRows = buildWorkOrderRows({
        setId,
        orderCode: set.orderCode ?? null,
        setNo: set.setNo ?? null,
        tasks: [],
        config,
      });
      if (emptyRows.length) await tx.productionWorkOrder.createMany({ data: emptyRows });
      return { createdTasks: 0, createdWorkOrders: emptyRows.length };
    }
    const createdTasks = await tx.productionTask.createManyAndReturn({
      data: drafts.map((draft) => ({
        setId,
        orderItemId: set.orderItemId,
        stageCode: draft.stageCode,
        stageKind: draft.stageKind,
        scope: draft.scope,
        seq: draft.seq,
        workCenterCode: draft.workCenterCode,
        status: draft.status,
        qtyExpected: draft.qtyExpected,
      })),
      select: { id: true, seq: true, scope: true, stageCode: true },
    });
    const tasks = createdTasks
      .map((task) => ({ id: task.id, seq: task.seq, scope: task.scope, stageCode: task.stageCode }))
      .sort((a, b) => a.seq - b.seq || a.scope.localeCompare(b.scope) || a.id - b.id);
    const workOrderRows = buildWorkOrderRows({
      setId,
      orderCode: set.orderCode ?? null,
      setNo: set.setNo ?? null,
      tasks,
      config,
    });
    if (workOrderRows.length) {
      await tx.productionWorkOrder.createMany({ data: workOrderRows });
    }
    return { createdTasks: drafts.length, createdWorkOrders: workOrderRows.length };
  }, ORDER_WRITE_TRANSACTION);
}

// ---------------------------------------------------------------------------
// V144 — ĐƯA VÀO SẢN XUẤT: nhập MỘT mốc ngày bắt đầu → tự suy target của mọi công đoạn
// ---------------------------------------------------------------------------

const isoDateOnly = (value: Date): string => value.toISOString().slice(0, 10);

export type StartPlanStep = {
  seq: number;
  codes: string[];
  /** SỐ NGÀY của bước (V145) */
  days: number;
  start: string;
  end: string;
};

export type StartPreview = {
  /** ngày bắt đầu thực tế (đã dời sang ngày làm việc nếu rơi vào Chủ nhật/ngày lễ) */
  start: Date;
  requestedStart: Date;
  movedToWorkingDay: boolean;
  /** ngày xong dự kiến của cả bộ */
  end: Date;
  totalDays: number;
  steps: StartPlanStep[];
  /** hạn xưởng phải xong = hạn giao khách − đệm vận chuyển */
  workshopDue: Date | null;
  /** số ngày làm việc KHÔNG KỊP (null = kịp hoặc không có hạn giao) */
  lateDays: number | null;
};

/** Tính trước kế hoạch (không ghi DB) để người dùng xem rồi mới bấm "Đưa vào sản xuất". */
export async function previewSetStart(setId: number, requestedStart: Date): Promise<StartPreview | null> {
  const [config, stages, set] = await Promise.all([
    readProductionConfig(),
    loadActiveStages(),
    prisma.productionSet.findUnique({ where: { id: setId }, include: { tasks: true } }),
  ]);
  if (!set) return null;
  const stageByCode = new Map(stages.map((stage) => [stage.code, stage]));
  const steps = targetStepsFromTasks(set.tasks, stageByCode);
  if (!steps.length) return null;
  const calendar = await loadCalendar(config);
  return buildStartPreview({ requestedStart, steps, config, calendar, dueDate: set.dueDate });
}

function buildStartPreview(args: {
  requestedStart: Date;
  steps: Parameters<typeof computeStepTargets>[0]["steps"];
  config: ProductionConfig;
  calendar: WorkingCalendar;
  dueDate: Date | null;
}): StartPreview {
  const targets: StepTarget[] = computeStepTargets({
    start: args.requestedStart,
    steps: args.steps,
    config: args.config,
    calendar: args.calendar,
  });
  const start = targets[0].start;
  const end = targets[targets.length - 1].end;
  const workshopDue = args.dueDate
    ? startOfDayUtc(subtractWorkingDays(args.dueDate, args.config.deliveryBufferDays, args.calendar))
    : null;
  const lateDays =
    workshopDue && end.getTime() > workshopDue.getTime()
      ? Math.max(0, workingDaysBetween(workshopDue, end, args.calendar))
      : null;
  return {
    start,
    requestedStart: startOfDayUtc(args.requestedStart),
    movedToWorkingDay: startOfDayUtc(args.requestedStart).getTime() !== start.getTime(),
    end,
    totalDays: targetTotalDays(targets, args.calendar),
    steps: targets.map((step) => ({
      seq: step.seq,
      codes: step.codes,
      days: step.days,
      start: isoDateOnly(step.start),
      end: isoDateOnly(step.end),
    })),
    workshopDue,
    lateDays,
  };
}

/**
 * ĐƯA BỘ VÀO SẢN XUẤT: lưu mốc bắt đầu, tự suy target cho MỌI công đoạn,
 * chuyển bộ sang DANG_SX và công đoạn đầu tiên sang DANG_LAM. Ghi gộp 1 lượt (bài học V111).
 */
export async function startProductionForSet(
  setId: number,
  requestedStart: Date,
  byName: string | null = null,
): Promise<{ start: Date; end: Date; totalDays: number; tasks: number; startedSeq: number }> {
  const [config, stages, set] = await Promise.all([
    readProductionConfig(),
    loadActiveStages(),
    prisma.productionSet.findUnique({ where: { id: setId }, include: { tasks: true } }),
  ]);
  if (!set) throw new Error("Không tìm thấy bộ cửa.");
  if (set.status === "HUY") throw new Error("Bộ đã huỷ — không đưa vào sản xuất được.");
  if (set.startedAt) throw new Error("Bộ đã vào sản xuất (đã có ngày bắt đầu sản xuất).");
  if (set.status === "DANG_SX" || set.status === "HOAN_THANH" || set.status === "DA_GIAO") {
    throw new Error("Bộ đã vào sản xuất rồi.");
  }
  const stageByCode = new Map(stages.map((stage) => [stage.code, stage]));
  const steps = targetStepsFromTasks(set.tasks, stageByCode);
  if (!steps.length) throw new Error("Bộ chưa có công đoạn nào để sản xuất.");

  const calendar = await loadCalendar(config);
  const preview = buildStartPreview({ requestedStart, steps, config, calendar, dueDate: set.dueDate });
  const targetBySeq = new Map(preview.steps.map((step) => [step.seq, step]));
  const records = set.tasks.map((task) => {
    const target = targetBySeq.get(task.seq);
    return {
      id: task.id,
      target_start: target ? target.start : null,
      target_end: target ? target.end : null,
    };
  });
  const firstSeq = steps[0].seq;

  return prisma.$transaction(async (tx) => {
    const updated = await tx.$executeRaw`
      UPDATE production_tasks AS t
      SET target_start = v.target_start::date,
          target_end   = v.target_end::date,
          updated_at   = now()
      FROM jsonb_to_recordset(${JSON.stringify(records)}::jsonb) AS v(id int, target_start text, target_end text)
      WHERE t.id = v.id AND t.set_id = ${setId}`;
    // Ghi thiếu dòng nào là lỗi thật (không được im lặng báo thành công).
    if (Number(updated) !== records.length) {
      throw new Error(`Chỉ ghi được mốc cho ${Number(updated)}/${records.length} công đoạn — đã huỷ, không đưa vào sản xuất.`);
    }
    // WIP ở CÔNG ĐOẠN ĐẦU TIÊN
    await tx.productionTask.updateMany({
      where: { setId, seq: firstSeq, status: "CHUA_LAM" },
      data: { status: "DANG_LAM" },
    });
    await tx.productionSet.update({
      where: { id: setId },
      data: { startedAt: preview.start, targetEnd: preview.end, status: "DANG_SX" },
    });
    await tx.productionLog.create({
      data: {
        entity: "SET",
        entityId: setId,
        action: "BAT_DAU_SAN_XUAT",
        field: "started_at",
        oldValue: null,
        newValue: isoDateOnly(preview.start),
        byName,
      },
    });
    return {
      start: preview.start,
      end: preview.end,
      totalDays: preview.totalDays,
      tasks: Number(updated),
      startedSeq: firstSeq,
    };
  }, ORDER_WRITE_TRANSACTION);
}

// ---------------------------------------------------------------------------
// Đọc bảng kế hoạch
// ---------------------------------------------------------------------------

export type ProductionBoard = {
  sets: ProductionSetRow[];
  tasks: ProductionTaskRow[];
  workCenters: ProductionWorkCenterRow[];
  stages: ProductionStageRow[];
  config: ProductionConfig;
  calendar: WorkingCalendar;
  programModels: Set<string>;
};

export async function loadProductionBoard(options: {
  from?: Date;
  to?: Date;
  includeUndated?: boolean;
  statusIn?: string[];
  includeCompletedForLoad?: boolean;
} = {}): Promise<ProductionBoard> {
  const [config, workCenters, stages, programModels] = await Promise.all([
    readProductionConfig(),
    loadActiveWorkCenters(),
    loadActiveStages(),
    loadProgramModels(),
  ]);

  const dateConditions: Array<Record<string, unknown>> = [];
  if (options.from && options.to) {
    dateConditions.push({ plannedStart: { gte: startOfDayUtc(options.from), lte: startOfDayUtc(options.to) } });
  }
  if (options.includeUndated) dateConditions.push({ plannedStart: null });

  const sets = await prisma.productionSet.findMany({
    where: {
      // V137: bộ đã HUỶ (do bị xoá khỏi đơn…) không hiện trên bảng kế hoạch.
      ...(options.statusIn?.length ? { status: { in: options.statusIn } } : { status: { not: "HUY" } }),
      ...(dateConditions.length ? { OR: dateConditions } : {}),
    },
    include: SET_INCLUDE_TASKS,
    orderBy: [{ dueDate: "asc" }, { id: "asc" }],
  });

  const tasks = await prisma.productionTask.findMany({
    where: { setId: { in: sets.map((set) => set.id) } },
    orderBy: [{ setId: "asc" }, { seq: "asc" }],
  });

  const calendar = await loadCalendar(config);
  return {
    sets: sets as unknown as ProductionSetRow[],
    tasks: tasks as unknown as ProductionTaskRow[],
    workCenters,
    stages,
    config,
    calendar,
    programModels,
  };
}

export async function loadSetDetail(setId: number) {
  const [set, config, stages, reasons, programModels] = await Promise.all([
    prisma.productionSet.findUnique({
      where: { id: setId },
      include: {
        tasks: { orderBy: [{ seq: "asc" }, { scope: "asc" }] },
        componentOrders: { orderBy: { kind: "asc" } },
        workOrders: { orderBy: { id: "asc" }, include: { task: { select: { status: true } } } },
        plan: true,
      },
    }),
    readProductionConfig(),
    loadStages(),
    loadReasons(),
    loadProgramModels(),
  ]);
  if (!set) return null;
  const calendar = await loadCalendar(config);
  const logs = await prisma.productionLog.findMany({
    where: { entity: "SET", entityId: setId },
    orderBy: { createdAt: "desc" },
    take: 30,
  });
  return { set, config, stages, reasons, calendar, logs, programModels };
}

// ---------------------------------------------------------------------------
// Cập nhật tiến độ (GHI GỘP — 2 lượt ghi cho cả bộ)
// ---------------------------------------------------------------------------

export type TaskPatch = {
  id: number;
  status?: TaskStatus;
  actualStart?: string | null;
  actualEnd?: string | null;
  /** V141 — XẾP LỊCH BẰNG TAY: ngày kế hoạch của công đoạn ("YYYY-MM-DD"). undefined = không đổi, null = xoá. */
  plannedStart?: string | null;
  note?: string | null;
  reasonCode?: string | null;
  assignee?: string | null;
  isRework?: boolean;
};

/** V137: sửa tay số lượng của lệnh con (bộ cần số phào/cánh khác công thức). */
export type ComponentPatch = { id: number; qtyExpected: number | null };

export type UpdateSetPayload = {
  tasks?: TaskPatch[];
  components?: ComponentPatch[];
  plannedStart?: string | null;
  plannedEnd?: string | null;
  note?: string | null;
  planId?: number | null;
  materialReady?: boolean;
  programReady?: boolean;
  /** Tên người cập nhật — chưa có đăng nhập nên gõ tay (V115). */
  byName?: string | null;
};

function parseDateOnly(value: string | null | undefined): Date | null {
  const text = String(value ?? "").trim();
  if (!text) return null;
  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
}

function parseTimestamp(value: string | null | undefined): string | null {
  const text = String(value ?? "").trim();
  if (!text) return null;
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

export async function updateSetProgress(setId: number, payload: UpdateSetPayload) {
  const set = await prisma.productionSet.findUnique({
    where: { id: setId },
    select: { id: true, status: true, orderItemId: true, model: true, setNo: true, orderCode: true, plannedStart: true },
  });
  if (!set) throw new Error("Không tìm thấy bộ cửa.");

  const existingTasks = await prisma.productionTask.findMany({
    where: { setId },
    select: { id: true, stageKind: true, status: true, stageCode: true, scope: true, isRework: true },
  });
  const byId = new Map(existingTasks.map((task) => [task.id, task]));
  const now = new Date().toISOString();

  const patches = (payload.tasks ?? []).filter((patch) => byId.has(patch.id));

  // --- GATE (V136.1): công đoạn chỉ được bắt đầu/kết thúc khi công đoạn bắt buộc đã XONG ---
  // Nhà máy: "nếu các công đoạn hàn được báo cáo hoàn thành, sẽ xem xét tính đủ bộ để test cơ khí"
  // và "khi nào cánh, khung, phào báo hoàn thành vân trên cùng bộ thì sẽ chuyển về vệ sinh, đóng gói".
  // Kiểm trên trạng thái SAU khi áp các thay đổi trong cùng lượt lưu (để lưu nhiều bước một lần vẫn được).
  if (patches.length) {
    const stages = await loadActiveStages();
    const stageByCode = new Map(stages.map((stage) => [stage.code, stage]));
    const effective = new Map<number, { stageCode: string; scope: string; status: string }>();
    for (const task of existingTasks) {
      effective.set(task.id, { stageCode: task.stageCode, scope: task.scope, status: task.status });
    }
    for (const patch of patches) {
      if (!patch.status) continue;
      const current = effective.get(patch.id);
      if (current) current.status = patch.status;
    }
    const effectiveRows = Array.from(effective.values());
    const blocked: string[] = [];
    for (const patch of patches) {
      if (patch.status !== "DANG_LAM" && patch.status !== "XONG") continue;
      const current = effective.get(patch.id);
      if (!current) continue;
      const state = taskUnlockState(current, effectiveRows, stageByCode);
      if (state.unlocked) continue;
      const waiting = state.waitingFor.map((code) => stageByCode.get(code)?.name ?? code).join(", ");
      blocked.push(`${stageByCode.get(current.stageCode)?.name ?? current.stageCode} (đang chờ ${waiting})`);
    }
    if (blocked.length) {
      throw new Error(
        `Chưa đủ điều kiện: ${blocked.join("; ")}. Phải báo hoàn thành công đoạn trước rồi mới báo bước sau.`,
      );
    }
  }

  const logs: Prisma.ProductionLogCreateManyInput[] = [];

  for (const patch of patches) {
    const current = byId.get(patch.id)!;
    if (patch.status !== undefined && patch.status !== current.status) {
      logs.push({
        entity: "TASK",
        entityId: patch.id,
        action: "DOI_TRANG_THAI",
        field: "status",
        oldValue: current.status,
        newValue: patch.status,
        byName: payload.byName ?? null,
      });
    }
    if (patch.isRework === true && current.isRework !== true) {
      logs.push({
        entity: "TASK",
        entityId: patch.id,
        action: "LAM_LAI",
        field: "is_rework",
        oldValue: "false",
        newValue: "true",
        byName: payload.byName ?? null,
      });
    }
  }

  const componentPatches = (payload.components ?? []).filter((patch) => Number.isInteger(patch.id));
  if (componentPatches.length) {
    const currentComponents = await prisma.productionComponentOrder.findMany({
      where: { setId, id: { in: componentPatches.map((patch) => patch.id) } },
      select: { id: true, kind: true, qtyExpected: true },
    });
    const byComponentId = new Map(currentComponents.map((row) => [row.id, row]));
    for (const patch of componentPatches) {
      const current = byComponentId.get(patch.id);
      if (!current) continue;
      const next = patch.qtyExpected === null ? null : Number(patch.qtyExpected);
      if (current.qtyExpected === next) continue;
      logs.push({
        entity: "SET",
        entityId: setId,
        action: "SUA_SO_LUONG_LENH_CON",
        field: current.kind,
        oldValue: current.qtyExpected === null ? null : String(current.qtyExpected),
        newValue: next === null ? null : String(next),
        byName: payload.byName ?? null,
      });
    }
  }

  const result = await prisma.$transaction(async (tx) => {
    if (componentPatches.length) {
      const records = componentPatches.map((patch) => ({ id: patch.id, qty: patch.qtyExpected === null ? null : Number(patch.qtyExpected) }));
      await tx.$executeRaw`
        UPDATE production_component_orders AS c
        SET qty_expected = v.qty, updated_at = now()
        FROM jsonb_to_recordset(${JSON.stringify(records)}::jsonb) AS v(id int, qty double precision)
        WHERE c.id = v.id AND c.set_id = ${setId}`;
    }

    // 1 lượt ghi cho toàn bộ công đoạn của bộ (jsonb_to_recordset — bài học V111).
    if (patches.length) {
      const records = patches.map((patch) => ({
        id: patch.id,
        status: patch.status ?? null,
        actual_start: patch.status === "DANG_LAM" || patch.status === "XONG" ? (parseTimestamp(patch.actualStart) ?? now) : parseTimestamp(patch.actualStart),
        actual_end: patch.status === "XONG" ? (parseTimestamp(patch.actualEnd) ?? now) : parseTimestamp(patch.actualEnd),
        note: patch.note ?? null,
        reason_code: patch.reasonCode ?? null,
        assignee: patch.assignee ?? null,
        is_rework: patch.isRework ?? null,
        updated_by: payload.byName ?? null,
        // V141 — gán ngày kế hoạch bằng tay cho từng công đoạn (dùng cờ has_plan để phân biệt "không đổi" với "xoá").
        planned_start: parseDateOnly(patch.plannedStart),
        has_plan: patch.plannedStart !== undefined,
      }));
      await tx.$executeRaw`
        UPDATE production_tasks AS t SET
          status      = COALESCE(v.status, t.status),
          actual_start= COALESCE(v.actual_start, t.actual_start),
          actual_end  = COALESCE(v.actual_end, t.actual_end),
          planned_start = CASE WHEN v.has_plan THEN v.planned_start::date ELSE t.planned_start END,
          planned_end   = CASE WHEN v.has_plan THEN v.planned_start::date ELSE t.planned_end END,
          note        = COALESCE(v.note, t.note),
          reason_code = COALESCE(v.reason_code, t.reason_code),
          assignee    = COALESCE(v.assignee, t.assignee),
          is_rework   = COALESCE(v.is_rework, t.is_rework),
          rework_from_stage = CASE WHEN v.is_rework IS TRUE AND t.rework_from_stage IS NULL
                                   THEN (SELECT s.rework_to_stage FROM production_stages s WHERE s.code = t.stage_code)
                                   ELSE t.rework_from_stage END,
          updated_by  = COALESCE(v.updated_by, t.updated_by),
          updated_at  = now()
        FROM jsonb_to_recordset(${JSON.stringify(records)}::jsonb) AS v(
          id int, status text, actual_start timestamptz, actual_end timestamptz,
          note text, reason_code text, assignee text, is_rework boolean, updated_by text,
          planned_start text, has_plan boolean
        )
        WHERE t.id = v.id AND t.set_id = ${setId}`;
    }

    const freshTasks = await tx.productionTask.findMany({
      where: { setId },
      select: { id: true, stageKind: true, status: true, stageCode: true },
    });

    // V141 — XẾP LỊCH BẰNG TAY: nếu lượt lưu này có gán ngày cho công đoạn mà KHÔNG nhập ngày cấp bộ,
    // thì ngày của BỘ = min/max ngày các công đoạn (để bảng tải và cột "Xếp lịch" luôn khớp).
    const touchedPlan = patches.some((patch) => patch.plannedStart !== undefined);
    let plannedStart = payload.plannedStart === undefined ? undefined : parseDateOnly(payload.plannedStart);
    let plannedEnd = payload.plannedEnd === undefined ? undefined : parseDateOnly(payload.plannedEnd);
    if (touchedPlan && plannedStart === undefined && plannedEnd === undefined) {
      const span = await tx.productionTask.aggregate({
        where: { setId, plannedStart: { not: null } },
        _min: { plannedStart: true },
        _max: { plannedEnd: true },
      });
      plannedStart = span._min.plannedStart ?? null;
      plannedEnd = span._max.plannedEnd ?? span._min.plannedStart ?? null;
    }
    const hasPlan = plannedStart === undefined ? set.plannedStart !== null : plannedStart !== null;

    const percentDone = percentDoneOf(freshTasks as unknown as ProductionTaskRow[]);
    const nextStatus = deriveSetStatus(freshTasks as unknown as ProductionTaskRow[], set.status, hasPlan);
    const completedNow = nextStatus === "HOAN_THANH" && set.status !== "HOAN_THANH";

    await tx.productionSet.update({
      where: { id: setId },
      data: {
        percentDone,
        status: nextStatus,
        ...(plannedStart !== undefined ? { plannedStart } : {}),
        ...(plannedEnd !== undefined ? { plannedEnd } : {}),
        ...(payload.note !== undefined ? { note: payload.note } : {}),
        ...(payload.planId !== undefined ? { planId: payload.planId } : {}),
        ...(payload.materialReady !== undefined ? { materialReady: payload.materialReady } : {}),
        ...(payload.programReady !== undefined ? { programReady: payload.programReady } : {}),
        ...(completedNow ? { actualCompletedAt: new Date() } : {}),
      },
    });

    // Đóng dấu thực tế cho mốc hoàn thành sản xuất / đã giao (dùng cho OTD).
    const finishedStage = freshTasks.find((task) => task.stageCode === STAGE.DONG_GOI);
    if (finishedStage?.status === "XONG" && !completedNow) {
      await tx.$executeRaw`UPDATE production_sets SET actual_completed_at = COALESCE(actual_completed_at, now()) WHERE id = ${setId}`;
    }

    if (logs.length) {
      await tx.productionLog.createMany({ data: logs });
    }

    return { percentDone, status: nextStatus };
  }, ORDER_WRITE_TRANSACTION);

  return result;
}

/** Đánh dấu bộ là ĐÃ GIAO (mốc tính tỷ lệ giao đúng hạn — L13). */
export async function markSetDelivered(setId: number, deliveredDate: string | null, byName: string | null) {
  const date = parseDateOnly(deliveredDate) ?? startOfDayUtc(new Date());
  await prisma.productionSet.update({
    where: { id: setId },
    data: { status: "DA_GIAO", actualDeliveredAt: date },
  });
  await prisma.productionLog.create({
    data: {
      entity: "SET",
      entityId: setId,
      action: "DA_GIAO",
      field: "actual_delivered_at",
      oldValue: null,
      newValue: date.toISOString().slice(0, 10),
      byName,
    },
  });
}

/**
 * Nguồn cho màn "Nhập bộ đang sản xuất dở" (B8): các bộ cửa của đơn đã xác nhận
 * mà CHƯA có trong kế hoạch sản xuất.
 *
 * Dùng NOT EXISTS thay vì quan hệ Prisma: `production_sets.order_item_id` CỐ Ý không có
 * khóa ngoại, vì route sửa đơn xoá rồi tạo lại dòng hàng — khóa ngoại sẽ chặn hoặc làm
 * mất tiến độ sản xuất. Xem V136 mục "rủi ro".
 */
export async function loadUnplannedOrderItems(limit = 200) {
  const config = await readProductionConfig();
  const types = config.entryOrderTypes;
  return prisma.$queryRaw<
    Array<{
      id: number;
      order_id: number;
      set_no: string | null;
      model: string | null;
      product_name: string | null;
      paint_color: string | null;
      height_mm: number | null;
      width_mm: number | null;
      leaves_per_set: number | null;
      trim_bars_per_set: number | null;
      quantity: number | null;
      pricing_quantity: number | null;
      order_code: string | null;
      order_type: string | null;
      customer_name: string | null;
      required_delivery_date: Date | null;
    }>
  >`
    SELECT i.id, i.order_id, i.set_no, i.model, i.product_name, i.paint_color,
           i.height_mm, i.width_mm, i.leaves_per_set, i.trim_bars_per_set,
           i.quantity, i.pricing_quantity,
           o.order_code, o.order_type, o.customer_name, o.required_delivery_date
    FROM sales_order_items i
    JOIN sales_orders o ON o.id = i.order_id
    WHERE o.status IN (${Prisma.join(CONFIRMED_STATUS_CODES)})
      AND o.order_type IN (${Prisma.join(types)})
      AND NOT EXISTS (
        SELECT 1 FROM production_sets s
        WHERE s.order_item_id = i.id
           OR (s.order_id = i.order_id AND s.set_no IS NOT NULL AND i.set_no IS NOT NULL
               AND UPPER(TRIM(s.set_no)) = UPPER(TRIM(i.set_no)))
      )
    ORDER BY o.required_delivery_date ASC NULLS LAST, i.id ASC
    LIMIT ${limit}`;
}

export async function countUnplannedOrderItems(): Promise<number> {
  const config = await readProductionConfig();
  const types = config.entryOrderTypes;
  const rows = await prisma.$queryRaw<Array<{ total: bigint | number }>>`
    SELECT COUNT(*)::bigint AS total
    FROM sales_order_items i
    JOIN sales_orders o ON o.id = i.order_id
    WHERE o.status IN (${Prisma.join(CONFIRMED_STATUS_CODES)})
      AND o.order_type IN (${Prisma.join(types)})
      AND NOT EXISTS (
        SELECT 1 FROM production_sets s
        WHERE s.order_item_id = i.id
           OR (s.order_id = i.order_id AND s.set_no IS NOT NULL AND i.set_no IS NOT NULL
               AND UPPER(TRIM(s.set_no)) = UPPER(TRIM(i.set_no)))
      )`;
  return Number(rows[0]?.total ?? 0);
}

// ---------------------------------------------------------------------------
// V137 — Dọn lệnh sản xuất khi bộ cửa bị XOÁ khỏi đơn
// ---------------------------------------------------------------------------

export type ReconcileResult = { removed: number; cancelled: number };

/**
 * Đồng bộ lại lệnh sản xuất sau khi lưu đơn: bộ nào **không còn trong đơn** thì:
 *   - **chưa có tiến độ** (0% và chưa ghi mốc hoàn thành/đã giao) → **XOÁ hẳn** (kèm công đoạn + lệnh con);
 *   - **đã có tiến độ** → **giữ lại nhưng đánh dấu ĐÃ HUỶ** — không phá công xưởng đã làm.
 *
 * KHÔNG BAO GIỜ ném lỗi ra ngoài: việc lưu đơn hàng không được phụ thuộc module sản xuất
 * (ví dụ khi DB chưa chạy migration sản xuất).
 */
export async function reconcileOrderProductionSets(
  orderId: number,
  currentSetNos: Array<string | null | undefined>,
  byName: string | null = null,
): Promise<ReconcileResult> {
  const empty: ReconcileResult = { removed: 0, cancelled: 0 };
  try {
    const sets = await prisma.productionSet.findMany({
      where: { orderId },
      select: { id: true, setNo: true, status: true, percentDone: true, actualCompletedAt: true, actualDeliveredAt: true },
    });
    if (!sets.length) return empty;

    const keep = new Set(
      currentSetNos.map((value) => String(value ?? "").trim().toUpperCase()).filter((value) => value.length > 0),
    );
    // Chỉ xét các bộ CÓ Bộ số — bộ không có số thì giữ nguyên (không đoán).
    const orphans = sets.filter((set) => {
      const no = String(set.setNo ?? "").trim().toUpperCase();
      return no.length > 0 && !keep.has(no);
    });
    if (!orphans.length) return empty;

    const untouched = orphans.filter((set) => set.percentDone === 0 && !set.actualCompletedAt && !set.actualDeliveredAt);
    const touched = orphans.filter((set) => !untouched.some((row) => row.id === set.id));
    const removeIds = new Set(untouched.map((set) => set.id));

    if (removeIds.size) {
      await prisma.productionSet.deleteMany({ where: { id: { in: Array.from(removeIds) } } });
    }
    if (touched.length) {
      await prisma.productionSet.updateMany({ where: { id: { in: touched.map((set) => set.id) } }, data: { status: "HUY" } });
    }
    await prisma.productionLog.createMany({
      data: [
        ...untouched.map((set) => ({
          entity: "SET",
          entityId: set.id,
          action: "XOA_VI_BO_KHOI_DON",
          field: "set_no",
          oldValue: String(set.setNo ?? ""),
          newValue: null,
          byName,
        })),
        ...touched.map((set) => ({
          entity: "SET",
          entityId: set.id,
          action: "HUY_VI_BO_KHOI_DON",
          field: "status",
          oldValue: set.status,
          newValue: "HUY",
          byName,
        })),
      ],
    });

    return { removed: removeIds.size, cancelled: touched.length };
  } catch (error) {
    console.error("Reconcile production sets failed:", error);
    return empty;
  }
}

/**
 * V146 — ĐÃ BỎ nhóm hàm KẾ HOẠCH TUẦN (V137: loadPlans/createPlan/approvePlan/reopenPlan/deletePlan)
 * vì tab "Kế hoạch tuần" không dùng được. Bảng `production_plans` vẫn giữ nguyên dữ liệu cũ.
 */

// ---------------------------------------------------------------------------
// V137 — Nạp dữ liệu cho BÁO CÁO SẢN XUẤT
// ---------------------------------------------------------------------------

export async function loadProductionReportData(limit = 5000) {
  const [sets, stages, workCenters, reasons] = await Promise.all([
    prisma.productionSet.findMany({ orderBy: [{ dueDate: "asc" }, { id: "asc" }], take: limit }),
    loadStages(),
    loadWorkCenters(),
    loadReasons(),
  ]);
  const tasks = sets.length
    ? await prisma.productionTask.findMany({ where: { setId: { in: sets.map((set) => set.id) } } })
    : [];
  return {
    sets: sets as unknown as ProductionSetRow[],
    tasks: tasks as unknown as ProductionTaskRow[],
    stages,
    workCenters,
    reasons: reasons.map((reason) => ({ code: reason.code, name: reason.name, group: reason.group })),
  };
}
