/**
 * V130 — Thư viện tổng hợp số liệu cho nhóm trang BÁO CÁO.
 *
 * Toàn bộ hàm ở đây là **hàm thuần** (không truy vấn DB): trang chỉ lấy dữ liệu thô bằng Prisma
 * rồi gọi các hàm này, giống cách `src/lib/dashboard.ts` đang làm. Nhờ vậy dễ kiểm thử và có thể
 * tái dùng để xuất Excel.
 *
 * Quy ước nghiệp vụ bám V112:
 *  - DOANH THU chỉ gồm đơn LOẠI "Sản xuất" (SAN_XUAT) ở trạng thái ĐÃ XÁC NHẬN.
 *  - Đơn nháp / đơn mẫu / đơn làm lại vẫn thống kê số lượng & giá trị đơn nhưng KHÔNG vào doanh thu.
 *  - Sản lượng = Σ KH/Lượng (pricingQuantity) của dòng hàng + dòng chi tiết/phụ kiện.
 */

import { isConfirmedStatus } from "@/lib/order-form";

export const REVENUE_ORDER_TYPE = "SAN_XUAT";

export type ReportLine = {
  productName: string | null;
  productCode: string | null;
  model: string | null;
  unit: string | null;
  quantity: number | null;
  pricingQuantity: number | null;
  unitPrice: unknown;
  amount: unknown;
};

export type ReportOrder = {
  id: number;
  orderCode: string;
  orderType: string;
  status: string;
  customerCode: string | null;
  customerName: string | null;
  salesEmployeeCode: string | null;
  region: string | null;
  orderDate: Date | null;
  requiredDeliveryDate: Date | null;
  createdAt?: Date | null;
  shippingFee: unknown;
  subtotal: unknown;
  discountAmount: unknown;
  totalAfterDiscount: unknown;
  depositAmount: unknown;
  warehouseReceiptDeduction: unknown;
  deliveryPayment: unknown;
  items: Array<ReportLine & { details?: ReportLine[] }>;
};

export type MasterProduct = {
  id: number;
  code: string;
  name: string;
  productDescription: string | null;
  salesModel: string | null;
  unit: string | null;
};

export type BreakdownRow = { key: string; label: string; orders: number; value: number; share: number };
export type MonthPoint = { key: string; label: string; revenue: number; orders: number };
export type BucketRow = { key: string; label: string; orders: number; value: number; tone: "neutral" | "warn" | "bad" };

const MS_DAY = 86_400_000;

export function num(value: unknown): number {
  if (value === null || value === undefined || value === "") return 0;
  const parsed = Number(String(value));
  return Number.isFinite(parsed) ? parsed : 0;
}

export function normalizeCode(value: unknown): string {
  return String(value ?? "").trim().toLocaleUpperCase("vi-VN").replace(/\s+/g, "");
}

export function isRevenueOrder(order: ReportOrder): boolean {
  return order.orderType === REVENUE_ORDER_TYPE && isConfirmedStatus(order.status);
}

export function orderValue(order: ReportOrder): number {
  return num(order.totalAfterDiscount);
}

export function orderRemaining(order: ReportOrder): number {
  return num(order.deliveryPayment);
}

export function orderCollected(order: ReportOrder): number {
  return Math.max(0, orderValue(order) - orderRemaining(order));
}

/** Tất cả dòng hàng của đơn: dòng chính + dòng chi tiết/phụ kiện. */
export function allLines(order: ReportOrder): ReportLine[] {
  return order.items.flatMap((item) => [item, ...(item.details ?? [])]);
}

export function lineAmount(line: ReportLine): number {
  const explicit = num(line.amount);
  if (explicit > 0) return explicit;
  return num(line.pricingQuantity) * num(line.unitPrice);
}

export function lineVolume(line: ReportLine): number {
  const pricing = num(line.pricingQuantity);
  return pricing > 0 ? pricing : num(line.quantity);
}

/** Dòng có KH/Lượng > 0 (được tính vào sản lượng / số bộ). */
export function pricedLines(order: ReportOrder): ReportLine[] {
  return allLines(order).filter((line) => num(line.pricingQuantity) > 0);
}

export function orderSets(order: ReportOrder): number {
  return pricedLines(order).length;
}

export function orderVolume(order: ReportOrder): number {
  return pricedLines(order).reduce((sum, line) => sum + lineVolume(line), 0);
}

export function startOfDayUtc(value: Date): Date {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}

export function daysBetween(from: Date, to: Date): number {
  return Math.round((startOfDayUtc(to).getTime() - startOfDayUtc(from).getTime()) / MS_DAY);
}

function monthKey(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(key: string): string {
  const [year, month] = key.split("-");
  return `T${Number(month)}/${String(year).slice(2)}`;
}

function percent(part: number, total: number): number {
  return total > 0 ? (part / total) * 100 : 0;
}

// ---------------------------------------------------------------------------
// 1) BÁO CÁO ĐƠN HÀNG
// ---------------------------------------------------------------------------

export type OrderReport = {
  totals: {
    count: number;
    confirmedCount: number;
    draftCount: number;
    cancelledCount: number;
    overdueCount: number;
    sets: number;
    volume: number;
    orderValue: number;
    revenue: number;
    remaining: number;
    avgOrderValue: number;
    confirmedShare: number;
  };
  byType: BreakdownRow[];
  byStatus: BreakdownRow[];
  byMonth: MonthPoint[];
  byRegion: BreakdownRow[];
};

const TYPE_LABELS: Record<string, string> = { MAU: "Đơn hàng mẫu", SAN_XUAT: "Sản xuất", LAM_LAI: "Đơn làm lại" };

export function buildOrderReport(orders: ReportOrder[], today: Date = new Date()): OrderReport {
  const todayStart = startOfDayUtc(today);
  const confirmed = orders.filter((order) => isConfirmedStatus(order.status));
  const revenueOrders = orders.filter(isRevenueOrder);
  const cancelled = orders.filter((order) => order.status === "HUY");
  const drafts = orders.filter((order) => !isConfirmedStatus(order.status) && order.status !== "HUY");
  const overdue = confirmed.filter(
    (order) => order.requiredDeliveryDate && startOfDayUtc(order.requiredDeliveryDate) < todayStart,
  );

  const count = orders.length;
  const orderValueTotal = orders.reduce((sum, order) => sum + orderValue(order), 0);
  const revenue = revenueOrders.reduce((sum, order) => sum + orderValue(order), 0);

  const byType: BreakdownRow[] = Object.entries(TYPE_LABELS).map(([key, label]) => {
    const group = orders.filter((order) => order.orderType === key);
    return {
      key,
      label,
      orders: group.length,
      value: group.reduce((sum, order) => sum + orderValue(order), 0),
      share: percent(group.length, count),
    };
  });

  const byStatus: BreakdownRow[] = [
    { key: "DA_XAC_NHAN", label: "Đã xác nhận", group: confirmed },
    { key: "NHAP", label: "Đơn nháp", group: drafts },
    ...(cancelled.length ? [{ key: "HUY", label: "Đã hủy", group: cancelled }] : []),
  ].map((entry) => ({
    key: entry.key,
    label: entry.label,
    orders: entry.group.length,
    value: entry.group.reduce((sum, order) => sum + orderValue(order), 0),
    share: percent(entry.group.length, count),
  }));

  const monthMap = new Map<string, MonthPoint>();
  for (const order of orders) {
    if (!order.orderDate) continue;
    const key = monthKey(order.orderDate);
    const current = monthMap.get(key) ?? { key, label: monthLabel(key), revenue: 0, orders: 0 };
    current.orders += 1;
    if (isRevenueOrder(order)) current.revenue += orderValue(order);
    monthMap.set(key, current);
  }
  const byMonth = [...monthMap.values()].sort((a, b) => a.key.localeCompare(b.key)).slice(-12);

  const regionMap = new Map<string, BreakdownRow>();
  for (const order of orders) {
    const label = (order.region ?? "").trim() || "(chưa ghi vùng)";
    const current = regionMap.get(label) ?? { key: label, label, orders: 0, value: 0, share: 0 };
    current.orders += 1;
    current.value += orderValue(order);
    regionMap.set(label, current);
  }
  const byRegion = [...regionMap.values()].sort((a, b) => b.value - a.value);
  for (const row of byRegion) row.share = percent(row.orders, count);

  return {
    totals: {
      count,
      confirmedCount: confirmed.length,
      draftCount: drafts.length,
      cancelledCount: cancelled.length,
      overdueCount: overdue.length,
      sets: orders.reduce((sum, order) => sum + orderSets(order), 0),
      volume: orders.reduce((sum, order) => sum + orderVolume(order), 0),
      orderValue: orderValueTotal,
      revenue,
      remaining: confirmed.reduce((sum, order) => sum + orderRemaining(order), 0),
      avgOrderValue: count ? orderValueTotal / count : 0,
      confirmedShare: percent(confirmed.length, count),
    },
    byType,
    byStatus,
    byMonth,
    byRegion,
  };
}

// ---------------------------------------------------------------------------
// 2) BÁO CÁO SẢN PHẨM
// ---------------------------------------------------------------------------

export type ProductReportRow = {
  key: string;
  code: string;
  name: string;
  unit: string | null;
  orderCount: number;
  sets: number;
  quantity: number;
  pricingQuantity: number;
  revenue: number;
  avgPrice: number;
  minPrice: number;
  maxPrice: number;
  matched: boolean;
};

export type ProductReport = {
  rows: ProductReportRow[];
  slowRows: Array<{ code: string; name: string; unit: string | null }>;
  totals: { products: number; orderCount: number; quantity: number; pricingQuantity: number; revenue: number };
};

export function buildProductReport(orders: ReportOrder[], masters: MasterProduct[]): ProductReport {
  const masterMap = new Map<string, MasterProduct>();
  for (const master of masters) {
    masterMap.set(normalizeCode(master.code), master);
    const salesModel = normalizeCode(master.salesModel);
    if (salesModel && !masterMap.has(salesModel)) masterMap.set(salesModel, master);
  }

  const aggregate = new Map<string, ProductReportRow & { orderIds: Set<number>; prices: number[] }>();

  for (const order of orders) {
    if (!isRevenueOrder(order)) continue;
    for (const line of pricedLines(order)) {
      const revenue = lineAmount(line);
      const codeKey = normalizeCode(line.productCode) || normalizeCode(line.model);
      const master = codeKey ? masterMap.get(codeKey) : undefined;
      const key = master ? `m:${master.id}` : `x:${codeKey || normalizeCode(line.productName) || "(không rõ)"}`;

      const current = aggregate.get(key) ?? {
        key,
        code: master?.code ?? (line.productCode || line.model || line.productName || "(không rõ)"),
        name: master?.name ?? (line.productName || line.productCode || line.model || "(không rõ)"),
        unit: master?.unit ?? line.unit,
        orderCount: 0,
        sets: 0,
        quantity: 0,
        pricingQuantity: 0,
        revenue: 0,
        avgPrice: 0,
        minPrice: 0,
        maxPrice: 0,
        matched: Boolean(master),
        orderIds: new Set<number>(),
        prices: [],
      };

      current.orderIds.add(order.id);
      current.sets += 1;
      current.quantity += num(line.quantity);
      current.pricingQuantity += num(line.pricingQuantity);
      current.revenue += revenue;
      const price = num(line.unitPrice);
      if (price > 0) current.prices.push(price);
      aggregate.set(key, current);
    }
  }

  const rows: ProductReportRow[] = [...aggregate.values()]
    .map((row) => ({
      key: row.key,
      code: row.code,
      name: row.name,
      unit: row.unit,
      orderCount: row.orderIds.size,
      sets: row.sets,
      quantity: row.quantity,
      pricingQuantity: row.pricingQuantity,
      revenue: row.revenue,
      avgPrice: row.prices.length ? row.prices.reduce((a, b) => a + b, 0) / row.prices.length : 0,
      minPrice: row.prices.length ? Math.min(...row.prices) : 0,
      maxPrice: row.prices.length ? Math.max(...row.prices) : 0,
      matched: row.matched,
    }))
    .sort((a, b) => b.revenue - a.revenue);

  const soldKeys = new Set(rows.filter((row) => row.matched).map((row) => row.key));
  const soldCodes = new Set(
    rows
      .filter((row) => row.matched)
      .map((row) => normalizeCode(row.code)),
  );
  const slowRows = masters
    .filter((master) => !soldKeys.has(`m:${master.id}`) && !soldCodes.has(normalizeCode(master.code)))
    .slice(0, 50)
    .map((master) => ({ code: master.code, name: master.name, unit: master.unit }));

  return {
    rows,
    slowRows,
    totals: {
      products: rows.length,
      orderCount: rows.reduce((sum, row) => sum + row.orderCount, 0),
      quantity: rows.reduce((sum, row) => sum + row.quantity, 0),
      pricingQuantity: rows.reduce((sum, row) => sum + row.pricingQuantity, 0),
      revenue: rows.reduce((sum, row) => sum + row.revenue, 0),
    },
  };
}

// ---------------------------------------------------------------------------
// 3) BÁO CÁO NHÂN VIÊN SALES
// ---------------------------------------------------------------------------

export type SalesReportRow = {
  key: string;
  code: string;
  orderCount: number;
  confirmedCount: number;
  draftCount: number;
  sets: number;
  volume: number;
  revenue: number;
  collected: number;
  remaining: number;
  avgOrderValue: number;
  confirmRate: number;
  overdueCount: number;
};

export type SalesReport = {
  rows: SalesReportRow[];
  totals: {
    orderCount: number;
    confirmedCount: number;
    revenue: number;
    collected: number;
    remaining: number;
    avgOrderValue: number;
    confirmRate: number;
  };
};

export function buildSalesReport(orders: ReportOrder[], today: Date = new Date()): SalesReport {
  const todayStart = startOfDayUtc(today);
  const map = new Map<string, SalesReportRow>();

  for (const order of orders) {
    const code = (order.salesEmployeeCode ?? "").trim() || "(chưa gán)";
    const current = map.get(code) ?? {
      key: code,
      code,
      orderCount: 0,
      confirmedCount: 0,
      draftCount: 0,
      sets: 0,
      volume: 0,
      revenue: 0,
      collected: 0,
      remaining: 0,
      avgOrderValue: 0,
      confirmRate: 0,
      overdueCount: 0,
    };
    const confirmed = isConfirmedStatus(order.status);
    current.orderCount += 1;
    if (confirmed) {
      current.confirmedCount += 1;
      current.remaining += orderRemaining(order);
      current.collected += orderCollected(order);
      if (order.requiredDeliveryDate && startOfDayUtc(order.requiredDeliveryDate) < todayStart) current.overdueCount += 1;
    } else if (order.status !== "HUY") {
      current.draftCount += 1;
    }
    current.sets += orderSets(order);
    current.volume += orderVolume(order);
    if (isRevenueOrder(order)) current.revenue += orderValue(order);
    map.set(code, current);
  }

  const rows = [...map.values()]
    .map((row) => ({
      ...row,
      avgOrderValue: row.orderCount ? row.revenue / row.orderCount : 0,
      confirmRate: percent(row.confirmedCount, row.orderCount),
    }))
    .sort((a, b) => b.revenue - a.revenue || b.orderCount - a.orderCount);

  const orderCount = rows.reduce((sum, row) => sum + row.orderCount, 0);
  const confirmedCount = rows.reduce((sum, row) => sum + row.confirmedCount, 0);
  const revenue = rows.reduce((sum, row) => sum + row.revenue, 0);

  return {
    rows,
    totals: {
      orderCount,
      confirmedCount,
      revenue,
      collected: rows.reduce((sum, row) => sum + row.collected, 0),
      remaining: rows.reduce((sum, row) => sum + row.remaining, 0),
      avgOrderValue: orderCount ? revenue / orderCount : 0,
      confirmRate: percent(confirmedCount, orderCount),
    },
  };
}

// ---------------------------------------------------------------------------
// 4) BÁO CÁO CÔNG NỢ / CÒN PHẢI THU (suy ra từ đơn — chưa có phiếu thu)
// ---------------------------------------------------------------------------

export type ReceivableRow = {
  key: string;
  code: string;
  name: string;
  orderCount: number;
  totalValue: number;
  paid: number;
  remaining: number;
  oldestDue: Date | null;
  daysOverdue: number;
  bucket: string;
};

export type ReceivableBucket = { key: string; label: string; amount: number; orders: number; tone: "neutral" | "warn" | "bad" };

export type ReceivablesReport = {
  rows: ReceivableRow[];
  buckets: ReceivableBucket[];
  totals: { remaining: number; notDue: number; overdue: number; customers: number; orders: number };
};

function bucketOf(daysOverdue: number): { key: string; label: string; tone: "neutral" | "warn" | "bad" } {
  if (daysOverdue <= 0) return { key: "not_due", label: "Chưa đến hạn", tone: "neutral" };
  if (daysOverdue <= 7) return { key: "d1_7", label: "Quá hạn 1–7 ngày", tone: "warn" };
  if (daysOverdue <= 30) return { key: "d8_30", label: "Quá hạn 8–30 ngày", tone: "warn" };
  if (daysOverdue <= 60) return { key: "d31_60", label: "Quá hạn 31–60 ngày", tone: "bad" };
  return { key: "d60", label: "Quá hạn > 60 ngày", tone: "bad" };
}

export function buildReceivablesReport(orders: ReportOrder[], today: Date = new Date()): ReceivablesReport {
  const todayStart = startOfDayUtc(today);
  const bucketDefs = [
    { key: "not_due", label: "Chưa đến hạn", tone: "neutral" as const },
    { key: "d1_7", label: "Quá hạn 1–7 ngày", tone: "warn" as const },
    { key: "d8_30", label: "Quá hạn 8–30 ngày", tone: "warn" as const },
    { key: "d31_60", label: "Quá hạn 31–60 ngày", tone: "bad" as const },
    { key: "d60", label: "Quá hạn > 60 ngày", tone: "bad" as const },
  ];
  const bucketMap = new Map(bucketDefs.map((bucket) => [bucket.key, { ...bucket, amount: 0, orders: 0 }]));

  const map = new Map<string, ReceivableRow>();
  for (const order of orders) {
    if (!isConfirmedStatus(order.status)) continue;
    const remaining = orderRemaining(order);
    const due = order.requiredDeliveryDate ?? order.orderDate;
    const daysOverdue = due ? daysBetween(due, todayStart) : 0;
    const bucket = bucketOf(daysOverdue);

    const codep = (order.customerCode ?? "").trim();
    const namep = (order.customerName ?? "").trim();
    const key = codep || namep || `#${order.id}`;
    const current = map.get(key) ?? {
      key,
      code: codep || "—",
      name: namep || "(chưa có tên khách hàng)",
      orderCount: 0,
      totalValue: 0,
      paid: 0,
      remaining: 0,
      oldestDue: null as Date | null,
      daysOverdue: 0,
      bucket: bucket.label,
    };
    current.orderCount += 1;
    current.totalValue += orderValue(order);
    current.paid += orderCollected(order);
    current.remaining += remaining;
    if (due && (!current.oldestDue || due < current.oldestDue)) {
      current.oldestDue = due;
      current.daysOverdue = daysOverdue;
      current.bucket = bucket.label;
    }
    map.set(key, current);

    if (remaining > 0) {
      const target = bucketMap.get(bucket.key);
      if (target) {
        target.amount += remaining;
        target.orders += 1;
      }
    }
  }

  const rows = [...map.values()].sort((a, b) => b.remaining - a.remaining || b.daysOverdue - a.daysOverdue);
  const buckets = bucketDefs.map((bucket) => bucketMap.get(bucket.key)!);
  const remaining = rows.reduce((sum, row) => sum + row.remaining, 0);

  return {
    rows,
    buckets,
    totals: {
      remaining,
      notDue: bucketMap.get("not_due")?.amount ?? 0,
      overdue: remaining - (bucketMap.get("not_due")?.amount ?? 0),
      customers: rows.length,
      orders: rows.reduce((sum, row) => sum + row.orderCount, 0),
    },
  };
}

// ---------------------------------------------------------------------------
// 5) TẢI SẢN XUẤT THEO TUẦN (8 tuần tới)
// ---------------------------------------------------------------------------

export type LoadBucket = {
  key: string;
  label: string;
  weekStart: Date | null;
  orders: number;
  sets: number;
  volume: number;
  value: number;
  tone: "neutral" | "warn" | "bad" | "good";
  items: Array<{ id: number; orderCode: string; customer: string; due: Date | null; sets: number; volume: number; value: number }>;
};

export type ProductionLoadReport = {
  buckets: LoadBucket[];
  totals: { orders: number; sets: number; volume: number; value: number; overdue: number };
  byRegion: BreakdownRow[];
};

function startOfWeekUtc(date: Date): Date {
  const base = startOfDayUtc(date);
  const weekday = (base.getUTCDay() + 6) % 7; // Thứ 2 = 0
  base.setUTCDate(base.getUTCDate() - weekday);
  return base;
}

function shortDate(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${pad(date.getUTCDate())}/${pad(date.getUTCMonth() + 1)}`;
}

export function buildProductionLoad(orders: ReportOrder[], today: Date = new Date(), weeks = 8): ProductionLoadReport {
  const todayStart = startOfDayUtc(today);
  const thisWeek = startOfWeekUtc(todayStart);

  const buckets: LoadBucket[] = [
    { key: "overdue", label: "Quá hạn", weekStart: null, orders: 0, sets: 0, volume: 0, value: 0, tone: "bad", items: [] },
  ];
  for (let index = 0; index < weeks; index += 1) {
    const weekStart = new Date(thisWeek);
    weekStart.setUTCDate(weekStart.getUTCDate() + index * 7);
    const weekEnd = new Date(weekStart);
    weekEnd.setUTCDate(weekEnd.getUTCDate() + 6);
    buckets.push({
      key: `w${index}`,
      label: index === 0 ? `Tuần này (${shortDate(weekStart)}–${shortDate(weekEnd)})` : `${shortDate(weekStart)}–${shortDate(weekEnd)}`,
      weekStart,
      orders: 0,
      sets: 0,
      volume: 0,
      value: 0,
      tone: index === 0 ? "warn" : "neutral",
      items: [],
    });
  }
  buckets.push({ key: "later", label: `Sau ${weeks} tuần`, weekStart: null, orders: 0, sets: 0, volume: 0, value: 0, tone: "neutral", items: [] });

  const confirmed = orders.filter((order) => isConfirmedStatus(order.status) && order.requiredDeliveryDate);

  for (const order of confirmed) {
    const due = order.requiredDeliveryDate as Date;
    let bucket: LoadBucket | undefined;
    if (startOfDayUtc(due) < todayStart) {
      bucket = buckets[0];
    } else {
      const diffWeeks = Math.floor((startOfWeekUtc(due).getTime() - thisWeek.getTime()) / (7 * MS_DAY));
      bucket = diffWeeks >= 0 && diffWeeks < weeks ? buckets[diffWeeks + 1] : buckets[buckets.length - 1];
    }
    const sets = orderSets(order);
    const volume = orderVolume(order);
    const value = orderValue(order);
    bucket.orders += 1;
    bucket.sets += sets;
    bucket.volume += volume;
    bucket.value += value;
    bucket.items.push({
      id: order.id,
      orderCode: order.orderCode,
      customer: order.customerName || order.customerCode || "—",
      due,
      sets,
      volume,
      value,
    });
  }

  for (const bucket of buckets) {
    bucket.items.sort((a, b) => (a.due?.getTime() ?? 0) - (b.due?.getTime() ?? 0));
  }

  const regionMap = new Map<string, BreakdownRow>();
  for (const order of confirmed) {
    const label = (order.region ?? "").trim() || "(chưa ghi vùng)";
    const current = regionMap.get(label) ?? { key: label, label, orders: 0, value: 0, share: 0 };
    current.orders += 1;
    current.value += orderValue(order);
    regionMap.set(label, current);
  }
  const byRegion = [...regionMap.values()].sort((a, b) => b.orders - a.orders);
  for (const row of byRegion) row.share = percent(row.orders, confirmed.length);

  return {
    buckets,
    totals: {
      orders: confirmed.length,
      sets: buckets.reduce((sum, bucket) => sum + bucket.sets, 0),
      volume: buckets.reduce((sum, bucket) => sum + bucket.volume, 0),
      value: buckets.reduce((sum, bucket) => sum + bucket.value, 0),
      overdue: buckets[0].orders,
    },
    byRegion,
  };
}

// ---------------------------------------------------------------------------
// 6) SO SÁNH KỲ TRƯỚC / CÙNG KỲ NĂM TRƯỚC
// ---------------------------------------------------------------------------

export type Comparison = { current: number; previous: number | null; deltaPercent: number | null };

export function compare(current: number, previous: number | null): Comparison {
  if (previous === null || !Number.isFinite(previous) || previous === 0) {
    return { current, previous, deltaPercent: null };
  }
  return { current, previous, deltaPercent: ((current - previous) / previous) * 100 };
}

/** Doanh thu (đơn Sản xuất + đã xác nhận) của một tập đơn. */
export function revenueOf(orders: ReportOrder[]): number {
  return orders.filter(isRevenueOrder).reduce((sum, order) => sum + orderValue(order), 0);
}
