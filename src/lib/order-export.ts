import ExcelJS, { type Worksheet } from "exceljs";
import { access } from "node:fs/promises";
import path from "node:path";
import { resolveOrderItemDetails } from "@/lib/order-detail";
import { buildOutputGroups, calculateOutputTotals, cleanText, outputLineAmount, toNumber } from "@/lib/order-output";

const BORDER = { style: "thin" as const, color: { argb: "FF1F2937" } };
const ALL_BORDERS = { top: BORDER, left: BORDER, bottom: BORDER, right: BORDER };
const TOP_FILL = { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: "FFC6E0B4" } };
const HEADER_FILL = { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: "FFFFF2CC" } };
const MAIN_FILL = { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: "FFE2F0D9" } };
const WHITE_FILL = { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: "FFFFFFFF" } };
const NOTE_FILL = { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: "FF92D050" } };
const YELLOW_FILL = { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: "FFFFFF00" } };
const BODY_FONT = { name: "Times New Roman", size: 10, color: { argb: "FF000000" } };
const CENTER = { horizontal: "center" as const, vertical: "middle" as const, wrapText: true };
const LEFT = { horizontal: "left" as const, vertical: "middle" as const, wrapText: true };

export type ExportableOrder = {
  id: number;
  orderCode: string;
  customerCode: string | null;
  customerName: string | null;
  salesEmployeeCode: string | null;
  orderDate: Date | null;
  requiredDeliveryDate: Date | null;
  receiverName: string | null;
  receiverPhone: string | null;
  receiverAddress: string | null;
  deliveryKm: number | null;
  region: string | null;
  formCode: string | null;
  formEffectiveDate: Date | null;
  shippingFee: unknown;
  depositAmount: unknown;
  warehouseReceiptDeduction: unknown;
  items: Array<Record<string, any> & { details?: Array<Record<string, any>> }>;
  requirements: Array<{ questionText: string; answer: string | null; note: string | null; sortOrder: number }>;
};

export async function buildOrderExcel(order: ExportableOrder): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Door Production ERP";
  workbook.company = "GOLDMAX";
  workbook.created = new Date();
  workbook.modified = new Date();
  workbook.calcProperties.fullCalcOnLoad = true;

  const ws = workbook.addWorksheet("Thông tin đơn hàng", {
    pageSetup: {
      paperSize: 9,
      orientation: "landscape",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      margins: { left: 0.15, right: 0.15, top: 0.2, bottom: 0.2, header: 0, footer: 0 },
    },
    properties: { defaultRowHeight: 18 },
  });

  setupColumns(ws);
  await writeHeader(ws, workbook, order);
  writeTableHeader(ws);

  const groups = buildOutputGroups(order.items as any, resolveOrderItemDetails as any);
  const totals = calculateOutputTotals(groups, order);

  let rowNo = 9;
  for (const group of groups) {
    let firstExcelRow = rowNo;
    let lastExcelRow = rowNo;
    for (const entry of group.rows) {
      writeLine(ws, rowNo, group, entry.row, entry.main, entry.firstInGroup);
      ws.getRow(rowNo).height = entry.main ? 30 : 24;
      lastExcelRow = rowNo;
      rowNo += 1;
    }
    if (group.imagePath) await addProductImageIfAny(workbook, ws, group.imagePath, firstExcelRow, lastExcelRow);
  }

  if (!groups.length) {
    ws.mergeCells(`A${rowNo}:T${rowNo + 1}`);
    ws.getCell(`A${rowNo}`).value = "Không có dòng hàng hóa nào có KH/Lượng để xuất.";
    ws.getCell(`A${rowNo}`).alignment = CENTER;
    ws.getCell(`A${rowNo}`).font = { ...BODY_FONT, bold: true, color: { argb: "FFC00000" } };
    styleRange(ws, `A${rowNo}:T${rowNo + 1}`, WHITE_FILL, true);
    rowNo += 2;
  }

  rowNo = writeTotals(ws, rowNo, totals);
  rowNo += 1;
  rowNo = writeNotes(ws, rowNo, order);

  ws.pageSetup.printTitlesRow = "7:8";
  ws.pageSetup.printArea = `A1:T${rowNo}`;
  ws.views = [{ state: "frozen", ySplit: 8 }];

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

function setupColumns(ws: Worksheet) {
  const widths = [6, 11, 28, 24, 12, 9, 12, 10, 9, 9, 9, 9, 9, 10, 9, 11, 14, 16, 30, 20];
  widths.forEach((width, index) => { ws.getColumn(index + 1).width = width; });
}

async function writeHeader(ws: Worksheet, workbook: ExcelJS.Workbook, order: ExportableOrder) {
  styleRange(ws, "A1:T6", TOP_FILL, false);

  const logoPath = path.join(process.cwd(), "public", "goldmax-logo.png");
  try {
    await access(logoPath);
    const imageId = workbook.addImage({ filename: logoPath, extension: "png" });
    ws.addImage(imageId, { tl: { col: 0.2, row: 0.2 }, ext: { width: 115, height: 48 } });
  } catch {
    ws.mergeCells("A1:B2");
    ws.getCell("A1").value = "GOLDMAX";
    ws.getCell("A1").font = { name: "Arial", size: 18, bold: true, color: { argb: "FFD4AF37" } };
    ws.getCell("A1").alignment = CENTER;
  }

  ws.mergeCells("C1:R1");
  ws.getCell("C1").value = "CÔNG TY TNHH SXTM GOLDMAX VIỆT NAM";
  ws.getCell("C1").font = { ...BODY_FONT, size: 15, bold: true };
  ws.getCell("C1").alignment = CENTER;

  ws.mergeCells("C2:R2");
  ws.getCell("C2").value = "THÔNG TIN ĐƠN HÀNG";
  ws.getCell("C2").font = { ...BODY_FONT, size: 15, bold: true, color: { argb: "FF003399" } };
  ws.getCell("C2").alignment = CENTER;

  setInfo(ws, "A4", "Tên đại lý:", "B4:D4", order.customerName || order.customerCode);
  setInfo(ws, "A5", "Mã ĐL:", "B5:D5", order.customerCode);
  setInfo(ws, "E4", "Địa chỉ:", "F4:J4", order.receiverAddress);
  setInfo(ws, "E5", "Ngày đặt hàng:", "F5:J5", order.orderDate, true);
  setInfo(ws, "K4", "SĐT:", "L4:N4", order.receiverPhone);
  setInfo(ws, "K5", "Ngày trả dự kiến:", "L5:N5", order.requiredDeliveryDate, true);
  setInfo(ws, "O4", "Số đơn:", "P4:T4", order.orderCode);
  setInfo(ws, "O5", "Mã đơn sx:", "P5:T5", order.orderCode);

  ws.getRow(1).height = 24;
  ws.getRow(2).height = 28;
  for (let r = 3; r <= 6; r += 1) ws.getRow(r).height = 20;
}

function setInfo(ws: Worksheet, labelCell: string, label: string, valueRange: string, value: unknown, date = false) {
  ws.getCell(labelCell).value = label;
  ws.getCell(labelCell).font = { ...BODY_FONT, bold: true, italic: true };
  ws.mergeCells(valueRange);
  const valueCell = ws.getCell(valueRange.split(":")[0]);
  valueCell.value = value instanceof Date ? value : cleanText(value);
  valueCell.font = { ...BODY_FONT, bold: true };
  valueCell.alignment = LEFT;
  if (date) valueCell.numFmt = "dd/mm/yyyy";
}

function writeTableHeader(ws: Worksheet) {
  const merges = [
    "A7:A8", "B7:B8", "C7:C8", "D7:D8", "E7:E8", "F7:F8", "G7:G8", "H7:H8",
    "I7:K7", "L7:M7", "N7:N8", "O7:R7", "S7:S8", "T7:T8",
  ];
  merges.forEach((range) => ws.mergeCells(range));
  const v = (cell: string, value: string) => { ws.getCell(cell).value = value; };
  v("A7", "STT"); v("B7", "BỘ SỐ"); v("C7", "Tên sản phẩm\n(1)"); v("D7", "Model\n(2)"); v("E7", "Ô THOÁNG");
  v("F7", "Hướng mở\n(3)"); v("G7", "Phào\n(Thuận-Nghịch)\n(4)"); v("H7", "Màu sơn\n(5)");
  v("I7", "Kích thước cửa (mm)"); v("I8", "Cao\n(7)"); v("J8", "Rộng\n(8)"); v("K8", "Khuôn\n(9)");
  v("L7", "KT thông thủy"); v("L8", "Cao\n(10)"); v("M8", "Rộng\n(11)"); v("N7", "Số lượng bộ\n(13)");
  v("O7", "Tính giá"); v("O8", "ĐVT\n(14)"); v("P8", "KH/Lượng"); v("Q8", "Đơn giá\n(15)"); v("R8", "Thành tiền\n(17)");
  v("S7", "Ghi chú\n(18)"); v("T7", "Hình ảnh SP\n(19)");

  styleRange(ws, "A7:T8", HEADER_FILL, true);
  for (let row = 7; row <= 8; row += 1) {
    for (let col = 1; col <= 20; col += 1) {
      const cell = ws.getCell(row, col);
      cell.font = { ...BODY_FONT, size: 8, bold: true };
      cell.alignment = CENTER;
    }
  }
  ws.getRow(7).height = 28;
  ws.getRow(8).height = 26;
}

function writeLine(
  ws: Worksheet,
  rowNo: number,
  group: { lineNo: number; setNo: string | null },
  row: Record<string, any>,
  main: boolean,
  firstInGroup: boolean,
) {
  const values = [
    firstInGroup ? group.lineNo : null,
    firstInGroup ? group.setNo : null,
    cleanText(row.productName),
    cleanText(row.productCode) || cleanText(row.model),
    cleanText(row.panelInfo),
    cleanText(row.openingDirection),
    cleanText(row.trimDirection),
    cleanText(row.paintColor),
    toNumber(row.heightMm),
    toNumber(row.widthMm),
    toNumber(row.frameMm),
    toNumber(row.clearHeightMm),
    toNumber(row.clearWidthMm),
    toNumber(row.quantity),
    cleanText(row.unit),
    toNumber(row.pricingQuantity),
    toNumber(row.unitPrice),
    outputLineAmount(row),
    cleanText(row.note),
    null,
  ];
  values.forEach((value, index) => { ws.getCell(rowNo, index + 1).value = value as any; });

  for (let col = 1; col <= 20; col += 1) {
    const cell = ws.getCell(rowNo, col);
    cell.fill = main ? MAIN_FILL : WHITE_FILL;
    cell.border = ALL_BORDERS;
    cell.font = { ...BODY_FONT, size: 9, bold: main && col <= 4 };
    cell.alignment = col === 3 || col === 4 || col === 19 ? LEFT : CENTER;
  }
  ws.getCell(`P${rowNo}`).numFmt = "#,##0.00";
  ws.getCell(`Q${rowNo}`).numFmt = "#,##0";
  ws.getCell(`R${rowNo}`).numFmt = "#,##0";
  if (cleanText(row.note)) ws.getCell(`S${rowNo}`).font = { ...BODY_FONT, size: 9, bold: true, color: { argb: "FFFF0000" } };
  if (!main && cleanText(row.productName)?.toLocaleUpperCase("vi-VN").includes("KHÓA")) {
    ws.getCell(`D${rowNo}`).fill = YELLOW_FILL;
  }
}

async function addProductImageIfAny(
  workbook: ExcelJS.Workbook,
  ws: Worksheet,
  imagePath: unknown,
  firstRow: number,
  lastRow: number,
) {
  const value = cleanText(imagePath);
  if (!value || !value.startsWith("/uploads/")) return;
  const extension = path.extname(value).toLowerCase();
  if (![".png", ".jpg", ".jpeg"].includes(extension)) return;
  const absolute = path.join(process.cwd(), "public", value.replace(/^\/+/, ""));
  try {
    await access(absolute);
    const imageId = workbook.addImage({ filename: absolute, extension: extension === ".png" ? "png" : "jpeg" });
    const rows = Math.max(1, lastRow - firstRow + 1);
    const height = Math.min(150, Math.max(65, rows * 22));
    ws.addImage(imageId, { tl: { col: 19.05, row: firstRow - 0.92 }, ext: { width: 105, height } });
  } catch {
    // Không chặn xuất đơn nếu ảnh local đã bị di chuyển.
  }
}

function writeTotals(ws: Worksheet, startRow: number, totals: ReturnType<typeof calculateOutputTotals>) {
  let row = startRow;
  const lines: Array<[string, number, { red?: boolean; bold?: boolean }]> = [];
  if (totals.shippingFee > 0) lines.push(["CƯỚC VẬN CHUYỂN", totals.shippingFee, {}]);
  lines.push(
    ["TỔNG ĐƠN HÀNG", totals.orderTotal, { bold: true }],
    [`CHIẾT KHẤU ${totals.discountPercent}%`, totals.discountAmount, { bold: true }],
    ["CÒN LẠI", totals.afterDiscount, { bold: true }],
    ["ĐẶT CỌC", totals.depositAmount, { bold: true }],
  );
  if (totals.warehouseReceiptDeduction > 0) lines.push(["TRỪ TIỀN NHẬN HÀNG TẠI KHO", totals.warehouseReceiptDeduction, {}]);
  lines.push(["CÒN LẠI VẪN THANH TOÁN", totals.paymentDue, { bold: true, red: true }]);

  for (const [label, amount, options] of lines) {
    ws.mergeCells(`A${row}:Q${row}`);
    ws.mergeCells(`R${row}:T${row}`);
    ws.getCell(`A${row}`).value = label;
    ws.getCell(`R${row}`).value = amount;
    styleRange(ws, `A${row}:T${row}`, WHITE_FILL, true);
    ws.getCell(`A${row}`).alignment = CENTER;
    ws.getCell(`R${row}`).alignment = CENTER;
    ws.getCell(`R${row}`).numFmt = "#,##0";
    ws.getCell(`A${row}`).font = { ...BODY_FONT, bold: options.bold ?? true, color: { argb: options.red ? "FFFF0000" : "FF000000" } };
    ws.getCell(`R${row}`).font = { ...BODY_FONT, bold: true, color: { argb: options.red ? "FFFF0000" : "FF000000" } };
    ws.getRow(row).height = 22;
    row += 1;
  }
  return row;
}

function writeNotes(ws: Worksheet, startRow: number, order: ExportableOrder) {
  const requirementLines = order.requirements
    .map((item) => {
      const answer = [item.answer, item.note].filter(Boolean).join(" - ");
      return `- ${item.questionText}${answer ? `: ${answer}` : ""}`;
    })
    .filter(Boolean);
  const lines = [
    "Ghi chú:",
    "Khách hàng xác nhận các thông tin sau:",
    ...requirementLines,
  ];
  const heightRows = Math.max(4, lines.length + 1);
  ws.mergeCells(`A${startRow}:T${startRow + heightRows - 1}`);
  const cell = ws.getCell(`A${startRow}`);
  cell.value = lines.join("\n");
  cell.font = { ...BODY_FONT, bold: false, size: 9 };
  cell.alignment = { horizontal: "left", vertical: "top", wrapText: true, indent: 1 };
  styleRange(ws, `A${startRow}:T${startRow + heightRows - 1}`, NOTE_FILL, false);
  for (let row = startRow; row < startRow + heightRows; row += 1) ws.getRow(row).height = 18;
  return startRow + heightRows - 1;
}

function styleRange(ws: Worksheet, range: string, fill: ExcelJS.Fill, border: boolean) {
  const [from, to] = range.split(":");
  const start = ws.getCell(from);
  const end = ws.getCell(to || from);
  for (let row = start.row; row <= end.row; row += 1) {
    for (let col = start.col; col <= end.col; col += 1) {
      const cell = ws.getCell(row, col);
      cell.fill = fill;
      if (!cell.font?.name) cell.font = BODY_FONT;
      if (!cell.alignment?.horizontal) cell.alignment = CENTER;
      if (border) cell.border = ALL_BORDERS;
    }
  }
}
