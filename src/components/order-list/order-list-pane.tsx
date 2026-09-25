import Link from "next/link";
import { isProductionStatus, orderStatusLabel } from "@/lib/order-form";
import {
  ORDER_LIST_PAGE_SIZE,
  ORDER_LIST_STATUS_FILTERS,
  buildOrderListQueryString,
  type OrderListQuery,
} from "@/lib/order-list-filters";
import { deliveryHint, formatDate, formatMoney, formatMoneyShort, textOrDash } from "@/components/order-list/format";

/**
 * V100: cột TRÁI của màn Quản lý đơn hàng (dạng chia 2 cột) — danh sách đơn gọn,
 * bấm 1 đơn để xem chi tiết ở cột phải (đơn đang chọn truyền qua query `orderId`).
 * Component thuần trình bày (server component), không tự truy vấn dữ liệu.
 */

export type OrderListRow = {
  id: number;
  orderCode: string;
  status: string;
  orderDate: Date | null;
  requiredDeliveryDate: Date | null;
  customerName: string | null;
  customerCode: string | null;
  receiverName: string | null;
  deliveryKm: number | null;
  itemCount: number;
  quantityTotal: number;
  total: unknown;
  remaining: unknown;
};

export function OrderListPane({
  orders,
  selectedId,
  baseQuery,
  statusCounts,
  totalCount,
  totalValue,
  overdueCount,
  page,
  pageCount,
}: {
  orders: OrderListRow[];
  selectedId: number | null;
  baseQuery: OrderListQuery;
  statusCounts: { all: number; sample: number; prod: number };
  totalCount: number;
  totalValue: unknown;
  overdueCount: number;
  page: number;
  pageCount: number;
}) {
  const statusFilter = baseQuery.status === "sample" || baseQuery.status === "prod" ? baseQuery.status : "all";
  const firstIndex = totalCount === 0 ? 0 : (page - 1) * ORDER_LIST_PAGE_SIZE + 1;
  const lastIndex = Math.min(page * ORDER_LIST_PAGE_SIZE, totalCount);

  return (
    <section className="erp-card flex min-h-[640px] flex-col overflow-hidden">
      {/* Tab trạng thái */}
      <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-200 bg-slate-50 px-2.5 py-2">
        {ORDER_LIST_STATUS_FILTERS.map((option) => {
          const active = statusFilter === option.value;
          const count = option.value === "all" ? statusCounts.all : option.value === "sample" ? statusCounts.sample : statusCounts.prod;
          return (
            <Link
              key={option.value}
              href={`/orders${buildOrderListQueryString(baseQuery, { status: option.value === "all" ? "" : option.value, page: "" })}`}
              className={`inline-flex h-7 items-center gap-1.5 rounded-md border px-2.5 text-[11.5px] font-semibold transition ${
                active ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
              }`}
            >
              {option.label}
              <span className={`tabular-nums ${active ? "text-cyan-200" : "text-slate-500"}`}>{count}</span>
            </Link>
          );
        })}
      </div>

      {/* 3 chỉ số nhanh theo bộ lọc */}
      <div className="grid grid-cols-3 gap-2 border-b border-slate-200 px-2.5 py-2">
        <div>
          <div className="text-[9.5px] font-bold uppercase tracking-wide text-slate-500">Tổng đơn</div>
          <div className="text-[15px] font-bold tabular-nums text-slate-900">{new Intl.NumberFormat("vi-VN").format(totalCount)}</div>
        </div>
        <div>
          <div className="text-[9.5px] font-bold uppercase tracking-wide text-slate-500">Tổng tiền</div>
          <div className="text-[15px] font-bold tabular-nums text-slate-900" title={formatMoney(totalValue)}>{formatMoneyShort(totalValue)}</div>
        </div>
        <div>
          <div className="text-[9.5px] font-bold uppercase tracking-wide text-slate-500">Quá hạn giao</div>
          <div className={`text-[15px] font-bold tabular-nums ${overdueCount > 0 ? "text-red-600" : "text-slate-900"}`}>{overdueCount}</div>
        </div>
      </div>

      {/* Danh sách đơn */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        {orders.length === 0 ? (
          <div className="px-4 py-10 text-center text-slate-500">
            <div className="font-semibold">Chưa có đơn nào khớp bộ lọc</div>
            <div className="mt-1 text-[11.5px]">Thử bỏ lọc, đổi trạng thái hoặc từ khoá tìm kiếm.</div>
            <Link className="erp-button-secondary mt-3 inline-flex" href="/orders">Xoá lọc</Link>
          </div>
        ) : null}

        {orders.map((order) => {
          const selected = selectedId === order.id;
          const production = isProductionStatus(order.status);
          const hint = deliveryHint(order.requiredDeliveryDate);
          const subParts = [textOrDash(order.customerName || order.customerCode), `${order.itemCount} bộ cửa`];
          return (
            <Link
              key={order.id}
              href={`/orders${buildOrderListQueryString(baseQuery, { orderId: String(order.id) })}`}
              className={`grid grid-cols-[10px_minmax(0,1fr)_118px] items-center gap-2 border-b border-slate-100 px-2.5 py-2 transition ${
                selected ? "bg-cyan-50 shadow-[inset_3px_0_0_#0e7490]" : "bg-white hover:bg-cyan-50/50"
              }`}
            >
              <span className={`h-2 w-2 rounded-full ${production ? "bg-emerald-500" : "bg-slate-400"}`} title={orderStatusLabel(order.status)} />
              <span className="min-w-0">
                <span className="block truncate text-[12.5px] font-bold text-cyan-700">{order.orderCode}</span>
                <span className="mt-0.5 block truncate text-[11px] text-slate-600">
                  {subParts.join(" · ")}
                  {order.deliveryKm !== null && Number.isFinite(order.deliveryKm) ? ` · ${new Intl.NumberFormat("vi-VN").format(order.deliveryKm)} km` : ""}
                </span>
                <span className="mt-0.5 block truncate text-[10.5px] text-slate-500">
                  Đặt {formatDate(order.orderDate)}
                </span>
              </span>
              <span className="text-right">
                <span className="block text-[12.5px] font-bold tabular-nums text-slate-900">{formatMoney(order.total)}</span>
                <span
                  className={`mt-0.5 block text-[10.5px] ${
                    hint.tone === "late" ? "font-bold text-red-600" : hint.tone === "soon" ? "font-semibold text-amber-700" : "text-slate-500"
                  }`}
                >
                  {hint.text}
                </span>
              </span>
            </Link>
          );
        })}
      </div>

      {/* Phân trang */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 bg-slate-50 px-2.5 py-2 text-[11px] text-slate-600">
        <div>
          {totalCount === 0 ? "Không có đơn" : <>Hiển thị <b className="tabular-nums">{firstIndex}–{lastIndex}</b> / <b className="tabular-nums">{totalCount}</b> đơn</>}
        </div>
        {pageCount > 1 ? (
          <div className="flex items-center gap-1">
            <PageLink baseQuery={baseQuery} page={page - 1} disabled={page <= 1} label="‹" />
            {pageNumbers(page, pageCount).map((value, index) =>
              value === null ? (
                <span key={`gap-${index}`} className="px-1 text-slate-400">…</span>
              ) : (
                <PageLink key={value} baseQuery={baseQuery} page={value} active={value === page} label={String(value)} />
              ),
            )}
            <PageLink baseQuery={baseQuery} page={page + 1} disabled={page >= pageCount} label="›" />
          </div>
        ) : null}
      </div>
    </section>
  );
}

function PageLink({
  baseQuery,
  page,
  label,
  active = false,
  disabled = false,
}: {
  baseQuery: OrderListQuery;
  page: number;
  label: string;
  active?: boolean;
  disabled?: boolean;
}) {
  const className = `inline-flex h-6 min-w-6 items-center justify-center rounded-md border px-1.5 font-semibold tabular-nums ${
    active
      ? "border-cyan-700 bg-cyan-600 text-white"
      : disabled
        ? "border-slate-200 bg-slate-100 text-slate-400"
        : "border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
  }`;
  if (disabled) return <span className={className}>{label}</span>;
  return <Link className={className} href={`/orders${buildOrderListQueryString(baseQuery, { page: page <= 1 ? "" : String(page) })}`}>{label}</Link>;
}

/** Hiện tối đa 5 số trang quanh trang hiện tại, chèn dấu … khi bị cắt. */
function pageNumbers(page: number, pageCount: number): Array<number | null> {
  const values = new Set<number>([1, pageCount, page, page - 1, page + 1]);
  const list = Array.from(values).filter((value) => value >= 1 && value <= pageCount).sort((a, b) => a - b);
  const result: Array<number | null> = [];
  let previous = 0;
  for (const value of list) {
    if (previous && value - previous > 1) result.push(null);
    result.push(value);
    previous = value;
  }
  return result;
}
