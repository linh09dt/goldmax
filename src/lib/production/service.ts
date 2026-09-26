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
import { buildCalendar, startOfDayUtc, type WorkingCalendar } from "@/lib/production/calendar";
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
import { autoSchedule } from "@/lib/production/auto-schedule";
import { buildComponentOrderDrafts, buildTaskDrafts } from "@/lib/production/routing";
import { defaultPriorityForOrderType } from "@/lib/production/scheduling";

export const SET_INCLUDE_TASKS = {
  tasks: { orderBy: [{ seq: "asc" }, { scope: "asc" }] },
  componentOrders: { orderBy: { kind: "asc" } },
} satisfies Prisma.ProductionSetInclude;

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
  const pending = orderItems.filter((item) => {
    if (plannedItemIds.has(item.id)) return false;
    const setNo = String(item.setNo ?? "").trim().toUpperCase();
    if (setNo && plannedOrderSetNo.has(`${item.orderId}|${setNo}`)) return false;
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
    if (taskRows.length) {
      await tx.productionTask.createMany({ data: taskRows });
    }

    return { createdSets: createdSets.length, createdTasks: taskRows.length, skipped: orderItems.length - pending.length };
  }, ORDER_WRITE_TRANSACTION);
}

/** Sinh lại công đoạn cho MỘT bộ đã có (dùng khi danh mục công đoạn thay đổi). */
export async function rebuildTasksForSet(setId: number): Promise<{ createdTasks: number }> {
  const config = await readProductionConfig();
  const stages = await loadActiveStages();
  const programModels = await loadProgramModels();
  const set = await prisma.productionSet.findUnique({
    where: { id: setId },
    include: { componentOrders: true },
  });
  if (!set) throw new Error("Không tìm thấy bộ cửa.");

  const drafts = buildTaskDrafts({
    set: set as ProductionSetRow,
    stages,
    config,
    modelHasProgram: programModels.has(String(set.model ?? "").trim().toUpperCase()),
  });

  return prisma.$transaction(async (tx) => {
    await tx.productionTask.deleteMany({ where: { setId } });
    await tx.productionComponentOrder.deleteMany({ where: { setId } });
    await tx.productionComponentOrder.createMany({
      data: buildComponentOrderDrafts(set as ProductionSetRow, config).map((draft) => ({
        setId,
        kind: draft.kind,
        qtyExpected: draft.qtyExpected,
      })),
    });
    if (!drafts.length) return { createdTasks: 0 };
    await tx.productionTask.createMany({
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
    });
    return { createdTasks: drafts.length };
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
    select: { id: true, status: true, orderItemId: true, model: true, setNo: true, orderCode: true },
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
      }));
      await tx.$executeRaw`
        UPDATE production_tasks AS t SET
          status      = COALESCE(v.status, t.status),
          actual_start= COALESCE(v.actual_start, t.actual_start),
          actual_end  = COALESCE(v.actual_end, t.actual_end),
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
          note text, reason_code text, assignee text, is_rework boolean, updated_by text
        )
        WHERE t.id = v.id AND t.set_id = ${setId}`;
    }

    const freshTasks = await tx.productionTask.findMany({
      where: { setId },
      select: { id: true, stageKind: true, status: true, stageCode: true },
    });
    const percentDone = percentDoneOf(freshTasks as unknown as ProductionTaskRow[]);
    const nextStatus = deriveSetStatus(freshTasks as unknown as ProductionTaskRow[], set.status);
    const completedNow = nextStatus === "HOAN_THANH" && set.status !== "HOAN_THANH";

    const plannedStart = payload.plannedStart === undefined ? undefined : parseDateOnly(payload.plannedStart);
    const plannedEnd = payload.plannedEnd === undefined ? undefined : parseDateOnly(payload.plannedEnd);

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
// Xếp lịch tự động (đợt B gọn) — xếp tiến theo EDD + năng lực tổ
// ---------------------------------------------------------------------------

export type AutoScheduleSummary = {
  scheduledSets: number;
  scheduledTasks: number;
  skippedSets: number;
  overloadCells: number;
  lastDay: string | null;
};

/**
 * Xếp lịch tự động cho các bộ CHƯA có lịch (mặc định) hoặc toàn bộ bộ đang mở.
 *
 * Ghi 2 lượt cho cả đợt (bài học V111): 1 câu cho `production_tasks`, 1 câu cho `production_sets`.
 */
export async function applyAutoSchedule(options: { from?: Date; rescheduleAll?: boolean } = {}): Promise<AutoScheduleSummary> {
  const config = await readProductionConfig();
  const [workCenters, calendar] = await Promise.all([loadActiveWorkCenters(), loadCalendar(config)]);

  const sets = await prisma.productionSet.findMany({
    where: {
      status: options.rescheduleAll ? { notIn: ["HOAN_THANH", "DA_GIAO", "HUY"] } : "CHO_XEP_LICH",
    },
    include: { tasks: true },
    orderBy: [{ dueDate: "asc" }, { id: "asc" }],
  });
  if (!sets.length) {
    return { scheduledSets: 0, scheduledTasks: 0, skippedSets: 0, overloadCells: 0, lastDay: null };
  }

  const result = autoSchedule({
    sets: sets as unknown as Array<ProductionSetRow & { tasks: ProductionTaskRow[] }>,
    workCenters,
    config,
    calendar,
    startDate: options.from ? startOfDayUtc(options.from) : startOfDayUtc(new Date()),
  });

  if (!result.sets.length) {
    return { scheduledSets: 0, scheduledTasks: 0, skippedSets: result.skippedSets, overloadCells: 0, lastDay: null };
  }

  const taskRecords = result.tasks.map((task) => ({ id: task.id, day: task.plannedStart.toISOString().slice(0, 10) }));
  const setRecords = result.sets.map((set) => ({
    id: set.id,
    start: set.plannedStart.toISOString().slice(0, 10),
    end: set.plannedEnd.toISOString().slice(0, 10),
  }));

  await prisma.$transaction(async (tx) => {
    if (taskRecords.length) {
      await tx.$executeRaw`
        UPDATE production_tasks AS t
        SET planned_start = v.day::date, planned_end = v.day::date, updated_at = now()
        FROM jsonb_to_recordset(${JSON.stringify(taskRecords)}::jsonb) AS v(id int, day text)
        WHERE t.id = v.id`;
    }
    await tx.$executeRaw`
      UPDATE production_sets AS s
      SET planned_start = v.start::date,
          planned_end = v.end::date,
          status = CASE WHEN s.status = 'CHO_XEP_LICH' THEN 'DA_XEP_LICH' ELSE s.status END,
          updated_at = now()
      FROM jsonb_to_recordset(${JSON.stringify(setRecords)}::jsonb) AS v(id int, start text, "end" text)
      WHERE s.id = v.id`;
    await tx.productionLog.createMany({
      data: result.sets.slice(0, 500).map((set) => ({
        entity: "SET",
        entityId: set.id,
        action: "XEP_LICH_TU_DONG",
        field: "planned_start",
        oldValue: null,
        newValue: set.plannedStart.toISOString().slice(0, 10),
        byName: null,
      })),
    });
  }, ORDER_WRITE_TRANSACTION);

  return {
    scheduledSets: result.sets.length,
    scheduledTasks: result.tasks.length,
    skippedSets: result.skippedSets,
    overloadCells: result.overloadCells,
    lastDay: result.lastDay ? result.lastDay.toISOString().slice(0, 10) : null,
  };
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

// ---------------------------------------------------------------------------
// V137 — KẾ HOẠCH TUẦN + CHỐT KẾ HOẠCH
// (J3: kế hoạch tuần do kinh doanh + sản xuất thống nhất, giám đốc nhà máy chốt)
// ---------------------------------------------------------------------------

export type PlanSummary = {
  id: number;
  code: string;
  fromDate: Date;
  toDate: Date;
  status: string;
  createdBy: string | null;
  approvedBy: string | null;
  approvedAt: Date | null;
  note: string | null;
  setCount: number;
  canhTotal: number;
  completed: number;
  inProgress: number;
  waiting: number;
  cancelled: number;
  sets: Array<{
    id: number;
    setNo: string | null;
    orderCode: string | null;
    customerName: string | null;
    model: string | null;
    paintColor: string | null;
    dueDate: Date | null;
    status: string;
    percentDone: number;
    canh: number;
    plannedStart: Date | null;
    plannedEnd: Date | null;
  }>;
};

export async function loadPlans(): Promise<PlanSummary[]> {
  const plans = await prisma.productionPlan.findMany({ orderBy: [{ fromDate: "desc" }] });
  if (!plans.length) return [];
  const sets = await prisma.productionSet.findMany({
    where: { planId: { in: plans.map((plan) => plan.id) } },
    orderBy: [{ setNo: "asc" }],
  });

  return plans.map((plan) => {
    const planSets = sets.filter((set) => set.planId === plan.id);
    return {
      id: plan.id,
      code: plan.code,
      fromDate: plan.fromDate,
      toDate: plan.toDate,
      status: plan.status,
      createdBy: plan.createdBy,
      approvedBy: plan.approvedBy,
      approvedAt: plan.approvedAt,
      note: plan.note,
      setCount: planSets.length,
      canhTotal: planSets.reduce((sum, set) => sum + (Number(set.canhEquivalent) || 0), 0),
      completed: planSets.filter((set) => set.status === "HOAN_THANH" || set.status === "DA_GIAO").length,
      inProgress: planSets.filter((set) => set.status === "DANG_SX" || set.status === "DA_XEP_LICH").length,
      waiting: planSets.filter((set) => set.status === "CHO_XEP_LICH").length,
      cancelled: planSets.filter((set) => set.status === "HUY").length,
      sets: planSets.map((set) => ({
        id: set.id,
        setNo: set.setNo,
        orderCode: set.orderCode,
        customerName: set.customerName,
        model: set.model,
        paintColor: set.paintColor,
        dueDate: set.dueDate,
        status: set.status,
        percentDone: set.percentDone,
        canh: Number(set.canhEquivalent) || 0,
        plannedStart: set.plannedStart,
        plannedEnd: set.plannedEnd,
      })),
    };
  });
}

/** Mã kế hoạch theo khoảng ngày: KH-20261005-20261010 */
function planCodeFor(fromDate: Date, toDate: Date): string {
  const stamp = (date: Date) => date.toISOString().slice(0, 10).replace(/-/g, "");
  return `KH-${stamp(fromDate)}-${stamp(toDate)}`;
}

/**
 * Tạo kế hoạch cho một khoảng ngày và **gán các bộ có ngày bắt đầu nằm trong khoảng** vào kế hoạch.
 * Idempotent theo mã kế hoạch: gọi lại cùng khoảng ngày thì trả về kế hoạch cũ.
 */
export async function createPlan(input: { fromDate: Date; toDate: Date; note?: string | null; createdBy?: string | null }) {
  const fromDate = startOfDayUtc(input.fromDate);
  const toDate = startOfDayUtc(input.toDate);
  if (toDate.getTime() < fromDate.getTime()) throw new Error("Ngày kết thúc phải sau ngày bắt đầu.");
  const code = planCodeFor(fromDate, toDate);

  const existing = await prisma.productionPlan.findUnique({ where: { code }, select: { id: true } });
  const plan =
    existing ??
    (await prisma.productionPlan.create({
      data: { code, fromDate, toDate, status: "NHAP", createdBy: input.createdBy ?? null, note: input.note ?? null },
      select: { id: true },
    }));

  const candidates = await prisma.productionSet.findMany({
    where: {
      status: { not: "HUY" },
      plannedStart: { gte: fromDate, lte: toDate },
      OR: [{ planId: null }, { planId: plan.id }],
    },
    select: { id: true },
  });
  const assigned =
    candidates.length > 0
      ? await prisma.productionSet.updateMany({
          where: { id: { in: candidates.map((row) => row.id) } },
          data: { planId: plan.id },
        })
      : { count: 0 };

  return { id: plan.id, code, assigned: assigned.count, created: !existing };
}

export async function approvePlan(planId: number, approvedBy: string | null) {
  const plan = await prisma.productionPlan.update({
    where: { id: planId },
    data: { status: "DA_CHOT", approvedBy: approvedBy ?? null, approvedAt: new Date() },
    select: { id: true, code: true, status: true },
  });
  await prisma.productionLog.create({
    data: { entity: "PLAN", entityId: planId, action: "CHOT_KE_HOACH", field: "status", oldValue: "NHAP", newValue: "DA_CHOT", byName: approvedBy },
  });
  return plan;
}

export async function reopenPlan(planId: number, byName: string | null) {
  const plan = await prisma.productionPlan.update({
    where: { id: planId },
    data: { status: "NHAP", approvedBy: null, approvedAt: null },
    select: { id: true, code: true, status: true },
  });
  await prisma.productionLog.create({
    data: { entity: "PLAN", entityId: planId, action: "MO_LAI_KE_HOACH", field: "status", oldValue: "DA_CHOT", newValue: "NHAP", byName },
  });
  return plan;
}

export async function deletePlan(planId: number) {
  await prisma.productionSet.updateMany({ where: { planId }, data: { planId: null } });
  await prisma.productionPlan.delete({ where: { id: planId } });
  return { ok: true };
}

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
