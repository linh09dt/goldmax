/**
 * V137 — Dữ liệu cho mẫu in PHIẾU LỆNH SẢN XUẤT và DANH SÁCH VIỆC THEO NGÀY.
 *
 * Chỉ ĐỌC. Gom về một dạng dữ liệu phẳng để trang in render (A4 dọc).
 */

import { prisma } from "@/lib/prisma";
import { startOfDayUtc } from "@/lib/production/calendar";
import {
  COMPONENT_KINDS,
  COMPONENT_LABELS,
  componentProgress,
  percentDoneOf,
  SCOPE_LABELS,
  STAGE_KIND_LABELS,
  TASK_STATUS_LABELS,
  type ProductionTaskRow,
} from "@/lib/production/catalog";
import { loadActiveWorkCenters, loadStages } from "@/lib/production/service";

export type PrintTaskLine = {
  id: number;
  seq: number;
  stageCode: string;
  stageName: string;
  stageKind: string;
  stageKindLabel: string;
  scopeLabel: string;
  workCenterCode: string | null;
  workCenterName: string;
  statusLabel: string;
  qtyExpected: number | null;
  plannedStart: Date | null;
  actualStart: Date | null;
  actualEnd: Date | null;
  note: string | null;
  isRework: boolean;
  /** V142 — mã lệnh sản xuất của chính công đoạn này (in trên phiếu để tổ đối chiếu). */
  workOrderCode: string | null;
};

export type PrintComponentLine = {
  kindLabel: string;
  qtyExpected: number | null;
  percent: number;
  done: number;
  total: number;
  workSummary: string;
  /** V142 — mã lệnh con tương ứng (Cánh / Khung / Phào). */
  workOrderCode: string | null;
};

export type PrintSet = {
  id: number;
  setNo: string | null;
  orderCode: string | null;
  customerName: string | null;
  productName: string | null;
  model: string | null;
  openingDirection: string | null;
  paintColor: string | null;
  veneerCode: string | null;
  sizeText: string;
  leavesPerSet: number | null;
  quantity: number | null;
  dueDate: Date | null;
  workShopDue: Date | null;
  status: string;
  percentDone: number;
  plannedStart: Date | null;
  plannedEnd: Date | null;
  components: PrintComponentLine[];
  tasks: PrintTaskLine[];
  /** V142 — mã lệnh cha (bộ) và 3 lệnh con (cánh · khung · phào). */
  workOrderCodes: { bo: string | null; canh: string | null; khung: string | null; phao: string | null };
};

function sizeText(height: number | null, width: number | null): string {
  if (!height && !width) return "—";
  return `${height ?? "?"} × ${width ?? "?"} mm`;
}

export async function loadPrintSets(options: {
  setId?: number;
  day?: Date;
  workCenterCode?: string;
  /** Khi in theo tổ: chỉ in các công đoạn của tổ đó. */
  onlyTasksOfWorkCenter?: boolean;
  limit?: number;
}): Promise<PrintSet[]> {
  const [stages, workCenters] = await Promise.all([loadStages(), loadActiveWorkCenters()]);
  const stageByCode = new Map(stages.map((stage) => [stage.code, stage]));
  const centerByCode = new Map(workCenters.map((center) => [center.code, center]));

  const day = options.day ? startOfDayUtc(options.day) : null;

  const sets = await prisma.productionSet.findMany({
    where: {
      ...(options.setId ? { id: options.setId } : {}),
      ...(day
        ? {
            tasks: {
              some: {
                plannedStart: day,
                ...(options.workCenterCode ? { workCenterCode: options.workCenterCode } : {}),
              },
            },
          }
        : {}),
      status: { not: "HUY" },
    },
    include: {
      tasks: { orderBy: [{ seq: "asc" }, { scope: "asc" }] },
      componentOrders: { orderBy: { kind: "asc" } },
      workOrders: { orderBy: { id: "asc" } },
    },
    orderBy: [{ setNo: "asc" }, { id: "asc" }],
    take: options.limit && options.limit > 0 ? options.limit : undefined,
  });

  return sets.map((set) => {
    const tasks = set.tasks as unknown as ProductionTaskRow[];
    const tasksForPrint = options.onlyTasksOfWorkCenter && options.workCenterCode
      ? tasks.filter((task) => task.workCenterCode === options.workCenterCode)
      : tasks;
    // V142 — mã lệnh công đoạn tra theo id công đoạn; mã lệnh cha/con tra theo loại.
    const workOrderCodeByTaskId = new Map<number, string>();
    const workOrderCodeByKind = new Map<string, string>();
    for (const order of set.workOrders ?? []) {
      if (order.taskId !== null) workOrderCodeByTaskId.set(order.taskId, order.code);
      else workOrderCodeByKind.set(order.kind, order.code);
    }

    return {
      id: set.id,
      setNo: set.setNo,
      orderCode: set.orderCode,
      customerName: set.customerName,
      productName: set.productName,
      model: set.model,
      openingDirection: set.openingDirection,
      paintColor: set.paintColor,
      veneerCode: set.veneerCode,
      sizeText: sizeText(set.heightMm, set.widthMm),
      leavesPerSet: set.leavesPerSet,
      quantity: set.quantity,
      dueDate: set.dueDate,
      workShopDue: set.dueDate ? new Date(set.dueDate.getTime() - 86_400_000) : null,
      status: set.status,
      percentDone: percentDoneOf(tasks),
      plannedStart: set.plannedStart,
      plannedEnd: set.plannedEnd,
      components: COMPONENT_KINDS.map((kind) => {
        const progress = componentProgress(tasks, kind);
        const child = set.componentOrders.find((row) => row.kind === kind);
        return {
          kindLabel: COMPONENT_LABELS[kind],
          qtyExpected: child?.qtyExpected ?? null,
          percent: progress.percent,
          done: progress.done,
          total: progress.total,
          workSummary: kind === "CANH" ? "Cắt · Chấn · Hàn · Ép cánh · Vân" : "Cắt · Chấn · Hàn · Vân",
          workOrderCode: workOrderCodeByKind.get(kind) ?? null,
        };
      }),
      tasks: tasksForPrint.map((task) => {
        const stage = stageByCode.get(task.stageCode);
        return {
          id: task.id,
          seq: task.seq,
          stageCode: task.stageCode,
          stageName: stage?.name ?? task.stageCode,
          stageKind: task.stageKind,
          stageKindLabel: STAGE_KIND_LABELS[task.stageKind] ?? task.stageKind,
          scopeLabel: SCOPE_LABELS[task.scope] ?? task.scope,
          workCenterCode: task.workCenterCode ?? null,
          workCenterName: task.workCenterCode ? centerByCode.get(task.workCenterCode)?.name ?? task.workCenterCode : "—",
          statusLabel: TASK_STATUS_LABELS[task.status] ?? task.status,
          qtyExpected: task.qtyExpected,
          plannedStart: task.plannedStart,
          actualStart: task.actualStart,
          actualEnd: task.actualEnd,
          note: task.note,
          isRework: task.isRework,
          workOrderCode: workOrderCodeByTaskId.get(task.id) ?? null,
        };
      }),
      workOrderCodes: {
        bo: workOrderCodeByKind.get("BO") ?? null,
        canh: workOrderCodeByKind.get("CANH") ?? null,
        khung: workOrderCodeByKind.get("KHUNG") ?? null,
        phao: workOrderCodeByKind.get("PHAO") ?? null,
      },
    };
  });
}

/** Tổ đang hoạt động — để màn in chọn tổ. */
export async function loadPrintWorkCenters() {
  const centers = await loadActiveWorkCenters();
  return centers.map((center) => ({ code: center.code, name: center.name, kind: center.kind }));
}
