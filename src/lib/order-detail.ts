export type OrderDetailViewLine = {
  id?: number;
  rowOrder: number;
  detailType: string | null;
  setNo: string | null;
  productName: string | null;
  productCode: string | null;
  model: string | null;
  openingDirection: string | null;
  trimDirection: string | null;
  paintColor: string | null;
  heightMm: number | null;
  widthMm: number | null;
  frameMm: number | null;
  clearHeightMm: number | null;
  clearWidthMm: number | null;
  panelInfo: string | null;
  trimBarsPerSet: number | null;
  trimType: string | null;
  lockModel: string | null;
  windowBars: string | null;
  leavesPerSet: number | null;
  quantity: number | null;
  unit: string | null;
  pricingQuantity: number | null;
  unitPrice: unknown;
  amount: unknown;
  note: string | null;
  imagePath: string | null;
  modelCheck: string | null;
  priceCheck: string | null;
  sourceRow: number | null;
};

type DetailSource = Partial<OrderDetailViewLine> & Record<string, unknown>;

type OrderItemWithDetailFallback = {
  details?: DetailSource[];
  rawBlock?: unknown;
};

const TEMPLATE_DETAIL_NAMES = new Set([
  "phào rời",
  "phào lux (thanh đứng )",
  "phào lux (thanh đứng)",
  "phào lux (thanh đỉnh )",
  "phào lux (thanh đỉnh)",
  "phào lux ( thanh ngang )",
  "phào lux (thanh ngang)",
  "thông tin về khóa",
  "chi phí khoét khóa tc",
  "chi phí khoét pano",
  "chi phí khoét kính",
  "phụ phí huỳnh trống đồng",
  "phụ phí cách âm khuôn",
  "song cửa sổ",
  "khác",
]);

/**
 * Lấy các dòng chi tiết cần hiển thị cho một bộ cửa.
 * - Ưu tiên dữ liệu đã chuẩn hóa trong sales_order_item_details.
 * - Nếu đơn được import bằng phiên bản cũ chưa có detail rows, tự phục hồi từ rawBlock.
 * - Chỉ giữ các dòng thực sự có thông tin, không hiện các dòng mẫu chỉ có dấu '-' / 0.
 */
export function resolveOrderItemDetails(item: OrderItemWithDetailFallback): OrderDetailViewLine[] {
  const databaseRows = Array.isArray(item.details)
    ? item.details.map((row, index) => normalizeDetailRow(row, index + 1))
    : [];

  const sourceRows = databaseRows.length > 0 ? databaseRows : detailRowsFromRawBlock(item.rawBlock);
  return sourceRows.filter(isMeaningfulOrderDetail);
}

/** Dùng chung cho parser Excel để chỉ lưu những dòng chi tiết có dữ liệu. */
export function isMeaningfulOrderDetail(row: Record<string, unknown>): boolean {
  const payloadFields = [
    "setNo",
    "productCode",
    "model",
    "openingDirection",
    "trimDirection",
    "paintColor",
    "heightMm",
    "widthMm",
    "frameMm",
    "clearHeightMm",
    "clearWidthMm",
    "panelInfo",
    "trimBarsPerSet",
    "trimType",
    "lockModel",
    "windowBars",
    "leavesPerSet",
    "quantity",
    "unit",
    "pricingQuantity",
    "unitPrice",
    "amount",
    "note",
    "imagePath",
    "modelCheck",
    "priceCheck",
  ] as const;

  if (payloadFields.some((field) => hasActualValue(row[field]))) return true;

  const name = normalizeText(row.productName);
  if (!name) return false;

  // Tên do người dùng tự thêm vẫn là dữ liệu. Các nhãn mẫu chỉ hiện khi có dữ liệu đi kèm.
  return !TEMPLATE_DETAIL_NAMES.has(name.toLocaleLowerCase("vi-VN"));
}

export function detailRowsFromRawBlock(rawBlock: unknown): OrderDetailViewLine[] {
  if (!Array.isArray(rawBlock)) return [];

  const rows = rawBlock.filter(isRecord);
  if (rows.length <= 1) return [];

  return rows.slice(1).map((row, index) => rawRowToDetail(row, index + 1));
}

function rawRowToDetail(row: Record<string, unknown>, rowOrder: number): OrderDetailViewLine {
  const productName = textValue(row.C);
  return {
    rowOrder,
    detailType: normalizeText(productName)?.toLocaleLowerCase("vi-VN") === "khác" ? "KHAC" : "CHI_TIET_MAU",
    setNo: placeholderText(row.B),
    productName,
    productCode: placeholderText(row.D),
    model: placeholderText(row.E),
    openingDirection: placeholderText(row.F),
    trimDirection: placeholderText(row.G),
    paintColor: placeholderText(row.H),
    heightMm: integerValue(row.I),
    widthMm: integerValue(row.J),
    frameMm: integerValue(row.K),
    clearHeightMm: integerValue(row.L),
    clearWidthMm: integerValue(row.M),
    panelInfo: placeholderText(row.N),
    trimBarsPerSet: integerValue(row.O),
    trimType: placeholderText(row.P),
    lockModel: placeholderText(row.Q),
    windowBars: placeholderText(row.R),
    leavesPerSet: integerValue(row.S),
    quantity: integerValue(row.T),
    unit: placeholderText(row.U),
    pricingQuantity: numberValue(row.V),
    unitPrice: numberValue(row.W),
    amount: numberValue(row.X),
    note: placeholderText(row.Y),
    imagePath: null,
    modelCheck: placeholderText(row.AH),
    priceCheck: placeholderText(row.AI),
    sourceRow: integerValue(row.row),
  };
}

function normalizeDetailRow(row: DetailSource, fallbackOrder: number): OrderDetailViewLine {
  return {
    id: typeof row.id === "number" ? row.id : undefined,
    rowOrder: integerValue(row.rowOrder) ?? fallbackOrder,
    detailType: textValue(row.detailType),
    setNo: placeholderText(row.setNo),
    productName: textValue(row.productName),
    productCode: placeholderText(row.productCode),
    model: placeholderText(row.model),
    openingDirection: placeholderText(row.openingDirection),
    trimDirection: placeholderText(row.trimDirection),
    paintColor: placeholderText(row.paintColor),
    heightMm: integerValue(row.heightMm),
    widthMm: integerValue(row.widthMm),
    frameMm: integerValue(row.frameMm),
    clearHeightMm: integerValue(row.clearHeightMm),
    clearWidthMm: integerValue(row.clearWidthMm),
    panelInfo: placeholderText(row.panelInfo),
    trimBarsPerSet: integerValue(row.trimBarsPerSet),
    trimType: placeholderText(row.trimType),
    lockModel: placeholderText(row.lockModel),
    windowBars: placeholderText(row.windowBars),
    leavesPerSet: integerValue(row.leavesPerSet),
    quantity: integerValue(row.quantity),
    unit: placeholderText(row.unit),
    pricingQuantity: numberValue(row.pricingQuantity),
    unitPrice: row.unitPrice ?? null,
    amount: row.amount ?? null,
    note: placeholderText(row.note),
    imagePath: placeholderText(row.imagePath),
    modelCheck: placeholderText(row.modelCheck),
    priceCheck: placeholderText(row.priceCheck),
    sourceRow: integerValue(row.sourceRow),
  };
}

function hasActualValue(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === "number") return Number.isFinite(value) && value !== 0;
  if (typeof value === "boolean") return value;

  const normalized = String(value).trim();
  if (!normalized || isExcelError(normalized)) return false;
  return !["-", "—", "0", "0.0", "0.00", "0,00"].includes(normalized);
}

function placeholderText(value: unknown): string | null {
  const normalized = normalizeText(value);
  if (!normalized || isExcelError(normalized) || ["-", "—", "0"].includes(normalized)) return null;
  return normalized;
}

function textValue(value: unknown): string | null {
  return normalizeText(value);
}

function normalizeText(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text ? text : null;
}


function isExcelError(value: string) {
  return /^#(?:N\/A|VALUE!|REF!|DIV\/0!|NAME\?|NUM!|NULL!|SPILL!|CALC!)/i.test(value);
}

function numberValue(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const normalized = String(value).trim().replace(/,/g, "");
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function integerValue(value: unknown): number | null {
  const parsed = numberValue(value);
  return parsed === null ? null : Math.trunc(parsed);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
