import { DEFAULT_DISCOUNT_PERCENT } from "@/lib/order-output";
export { DEFAULT_DISCOUNT_PERCENT };

/**
 * V91: đơn hàng chỉ còn 2 trạng thái — Đơn hàng mẫu (đang nhập / lưu nháp) và Sản xuất.
 * Trạng thái do HÀNH ĐỘNG khi lưu quyết định (Lưu nháp / Lưu đơn hàng), không chọn tay trên form.
 */
export const ORDER_STATUS_OPTIONS = [
  { value: "NHAP", label: "Đơn hàng mẫu" },
  { value: "CHUYEN_SAN_XUAT", label: "Sản xuất" },
] as const;

/** Mã trạng thái đơn hàng mẫu (chưa vào sản xuất). */
export const ORDER_STATUS_SAMPLE = "NHAP";
/** Mã trạng thái đã vào sản xuất. */
export const ORDER_STATUS_PRODUCTION = "CHUYEN_SAN_XUAT";

/**
 * V91: đơn lưu trước đây còn mã trạng thái cũ → quy về 2 trạng thái mới khi hiển thị.
 * "Đã hủy" giữ riêng để đơn đã hủy không bị hiển thị nhầm thành đang sản xuất.
 */
const LEGACY_STATUS_LABELS: Record<string, string> = {
  CHO_XAC_NHAN: "Đơn hàng mẫu",
  DA_XAC_NHAN: "Sản xuất",
  HUY: "Đã hủy",
};

export function orderStatusLabel(status: string | null | undefined) {
  const value = String(status ?? "").trim();
  const option = ORDER_STATUS_OPTIONS.find((item) => item.value === value);
  if (option) return option.label;
  return LEGACY_STATUS_LABELS[value] ?? (value || "—");
}

/** Đơn đã vào sản xuất (gồm cả mã cũ "Đã xác nhận"). */
export function isProductionStatus(status: string | null | undefined) {
  const value = String(status ?? "").trim();
  return value === ORDER_STATUS_PRODUCTION || value === "DA_XAC_NHAN";
}

export type OrderSaveAction = "DRAFT" | "ORDER";

/**
 * V91: trạng thái sau khi lưu.
 * - Lưu đơn hàng → Sản xuất.
 * - Lưu nháp → giữ Đơn hàng mẫu; đơn đã vào sản xuất thì KHÔNG bị hạ cấp về mẫu.
 */
export function statusAfterSave(currentStatus: string | null | undefined, action: OrderSaveAction) {
  if (action === "ORDER") return ORDER_STATUS_PRODUCTION;
  return isProductionStatus(currentStatus) ? ORDER_STATUS_PRODUCTION : ORDER_STATUS_SAMPLE;
}

/**
 * V75: Bộ số do hệ thống tự tăng dần khi đơn đã vào sản xuất (gồm mã cũ "Đã xác nhận").
 * Đơn ở trạng thái Đơn hàng mẫu chưa có Bộ số nên không hiển thị.
 */
export const SET_NUMBER_STATUSES: readonly string[] = ["DA_XAC_NHAN", "CHUYEN_SAN_XUAT"];

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
  modelCheck: string;
  priceCheck: string;
  /**
   * V59: chỉ dùng ở giao diện. "1" = người dùng đã nhập KH/Lượng bằng tay
   * → hệ thống giữ nguyên, không tính lại tự động cho dòng đó. Không lưu xuống DB.
   */
  pricingManual?: string;
};

export type OrderItemForm = Omit<OrderLineForm, "rowOrder" | "detailType"> & {
  clientId: string;
  lineNo: number;
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
    details: [],
  };
}

export function createDefaultOrderForm(): OrderFormData {
  const now = new Date();
  return {
    orderCode: draftOrderCode(now),
    status: "NHAP",
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
