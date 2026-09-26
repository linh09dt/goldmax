export const DEFAULT_DISCOUNT_PERCENT = 12;

export type OutputLine = Record<string, any> & {
  pricingQuantity?: unknown;
  unitPrice?: unknown;
  amount?: unknown;
};

/** V133: một ảnh của bộ cửa khi xuất file (kích thước px để trống = tự động vừa ô). */
export type OutputImage = {
  imagePath: string;
  imageWidth?: unknown;
  imageHeight?: unknown;
};

export type OutputGroup = {
  lineNo: number;
  setNo: string | null;
  imagePath: string | null;
  /** V133: nhiều ảnh của bộ cửa (ảnh 1 là ảnh đại diện). */
  images: OutputImage[];
  rows: Array<{ row: OutputLine; main: boolean; firstInGroup: boolean }>;
};

import { isMeaningfulOrderDetail } from "./order-detail";

export function hasPricingQuantity(value: unknown) {
  if (value === null || value === undefined) return false;
  const raw = String(value).trim();
  if (!raw || raw === "-" || raw === "—") return false;
  const number = Number(raw.replace(/,/g, ""));
  return Number.isFinite(number) ? number > 0 : true;
}

/**
 * V133.2: dòng được hiển thị / xuất file khi có DỮ LIỆU THẬT.
 *
 * Trước đây chỗ này đòi `hasPricingQuantity` (phải có "Số KH/Lượng") nên:
 * - dòng phụ kiện nhập tay không điền Số KH/Lượng bị ẩn khỏi chi tiết đơn + mọi file xuất;
 * - đơn chỉ nhập phụ kiện (không nhập dòng bộ cửa) ra "Chi tiết từng bộ cửa (0)".
 * Quy tắc đúng theo ORDER_DETAIL_V4: chỉ ẩn dòng mẫu rỗng (0 / - / — / #N/A).
 */
export function hasRowContent(row: Record<string, unknown>): boolean {
  return isMeaningfulOrderDetail(row, { ignoreSetNo: true });
}

export function buildOutputGroups(
  items: Array<OutputLine & { lineNo: number; setNo?: string | null; imagePath?: string | null; images?: OutputImage[]; details?: OutputLine[] }>,
  detailResolver?: (item: any) => OutputLine[],
): OutputGroup[] {
  return items.flatMap((item) => {
    const details = detailResolver ? detailResolver(item) : (item.details ?? []);
    const rows: Array<{ row: OutputLine; main: boolean; firstInGroup: boolean }> = [];

    if (hasRowContent(item as unknown as Record<string, unknown>)) rows.push({ row: item, main: true, firstInGroup: true });
    for (const detail of details) {
      if (!hasRowContent(detail as unknown as Record<string, unknown>)) continue;
      rows.push({ row: detail, main: false, firstInGroup: rows.length === 0 });
    }

    if (!rows.length) return [];
    const images: OutputImage[] = (Array.isArray(item.images) ? item.images : [])
      .map((image) => ({ imagePath: cleanText(image?.imagePath) ?? "", imageWidth: image?.imageWidth, imageHeight: image?.imageHeight }))
      .filter((image) => Boolean(image.imagePath));
    return [{
      lineNo: item.lineNo,
      setNo: cleanText(item.setNo),
      imagePath: cleanText(item.imagePath),
      images,
      rows,
    }];
  });
}

/**
 * V133: danh sách ảnh dùng để xuất file của một bộ cửa.
 * Ưu tiên gallery nhiều ảnh; đơn cũ (chưa có gallery) dùng ảnh đơn như trước.
 */
export function groupImages(group: OutputGroup): OutputImage[] {
  if (group.images.length) return group.images;
  const row = groupImageSourceRow(group);
  const path = cleanText(row?.imagePath);
  return path ? [{ imagePath: path, imageWidth: row?.imageWidth, imageHeight: row?.imageHeight }] : [];
}

export function outputLineAmount(row: OutputLine) {
  const explicit = toNumber(row.amount);
  if (explicit !== null && explicit > 0) return explicit;
  return (toNumber(row.pricingQuantity) ?? 0) * (toNumber(row.unitPrice) ?? 0);
}

export function calculateOutputTotals(
  groups: OutputGroup[],
  input: {
    shippingFee?: unknown;
    depositAmount?: unknown;
    warehouseReceiptDeduction?: unknown;
    discountPercent?: unknown;
  },
) {
  const goodsTotal = roundMoney(groups.reduce(
    (sum, group) => sum + group.rows.reduce((rowSum, entry) => rowSum + outputLineAmount(entry.row), 0),
    0,
  ));
  const shippingFee = Math.max(0, toNumber(input.shippingFee) ?? 0);
  const orderTotal = roundMoney(goodsTotal + shippingFee);
  const discountPercent = clampPercent(toNumber(input.discountPercent) ?? DEFAULT_DISCOUNT_PERCENT);
  const discountAmount = roundMoney((orderTotal * discountPercent) / 100);
  const afterDiscount = roundMoney(Math.max(0, orderTotal - discountAmount));
  const depositAmount = Math.max(0, toNumber(input.depositAmount) ?? 0);
  const warehouseReceiptDeduction = Math.max(0, toNumber(input.warehouseReceiptDeduction) ?? 0);
  const paymentDue = roundMoney(Math.max(0, afterDiscount - depositAmount - warehouseReceiptDeduction));
  return {
    goodsTotal,
    shippingFee,
    orderTotal,
    discountPercent,
    discountAmount,
    afterDiscount,
    depositAmount,
    warehouseReceiptDeduction,
    paymentDue,
  };
}

export function toNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(String(value).replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

export function cleanText(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  if (!text || text === "-" || text === "—") return null;
  return text;
}

/**
 * V131: dòng đang cung cấp ảnh cho cả bộ cửa — ưu tiên dòng cửa (ảnh của bộ),
 * chưa có thì dòng chi tiết/phụ kiện đầu tiên có ảnh (đúng quy tắc chọn ảnh của V109).
 */
export function groupImageSourceRow(group: OutputGroup): OutputLine | null {
  if (cleanText(group.imagePath)) {
    const main = group.rows.find((entry) => entry.main) ?? group.rows[0];
    if (main) return main.row;
  }
  const withImage = group.rows.find((entry) => cleanText(entry.row.imagePath));
  return withImage ? withImage.row : null;
}

/** 24–800 px: khớp với giới hạn ở `order-persistence.ts` và `excel-image-cell.ts`. */
function manualImagePx(value: unknown): number | null {
  const parsed = toNumber(value);
  if (parsed === null) return null;
  const rounded = Math.round(parsed);
  if (rounded < 24 || rounded > 800) return null;
  return rounded;
}

/** V131: kích thước ảnh do người dùng chỉnh tay cho một bộ cửa; null = để hệ thống tự co giãn. */
export function groupManualImageSize(group: OutputGroup): { width: number; height: number } | null {
  const row = groupImageSourceRow(group);
  if (!row) return null;
  const width = manualImagePx(row.imageWidth);
  const height = manualImagePx(row.imageHeight);
  return width && height ? { width, height } : null;
}

/** V133: cỡ tay của một ảnh bất kỳ trong danh sách (null = tự động). */
export function outputImageManualSize(image: OutputImage): { width: number; height: number } | null {
  const width = manualImagePx(image.imageWidth);
  const height = manualImagePx(image.imageHeight);
  return width && height ? { width, height } : null;
}

function clampPercent(value: number) {
  return Math.min(100, Math.max(0, value));
}

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
