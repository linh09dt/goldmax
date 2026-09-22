import { DEFAULT_DISCOUNT_PERCENT } from "@/lib/order-output";
export { DEFAULT_DISCOUNT_PERCENT };

export const ORDER_STATUS_OPTIONS = [
  { value: "NHAP", label: "Nháp" },
  { value: "CHO_XAC_NHAN", label: "Chờ khách hàng xác nhận" },
  { value: "DA_XAC_NHAN", label: "Đã xác nhận" },
  { value: "CHUYEN_SAN_XUAT", label: "Đã chuyển sản xuất" },
  { value: "HUY", label: "Đã hủy" },
] as const;

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

export function toDateInput(value: Date | string | null | undefined) {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
