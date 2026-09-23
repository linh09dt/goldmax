import { Fragment } from "react";
import Link from "next/link";
import { ErpShell } from "@/components/erp-shell";
import { OrderDeleteButton } from "@/components/order-delete-button";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type OrderQuery = {
  date?: string;
  month?: string;
  year?: string;
  from?: string;
  to?: string;
  dealer?: string;
  customer?: string;
};

type LineData = {
  id: string;
  isMain: boolean;
  setNo: string | null;
  productCode: string | null;
  unit: string | null;
  openingDirection: string | null;
  trimDirection: string | null;
  paintColor: string | null;
  heightMm: number | null;
  widthMm: number | null;
  frameMm: number | null;
  clearHeightMm: number | null;
  clearWidthMm: number | null;
  trimBarsPerSet: number | null;
  trimType: string | null;
  lockModel: string | null;
  windowBars: string | null;
  leavesPerSet: number | null;
  note: string | null;
  quantity: number | null;
  pricingQuantity: number | null;
  unitPrice: unknown;
  amount: unknown;
};

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<OrderQuery>;
}) {
  const query = await searchParams;
  const dateFilter = resolveDateFilter(query);
  const dealerFilter = parseDealerFilter(query.dealer);
  const customerFilter = clean(query.customer);

  const filterSource = await prisma.salesOrder.findMany({
    orderBy: [{ orderDate: "desc" }, { id: "desc" }],
    select: {
      customerCode: true,
      customerName: true,
      receiverName: true,
    },
  });

  const orders = await prisma.salesOrder.findMany({
    where: {
      ...(dateFilter ? { orderDate: dateFilter } : {}),
      ...(dealerFilter
        ? dealerFilter.kind === "code"
          ? { customerCode: dealerFilter.value }
          : { customerName: dealerFilter.value }
        : {}),
      ...(customerFilter ? { receiverName: customerFilter } : {}),
    },
    orderBy: [{ requiredDeliveryDate: "asc" }, { id: "desc" }],
    include: {
      items: {
        orderBy: { lineNo: "asc" },
        include: { details: { orderBy: { rowOrder: "asc" } } },
      },
    },
  });

  const dealers = buildDealerOptions(filterSource);
  const customers = Array.from(
    new Set(filterSource.map((row) => clean(row.receiverName)).filter(Boolean)),
  ).sort((a, b) => a.localeCompare(b, "vi"));

  const visibleLines = orders.flatMap((order) => {
    const lines: Array<{ order: typeof order; line: LineData }> = [];

    for (const item of order.items) {
      if (hasKhLuong(item.pricingQuantity)) {
        lines.push({
          order,
          line: {
            id: `i-${item.id}`,
            isMain: true,
            setNo: item.setNo,
            productCode: item.productCode,
            unit: item.unit,
            openingDirection: item.openingDirection,
            trimDirection: item.trimDirection,
            paintColor: item.paintColor,
            heightMm: item.heightMm,
            widthMm: item.widthMm,
            frameMm: item.frameMm,
            clearHeightMm: item.clearHeightMm,
            clearWidthMm: item.clearWidthMm,
            trimBarsPerSet: item.trimBarsPerSet,
            trimType: item.trimType,
            lockModel: item.lockModel,
            windowBars: item.windowBars,
            leavesPerSet: item.leavesPerSet,
            note: item.note,
            quantity: item.quantity,
            pricingQuantity: item.pricingQuantity,
            unitPrice: item.unitPrice,
            amount: item.amount,
          },
        });
      }

      for (const detail of item.details) {
        if (!hasKhLuong(detail.pricingQuantity)) continue;
        lines.push({
          order,
          line: {
            id: `d-${detail.id}`,
            isMain: false,
            setNo: detail.setNo,
            productCode: detail.productCode,
            unit: detail.unit,
            openingDirection: detail.openingDirection,
            trimDirection: detail.trimDirection,
            paintColor: detail.paintColor,
            heightMm: detail.heightMm,
            widthMm: detail.widthMm,
            frameMm: detail.frameMm,
            clearHeightMm: detail.clearHeightMm,
            clearWidthMm: detail.clearWidthMm,
            trimBarsPerSet: detail.trimBarsPerSet,
            trimType: detail.trimType,
            lockModel: detail.lockModel,
            windowBars: detail.windowBars,
            leavesPerSet: detail.leavesPerSet,
            note: detail.note,
            quantity: detail.quantity,
            pricingQuantity: detail.pricingQuantity,
            unitPrice: detail.unitPrice,
            amount: detail.amount,
          },
        });
      }
    }

    return lines;
  });

  const orderGroupIndex = new Map(orders.map((order, index) => [order.id, index]));



  return (
    <ErpShell
      title="Quản lý đơn hàng"
      actions={<Link className="erp-button" href="/orders/new">+ Tạo đơn hàng</Link>}
    >
      <section className="erp-card mt-6 p-4">
        <form method="GET" className="grid gap-3 md:grid-cols-2 xl:grid-cols-8">
          <FilterField label="Ngày">
            <input className="erp-input" type="date" name="date" defaultValue={clean(query.date)} />
          </FilterField>

          <FilterField label="Tháng">
            <input className="erp-input" type="month" name="month" defaultValue={clean(query.month)} />
          </FilterField>

          <FilterField label="Năm">
            <input
              className="erp-input"
              type="number"
              name="year"
              min={2000}
              max={2100}
              inputMode="numeric"
              defaultValue={clean(query.year)}
            />
          </FilterField>

          <FilterField label="Từ ngày">
            <input className="erp-input" type="date" name="from" defaultValue={clean(query.from)} />
          </FilterField>

          <FilterField label="Đến ngày">
            <input className="erp-input" type="date" name="to" defaultValue={clean(query.to)} />
          </FilterField>

          <FilterField label="Đại lý">
            <select className="erp-input" name="dealer" defaultValue={clean(query.dealer)}>
              <option value="">Tất cả</option>
              {dealers.map((dealer) => (
                <option key={dealer.value} value={dealer.value}>{dealer.label}</option>
              ))}
            </select>
          </FilterField>

          <FilterField label="Khách hàng">
            <select className="erp-input" name="customer" defaultValue={customerFilter}>
              <option value="">Tất cả</option>
              {customers.map((customer) => (
                <option key={customer} value={customer}>{customer}</option>
              ))}
            </select>
          </FilterField>

          <div className="flex items-end gap-2">
            <button type="submit" className="erp-button h-10 flex-1">Lọc</button>
            <Link href="/orders" className="erp-button-secondary flex h-10 flex-1 items-center justify-center">Xóa lọc</Link>
          </div>
        </form>
      </section>

      <section className="erp-card mt-6">
        <div className="border-b border-slate-200 bg-slate-50 px-5 py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-bold">Danh sách đơn hàng</h2>
            </div>
          </div>
        </div>

        <div className="w-full">
          <table className="w-full table-fixed border-collapse text-[8px] 2xl:text-[9px]">
            <colgroup>
              {[3.2, 5.3, 3.2, 7.5, 3.2, 3.2, 4.3, 3.2, 3.2, 4.3, 2.1, 2.1, 2.1, 2.7, 2.7, 2.7, 2.7, 2.7, 2.7, 2.7, 2.7, 3.2, 2.7, 2.1, 2.1, 3.2, 4.3, 4.3, 4.3].map((width, index) => (
                <col key={index} style={{ width: `${width}%` }} />
              ))}
            </colgroup>
            <thead className="bg-slate-900 text-left text-[7px] uppercase tracking-tight text-slate-200 2xl:text-[8px]">
              <tr>
                <Th>Ngày đơn hàng</Th>
                <Th>Số đơn hàng</Th>
                <Th>Hạn giao hàng</Th>
                <Th>Người nhận và địa chỉ nhận</Th>
                <Th>Số Km từ nhà máy đến nơi giao</Th>
                <Th>Mã khách hàng</Th>
                <Th>Tên khách hàng</Th>
                <Th>Mã nhân viên bán hàng</Th>
                <Th>Mã bộ đánh số</Th>
                <Th>Mã hàng</Th>
                <Th>ĐVT</Th>
                <Th>Hướng mở</Th>
                <Th>Hướng phào</Th>
                <Th>Màu sơn - mã vân</Th>
                <Th>Chiều Cao ô chờ</Th>
                <Th>Chiều rộng ô chờ</Th>
                <Th>Độ dày khuôn</Th>
                <Th>Cao thông thủy</Th>
                <Th>Rộng thông thủy</Th>
                <Th>Số thanh phào / bộ</Th>
                <Th>Loại phào</Th>
                <Th>Model Khóa</Th>
                <Th>Kiểu song</Th>
                <Th>Số Cánh/bộ</Th>
                <Th>Số lượng</Th>
                <Th>KH/Lượng</Th>
                <Th>Đơn giá</Th>
                <Th>Thành tiền</Th>
                <Th>Trạng thái</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {visibleLines.length === 0 ? (
                <tr>
                  <td className="px-4 py-12 text-center text-slate-500" colSpan={29}>
                    Chưa có dòng đơn hàng nào có KH/Lượng lớn hơn 0.
                  </td>
                </tr>
              ) : visibleLines.map(({ order, line }, index) => {
                const previous = index > 0 ? visibleLines[index - 1] : null;
                const firstLineOfOrder = !previous || previous.order.id !== order.id;
                const groupIndex = orderGroupIndex.get(order.id) ?? 0;
                const evenGroup = groupIndex % 2 === 0;
                const rowTone = line.isMain
                  ? evenGroup
                    ? "bg-cyan-100/75 font-medium"
                    : "bg-indigo-100/65 font-medium"
                  : evenGroup
                    ? "bg-cyan-50/35"
                    : "bg-indigo-50/35";
                const groupDivider = firstLineOfOrder
                  ? evenGroup
                    ? "border-t-[4px] border-t-cyan-600"
                    : "border-t-[4px] border-t-indigo-600"
                  : "";
                const receiver = [order.receiverName, order.receiverPhone, order.receiverAddress]
                  .filter(Boolean)
                  .join(" - ");

                return (
                  <Fragment key={`${order.id}-${line.id}`}>
                    {firstLineOfOrder ? (
                      <tr className={`${groupDivider} ${evenGroup ? "bg-cyan-50" : "bg-indigo-50"}`}>
                        <td colSpan={29} className="border-b border-slate-200 px-1.5 py-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <Link className="erp-action-dark" href={`/orders/${order.id}/edit`}>Sửa</Link>
                            <OrderDeleteButton orderId={order.id} orderCode={order.orderCode} compact />
                            <a className="erp-action-dark" href={`/api/orders/${order.id}/export`}>Xuất Excel</a>
                            <Link className="erp-action-dark" href={`/orders/${order.id}/print?auto=1`} target="_blank">PDF</Link>
                          </div>
                        </td>
                      </tr>
                    ) : null}
                    <tr className={`${rowTone} hover:bg-amber-50/70`}>
                      <Td>{firstLineOfOrder ? formatDate(order.orderDate) : ""}</Td>
                      <Td>
                        {firstLineOfOrder ? (
                          <Link className="font-semibold text-cyan-700 hover:underline" href={`/orders/${order.id}`}>
                            {order.orderCode}
                          </Link>
                        ) : ""}
                      </Td>
                      <Td>{firstLineOfOrder ? formatDate(order.requiredDeliveryDate) : ""}</Td>
                      <Td>{firstLineOfOrder ? (receiver || "—") : ""}</Td>
                      <Td className="text-right">{firstLineOfOrder ? formatNumber(order.deliveryKm) : ""}</Td>
                      <Td>{firstLineOfOrder ? (order.customerCode || "—") : ""}</Td>
                      <Td>{firstLineOfOrder ? (order.customerName || "—") : ""}</Td>
                      <Td>{order.salesEmployeeCode || "—"}</Td>
                      <Td>{line.setNo || "—"}</Td>
                      <Td className="font-semibold">{line.productCode || "—"}</Td>
                      <Td>{line.unit || "—"}</Td>
                      <Td>{line.openingDirection || "—"}</Td>
                      <Td>{line.trimDirection || "—"}</Td>
                      <Td>{line.paintColor || "—"}</Td>
                      <Td className="text-right">{formatNumber(line.heightMm)}</Td>
                      <Td className="text-right">{formatNumber(line.widthMm)}</Td>
                      <Td className="text-right">{formatNumber(line.frameMm)}</Td>
                      <Td className="text-right">{formatNumber(line.clearHeightMm)}</Td>
                      <Td className="text-right">{formatNumber(line.clearWidthMm)}</Td>
                      <Td className="text-right">{formatNumber(line.trimBarsPerSet)}</Td>
                      <Td>{line.trimType || "—"}</Td>
                      <Td>{line.lockModel || "—"}</Td>
                      <Td>{line.windowBars || "—"}</Td>
                      <Td className="text-right">{formatNumber(line.leavesPerSet)}</Td>
                      <Td className="text-right">{formatNumber(line.quantity)}</Td>
                      <Td className="bg-blue-50 text-right font-bold text-blue-950">{formatDecimal(line.pricingQuantity)}</Td>
                      <Td className="text-right">{formatMoney(line.unitPrice)}</Td>
                      <Td className="text-right font-semibold">{formatMoney(line.amount)}</Td>
                      <Td>{firstLineOfOrder ? <Status value={order.status} /> : ""}</Td>
                    </tr>
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </ErpShell>
  );
}

function hasKhLuong(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function FilterField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-slate-600">{label}</span>
      {children}
    </label>
  );
}

function buildDealerOptions(
  rows: Array<{ customerCode: string | null; customerName: string | null }>,
) {
  const map = new Map<string, { value: string; label: string }>();
  for (const row of rows) {
    const code = clean(row.customerCode);
    const name = clean(row.customerName);
    if (!code && !name) continue;
    const value = code ? `C:${code}` : `N:${name}`;
    const label = code && name ? `${code} - ${name}` : code || name;
    if (!map.has(value)) map.set(value, { value, label });
  }
  return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label, "vi"));
}

function parseDealerFilter(value: unknown) {
  const text = clean(value);
  if (!text) return null;
  if (text.startsWith("C:")) return { kind: "code" as const, value: text.slice(2) };
  if (text.startsWith("N:")) return { kind: "name" as const, value: text.slice(2) };
  return { kind: "code" as const, value: text };
}

function resolveDateFilter(query: OrderQuery) {
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

  const monthText = clean(query.month);
  const monthMatch = /^(\d{4})-(\d{2})$/.exec(monthText);
  if (monthMatch) {
    const year = Number(monthMatch[1]);
    const month = Number(monthMatch[2]);
    if (month >= 1 && month <= 12) {
      const start = new Date(Date.UTC(year, month - 1, 1));
      const end = new Date(Date.UTC(year, month, 1));
      return { gte: start, lt: end };
    }
  }

  const year = Number(clean(query.year));
  if (Number.isInteger(year) && year >= 2000 && year <= 2100) {
    return {
      gte: new Date(Date.UTC(year, 0, 1)),
      lt: new Date(Date.UTC(year + 1, 0, 1)),
    };
  }

  return null;
}

function parseIsoDate(value: unknown) {
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

function clean(value: unknown) {
  if (value === null || value === undefined) return "";
  const text = String(value).trim();
  return text === "-" || text === "—" ? "" : text;
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="sticky top-0 z-30 break-words border-r border-slate-700 bg-slate-900 px-1 py-2 align-middle font-semibold leading-[1.15] text-slate-200 shadow-[0_1px_0_rgba(148,163,184,0.45)] last:border-r-0">
      {children}
    </th>
  );
}

function Td({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <td className={`break-words border-r border-slate-200 px-1 py-1.5 align-top leading-[1.2] text-slate-700 last:border-r-0 ${className}`}>
      {children}
    </td>
  );
}

function Status({ value }: { value: string }) {
  const labels: Record<string, string> = {
    NHAP: "Nháp",
    CHO_XAC_NHAN: "Chờ xác nhận",
    DA_XAC_NHAN: "Đã xác nhận",
    CHUYEN_SAN_XUAT: "Đã chuyển sản xuất",
    HUY: "Đã hủy",
  };
  return <span className="inline-block rounded bg-slate-100 px-1 py-0.5 text-[7px] font-semibold leading-tight text-slate-700 2xl:text-[8px]">{labels[value] ?? value}</span>;
}

function formatDate(value: Date | null) {
  return value ? new Intl.DateTimeFormat("vi-VN").format(value) : "—";
}

function formatNumber(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 3 }).format(value);
}

function formatDecimal(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value) || value <= 0) return "—";
  return new Intl.NumberFormat("vi-VN", { minimumFractionDigits: 0, maximumFractionDigits: 4 }).format(value);
}

function formatMoney(value: unknown) {
  if (value === null || value === undefined) return "—";
  const n = Number(String(value));
  return Number.isFinite(n)
    ? `${new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 0 }).format(n)} đ`
    : "—";
}
