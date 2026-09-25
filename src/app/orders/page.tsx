import Link from "next/link";
import { ErpShell } from "@/components/erp-shell";
import { prisma } from "@/lib/prisma";
import { OrderFilterBar } from "@/components/order-list/order-filter-bar";
import { OrderListPane, type OrderListRow } from "@/components/order-list/order-list-pane";
import { OrderDetailPane, type OrderDetailData } from "@/components/order-list/order-detail-pane";
import {
  ORDER_LIST_PAGE_SIZE,
  buildOrderListQueryString,
  buildOrderListWhere,
  clean,
  type OrderListQuery,
} from "@/lib/order-list-filters";

export const dynamic = "force-dynamic";

/**
 * V100: màn Quản lý đơn hàng dạng CHIA 2 CỘT (theo phương án B đã chốt):
 * - Cột trái: danh sách đơn gọn (tab trạng thái, 3 chỉ số, phân trang 20 đơn/trang).
 * - Cột phải: chi tiết đơn đang chọn (đơn chọn qua query `orderId`) — không cần mở trang mới.
 * Bảng 23 cột đầy đủ vẫn ở trang chi tiết đơn và ở file Excel xuất danh sách.
 */
export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<OrderListQuery>;
}) {
  const query = await searchParams;
  const { where, statusFilter, page } = buildOrderListWhere(query);

  const now = new Date();
  const startOfToday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

  // V112: bỏ điều kiện LỌC LOẠI ĐƠN để đếm số đơn của từng loại.
  const withoutStatus = { ...where };
  delete (withoutStatus as { orderType?: unknown }).orderType;
  delete (withoutStatus as { status?: unknown }).status;

  const [totalCount, totalAggregate, orders, overdueCount, countAll, countMau, countSanXuat, countLamLai, dealerRows, customerRows] = await Promise.all([
    prisma.salesOrder.count({ where }),
    prisma.salesOrder.aggregate({ where, _sum: { totalAfterDiscount: true } }),
    prisma.salesOrder.findMany({
      where,
      // Đơn giao gần nhất lên đầu (đơn chưa đặt hạn nằm cuối), cùng ngày thì đơn mới nhất trước.
      orderBy: [{ requiredDeliveryDate: "asc" }, { id: "desc" }],
      skip: (page - 1) * ORDER_LIST_PAGE_SIZE,
      take: ORDER_LIST_PAGE_SIZE,
      select: {
        id: true,
        orderCode: true,
        orderType: true,
        status: true,
        orderDate: true,
        requiredDeliveryDate: true,
        customerName: true,
        customerCode: true,
        receiverName: true,
        deliveryKm: true,
        totalAfterDiscount: true,
        deliveryPayment: true,
        _count: { select: { items: true } },
      },
    }),
    prisma.salesOrder.count({ where: { ...where, requiredDeliveryDate: { lt: startOfToday } } }),
    prisma.salesOrder.count({ where: withoutStatus }),
    prisma.salesOrder.count({ where: { ...withoutStatus, orderType: "MAU" } }),
    prisma.salesOrder.count({ where: { ...withoutStatus, orderType: "SAN_XUAT" } }),
    prisma.salesOrder.count({ where: { ...withoutStatus, orderType: "LAM_LAI" } }),
    prisma.salesOrder.findMany({ distinct: ["customerCode"], select: { customerCode: true, customerName: true }, orderBy: { customerCode: "asc" } }),
    prisma.salesOrder.findMany({ distinct: ["receiverName"], select: { receiverName: true }, orderBy: { receiverName: "asc" } }),
  ]);

  const pageCount = Math.max(1, Math.ceil(totalCount / ORDER_LIST_PAGE_SIZE));
  const rows: OrderListRow[] = orders.map((order) => ({
    id: order.id,
    orderCode: order.orderCode,
    orderType: order.orderType,
    status: order.status,
    orderDate: order.orderDate,
    requiredDeliveryDate: order.requiredDeliveryDate,
    customerName: order.customerName,
    customerCode: order.customerCode,
    receiverName: order.receiverName,
    deliveryKm: order.deliveryKm,
    itemCount: order._count.items,
    quantityTotal: 0,
    total: order.totalAfterDiscount,
    remaining: order.deliveryPayment,
  }));

  const requestedId = Number(clean(query.orderId)) || null;
  const selectedId = requestedId ?? rows[0]?.id ?? null;
  const selectedOrder = selectedId
    ? ((await prisma.salesOrder.findUnique({
        where: { id: selectedId },
        include: {
          items: { orderBy: { lineNo: "asc" }, include: { details: { orderBy: { rowOrder: "asc" } } } },
        },
      })) as OrderDetailData | null)
    : null;

  const dealers = dealerRows
    .map((row) => {
      const code = clean(row.customerCode);
      const name = clean(row.customerName);
      if (!code && !name) return null;
      return {
        value: code ? `C:${code}` : `N:${name}`,
        label: code && name ? `${code} - ${name}` : code || name,
      };
    })
    .filter((item): item is { value: string; label: string } => Boolean(item))
    .sort((a, b) => a.label.localeCompare(b.label, "vi"));
  const customers = customerRows.map((row) => clean(row.receiverName)).filter(Boolean).sort((a, b) => a.localeCompare(b, "vi"));

  const exportHref = `/api/orders/export-list${buildOrderListQueryString({ ...query, orderId: "", page: "" })}`;

  return (
    <ErpShell
      title="Quản lý đơn hàng"
      actions={<Link className="erp-button" href="/orders/new">+ Tạo đơn hàng</Link>}
    >
      <OrderFilterBar query={query} dealers={dealers} customers={customers} exportHref={exportHref} />

      {/* Hai cột: danh sách + chi tiết */}
      <div className="mt-3 grid gap-3 xl:grid-cols-[452px_minmax(0,1fr)]">
        <OrderListPane
          orders={rows}
          selectedId={selectedId}
          baseQuery={{ ...query, type: statusFilter === "all" ? "" : statusFilter, status: "" }}
          statusCounts={{ all: countAll, mau: countMau, san_xuat: countSanXuat, lam_lai: countLamLai }}
          totalCount={totalCount}
          totalValue={totalAggregate._sum.totalAfterDiscount}
          overdueCount={overdueCount}
          page={page}
          pageCount={pageCount}
        />
        <OrderDetailPane order={selectedOrder} />
      </div>
    </ErpShell>
  );
}
