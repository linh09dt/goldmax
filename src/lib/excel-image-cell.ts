import type { Worksheet } from "exceljs";

/**
 * V110b — Tính vị trí & kích thước ảnh sản phẩm trong ô Excel sao cho ảnh **lấp đầy ô**
 * (thay vì cỡ cứng 82×48 / 58×36 px như trước, khiến ảnh nằm lọt thỏm giữa ô).
 *
 * Quy tắc:
 *  1. Bề rộng ảnh = bề rộng cột trừ lề 2 bên (ảnh rộng hết ô).
 *  2. Khối ô (1 ô ảnh cho cả BỘ CỬA, đã merge) chưa đủ cao để chứa ảnh đúng tỉ lệ thì
 *     **nới dòng đầu của bộ** thêm đúng phần còn thiếu (không bóp méo ảnh), có trần an toàn.
 *  3. Ảnh canh giữa cả ngang lẫn dọc trong ô, giữ đúng tỉ lệ thật (`contain`).
 *
 * Vì sao phải neo bằng EMU tuyệt đối (`nativeCol/nativeColOff/nativeRow/nativeRowOff`):
 * ExcelJS quy đổi dạng phân số `{col, row}` bằng đơn vị riêng của nó — 1 cột = `width × 10000`
 * EMU, tức chỉ ~16,8 px cho cột rộng 16 ký tự (thật ra cột đó rộng ~117 px) — nên mọi khoảng
 * lệch ngang bị nén ~7 lần và lệch dọc bị nén ~1,27 lần (ExcelJS tính 1 pt = 10000 EMU thay vì
 * 12700 EMU). Dùng EMU tuyệt đối cho ra đúng vị trí trong Excel và mọi trình đọc OOXML khác.
 */

const PX_PER_POINT = 96 / 72;
/** 1 px = 9525 EMU (OOXML). */
export const EMU_PER_PX = 9525;
export const EXCEL_DEFAULT_ROW_HEIGHT_PT = 21;

/** ExcelJS `column.width` (đơn vị ký tự) → pixel, theo cách Excel tính với font mặc định 11pt. */
export function columnWidthToPx(width: number) {
  return Math.round(width * 7) + 5;
}

function rowHeightPx(ws: Worksheet, row: number) {
  const height = ws.getRow(row).height;
  if (!height || !Number.isFinite(height) || height <= 0) {
    const fallback = ws.properties?.defaultRowHeight;
    return (fallback && fallback > 0 ? fallback : EXCEL_DEFAULT_ROW_HEIGHT_PT) * PX_PER_POINT;
  }
  return height * PX_PER_POINT;
}

/** Tổng chiều cao (px) của khối dòng đã merge của một bộ cửa. */
export function blockHeightPx(ws: Worksheet, firstRow: number, lastRow: number) {
  let total = 0;
  for (let row = firstRow; row <= lastRow; row += 1) total += rowHeightPx(ws, row);
  return total;
}

/**
 * Nới chiều cao dòng ĐẦU của bộ cho tới khi khối đủ cao chứa ảnh (`wantedBlockPx`),
 * nhưng không vượt `maxFirstRowPx` để form không bị một dòng cao vống lên.
 * Trả về chiều cao khối (px) sau khi nới.
 */
function growFirstRowToFit(
  ws: Worksheet,
  firstRow: number,
  lastRow: number,
  wantedBlockPx: number,
  maxFirstRowPx: number,
) {
  const blockPx = blockHeightPx(ws, firstRow, lastRow);
  if (blockPx >= wantedBlockPx) return blockPx;

  const row = ws.getRow(firstRow);
  const currentPx = rowHeightPx(ws, firstRow);
  const targetPx = Math.min(maxFirstRowPx, currentPx + (wantedBlockPx - blockPx));
  if (targetPx <= currentPx) return blockPx;

  row.height = Number((targetPx / PX_PER_POINT).toFixed(2));
  return blockPx - currentPx + targetPx;
}

/** Dò xem khoảng lệch dọc (px) rơi vào dòng nào của khối, và lệch thêm bao nhiêu trong dòng đó. */
function rowAnchorAt(ws: Worksheet, firstRow: number, lastRow: number, offsetPx: number) {
  let remaining = Math.max(0, offsetPx);
  for (let row = firstRow; row <= lastRow; row += 1) {
    const heightPx = rowHeightPx(ws, row);
    if (remaining < heightPx) return { row, offsetPx: remaining };
    remaining -= heightPx;
  }
  // Lệch vượt quá khối (ảnh nhỏ hơn khối): neo ở dòng cuối, canh giữa dòng đó.
  const heightPx = rowHeightPx(ws, lastRow);
  return { row: lastRow, offsetPx: Math.max(0, (heightPx - 1) / 2) };
}

export type ProductImagePlacement = {
  /** Kích thước hiển thị (px) — đã giữ đúng tỉ lệ ảnh. */
  width: number;
  height: number;
  /** Neo EMU tuyệt đối (0-based) — dùng cho `addProductImage`. */
  tl: { nativeCol: number; nativeColOff: number; nativeRow: number; nativeRowOff: number };
};

/**
 * Tính chỗ đặt ảnh sản phẩm trong ô (cột ảnh đã merge theo bộ cửa).
 * `aspect` = chiều rộng / chiều cao thật của ảnh (không đọc được thì dùng 5/3).
 */
export function fitProductImageInCell(options: {
  ws: Worksheet;
  firstRow: number;
  lastRow: number;
  columnIndex: number;
  columnWidth: number;
  aspect: number;
  paddingPx?: number;
  maxFirstRowHeightPx?: number;
}): ProductImagePlacement {
  const padding = options.paddingPx ?? 4;
  const maxFirstRowPx = options.maxFirstRowHeightPx ?? 90;
  const aspect = Number.isFinite(options.aspect) && options.aspect > 0.05 ? options.aspect : 5 / 3;

  const columnPx = columnWidthToPx(options.columnWidth);
  const availableWidth = Math.max(24, columnPx - padding * 2);

  // 1) Nới dòng đầu nếu khối chưa đủ cao cho ảnh rộng hết ô.
  const blockPx = growFirstRowToFit(
    options.ws,
    options.firstRow,
    options.lastRow,
    availableWidth / aspect + padding * 2,
    maxFirstRowPx,
  );

  // 2) Ảnh vừa khít khối, giữ đúng tỉ lệ (contain).
  const availableHeight = Math.max(16, blockPx - padding * 2);
  let width = availableWidth;
  let height = availableWidth / aspect;
  if (height > availableHeight) {
    height = availableHeight;
    width = availableHeight * aspect;
  }
  width = Math.max(8, Math.round(width));
  height = Math.max(8, Math.round(height));

  // 3) Canh giữa trong ô.
  const offsetX = Math.max(0, (columnPx - width) / 2);
  const offsetY = Math.max(0, (blockPx - height) / 2);
  const anchor = rowAnchorAt(options.ws, options.firstRow, options.lastRow, offsetY);

  return {
    width,
    height,
    tl: {
      nativeCol: options.columnIndex,
      nativeColOff: Math.round(offsetX * EMU_PER_PX),
      nativeRow: anchor.row - 1,
      nativeRowOff: Math.round(anchor.offsetPx * EMU_PER_PX),
    },
  };
}

/** Gắn ảnh vào ô với đúng kích thước/neo đã tính — ảnh cố định theo ô (`editAs: oneCell`). */
export function addProductImage(
  ws: Worksheet,
  imageId: number,
  placement: ProductImagePlacement,
): void {
  ws.addImage(imageId, {
    // ExcelJS khai báo `tl` chỉ có {col,row} nhưng runtime nhận cả dạng EMU tuyệt đối — xem
    // ghi chú đầu file để hiểu vì sao phải dùng dạng này (dạng phân số bị nén đơn vị).
    tl: placement.tl as unknown as { col: number; row: number },
    ext: { width: placement.width, height: placement.height },
    editAs: "oneCell",
  });
}
