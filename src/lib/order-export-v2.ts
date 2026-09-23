import ExcelJS, { type Worksheet } from "exceljs";
import { access } from "node:fs/promises";
import path from "node:path";
import { resolveOrderItemDetails } from "@/lib/order-detail";
import { buildOutputGroups, calculateOutputTotals, cleanText, outputLineAmount, toNumber } from "@/lib/order-output";

const NAVY = "FF1E3A8A";
const AMBER = "FFD97706";
const TEXT = "FF1F2937";
const MUTED = "FF6B7280";
const LIGHT = "FFF3F4F6";
const PALE_AMBER = "FFFFF7E6";
const WHITE = "FFFFFFFF";
const BORDER = { style: "thin" as const, color: { argb: "FFD1D5DB" } };
const ALL_BORDERS = { top: BORDER, left: BORDER, bottom: BORDER, right: BORDER };
const BASE_FONT = { name: "Arial", size: 9, color: { argb: TEXT } };

export type ExportableOrderV2 = {
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
  shippingFee: unknown;
  discountPercent: unknown;
  depositAmount: unknown;
  warehouseReceiptDeduction: unknown;
  items: Array<Record<string, any> & { details?: Array<Record<string, any>> }>;
  requirements: Array<{ questionText: string; answer: string | null; note: string | null; sortOrder: number }>;
};

export async function buildOrderExcelV2(order: ExportableOrderV2, exportNote = ""): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Door Production ERP - GOLDMAX";
  workbook.company = "GOLDMAX";
  workbook.created = new Date();

  const ws = workbook.addWorksheet("Thông tin đơn hàng V2", {
    pageSetup: {
      paperSize: 9,
      orientation: "landscape",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      horizontalCentered: true,
      margins: { left: 0.47, right: 0.47, top: 0.39, bottom: 0.39, header: 0.1, footer: 0.1 },
    },
    properties: { defaultRowHeight: 18 },
  });

  setupColumns(ws);
  await writeTopBanner(ws, workbook, order);
  writeDataHeader(ws);

  const groups = buildOutputGroups(order.items as any, resolveOrderItemDetails as any);
  const totals = calculateOutputTotals(groups, order);
  let rowNo = 8;

  let stripe = 0;
  for (const group of groups) {
    for (const entry of group.rows) {
      await writeDataRow(ws, workbook, rowNo, group, entry.row, entry.main, entry.firstInGroup, stripe);
      rowNo += 1;
    }
    stripe += 1;
  }

  if (!groups.length) {
    ws.mergeCells(`A${rowNo}:Q${rowNo + 1}`);
    const cell = ws.getCell(`A${rowNo}`);
    cell.value = "Không có dòng hàng hóa nào có KH/Lượng để xuất.";
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.font = { ...BASE_FONT, bold: true, color: { argb: "FFB91C1C" } };
    styleRange(ws, `A${rowNo}:Q${rowNo + 1}`, WHITE, true);
    rowNo += 2;
  }

  rowNo = writeOptionalNote(ws, rowNo, exportNote);
  rowNo += 1;
  rowNo = writeChecklistAndSummary(ws, rowNo, order, totals);
  rowNo += 1;

  ws.pageSetup.printTitlesRow = "7:7";
  ws.pageSetup.printArea = `A1:Q${rowNo}`;
  ws.views = [{ state: "frozen", ySplit: 7, showGridLines: false }];
  ws.headerFooter.oddFooter = `&L Công ty TNHH SXTM GoldMax Việt Nam - Thông tin Đơn hàng #${order.orderCode}&R Trang &P / &N`;

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

function setupColumns(ws: Worksheet) {
  // Giữ đúng tỷ lệ cột của PDF V2 (273 mm vùng in), Excel tự fit 1 trang theo chiều ngang.
  const widths = [4.6, 9.2, 21.5, 17.7, 8.5, 8.5, 8.5, 8.5, 16.9, 7.7, 6.2, 6.9, 10, 13.1, 14.6, 32.3, 15.4];
  widths.forEach((width, index) => { ws.getColumn(index + 1).width = width; });
}

async function writeTopBanner(ws: Worksheet, workbook: ExcelJS.Workbook, order: ExportableOrderV2) {
  // Bố cục đồng bộ PDF V2: Logo | Công ty | THÔNG TIN ĐƠN HÀNG.
  ws.mergeCells("A1:B2");
  ws.mergeCells("C1:J1");
  ws.mergeCells("C2:J2");
  ws.mergeCells("K1:Q1");
  ws.mergeCells("K2:Q2");

  ws.getCell("C1").value = "CÔNG TY TNHH SXTM GOLDMAX VIỆT NAM";
  ws.getCell("C1").font = { ...BASE_FONT, bold: true, size: 12, color: { argb: NAVY } };
  ws.getCell("C1").alignment = { horizontal: "left", vertical: "middle", shrinkToFit: true };

  ws.getCell("C2").value = "Địa chỉ: Cụm CN Non Sáo, Xã Tân Dĩnh, Bắc Ninh  |  SĐT: 1900 8135  |  Email: Goldmaxdoor@gmail.com";
  ws.getCell("C2").font = { ...BASE_FONT, size: 8.5, color: { argb: MUTED } };
  ws.getCell("C2").alignment = { horizontal: "left", vertical: "middle", shrinkToFit: true };

  ws.getCell("K1").value = "THÔNG TIN ĐƠN HÀNG";
  ws.getCell("K1").font = { ...BASE_FONT, bold: true, size: 14, color: { argb: NAVY } };
  ws.getCell("K1").alignment = { horizontal: "right", vertical: "middle", shrinkToFit: true };
  ws.getCell("K2").value = `Mã ĐH: ${order.orderCode}`;
  ws.getCell("K2").font = { ...BASE_FONT, bold: true, italic: true, size: 9, color: { argb: AMBER } };
  ws.getCell("K2").alignment = { horizontal: "right", vertical: "middle", shrinkToFit: true };

  const logoPath = path.join(process.cwd(), "public", "goldmax-logo.png");
  try {
    await access(logoPath);
    const imageId = workbook.addImage({ filename: logoPath, extension: "png" });
    // Tăng logo tương tự PDF V2; giữ trong vùng A1:B2 để không đè nội dung công ty.
    ws.addImage(imageId, { tl: { col: 0.08, row: 0.08 }, ext: { width: 92, height: 42 }, editAs: "oneCell" });
  } catch {
    // Không chặn xuất nếu thiếu logo.
  }

  // Khung thông tin 3 cột giống PDF V2.
  const infoRows: Array<[string, string, string]> = [
    ["A4:G4", "Tên đại lý / Khách hàng", order.customerName || order.receiverName || order.customerCode || ""],
    ["H4:M4", "Mã Đơn Sản Xuất", order.orderCode],
    ["N4:Q4", "Ngày Đặt Hàng", formatDate(order.orderDate)],
    ["A5:G5", "Mã Đại Lý", order.customerCode || ""],
    ["H5:M5", "Địa Chỉ Lắp Đặt", order.receiverAddress || ""],
    ["N5:Q5", "Ngày Trả Dự Kiến", formatDate(order.requiredDeliveryDate)],
  ];

  for (const [range, label, value] of infoRows) {
    ws.mergeCells(range);
    const cell = ws.getCell(range.split(":")[0]);
    cell.value = { richText: [
      { text: `${label}: `, font: { ...BASE_FONT, size: 8.5, color: { argb: MUTED } } },
      { text: value, font: { ...BASE_FONT, bold: true, size: 8.5, color: { argb: TEXT } } },
    ] };
    cell.alignment = { horizontal: "left", vertical: "middle", wrapText: false, shrinkToFit: true };
  }
  styleRange(ws, "A4:Q5", "FFF8FAFC", true);

  ws.getRow(1).height = 27;
  ws.getRow(2).height = 22;
  ws.getRow(3).height = 7;
  ws.getRow(4).height = 22;
  ws.getRow(5).height = 22;
  ws.getRow(6).height = 7;
}

function writeDataHeader(ws: Worksheet) {
  const headers = [
    "STT", "BỘ SỐ", "TÊN SẢN PHẨM / QUY CÁCH", "MODEL", "Ô TH.", "HƯỚNG", "PHÀO", "MÀU SƠN",
    "KT CỬA (CAO x RỘNG)", "KHUÔN", "SL", "ĐVT", "KHỐI LƯỢNG", "ĐƠN GIÁ (Đ)", "THÀNH TIỀN (Đ)", "GHI CHÚ KỸ THUẬT", "HÌNH ẢNH SP",
  ];
  headers.forEach((value, index) => {
    const cell = ws.getCell(7, index + 1);
    cell.value = value;
    cell.fill = solid(NAVY);
    cell.font = { ...BASE_FONT, size: 7.5, bold: true, color: { argb: WHITE } };
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    cell.border = ALL_BORDERS;
  });
  ws.getRow(7).height = 28;
}

async function writeDataRow(
  ws: Worksheet,
  workbook: ExcelJS.Workbook,
  rowNo: number,
  group: { lineNo: number; setNo: string | null; imagePath: string | null },
  row: Record<string, any>,
  main: boolean,
  firstInGroup: boolean,
  stripe: number,
) {
  const dims = [toNumber(row.heightMm), toNumber(row.widthMm)].filter((v): v is number => v !== null && v !== 0);
  const sizeText = dims.length ? dims.map((v) => formatInteger(v)).join(" x ") : "";
  const productName = cleanText(row.productName) || "";
  const values: Array<string | number | null> = [
    firstInGroup ? group.lineNo : null,
    firstInGroup ? group.setNo : null,
    main ? productName : `↳ ${productName}`,
    cleanText(row.productCode) || cleanText(row.model) || "",
    cleanText(row.panelInfo) || "",
    cleanText(row.openingDirection) || "",
    cleanText(row.trimDirection) || "",
    cleanText(row.paintColor) || "",
    sizeText,
    toNumber(row.frameMm),
    toNumber(row.quantity),
    cleanText(row.unit) || "",
    toNumber(row.pricingQuantity),
    toNumber(row.unitPrice),
    outputLineAmount(row),
    cleanText(row.note) || "",
    "",
  ];
  values.forEach((value, index) => { ws.getCell(rowNo, index + 1).value = value as any; });

  const fill = main ? (stripe % 2 === 0 ? WHITE : LIGHT) : "FFFBFDFF";
  for (let col = 1; col <= 17; col += 1) {
    const cell = ws.getCell(rowNo, col);
    cell.fill = solid(fill);
    cell.border = ALL_BORDERS;
    cell.font = main
      ? { ...BASE_FONT, size: 8.5, bold: col <= 4 || col >= 13 }
      : { ...BASE_FONT, size: 8, italic: true, color: { argb: MUTED } };
    cell.alignment = {
      horizontal: [3, 4, 16].includes(col) ? "left" : [13, 14, 15].includes(col) ? "right" : "center",
      vertical: "top",
      wrapText: true,
    };
  }

  ws.getCell(`M${rowNo}`).numFmt = "#,##0.0000";
  ws.getCell(`N${rowNo}`).numFmt = "#,##0";
  ws.getCell(`O${rowNo}`).numFmt = "#,##0";
  if (cleanText(row.note)) ws.getCell(`P${rowNo}`).font = { ...ws.getCell(`P${rowNo}`).font, color: { argb: main ? TEXT : MUTED } };

  const imageUrl = main ? cleanText(group.imagePath) : null;
  if (imageUrl) {
    const imageCell = ws.getCell(`Q${rowNo}`);
    imageCell.value = { text: "Xem ảnh", hyperlink: imageUrl, tooltip: "Mở hình ảnh sản phẩm" };
    imageCell.font = { ...BASE_FONT, size: 7.5, color: { argb: "FF2563EB" }, underline: true };
    imageCell.alignment = { horizontal: "center", vertical: "middle" };
    try {
      const response = await fetch(imageUrl, { cache: "no-store" });
      if (response.ok) {
        const contentType = response.headers.get("content-type") || "";
        const extension = contentType.includes("png") ? "png" : contentType.includes("jpeg") || contentType.includes("jpg") ? "jpeg" : null;
        if (extension) {
          const imageBuffer = Buffer.from(await response.arrayBuffer());
          const imageId = workbook.addImage({ buffer: imageBuffer as any, extension });
          ws.addImage(imageId, { tl: { col: 16.12, row: rowNo - 0.9 }, ext: { width: 58, height: 36 }, editAs: "oneCell" });
          imageCell.value = null;
          ws.getRow(rowNo).height = Math.max(ws.getRow(rowNo).height || 0, 30);
        }
      }
    } catch {
      // Giữ hyperlink nếu không thể tải ảnh.
    }
  }

  // Không để ghi chú/tên hàng bị cắt như bản Excel V2 cũ.
  const estimatedLines = Math.max(
    estimateWrappedLines(productName, 22),
    estimateWrappedLines(cleanText(row.productCode) || cleanText(row.model) || "", 18),
    estimateWrappedLines(cleanText(row.note) || "", 36),
  );
  const contentHeight = (main ? 17 : 15) + Math.max(0, estimatedLines - 1) * (main ? 10 : 9);
  ws.getRow(rowNo).height = Math.max(ws.getRow(rowNo).height || 0, main ? 25 : 21, contentHeight);
}

function estimateWrappedLines(value: string, charsPerLine: number) {
  const text = value.replace(/\r\n?/g, "\n").trim();
  if (!text) return 1;
  return text.split("\n").reduce((sum, line) => sum + Math.max(1, Math.ceil(line.length / charsPerLine)), 0);
}

function writeOptionalNote(ws: Worksheet, row: number, exportNote: string) {
  const note = exportNote.replace(/\r\n?/g, "\n").trim();
  if (!note) return row;
  ws.mergeCells(`A${row}:Q${row}`);
  const cell = ws.getCell(`A${row}`);
  cell.value = note;
  cell.font = { ...BASE_FONT, bold: true, size: 10, color: { argb: AMBER } };
  cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
  cell.fill = solid(PALE_AMBER);
  cell.border = { top: { style: "medium", color: { argb: AMBER } }, bottom: { style: "medium", color: { argb: AMBER } }, left: BORDER, right: BORDER };
  ws.getRow(row).height = Math.max(24, 18 * Math.max(1, note.split("\n").length));
  return row + 1;
}

function writeChecklistAndSummary(
  ws: Worksheet,
  startRow: number,
  order: ExportableOrderV2,
  totals: ReturnType<typeof calculateOutputTotals>,
) {
  const checklist = order.requirements.map((item, index) => {
    const response = [item.answer, item.note].filter(Boolean).join(" - ");
    return `${index + 1}. ${item.questionText}${response ? `: ${response}` : ""}`;
  });
  const lines = checklist.length ? checklist : ["Chưa có checklist xác nhận kỹ thuật."];
  const height = Math.max(6, Math.min(12, lines.length + 2));
  const endRow = startRow + height - 1;

  ws.mergeCells(`A${startRow}:K${startRow}`);
  ws.getCell(`A${startRow}`).value = "BẢNG CHECKLIST XÁC NHẬN KỸ THUẬT VỚI ĐẠI LÝ";
  ws.getCell(`A${startRow}`).font = { ...BASE_FONT, bold: true, size: 9, color: { argb: NAVY } };
  ws.getCell(`A${startRow}`).alignment = { horizontal: "left", vertical: "middle" };
  ws.getCell(`A${startRow}`).fill = solid(WHITE);
  for (let r = startRow + 1; r <= endRow; r += 1) {
    ws.mergeCells(`A${r}:K${r}`);
    const line = lines[r - startRow - 1] || "";
    ws.getCell(`A${r}`).value = line;
    ws.getCell(`A${r}`).font = { ...BASE_FONT, size: 8, color: { argb: TEXT } };
    ws.getCell(`A${r}`).alignment = { horizontal: "left", vertical: "middle", wrapText: true };
  }
  styleRange(ws, `A${startRow}:K${endRow}`, WHITE, true);

  const summary: Array<[string, number, "normal" | "accent" | "total"]> = [
    ["Tổng giá trị đơn hàng:", totals.orderTotal, "normal"],
  ];
  if (totals.discountPercent > 0 && totals.discountAmount > 0) {
    summary.push([`Chiết khấu thương mại (${totals.discountPercent}%):`, -totals.discountAmount, "accent"]);
  }
  summary.push(["Tổng tiền sau chiết khấu:", totals.afterDiscount, "normal"]);
  summary.push(["Đã đặt cọc:", totals.depositAmount, "normal"]);
  if (totals.warehouseReceiptDeduction > 0) {
    summary.push(["Trừ tiền nhận hàng tại kho:", totals.warehouseReceiptDeduction, "normal"]);
  }
  summary.push(["CÒN LẠI CẦN THANH TOÁN:", totals.paymentDue, "total"]);

  let r = startRow;
  for (const [label, amount, mode] of summary) {
    ws.mergeCells(`L${r}:O${r}`);
    ws.mergeCells(`P${r}:Q${r}`);
    ws.getCell(`L${r}`).value = label;
    ws.getCell(`P${r}`).value = amount;
    ws.getCell(`P${r}`).numFmt = "#,##0 \"VNĐ\"";
    styleRange(ws, `L${r}:Q${r}`, mode === "total" ? NAVY : mode === "accent" ? PALE_AMBER : WHITE, true);
    ws.getCell(`L${r}`).font = { ...BASE_FONT, bold: mode !== "normal", size: 8.5, color: { argb: mode === "total" ? WHITE : TEXT } };
    ws.getCell(`P${r}`).font = { ...BASE_FONT, bold: true, size: 8.5, color: { argb: mode === "total" ? WHITE : mode === "accent" ? "FFDC2626" : NAVY } };
    ws.getCell(`L${r}`).alignment = { horizontal: "left", vertical: "middle" };
    ws.getCell(`P${r}`).alignment = { horizontal: "right", vertical: "middle" };
    r += 1;
  }
  if (r <= endRow) {
    ws.mergeCells(`L${r}:Q${endRow}`);
    ws.getCell(`L${r}`).value = `(Bằng chữ: ${numberToVietnameseWords(Math.round(totals.paymentDue))})`;
    ws.getCell(`L${r}`).font = { ...BASE_FONT, size: 7.5, italic: true, color: { argb: MUTED } };
    ws.getCell(`L${r}`).alignment = { horizontal: "right", vertical: "top", wrapText: true };
    styleRange(ws, `L${r}:Q${endRow}`, WHITE, true);
  }
  return endRow;
}

function styleRange(ws: Worksheet, range: string, fillArgb: string, border = false) {
  const [from, to] = range.split(":");
  const start = ws.getCell(from);
  const end = ws.getCell(to || from);
  for (let row = start.row; row <= end.row; row += 1) {
    for (let col = start.col; col <= end.col; col += 1) {
      const cell = ws.getCell(row, col);
      cell.fill = solid(fillArgb);
      if (!cell.font?.name) cell.font = BASE_FONT;
      if (border) cell.border = ALL_BORDERS;
    }
  }
}

function solid(argb: string): ExcelJS.Fill {
  return { type: "pattern", pattern: "solid", fgColor: { argb } };
}

function formatDate(value: Date | null) {
  return value ? new Intl.DateTimeFormat("vi-VN").format(value) : "";
}
function formatInteger(value: number) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value);
}

function numberToVietnameseWords(value: number) {
  if (!Number.isFinite(value) || value === 0) return "Không đồng";
  const digits = ["không", "một", "hai", "ba", "bốn", "năm", "sáu", "bảy", "tám", "chín"];
  const units = ["", "nghìn", "triệu", "tỷ", "nghìn tỷ", "triệu tỷ"];
  const read3 = (n: number, full: boolean) => {
    const hundred = Math.floor(n / 100);
    const ten = Math.floor((n % 100) / 10);
    const one = n % 10;
    const parts: string[] = [];
    if (hundred || full) parts.push(`${digits[hundred]} trăm`);
    if (ten > 1) {
      parts.push(`${digits[ten]} mươi`);
      if (one === 1) parts.push("mốt");
      else if (one === 5) parts.push("lăm");
      else if (one) parts.push(digits[one]);
    } else if (ten === 1) {
      parts.push("mười");
      if (one === 5) parts.push("lăm");
      else if (one) parts.push(digits[one]);
    } else if (one) {
      if (hundred || full) parts.push("lẻ");
      parts.push(digits[one]);
    }
    return parts.join(" ");
  };

  let n = Math.abs(Math.trunc(value));
  const chunks: number[] = [];
  while (n > 0) { chunks.push(n % 1000); n = Math.floor(n / 1000); }
  const out: string[] = [];
  for (let i = chunks.length - 1; i >= 0; i -= 1) {
    if (!chunks[i]) continue;
    out.push(read3(chunks[i], i < chunks.length - 1 && chunks[i] < 100));
    if (units[i]) out.push(units[i]);
  }
  const sentence = out.join(" ").replace(/\s+/g, " ").trim();
  return `${sentence.charAt(0).toLocaleUpperCase("vi-VN")}${sentence.slice(1)} đồng`;
}
