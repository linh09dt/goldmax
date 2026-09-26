/**
 * V136 — Từ điển dùng chung cho module Lên kế hoạch sản xuất:
 * nhãn hiển thị, mã công đoạn, kiểu dữ liệu, và các hàm thuần (không truy vấn DB).
 *
 * Quy ước mã lấy đúng từ khảo sát nhà máy — xem `KE_HOACH_SAN_XUAT_V136.md` mục 1.
 */

// ---------------------------------------------------------------------------
// Kiểu dữ liệu (khớp cột trong prisma/schema.prisma)
// ---------------------------------------------------------------------------

export type StageKind = "CHUAN_BI" | "GIA_CONG" | "CHO" | "QC";
export type StageScopeMode = "BO" | "PARTS" | "MODEL";
export type TaskScope = "KHUNG" | "CANH" | "PHAO" | "BO";
export type TaskStatus = "CHUA_LAM" | "DANG_LAM" | "XONG" | "BO_QUA" | "TAM_DUNG";
export type SetStatus = "CHO_XEP_LICH" | "DA_XEP_LICH" | "DANG_SX" | "HOAN_THANH" | "DA_GIAO" | "TAM_DUNG" | "HUY";
export type WorkCenterKind = "TO" | "NGUON_LUC_NGOAI" | "VAN_PHONG";
export type ReasonGroup = "TAM_DUNG" | "TRE_HAN" | "MAY_DUNG" | "LOI";

export type ProductionWorkCenterRow = {
  id: number;
  code: string;
  name: string;
  kind: string;
  peopleCount: number | null;
  shiftsPerDay: number | null;
  hoursPerShift: number | null;
  capacityPerDay: number | null;
  capacityUnit: string;
  active: boolean;
  sortOrder: number;
  note: string | null;
};

export type ProductionStageRow = {
  id: number;
  code: string;
  name: string;
  kind: string;
  scopeMode: string;
  scopeParts: string | null;
  workCenterCode: string | null;
  seq: number;
  leadTimeHours: number | null;
  setupMinutes: number | null;
  capacityPerDay: number | null;
  capacityUnit: string;
  batchKey: string | null;
  batchMinQty: number | null;
  changeoverMaxPerDay: number | null;
  isQcPoint: boolean;
  reworkToStage: string | null;
  skipCondition: string | null;
  requiresStage: string | null;
  active: boolean;
  note: string | null;
};

export type ProductionTaskRow = {
  id: number;
  setId: number;
  orderItemId: number | null;
  stageCode: string;
  stageKind: string;
  scope: string;
  seq: number;
  workCenterCode: string | null;
  status: string;
  qtyExpected: number | null;
  qtyDone: number | null;
  plannedStart: Date | null;
  plannedEnd: Date | null;
  actualStart: Date | null;
  actualEnd: Date | null;
  assignee: string | null;
  isRework: boolean;
  reworkFromStage: string | null;
  reasonCode: string | null;
  note: string | null;
  updatedBy: string | null;
};

export type ProductionSetRow = {
  id: number;
  orderId: number;
  orderItemId: number | null;
  orderCode: string | null;
  setNo: string | null;
  orderType: string;
  customerName: string | null;
  productName: string | null;
  model: string | null;
  openingDirection: string | null;
  paintColor: string | null;
  veneerCode: string | null;
  heightMm: number | null;
  widthMm: number | null;
  leavesPerSet: number | null;
  trimBarsPerSet: number | null;
  quantity: number | null;
  pricingQuantity: number | null;
  canhEquivalent: number;
  dueDate: Date | null;
  planId: number | null;
  priority: number;
  status: string;
  percentDone: number;
  plannedStart: Date | null;
  plannedEnd: Date | null;
  actualCompletedAt: Date | null;
  actualDeliveredAt: Date | null;
  programReady: boolean;
  materialReady: boolean;
  packCount: number | null;
  note: string | null;
};

// ---------------------------------------------------------------------------
// Mã công đoạn (dùng trong code để tránh gõ sai chuỗi)
// ---------------------------------------------------------------------------

export const STAGE = {
  THIET_KE: "THIET_KE",
  BOI_LARES: "BOI_LARES",
  CHO_SAU_BOI_LARES: "CHO_SAU_BOI_LARES",
  CAT: "CAT",
  CHAN: "CHAN",
  HAN: "HAN",
  EP_CANH: "EP_CANH",
  TEST_CO_KHI: "TEST_CO_KHI",
  CHO_TRUOC_SON: "CHO_TRUOC_SON",
  SON: "SON",
  CHO_KHO_SAU_SON: "CHO_KHO_SAU_SON",
  VAN: "VAN",
  CHO_SAU_VAN: "CHO_SAU_VAN",
  LAP_KINH: "LAP_KINH",
  DONG_GOI: "DONG_GOI",
  KHO_GIAO: "KHO_GIAO",
} as const;

export const WORK_CENTER = {
  TO_MAY: "TO_MAY",
  TO_HAN: "TO_HAN",
  TO_SON: "TO_SON",
  TO_VAN: "TO_VAN",
  TO_DONG_GOI: "TO_DONG_GOI",
  KHO: "KHO",
  KY_THUAT: "KY_THUAT",
  NGOAI: "NGOAI",
} as const;

/** Công đoạn làm cho cả bộ (không tách khung/cánh/phào). */
export const DEFAULT_PARTS: TaskScope[] = ["KHUNG", "CANH", "PHAO"];

// ---------------------------------------------------------------------------
// Nhãn hiển thị
// ---------------------------------------------------------------------------

export const STAGE_KIND_LABELS: Record<string, string> = {
  CHUAN_BI: "Chuẩn bị",
  GIA_CONG: "Gia công",
  CHO: "Chờ",
  QC: "Kiểm tra (QC)",
};

export const SCOPE_LABELS: Record<string, string> = {
  KHUNG: "Khung",
  CANH: "Cánh",
  PHAO: "Phào",
  BO: "Cả bộ",
};

export const TASK_STATUS_LABELS: Record<string, string> = {
  CHUA_LAM: "Chưa làm",
  DANG_LAM: "Đang làm",
  XONG: "Xong",
  BO_QUA: "Bỏ qua",
  TAM_DUNG: "Tạm dừng",
};

export const SET_STATUS_LABELS: Record<string, string> = {
  CHO_XEP_LICH: "Chờ xếp lịch",
  DA_XEP_LICH: "Đã xếp lịch",
  DANG_SX: "Đang sản xuất",
  HOAN_THANH: "Hoàn thành",
  DA_GIAO: "Đã giao",
  TAM_DUNG: "Tạm dừng",
  HUY: "Đã huỷ",
};

export const WORK_CENTER_KIND_LABELS: Record<string, string> = {
  TO: "Tổ trong xưởng",
  NGUON_LUC_NGOAI: "Thuê ngoài",
  VAN_PHONG: "Văn phòng / kỹ thuật",
};

export const REASON_GROUP_LABELS: Record<string, string> = {
  TAM_DUNG: "Lý do tạm dừng",
  TRE_HAN: "Lý do trễ hạn",
  MAY_DUNG: "Lý do máy dừng",
  LOI: "Loại lỗi / làm lại",
};

/** Thứ tự trạng thái để chọn ở màn cập nhật tiến độ. */
export const TASK_STATUS_OPTIONS: TaskStatus[] = ["CHUA_LAM", "DANG_LAM", "XONG", "BO_QUA", "TAM_DUNG"];

// ---------------------------------------------------------------------------
// Hàm thuần
// ---------------------------------------------------------------------------

export function parseScopeParts(value: string | null | undefined): TaskScope[] {
  const parts = String(value ?? "")
    .split(",")
    .map((item) => item.trim().toUpperCase())
    .filter((item): item is TaskScope => item === "KHUNG" || item === "CANH" || item === "PHAO");
  return parts.length ? Array.from(new Set(parts)) : [];
}

/**
 * Đọc điều kiện bỏ qua công đoạn. Định dạng: `"PAINT_COLOR:11,14"`.
 * LK5: màu sơn 11 và 14 không cần vân.
 */
export function parseSkipCondition(value: string | null | undefined): { key: string; values: string[] } | null {
  const text = String(value ?? "").trim();
  if (!text) return null;
  const [rawKey, rawValues] = text.split(":");
  const key = String(rawKey ?? "").trim().toUpperCase();
  const values = String(rawValues ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  if (!key || !values.length) return null;
  return { key, values };
}

function normalizeCode(value: unknown): string {
  return String(value ?? "").trim().toUpperCase();
}

/** Công đoạn này có bị bỏ qua với bộ cửa đang xét không (theo `skipCondition`). */
export function isStageSkippedForSet(
  stage: Pick<ProductionStageRow, "skipCondition">,
  set: Pick<ProductionSetRow, "paintColor" | "veneerCode" | "model">,
): boolean {
  const condition = parseSkipCondition(stage.skipCondition);
  if (!condition) return false;
  if (condition.key === "PAINT_COLOR") {
    return condition.values.map(normalizeCode).includes(normalizeCode(set.paintColor));
  }
  if (condition.key === "VENEER_CODE") {
    return condition.values.map(normalizeCode).includes(normalizeCode(set.veneerCode));
  }
  if (condition.key === "MODEL") {
    return condition.values.map(normalizeCode).includes(normalizeCode(set.model));
  }
  return false;
}

/**
 * % tiến độ của một bộ = số công đoạn GIA_CONG/QC/CHUAN_BI đã XONG / tổng số phải làm.
 * KHÔNG tính công đoạn CHỜ (tự động) và công đoạn BO_QUA (bỏ qua theo màu…).
 * J5: nhà máy muốn theo dõi % tiến độ từng bộ.
 */
export function percentDoneOf(tasks: Array<Pick<ProductionTaskRow, "stageKind" | "status">>): number {
  const counted = tasks.filter((task) => task.status !== "BO_QUA" && task.stageKind !== "CHO");
  if (!counted.length) return 0;
  const done = counted.filter((task) => task.status === "XONG").length;
  return Math.round((done / counted.length) * 100);
}

/**
 * Suy trạng thái của BỘ từ trạng thái các công đoạn.
 * - Tất cả công đoạn cần làm đã XONG → HOAN_THANH.
 * - Có ít nhất 1 công đoạn XONG hoặc DANG_LAM → DANG_SX.
 * - Có công đoạn TAM_DUNG → TAM_DUNG (ưu tiên báo động).
 */
export function deriveSetStatus(tasks: Array<Pick<ProductionTaskRow, "stageKind" | "status">>, current: string): SetStatus {
  if (current === "HUY" || current === "DA_GIAO") return current as SetStatus;
  const counted = tasks.filter((task) => task.status !== "BO_QUA" && task.stageKind !== "CHO");
  if (!counted.length) return "CHO_XEP_LICH";
  if (counted.some((task) => task.status === "TAM_DUNG")) return "TAM_DUNG";
  if (counted.every((task) => task.status === "XONG")) return "HOAN_THANH";
  if (counted.some((task) => task.status === "XONG" || task.status === "DANG_LAM")) return "DANG_SX";
  return current === "DA_XEP_LICH" || current === "CHO_XEP_LICH" ? "DA_XEP_LICH" : (current as SetStatus);
}

/** Số cánh quy đổi của một bộ để tính tải. Không có `leavesPerSet` thì coi là 1 cánh. */
export function canhEquivalentOf(set: Pick<ProductionSetRow, "leavesPerSet" | "quantity">): number {
  const leaves = Number(set.leavesPerSet);
  const sets = Number(set.quantity);
  const safeLeaves = Number.isFinite(leaves) && leaves > 0 ? Math.trunc(leaves) : 1;
  const safeSets = Number.isFinite(sets) && sets > 0 ? Math.trunc(sets) : 1;
  return safeLeaves * safeSets;
}

/** Ngày cần xong của xưởng = hạn giao − đệm vận chuyển (B6/GH2). */
export function workshopDueDate(dueDate: Date | null, bufferDays: number): Date | null {
  if (!dueDate) return null;
  const result = new Date(Date.UTC(dueDate.getUTCFullYear(), dueDate.getUTCMonth(), dueDate.getUTCDate()));
  result.setUTCDate(result.getUTCDate() - Math.max(0, Math.trunc(bufferDays)));
  return result;
}
