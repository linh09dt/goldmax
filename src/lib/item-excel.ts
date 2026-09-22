import ExcelJS, { type Cell, type Worksheet } from "exceljs";
import { createHash } from "node:crypto";

type ParsedItem = {
  sourceRow: number;
  code: string;
  name: string;
};

export type ItemImportIssue = {
  type: "DUPLICATE_CODE" | "INVALID_ROW";
  code?: string;
  rows: number[];
  message: string;
};

export type ParsedItemWorkbook = {
  fileHash: string;
  sheetName: string;
  totalRows: number;
  items: ParsedItem[];
  issues: ItemImportIssue[];
};

export async function parseItemMasterWorkbook(buffer: Buffer): Promise<ParsedItemWorkbook> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ArrayBuffer);

  const worksheet = workbook.worksheets[0];
  if (!worksheet) throw new Error("File Excel không có sheet dữ liệu.");

  const header = findHeader(worksheet);
  if (!header) {
    throw new Error("Không tìm thấy cột 'Tên' và 'Mã' trong file danh mục hàng hóa.");
  }

  const rawItems: ParsedItem[] = [];
  const issues: ItemImportIssue[] = [];

  for (let rowNumber = header.row + 1; rowNumber <= worksheet.rowCount; rowNumber += 1) {
    const row = worksheet.getRow(rowNumber);
    const name = cellText(row.getCell(header.nameCol));
    const code = cellText(row.getCell(header.codeCol));

    if (!name && !code) continue;
    if (!name || !code) {
      issues.push({
        type: "INVALID_ROW",
        rows: [rowNumber],
        code: code || undefined,
        message: `Dòng ${rowNumber}: phải có đủ Tên hàng hóa và Mã hàng hóa.`,
      });
      continue;
    }

    rawItems.push({ sourceRow: rowNumber, code, name });
  }

  const byCode = new Map<string, ParsedItem[]>();
  for (const item of rawItems) {
    const rows = byCode.get(item.code) ?? [];
    rows.push(item);
    byCode.set(item.code, rows);
  }

  const items: ParsedItem[] = [];
  for (const [code, rows] of byCode) {
    if (rows.length === 1) {
      items.push(rows[0]);
      continue;
    }

    const distinctNames = [...new Set(rows.map((row) => row.name))];
    if (distinctNames.length === 1) {
      items.push(rows[0]);
      continue;
    }

    issues.push({
      type: "DUPLICATE_CODE",
      code,
      rows: rows.map((row) => row.sourceRow),
      message: `Mã '${code}' xuất hiện nhiều lần với tên khác nhau ở dòng ${rows.map((row) => row.sourceRow).join(", ")}. Hệ thống không tự chọn tên và sẽ bỏ qua mã này.`,
    });
  }

  return {
    fileHash: createHash("sha256").update(buffer).digest("hex"),
    sheetName: worksheet.name,
    totalRows: rawItems.length + issues.filter((issue) => issue.type === "INVALID_ROW").length,
    items,
    issues,
  };
}

function findHeader(worksheet: Worksheet) {
  const maxRows = Math.min(worksheet.rowCount, 30);
  for (let rowNumber = 1; rowNumber <= maxRows; rowNumber += 1) {
    const row = worksheet.getRow(rowNumber);
    let nameCol = 0;
    let codeCol = 0;
    row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
      const key = normalizeHeader(cellText(cell));
      if (key === "ten" || key === "ten hang hoa" || key === "ten hang") nameCol = colNumber;
      if (key === "ma" || key === "ma hang hoa" || key === "ma hang") codeCol = colNumber;
    });
    if (nameCol && codeCol) return { row: rowNumber, nameCol, codeCol };
  }
  return null;
}

function cellText(cell: Cell) {
  const value = cell.value;
  if (value === null || value === undefined) return "";
  if (typeof value === "object") {
    if ("text" in value && typeof value.text === "string") return value.text.trim();
    if ("result" in value && value.result !== undefined && value.result !== null) return String(value.result).trim();
    if ("richText" in value && Array.isArray(value.richText)) {
      return value.richText.map((part) => part.text).join("").trim();
    }
  }
  return String(value).trim();
}

function normalizeHeader(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}
