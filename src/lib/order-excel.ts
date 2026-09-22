import ExcelJS, { type CellValue, type Worksheet } from "exceljs";
import { isMeaningfulOrderDetail } from "@/lib/order-detail";

export type ParsedOrderLine = {
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
  unitPrice: number | null;
  amount: number | null;
  note: string | null;
  modelCheck: string | null;
  priceCheck: string | null;
  sourceRow: number;
};

export type ParsedOrderItem = Omit<ParsedOrderLine, "rowOrder" | "detailType"> & {
  lineNo: number;
  rawBlock: Record<string, unknown>[];
  details: ParsedOrderLine[];
};

export type ParsedRequirement = {
  code: string;
  questionText: string;
  answer: string | null;
  note: string | null;
  sortOrder: number;
};

export type ParsedSalesOrder = {
  sheetName: string;
  orderCode: string;
  customerCode: string | null;
  customerName: string | null;
  salesEmployeeCode: string | null;
  orderDate: Date | null;
  requiredDeliveryDate: Date | null;
  receiverAddress: string | null;
  deliveryKm: number | null;
  region: string | null;
  groupNo: number | null;
  excelUpdateDate: Date | null;
  formCode: string | null;
  formEffectiveDate: Date | null;
  shippingFee: number | null;
  subtotal: number | null;
  discountPercent: number | null;
  discountAmount: number | null;
  totalAfterDiscount: number | null;
  depositAmount: number | null;
  warehouseReceiptDeduction: number | null;
  deliveryPayment: number | null;
  requirements: ParsedRequirement[];
  items: ParsedOrderItem[];
};

const RAW_COLUMNS = Array.from({ length: 35 }, (_, index) => columnName(index + 1));

const REQUIREMENTS = [
  { row: 317, code: "NEN_GIAT_CAP" },
  { row: 318, code: "KICH_THUOC_DA_TRU" },
  { row: 319, code: "PHAO_XI_MANG" },
  { row: 320, code: "PHAO_LUX_LEN_TRAN" },
  { row: 321, code: "TUONG_T_HOAC_I" },
  { row: 322, code: "CUA_4_CANH_XAC_NHAN_KT" },
] as const;

export async function parseOrderWorkbook(buffer: Buffer): Promise<ParsedSalesOrder> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ArrayBuffer);

  const worksheet = workbook.worksheets[0];
  if (!worksheet) throw new Error("File Excel không có worksheet.");

  validateTemplate(worksheet);

  const orderCode = text(worksheet, "I4");
  if (!orderCode) throw new Error("Không tìm thấy Mã Đơn hàng tại ô I4.");

  const mainRows = findMainRows(worksheet);
  const items = mainRows
    .map((rowNumber, index) => {
      const nextMainRow = mainRows[index + 1] ?? findOrderSectionEnd(worksheet, rowNumber);
      return parseMainItem(worksheet, rowNumber, Math.min(nextMainRow - 1, rowNumber + 14));
    })
    .filter(isRealItem);

  if (items.length === 0) throw new Error("Không tìm thấy dòng cửa thực tế để import.");

  return {
    sheetName: worksheet.name,
    orderCode,
    customerCode: text(worksheet, "C4"),
    customerName: text(worksheet, "C5"),
    salesEmployeeCode: text(worksheet, "C6"),
    orderDate: dateValue(worksheet.getCell("I5").value),
    requiredDeliveryDate: dateValue(worksheet.getCell("I6").value),
    receiverAddress: firstText(worksheet, ["U4", "V4", "W4", "X4", "Y4"]),
    deliveryKm: numberValue(worksheet, "V5"),
    region: text(worksheet, "Y5"),
    groupNo: integer(worksheet, "V6"),
    excelUpdateDate: firstDate(worksheet, ["AB4", "AC4", "AD4", "AE4", "AF4", "AG4"]),
    formCode: text(worksheet, "AA1"),
    formEffectiveDate: dateValue(worksheet.getCell("AA2").value),
    shippingFee: numberValue(worksheet, "X311"),
    subtotal: numberValue(worksheet, "X313"),
    discountPercent: firstNumber(worksheet, ["X314", "W314", "U314"]),
    discountAmount: numberValue(worksheet, "X315"),
    totalAfterDiscount: numberValue(worksheet, "X316"),
    depositAmount: numberValue(worksheet, "X317"),
    warehouseReceiptDeduction: numberValue(worksheet, "X318"),
    deliveryPayment: numberValue(worksheet, "X319"),
    requirements: parseRequirements(worksheet),
    items,
  };
}

function validateTemplate(worksheet: Worksheet) {
  const checks: Array<[string, string]> = [
    ["A4", "Mã Khách hàng"],
    ["G4", "Mã Đơn hàng"],
    ["A8", "STT"],
    ["B8", "Bộ số"],
    ["C8", "Tên sản phẩm"],
    ["Y8", "Ghi chú"],
  ];

  const invalid = checks.find(([address, expected]) => {
    const current = text(worksheet, address)?.toLocaleLowerCase("vi-VN") ?? "";
    return !current.includes(expected.toLocaleLowerCase("vi-VN"));
  });

  if (invalid) {
    throw new Error(`File không đúng mẫu Đơn hàng hiện tại. Không tìm thấy tiêu đề "${invalid[1]}" tại ô ${invalid[0]}.`);
  }
}

function findMainRows(worksheet: Worksheet): number[] {
  const result: number[] = [];
  const maxRow = Math.min(Math.max(worksheet.rowCount, 10), 1000);
  for (let row = 10; row <= maxRow; row += 1) {
    const lineNo = integer(worksheet, `A${row}`);
    if (lineNo && lineNo > 0) result.push(row);
  }
  return result;
}

function findOrderSectionEnd(worksheet: Worksheet, startRow: number) {
  for (let row = startRow + 1; row <= worksheet.rowCount; row += 1) {
    const label = text(worksheet, `C${row}`)?.toLocaleLowerCase("vi-VN") ?? "";
    if (label.includes("cước vận chuyển") || label.includes("câu hỏi thêm")) return row;
  }
  return worksheet.rowCount + 1;
}

function parseMainItem(worksheet: Worksheet, row: number, blockEndRow: number): ParsedOrderItem {
  const main = parseColumns(worksheet, row);
  const details: ParsedOrderLine[] = [];

  for (let detailRow = row + 1; detailRow <= blockEndRow; detailRow += 1) {
    if (integer(worksheet, `A${detailRow}`)) break;
    const parsed = parseColumns(worksheet, detailRow);
    if (!hasMeaningfulLine(parsed)) continue;
    details.push({
      rowOrder: details.length + 1,
      detailType: parsed.productName?.trim().toLocaleLowerCase("vi-VN") === "khác" ? "KHAC" : "CHI_TIET_MAU",
      ...parsed,
    });
  }

  return {
    lineNo: integer(worksheet, `A${row}`) ?? 0,
    ...main,
    rawBlock: buildRawBlock(worksheet, row, blockEndRow),
    details,
  };
}

function parseColumns(worksheet: Worksheet, row: number) {
  return {
    setNo: text(worksheet, `B${row}`),
    productName: text(worksheet, `C${row}`),
    productCode: text(worksheet, `D${row}`),
    model: text(worksheet, `E${row}`),
    openingDirection: text(worksheet, `F${row}`),
    trimDirection: text(worksheet, `G${row}`),
    paintColor: text(worksheet, `H${row}`),
    heightMm: integer(worksheet, `I${row}`),
    widthMm: integer(worksheet, `J${row}`),
    frameMm: integer(worksheet, `K${row}`),
    clearHeightMm: integer(worksheet, `L${row}`),
    clearWidthMm: integer(worksheet, `M${row}`),
    panelInfo: text(worksheet, `N${row}`),
    trimBarsPerSet: integer(worksheet, `O${row}`),
    trimType: text(worksheet, `P${row}`),
    lockModel: text(worksheet, `Q${row}`),
    windowBars: text(worksheet, `R${row}`),
    leavesPerSet: integer(worksheet, `S${row}`),
    quantity: integer(worksheet, `T${row}`),
    unit: text(worksheet, `U${row}`),
    pricingQuantity: numberValue(worksheet, `V${row}`),
    unitPrice: numberValue(worksheet, `W${row}`),
    amount: numberValue(worksheet, `X${row}`),
    note: text(worksheet, `Y${row}`),
    modelCheck: text(worksheet, `AH${row}`),
    priceCheck: text(worksheet, `AI${row}`),
    sourceRow: row,
  };
}

function isRealItem(item: ParsedOrderItem) {
  const meaningfulSetNo = item.setNo !== null && item.setNo !== "0";
  const hasDimensions = (item.heightMm ?? 0) > 0 || (item.widthMm ?? 0) > 0;
  const hasQuantity = (item.quantity ?? 0) > 0;
  return Boolean(meaningfulSetNo || item.productCode || item.model || hasDimensions || hasQuantity);
}

function hasMeaningfulLine(line: ReturnType<typeof parseColumns>) {
  return isMeaningfulOrderDetail(line as unknown as Record<string, unknown>);
}

function parseRequirements(worksheet: Worksheet): ParsedRequirement[] {
  return REQUIREMENTS.map((item, index) => ({
    code: item.code,
    questionText: text(worksheet, `C${item.row}`) ?? `Câu hỏi ${index + 1}`,
    answer: text(worksheet, `F${item.row}`),
    note: text(worksheet, `H${item.row}`),
    sortOrder: index + 1,
  }));
}

function buildRawBlock(worksheet: Worksheet, startRow: number, endRow: number) {
  const rows: Record<string, unknown>[] = [];
  const safeEndRow = Math.min(endRow, worksheet.rowCount, startRow + 30);
  for (let row = startRow; row <= safeEndRow; row += 1) {
    const values: Record<string, unknown> = { row };
    let hasValue = false;
    for (const column of RAW_COLUMNS) {
      const value = primitiveValue(worksheet.getCell(`${column}${row}`).value);
      if (value !== null && value !== "") {
        values[column] = value;
        hasValue = true;
      }
    }
    if (hasValue) rows.push(values);
  }
  return rows;
}

function text(worksheet: Worksheet, address: string): string | null {
  const value = worksheet.getCell(address).text?.trim();
  return value ? value : null;
}

function firstText(worksheet: Worksheet, addresses: string[]) {
  for (const address of addresses) {
    const value = text(worksheet, address);
    if (value) return value;
  }
  return null;
}

function firstDate(worksheet: Worksheet, addresses: string[]) {
  for (const address of addresses) {
    const value = dateValue(worksheet.getCell(address).value);
    if (value) return value;
  }
  return null;
}

function firstNumber(worksheet: Worksheet, addresses: string[]) {
  for (const address of addresses) {
    const value = numberValue(worksheet, address);
    if (value !== null) return value;
  }
  return null;
}

function numberValue(worksheet: Worksheet, address: string): number | null {
  return numericValue(worksheet.getCell(address).value);
}

function integer(worksheet: Worksheet, address: string): number | null {
  const value = numberValue(worksheet, address);
  return value === null ? null : Math.trunc(value);
}

function numericValue(value: CellValue): number | null {
  const raw = unwrapFormula(value);
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  if (typeof raw === "string") {
    const normalized = raw.trim().replace(/,/g, "");
    if (!normalized) return null;
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function dateValue(value: CellValue): Date | null {
  const raw = unwrapFormula(value);
  if (raw instanceof Date && !Number.isNaN(raw.getTime())) {
    return new Date(Date.UTC(raw.getFullYear(), raw.getMonth(), raw.getDate()));
  }
  if (typeof raw === "number" && Number.isFinite(raw)) {
    const epoch = Date.UTC(1899, 11, 30);
    return new Date(epoch + Math.round(raw * 86_400_000));
  }
  if (typeof raw === "string") {
    const input = raw.trim();
    const dmy = input.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})$/);
    if (dmy) {
      const year = dmy[3].length === 2 ? 2000 + Number(dmy[3]) : Number(dmy[3]);
      return new Date(Date.UTC(year, Number(dmy[2]) - 1, Number(dmy[1])));
    }
    const parsed = new Date(input);
    if (!Number.isNaN(parsed.getTime())) return new Date(Date.UTC(parsed.getFullYear(), parsed.getMonth(), parsed.getDate()));
  }
  return null;
}

function unwrapFormula(value: CellValue): CellValue {
  if (value && typeof value === "object" && "result" in value) {
    return (value as { result?: CellValue }).result ?? null;
  }
  return value;
}

function primitiveValue(value: CellValue): string | number | boolean | null {
  const raw = unwrapFormula(value);
  if (raw === null || raw === undefined) return null;
  if (raw instanceof Date) return raw.toISOString();
  if (typeof raw === "string" || typeof raw === "number" || typeof raw === "boolean") return raw;
  if (typeof raw === "object" && "text" in raw && typeof raw.text === "string") return raw.text;
  return String(raw);
}

function columnName(column: number) {
  let n = column;
  let result = "";
  while (n > 0) {
    n -= 1;
    result = String.fromCharCode(65 + (n % 26)) + result;
    n = Math.floor(n / 26);
  }
  return result;
}
