/**
 * V149 — THỨ TỰ ƯU TIÊN KHI XẾP KẾ HOẠCH (cấu hình được, theo TỪNG CÔNG ĐOẠN).
 *
 * Vấn đề: `buildStagePlan` cần biết "bộ nào làm trước". Thứ tự đó không giống nhau ở mọi
 * công đoạn (Cắt có thể ưu tiên đơn gấp, Sơn muốn gom màu, Kho muốn gom tuyến…), nên cấu
 * hình được chia thành:
 *
 *   • một bộ quy tắc MẶC ĐỊNH (`"*"`), và
 *   • quy tắc RIÊNG cho từng công đoạn (ghi đè mặc định).
 *
 * Mỗi quy tắc = danh sách CHỈ TIÊU có TRỌNG SỐ. Điểm ưu tiên = Σ (trọng số × hệ số 0…1),
 * trong đó hệ số tính bằng hàm CHUẨN HOÁ CỐ ĐỊNH (không phụ thuộc danh sách đang xếp) để
 * kết quả ổn định: thêm/bớt một bộ không làm đổi thứ tự của các bộ còn lại.
 *
 * Mọi chỉ tiêu ở đây dùng CỘT CÓ THẬT trong DB (đã kiểm 26/09/2026) — xem
 * `HUONG_DAN_CAU_HINH_UU_TIEN_V149.md` mục 2.
 *
 * Module THUẦN — không truy vấn DB.
 */

import { dateKeyUtc, startOfDayUtc, subtractWorkingDays, workingDaysBetween, type WorkingCalendar } from "@/lib/production/calendar";
import type { ProductionSetRow } from "@/lib/production/catalog";

// ---------------------------------------------------------------------------
// 0) DỮ LIỆU ĐƠN HÀNG (cột thật của `sales_orders`) để chấm điểm ở mức đơn
// ---------------------------------------------------------------------------

export type OrderFacts = {
  orderId: number;
  orderDate: Date | null;
  orderType: string | null;
  customerCode: string | null;
  customerName: string | null;
  salesEmployeeCode: string | null;
  totalAfterDiscount: number | null;
  depositAmount: number | null;
  discountPercent: number | null;
  deliveryKm: number | null;
  region: string | null;
  mountainDistrict: boolean;
};

// ---------------------------------------------------------------------------
// 1) DANH MỤC CHỈ TIÊU (nguồn: cột thật trong DB)
// ---------------------------------------------------------------------------

export type PriorityCriterionCode =
  | "UU_TIEN_DON"
  | "HEN_GIAO"
  | "TRE_HAN"
  | "LOAI_DON"
  | "FIFO"
  | "DANG_LAM"
  | "SAN_SANG"
  | "SO_CANH"
  | "GIA_TRI_DON"
  | "DA_COC"
  | "CK_CAO"
  | "KHACH_UU_TIEN"
  | "NV_UU_TIEN"
  | "MIEN_NUI"
  | "KM_XA"
  // --- V149.1: chỉ tiêu GOM NHÓM (không cộng điểm, chỉ giữ các bộ cùng nhóm gần nhau) ---
  | "MA_DON_HANG"
  | "MAU_SON"
  | "NHOM_MAU"
  | "MODEL";

export type FifoAnchor = "TRONG_LUOT" | "VAO_KE_HOACH" | "DA_VAO_SAN_XUAT" | "NGAY_DAT_DON";

export type CriterionMeta = {
  code: PriorityCriterionCode;
  label: string;
  /** Cột thật trong DB. */
  source: string;
  /** `BO` = từ bộ (`production_sets`), `DON` = từ đơn (`sales_orders`). */
  scope: "BO" | "DON";
  /** Giải thích ngắn: giá trị nào được điểm cao. */
  meaning: string;
  defaultWeight: number;
  /**
   * `DIEM` (mặc định) = cộng điểm ưu tiên.
   * `NHOM` = **gom nhóm**: không cộng điểm, chỉ giữ các bộ cùng nhóm (cùng đơn / cùng màu / cùng model)
   *   nằm gần nhau. Trọng số khi đó là **mức ưu tiên gom** (điểm dung sai): càng cao càng siết nhóm.
   */
  kind?: "DIEM" | "NHOM";
  /** Có cần tham số riêng không (xem `criterionParams`). */
  params?: Array<"ANCHOR" | "DIRECTION">;
  /** Cảnh báo dữ liệu thật (độ đầy thấp…). */
  dataNote?: string;
};

export const PRIORITY_CRITERIA: CriterionMeta[] = [
  {
    code: "UU_TIEN_DON",
    label: "Ưu tiên nhập tay (số nhỏ = gấp)",
    source: "production_sets.priority (0–8)",
    scope: "BO",
    meaning: "priority 0 gấp nhất → 8 chậm nhất. Đã có sẵn từ trước, sửa được ở từng bộ.",
    defaultWeight: 30,
  },
  {
    code: "HEN_GIAO",
    label: "Hạn giao càng gần càng gấp",
    source: "production_sets.due_date (= sales_orders.required_delivery_date)",
    scope: "BO",
    meaning: "Còn ít ngày tới hạn giao → điểm cao. Quá hạn cũng được điểm tối đa.",
    defaultWeight: 25,
  },
  {
    code: "TRE_HAN",
    label: "Đã/ sắp trễ hạn giao",
    source: "production_sets.due_date − đệm vận chuyển",
    scope: "BO",
    meaning: "Ngày xưởng phải xong < hôm nay → điểm 1 (cứu đơn đang trễ trước).",
    defaultWeight: 25,
  },
  {
    code: "LOAI_DON",
    label: "Loại đơn: LÀM LẠI > SẢN XUẤT > MẪU",
    source: "production_sets.order_type",
    scope: "BO",
    meaning: "LÀM LẠI 1.0 · SẢN XUẤT 0.5 · MẪU 0.1",
    defaultWeight: 10,
  },
  {
    code: "FIFO",
    label: "FIFO — đơn vào trước làm trước",
    source: "xem tham số ANCHOR",
    scope: "BO",
    meaning:
      "ANCHOR=TRONG_LUOT (mặc định): bộ nào đã được xếp ở công đoạn trước thì công đoạn sau ưu tiên trước — đúng nghĩa “plan trước thì sau ưu tiên trước”.",
    defaultWeight: 20,
    params: ["ANCHOR"],
  },
  {
    code: "DANG_LAM",
    label: "Bộ đang làm dở (hoàn thiện trước)",
    source: "production_sets.started_at · percent_done",
    scope: "BO",
    meaning: "Đã vào sản xuất hoặc đã xong phần nào → điểm 1. Giúp đóng bộ sớm, giảm dở dang.",
    defaultWeight: 15,
  },
  {
    code: "SAN_SANG",
    label: "Đã sẵn chương trình + vật tư",
    source: "production_sets.program_ready · material_ready",
    scope: "BO",
    meaning: "Đủ điều kiện chạy ngay → xếp trước, tránh chờ.",
    defaultWeight: 10,
    dataNote: "Dữ liệu thật mới có 20/1.088 bộ bật 2 cờ này — nên bật khi xưởng bắt đầu dùng.",
  },
  {
    code: "SO_CANH",
    label: "Quy mô bộ (cánh/bộ)",
    source: "production_sets.canh_equivalent · quantity",
    scope: "BO",
    meaning: "Tham số DIRECTION: NHO_TRUOC = bộ nhỏ trước (xong nhiều đơn sớm) · LON_TRUOC = bộ lớn trước.",
    defaultWeight: 0,
    params: ["DIRECTION"],
  },
  {
    code: "GIA_TRI_DON",
    label: "Giá trị đơn hàng",
    source: "sales_orders.total_after_discount",
    scope: "DON",
    meaning: "Đơn giá trị lớn → điểm cao (ưu tiên dòng tiền).",
    defaultWeight: 0,
  },
  {
    code: "DA_COC",
    label: "Tỉ lệ đã đặt cọc",
    source: "sales_orders.deposit_amount ÷ total_after_discount",
    scope: "DON",
    meaning: "Khách đã trả nhiều → điểm cao.",
    defaultWeight: 0,
    dataNote: "312/518 đơn có cọc > 0 (60%).",
  },
  {
    code: "CK_CAO",
    label: "Chiết khấu cao",
    source: "sales_orders.discount_percent",
    scope: "DON",
    meaning: "Chiết khấu cao (khách lớn/đại lý) → điểm cao. 167/518 đơn có chiết khấu.",
    defaultWeight: 0,
  },
  {
    code: "KHACH_UU_TIEN",
    label: "Khách ưu tiên (danh sách)",
    source: "sales_orders.customer_code",
    scope: "DON",
    meaning: "Mã khách trong danh sách ưu tiên → điểm 1. Nhập ở ô “Khách ưu tiên”.",
    defaultWeight: 0,
  },
  {
    code: "NV_UU_TIEN",
    label: "Nhân viên kinh doanh ưu tiên (danh sách)",
    source: "sales_orders.sales_employee_code",
    scope: "DON",
    meaning: "Mã/tên nhân viên trong danh sách ưu tiên → điểm 1. 13 nhân viên trong DB.",
    defaultWeight: 0,
  },
  {
    code: "MA_DON_HANG",
    label: "Mã đơn hàng (gom các bộ cùng đơn)",
    source: "production_sets.order_code",
    scope: "BO",
    meaning:
      "Một đơn có nhiều bộ khác nhau → gom các bộ CÙNG MÃ ĐƠN lại gần nhau để đơn không bị xé lẻ. Trọng số = MỨC ƯU TIÊN GOM (điểm dung sai): càng cao càng siết (0 = không gom). DIRECTION: TANG = mã đơn nhỏ trước.",
    defaultWeight: 0,
    kind: "NHOM",
    params: ["DIRECTION"],
    dataNote: "515 đơn có bộ · trung bình 2,1 bộ/đơn · nhiều nhất 7 bộ · 210 đơn chỉ có 1 bộ (gom không tác dụng).",
  },
  {
    code: "MAU_SON",
    label: "Màu sơn (gom theo màu)",
    source: "production_sets.paint_color",
    scope: "BO",
    meaning: "Gom các bộ cùng màu → đỡ đổi màu lò sơn (mỗi lượt đổi tốn 120 phút). Trọng số = mức ưu tiên gom.",
    defaultWeight: 0,
    kind: "NHOM",
    params: ["DIRECTION"],
    dataNote: "14 màu · GM-01 có 253 bộ, GM-09 177 bộ — gom màu rất đáng làm ở công đoạn Sơn.",
  },
  {
    code: "NHOM_MAU",
    label: "Nhóm màu chính (gom lô sơn)",
    source: "production_paint_colors.family × production_sets.paint_color",
    scope: "BO",
    meaning:
      "Nhiều MÃ MÀU khác nhau nhưng cùng NHÓM CHÍNH (Đỏ / Vàng / Cát chay) thì sơn chung một lô. Hai màu khác chế độ nung (nhiệt độ/thời gian) LUÔN tách lô riêng. Mã chưa rõ nhóm thì đứng riêng, không bị trộn vào nhóm nào.",
    defaultWeight: 0,
    kind: "NHOM",
    params: ["DIRECTION"],
    dataNote: "14 mã màu → 3 nhóm chính (Đỏ 6 · Vàng 3 · Cát chay 1) + GM02/GM07/GM13/GM11 chưa rõ nhóm. Khai ở Cấu hình sản xuất → Màu sơn.",
  },
  {
    code: "MODEL",
    label: "Model (gom theo model)",
    source: "production_sets.model",
    scope: "BO",
    meaning: "Gom các bộ cùng model → đỡ đổi khuôn/chương trình ở Chấn và Bồi Lares. Trọng số = mức ưu tiên gom.",
    defaultWeight: 0,
    kind: "NHOM",
    params: ["DIRECTION"],
    dataNote: "36 model trong dữ liệu thật.",
  },
  {
    code: "MIEN_NUI",
    label: "Giao miền núi (đi xa)",
    source: "sales_orders.shipping_mountain_district",
    scope: "DON",
    meaning: "Giao miền núi cần thêm thời gian vận chuyển → làm sớm hơn.",
    defaultWeight: 0,
    dataNote: "Cột đang TRỐNG hoàn toàn (0/518) — chỉ bật khi bắt đầu nhập.",
  },
  {
    code: "KM_XA",
    label: "Khoảng cách giao xa",
    source: "sales_orders.delivery_km",
    scope: "DON",
    meaning: "Đi xa → điểm cao (chừa thời gian vận chuyển).",
    defaultWeight: 0,
    dataNote: "Chỉ 114/518 đơn có số km (22%).",
  },
];

export const CRITERION_BY_CODE = new Map(PRIORITY_CRITERIA.map((item) => [item.code, item]));

/** Danh sách mã hợp lệ — dùng khi chuẩn hoá cấu hình đọc từ DB/client. */
const VALID_CODES = new Set<string>(PRIORITY_CRITERIA.map((item) => item.code));

// ---------------------------------------------------------------------------
// 2) CẤU HÌNH
// ---------------------------------------------------------------------------

export type CriterionConfig = {
  code: PriorityCriterionCode;
  weight: number;
  /** FIFO: mốc so sánh. */
  anchor?: FifoAnchor;
  /** SO_CANH: chiều ưu tiên (nhỏ/lớn trước). Chỉ tiêu nhóm: TANG/GIAM (mã tăng/giảm dần). */
  direction?: "NHO_TRUOC" | "LON_TRUOC" | "TANG" | "GIAM";
};

export type StagePriorityRule = {
  criteria: CriterionConfig[];
};

export type PriorityConfig = {
  version: 1;
  /** Khoảng ngày dùng để chuẩn hoá "gần hạn giao" (ngày làm việc). */
  dueHorizonDays: number;
  /** Khoảng ngày dùng để chuẩn hoá FIFO theo mốc thời gian. */
  fifoHorizonDays: number;
  /** Số cánh coi là "bộ lớn" khi chuẩn hoá SO_CANH. */
  maxCanh: number;
  /** Giá trị đơn coi là "lớn" (đồng) khi chuẩn hoá GIA_TRI_DON. */
  maxOrderValue: number;
  /** Số km coi là "xa" khi chuẩn hoá KM_XA. */
  maxKm: number;
  /** Khách ưu tiên (mã khách, khớp không phân biệt hoa thường). */
  favoriteCustomers: string[];
  /** Nhân viên ưu tiên (mã hoặc tên). */
  favoriteEmployees: string[];
  /** Quy tắc MẶC ĐỊNH cho mọi công đoạn. */
  defaultRule: StagePriorityRule;
  /** Quy tắc RIÊNG theo mã công đoạn (ghi đè mặc định). */
  stageRules: Record<string, StagePriorityRule>;
};

/** Khoá lưu cấu hình trong `system_settings` (một JSON, không cần bảng mới). */
export const PRIORITY_CONFIG_SETTING_KEY = "PRODUCTION_PRIORITY_V1";

export const DEFAULT_PRIORITY_CONFIG: PriorityConfig = {
  version: 1,
  dueHorizonDays: 30,
  fifoHorizonDays: 60,
  maxCanh: 10,
  maxOrderValue: 100_000_000,
  maxKm: 200,
  favoriteCustomers: [],
  favoriteEmployees: [],
  defaultRule: {
    criteria: [
      { code: "UU_TIEN_DON", weight: 30 },
      { code: "TRE_HAN", weight: 25 },
      { code: "HEN_GIAO", weight: 25 },
      { code: "FIFO", weight: 20, anchor: "TRONG_LUOT" },
      { code: "LOAI_DON", weight: 10 },
      // V149.1 — gom các bộ cùng đơn (để 0 = chưa bật; tăng lên để siết nhóm)
      { code: "MA_DON_HANG", weight: 0, direction: "TANG" },
    ],
  },
  stageRules: {},
};

const VALID_ANCHORS = new Set<string>(["TRONG_LUOT", "VAO_KE_HOACH", "DA_VAO_SAN_XUAT", "NGAY_DAT_DON"]);
const VALID_DIRECTIONS = new Set<string>(["NHO_TRUOC", "LON_TRUOC", "TANG", "GIAM"]);

function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function normalizeRule(value: unknown, fallback: StagePriorityRule): StagePriorityRule {
  const source = (value ?? {}) as { criteria?: unknown };
  if (!Array.isArray(source.criteria)) return { criteria: fallback.criteria.map((item) => ({ ...item })) };
  const criteria: CriterionConfig[] = [];
  for (const raw of source.criteria) {
    const item = (raw ?? {}) as Record<string, unknown>;
    const code = String(item.code ?? "").trim().toUpperCase();
    if (!VALID_CODES.has(code)) continue;
    const weight = clampNumber(item.weight, 0, 1000, 0);
    const entry: CriterionConfig = { code: code as PriorityCriterionCode, weight };
    const anchor = String(item.anchor ?? "").trim().toUpperCase();
    if (VALID_ANCHORS.has(anchor)) entry.anchor = anchor as FifoAnchor;
    const direction = String(item.direction ?? "").trim().toUpperCase();
    if (VALID_DIRECTIONS.has(direction)) entry.direction = direction as CriterionConfig["direction"];
    criteria.push(entry);
  }
  return { criteria };
}

function normalizeList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(
      value
        .map((item) => String(item ?? "").trim())
        .filter(Boolean)
        .map((item) => item.toUpperCase()),
    ),
  ).slice(0, 500);
}

/** Chuẩn hoá cấu hình đọc từ DB / client — luôn trả về object đủ trường, giá trị hợp lệ. */
export function normalizePriorityConfig(value: unknown): PriorityConfig {
  const source = (value ?? {}) as Record<string, unknown>;
  const stageRules: Record<string, StagePriorityRule> = {};
  const rawRules = (source.stageRules ?? {}) as Record<string, unknown>;
  for (const [code, rule] of Object.entries(rawRules)) {
    const key = String(code).trim().toUpperCase();
    if (key && key !== "*") stageRules[key] = normalizeRule(rule, DEFAULT_PRIORITY_CONFIG.defaultRule);
  }
  return {
    version: 1,
    dueHorizonDays: clampNumber(source.dueHorizonDays, 1, 365, DEFAULT_PRIORITY_CONFIG.dueHorizonDays),
    fifoHorizonDays: clampNumber(source.fifoHorizonDays, 1, 365, DEFAULT_PRIORITY_CONFIG.fifoHorizonDays),
    maxCanh: clampNumber(source.maxCanh, 1, 10_000, DEFAULT_PRIORITY_CONFIG.maxCanh),
    maxOrderValue: clampNumber(source.maxOrderValue, 1, 1e12, DEFAULT_PRIORITY_CONFIG.maxOrderValue),
    maxKm: clampNumber(source.maxKm, 1, 5_000, DEFAULT_PRIORITY_CONFIG.maxKm),
    favoriteCustomers: normalizeList(source.favoriteCustomers),
    favoriteEmployees: normalizeList(source.favoriteEmployees),
    defaultRule: normalizeRule(source.defaultRule ?? source["*"], DEFAULT_PRIORITY_CONFIG.defaultRule),
    stageRules,
  };
}

/** Quy tắc đang áp dụng cho một công đoạn: riêng của công đoạn → mặc định. */
export function priorityRuleFor(config: PriorityConfig, stageCode: string): StagePriorityRule {
  return config.stageRules[stageCode] ?? config.defaultRule;
}

// ---------------------------------------------------------------------------
// 2b) GOM NHÓM (V149.1) — "mã đơn hàng", "màu sơn", "model"
//
// Chỉ tiêu nhóm KHÔNG cộng điểm. Nó chỉ đổi THỨ TỰ sau khi đã sắp theo điểm:
// luôn ưu tiên chọn tiếp một bộ CÙNG NHÓM với bộ vừa xếp, miễn là điểm của nó
// không thấp hơn điểm cao nhất đang chờ quá `tolerance` (chính là trọng số).
//   tolerance = 0   → không gom (giữ nguyên thứ tự theo điểm)
//   tolerance lớn   → siết nhóm (gom hết các bộ cùng đơn / cùng màu lại với nhau)
// ---------------------------------------------------------------------------

export type GroupingCode = "MA_DON_HANG" | "MAU_SON" | "NHOM_MAU" | "MODEL";

export type GroupingSpec = {
  code: GroupingCode;
  label: string;
  tolerance: number;
  direction: "TANG" | "GIAM";
};

/** Chỉ tiêu nhóm đang bật của một quy tắc (lấy cái trọng số cao nhất). */
export function groupingOf(rule: StagePriorityRule): GroupingSpec | null {
  let best: { code: GroupingCode; weight: number; direction: "TANG" | "GIAM"; label: string } | null = null;
  for (const item of rule.criteria) {
    const meta = CRITERION_BY_CODE.get(item.code);
    if (meta?.kind !== "NHOM" || item.weight <= 0) continue;
    const code = item.code as GroupingCode;
    if (!best || item.weight > best.weight) {
      best = {
        code,
        weight: item.weight,
        direction: item.direction === "GIAM" ? "GIAM" : "TANG",
        label: meta.label,
      };
    }
  }
  if (!best) return null;
  return { code: best.code, label: best.label, tolerance: best.weight, direction: best.direction };
}

/** Một dòng danh mục màu sơn (`production_paint_colors`) — `code` đã chuẩn hoá. */
export type PaintColorRow = {
  /** Có khi đọc từ bảng `production_paint_colors` (UI cần để sửa/xoá). */
  id?: number;
  code: string;
  label: string;
  colorName: string | null;
  /** Nhóm chính để gom lô: DO | VANG | CAT_CHAY | KHAC (null = chưa rõ → không gom). */
  family: string | null;
  specCode: string | null;
  tempC: number | null;
  minutes: number | null;
  needsVeneer: boolean;
  active: boolean;
  sortOrder?: number;
  note?: string | null;
};

/**
 * Hàm tra khoá nhóm màu từ danh mục. Khoá = `NHÓM CHÍNH | nhiệt độ | thời gian`
 * ⇒ hai mã màu cùng nhóm nhưng KHÁC chế độ nung vẫn tách lô (đúng kỹ thuật sơn).
 * Mã màu chưa khai nhóm → `null` (engine sẽ để riêng, không trộn).
 */
export function makePaintGroupResolver(colors: PaintColorRow[]) {
  const byCode = new Map<string, PaintColorRow>();
  for (const row of colors) {
    if (!row.active) continue;
    byCode.set(normalizePaintCode(row.code), row);
  }
  return (paintColor: string | null): string | null => {
    const key = normalizePaintCode(paintColor);
    if (!key) return null;
    const row = byCode.get(key);
    if (!row?.family) return null;
    return `${row.family}|${row.tempC ?? "-"}|${row.minutes ?? "-"}`;
  };
}

/** Bối cảnh tra nhóm màu (do tầng dữ liệu cấp, `priority.ts` vẫn thuần). */
export type GroupContext = {
  /** Trả khoá nhóm màu (nhóm chính + chế độ nung) hoặc `null` nếu mã màu chưa rõ nhóm. */
  paintGroupOf?: (paintColor: string | null) => string | null;
};

/**
 * Chuẩn hoá mã màu để khớp danh mục: `"GM-01"` · `"GM 01"` · `"gm01"` → `"GM01"`.
 * Dữ liệu thật đang dùng cả 2 kiểu viết nên phải chuẩn hoá trước khi so.
 */
export function normalizePaintCode(value: string | null | undefined): string {
  return String(value ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/** Khoá nhóm của một bộ theo chỉ tiêu nhóm. Bộ thiếu dữ liệu vẫn có khoá riêng để không gộp bừa. */
export function groupKeyOf(
  code: GroupingCode,
  set: Pick<ProductionSetRow, "orderCode" | "orderId" | "paintColor" | "model">,
  ctx?: GroupContext,
): string {
  switch (code) {
    case "MA_DON_HANG": {
      const text = String(set.orderCode ?? "").trim().toUpperCase();
      return text || `ZZZ-ORDER-${set.orderId}`;
    }
    case "MAU_SON":
      return String(set.paintColor ?? "").trim().toUpperCase() || "ZZZ-KHONG-MAU";
    case "NHOM_MAU": {
      const group = ctx?.paintGroupOf?.(set.paintColor ?? null);
      if (group) return group;
      // Chưa khai nhóm → tách riêng theo từng mã màu (không trộn vào nhóm thật nào).
      return `ZZZ-CHUA-RO-${normalizePaintCode(set.paintColor) || "TRONG"}`;
    }
    case "MODEL":
      return String(set.model ?? "").trim().toUpperCase() || "ZZZ-KHONG-MODEL";
    default:
      return "ZZZ-KHAC";
  }
}

/**
 * Sắp lại danh sách đã theo điểm để GOM NHÓM: luôn ưu tiên bộ cùng nhóm với bộ vừa xếp
 * nếu điểm không thấp hơn điểm cao nhất đang chờ quá `tolerance`.
 */
export function applyGrouping<T>(
  ordered: T[],
  spec: GroupingSpec | null,
  args: { keyOf: (item: T) => string; scoreOf: (item: T) => number },
): T[] {
  if (!spec || spec.tolerance <= 0 || ordered.length < 2) return ordered;

  const buckets = new Map<string, T[]>();
  for (const item of ordered) {
    const key = args.keyOf(item);
    const list = buckets.get(key);
    if (list) list.push(item);
    else buckets.set(key, [item]);
  }
  if (buckets.size < 2) return ordered;

  const keys = Array.from(buckets.keys());
  const pointers = new Map<string, number>(keys.map((key) => [key, 0]));
  const headOf = (key: string): T | undefined => {
    const list = buckets.get(key)!;
    const index = pointers.get(key)!;
    return index < list.length ? list[index] : undefined;
  };

  const out: T[] = [];
  let lastKey: string | null = null;
  for (let step = 0; step < ordered.length; step += 1) {
    let bestKey: string | null = null;
    let bestScore = Number.NEGATIVE_INFINITY;
    for (const key of keys) {
      const head = headOf(key);
      if (!head) continue;
      const score = args.scoreOf(head);
      if (bestKey === null || score > bestScore || (score === bestScore && compareGroupKey(key, bestKey, spec.direction) < 0)) {
        bestKey = key;
        bestScore = score;
      }
    }
    if (bestKey === null) break;

    let pickKey = bestKey;
    if (lastKey) {
      const sameHead = headOf(lastKey);
      if (sameHead && args.scoreOf(sameHead) >= bestScore - spec.tolerance) pickKey = lastKey;
    }

    const picked = headOf(pickKey)!;
    pointers.set(pickKey, pointers.get(pickKey)! + 1);
    out.push(picked);
    lastKey = pickKey;
  }
  return out;
}

function compareGroupKey(a: string, b: string, direction: "TANG" | "GIAM"): number {
  const result = a.localeCompare(b, "vi");
  return direction === "GIAM" ? -result : result;
}

// ---------------------------------------------------------------------------
// 3) CHẤM ĐIỂM
// ---------------------------------------------------------------------------

export type ScoreContext = {
  today: Date;
  calendar: WorkingCalendar;
  config: PriorityConfig;
  /** Dữ liệu đơn hàng theo `order_id` (cột thật của `sales_orders`). */
  orders?: Map<number, OrderFacts>;
  /** Bộ đã được xếp ở công đoạn trước chưa (FIFO trong lượt): setId → hạng 1,2,3… */
  rankOf?: Map<number, number>;
  /** Tổng số bộ trong lượt — dùng để chuẩn hoá FIFO trong lượt. */
  totalSets?: number;
  /** Đệm vận chuyển (ngày làm việc) — để tính ngày xưởng phải xong. */
  deliveryBufferDays: number;
};

export type ScorePart = { code: PriorityCriterionCode; weight: number; factor: number; points: number };

export type PriorityScore = {
  score: number;
  parts: ScorePart[];
};

const LOAI_DON_FACTOR: Record<string, number> = { LAM_LAI: 1, SAN_XUAT: 0.5, MAU: 0.1 };

/** Điểm ưu tiên của một bộ ở một công đoạn. Càng cao càng làm trước. */
export function scoreSet(
  set: Pick<
    ProductionSetRow,
    | "id" | "priority" | "dueDate" | "orderType" | "orderId" | "createdAt" | "startedAt" | "percentDone"
    | "programReady" | "materialReady" | "canhEquivalent" | "quantity" | "customerName"
  >,
  stageCode: string,
  ctx: ScoreContext,
): PriorityScore {
  const config = ctx.config;
  const rule = priorityRuleFor(config, stageCode);
  const order = ctx.orders?.get(Number(set.orderId));
  const due = set.dueDate ? startOfDayUtc(set.dueDate) : null;
  const workshopDue = workshopDueOf(due, ctx.deliveryBufferDays, ctx.calendar);
  const parts: ScorePart[] = [];

  const push = (code: PriorityCriterionCode, weight: number, factor: number) => {
    if (weight <= 0) return;
    const bounded = Math.min(1, Math.max(0, factor));
    parts.push({ code, weight, factor: bounded, points: weight * bounded });
  };

  for (const criterion of rule.criteria) {
    if (criterion.weight <= 0) continue;
    const weight = criterion.weight;
    switch (criterion.code) {
      case "UU_TIEN_DON": {
        // priority 0 = gấp nhất (thang 0–8 như dữ liệu thật)
        const value = Number(set.priority);
        const bounded = Number.isFinite(value) ? Math.min(8, Math.max(0, value)) : 5;
        push(criterion.code, weight, (8 - bounded) / 8);
        break;
      }
      case "HEN_GIAO": {
        if (!due) break;
        const daysLeft = workingDaysBetween(ctx.today, due, ctx.calendar);
        const horizon = Math.max(1, config.dueHorizonDays);
        const factor = due.getTime() < ctx.today.getTime() ? 1 : 1 - daysLeft / horizon;
        push(criterion.code, weight, factor);
        break;
      }
      case "TRE_HAN": {
        if (!workshopDue) break;
        push(criterion.code, weight, workshopDue.getTime() < ctx.today.getTime() ? 1 : 0);
        break;
      }
      case "LOAI_DON": {
        push(criterion.code, weight, LOAI_DON_FACTOR[String(set.orderType ?? "").toUpperCase()] ?? 0.5);
        break;
      }
      case "FIFO": {
        push(criterion.code, weight, fifoFactor(set, criterion, ctx, order ?? null));
        break;
      }
      case "DANG_LAM": {
        const started = Boolean(set.startedAt) || Number(set.percentDone ?? 0) > 0;
        push(criterion.code, weight, started ? 1 : 0);
        break;
      }
      case "SAN_SANG": {
        push(criterion.code, weight, set.programReady && set.materialReady ? 1 : 0);
        break;
      }
      case "SO_CANH": {
        const canh = Math.max(0, Number(set.canhEquivalent) || 0);
        const ratio = Math.min(1, canh / Math.max(1, config.maxCanh));
        push(criterion.code, weight, criterion.direction === "LON_TRUOC" ? ratio : 1 - ratio);
        break;
      }
      case "GIA_TRI_DON": {
        const value = Number(order?.totalAfterDiscount ?? 0);
        push(criterion.code, weight, value / Math.max(1, config.maxOrderValue));
        break;
      }
      case "DA_COC": {
        const total = Number(order?.totalAfterDiscount ?? 0);
        const deposit = Number(order?.depositAmount ?? 0);
        if (total <= 0) break;
        push(criterion.code, weight, deposit / total);
        break;
      }
      case "CK_CAO": {
        const percent = Number(order?.discountPercent ?? 0);
        push(criterion.code, weight, percent / 30);
        break;
      }
      case "KHACH_UU_TIEN": {
        const code = String(order?.customerCode ?? "").trim().toUpperCase();
        push(criterion.code, weight, code && config.favoriteCustomers.includes(code) ? 1 : 0);
        break;
      }
      case "NV_UU_TIEN": {
        const code = String(order?.salesEmployeeCode ?? "").trim().toUpperCase();
        push(criterion.code, weight, code && config.favoriteEmployees.includes(code) ? 1 : 0);
        break;
      }
      case "MIEN_NUI": {
        push(criterion.code, weight, order?.mountainDistrict ? 1 : 0);
        break;
      }
      case "KM_XA": {
        const km = Number(order?.deliveryKm ?? 0);
        if (!(km > 0)) break;
        push(criterion.code, weight, km / Math.max(1, config.maxKm));
        break;
      }
      default:
        break;
    }
  }

  const score = parts.reduce((sum, part) => sum + part.points, 0);
  return { score, parts };
}

function fifoFactor(
  set: Pick<ProductionSetRow, "id" | "createdAt" | "startedAt">,
  criterion: CriterionConfig,
  ctx: ScoreContext,
  order: OrderFacts | null,
): number {
  const anchor = criterion.anchor ?? "TRONG_LUOT";
  const horizon = Math.max(1, ctx.config.fifoHorizonDays);

  if (anchor === "TRONG_LUOT") {
    const rank = ctx.rankOf?.get(set.id);
    const total = Math.max(1, ctx.totalSets ?? 1);
    if (rank === undefined) return 0; // chưa được xếp ở công đoạn nào → đứng sau
    return 1 - (rank - 1) / total;
  }

  const anchorDate =
    anchor === "VAO_KE_HOACH"
      ? set.createdAt
      : anchor === "DA_VAO_SAN_XUAT"
        ? set.startedAt
        : order?.orderDate ?? null;
  if (!anchorDate) return 0;
  const ageDays = workingDaysBetween(startOfDayUtc(anchorDate), ctx.today, ctx.calendar);
  return ageDays / horizon;
}

/** Ngày xưởng phải xong = hạn giao − đệm vận chuyển (dùng chung cho chấm điểm + đối chiếu). */
export function workshopDueOf(
  dueDate: Date | null,
  bufferDays: number,
  calendar: WorkingCalendar,
): Date | null {
  if (!dueDate) return null;
  return subtractWorkingDays(dueDate, Math.max(0, Math.trunc(Number(bufferDays) || 0)), calendar);
}

/**
 * Sắp danh sách theo điểm ưu tiên giảm dần.
 * Đồng điểm → FIFO theo ngày vào kế hoạch (`created_at`) → id (ổn định).
 */
export function sortByPriorityScore<T>(
  items: T[],
  scoreOf: (item: T) => number,
  fifoKeyOf: (item: T) => number,
): T[] {
  return [...items]
    .map((item, index) => ({ item, index, score: scoreOf(item), fifo: fifoKeyOf(item) }))
    .sort((a, b) => b.score - a.score || a.fifo - b.fifo || a.index - b.index)
    .map((entry) => entry.item);
}

/** Nhãn ngắn để hiện trên UI, vd "Bồi Lares". */
export function criterionLabel(code: PriorityCriterionCode): string {
  return CRITERION_BY_CODE.get(code)?.label ?? code;
}

/** Ngày (YYYY-MM-DD) — tiện cho log/kiểm tra. */
export function dayKeyOf(value: Date | null | undefined): string | null {
  return value ? dateKeyUtc(value) : null;
}
