import { prisma } from "@/lib/prisma";
import { clean, resolveDatePreset, type OrderListQuery } from "@/lib/order-list-filters";
import { CONFIRMED_STATUS_CODES } from "@/lib/order-form";
import { REVENUE_ORDER_TYPE, type MasterProduct, type ReportOrder } from "@/lib/reporting";
import type { Prisma } from "@/generated/prisma/client";

/**
 * V130 — Nạp dữ liệu dùng chung cho nhóm trang BÁO CÁO.
 * Chỉ lấy dữ liệu thô rồi để `src/lib/reporting.ts` tính (hàm thuần) — cùng cách dashboard đang làm.
 */

export const REPORT_ORDER_INCLUDE = {
  items: {
    orderBy: { lineNo: "asc" as const },
    include: { details: { orderBy: { rowOrder: "asc" as const } } },
  },
} satisfies Prisma.SalesOrderInclude;

/** Điều kiện "đơn tính doanh thu": loại Sản xuất + trạng thái đã xác nhận (V112). */
export const REVENUE_WHERE: Prisma.SalesOrderWhereInput = {
  orderType: REVENUE_ORDER_TYPE,
  status: { in: CONFIRMED_STATUS_CODES },
};

/** Điều kiện "đơn đã xác nhận" (mọi loại đơn). */
export const CONFIRMED_WHERE: Prisma.SalesOrderWhereInput = {
  status: { in: CONFIRMED_STATUS_CODES },
};

export async function loadReportOrders(where: Prisma.SalesOrderWhereInput): Promise<ReportOrder[]> {
  const orders = await prisma.salesOrder.findMany({
    where,
    orderBy: [{ orderDate: "desc" }, { id: "desc" }],
    include: REPORT_ORDER_INCLUDE,
  });
  return orders as unknown as ReportOrder[];
}

export async function loadMasterProducts(): Promise<MasterProduct[]> {
  return prisma.itemMaster.findMany({
    orderBy: [{ name: "asc" }, { code: "asc" }],
    select: { id: true, code: true, name: true, productDescription: true, salesModel: true, unit: true },
  });
}

export type FilterOption = { value: string; label: string };

export type ReportFilterOptions = {
  dealers: FilterOption[];
  customers: FilterOption[];
  sales: FilterOption[];
  regions: FilterOption[];
};

/** Danh mục chọn cho bộ lọc — lấy distinct từ chính đơn hàng. */
export async function loadReportFilterOptions(): Promise<ReportFilterOptions> {
  const [dealerRows, customerRows, salesRows, regionRows] = await Promise.all([
    prisma.salesOrder.findMany({
      distinct: ["customerCode"],
      select: { customerCode: true, customerName: true },
      orderBy: { customerCode: "asc" },
    }),
    prisma.salesOrder.findMany({
      distinct: ["receiverName"],
      select: { receiverName: true },
      orderBy: { receiverName: "asc" },
    }),
    prisma.salesOrder.findMany({
      distinct: ["salesEmployeeCode"],
      select: { salesEmployeeCode: true },
      orderBy: { salesEmployeeCode: "asc" },
    }),
    prisma.salesOrder.findMany({
      distinct: ["region"],
      select: { region: true },
      orderBy: { region: "asc" },
    }),
  ]);

  const dealers: FilterOption[] = dealerRows
    .map((row) => {
      const code = clean(row.customerCode);
      const name = clean(row.customerName);
      if (!code && !name) return null;
      return { value: code ? `C:${code}` : `N:${name}`, label: code && name ? `${code} - ${name}` : code || name };
    })
    .filter((row): row is FilterOption => Boolean(row))
    .sort((a, b) => a.label.localeCompare(b.label, "vi"));

  const customers: FilterOption[] = customerRows
    .map((row) => clean(row.receiverName))
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b, "vi"))
    .map((value) => ({ value, label: value }));

  const sales: FilterOption[] = salesRows
    .map((row) => clean(row.salesEmployeeCode))
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b, "vi"))
    .map((value) => ({ value, label: value }));

  const regions: FilterOption[] = regionRows
    .map((row) => clean(row.region))
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b, "vi"))
    .map((value) => ({ value, label: value }));

  return { dealers, customers, sales, regions };
}

/** Áp khoảng ngày nhanh (Hôm nay/Tuần/Tháng/Quý/Năm) thành from/to trước khi dựng điều kiện lọc. */
export function resolveReportQuery(query: OrderListQuery): OrderListQuery {
  if (query.range && !clean(query.from) && !clean(query.to)) {
    const preset = resolveDatePreset(query.range);
    if (preset) return { ...query, from: preset.from, to: preset.to };
  }
  return query;
}

/** Dựng href xuất Excel cho báo cáo: giữ đúng toàn bộ bộ lọc đang xem. */
export function buildReportExportHref(basePath: string, query: OrderListQuery): string {
  const params = new URLSearchParams();
  for (const key of ["date", "month", "year", "from", "to", "dealer", "customer", "q", "type", "state", "sales", "region"] as const) {
    const value = clean(query[key]);
    if (value) params.set(key, value);
  }
  const qs = params.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}
