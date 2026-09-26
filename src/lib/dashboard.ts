/**
 * V113 — Tính toán cho tab Tổng quan (dashboard báo cáo bán hàng).
 *
 * Toàn bộ hàm ở đây là hàm thuần (không truy vấn DB) để dễ kiểm thử: trang `/` chỉ lấy dữ liệu
 * thô từ Prisma rồi gọi `buildDashboard`. Quy ước nghiệp vụ bám đúng V112:
 *  - DOANH THU chỉ gồm đơn LOẠI "Sản xuất" ở trạng thái ĐÃ XÁC NHẬN.
 *  - Đơn nháp / đơn hàng mẫu / đơn làm lại vẫn được thống kê khối lượng nhưng KHÔNG vào doanh thu.
 *  - Sản lượng tính theo KH/Lượng (pricingQuantity) của dòng hàng + dòng chi tiết/phụ kiện.
 */

export const REVENUE_ORDER_TYPE = "SAN_XUAT";
export const CONFIRMED_STATUS = "DA_XAC_NHAN";

export type DashboardLine = {
  productName: string | null;
  productCode: string | null;
  model: string | null;
  unit: string | null;
  quantity: number | null;
  pricingQuantity: number | null;
  amount: unknown;
  unitPrice: unknown;
};

export type DashboardOrder = {
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
  /** Ngày tạo bản ghi — dùng cho cảnh báo "đơn nháp để lâu". */
  createdAt?: Date | null;
  totalAfterDiscount: unknown;
  deliveryPayment: unknown;
  items: Array<DashboardLine & { details?: DashboardLine[] }>;
};

export type KpiBlock = {
  label: string;
  value: string;
  hint: string;
  tone: "neutral" | "good" | "warn" | "bad";
  deltaPercent: number | null;
};

/** `value` = tổng giá trị đơn (tổng sau chiết khấu) của MỌI trạng thái; doanh thu chỉ tính riêng ở KPI. */
export type BreakdownRow = { key: string; label: string; orders: number; value: number; share: number };
export type RankRow = { key: string; label: string; sub: string; orders: number; revenue: number; volume: number };
export type MonthPoint = { key: string; label: string; revenue: number; orders: number };
export type AttentionRow = {
  type: "overdue" | "dueSoon" | "draft";
  orderCode: string;
  customer: string;
  date: Date | null;
  hint: string;
  tone: "warn" | "bad";
};

export type DashboardResult = {
  period: { from: Date | null; to: Date | null; label: string };
  kpis: {
    revenue: number;
    revenuePrev: number | null;
    revenueDelta: number | null;
    /** V130: doanh thu cùng kỳ năm trước + % thay đổi (chỉ khi có dữ liệu năm trước trong khoảng lấy). */
    revenuePriorYear: number | null;
    revenueYoYDelta: number | null;
    confirmedOrders: number;
    confirmedSets: number;
    draftOrders: number;
    draftValue: number;
    receivable: number;
    overdueCount: number;
    volume: number;
    avgOrderValue: number;
    confirmedShare: number;
  };
  months: MonthPoint[];
  byType: BreakdownRow[];
  byStatus: BreakdownRow[];
  topDealers: RankRow[];
  topEmployees: RankRow[];
  topProducts: RankRow[];
  attention: AttentionRow[];
};

function toNumber(value: unknown): number {
  if (value === null || value === undefined || value === "") return 0;
  const parsed = Number(String(value));
  return Number.isFinite(parsed) ? parsed : 0;
}

function lineAmount(line: DashboardLine) {
  const explicit = toNumber(line.amount);
  if (explicit > 0) return explicit;
  return toNumber(line.pricingQuantity) * toNumber(line.unitPrice);
}

function lineVolume(line: DashboardLine) {
  const pricing = toNumber(line.pricingQuantity);
  return pricing > 0 ? pricing : toNumber(line.quantity);
}

function allLines(order: DashboardOrder) {
  return order.items.flatMap((item) => [item, ...(item.details ?? [])]);
}

/** Dòng hàng của một đơn (KPI/sản lượng chỉ tính dòng có KH/Lượng). */
function pricedLines(order: DashboardOrder) {
  return allLines(order).filter((line) => toNumber(line.pricingQuantity) > 0);
}

export function isRevenueOrder(order: DashboardOrder) {
  return order.orderType === REVENUE_ORDER_TYPE && order.status === CONFIRMED_STATUS;
}

export function isConfirmed(order: DashboardOrder) {
  return order.status === CONFIRMED_STATUS || order.status === "CHUYEN_SAN_XUAT" || order.status === "DA_XAC_NHAN";
}

function orderRevenue(order: DashboardOrder) {
  return toNumber(order.totalAfterDiscount);
}

function percentDelta(current: number, previous: number): number | null {
  if (!Number.isFinite(previous) || previous === 0) return null;
  return ((current - previous) / previous) * 100;
}

function monthKey(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(key: string) {
  const [, month] = key.split("-");
  return `T${Number(month)}`;
}

/** Mốc ngày (UTC, chỉ ngày) để so sánh hạn giao. */
function startOfDayUtc(value: Date) {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}

export function buildDashboard(
  orders: DashboardOrder[],
  options: {
    previousOrders?: DashboardOrder[];
    /** V130: đơn của cùng kỳ năm trước (đã trừ 1 năm) để tính % tăng trưởng. */
    priorYearOrders?: DashboardOrder[];
    monthsWindow?: DashboardOrder[];
    today?: Date;
    periodLabel: string;
    from?: Date | null;
    to?: Date | null;
  },
): DashboardResult {
  const today = options.today ?? new Date();
  const todayStart = startOfDayUtc(today);
  const soonLimit = new Date(todayStart);
  soonLimit.setUTCDate(soonLimit.getUTCDate() + 7);
  const staleLimit = new Date(todayStart);
  staleLimit.setUTCDate(staleLimit.getUTCDate() - 7);

  const revenueOrders = orders.filter(isRevenueOrder);
  const revenue = revenueOrders.reduce((sum, order) => sum + orderRevenue(order), 0);

  const previousRevenueOrders = (options.previousOrders ?? []).filter(isRevenueOrder);
  const previousRevenue = previousRevenueOrders.length
    ? previousRevenueOrders.reduce((sum, order) => sum + orderRevenue(order), 0)
    : null;

  // V130: cùng kỳ năm trước.
  const priorYearProvided = options.priorYearOrders !== undefined;
  const priorYearRevenue = priorYearProvided
    ? (options.priorYearOrders ?? []).filter(isRevenueOrder).reduce((sum, order) => sum + orderRevenue(order), 0)
    : null;

  const confirmed = orders.filter(isConfirmed);
  const drafts = orders.filter((order) => !isConfirmed(order));
  const confirmedSets = confirmed.reduce((sum, order) => sum + pricedLines(order).length, 0);
  const volume = revenueOrders.reduce(
    (sum, order) => sum + pricedLines(order).reduce((lineSum, line) => lineSum + lineVolume(line), 0),
    0,
  );

  const overdue = confirmed.filter(
    (order) => order.requiredDeliveryDate && startOfDayUtc(order.requiredDeliveryDate) < todayStart,
  );

  // ---- Cơ cấu theo LOẠI ĐƠN (đếm cả đơn nháp) ----
  const typeLabels: Record<string, string> = { MAU: "Đơn hàng mẫu", SAN_XUAT: "Sản xuất", LAM_LAI: "Đơn làm lại" };
  const byType: BreakdownRow[] = Object.entries(typeLabels).map(([key, label]) => {
    const group = orders.filter((order) => order.orderType === key);
    const value = group.reduce((sum, order) => sum + orderRevenue(order), 0);
    return { key, label, orders: group.length, value, share: 0 };
  });
  const typeTotal = byType.reduce((sum, row) => sum + row.orders, 0);
  for (const row of byType) row.share = typeTotal ? (row.orders / typeTotal) * 100 : 0;

  const byStatus: BreakdownRow[] = [
    { key: CONFIRMED_STATUS, label: "Đã xác nhận" },
    { key: "NHAP", label: "Đơn nháp" },
  ].map((entry) => {
    const group = orders.filter((order) => (entry.key === CONFIRMED_STATUS ? isConfirmed(order) : !isConfirmed(order)));
    const value = group.reduce((sum, order) => sum + orderRevenue(order), 0);
    return {
      key: entry.key,
      label: entry.label,
      orders: group.length,
      value,
      share: orders.length ? (group.length / orders.length) * 100 : 0,
    };
  });

  // ---- Xếp hạng: đại lý / NVKD / sản phẩm ----
  function rank(
    keyOf: (order: DashboardOrder) => string | null,
    subOf: (order: DashboardOrder) => string,
    limit = 6,
  ): RankRow[] {
    const map = new Map<string, RankRow>();
    for (const order of revenueOrders) {
      const key = (keyOf(order) ?? "").trim() || "(không rõ)";
      const current = map.get(key) ?? { key, label: key, sub: subOf(order), orders: 0, revenue: 0, volume: 0 };
      current.orders += 1;
      current.revenue += orderRevenue(order);
      current.volume += pricedLines(order).reduce((sum, line) => sum + lineVolume(line), 0);
      map.set(key, current);
    }
    return [...map.values()].sort((a, b) => b.revenue - a.revenue).slice(0, limit);
  }

  const topDealers = rank(
    (order) => order.customerCode || order.customerName,
    (order) => [order.customerName, order.region].filter(Boolean).join(" · "),
  );
  const topEmployees = rank((order) => order.salesEmployeeCode, () => "NVKD");

  const productMap = new Map<string, RankRow>();
  for (const order of revenueOrders) {
    for (const line of pricedLines(order)) {
      const key = (line.productCode || line.model || line.productName || "(không rõ)").trim();
      const current = productMap.get(key) ?? { key, label: key, sub: line.unit ?? "", orders: 0, revenue: 0, volume: 0 };
      current.orders += 1;
      current.revenue += lineAmount(line);
      current.volume += lineVolume(line);
      productMap.set(key, current);
    }
  }
  const topProducts = [...productMap.values()]
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 6)
    .map((row) => ({ ...row, sub: row.orders > 0 ? `${row.orders} dòng hàng` : row.sub }));

  // ---- Biểu đồ theo tháng (12 tháng gần nhất) ----
  const monthSource = options.monthsWindow ?? orders;
  const monthMap = new Map<string, MonthPoint>();
  for (const order of monthSource) {
    if (!order.orderDate || !isRevenueOrder(order)) continue;
    const key = monthKey(order.orderDate);
    const current = monthMap.get(key) ?? { key, label: monthLabel(key), revenue: 0, orders: 0 };
    current.revenue += orderRevenue(order);
    current.orders += 1;
    monthMap.set(key, current);
  }
  const months = [...monthMap.values()].sort((a, b) => a.key.localeCompare(b.key)).slice(-12);

  // ---- Việc cần chú ý ----
  const attention: AttentionRow[] = [];
  for (const order of confirmed) {
    if (!order.requiredDeliveryDate) continue;
    const due = startOfDayUtc(order.requiredDeliveryDate);
    if (due < todayStart) {
      const days = Math.round((todayStart.getTime() - due.getTime()) / 86_400_000);
      attention.push({
        type: "overdue",
        orderCode: order.orderCode,
        customer: order.customerName || order.customerCode || "—",
        date: order.requiredDeliveryDate,
        hint: `Quá hạn ${days} ngày`,
        tone: "bad",
      });
    } else if (due <= soonLimit) {
      const days = Math.round((due.getTime() - todayStart.getTime()) / 86_400_000);
      attention.push({
        type: "dueSoon",
        orderCode: order.orderCode,
        customer: order.customerName || order.customerCode || "—",
        date: order.requiredDeliveryDate,
        hint: days === 0 ? "Giao hôm nay" : `Còn ${days} ngày`,
        tone: "warn",
      });
    }
  }
  for (const order of drafts) {
    // "Để lâu" tính theo ngày TẠO bản ghi (createdAt), không phải ngày đặt hàng nghiệp vụ.
    const created = order.createdAt ?? order.orderDate ?? null;
    if (created && startOfDayUtc(created) < staleLimit) {
      const days = Math.round((todayStart.getTime() - startOfDayUtc(created).getTime()) / 86_400_000);
      attention.push({
        type: "draft",
        orderCode: order.orderCode,
        customer: order.customerName || order.customerCode || "—",
        date: created,
        hint: `Nháp ${days} ngày chưa xác nhận`,
        tone: "warn",
      });
    }
  }
  const attentionSorted = attention.sort((a, b) => {
    const rankTone = (row: AttentionRow) => (row.tone === "bad" ? 0 : 1);
    if (rankTone(a) !== rankTone(b)) return rankTone(a) - rankTone(b);
    return (a.date?.getTime() ?? 0) - (b.date?.getTime() ?? 0);
  });

  const receivable = revenueOrders.reduce((sum, order) => sum + toNumber(order.deliveryPayment), 0);
  const draftValue = drafts.reduce((sum, order) => sum + orderRevenue(order), 0);

  return {
    period: { from: options.from ?? null, to: options.to ?? null, label: options.periodLabel },
    kpis: {
      revenue,
      revenuePrev: previousRevenue,
      revenueDelta: previousRevenue === null ? null : percentDelta(revenue, previousRevenue),
      revenuePriorYear: priorYearRevenue,
      revenueYoYDelta: priorYearRevenue === null ? null : percentDelta(revenue, priorYearRevenue),
      confirmedOrders: confirmed.length,
      confirmedSets,
      draftOrders: drafts.length,
      draftValue,
      receivable,
      overdueCount: overdue.length,
      volume,
      avgOrderValue: revenueOrders.length ? revenue / revenueOrders.length : 0,
      confirmedShare: orders.length ? (confirmed.length / orders.length) * 100 : 0,
    },
    months,
    byType,
    byStatus,
    topDealers,
    topEmployees,
    topProducts,
    attention: attentionSorted.slice(0, 8),
  };
}
