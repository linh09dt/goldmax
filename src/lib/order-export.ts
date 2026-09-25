import ExcelJS, { type Worksheet } from "exceljs";
import { access } from "node:fs/promises";
import path from "node:path";
import { resolveOrderItemDetails } from "@/lib/order-detail";
import type { OutputGroup } from "@/lib/order-output";
import { buildOutputGroups, calculateOutputTotals, cleanText, outputLineAmount, toNumber } from "@/lib/order-output";
import { logoBox, readImageSize } from "@/lib/png-size";
import { addProductImage, fitProductImageInCell } from "@/lib/excel-image-cell";

const BORDER = { style: "thin" as const, color: { argb: "FF000000" } };
const ALL_BORDERS = { top: BORDER, left: BORDER, bottom: BORDER, right: BORDER };
const TOP_FILL = { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: "FFC6E0B4" } };
const HEADER_FILL = { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: "FFFFF2CC" } };
const MAIN_FILL = { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: "FFE2F0D9" } };
const WHITE_FILL = { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: "FFFFFFFF" } };
const NOTE_FILL = { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: "FF92D050" } };
const YELLOW_FILL = { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: "FFFFFF00" } };
const BADGE_FILL = { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: "FF4472C4" } };
const BODY_FONT = { name: "Times New Roman", size: 12, color: { argb: "FF000000" } };
const CENTER = { horizontal: "center" as const, vertical: "middle" as const, wrapText: true };
const LEFT = { horizontal: "left" as const, vertical: "middle" as const, wrapText: true };
// V87: bề rộng logo trong khối header (ô A1:B2). Chiều cao suy ra từ tỉ lệ thật của file PNG
// để logo mới không bị kéo giãn.
const LOGO_WIDTH_PX = 92;
// V110b: bề rộng các cột — cột cuối (T, index 0-based 19) là "Hình ảnh SP".
const COLUMN_WIDTHS = [5, 10, 22, 20, 10, 8, 10, 9, 7.5, 7.5, 7.5, 7.5, 7.5, 9, 8, 10, 13, 15, 24, 16];
const IMAGE_COLUMN_INDEX = 19;
const FALLBACK_IMAGE_ASPECT = 5 / 3;

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

export async function buildOrderExcel(order: ExportableOrder, exportNote = ""): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Door Production ERP";
  workbook.company = "GOLDMAX";
  workbook.created = new Date();
  workbook.modified = new Date();
  workbook.calcProperties.fullCalcOnLoad = true;

  const ws = workbook.addWorksheet("Đơn đặt hàng", {
    pageSetup: {
      paperSize: 9,
      orientation: "landscape",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      horizontalCentered: true,
      margins: { left: 0.12, right: 0.12, top: 0.15, bottom: 0.15, header: 0, footer: 0 },
    },
    properties: { defaultRowHeight: 21 },
  });

  setupColumns(ws);
  await writeHeader(ws, workbook, order);
  writeTableHeader(ws);

  const groups = buildOutputGroups(order.items as any, resolveOrderItemDetails as any);
  const totals = calculateOutputTotals(groups, order);

  let rowNo = 8;
  for (const group of groups) {
    // V109: 1 ô ảnh cho cả bộ cửa — merge cột T từ dòng hàng đầu tới dòng hàng cuối của bộ.
    const firstItemRow = rowNo;
    for (const entry of group.rows) {
      await writeLine(ws, workbook, rowNo, group, entry.row, entry.main, entry.firstInGroup);
      ws.getRow(rowNo).height = entry.main ? 28 : 25;
      rowNo += 1;
    }
    await writeGroupImageV1(ws, workbook, firstItemRow, rowNo - 1, group);
  }

  if (!groups.length) {
    ws.mergeCells(`A${rowNo}:T${rowNo + 1}`);
    ws.getCell(`A${rowNo}`).value = "Không có dòng hàng hóa nào có KH/Lượng để xuất.";
    ws.getCell(`A${rowNo}`).alignment = CENTER;
    ws.getCell(`A${rowNo}`).font = { ...BODY_FONT, bold: true, color: { argb: "FFC00000" } };
    styleRange(ws, `A${rowNo}:T${rowNo + 1}`, WHITE_FILL, true);
    rowNo += 2;
  }

  rowNo = writeExportNote(ws, rowNo, exportNote);
  rowNo = writeTotals(ws, rowNo, totals);
  rowNo += 1;
  rowNo = writeNotes(ws, rowNo, order);

  ws.pageSetup.printTitlesRow = "6:7";
  ws.pageSetup.printArea = `A1:T${rowNo}`;
  ws.views = [{ state: "frozen", ySplit: 7, showGridLines: false }];

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

function setupColumns(ws: Worksheet) {
  // Bố cục bám file mẫu và giữ cột Hình ảnh SP ở cuối.
  COLUMN_WIDTHS.forEach((width, index) => { ws.getColumn(index + 1).width = width; });
}

async function writeHeader(ws: Worksheet, workbook: ExcelJS.Workbook, order: ExportableOrder) {
  styleRange(ws, "A1:T5", TOP_FILL, false);

  const logoPath = path.join(process.cwd(), "public", "goldmax-logo.png");
  try {
    await access(logoPath);
    const imageId = workbook.addImage({ filename: logoPath, extension: "png" });
    ws.addImage(imageId, {
      tl: { col: 0.35, row: 0.25 },
      ext: await logoBox(logoPath, LOGO_WIDTH_PX),
    });
  } catch {
    ws.mergeCells("A1:B2");
    ws.getCell("A1").value = "GOLDMAX";
    ws.getCell("A1").font = { name: "Arial", size: 19, bold: true, color: { argb: "FFD4AF37" } };
    ws.getCell("A1").alignment = CENTER;
  }

  ws.mergeCells("C1:T1");
  ws.getCell("C1").value = "CÔNG TY TNHH SXTM GOLDMAX VIỆT NAM";
  ws.getCell("C1").font = { ...BODY_FONT, size: 18, bold: true };
  ws.getCell("C1").alignment = CENTER;

  ws.mergeCells("C2:P2");
  ws.getCell("C2").value = "ĐƠN ĐẶT HÀNG";
  ws.getCell("C2").font = { ...BODY_FONT, size: 17, bold: true, color: { argb: "FF003399" } };
  ws.getCell("C2").alignment = CENTER;

  ws.mergeCells("R2:T2");
  ws.getCell("R2").value = "MẪU CỬA";
  ws.getCell("R2").fill = BADGE_FILL;
  ws.getCell("R2").font = { ...BODY_FONT, size: 12, bold: true, color: { argb: "FFFFFFFF" } };
  ws.getCell("R2").alignment = LEFT;

  setInfoLine(ws, "A4:H4", "Tên khách hàng:", order.customerName || order.receiverName || order.customerCode);
  setInfoLine(ws, "I4:N4", "Địa chỉ:", order.receiverAddress);
  setInfoLine(ws, "O4:T4", "Ngày đặt hàng:", order.orderDate, true);

  setInfoLine(ws, "A5:H5", "Mã đại lý:", order.customerCode);
  setInfoLine(ws, "I5:N5", "Mã nhân viên:", order.salesEmployeeCode);
  setInfoLine(ws, "O5:T5", "Ngày trả dự kiến:", order.requiredDeliveryDate, true);

  ws.getRow(1).height = 28;
  ws.getRow(2).height = 31;
  ws.getRow(3).height = 10;
  ws.getRow(4).height = 22;
  ws.getRow(5).height = 22;
}

function setInfoLine(ws: Worksheet, range: string, label: string, value: unknown, date = false) {
  ws.mergeCells(range);
  const cell = ws.getCell(range.split(":")[0]);
  const displayValue = date && value instanceof Date
    ? formatExcelDate(value)
    : cleanText(value) || "";
  cell.value = {
    richText: [
      { text: `${label} `, font: { ...BODY_FONT, size: 11, bold: true, italic: true } },
      { text: displayValue, font: { ...BODY_FONT, size: 11, bold: true } },
    ],
  };
  cell.alignment = { horizontal: "left", vertical: "middle", wrapText: false, shrinkToFit: true };
}

function formatExcelDate(value: Date) {
  const day = String(value.getDate()).padStart(2, "0");
  const month = String(value.getMonth() + 1).padStart(2, "0");
  return `${day}/${month}/${value.getFullYear()}`;
}

function writeTableHeader(ws: Worksheet) {
  const merges = [
    "A6:A7", "B6:B7", "C6:C7", "D6:D7", "E6:E7", "F6:F7", "G6:G7", "H6:H7",
    "I6:K6", "L6:M6", "N6:N7", "O6:R6", "S6:S7", "T6:T7",
  ];
  merges.forEach((range) => ws.mergeCells(range));

  const v = (cell: string, value: string) => { ws.getCell(cell).value = value; };
  v("A6", "STT"); v("B6", "BỘ SỐ"); v("C6", "Tên sản phẩm\n(1)"); v("D6", "Model\n(2)"); v("E6", "Ô THOÁNG");
  v("F6", "Hướng mở\n(3)"); v("G6", "Phào\n(Thuận - Nghịch)\n(4)"); v("H6", "Màu sơn\n(5)");
  v("I6", "Kích thước cửa (mm)"); v("I7", "Cao\n(7)"); v("J7", "Rộng\n(8)"); v("K7", "Khuôn\n(9)");
  v("L6", "KT thông thủy"); v("L7", "Cao\n(10)"); v("M7", "Rộng\n(11)"); v("N6", "Số lượng bộ\n(13)");
  v("O6", "Tính giá"); v("O7", "ĐVT\n(14)"); v("P7", "KH/Lượng\n(15)"); v("Q7", "Đơn giá\n(16)"); v("R7", "Thành tiền\n(17)");
  v("S6", "Ghi chú\n(18)"); v("T6", "Hình ảnh SP\n(19)");

  styleRange(ws, "A6:T7", HEADER_FILL, true);
  // File mẫu làm nổi riêng tiêu đề Màu sơn.
  ws.getCell("H6").fill = YELLOW_FILL;

  for (let row = 6; row <= 7; row += 1) {
    for (let col = 1; col <= 20; col += 1) {
      const cell = ws.getCell(row, col);
      cell.font = { ...BODY_FONT, size: 10, bold: true };
      cell.alignment = CENTER;
    }
  }
  ws.getRow(6).height = 31;
  ws.getRow(7).height = 28;
}

async function writeLine(
  ws: Worksheet,
  workbook: ExcelJS.Workbook,
  rowNo: number,
  group: { lineNo: number; setNo: string | null; imagePath: string | null },
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
    "",
  ];
  values.forEach((value, index) => { ws.getCell(rowNo, index + 1).value = value as any; });

  for (let col = 1; col <= 20; col += 1) {
    const cell = ws.getCell(rowNo, col);
    cell.fill = main ? MAIN_FILL : WHITE_FILL;
    cell.border = ALL_BORDERS;
    cell.font = { ...BODY_FONT, size: 11, bold: main && col <= 4 };
    cell.alignment = col === 3 || col === 4 ? LEFT : CENTER;
  }

  ws.getCell(`P${rowNo}`).numFmt = "#,##0.00";
  ws.getCell(`Q${rowNo}`).numFmt = "#,##0";
  ws.getCell(`R${rowNo}`).numFmt = "#,##0";

  if (cleanText(row.note)) {
    ws.getCell(`S${rowNo}`).font = { ...BODY_FONT, size: 11, bold: true, color: { argb: "FFFF0000" } };
    ws.getCell(`S${rowNo}`).alignment = CENTER;
  }

  if (!main) {
    // Theo mẫu: các ô kích thước có dữ liệu của dòng chi tiết/phụ kiện dùng nền xanh nhạt.
    for (const column of ["I", "J", "K"]) {
      const value = Number(ws.getCell(`${column}${rowNo}`).value ?? 0);
      if (Number.isFinite(value) && value !== 0) ws.getCell(`${column}${rowNo}`).fill = MAIN_FILL;
    }
    if (cleanText(row.productName)?.toLocaleUpperCase("vi-VN").includes("KHÓA")) {
      ws.getCell(`D${rowNo}`).fill = YELLOW_FILL;
    }
  }
}

function writeExportNote(ws: Worksheet, startRow: number, exportNote: string) {
  const note = cleanText(exportNote)?.trim();
  if (!note) return startRow;

  const lineCount = Math.max(1, note.split("\n").length);
  ws.mergeCells(`A${startRow}:T${startRow}`);
  const cell = ws.getCell(`A${startRow}`);
  cell.value = note;
  cell.font = { ...BODY_FONT, size: 14, bold: true, color: { argb: "FFFF0000" } };
  cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
  styleRange(ws, `A${startRow}:T${startRow}`, WHITE_FILL, true);
  cell.font = { ...BODY_FONT, size: 14, bold: true, color: { argb: "FFFF0000" } };
  cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
  ws.getRow(startRow).height = Math.max(28, 21 * lineCount);
  return startRow + 1;
}

function writeTotals(ws: Worksheet, startRow: number, totals: ReturnType<typeof calculateOutputTotals>) {
  let row = startRow;
  const lines: Array<[string, number, { red?: boolean; bold?: boolean }]> = [];
  if (totals.shippingFee > 0) lines.push(["CƯỚC VẬN CHUYỂN", totals.shippingFee, {}]);
  lines.push(["TỔNG ĐƠN HÀNG", totals.orderTotal, { bold: true }]);
  if (totals.discountPercent > 0 && totals.discountAmount > 0) {
    lines.push([`CHIẾT KHẤU ${totals.discountPercent}%`, totals.discountAmount, { bold: true }]);
  }
  lines.push(
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
    ws.getRow(row).height = 24;
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
  cell.font = { ...BODY_FONT, bold: false, size: 11 };
  cell.alignment = { horizontal: "left", vertical: "top", wrapText: true, indent: 1 };
  styleRange(ws, `A${startRow}:T${startRow + heightRows - 1}`, NOTE_FILL, false);
  for (let row = startRow; row < startRow + heightRows; row += 1) ws.getRow(row).height = 21;
  return startRow + heightRows - 1;
}

/**
 * V109: file Excel V1 — gộp ô ảnh (cột T) của cả bộ cửa và chỉ gắn MỘT ảnh căn giữa khối.
 * V110b: ảnh **lấp đầy ô** — rộng hết bề rộng cột, dòng đầu của bộ được nới thêm nếu khối
 * chưa đủ cao (trước đây ảnh cỡ cứng 82 × 48 px nên nằm lọt thỏm trong ô).
 */
async function writeGroupImageV1(
  ws: Worksheet,
  workbook: ExcelJS.Workbook,
  firstRow: number,
  lastRow: number,
  group: OutputGroup,
) {
  if (lastRow > firstRow) ws.mergeCells(`T${firstRow}:T${lastRow}`);
  const cell = ws.getCell(`T${firstRow}`);
  cell.alignment = CENTER;
  const own = cleanText(group.imagePath);
  const imageUrl = own || group.rows.map((entry) => cleanText(entry.row.imagePath)).find(Boolean) || "";
  if (!imageUrl) return;

  cell.value = { text: "Xem ảnh", hyperlink: imageUrl, tooltip: "Mở hình ảnh sản phẩm" };
  cell.font = { ...BODY_FONT, size: 10, color: { argb: "FF0563C1" }, underline: true };
  try {
    const response = await fetch(imageUrl, { cache: "no-store" });
    if (!response.ok) return;
    const contentType = response.headers.get("content-type") || "";
    const extension = contentType.includes("png") ? "png" : contentType.includes("jpeg") || contentType.includes("jpg") ? "jpeg" : null;
    if (!extension) return;
    const imageBuffer = Buffer.from(await response.arrayBuffer());
    const size = readImageSize(imageBuffer);
    const placement = fitProductImageInCell({
      ws,
      firstRow,
      lastRow,
      columnIndex: IMAGE_COLUMN_INDEX,
      columnWidth: COLUMN_WIDTHS[IMAGE_COLUMN_INDEX],
      aspect: size && size.height > 0 ? size.width / size.height : FALLBACK_IMAGE_ASPECT,
    });
    const imageId = workbook.addImage({ buffer: imageBuffer as any, extension });
    addProductImage(ws, imageId, placement);
    cell.value = null;
  } catch {
    // Giữ hyperlink nếu không thể tải ảnh.
  }
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
