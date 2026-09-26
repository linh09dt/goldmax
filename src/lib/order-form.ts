import { DEFAULT_DISCOUNT_PERCENT } from "@/lib/order-output";
export { DEFAULT_DISCOUNT_PERCENT };

/**
 * V112 — Tách rõ hai khái niệm (trước V112 bị gộp trong một ô `status`):
 *
 * 1. **LOẠI ĐƠN** (`orderType`) — chọn khi tạo đơn, có 3 loại:
 *      - `MAU`      = Đơn hàng mẫu
 *      - `SAN_XUAT` = Sản xuất
 *      - `LAM_LAI`  = Đơn làm lại
 * 2. **TRẠNG THÁI** (`status`) — mọi loại đơn đều có 2 trạng thái, do nút Lưu quyết định:
 *      - `NHAP`        = Đơn nháp       (bấm "Lưu nháp")
 *      - `DA_XAC_NHAN` = Đã xác nhận    (bấm "Lưu đơn hàng")
 *    **Bộ số chỉ được cấp khi đơn đã xác nhận** (bất kể loại đơn nào).
 */
export const ORDER_TYPE_OPTIONS = [
  { value: "MAU", label: "Đơn hàng mẫu" },
  { value: "SAN_XUAT", label: "Sản xuất" },
  { value: "LAM_LAI", label: "Đơn làm lại" },
] as const;

export type OrderTypeCode = (typeof ORDER_TYPE_OPTIONS)[number]["value"];

export const ORDER_TYPE_SAMPLE = "MAU";
export const ORDER_TYPE_PRODUCTION = "SAN_XUAT";
export const ORDER_TYPE_REMAKE = "LAM_LAI";
export const DEFAULT_ORDER_TYPE: OrderTypeCode = ORDER_TYPE_SAMPLE;

export function orderTypeLabel(value: string | null | undefined) {
  const code = String(value ?? "").trim();
  const option = ORDER_TYPE_OPTIONS.find((item) => item.value === code);
  return option?.label ?? (code || "—");
}

/** Mã loại đơn luôn hợp lệ để ghi DB (mã lạ → Đơn hàng mẫu). */
export function normalizeOrderType(value: string | null | undefined): OrderTypeCode {
  const code = String(value ?? "").trim();
  const option = ORDER_TYPE_OPTIONS.find((item) => item.value === code);
  return option ? option.value : DEFAULT_ORDER_TYPE;
}

export const ORDER_STATUS_OPTIONS = [
  { value: "NHAP", label: "Đơn nháp" },
  { value: "DA_XAC_NHAN", label: "Đã xác nhận" },
] as const;

/** Đơn nháp (chưa xác nhận) — chưa có Bộ số. */
export const ORDER_STATUS_DRAFT = "NHAP";
/** Đơn đã xác nhận — đã có Bộ số. */
export const ORDER_STATUS_CONFIRMED = "DA_XAC_NHAN";

/** Mã dùng để truy vấn: chỉ còn "Đã xác nhận" (kèm mã cũ trước V112 để dữ liệu cũ vẫn lọc được). */
export const CONFIRMED_STATUS_CODES: string[] = [ORDER_STATUS_CONFIRMED, "CHUYEN_SAN_XUAT", "DA_XAC_NHAN"];
export const DRAFT_STATUS_CODES: string[] = [ORDER_STATUS_DRAFT, "CHO_XAC_NHAN"];
/** Loại đơn tính vào doanh thu: chỉ đơn Sản xuất. */
export const PRODUCTION_ORDER_TYPES: string[] = [ORDER_TYPE_PRODUCTION];

/**
 * Nhãn trạng thái. Đơn lưu trước V112 còn mã gộp (`CHUYEN_SAN_XUAT` = vừa là loại vừa là trạng thái)
 * nên vẫn quy đổi khi hiển thị; "Đã hủy" giữ riêng để đơn đã huỷ không bị hiện nhầm.
 */
const LEGACY_STATUS_LABELS: Record<string, string> = {
  CHUYEN_SAN_XUAT: "Đã xác nhận",
  CHO_XAC_NHAN: "Đơn nháp",
  HUY: "Đã hủy",
};

export function orderStatusLabel(status: string | null | undefined) {
  const value = String(status ?? "").trim();
  const option = ORDER_STATUS_OPTIONS.find((item) => item.value === value);
  if (option) return option.label;
  return LEGACY_STATUS_LABELS[value] ?? (value || "—");
}

/** Đơn đã xác nhận (gồm mã cũ trước V112). */
export function isConfirmedStatus(status: string | null | undefined) {
  const value = String(status ?? "").trim();
  return value === ORDER_STATUS_CONFIRMED || value === "CHUYEN_SAN_XUAT" || value === "DA_XAC_NHAN";
}

export type OrderSaveAction = "DRAFT" | "ORDER";

/**
 * V112: trạng thái sau khi lưu — do hành động bấm nút quyết định.
 * - "Lưu đơn hàng" (ORDER)   → Đã xác nhận.
 * - "Lưu nháp" (DRAFT)       → Đơn nháp; đơn đã xác nhận thì KHÔNG bị hạ cấp về nháp
 *                              (tránh việc sửa nhỏ rồi lưu nháp làm mất hiệu lực đơn đã xác nhận).
 */
export function statusAfterSave(currentStatus: string | null | undefined, action: OrderSaveAction) {
  if (action === "ORDER") return ORDER_STATUS_CONFIRMED;
  return isConfirmedStatus(currentStatus) ? ORDER_STATUS_CONFIRMED : ORDER_STATUS_DRAFT;
}

/** V112: Bộ số chỉ có khi đơn ĐÃ XÁC NHẬN (mọi loại đơn). */
export const SET_NUMBER_STATUSES: readonly string[] = [ORDER_STATUS_CONFIRMED, "CHUYEN_SAN_XUAT", "DA_XAC_NHAN"];

export function showsSetNumber(status: string | null | undefined) {
  return SET_NUMBER_STATUSES.includes(String(status ?? "").trim());
}

export const DEFAULT_REQUIREMENTS = [
  { code: "NEN_GIAT_CAP", questionText: "Nền có giật cấp hay không?" },
  { code: "KICH_THUOC_DA_TRU", questionText: "Kích thước đã trừ chưa?" },
  { code: "PHAO_XI_MANG", questionText: "Mép tường có đắp phào xi măng hay không?" },
  { code: "PHAO_LUX_LEN_TRAN", questionText: "Lắp phào LUX: hỏi mép tường lên trần?" },
  { code: "TUONG_T_HOAC_I", questionText: "Có thuộc tường chữ T hoặc I không?" },
  { code: "CUA_4_CANH_XAC_NHAN_KT", questionText: "Cửa 4 cánh xác nhận chiều rộng và cao" },
] as const;

export type OrderLineForm = {
  rowOrder: number;
  detailType: string;
  setNo: string;
  productName: string;
  productCode: string;
  model: string;
  openingDirection: string;
  trimDirection: string;
  paintColor: string;
  heightMm: string;
  widthMm: string;
  frameMm: string;
  clearHeightMm: string;
  clearWidthMm: string;
  panelInfo: string;
  trimBarsPerSet: string;
  trimType: string;
  lockModel: string;
  windowBars: string;
  leavesPerSet: string;
  quantity: string;
  unit: string;
  pricingQuantity: string;
  unitPrice: string;
  amount: string;
  note: string;
  imagePath: string;
  /**
   * V131: kích thước ảnh SP do người dùng chỉnh tay (px, dạng chuỗi cho input).
   * Để trống = chế độ tự động (ảnh vừa ô khi xuất file).
   */
  imageWidth?: string;
  imageHeight?: string;
  modelCheck: string;
  priceCheck: string;
  /**
   * V59: chỉ dùng ở giao diện. "1" = người dùng đã nhập KH/Lượng bằng tay
   * → hệ thống giữ nguyên, không tính lại tự động cho dòng đó. Không lưu xuống DB.
   */
  pricingManual?: string;
};

/** V133: một ảnh trong gallery của bộ cửa (kích thước px để trống = tự động vừa ô). */
export type OrderImageForm = {
  path: string;
  width?: string;
  height?: string;
};

/** V133: tối đa số ảnh cho một bộ cửa — giới hạn để file xuất không bị vỡ bố cục. */
export const MAX_ORDER_IMAGES = 6;

/** Trường dạng chuỗi của một bộ cửa (không gồm clientId/lineNo/details/images). */
export type OrderItemTextField = keyof Omit<OrderItemForm, "clientId" | "lineNo" | "details" | "images">;

export type OrderItemForm = Omit<OrderLineForm, "rowOrder" | "detailType"> & {
  clientId: string;
  lineNo: number;
  /** V133: nhiều ảnh của bộ cửa; ảnh số 1 được gương vào imagePath/imageWidth/imageHeight. */
  images: OrderImageForm[];
  details: OrderLineForm[];
};

export type RequirementForm = {
  code: string;
  questionText: string;
  answer: string;
  note: string;
  sortOrder: number;
};

export type OrderFormData = {
  orderCode: string;
  /** V112: loại đơn — chọn khi tạo đơn (MAU | SAN_XUAT | LAM_LAI). */
  orderType: string;
  /** V112: trạng thái — do nút Lưu quyết định (NHAP | DA_XAC_NHAN). */
  status: string;
  customerCode: string;
  customerName: string;
  salesEmployeeCode: string;
  orderDate: string;
  requiredDeliveryDate: string;
  receiverName: string;
  receiverPhone: string;
  receiverAddress: string;
  deliveryKm: string;
  region: string;
  groupNo: string;
  excelUpdateDate: string;
  formCode: string;
  formEffectiveDate: string;
  shippingFee: string;
  discountPercent: string;
  depositAmount: string;
  warehouseReceiptDeduction: string;
  requirements: RequirementForm[];
  items: OrderItemForm[];
};

const EMPTY_LINE: Omit<OrderLineForm, "rowOrder" | "detailType"> = {
  setNo: "0",
  productName: "",
  productCode: "",
  model: "",
  openingDirection: "",
  trimDirection: "",
  paintColor: "",
  heightMm: "",
  widthMm: "",
  frameMm: "",
  clearHeightMm: "",
  clearWidthMm: "",
  panelInfo: "",
  trimBarsPerSet: "",
  trimType: "",
  lockModel: "",
  windowBars: "",
  leavesPerSet: "",
  quantity: "",
  unit: "",
  pricingQuantity: "",
  unitPrice: "",
  amount: "",
  note: "",
  imagePath: "",
  modelCheck: "",
  priceCheck: "",
};

export function createDoorDetails(): OrderLineForm[] {
  return [];
}

export function createWindowDetails(): OrderLineForm[] {
  return [];
}

export function createEmptyDetails(): OrderLineForm[] {
  return [];
}

export function createOrderItem(lineNo: number, _kind: "door" | "window" | "empty" = "door"): OrderItemForm {
  return {
    clientId: newClientId(),
    lineNo,
    ...EMPTY_LINE,
    setNo: "",
    quantity: "1",
    unit: "",
    images: [],
    details: [],
  };
}

export function createDefaultOrderForm(): OrderFormData {
  const now = new Date();
  return {
    orderCode: draftOrderCode(now),
    orderType: DEFAULT_ORDER_TYPE,
    status: ORDER_STATUS_DRAFT,
    customerCode: "",
    customerName: "",
    salesEmployeeCode: "",
    orderDate: toDateInput(now),
    requiredDeliveryDate: "",
    receiverName: "",
    receiverPhone: "",
    receiverAddress: "",
    deliveryKm: "",
    region: "",
    groupNo: "",
    excelUpdateDate: "",
    formCode: "QP-01",
    formEffectiveDate: "2023-05-05",
    shippingFee: "0",
    discountPercent: String(DEFAULT_DISCOUNT_PERCENT),
    depositAmount: "0",
    warehouseReceiptDeduction: "0",
    requirements: DEFAULT_REQUIREMENTS.map((item, index) => ({
      ...item,
      answer: "",
      note: "",
      sortOrder: index + 1,
    })),
    items: [createOrderItem(1, "door")],
  };
}

export function reindexItems(items: OrderItemForm[]) {
  return items.map((item, index) => ({
    ...item,
    lineNo: index + 1,
    details: item.details.map((row, rowIndex) => ({ ...row, rowOrder: rowIndex + 1 })),
  }));
}

export function newClientId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `row-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function draftOrderCode(date: Date) {
  const pad = (value: number) => value.toString().padStart(2, "0");
  return `NHAP-${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}

/**
 * V77: ngày hôm nay theo giờ MÁY NGƯỜI DÙNG. `toDateInput` dùng getUTC* nên khi
 * server ở UTC (Vercel) đơn tạo trước 7h sáng giờ VN sẽ bị mặc định sang ngày hôm trước.
 */
export function localTodayInput(date: Date = new Date()) {
  const pad = (value: number) => value.toString().padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function toDateInput(value: Date | string | null | undefined) {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
