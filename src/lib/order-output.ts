export const DEFAULT_DISCOUNT_PERCENT = 12;

export type OutputLine = Record<string, any> & {
  pricingQuantity?: unknown;
  unitPrice?: unknown;
  amount?: unknown;
};

export type OutputGroup = {
  lineNo: number;
  setNo: string | null;
  imagePath: string | null;
  rows: Array<{ row: OutputLine; main: boolean; firstInGroup: boolean }>;
};

export function hasPricingQuantity(value: unknown) {
  if (value === null || value === undefined) return false;
  const raw = String(value).trim();
  if (!raw || raw === "-" || raw === "—") return false;
  const number = Number(raw.replace(/,/g, ""));
  return Number.isFinite(number) ? number > 0 : true;
}

export function buildOutputGroups(
  items: Array<OutputLine & { lineNo: number; setNo?: string | null; imagePath?: string | null; details?: OutputLine[] }>,
  detailResolver?: (item: any) => OutputLine[],
): OutputGroup[] {
  return items.flatMap((item) => {
    const details = detailResolver ? detailResolver(item) : (item.details ?? []);
    const rows: Array<{ row: OutputLine; main: boolean; firstInGroup: boolean }> = [];

    if (hasPricingQuantity(item.pricingQuantity)) rows.push({ row: item, main: true, firstInGroup: true });
    for (const detail of details) {
      if (!hasPricingQuantity(detail.pricingQuantity)) continue;
      rows.push({ row: detail, main: false, firstInGroup: rows.length === 0 });
    }

    if (!rows.length) return [];
    return [{
      lineNo: item.lineNo,
      setNo: cleanText(item.setNo),
      imagePath: cleanText(item.imagePath),
      rows,
    }];
  });
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

function clampPercent(value: number) {
  return Math.min(100, Math.max(0, value));
}

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
