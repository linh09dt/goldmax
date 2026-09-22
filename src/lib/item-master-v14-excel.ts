import ExcelJS, { type Cell, type Worksheet } from "exceljs";
import { createHash } from "node:crypto";

export type MasterItemV14 = {
  sourceRow: number;
  name: string;
  model: string;
};

export type MasterItemIssueV14 = {
  type: "INVALID_ROW" | "DUPLICATE_MODEL";
  model?: string;
  rows: number[];
  message: string;
};

export type ParsedMasterItemWorkbookV14 = {
  fileHash: string;
  sheetName: string;
  totalRows: number;
  items: MasterItemV14[];
  issues: MasterItemIssueV14[];
  sourceColumns: { nameCol: number; modelCol: number };
};

/**
 * V14 Master Data rule:
 * - Chỉ lấy cặp TENHANG + MODEL/MOLDEL dùng làm danh mục hàng hóa.
 * - Với file nguồn có nhiều cặp TENHANG/MODEL, ưu tiên cặp nằm ngoài cùng bên phải
 *   (file hiện tại là K/L).
 * - Không đọc ĐVT, Giá đại lý hoặc các cột cấu hình khác ở giai đoạn này.
 */
export async function parseMasterItemWorkbookV14(buffer: Buffer): Promise<ParsedMasterItemWorkbookV14> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);

  const worksheet = workbook.worksheets[0];
  if (!worksheet) throw new Error("File Excel không có sheet dữ liệu.");

  const header = findMasterHeader(worksheet);
  if (!header) {
    throw new Error("Không tìm thấy cặp cột TENHANG + MODEL/MOLDEL trong file Master Data.");
  }

  const raw: MasterItemV14[] = [];
  const issues: MasterItemIssueV14[] = [];

  for (let rowNumber = header.row + 1; rowNumber <= worksheet.rowCount; rowNumber += 1) {
    const row = worksheet.getRow(rowNumber);
    const name = cellText(row.getCell(header.nameCol));
    const model = cellText(row.getCell(header.modelCol)).replace(/\s*\n\s*/g, " ").trim();

    if (!name && !model) continue;
    if (!name || !model) {
      issues.push({
        type: "INVALID_ROW",
        model: model || undefined,
        rows: [rowNumber],
        message: `Dòng ${rowNumber}: phải có đủ TENHANG và MODEL.`,
      });
      continue;
    }

    raw.push({ sourceRow: rowNumber, name, model });
  }

  const byModel = new Map<string, MasterItemV14[]>();
  for (const item of raw) {
    const key = normalizeLookup(item.model);
    const list = byModel.get(key) ?? [];
    list.push(item);
    byModel.set(key, list);
  }

  const items: MasterItemV14[] = [];
  for (const rows of byModel.values()) {
    const first = rows[0];
    if (rows.length === 1) {
      items.push(first);
      continue;
    }

    const sameName = rows.every((row) => normalizeLookup(row.name) === normalizeLookup(first.name));
    if (sameName) {
      items.push(first);
      continue;
    }

    issues.push({
      type: "DUPLICATE_MODEL",
      model: first.model,
      rows: rows.map((row) => row.sourceRow),
      message: `MODEL '${first.model}' xuất hiện với nhiều TENHANG khác nhau ở dòng ${rows.map((row) => row.sourceRow).join(", ")}. MODEL này chưa được nhập.`,
    });
  }

  return {
    fileHash: createHash("sha256").update(buffer).digest("hex"),
    sheetName: worksheet.name,
    totalRows: raw.length + issues.filter((issue) => issue.type === "INVALID_ROW").length,
    items,
    issues,
    sourceColumns: { nameCol: header.nameCol, modelCol: header.modelCol },
  };
}

function findMasterHeader(worksheet: Worksheet) {
  for (let rowNumber = 1; rowNumber <= Math.min(worksheet.rowCount, 20); rowNumber += 1) {
    const row = worksheet.getRow(rowNumber);
    const pairs: Array<{ nameCol: number; modelCol: number }> = [];
    const maxCol = Math.max(row.cellCount, 20);

    for (let col = 1; col < maxCol; col += 1) {
      const current = normalizeHeader(cellText(row.getCell(col)));
      const next = normalizeHeader(cellText(row.getCell(col + 1)));
      const isName = current === "tenhang" || current === "ten hang" || current === "ten hang hoa";
      const isModel = next === "model" || next === "moldel" || next === "ma hang hoa" || next === "ma";
      if (isName && isModel) pairs.push({ nameCol: col, modelCol: col + 1 });
    }

    if (pairs.length) {
      const rightMost = [...pairs].sort((a, b) => b.nameCol - a.nameCol)[0];
      return { row: rowNumber, ...rightMost };
    }
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

function normalizeLookup(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toUpperCase()
    .replace(/\s+/g, "")
    .trim();
}
