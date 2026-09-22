import * as XLSX from "xlsx";
import {
  DEFAULT_REQUIREMENTS,
  newClientId,
  type OrderFormData,
  type OrderItemForm,
  type OrderLineForm,
} from "@/lib/order-form";

export type ParsedOrderInputTemplate = {
  form: OrderFormData;
  sheetName: string;
  importedItems: number;
  importedDetails: number;
  ignoredRows: number;
  warnings: string[];
};

type Sheet = XLSX.WorkSheet;
type Cell = XLSX.CellObject | undefined;

const MAX_SCAN_ROW = 1000;

/**
 * Đọc mẫu đơn hàng dạng .xlsb/.xlsx đang sử dụng tại GOLDMAX.
 * Mẫu có 2 hàng tiêu đề (6-7), dữ liệu bắt đầu từ hàng 8:
 * B STT | C BỘ SỐ | D Tên sản phẩm | E Model | F Ô thoáng | G Hướng mở |
 * H Phào | I Màu sơn | J/K/L Kích thước | M/N KT thông thủy | O Số lượng bộ |
 * P ĐVT | Q KH/Lượng | R Đơn giá | S Thành tiền | T Ghi chú.
 *
 * Ảnh không lấy từ Excel. imagePath luôn để trống để người dùng tải ảnh trên Web App.
 */
export function parseOrderInputTemplate(buffer: Buffer, fileName = ""): ParsedOrderInputTemplate {
  const workbook = XLSX.read(buffer, {
    type: "buffer",
    cellDates: true,
    cellFormula: true,
    cellText: true,
    raw: false,
  });

  const sheetName = findOrderSheetName(workbook);
  if (!sheetName) throw new Error("File Excel không có worksheet.");
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) throw new Error("Không đọc được worksheet đơn hàng.");

  validateCompactTemplate(sheet);

  const usedRange = XLSX.utils.decode_range(sheet["!ref"] || "A1:T200");
  const lastRow = Math.min(usedRange.e.r + 1, MAX_SCAN_ROW);
  const orderEndRow = findOrderEndRow(sheet, lastRow);
  const mainRows = findMainRows(sheet, 8, orderEndRow);
  if (!mainRows.length) throw new Error("Không tìm thấy dòng bộ cửa trong mẫu Excel.");

  const warnings: string[] = [];
  let ignoredRows = 0;
  const items: OrderItemForm[] = mainRows.map((row, index) => {
    const nextMain = mainRows[index + 1] ?? orderEndRow;
    const main = lineFromRow(sheet, row, 0, false);
    const details: OrderLineForm[] = [];

    for (let detailRow = row + 1; detailRow < nextMain; detailRow += 1) {
      if (isSummaryRow(sheet, detailRow)) break;
      const detail = lineFromRow(sheet, detailRow, details.length + 1, true);
      if (!hasAnyOrderValue(detail)) continue;

      // Logic đã chốt trước đó: hàng hóa kèm theo chỉ dùng khi KH/Lượng có giá trị > 0.
      if (!positiveNumber(detail.pricingQuantity)) {
        ignoredRows += 1;
        continue;
      }
      details.push(detail);
    }

    return {
      clientId: newClientId(),
      lineNo: index + 1,
      ...main,
      details,
    };
  });

  const importedDetails = items.reduce((sum, item) => sum + item.details.length, 0);
  if (ignoredRows > 0) warnings.push(`${ignoredRows} dòng hàng kèm không có KH/Lượng > 0 đã được bỏ qua.`);

  const customerName = cleanText(cellText(sheet, "C4")) || textAfterColon(cellText(sheet, "B4"));
  const customerCode = textAfterColon(cellText(sheet, "B5"));
  const receiverAddress = textAfterColon(cellText(sheet, "E4"));
  const receiverPhone = firstMeaningfulText(sheet, ["L4", "M4", "N4"]);
  const orderDate = parseDateFromText(textAfterColon(cellText(sheet, "E5"))) || parseDateCell(sheet["E5"]);
  const requiredDeliveryDate = parseDateCell(sheet["M5"]) || parseDateFromText(textAfterColon(cellText(sheet, "K5")));
  const orderCode = cleanText(cellText(sheet, "S5")) || textAfterColon(cellText(sheet, "R5")) || cleanText(cellText(sheet, "S4"));
  const depositAmount = summaryNumber(sheet, "dat coc");
  const warehouseReceiptDeduction = summaryNumber(sheet, "nhan hang tai kho");

  const form: OrderFormData = {
    orderCode,
    status: "NHAP",
    customerCode,
    customerName,
    salesEmployeeCode: "",
    orderDate: toDateInput(orderDate),
    requiredDeliveryDate: toDateInput(requiredDeliveryDate),
    receiverName: "",
    receiverPhone,
    receiverAddress,
    deliveryKm: "",
    region: "",
    groupNo: "",
    excelUpdateDate: "",
    formCode: "",
    formEffectiveDate: "",
    // Dòng "Hỗ trợ vc" trong mẫu không được hiểu là cước thu khách hàng.
    // Cước vận chuyển tiếp tục lấy từ module Tính cước vận chuyển.
    shippingFee: "",
    discountPercent: numberText(summaryDiscountPercent(sheet)),
    depositAmount: numberText(depositAmount),
    warehouseReceiptDeduction: numberText(warehouseReceiptDeduction),
    requirements: DEFAULT_REQUIREMENTS.map((item, index) => ({
      ...item,
      answer: "",
      note: "",
      sortOrder: index + 1,
    })),
    items,
  };

  if (fileName.toLowerCase().endsWith(".xlsb")) {
    warnings.push("Ảnh nhúng trong XLSB không được nhập tự động; dùng cột Tải ảnh trên đơn hàng để bổ sung ảnh.");
  }

  return {
    form,
    sheetName,
    importedItems: items.length,
    importedDetails,
    ignoredRows,
    warnings,
  };
}

function lineFromRow(sheet: Sheet, row: number, rowOrder: number, detail: boolean): OrderLineForm {
  const productName = cleanText(cellText(sheet, `D${row}`));
  const model = cleanText(cellText(sheet, `E${row}`));
  const unit = cleanText(cellText(sheet, `P${row}`));
  const amount = cellNumber(sheet, `S${row}`);

  return {
    rowOrder,
    detailType: detail ? "HANG_KEM" : "",
    setNo: detail ? "" : plainCellText(sheet, `C${row}`),
    productName,
    productCode: model,
    model,
    openingDirection: cleanText(cellText(sheet, `G${row}`)),
    trimDirection: cleanText(cellText(sheet, `H${row}`)),
    paintColor: cleanText(cellText(sheet, `I${row}`)),
    heightMm: numberText(cellNumber(sheet, `J${row}`)),
    widthMm: numberText(cellNumber(sheet, `K${row}`)),
    frameMm: numberText(cellNumber(sheet, `L${row}`)),
    clearHeightMm: numberText(cellNumber(sheet, `M${row}`)),
    clearWidthMm: numberText(cellNumber(sheet, `N${row}`)),
    panelInfo: cleanText(cellText(sheet, `F${row}`)),
    trimBarsPerSet: "",
    trimType: "",
    lockModel: "",
    windowBars: "",
    leavesPerSet: "",
    quantity: numberText(cellNumber(sheet, `O${row}`)),
    unit,
    pricingQuantity: numberText(cellNumber(sheet, `Q${row}`)),
    unitPrice: numberText(cellNumber(sheet, `R${row}`)),
    amount: amount === null ? "" : numberText(amount),
    note: cleanText(cellText(sheet, `T${row}`)),
    // Giữ cột tải ảnh trên Web App. Import Excel không tự ghi đè ảnh.
    imagePath: "",
    modelCheck: "",
    priceCheck: "",
  };
}

function findOrderSheetName(workbook: XLSX.WorkBook) {
  return workbook.SheetNames.find((name) => normalizeText(name).includes("hoa don")) || workbook.SheetNames[0] || "";
}

function validateCompactTemplate(sheet: Sheet) {
  const checks: Array<[string, string]> = [
    ["B6", "STT"],
    ["C6", "BỘ SỐ"],
    ["D6", "Tên sản phẩm"],
    ["E6", "Model"],
    ["Q7", "KH/Lượng"],
    ["T6", "Ghi chú"],
  ];
  for (const [address, expected] of checks) {
    const actual = normalizeText(cellText(sheet, address));
    if (!actual.includes(normalizeText(expected))) {
      throw new Error(`File không đúng mẫu đơn hàng mới. Thiếu tiêu đề "${expected}" tại ô ${address}.`);
    }
  }
}

function findMainRows(sheet: Sheet, startRow: number, endRow: number) {
  const rows: number[] = [];
  for (let row = startRow; row < endRow; row += 1) {
    const stt = cellNumber(sheet, `B${row}`);
    if (stt !== null && stt > 0 && Number.isInteger(stt)) rows.push(row);
  }
  return rows;
}

function findOrderEndRow(sheet: Sheet, lastRow: number) {
  for (let row = 8; row <= lastRow; row += 1) {
    if (isSummaryRow(sheet, row)) return row;
  }
  return lastRow + 1;
}

function isSummaryRow(sheet: Sheet, row: number) {
  const label = normalizeText(cellText(sheet, `B${row}`));
  return label.includes("tong don hang") || label.includes("chiet khau") || label === "con lai" || label.includes("dat coc");
}


function summaryDiscountPercent(sheet: Sheet) {
  const range = XLSX.utils.decode_range(sheet["!ref"] || "A1:T200");
  const lastRow = Math.min(range.e.r + 1, MAX_SCAN_ROW);
  for (let row = 1; row <= lastRow; row += 1) {
    const raw = cleanText(cellText(sheet, `B${row}`));
    const normalized = normalizeText(raw);
    if (!normalized.includes("chiet khau")) continue;
    const match = raw.match(/(\d+(?:[.,]\d+)?)\s*%/);
    if (!match) continue;
    const value = Number(match[1].replace(",", "."));
    if (Number.isFinite(value)) return Math.min(100, Math.max(0, value));
  }
  return null;
}

function summaryNumber(sheet: Sheet, normalizedLabel: string) {
  const range = XLSX.utils.decode_range(sheet["!ref"] || "A1:T200");
  const lastRow = Math.min(range.e.r + 1, MAX_SCAN_ROW);
  for (let row = 1; row <= lastRow; row += 1) {
    const label = normalizeText(cellText(sheet, `B${row}`));
    if (label.includes(normalizedLabel)) return cellNumber(sheet, `S${row}`);
  }
  return null;
}

function hasAnyOrderValue(line: OrderLineForm) {
  return Boolean(
    line.productName || line.productCode || line.model || line.unit || line.pricingQuantity || line.unitPrice || line.note ||
    line.heightMm || line.widthMm || line.frameMm || line.panelInfo,
  );
}

function firstMeaningfulText(sheet: Sheet, addresses: string[]) {
  for (const address of addresses) {
    const value = cleanText(cellText(sheet, address));
    if (value && value !== ":") return value;
  }
  return "";
}

function cellText(sheet: Sheet, address: string) {
  const cell = sheet[address] as Cell;
  if (!cell) return "";
  const value = cell.v;
  if (value instanceof Date) return toDateInput(value);
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function plainCellText(sheet: Sheet, address: string) {
  const cell = sheet[address] as Cell;
  if (!cell || cell.v === null || cell.v === undefined) return "";
  if (typeof cell.v === "number" && Number.isFinite(cell.v)) {
    return Number.isInteger(cell.v) ? String(cell.v) : String(cell.v);
  }
  return String(cell.v).trim();
}

function cellNumber(sheet: Sheet, address: string): number | null {
  const cell = sheet[address] as Cell;
  if (!cell || cell.v === null || cell.v === undefined || cell.v === "") return null;
  if (typeof cell.v === "number" && Number.isFinite(cell.v)) return cell.v;
  const text = String(cell.v).trim().replace(/\s/g, "").replace(/,/g, "");
  if (!text) return null;
  const value = Number(text);
  return Number.isFinite(value) ? value : null;
}

function parseDateCell(cell: Cell): Date | null {
  if (!cell || cell.v === null || cell.v === undefined) return null;
  if (cell.v instanceof Date && !Number.isNaN(cell.v.getTime())) return cell.v;
  if (typeof cell.v === "number" && Number.isFinite(cell.v)) {
    const parsed = XLSX.SSF.parse_date_code(cell.v);
    if (parsed) return new Date(Date.UTC(parsed.y, parsed.m - 1, parsed.d));
  }
  return parseDateFromText(String(cell.v));
}

function parseDateFromText(value: string) {
  const input = cleanText(value);
  if (!input) return null;
  const match = input.match(/(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})/);
  if (!match) return null;
  const year = match[3].length === 2 ? 2000 + Number(match[3]) : Number(match[3]);
  const date = new Date(Date.UTC(year, Number(match[2]) - 1, Number(match[1])));
  return Number.isNaN(date.getTime()) ? null : date;
}

function textAfterColon(value: string) {
  const input = cleanText(value);
  if (!input) return "";
  const index = input.indexOf(":");
  return index >= 0 ? input.slice(index + 1).trim() : input;
}

function cleanText(value: unknown) {
  if (value === null || value === undefined) return "";
  return String(value).replace(/\r?\n/g, " ").replace(/\s+/g, " ").trim();
}

function positiveNumber(value: string) {
  const number = Number(String(value || "").replace(/,/g, ""));
  return Number.isFinite(number) && number > 0;
}

function numberText(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "";
  return String(value);
}

function toDateInput(value: Date | null) {
  if (!value || Number.isNaN(value.getTime())) return "";
  const year = value.getUTCFullYear();
  const month = String(value.getUTCMonth() + 1).padStart(2, "0");
  const day = String(value.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function normalizeText(value: string) {
  return cleanText(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLocaleLowerCase("vi-VN");
}
