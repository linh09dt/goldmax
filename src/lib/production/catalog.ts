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
  // V139 — Cắt / Chấn / Hàn / Vân tách RIÊNG từng phần (khung · cánh · phào).
  CAT_CANH: "CAT_CANH",
  CAT_KHUNG: "CAT_KHUNG",
  CAT_PHAO: "CAT_PHAO",
  CHAN_CANH: "CHAN_CANH",
  CHAN_KHUNG: "CHAN_KHUNG",
  CHAN_PHAO: "CHAN_PHAO",
  HAN_CANH: "HAN_CANH",
  HAN_KHUNG: "HAN_KHUNG",
  HAN_PHAO: "HAN_PHAO",
  EP_CANH: "EP_CANH",
  TEST_CO_KHI: "TEST_CO_KHI",
  CHO_TRUOC_SON: "CHO_TRUOC_SON",
  SON: "SON",
  CHO_KHO_SAU_SON: "CHO_KHO_SAU_SON",
  VAN_CANH: "VAN_CANH",
  VAN_KHUNG: "VAN_KHUNG",
  VAN_PHAO: "VAN_PHAO",
  CHO_SAU_VAN: "CHO_SAU_VAN",
  LAP_KINH: "LAP_KINH",
  DONG_GOI: "DONG_GOI",
  KHO_GIAO: "KHO_GIAO",
} as const;

/**
 * V139 — Các thao tác GIA CÔNG tách riêng từng phần.
 * Mã công đoạn = `<THAO TÁC>_<PHẦN>`, vd `CAT_CANH`, `HAN_KHUNG`, `VAN_PHAO`.
 * Các công đoạn CÙNG BƯỚC (`seq`) làm SONG SONG trong cùng ngày (Cắt cánh / Cắt khung / Cắt phào).
 * Lịch được GÁN BẰNG TAY theo từng công đoạn ở trang bộ cửa (V141 — đã bỏ xếp lịch tự động).
 */
export const PART_OPERATIONS = {
  CAT: { seq: 30, label: "Cắt" },
  CHAN: { seq: 40, label: "Chấn" },
  HAN: { seq: 50, label: "Hàn" },
  VAN: { seq: 90, label: "Vân" },
} as const;

export type PartOperation = keyof typeof PART_OPERATIONS;

/** Mã công đoạn của một thao tác cho một phần, vd `partStageCode("CAT", "CANH")` → `"CAT_CANH"`. */
export function partStageCode(operation: PartOperation, scope: TaskScope): string {
  return `${operation}_${scope}`;
}

export const WORK_CENTER = {
  // V140: Thiết kế tách riêng thành tổ (trước đây nằm chung KY_THUAT với Bồi Lares/CAM).
  TO_THIET_KE: "TO_THIET_KE",
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
 *
 * V141: `hasPlan` = bộ **đã có ngày kế hoạch chưa** (xếp lịch bằng tay).
 * Chưa gán ngày mà cũng chưa làm gì ⇒ giữ **CHO_XEP_LICH (BACKLOG)** — trước đây hàm này luôn biến
 * thành DA_XEP_LICH nên cột BACKLOG bị mất dần sau mỗi lần bấm Lưu (lỗi đã ghi ở `SIM_1000_DON.md` mục 5.1).
 */
export function deriveSetStatus(
  tasks: Array<Pick<ProductionTaskRow, "stageKind" | "status">>,
  current: string,
  hasPlan = true,
): SetStatus {
  if (current === "HUY" || current === "DA_GIAO") return current as SetStatus;
  const counted = tasks.filter((task) => task.status !== "BO_QUA" && task.stageKind !== "CHO");
  if (!counted.length) return "CHO_XEP_LICH";
  if (counted.some((task) => task.status === "TAM_DUNG")) return "TAM_DUNG";
  if (counted.every((task) => task.status === "XONG")) return "HOAN_THANH";
  if (counted.some((task) => task.status === "XONG" || task.status === "DANG_LAM")) return "DANG_SX";
  if (current === "CHO_XEP_LICH" || current === "DA_XEP_LICH") return hasPlan ? "DA_XEP_LICH" : "CHO_XEP_LICH";
  return current as SetStatus;
}

/**
 * Số cánh quy đổi của một bộ để tính tải = số cánh × số bộ.
 * Suy số cánh từ `leavesPerSet`, thiếu thì đọc từ tên sản phẩm diễn giải (V136.1).
 */
export function canhEquivalentOf(
  set: Pick<ProductionSetRow, "leavesPerSet" | "quantity"> & Partial<Pick<ProductionSetRow, "productName">>,
): number {
  return canhEquivalent({
    leavesPerSet: set.leavesPerSet,
    quantity: set.quantity,
    productName: set.productName ?? null,
  });
}

/** Ngày cần xong của xưởng = hạn giao − đệm vận chuyển (B6/GH2). */
export function workshopDueDate(dueDate: Date | null, bufferDays: number): Date | null {
  if (!dueDate) return null;
  const result = new Date(Date.UTC(dueDate.getUTCFullYear(), dueDate.getUTCMonth(), dueDate.getUTCDate()));
  result.setUTCDate(result.getUTCDate() - Math.max(0, Math.trunc(bufferDays)));
  return result;
}

// ---------------------------------------------------------------------------
// V136.1 — LỆNH SẢN XUẤT CHA – CON
//
// Lệnh CHA = BỘ CỬA (`production_sets`). Lệnh CON = CÁNH / KHUNG / PHÀO
// (`production_component_orders`). Công đoạn của lệnh con là các `production_tasks`
// có `scope` = kind của lệnh con đó.
// ---------------------------------------------------------------------------

export type ComponentKind = "CANH" | "KHUNG" | "PHAO";

export const COMPONENT_KINDS: ComponentKind[] = ["CANH", "KHUNG", "PHAO"];

export const COMPONENT_LABELS: Record<string, string> = {
  CANH: "Cánh",
  KHUNG: "Khung",
  PHAO: "Phào",
};

export type ProductionComponentOrderRow = {
  id: number;
  setId: number;
  kind: string;
  qtyExpected: number | null;
  note: string | null;
};

/** Bỏ dấu tiếng Việt để so khớp tên hàng (giống `order-form.tsx`). */
export function normalizeViText(value: unknown): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Số cánh của MỘT bộ cửa.
 * Ưu tiên trường "Số cánh" của dòng hàng; nếu trống thì suy từ **tên sản phẩm diễn giải**
 * (nhà máy nói: "cửa đi 1 cánh là 1, 2 cánh là 2, 4 cánh là 4").
 */
export function soCanhPerBo(set: Pick<ProductionSetRow, "leavesPerSet" | "productName">): number {
  const leaves = Number(set.leavesPerSet);
  if (Number.isFinite(leaves) && leaves > 0) return Math.trunc(leaves);
  const text = normalizeViText(set.productName);
  const match = text.match(/(\d+)\s*canh/);
  if (match) {
    const parsed = Number(match[1]);
    if (Number.isFinite(parsed) && parsed > 0) return Math.trunc(parsed);
  }
  return 1;
}

/**
 * Số phào của MỘT bộ cửa — CÔNG THỨC NHÀ MÁY ĐÃ CHỐT 26/09/2026:
 *
 *     số phào = số cánh + số phào rời MẶC ĐỊNH theo loại cửa
 *               (cửa đi = 3 · cửa sổ = 4)
 *
 * Ví dụ nhà máy đưa: cửa đi 1 cánh → 1 + 3 = **4** · cửa sổ 1 cánh → 1 + 4 = **5**.
 * Số mặc định 3 và 4 sửa được ở Cấu hình sản xuất (`defaultTrimCuaDi` / `defaultTrimCuaSo`).
 *
 * Lưu ý: công thức này KHÔNG dùng số lượng phào nhập ở dòng chi tiết của đơn —
 * đúng như nhà máy xác nhận. Nếu một bộ cần số khác thì phải sửa tay trên lệnh con.
 */
export function soPhaoPerBo(
  set: Pick<ProductionSetRow, "leavesPerSet" | "productName">,
  defaults: { cuaDi: number; cuaSo: number },
): number {
  const text = normalizeViText(set.productName);
  const macDinh = text.includes("cua so") ? defaults.cuaSo : defaults.cuaDi;
  return soCanhPerBo(set) + Math.max(0, Math.trunc(macDinh));
}

/** Số lượng của 3 lệnh con cho một bộ cửa. */
export function componentQuantities(
  set: Pick<ProductionSetRow, "leavesPerSet" | "quantity" | "productName">,
  defaults: { cuaDi: number; cuaSo: number },
): Record<ComponentKind, number> {
  const soBo = Number.isFinite(Number(set.quantity)) && Number(set.quantity) > 0 ? Math.trunc(Number(set.quantity)) : 1;
  return {
    CANH: soCanhPerBo(set) * soBo,
    KHUNG: soBo,
    PHAO: soPhaoPerBo(set, defaults) * soBo,
  };
}

/** Tổng số cánh quy đổi để tính tải = số cánh của bộ (KHÔNG nhân số phào/khung). */
export function canhEquivalent(set: Pick<ProductionSetRow, "leavesPerSet" | "quantity" | "productName">): number {
  const soBo = Number.isFinite(Number(set.quantity)) && Number(set.quantity) > 0 ? Math.trunc(Number(set.quantity)) : 1;
  return soCanhPerBo(set) * soBo;
}

// ---------------------------------------------------------------------------
// Gate: công đoạn chỉ được chạy khi công đoạn trước đã xong
// ---------------------------------------------------------------------------

export type UnlockState = {
  unlocked: boolean;
  /** Mã công đoạn đang phải chờ (rỗng nếu đã mở). */
  waitingFor: string[];
};

/**
 * Điều kiện mở của một công đoạn, theo `requiresStage` trong danh mục công đoạn.
 *
 * Quy tắc (nhà máy chốt 26/09/2026):
 *   - `requiresStage = S` → **TẤT CẢ** công đoạn mã S của cùng bộ phải XONG (hoặc BỎ QUA).
 *   - Nếu công đoạn đang xét thuộc một LỆNH CON (scope CANH/KHUNG/PHAO) mà **công đoạn S
 *     cũng có trong chính lệnh con đó** → chỉ cần phần của lệnh con đó xong.
 *     (vd: Ép cánh chỉ cần Hàn của CÁNH, không phải Hàn của cả khung và phào.)
 *   - Nếu S chỉ tồn tại ở lệnh cha (vd SON, TEST) → tính toàn bộ.
 *
 * V139: `requiresStage` đọc được NHIỀU mã, cách nhau dấu phẩy — dùng cho các mốc GỘP
 * (test cơ khí cần `HAN_CANH,HAN_KHUNG,HAN_PHAO`; lắp kính cần `VAN_CANH,VAN_KHUNG,VAN_PHAO`).
 *
 * Nhờ vậy mô hình hoá đúng các mốc GỘP mà nhà máy mô tả:
 *   TEST CƠ KHÍ chỉ chạy khi CẢ 3 phần đã hàn xong;
 *   LẮP KÍNH + ĐÓNG GÓI chỉ chạy khi CẢ 3 phần đã vân xong.
 */
export function taskUnlockState(
  task: Pick<ProductionTaskRow, "stageCode" | "scope">,
  setTasks: Array<Pick<ProductionTaskRow, "stageCode" | "scope" | "status">>,
  stageByCode: Map<string, Pick<ProductionStageRow, "code" | "requiresStage">>,
): UnlockState {
  const stage = stageByCode.get(task.stageCode);
  const requiredCodes = String(stage?.requiresStage ?? "")
    .split(",")
    .map((code) => code.trim())
    .filter(Boolean);
  if (!requiredCodes.length) return { unlocked: true, waitingFor: [] };

  const waitingFor: string[] = [];
  for (const required of requiredCodes) {
    const sameScope = setTasks.filter((row) => row.stageCode === required && row.scope === task.scope);
    const candidates = sameScope.length ? sameScope : setTasks.filter((row) => row.stageCode === required);
    // Công đoạn bắt buộc không tồn tại (đã tắt / bỏ qua) → coi như đã mở.
    if (!candidates.length) continue;
    const pending = candidates.some((row) => row.status !== "XONG" && row.status !== "BO_QUA");
    if (pending) waitingFor.push(required);
  }
  return { unlocked: waitingFor.length === 0, waitingFor };
}

/** Tiến độ của một lệnh con, suy từ công đoạn có `scope` = kind. */
export function componentProgress(
  setTasks: ProductionTaskRow[],
  kind: ComponentKind,
): { percent: number; status: SetStatus; plannedStart: Date | null; plannedEnd: Date | null; done: number; total: number } {
  const tasks = setTasks.filter((task) => task.scope === kind);
  const counted = tasks.filter((task) => task.status !== "BO_QUA" && task.stageKind !== "CHO");
  const done = counted.filter((task) => task.status === "XONG").length;
  const dates = tasks.map((task) => task.plannedStart).filter((value): value is Date => Boolean(value));
  const ends = tasks.map((task) => task.plannedEnd ?? task.plannedStart).filter((value): value is Date => Boolean(value));
  const percent = counted.length ? Math.round((done / counted.length) * 100) : 0;
  const status: SetStatus = !counted.length
    ? "CHO_XEP_LICH"
    : counted.some((task) => task.status === "TAM_DUNG")
      ? "TAM_DUNG"
      : counted.every((task) => task.status === "XONG")
        ? "HOAN_THANH"
        : counted.some((task) => task.status === "XONG" || task.status === "DANG_LAM")
          ? "DANG_SX"
          : "DA_XEP_LICH";
  return {
    percent,
    status,
    plannedStart: dates.length ? new Date(Math.min(...dates.map((d) => d.getTime()))) : null,
    plannedEnd: ends.length ? new Date(Math.max(...ends.map((d) => d.getTime()))) : null,
    done,
    total: counted.length,
  };
}
