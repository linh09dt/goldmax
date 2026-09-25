import ExcelJS, { type Worksheet } from "exceljs";
import { access } from "node:fs/promises";
import path from "node:path";
import { resolveOrderItemDetails } from "@/lib/order-detail";
import type { OutputGroup } from "@/lib/order-output";
import { buildOutputGroups, calculateOutputTotals, cleanText, outputLineAmount, toNumber } from "@/lib/order-output";
import { logoBox } from "@/lib/png-size";

const NAVY = "FF1E3A8A";
const AMBER = "FFD97706";
const TEXT = "FF1F2937";
const MUTED = "FF6B7280";
const LIGHT = "FFF3F4F6";
const PALE_AMBER = "FFFFF7E6";
const WHITE = "FFFFFFFF";
const BORDER = { style: "thin" as const, color: { argb: "FFD1D5DB" } };
const ALL_BORDERS = { top: BORDER, left: BORDER, bottom: BORDER, right: BORDER };
// V67: đường kẻ của dòng phụ kiện chi tiết mờ hơn 60% so với đường kẻ dòng cửa
// (#D1D5DB → #EDEEF1) và chữ đỏ cho hàng "GHI CHÚ KỸ THUẬT".
const BORDER_SOFT = { style: "thin" as const, color: { argb: "FFEDEEF1" } };
const ALL_BORDERS_SOFT = { top: BORDER_SOFT, left: BORDER_SOFT, bottom: BORDER_SOFT, right: BORDER_SOFT };
const NOTE_RED = "FFDC2626";
const BASE_FONT = { name: "Arial", size: 11, color: { argb: TEXT } };
// V87: bề rộng logo trong khối banner (vùng merge A1:C6). Chiều cao suy ra từ tỉ lệ thật
// của file PNG nên logo GOLDMAX mới không bị kéo giãn dọc.
const LOGO_WIDTH_PX = 170;

// V53/V54: hộp ghi chú nhỏ in ở góc dưới bên trái (khung + nền nhạt nhạt, chữ nhỏ màu xám, không làm nổi bật).
const FOOTNOTE_FILL = "FFF8FAFC";
const FOOTNOTE_TITLE = "Ghi chú:";
const FOOTNOTE_LEAD = "Khách hàng xác nhận các thông tin sau:";
const FOOTNOTE_LINES = [
  "- Kích thước đã trừ khe hở chưa?",
  "- Nền có giật cấp hay không?",
  "- Mép tường có đắp phào xi măng hay không?",
  "- Khách hàng lên đơn lưu ý kiểm tra lại thông tin đơn hàng chăm sóc đã lên trước khi chốt cọc sx, mọi sai xót bên phía nhà máy không chịu trách nhiệm khi đã chốt cọc sx.",
];

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

  const ws = workbook.addWorksheet("Đơn đặt hàng V2", {
    pageSetup: {
      paperSize: 9,
      orientation: "landscape",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      horizontalCentered: true,
      margins: { left: 0.16, right: 0.16, top: 0.39, bottom: 0.39, header: 0.1, footer: 0.1 },
    },
    properties: { defaultRowHeight: 21 },
  });

  setupColumns(ws);
  await writeTopBanner(ws, workbook, order);
  writeDataHeader(ws);

  const groups = buildOutputGroups(order.items as any, resolveOrderItemDetails as any);
  const totals = calculateOutputTotals(groups, order);
  let rowNo = 14;

  let stripe = 0;
  for (const group of groups) {
    const pendingNotes: Array<{ note: string; main: boolean }> = [];
    // V68: ghi chú kỹ thuật của cả bộ cửa được in ở CUỐI bộ (sau dòng phụ kiện cuối cùng).
    const groupHasDetail = group.rows.some((entry) => !entry.main);
    // Nếu bộ có ghi chú thì hàng cuối bộ là hàng ghi chú (không phải hàng hàng hóa cuối).
    const groupHasNotes = group.rows.some((entry) => Boolean(cleanText(entry.row.note)));
    // V109: 1 ô ảnh cho cả bộ cửa — merge cột S từ dòng hàng đầu tới dòng hàng cuối của bộ.
    const firstItemRow = rowNo;
    for (const [index, entry] of group.rows.entries()) {
      const nextIsDetail = Boolean(group.rows[index + 1] && !group.rows[index + 1].main);
      const lastOfGroup = index === group.rows.length - 1 && !groupHasNotes;
      const note = cleanText(entry.row.note);
      await writeDataRow(ws, workbook, rowNo, group, entry.row, entry.main, entry.firstInGroup, stripe, nextIsDetail, lastOfGroup);
      rowNo += 1;
      if (note) pendingNotes.push({ note, main: entry.main });
    }
    await writeGroupImage(ws, workbook, firstItemRow, rowNo - 1, group);
    const groupSetNo = cleanText(group.setNo) || "";
    for (const [index, item] of pendingNotes.entries()) {
      rowNo = writeItemNoteRow(ws, rowNo, item.note, item.main, groupHasDetail, index === pendingNotes.length - 1, groupSetNo);
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
  rowNo = writeSummary(ws, rowNo, totals);
  rowNo += 1;

  ws.pageSetup.printTitlesRow = "12:13";
  ws.pageSetup.printArea = `A1:S${rowNo}`;
  ws.views = [{ state: "frozen", ySplit: 13, showGridLines: false }];
  ws.headerFooter.oddFooter = `&L Công ty TNHH SXTM GoldMax Việt Nam - Đơn đặt hàng #${order.orderCode}&R Trang &P / &N`;

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

function setupColumns(ws: Worksheet) {
  // 19 cột (V66): bỏ cột "GHI CHÚ KỸ THUẬT" (ghi chú chuyển thành hàng riêng dưới dòng hàng)
  // và chia lại bề rộng cho các cột còn lại; Excel tự fit 1 trang theo chiều ngang.
  // V70: đủ rộng để STT / BỘ SỐ / Ô THOÁNG / HƯỚNG / PHÀO / MÀU SƠN / KHUÔN nằm 1 dòng;
  // thu hẹp HÌNH ẢNH SP + ĐƠN GIÁ + THÀNH TIỀN (cho phép xuống dòng).
  const widths = [5, 9, 29, 19, 10, 7.5, 7.5, 9.5, 8, 8, 8, 8, 8, 5.5, 6.5, 10.5, 11.5, 12.5, 11];
  widths.forEach((width, index) => { ws.getColumn(index + 1).width = width; });
}

async function writeTopBanner(ws: Worksheet, workbook: ExcelJS.Workbook, order: ExportableOrderV2) {
  // Bố cục V2: Logo | thông tin công ty từng dòng | ĐƠN ĐẶT HÀNG.
  ws.mergeCells("A1:C6");
  ws.mergeCells("D1:L1");
  ws.mergeCells("M1:S2");
  ws.mergeCells("M3:S3");

  ws.getCell("D1").value = "CÔNG TY TNHH SXTM GOLDMAX VIỆT NAM";
  ws.getCell("D1").font = { ...BASE_FONT, bold: true, size: 14, color: { argb: NAVY } };
  ws.getCell("D1").alignment = { horizontal: "left", vertical: "middle", shrinkToFit: true };

  // V65: tách nhãn / giá trị ra 2 cột riêng để giá trị sau dấu ":" thẳng hàng dọc.
  const companyLines: Array<[string, string]> = [
    ["GPĐKKD Số:", "2401031714"],
    ["VP Miền Bắc:", "Số 670 Toàn Thắng - Xã Thuận An - TP. Hà Nội"],
    ["VP Miền Nam:", "A34 Shophouse Phú Mỹ Hiệp - TP. Hồ Chí Minh"],
    ["NHÀ MÁY SẢN XUẤT:", "Cụm CN Non Sáo, Xã Tân Dĩnh, Bắc Ninh"],
    ["Hotline:", "1900 8135"],
    ["Website:", "goldmaxdoor.vn"],
  ];
  companyLines.forEach(([label, value], index) => {
    const row = index + 2;
    // Nhãn ở cột D:E (rộng cố định) — giá trị ở cột F:L để mọi giá trị bắt đầu cùng một mốc.
    ws.mergeCells(`D${row}:E${row}`);
    const labelCell = ws.getCell(`D${row}`);
    labelCell.value = label;
    labelCell.font = { ...BASE_FONT, size: 9.8, color: { argb: MUTED } };
    labelCell.alignment = { horizontal: "left", vertical: "middle", wrapText: false, shrinkToFit: true };

    ws.mergeCells(`F${row}:L${row}`);
    const valueCell = ws.getCell(`F${row}`);
    valueCell.value = value;
    valueCell.font = { ...BASE_FONT, size: 9.8, color: { argb: MUTED } };
    valueCell.alignment = { horizontal: "left", vertical: "middle", wrapText: false, shrinkToFit: true };
  });

  // V65: ghi vào ô gốc của vùng merge M1:S2 / M3:S3 (trước đây ghi L1/L3 — là ô con của
  // vùng D1:L1 / D3:L3 nên ghi đè mất tên công ty và dòng "VP Miền Bắc").
  ws.getCell("M1").value = "ĐƠN ĐẶT HÀNG";
  ws.getCell("M1").font = { ...BASE_FONT, bold: true, size: 16, color: { argb: NAVY } };
  ws.getCell("M1").alignment = { horizontal: "right", vertical: "middle", shrinkToFit: true };
  ws.getCell("M3").value = `Mã ĐH: ${order.orderCode}`;
  ws.getCell("M3").font = { ...BASE_FONT, bold: true, italic: true, size: 11, color: { argb: AMBER } };
  ws.getCell("M3").alignment = { horizontal: "right", vertical: "middle", shrinkToFit: true };

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
    ws.addImage(imageId, {
      tl: { col: 0.12, row: 0.55 },
      ext: await logoBox(logoPath, LOGO_WIDTH_PX),
      editAs: "oneCell",
    });
  } catch {
    // Không chặn xuất nếu thiếu logo.
  }

  const infoRows: Array<[string, string, string]> = [
    ["A9:H9", "Tên khách hàng", order.customerName || order.receiverName || order.customerCode || ""],
    ["I9:O9", "Địa chỉ", order.receiverAddress || ""],
    ["P9:S9", "Ngày đặt hàng", formatDate(order.orderDate)],
    ["A10:H10", "Mã đại lý", order.customerCode || ""],
    ["I10:O10", "Mã nhân viên", order.salesEmployeeCode || ""],
    ["P10:S10", "Ngày trả dự kiến", formatDate(order.requiredDeliveryDate)],
  ];

  for (const [range, label, value] of infoRows) {
    ws.mergeCells(range);
    const cell = ws.getCell(range.split(":")[0]);
    cell.value = { richText: [
      { text: `${label}: `, font: { ...BASE_FONT, size: 10.5, color: { argb: MUTED } } },
      { text: value, font: { ...BASE_FONT, bold: true, size: 10.5, color: { argb: TEXT } } },
    ] };
    cell.alignment = { horizontal: "left", vertical: "middle", wrapText: false, shrinkToFit: true };
  }
  styleRange(ws, "A9:S10", "FFF8FAFC", true);

  ws.getRow(1).height = 30;
  for (let row = 2; row <= 7; row += 1) ws.getRow(row).height = 18;
  ws.getRow(8).height = 7;
  ws.getRow(9).height = 25;
  ws.getRow(10).height = 25;
  ws.getRow(11).height = 7;
}

function writeDataHeader(ws: Worksheet) {
  const mergedHeaders: Array<[string, string]> = [
    ["A12:A13", "STT"],
    ["B12:B13", "BỘ SỐ"],
    ["C12:C13", "TÊN SẢN PHẨM"],
    ["D12:D13", "MODEL"],
    ["E12:E13", "Ô THOÁNG"],
    ["F12:F13", "HƯỚNG"],
    ["G12:G13", "PHÀO"],
    ["H12:H13", "MÀU SƠN"],
    ["I12:J12", "KT CỬA (MM)"],
    ["K12:K13", "KHUÔN"],
    ["L12:M12", "KT THÔNG THỦY"],
    ["N12:N13", "SL"],
    ["O12:O13", "ĐVT"],
    ["P12:P13", "KHỐI LƯỢNG"],
    ["Q12:Q13", "ĐƠN GIÁ (Đ)"],
    ["R12:R13", "THÀNH TIỀN (Đ)"],
    ["S12:S13", "HÌNH ẢNH SP"],
  ];
  for (const [range, value] of mergedHeaders) {
    ws.mergeCells(range);
    const cell = ws.getCell(range.split(":")[0]);
    cell.value = value;
  }
  ws.getCell("I13").value = "CAO";
  ws.getCell("J13").value = "RỘNG";
  ws.getCell("L13").value = "CAO";
  ws.getCell("M13").value = "RỘNG";
  styleRange(ws, "A12:S13", NAVY, true);
  for (let row = 12; row <= 13; row += 1) {
    for (let col = 1; col <= 19; col += 1) {
      const cell = ws.getCell(row, col);
      cell.fill = solid(NAVY);
      cell.font = { ...BASE_FONT, size: 9.2, bold: true, color: { argb: WHITE } };
      cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
      cell.border = ALL_BORDERS;
    }
  }
  ws.getRow(12).height = 25;
  ws.getRow(13).height = 23;
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
  nextIsDetail: boolean,
  lastOfGroup: boolean,
) {
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
    toNumber(row.heightMm),
    toNumber(row.widthMm),
    toNumber(row.frameMm),
    toNumber(row.clearHeightMm),
    toNumber(row.clearWidthMm),
    toNumber(row.quantity),
    formatUnit(row.unit),
    toNumber(row.pricingQuantity),
    toNumber(row.unitPrice),
    outputLineAmount(row),
    "",
  ];
  values.forEach((value, index) => { ws.getCell(rowNo, index + 1).value = value as any; });

  const fill = main ? (stripe % 2 === 0 ? WHITE : LIGHT) : "FFFBFDFF";
  // V67: dòng phụ kiện chi tiết dùng đường kẻ mờ 60%; dòng cửa giữ đường kẻ thường
  // (trừ vạch dưới khi ngay bên dưới là phụ kiện, để cả khối phụ kiện cùng mờ).
  // V68: vạch cuối cùng của mỗi bộ cửa luôn là vạch thường (ranh giới giữa các bộ rõ ràng).
  const softBottom = !main || nextIsDetail;
  const border: Partial<ExcelJS.Borders> = {
    ...(main ? ALL_BORDERS : ALL_BORDERS_SOFT),
    bottom: lastOfGroup ? BORDER : softBottom ? BORDER_SOFT : BORDER,
  };

  for (let col = 1; col <= 19; col += 1) {
    const cell = ws.getCell(rowNo, col);
    cell.fill = solid(fill);
    cell.border = border;
    cell.font = main
      ? { ...BASE_FONT, size: 10.5, bold: col <= 4 || col >= 14 }
      : { ...BASE_FONT, size: 10, italic: true, color: { argb: MUTED } };
    cell.alignment = {
      // Từ ĐVT đến Thành tiền căn phải đồng bộ theo yêu cầu hiển thị số.
      horizontal: col >= 15 && col <= 18 ? "right" : [3, 4].includes(col) ? "left" : "center",
      vertical: "top",
      wrapText: true,
    };
  }

  ws.getCell(`P${rowNo}`).numFmt = "#,##0.0000";
  ws.getCell(`Q${rowNo}`).numFmt = "#,##0";
  ws.getCell(`R${rowNo}`).numFmt = "#,##0";
  // Không để ghi chú/tên hàng bị cắt như bản Excel V2 cũ.
  // V66: ghi chú không còn nằm trong dòng hàng (đã thành hàng riêng bên dưới).
  const estimatedLines = Math.max(
    estimateWrappedLines(productName, 28),
    estimateWrappedLines(cleanText(row.productCode) || cleanText(row.model) || "", 22),
  );
  const contentHeight = (main ? 17 : 15) + Math.max(0, estimatedLines - 1) * (main ? 10 : 9);
  ws.getRow(rowNo).height = Math.max(ws.getRow(rowNo).height || 0, main ? 29 : 25, contentHeight);
}

// V66: hàng ghi chú kỹ thuật của 1 dòng hàng — trải hết chiều ngang bảng (A→S).
/**
 * V109: gộp ô ẢNH SP của cả bộ cửa (merge S{first}:S{last}) và chỉ gắn MỘT ảnh
 * đã căn giữa theo chiều dọc của khối. Ảnh ưu tiên của dòng cửa, chưa có thì lấy
 * ảnh phụ kiện đầu tiên. Nếu không nhúng được ảnh thì để hyperlink "Xem ảnh".
 */
async function writeGroupImage(
  ws: Worksheet,
  workbook: ExcelJS.Workbook,
  firstRow: number,
  lastRow: number,
  group: OutputGroup,
) {
  if (lastRow > firstRow) ws.mergeCells(`S${firstRow}:S${lastRow}`);
  const cell = ws.getCell(`S${firstRow}`);
  cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
  const own = cleanText(group.imagePath);
  const imageUrl = own || group.rows.map((entry) => cleanText(entry.row.imagePath)).find(Boolean) || "";
  if (!imageUrl) return;

  cell.value = { text: "Xem ảnh", hyperlink: imageUrl, tooltip: "Mở hình ảnh sản phẩm" };
  cell.font = { ...BASE_FONT, size: 9.5, color: { argb: "FF2563EB" }, underline: true };
  try {
    const response = await fetch(imageUrl, { cache: "no-store" });
    if (!response.ok) return;
    const contentType = response.headers.get("content-type") || "";
    const extension = contentType.includes("png") ? "png" : contentType.includes("jpeg") || contentType.includes("jpg") ? "jpeg" : null;
    if (!extension) return;
    const imageBuffer = Buffer.from(await response.arrayBuffer());
    const imageId = workbook.addImage({ buffer: imageBuffer as any, extension });
    const rowsInBlock = Math.max(1, lastRow - firstRow + 1);
    // Căn giữa theo chiều dọc khối: 1 dòng giữ nguyên như trước, nhiều dòng thì hạ xuống giữa khối.
    const anchorRow = firstRow - 1 + (rowsInBlock - 1) / 2 + 0.1;
    ws.addImage(imageId, { tl: { col: 18.12, row: anchorRow }, ext: { width: 58, height: 36 }, editAs: "oneCell" });
    cell.value = null;
    ws.getRow(firstRow).height = Math.max(ws.getRow(firstRow).height || 0, 34);
  } catch {
    // Giữ hyperlink nếu không thể tải ảnh.
  }
}

function writeItemNoteRow(
  ws: Worksheet,
  rowNo: number,
  note: string,
  main: boolean,
  groupHasDetail: boolean,
  isLastNote: boolean,
  setNo: string,
) {
  ws.mergeCells(`A${rowNo}:S${rowNo}`);
  const cell = ws.getCell(`A${rowNo}`);
  // V69: nhãn kèm bộ số — GHI CHÚ KỸ THUẬT (Bộ số 12119): <nội dung>
  const label = setNo ? `GHI CHÚ KỸ THUẬT (Bộ số ${setNo}):` : "GHI CHÚ KỸ THUẬT:";
  cell.value = `${label} ${note}`;
  // V67: chữ đỏ. Đường kẻ: mép trên theo dòng cha (cửa = viền thường, phụ kiện = viền mờ),
  // mép dưới mờ nếu bên dưới là khối phụ kiện chi tiết.
  cell.font = { ...BASE_FONT, size: 9.5, italic: true, color: { argb: NOTE_RED } };
  cell.alignment = { horizontal: "left", vertical: "middle", wrapText: true };
  styleRange(ws, `A${rowNo}:S${rowNo}`, "FFF8FAFC", true);
  cell.font = { ...BASE_FONT, size: 9.5, italic: true, color: { argb: NOTE_RED } };
  // V68: hàng ghi chú nay nằm cuối bộ cửa — mép mờ theo khối phụ kiện phía trên,
  // vạch dưới của hàng ghi chú cuối cùng là vạch thường (ranh giới bộ).
  const top = groupHasDetail ? BORDER_SOFT : BORDER;
  const bottom = isLastNote ? BORDER : groupHasDetail ? BORDER_SOFT : BORDER;
  styleRange(ws, `A${rowNo}:S${rowNo}`, "FFF8FAFC", true, { top, left: top, bottom, right: top });
  ws.getRow(rowNo).height = Math.max(16, 12.5 * Math.max(1, Math.ceil(cell.value.length / 190)));
  return rowNo + 1;
}

// V73: đơn vị "m2" hiển thị thành m² (mét vuông) — ký tự ² thật (U+00B2) thay cho "m2".
function formatUnit(value: unknown): string {
  const text = cleanText(value) || "";
  return /^m2$/i.test(text.trim()) ? "m\u00B2" : text;
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
  cell.font = { ...BASE_FONT, bold: true, size: 12, color: { argb: AMBER } };
  cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
  cell.fill = solid(PALE_AMBER);
  cell.border = { top: { style: "medium", color: { argb: AMBER } }, bottom: { style: "medium", color: { argb: AMBER } }, left: BORDER, right: BORDER };
  ws.getRow(row).height = Math.max(28, 21 * Math.max(1, note.split("\n").length));
  return row + 1;
}

function writeSummary(
  ws: Worksheet,
  startRow: number,
  totals: ReturnType<typeof calculateOutputTotals>,
) {
  // V52: bỏ bảng "BẢNG CHECKLIST XÁC NHẬN KỸ THUẬT VỚI ĐẠI LÝ" khỏi bản xuất (form tạo đơn cũng bỏ ô nhập tương ứng).
  // V51: chỉ hiện "Chiết khấu thương mại" + "Tổng tiền sau chiết khấu" khi đơn thật sự có chiết khấu (> 0%).
  // Không có chiết khấu / chiết khấu 0% thì ẩn hẳn dòng "Tổng tiền sau chiết khấu" (số tiền bằng Tổng giá trị đơn hàng).
  const hasDiscount = totals.discountPercent > 0 && totals.discountAmount > 0;
  // V61: nhãn IN HOA + hộp tiền trải hết chiều ngang bản in (nhãn bên trái, số tiền bên phải,
  // không có vạch dọc giữa) đúng theo bản vẽ.
  const summary: Array<[string, number, "normal" | "accent" | "total"]> = [
    ["TỔNG GIÁ TRỊ ĐƠN HÀNG:", totals.orderTotal, "normal"],
  ];
  if (hasDiscount) {
    summary.push([`CHIẾT KHẤU THƯƠNG MẠI (${totals.discountPercent}%):`, -totals.discountAmount, "accent"]);
    summary.push(["TỔNG TIỀN SAU CHIẾT KHẤU:", totals.afterDiscount, "normal"]);
  }
  summary.push(["ĐÃ ĐẶT CỌC:", totals.depositAmount, "normal"]);
  if (totals.warehouseReceiptDeduction > 0) {
    summary.push(["TRỪ TIỀN NHẬN HÀNG TẠI KHO:", totals.warehouseReceiptDeduction, "normal"]);
  }
  summary.push(["CÒN LẠI CẦN THANH TOÁN:", totals.paymentDue, "total"]);

  let r = startRow;
  for (const [label, amount, mode] of summary) {
    ws.mergeCells(`A${r}:P${r}`);
    ws.mergeCells(`Q${r}:S${r}`);
    ws.getCell(`A${r}`).value = label;
    ws.getCell(`Q${r}`).value = amount;
    ws.getCell(`Q${r}`).numFmt = "#,##0 \"VNĐ\"";
    styleRange(ws, `A${r}:S${r}`, mode === "total" ? NAVY : mode === "accent" ? PALE_AMBER : WHITE, true);
    // Bỏ vạch dọc giữa nhãn và số tiền cho giống bản vẽ.
    const labelCell = ws.getCell(`P${r}`);
    labelCell.border = { ...labelCell.border, right: undefined };
    const amountCell = ws.getCell(`Q${r}`);
    amountCell.border = { ...amountCell.border, left: undefined };
    ws.getCell(`A${r}`).font = { ...BASE_FONT, bold: mode !== "normal", size: 10.5, color: { argb: mode === "total" ? WHITE : TEXT } };
    ws.getCell(`Q${r}`).font = { ...BASE_FONT, bold: true, size: 10.5, color: { argb: mode === "total" ? WHITE : mode === "accent" ? "FFDC2626" : NAVY } };
    ws.getCell(`A${r}`).alignment = { horizontal: "left", vertical: "middle" };
    ws.getCell(`Q${r}`).alignment = { horizontal: "right", vertical: "middle" };
    r += 1;
  }

  // Dòng "Bằng chữ" chiếm 2 hàng để câu tiếng Việt dài vẫn xuống dòng gọn gàng.
  const wordsEnd = r + 1;
  ws.mergeCells(`A${r}:S${wordsEnd}`);
  ws.getCell(`A${r}`).value = `(Bằng chữ: ${numberToVietnameseWords(Math.round(totals.paymentDue))})`;
  ws.getCell(`A${r}`).font = { ...BASE_FONT, size: 9.5, italic: true, color: { argb: MUTED } };
  ws.getCell(`A${r}`).alignment = { horizontal: "right", vertical: "top", wrapText: true };
  styleRange(ws, `A${r}:S${wordsEnd}`, WHITE, true);

  // V53→V57: hộp ghi chú ở dưới box tiền, trải hết chiều ngang bản in (cột A→S), chữ 8pt xám.
  const noteStart = wordsEnd + 2;
  let noteRow = noteStart;
  const noteLines: Array<{ text: string; font: Partial<ExcelJS.Font> }> = [
    // V60: “Ghi chú:” đậm + nghiêng + gạch chân + chữ đỏ.
    { text: FOOTNOTE_TITLE, font: { bold: true, italic: true, underline: true, color: { argb: "FFDC2626" } } },
    { text: FOOTNOTE_LEAD, font: { bold: true, color: { argb: TEXT } } },
    ...FOOTNOTE_LINES.map((text) => ({ text, font: {} })),
  ];
  for (const line of noteLines) {
    ws.mergeCells(`A${noteRow}:S${noteRow}`);
    const cell = ws.getCell(`A${noteRow}`);
    cell.value = line.text;
    cell.font = { ...BASE_FONT, size: 8, color: { argb: MUTED }, ...line.font };
    cell.alignment = { horizontal: "left", vertical: "middle", wrapText: true };
    // Ước lượng số dòng cho câu dài (A→S rộng ~202 ký tự ≈ 270 ký tự @8pt) để không bị cắt chữ.
    ws.getRow(noteRow).height = 13 * Math.max(1, Math.ceil(line.text.length / 200));
    noteRow += 1;
  }
  styleRange(ws, `A${noteStart}:S${noteRow - 1}`, FOOTNOTE_FILL, true);
  return noteRow - 1;
}

function styleRange(
  ws: Worksheet,
  range: string,
  fillArgb: string,
  border: boolean | Partial<ExcelJS.Borders> = false,
  borderStyle: Partial<ExcelJS.Borders> = ALL_BORDERS,
) {
  const [from, to] = range.split(":");
  const start = ws.getCell(from);
  const end = ws.getCell(to || from);
  for (let row = start.row; row <= end.row; row += 1) {
    for (let col = start.col; col <= end.col; col += 1) {
      const cell = ws.getCell(row, col);
      cell.fill = solid(fillArgb);
      if (!cell.font?.name) cell.font = BASE_FONT;
      if (border || borderStyle !== ALL_BORDERS) cell.border = borderStyle;
    }
  }
}

function solid(argb: string): ExcelJS.Fill {
  return { type: "pattern", pattern: "solid", fgColor: { argb } };
}

function formatDate(value: Date | null) {
  return value ? new Intl.DateTimeFormat("vi-VN").format(value) : "";
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
