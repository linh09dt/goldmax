import ExcelJS, { type Cell, type Worksheet } from "exceljs";
import { createHash } from "node:crypto";

export const MASTER_OPTION_GROUPS = {
  PANEL_OPTION: "Ô thoáng / Pano / Nan chớp",
  OPENING_DIRECTION: "Hướng mở",
  TRIM_DIRECTION: "Hướng phào",
  PAINT_COLOR: "Màu sơn",
  DEALER_CODE: "Mã Đại Lý",
} as const;

export type MasterOptionGroupCode = keyof typeof MASTER_OPTION_GROUPS;

export type ParsedItemAttribute = {
  sourceRow: number;
  code: string;
  unit: string;
  dealerPrice: number | null;
};

export type ParsedMasterOption = {
  groupCode: MasterOptionGroupCode;
  code: string;
  name: string;
  sortOrder: number;
  sourceRow: number;
};

export type ItemAttributeImportIssue = {
  type: "INVALID_PRICE_ROW" | "DUPLICATE_PRICE_CODE";
  code?: string;
  rows: number[];
  message: string;
};

export type ParsedItemAttributeWorkbook = {
  fileHash: string;
  sheetName: string;
  totalPriceRows: number;
  attributes: ParsedItemAttribute[];
  options: ParsedMasterOption[];
  issues: ItemAttributeImportIssue[];
};

export async function parseItemAttributeWorkbook(buffer: Buffer): Promise<ParsedItemAttributeWorkbook> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ArrayBuffer);

  const worksheet = workbook.worksheets[0];
  if (!worksheet) throw new Error("File Excel không có sheet dữ liệu.");

  const header = findHeader(worksheet);
  if (!header) {
    throw new Error("Không tìm thấy các cột Mã/MOLDEL, ĐVT và Giá đại lý trong file.");
  }

  const rawAttributes: ParsedItemAttribute[] = [];
  const issues: ItemAttributeImportIssue[] = [];

  for (let rowNumber = header.row + 1; rowNumber <= worksheet.rowCount; rowNumber += 1) {
    const row = worksheet.getRow(rowNumber);
    const code = cellText(row.getCell(header.codeCol));
    const unit = cellText(row.getCell(header.unitCol));
    const priceText = header.priceCol ? cellText(row.getCell(header.priceCol)) : "";

    if (!code && !unit && !priceText) continue;
    if (!code) {
      issues.push({
        type: "INVALID_PRICE_ROW",
        rows: [rowNumber],
        message: `Dòng ${rowNumber}: có ĐVT/giá nhưng không có mã hàng hóa. Hệ thống bỏ qua dòng này.`,
      });
      continue;
    }

    const dealerPrice = parseMoney(priceText);
    if (priceText && dealerPrice === null) {
      issues.push({
        type: "INVALID_PRICE_ROW",
        code,
        rows: [rowNumber],
        message: `Dòng ${rowNumber}: giá đại lý của mã '${code}' không hợp lệ. Hệ thống bỏ qua dòng này.`,
      });
      continue;
    }

    rawAttributes.push({ sourceRow: rowNumber, code, unit, dealerPrice });
  }

  const byCode = new Map<string, ParsedItemAttribute[]>();
  for (const row of rawAttributes) {
    const key = normalizeCode(row.code);
    const rows = byCode.get(key) ?? [];
    rows.push(row);
    byCode.set(key, rows);
  }

  const attributes: ParsedItemAttribute[] = [];
  for (const rows of byCode.values()) {
    if (rows.length === 1) {
      attributes.push(rows[0]);
      continue;
    }

    const first = rows[0];
    const isSame = rows.every((row) => normalizeText(row.unit) === normalizeText(first.unit) && row.dealerPrice === first.dealerPrice);
    if (isSame) {
      attributes.push(first);
      continue;
    }

    issues.push({
      type: "DUPLICATE_PRICE_CODE",
      code: first.code,
      rows: rows.map((row) => row.sourceRow),
      message: `Mã '${first.code}' xuất hiện nhiều lần với ĐVT hoặc giá khác nhau ở dòng ${rows.map((row) => row.sourceRow).join(", ")}. Hệ thống không tự chọn và sẽ bỏ qua mã này.`,
    });
  }

  const optionColumns: Array<{ groupCode: MasterOptionGroupCode; col: number | undefined }> = [
    { groupCode: "PANEL_OPTION", col: header.panelOptionCol },
    { groupCode: "OPENING_DIRECTION", col: header.openingDirectionCol },
    { groupCode: "TRIM_DIRECTION", col: header.trimDirectionCol },
    { groupCode: "PAINT_COLOR", col: header.paintColorCol },
  ];

  const options: ParsedMasterOption[] = [];
  for (const option of optionColumns) {
    if (!option.col) continue;
    const seen = new Set<string>();
    let sortOrder = 0;
    for (let rowNumber = header.row + 1; rowNumber <= worksheet.rowCount; rowNumber += 1) {
      const value = cellText(worksheet.getRow(rowNumber).getCell(option.col));
      if (!value) continue;
      const key = normalizeText(value);
      if (seen.has(key)) continue;
      seen.add(key);
      sortOrder += 10;
      options.push({ groupCode: option.groupCode, code: value, name: value, sortOrder, sourceRow: rowNumber });
    }
  }

  return {
    fileHash: createHash("sha256").update(buffer).digest("hex"),
    sheetName: worksheet.name,
    totalPriceRows: rawAttributes.length + issues.filter((issue) => issue.type === "INVALID_PRICE_ROW").length,
    attributes,
    options,
    issues,
  };
}

function findHeader(worksheet: Worksheet) {
  const maxRows = Math.min(worksheet.rowCount, 20);
  for (let rowNumber = 1; rowNumber <= maxRows; rowNumber += 1) {
    const row = worksheet.getRow(rowNumber);
    let codeCol = 0;
    let unitCol = 0;
    let priceCol = 0;
    let panelOptionCol = 0;
    let openingDirectionCol = 0;
    let trimDirectionCol = 0;
    let paintColorCol = 0;

    row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
      const key = normalizeHeader(cellText(cell));
      if (key === "ma" || key === "ma hang" || key === "ma hang hoa" || key === "model" || key === "moldel") codeCol = codeCol || colNumber;
      if (key === "dvt" || key === "don vi tinh") unitCol = unitCol || colNumber;
      if (key === "gia dai ly" || key === "gia dly" || key === "don gia dai ly") priceCol = priceCol || colNumber;
      if (key === "o thoang") panelOptionCol = panelOptionCol || colNumber;
      if (key === "huong mo") openingDirectionCol = openingDirectionCol || colNumber;
      if (key === "huong phao") trimDirectionCol = trimDirectionCol || colNumber;
      if (key === "mau son") paintColorCol = paintColorCol || colNumber;
    });

    if (codeCol && unitCol && priceCol) {
      return {
        row: rowNumber,
        codeCol,
        unitCol,
        priceCol,
        panelOptionCol: panelOptionCol || undefined,
        openingDirectionCol: openingDirectionCol || undefined,
        trimDirectionCol: trimDirectionCol || undefined,
        paintColorCol: paintColorCol || undefined,
      };
    }
  }
  return null;
}

function parseMoney(value: string) {
  const text = value.trim();
  if (!text || text === "-" || text === "—") return null;
  const normalized = text.replace(/\s/g, "").replace(/[.,](?=\d{3}(?:\D|$))/g, "").replace(",", ".");
  const number = Number(normalized);
  return Number.isFinite(number) ? number : null;
}

function cellText(cell: Cell) {
  const value = cell.value;
  if (value === null || value === undefined) return "";
  if (typeof value === "object") {
    if ("text" in value && typeof value.text === "string") return value.text.trim();
    if ("result" in value && value.result !== undefined && value.result !== null) return String(value.result).trim();
    if ("richText" in value && Array.isArray(value.richText)) return value.richText.map((part) => part.text).join("").trim();
  }
  return String(value).trim();
}

function normalizeHeader(value: string) {
  return normalizeText(value).replace(/[^a-z0-9]+/g, " ").trim();
}

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .trim();
}

export function normalizeCode(value: string) {
  return value.trim().toUpperCase();
}
