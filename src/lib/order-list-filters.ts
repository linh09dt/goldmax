import type { Prisma } from "@/generated/prisma/client";

/**
 * V100: bộ lọc danh sách đơn hàng dùng chung cho trang /orders và route xuất Excel danh sách,
 * để hai nơi luôn lọc giống nhau (trước đây mỗi nơi tự parse một kiểu).
 */

export type OrderListQuery = {
  date?: string;
  month?: string;
  year?: string;
  from?: string;
  to?: string;
  dealer?: string;
  customer?: string;
  /** Tìm nhanh: mã đơn, khách hàng, mã đại lý, người nhận, số điện thoại. */
  q?: string;
  /** V112: lọc theo LOẠI ĐƠN — all | mau | san_xuat | lam_lai */
  type?: string;
  /** Mã cũ trước V112 (all | sample | prod) — vẫn nhận để link cũ không hỏng. */
  status?: string;
  page?: string;
  /** Đơn đang chọn ở cột chi tiết (dạng chia 2 cột). */
  orderId?: string;
  /** Khoảng ngày nhanh: today | week | month | quarter | year (chip lọc). */
  range?: string;
};

export const ORDER_LIST_PAGE_SIZE = 20;

/**
 * V112: bộ lọc "loại đơn" (Đơn hàng mẫu / Sản xuất / Đơn làm lại). Giá trị `sample`/`prod`
 * của bản cũ vẫn được quy đổi để link đã lưu không hỏng.
 */
export const ORDER_LIST_TYPE_FILTERS = [
  { value: "all", label: "Tất cả" },
  { value: "mau", label: "Đơn hàng mẫu" },
  { value: "san_xuat", label: "Sản xuất" },
  { value: "lam_lai", label: "Đơn làm lại" },
] as const;

export type OrderListTypeFilter = (typeof ORDER_LIST_TYPE_FILTERS)[number]["value"];

/** Giữ tên cũ để màn danh sách không phải đổi import. */
export const ORDER_LIST_STATUS_FILTERS = ORDER_LIST_TYPE_FILTERS;

export function normalizeOrderListType(value: unknown): OrderListTypeFilter {
  const text = clean(value);
  if (text === "mau" || text === "san_xuat" || text === "lam_lai") return text;
  if (text === "sample") return "mau";
  if (text === "prod") return "san_xuat";
  return "all";
}

function typeCodes(filter: OrderListTypeFilter): string[] | null {
  if (filter === "mau") return ["MAU"];
  if (filter === "san_xuat") return ["SAN_XUAT"];
  if (filter === "lam_lai") return ["LAM_LAI"];
  return null;
}

export function clean(value: unknown) {
  if (value === null || value === undefined) return "";
  const text = String(value).trim();
  return text === "-" || text === "—" ? "" : text;
}

export function parseIsoDate(value: unknown) {
  const text = clean(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return null;
  const [year, month, day] = text.split("-").map(Number);
  if (!year || !month || !day) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) return null;
  return date;
}

export function parseDealerFilter(value: unknown) {
  const text = clean(value);
  if (!text) return null;
  if (text.startsWith("C:")) return { kind: "code" as const, value: text.slice(2) };
  if (text.startsWith("N:")) return { kind: "name" as const, value: text.slice(2) };
  return { kind: "code" as const, value: text };
}

export function resolveDateFilter(query: OrderListQuery) {
  const from = parseIsoDate(query.from);
  const to = parseIsoDate(query.to);
  if (from || to) {
    return {
      ...(from ? { gte: from } : {}),
      ...(to ? { lte: to } : {}),
    };
  }

  const exact = parseIsoDate(query.date);
  if (exact) return { equals: exact };

  const monthMatch = /^(\d{4})-(\d{2})$/.exec(clean(query.month));
  if (monthMatch) {
    const year = Number(monthMatch[1]);
    const month = Number(monthMatch[2]);
    if (month >= 1 && month <= 12) {
      return { gte: new Date(Date.UTC(year, month - 1, 1)), lt: new Date(Date.UTC(year, month, 1)) };
    }
  }

  const year = Number(clean(query.year));
  if (Number.isInteger(year) && year >= 2000 && year <= 2100) {
    return { gte: new Date(Date.UTC(year, 0, 1)), lt: new Date(Date.UTC(year + 1, 0, 1)) };
  }

  return null;
}

/**
 * Khoảng ngày nhanh dùng cho các chip lọc (Hôm nay / Tuần này / Tháng này / Quý / Năm).
 * Trả về chuỗi yyyy-mm-dd để đưa thẳng vào query params from/to.
 */
export function resolveDatePreset(range: unknown, today = new Date()): { from: string; to: string } | null {
  const text = clean(range);
  if (!text) return null;
  const base = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));
  const iso = (date: Date) => date.toISOString().slice(0, 10);
  const startOfWeek = new Date(base);
  // Tuần bắt đầu từ Thứ 2 (0 = Chủ nhật trong JS).
  const weekday = (base.getUTCDay() + 6) % 7;
  startOfWeek.setUTCDate(base.getUTCDate() - weekday);

  if (text === "today") return { from: iso(base), to: iso(base) };
  if (text === "week") {
    const end = new Date(startOfWeek);
    end.setUTCDate(startOfWeek.getUTCDate() + 6);
    return { from: iso(startOfWeek), to: iso(end) };
  }
  if (text === "month") {
    return {
      from: iso(new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), 1))),
      to: iso(new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + 1, 0))),
    };
  }
  if (text === "quarter") {
    const quarterStartMonth = Math.floor(base.getUTCMonth() / 3) * 3;
    return {
      from: iso(new Date(Date.UTC(base.getUTCFullYear(), quarterStartMonth, 1))),
      to: iso(new Date(Date.UTC(base.getUTCFullYear(), quarterStartMonth + 3, 0))),
    };
  }
  if (text === "year") {
    return {
      from: iso(new Date(Date.UTC(base.getUTCFullYear(), 0, 1))),
      to: iso(new Date(Date.UTC(base.getUTCFullYear(), 11, 31))),
    };
  }
  return null;
}

export const ORDER_LIST_PRESETS = [
  { value: "today", label: "Hôm nay" },
  { value: "week", label: "Tuần này" },
  { value: "month", label: "Tháng này" },
  { value: "quarter", label: "Quý" },
  { value: "year", label: "Năm" },
] as const;

/** Điều kiện truy vấn dùng chung cho trang danh sách và xuất Excel. */
export function buildOrderListWhere(query: OrderListQuery): {
  where: Prisma.SalesOrderWhereInput;
  statusFilter: OrderListTypeFilter;
  keyword: string;
  page: number;
} {
  const dateFilter = resolveDateFilter(query);
  const dealerFilter = parseDealerFilter(query.dealer);
  const customerFilter = clean(query.customer);
  const keyword = clean(query.q);
  // V112: lọc theo LOẠI ĐƠN (nhận cả tham số `status` cũ).
  const statusFilter = normalizeOrderListType(query.type ?? query.status);
  const codes = typeCodes(statusFilter);
  const page = Math.max(1, Math.floor(Number(clean(query.page)) || 1));

  const where: Prisma.SalesOrderWhereInput = {
    ...(dateFilter ? { orderDate: dateFilter } : {}),
    ...(dealerFilter
      ? dealerFilter.kind === "code"
        ? { customerCode: dealerFilter.value }
        : { customerName: dealerFilter.value }
      : {}),
    ...(customerFilter ? { receiverName: customerFilter } : {}),
    ...(codes ? { orderType: { in: codes } } : {}),
    ...(keyword
      ? {
          OR: [
            { orderCode: { contains: keyword, mode: "insensitive" as const } },
            { customerName: { contains: keyword, mode: "insensitive" as const } },
            { customerCode: { contains: keyword, mode: "insensitive" as const } },
            { receiverName: { contains: keyword, mode: "insensitive" as const } },
            { receiverPhone: { contains: keyword, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  return { where, statusFilter, keyword, page };
}

/**
 * Dựng chuỗi query giữ nguyên mọi bộ lọc hiện có, chỉ đổi vài tham số
 * (dùng cho chip khoảng ngày, tab trạng thái, phân trang, chọn đơn ở cột chi tiết).
 */
export function buildOrderListQueryString(
  query: OrderListQuery,
  patch: Partial<OrderListQuery> = {},
): string {
  const params = new URLSearchParams();
  const merged: Record<string, string> = {};
  for (const [key, value] of Object.entries({ ...query, ...patch })) {
    if (key === "orderId" && value === undefined) continue;
    const text = clean(value);
    if (text) merged[key] = text;
  }
  // Chọn đơn khác thì bỏ đơn đang chọn nếu không được truyền lại.
  if ("orderId" in patch && !clean(patch.orderId)) delete merged.orderId;
  for (const [key, value] of Object.entries(merged)) params.set(key, value);
  const text = params.toString();
  return text ? `?${text}` : "";
}
