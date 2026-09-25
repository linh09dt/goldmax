import Link from "next/link";
import { ErpShell } from "@/components/erp-shell";
import { prisma } from "@/lib/prisma";
import { OrderListPane, type OrderListRow } from "@/components/order-list/order-list-pane";
import { OrderDetailPane, type OrderDetailData } from "@/components/order-list/order-detail-pane";
import {
  ORDER_LIST_PAGE_SIZE,
  ORDER_LIST_PRESETS,
  PRODUCTION_STATUS_CODES,
  SAMPLE_STATUS_CODES,
  buildOrderListQueryString,
  buildOrderListWhere,
  clean,
  resolveDatePreset,
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
  const { where, statusFilter, keyword, page } = buildOrderListWhere(query);

  const now = new Date();
  const startOfToday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

  const withoutStatus = { ...where };
  delete (withoutStatus as { status?: unknown }).status;

  const [totalCount, totalAggregate, orders, overdueCount, countAll, countSample, countProd, dealerRows, customerRows] = await Promise.all([
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
    prisma.salesOrder.count({ where: { ...withoutStatus, status: { in: SAMPLE_STATUS_CODES } } }),
    prisma.salesOrder.count({ where: { ...withoutStatus, status: { in: PRODUCTION_STATUS_CODES } } }),
    prisma.salesOrder.findMany({ distinct: ["customerCode"], select: { customerCode: true, customerName: true }, orderBy: { customerCode: "asc" } }),
    prisma.salesOrder.findMany({ distinct: ["receiverName"], select: { receiverName: true }, orderBy: { receiverName: "asc" } }),
  ]);

  const pageCount = Math.max(1, Math.ceil(totalCount / ORDER_LIST_PAGE_SIZE));
  const rows: OrderListRow[] = orders.map((order) => ({
    id: order.id,
    orderCode: order.orderCode,
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
      {/* Bộ lọc: tìm nhanh + khoảng ngày (chip) + đại lý/khách hàng */}
      <form method="GET" className="erp-card mt-6 flex flex-wrap items-end gap-2 px-3 py-2.5">
        <input type="hidden" name="status" value={statusFilter === "all" ? "" : statusFilter} />
        <label className="flex flex-col gap-1">
          <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Tìm nhanh</span>
          <input className="erp-input h-9 w-[240px]" type="search" name="q" defaultValue={keyword} placeholder="Mã đơn, khách hàng, SĐT, mã đại lý…" />
        </label>

        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Khoảng ngày</span>
          <div className="flex flex-wrap items-center gap-1.5">
            {ORDER_LIST_PRESETS.map((preset) => {
              const bounds = resolveDatePreset(preset.value);
              const active = Boolean(bounds) && clean(query.from) === bounds?.from && clean(query.to) === bounds?.to;
              return (
                <Link
                  key={preset.value}
                  className={`inline-flex h-9 items-center rounded-md border px-2.5 text-[11.5px] font-semibold ${
                    active ? "border-cyan-700 bg-cyan-600 text-white" : "border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
                  }`}
                  href={`/orders${buildOrderListQueryString(query, { from: bounds?.from ?? "", to: bounds?.to ?? "", page: "", orderId: "" })}`}
                >
                  {preset.label}
                </Link>
              );
            })}
          </div>
        </div>

        <label className="flex flex-col gap-1">
          <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Từ ngày</span>
          <input className="erp-input h-9 w-[132px]" type="date" name="from" defaultValue={clean(query.from)} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Đến ngày</span>
          <input className="erp-input h-9 w-[132px]" type="date" name="to" defaultValue={clean(query.to)} />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Đại lý</span>
          <select className="erp-input h-9 w-[168px]" name="dealer" defaultValue={clean(query.dealer)}>
            <option value="">Tất cả</option>
            {dealers.map((dealer) => (
              <option key={dealer.value} value={dealer.value}>{dealer.label}</option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Khách hàng</span>
          <select className="erp-input h-9 w-[150px]" name="customer" defaultValue={clean(query.customer)}>
            <option value="">Tất cả</option>
            {customers.map((customer) => (
              <option key={customer} value={customer}>{customer}</option>
            ))}
          </select>
        </label>

        <div className="flex items-center gap-2">
          <button type="submit" className="erp-button h-9 px-3 text-[12px]">Lọc</button>
          <Link className="erp-button-secondary flex h-9 items-center px-3 text-[12px]" href="/orders">Xoá lọc</Link>
          <a className="inline-flex h-9 items-center rounded-md border border-emerald-700 bg-emerald-600 px-3 text-[12px] font-semibold text-white hover:bg-emerald-500" href={exportHref}>
            ⤓ Xuất Excel danh sách
          </a>
        </div>
      </form>

      {/* Hai cột: danh sách + chi tiết */}
      <div className="mt-3 grid gap-3 xl:grid-cols-[452px_minmax(0,1fr)]">
        <OrderListPane
          orders={rows}
          selectedId={selectedId}
          baseQuery={{ ...query, status: statusFilter === "all" ? "" : statusFilter }}
          statusCounts={{ all: countAll, sample: countSample, prod: countProd }}
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
