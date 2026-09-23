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
  let rowNo = 14;

  let stripe = 0;
  for (const group of groups) {
    for (const entry of group.rows) {
      await writeDataRow(ws, workbook, rowNo, group, entry.row, entry.main, entry.firstInGroup, stripe);
      rowNo += 1;
    }
    stripe += 1;
  }

  if (!groups.length) {
    ws.mergeCells(`A${rowNo}:S${rowNo + 1}`);
    const cell = ws.getCell(`A${rowNo}`);
    cell.value = "Không có dòng hàng hóa nào có KH/Lượng để xuất.";
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.font = { ...BASE_FONT, bold: true, color: { argb: "FFB91C1C" } };
    styleRange(ws, `A${rowNo}:S${rowNo + 1}`, WHITE, true);
    rowNo += 2;
  }

  rowNo = writeOptionalNote(ws, rowNo, exportNote);
  rowNo += 1;
  rowNo = writeChecklistAndSummary(ws, rowNo, order, totals);
  rowNo += 1;

  ws.pageSetup.printTitlesRow = "12:13";
  ws.pageSetup.printArea = `A1:S${rowNo}`;
  ws.views = [{ state: "frozen", ySplit: 13, showGridLines: false }];
  ws.headerFooter.oddFooter = `&L Công ty TNHH SXTM GoldMax Việt Nam - Thông tin Đơn hàng #${order.orderCode}&R Trang &P / &N`;

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

function setupColumns(ws: Worksheet) {
  // 19 cột, bổ sung KT thông thủy Cao/Rộng; Excel tự fit 1 trang theo chiều ngang.
  const widths = [4.5, 8.5, 19.5, 15.5, 7.5, 7.5, 7.5, 7.5, 14.5, 7.5, 7.5, 7.5, 5.5, 6.5, 9.5, 11.5, 13, 28, 13.5];
  widths.forEach((width, index) => { ws.getColumn(index + 1).width = width; });
}

async function writeTopBanner(ws: Worksheet, workbook: ExcelJS.Workbook, order: ExportableOrderV2) {
  // Bố cục V2: Logo | thông tin công ty từng dòng | THÔNG TIN ĐƠN HÀNG.
  ws.mergeCells("A1:C6");
  ws.mergeCells("D1:K1");
  ws.mergeCells("L1:S2");
  ws.mergeCells("L3:S3");

  ws.getCell("D1").value = "CÔNG TY TNHH SXTM GOLDMAX VIỆT NAM";
  ws.getCell("D1").font = { ...BASE_FONT, bold: true, size: 12, color: { argb: NAVY } };
  ws.getCell("D1").alignment = { horizontal: "left", vertical: "middle", shrinkToFit: true };

  const companyLines = [
    "GPĐKKD Số: 2401031714",
    "VP Miền Bắc: Số 670 Toàn Thắng - Xã Thuận An - TP. Hà Nội",
    "VP Miền Nam: A34 Shophouse Phú Mỹ Hiệp - TP. Hồ Chí Minh",
    "NHÀ MÁY SẢN XUẤT: Cụm CN Non Sáo, Xã Tân Dĩnh, Bắc Ninh",
    "Hotline: 1900 8135",
    "Email: Goldmaxdoor@gmail.com",
  ];
  companyLines.forEach((line, index) => {
    const row = index + 2;
    ws.mergeCells(`D${row}:K${row}`);
    const cell = ws.getCell(`D${row}`);
    cell.value = line;
    cell.font = { ...BASE_FONT, size: 7.8, color: { argb: MUTED } };
    cell.alignment = { horizontal: "left", vertical: "middle", wrapText: false, shrinkToFit: true };
  });

  ws.getCell("L1").value = "THÔNG TIN ĐƠN HÀNG";
  ws.getCell("L1").font = { ...BASE_FONT, bold: true, size: 14, color: { argb: NAVY } };
  ws.getCell("L1").alignment = { horizontal: "right", vertical: "middle", shrinkToFit: true };
  ws.getCell("L3").value = `Mã ĐH: ${order.orderCode}`;
  ws.getCell("L3").font = { ...BASE_FONT, bold: true, italic: true, size: 9, color: { argb: AMBER } };
  ws.getCell("L3").alignment = { horizontal: "right", vertical: "middle", shrinkToFit: true };

  const croppedLogoPath = path.join(process.cwd(), "public", "goldmax-logo-cropped.png");
  const originalLogoPath = path.join(process.cwd(), "public", "goldmax-logo.png");
  let logoPath = croppedLogoPath;
  try {
    await access(croppedLogoPath);
  } catch {
    logoPath = originalLogoPath;
  }
  try {
    await access(logoPath);
    const imageId = workbook.addImage({ filename: logoPath, extension: "png" });
    ws.addImage(imageId, { tl: { col: 0.12, row: 0.55 }, ext: { width: 136, height: 52 }, editAs: "oneCell" });
  } catch {
    // Không chặn xuất nếu thiếu logo.
  }

  const infoRows: Array<[string, string, string]> = [
    ["A9:H9", "Tên khách hàng", order.customerName || order.receiverName || order.customerCode || ""],
    ["I9:N9", "Địa chỉ", order.receiverAddress || ""],
    ["O9:S9", "Ngày đặt hàng", formatDate(order.orderDate)],
    ["A10:H10", "Mã đại lý", order.customerCode || ""],
    ["I10:N10", "Mã nhân viên", order.salesEmployeeCode || ""],
    ["O10:S10", "Ngày trả dự kiến", formatDate(order.requiredDeliveryDate)],
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
  styleRange(ws, "A9:S10", "FFF8FAFC", true);

  ws.getRow(1).height = 26;
  for (let row = 2; row <= 7; row += 1) ws.getRow(row).height = 15;
  ws.getRow(8).height = 7;
  ws.getRow(9).height = 22;
  ws.getRow(10).height = 22;
  ws.getRow(11).height = 7;
}

function writeDataHeader(ws: Worksheet) {
  const mergedHeaders: Array<[string, string]> = [
    ["A12:A13", "STT"],
    ["B12:B13", "BỘ SỐ"],
    ["C12:C13", "TÊN SẢN PHẨM / QUY CÁCH"],
    ["D12:D13", "MODEL"],
    ["E12:E13", "Ô TH."],
    ["F12:F13", "HƯỚNG"],
    ["G12:G13", "PHÀO"],
    ["H12:H13", "MÀU SƠN"],
    ["I12:I13", "KT CỬA (CAO x RỘNG)"],
    ["J12:J13", "KHUÔN"],
    ["K12:L12", "KT THÔNG THỦY"],
    ["M12:M13", "SL"],
    ["N12:N13", "ĐVT"],
    ["O12:O13", "KHỐI LƯỢNG"],
    ["P12:P13", "ĐƠN GIÁ (Đ)"],
    ["Q12:Q13", "THÀNH TIỀN (Đ)"],
    ["R12:R13", "GHI CHÚ KỸ THUẬT"],
    ["S12:S13", "HÌNH ẢNH SP"],
  ];
  for (const [range, value] of mergedHeaders) {
    ws.mergeCells(range);
    const cell = ws.getCell(range.split(":")[0]);
    cell.value = value;
  }
  ws.getCell("K13").value = "CAO";
  ws.getCell("L13").value = "RỘNG";
  styleRange(ws, "A12:S13", NAVY, true);
  for (let row = 12; row <= 13; row += 1) {
    for (let col = 1; col <= 19; col += 1) {
      const cell = ws.getCell(row, col);
      cell.fill = solid(NAVY);
      cell.font = { ...BASE_FONT, size: 7.2, bold: true, color: { argb: WHITE } };
      cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
      cell.border = ALL_BORDERS;
    }
  }
  ws.getRow(12).height = 22;
  ws.getRow(13).height = 20;
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
    toNumber(row.clearHeightMm),
    toNumber(row.clearWidthMm),
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
  for (let col = 1; col <= 19; col += 1) {
    const cell = ws.getCell(rowNo, col);
    cell.fill = solid(fill);
    cell.border = ALL_BORDERS;
    cell.font = main
      ? { ...BASE_FONT, size: 8.5, bold: col <= 4 || col >= 13 }
      : { ...BASE_FONT, size: 8, italic: true, color: { argb: MUTED } };
    cell.alignment = {
      // Từ ĐVT đến Thành tiền căn phải đồng bộ theo yêu cầu hiển thị số.
      horizontal: col >= 14 && col <= 17 ? "right" : [3, 4, 18].includes(col) ? "left" : "center",
      vertical: "top",
      wrapText: true,
    };
  }

  ws.getCell(`O${rowNo}`).numFmt = "#,##0.0000";
  ws.getCell(`P${rowNo}`).numFmt = "#,##0";
  ws.getCell(`Q${rowNo}`).numFmt = "#,##0";
  if (cleanText(row.note)) ws.getCell(`R${rowNo}`).font = { ...ws.getCell(`R${rowNo}`).font, color: { argb: main ? TEXT : MUTED } };

  const imageUrl = cleanText(row.imagePath) || (main ? cleanText(group.imagePath) : null);
  if (imageUrl) {
    const imageCell = ws.getCell(`S${rowNo}`);
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
          ws.addImage(imageId, { tl: { col: 18.12, row: rowNo - 0.9 }, ext: { width: 58, height: 36 }, editAs: "oneCell" });
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
  ws.mergeCells(`A${row}:S${row}`);
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
    ws.mergeCells(`L${r}:P${r}`);
    ws.mergeCells(`Q${r}:S${r}`);
    ws.getCell(`L${r}`).value = label;
    ws.getCell(`Q${r}`).value = amount;
    ws.getCell(`Q${r}`).numFmt = "#,##0 \"VNĐ\"";
    styleRange(ws, `L${r}:S${r}`, mode === "total" ? NAVY : mode === "accent" ? PALE_AMBER : WHITE, true);
    ws.getCell(`L${r}`).font = { ...BASE_FONT, bold: mode !== "normal", size: 8.5, color: { argb: mode === "total" ? WHITE : TEXT } };
    ws.getCell(`Q${r}`).font = { ...BASE_FONT, bold: true, size: 8.5, color: { argb: mode === "total" ? WHITE : mode === "accent" ? "FFDC2626" : NAVY } };
    ws.getCell(`L${r}`).alignment = { horizontal: "left", vertical: "middle" };
    ws.getCell(`Q${r}`).alignment = { horizontal: "right", vertical: "middle" };
    r += 1;
  }
  if (r <= endRow) {
    ws.mergeCells(`L${r}:S${endRow}`);
    ws.getCell(`L${r}`).value = `(Bằng chữ: ${numberToVietnameseWords(Math.round(totals.paymentDue))})`;
    ws.getCell(`L${r}`).font = { ...BASE_FONT, size: 7.5, italic: true, color: { argb: MUTED } };
    ws.getCell(`L${r}`).alignment = { horizontal: "right", vertical: "top", wrapText: true };
    styleRange(ws, `L${r}:S${endRow}`, WHITE, true);
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
