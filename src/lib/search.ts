import { prisma } from "@/lib/prisma";

/**
 * V130 — Tìm kiếm toàn cục (Ctrl+K).
 * Gồm 4 nguồn dữ liệu đang có: đơn hàng, khách hàng (suy từ đơn), hàng hóa, mã đại lý.
 * Không tạo bảng mới — chỉ truy vấn các bảng hiện có.
 */

export type SearchResultType = "order" | "customer" | "item" | "dealer";

export type SearchResult = {
  type: SearchResultType;
  title: string;
  subtitle: string;
  href: string;
};

export type SearchGroups = {
  orders: SearchResult[];
  customers: SearchResult[];
  items: SearchResult[];
  dealers: SearchResult[];
  total: number;
};

const EMPTY: SearchGroups = { orders: [], customers: [], items: [], dealers: [], total: 0 };

export async function globalSearch(rawQuery: string, limit = 6): Promise<SearchGroups> {
  const query = String(rawQuery ?? "").trim();
  if (query.length < 2) return EMPTY;

  const insensitive = { contains: query, mode: "insensitive" as const };

  const [orders, items, dealers] = await Promise.all([
    prisma.salesOrder.findMany({
      where: {
        OR: [
          { orderCode: insensitive },
          { customerName: insensitive },
          { customerCode: insensitive },
          { receiverName: insensitive },
          { receiverPhone: insensitive },
        ],
      },
      orderBy: [{ orderDate: "desc" }, { id: "desc" }],
      take: limit,
      select: {
        id: true,
        orderCode: true,
        customerName: true,
        customerCode: true,
        receiverName: true,
        receiverPhone: true,
        totalAfterDiscount: true,
      },
    }),
    prisma.itemMaster.findMany({
      where: { OR: [{ code: insensitive }, { name: insensitive }, { productDescription: insensitive }] },
      orderBy: [{ name: "asc" }, { code: "asc" }],
      take: limit,
      select: { id: true, code: true, name: true, unit: true, dealerPrice: true },
    }),
    prisma.masterOption.findMany({
      where: { groupCode: "DEALER_CODE", OR: [{ code: insensitive }, { name: insensitive }] },
      orderBy: { code: "asc" },
      take: limit,
      select: { id: true, code: true, name: true },
    }),
  ]);

  const orderResults: SearchResult[] = orders.map((order) => ({
    type: "order",
    title: order.orderCode,
    subtitle: [order.customerName || order.customerCode, order.receiverPhone].filter(Boolean).join(" · ") || "Đơn hàng",
    href: `/orders/${order.id}`,
  }));

  // Khách hàng: gom không trùng theo tên từ chính kết quả đơn (đúng cách danh bạ đang dựng).
  const customerMap = new Map<string, SearchResult>();
  for (const order of orders) {
    const name = (order.customerName ?? "").trim();
    if (!name) continue;
    if (!customerMap.has(name)) {
      customerMap.set(name, {
        type: "customer",
        title: name,
        subtitle: [order.customerCode, order.receiverPhone].filter(Boolean).join(" · ") || "Khách hàng",
        href: `/orders?q=${encodeURIComponent(name)}`,
      });
    }
    if (customerMap.size >= limit) break;
  }

  const itemResults: SearchResult[] = items.map((item) => ({
    type: "item",
    title: item.code,
    subtitle: [item.name, item.unit].filter(Boolean).join(" · "),
    href: `/settings?tab=items`,
  }));

  const dealerResults: SearchResult[] = dealers.map((dealer) => ({
    type: "dealer",
    title: dealer.code,
    subtitle: dealer.name || "Mã đại lý",
    href: `/orders?dealer=${encodeURIComponent(`C:${dealer.code}`)}`,
  }));

  const groups = {
    orders: orderResults,
    customers: [...customerMap.values()],
    items: itemResults,
    dealers: dealerResults,
  };

  return {
    ...groups,
    total: groups.orders.length + groups.customers.length + groups.items.length + groups.dealers.length,
  };
}
