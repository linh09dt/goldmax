import Link from "next/link";
import { ErpShell } from "@/components/erp-shell";
import { prisma } from "@/lib/prisma";
import { CONFIRMED_STATUS_CODES, orderTypeLabel } from "@/lib/order-form";

export const dynamic = "force-dynamic";

/** V112: doanh thu chỉ gồm đơn LOẠI "Sản xuất" ở trạng thái ĐÃ XÁC NHẬN. */
const ORDER_REVENUE_WHERE = {
  orderType: "SAN_XUAT",
  status: { in: CONFIRMED_STATUS_CODES },
} as const;

type RevenueQuery = {
  date?: string;
  month?: string;
  year?: string;
  from?: string;
  to?: string;
  dealer?: string;
  customer?: string;
};

type ProductRow = {
  key: string;
  productName: string | null;
  productCode: string | null;
  model: string | null;
  quantity: number | null;
  unit: string | null;
  pricingQuantity: number | null;
  unitPrice: unknown;
  amount: unknown;
  note: string | null;
};

type MasterProduct = {
  id: number;
  code: string;
  name: string;
  productDescription: string | null;
  salesModel: string | null;
  unit: string | null;
};

type ProductRevenueRow = {
  masterId: number;
  code: string;
  name: string;
  productDescription: string | null;
  unit: string | null;
  orderIds: Set<number>;
  quantity: number;
  pricingQuantity: number;
  revenue: number;
};

export default async function RevenuePage({
  searchParams,
}: {
  searchParams: Promise<RevenueQuery>;
}) {
  const query = await searchParams;
  const dateFilter = resolveDateFilter(query);
  const dealerFilter = parseDealerFilter(query.dealer);
  const customerFilter = clean(query.customer);

  const filterSource = await prisma.salesOrder.findMany({
    // V112: danh sách đại lý / khách hàng cũng chỉ lấy đơn Sản xuất đã xác nhận cho khớp bảng.
    where: ORDER_REVENUE_WHERE,
    orderBy: [{ orderDate: "desc" }, { id: "desc" }],
    select: {
      customerCode: true,
      customerName: true,
      receiverName: true,
    },
  });

  const orders = await prisma.salesOrder.findMany({
    where: {
      // V112: doanh thu CHỈ tính đơn loại "Sản xuất" và đã xác nhận —
      // đơn hàng mẫu / đơn làm lại / đơn nháp / đơn đã huỷ không hiện.
      ...ORDER_REVENUE_WHERE,
      ...(dateFilter ? { orderDate: dateFilter } : {}),
      ...(dealerFilter
        ? dealerFilter.kind === "code"
          ? { customerCode: dealerFilter.value }
          : { customerName: dealerFilter.value }
        : {}),
      ...(customerFilter ? { receiverName: customerFilter } : {}),
    },
    orderBy: [{ orderDate: "desc" }, { id: "desc" }],
    include: {
      items: {
        orderBy: { lineNo: "asc" },
        include: { details: { orderBy: { rowOrder: "asc" } } },
      },
    },
  });

  const masterProducts: MasterProduct[] = await prisma.itemMaster.findMany({
    orderBy: [{ name: "asc" }, { code: "asc" }],
    select: {
      id: true,
      code: true,
      name: true,
      productDescription: true,
      salesModel: true,
      unit: true,
    },
  });

  const reportRows = orders.map((order) => {
    const products: ProductRow[] = [];

    for (const item of order.items) {
      const main: ProductRow = {
        key: `i-${item.id}`,
        productName: item.productName,
        productCode: item.productCode,
        model: item.model,
        quantity: item.quantity,
        unit: item.unit,
        pricingQuantity: item.pricingQuantity,
        unitPrice: item.unitPrice,
        amount: item.amount,
        note: item.note,
      };
      if (hasProductData(main)) products.push(main);

      for (const detail of item.details) {
        const child: ProductRow = {
          key: `d-${detail.id}`,
          productName: detail.productName,
          productCode: detail.productCode,
          model: detail.model,
          quantity: detail.quantity,
          unit: detail.unit,
          pricingQuantity: detail.pricingQuantity,
          unitPrice: detail.unitPrice,
          amount: detail.amount,
          note: detail.note,
        };
        if (hasProductData(child)) products.push(child);
      }
    }

    const goodsTotal = products.reduce((sum, product) => sum + resolvedLineAmount(product), 0);
    const shippingFee = toNumber(order.shippingFee) ?? 0;
    const total = toNumber(order.subtotal) ?? roundMoney(goodsTotal + shippingFee);
    const discountPercent = toNumber(order.discountPercent) ?? 0;
    const discountAmount = toNumber(order.discountAmount) ?? roundMoney((total * discountPercent) / 100);
    const afterDiscount = toNumber(order.totalAfterDiscount) ?? roundMoney(Math.max(0, total - discountAmount));
    const deposit = toNumber(order.depositAmount) ?? 0;
    const warehouseDeduction = toNumber(order.warehouseReceiptDeduction) ?? 0;
    const remaining = toNumber(order.deliveryPayment) ?? roundMoney(Math.max(0, afterDiscount - deposit - warehouseDeduction));

    return {
      order,
      products,
      total,
      discountPercent,
      discountAmount,
      afterDiscount,
      deposit,
      remaining,
    };
  });

  const summary = reportRows.reduce(
    (acc, row) => ({
      total: acc.total + row.total,
      discountAmount: acc.discountAmount + row.discountAmount,
      afterDiscount: acc.afterDiscount + row.afterDiscount,
      deposit: acc.deposit + row.deposit,
      remaining: acc.remaining + row.remaining,
    }),
    { total: 0, discountAmount: 0, afterDiscount: 0, deposit: 0, remaining: 0 },
  );

  const productRevenueRows = buildProductRevenue(reportRows, masterProducts);
  // V106: số cho dòng "TỔNG CỘNG" cuối bảng (bảng đơn + bảng sản phẩm).
  const summaryDiscountPercent = summary.total > 0 ? (summary.discountAmount / summary.total) * 100 : 0;
  const productRevenueTotal = productRevenueRows.reduce((sum, row) => sum + row.revenue, 0);
  const dealers = buildDealerOptions(filterSource);
  const customers: string[] = Array.from(
    new Set<string>(filterSource.map((row) => clean(row.receiverName)).filter(Boolean)),
  ).sort((a, b) => a.localeCompare(b, "vi"));

  return (
    <ErpShell title="Theo dõi doanh thu">
      {/* V106: thanh lọc xếp theo lưới 12 cột, cùng kiểu với tab Quản lý đơn hàng. */}
      <form method="GET" className="erp-card mt-5 px-3 py-3">
        <div className="grid grid-cols-1 gap-x-3 gap-y-2.5 sm:grid-cols-2 xl:grid-cols-12">
          <FilterField className="xl:col-span-2" label="Ngày">
            <input className="erp-input mt-1 h-9" type="date" name="date" defaultValue={clean(query.date)} />
          </FilterField>
          <FilterField className="xl:col-span-2" label="Tháng">
            <input className="erp-input mt-1 h-9" type="month" name="month" defaultValue={clean(query.month)} />
          </FilterField>
          <FilterField className="xl:col-span-2" label="Năm">
            <input className="erp-input mt-1 h-9" type="number" name="year" min={2000} max={2100} inputMode="numeric" defaultValue={clean(query.year)} />
          </FilterField>
          <FilterField className="xl:col-span-3" label="Từ ngày">
            <input className="erp-input mt-1 h-9" type="date" name="from" defaultValue={clean(query.from)} />
          </FilterField>
          <FilterField className="xl:col-span-3" label="Đến ngày">
            <input className="erp-input mt-1 h-9" type="date" name="to" defaultValue={clean(query.to)} />
          </FilterField>
          <FilterField className="xl:col-span-3" label="Đại lý">
            <select className="erp-input mt-1 h-9" name="dealer" defaultValue={clean(query.dealer)}>
              <option value="">Tất cả đại lý</option>
              {dealers.map((dealer) => (
                <option key={dealer.value} value={dealer.value}>{dealer.label}</option>
              ))}
            </select>
          </FilterField>
          <FilterField className="xl:col-span-3" label="Khách hàng">
            <select className="erp-input mt-1 h-9" name="customer" defaultValue={customerFilter}>
              <option value="">Tất cả khách hàng</option>
              {customers.map((customer) => (
                <option key={customer} value={customer}>{customer}</option>
              ))}
            </select>
          </FilterField>
          <div className="flex flex-wrap items-center gap-2 self-end sm:col-span-2 xl:col-span-6 xl:justify-end">
            <button type="submit" className="erp-button h-9 px-3.5 text-[12px]">Lọc</button>
            <Link className="erp-button-secondary flex h-9 items-center px-3.5 text-[12px]" href="/revenue">Xoá lọc</Link>
            <a className="inline-flex h-9 items-center rounded-lg border border-emerald-700 bg-emerald-600 px-3.5 text-[12px] font-semibold text-white transition hover:bg-emerald-500" href={buildRevenueExportHref(query)}>
              ⤓ Xuất Excel doanh thu
            </a>
          </div>
        </div>
      </form>

      {/* 5 ô tổng — cùng kiểu ô tổng hợp với tab Quản lý đơn hàng */}
      <section className="mt-4 grid gap-2.5 sm:grid-cols-2 xl:grid-cols-5">
        <Metric title="Tổng tiền đơn hàng" value={formatMoney(summary.total)} />
        <Metric title="Chiết khấu" value={formatMoney(summary.discountAmount)} />
        <Metric title="Tổng sau chiết khấu" value={formatMoney(summary.afterDiscount)} />
        <Metric title="Đặt cọc" value={formatMoney(summary.deposit)} />
        <Metric title="Còn lại" value={formatMoney(summary.remaining)} emphasis />
      </section>

      <section className="erp-card mt-4 overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 px-4 py-3">
          <div>
            <h2 className="text-[13px] font-bold text-slate-900">Theo dõi doanh thu theo đơn hàng</h2>
            <p className="mt-0.5 text-[11px] text-slate-500">Chỉ tính đơn đã vào sản xuất — đơn hàng mẫu và đơn đã hủy không tính doanh thu.</p>
          </div>
          <span className="text-[11px] text-slate-500">
            <b className="tabular-nums text-slate-900">{reportRows.length}</b> đơn
          </span>
        </div>

        <div className="erp-scrollbar overflow-x-auto">
          <table className="erp-table erp-table-full">
            <colgroup>
              {[4, 8, 7, 12, 12, 7, 11, 10, 12, 8, 9].map((width, index) => (
                <col key={index} style={{ width: `${width}%` }} />
              ))}
            </colgroup>
            <thead>
              <tr>
                <th className="text-center">STT</th>
                <th className="text-center">Ngày</th>
                <th>Mã ĐL</th>
                <th>Tên ĐL</th>
                <th>Số ĐH</th>
                <th className="text-center">Loại ĐH</th>
                <th className="text-right">Tổng tiền</th>
                <th className="text-right">CK</th>
                <th className="text-right">Tổng tiền sau CK</th>
                <th className="text-right">Đặt cọc</th>
                <th className="text-right">Còn lại</th>
              </tr>
            </thead>
            <tbody>
              {reportRows.length === 0 ? (
                <tr>
                  <td className="py-10 text-center text-slate-500" colSpan={11}>Không có đơn đã vào sản xuất phù hợp bộ lọc.</td>
                </tr>
              ) : reportRows.map((row, index) => (
                <RevenueOrderRows key={row.order.id} row={row} index={index + 1} />
              ))}
            </tbody>
            {reportRows.length > 0 ? (
              <tfoot>
                <tr className="bg-slate-100 font-bold text-slate-900">
                  <td className="px-1.5 py-2 text-right" colSpan={6}>TỔNG CỘNG ({reportRows.length} đơn)</td>
                  <td className="erp-td-num px-1.5 py-2">{formatMoney(summary.total)}</td>
                  <td className="erp-td-num px-1.5 py-2">
                    <div>{formatPercent(summaryDiscountPercent)}</div>
                    <div className="text-[10.5px] font-semibold text-slate-600">{formatMoney(summary.discountAmount)}</div>
                  </td>
                  <td className="erp-td-num px-1.5 py-2">{formatMoney(summary.afterDiscount)}</td>
                  <td className="erp-td-num px-1.5 py-2">{formatMoney(summary.deposit)}</td>
                  <td className="erp-td-num px-1.5 py-2">{formatMoney(summary.remaining)}</td>
                </tr>
              </tfoot>
            ) : null}
          </table>
        </div>
      </section>

      <section className="erp-card mt-4 overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 px-4 py-3">
          <div>
            <h2 className="text-[13px] font-bold text-slate-900">Sản phẩm phát sinh doanh thu</h2>
            <p className="mt-0.5 text-[11px] text-slate-500">Gom theo danh mục hàng hóa của các đơn đã vào sản xuất.</p>
          </div>
          <span className="text-[11px] text-slate-500">
            <b className="tabular-nums text-slate-900">{productRevenueRows.length}</b> sản phẩm
          </span>
        </div>
        <div className="erp-scrollbar overflow-x-auto">
          <table className="erp-table erp-table-full">
            <colgroup>
              {[4, 15, 27, 15, 7, 7, 8, 8, 9].map((width, index) => (
                <col key={index} style={{ width: `${width}%` }} />
              ))}
            </colgroup>
            <thead>
              <tr>
                <th className="text-center">STT</th>
                <th>TENHANG</th>
                <th>Tên sản phẩm diễn giải</th>
                <th>MODEL</th>
                <th className="text-center">ĐVT</th>
                <th className="text-right">Số đơn</th>
                <th className="text-right">Tổng SL</th>
                <th className="text-right">Tổng KH/Lượng</th>
                <th className="text-right">Doanh thu</th>
              </tr>
            </thead>
            <tbody>
              {productRevenueRows.length === 0 ? (
                <tr>
                  <td className="py-10 text-center text-slate-500" colSpan={9}>Chưa có sản phẩm trong danh mục phát sinh doanh thu.</td>
                </tr>
              ) : productRevenueRows.map((row, index) => (
                <tr key={row.masterId}>
                  <td className="text-center tabular-nums">{index + 1}</td>
                  <td className="erp-td-strong">{row.name}</td>
                  <td>{row.productDescription || row.name}</td>
                  <td className="erp-td-strong">{row.code}</td>
                  <td className="text-center">{row.unit || "—"}</td>
                  <td className="erp-td-num">{formatNumber(row.orderIds.size)}</td>
                  <td className="erp-td-num">{formatDecimal(row.quantity)}</td>
                  <td className="erp-td-num">{formatDecimal(row.pricingQuantity)}</td>
                  <td className="erp-td-num font-bold text-slate-900">{formatMoney(row.revenue)}</td>
                </tr>
              ))}
            </tbody>
            {productRevenueRows.length > 0 ? (
              <tfoot>
                <tr className="bg-slate-100 font-bold text-slate-900">
                  <td className="px-1.5 py-2 text-right" colSpan={8}>TỔNG CỘNG ({productRevenueRows.length} sản phẩm)</td>
                  <td className="erp-td-num px-1.5 py-2">{formatMoney(productRevenueTotal)}</td>
                </tr>
              </tfoot>
            ) : null}
          </table>
        </div>
      </section>
    </ErpShell>
  );
}

function buildRevenueExportHref(query: RevenueQuery) {
  const params = new URLSearchParams();
  const values: Array<[keyof RevenueQuery, string]> = [
    ["date", clean(query.date)],
    ["month", clean(query.month)],
    ["year", clean(query.year)],
    ["from", clean(query.from)],
    ["to", clean(query.to)],
    ["dealer", clean(query.dealer)],
    ["customer", clean(query.customer)],
  ];
  for (const [key, value] of values) {
    if (value) params.set(key, value);
  }
  const qs = params.toString();
  return qs ? `/api/revenue/export?${qs}` : "/api/revenue/export";
}

function RevenueOrderRows({
  row,
  index,
}: {
  row: {
    order: {
      id: number;
      orderCode: string;
      /** V112: dùng để hiện cột "Loại ĐH" theo LOẠI ĐƠN thật của đơn. */
      orderType: string | null;
      status: string | null;
      customerCode: string | null;
      customerName: string | null;
      orderDate: Date | null;
    };
    products: ProductRow[];
    total: number;
    discountPercent: number;
    discountAmount: number;
    afterDiscount: number;
    deposit: number;
    remaining: number;
  };
  index: number;
}) {
  return (
    <tr>
      <td className="text-center tabular-nums">{index}</td>
      <td className="text-center">{formatDate(row.order.orderDate)}</td>
      <td className="erp-td-strong">{row.order.customerCode || "—"}</td>
      <td>{row.order.customerName || "—"}</td>
      <td>
        <Link className="font-semibold text-cyan-700 hover:underline" href={`/orders/${row.order.id}`}>
          {row.order.orderCode}
        </Link>
      </td>
      <td className="text-center">
        <StatusTag value={row.order.orderType} />
      </td>
      <td className="erp-td-num font-semibold text-slate-900">{formatMoney(row.total)}</td>
      <td className="erp-td-num">
        <div className="font-semibold text-slate-900">{formatPercent(row.discountPercent)}</div>
        <div className="text-[10.5px] text-slate-500">{formatMoney(row.discountAmount)}</div>
      </td>
      <td className="erp-td-num font-semibold text-slate-900">{formatMoney(row.afterDiscount)}</td>
      <td className="erp-td-num">{formatMoney(row.deposit)}</td>
      <td className="erp-td-num font-bold text-slate-900">{formatMoney(row.remaining)}</td>
    </tr>
  );
}

function FilterField({ label, className = "", children }: { label: string; className?: string; children: React.ReactNode }) {
  return (
    <label className={`min-w-0 ${className}`}>
      <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{label}</span>
      {children}
    </label>
  );
}

function Metric({ title, value, emphasis = false }: { title: string; value: string; emphasis?: boolean }) {
  return (
    <div className={`rounded-lg border px-3 py-2 ${emphasis ? "border-cyan-200 bg-cyan-50" : "border-slate-200 bg-white shadow-sm"}`}>
      <div className="text-[9.5px] font-bold uppercase tracking-wide text-slate-500">{title}</div>
      <div className="mt-0.5 text-[15px] font-bold tabular-nums text-slate-900">{value}</div>
    </div>
  );
}

function buildProductRevenue(
  reportRows: Array<{
    order: { id: number };
    products: ProductRow[];
  }>,
  masterProducts: MasterProduct[],
) {
  const masterMap = new Map<string, MasterProduct>();
  for (const item of masterProducts) {
    masterMap.set(normalizeCode(item.code), item);
    const salesModel = normalizeCode(item.salesModel);
    if (salesModel && !masterMap.has(salesModel)) masterMap.set(salesModel, item);
  }

  const aggregate = new Map<number, ProductRevenueRow>();

  for (const report of reportRows) {
    for (const product of report.products) {
      const revenue = resolvedLineAmount(product);
      if (revenue <= 0) continue;

      const master = resolveMasterProduct(product, masterMap);
      if (!master) continue;

      const current = aggregate.get(master.id) ?? {
        masterId: master.id,
        code: master.code,
        name: master.name,
        productDescription: master.productDescription,
        unit: master.unit,
        orderIds: new Set<number>(),
        quantity: 0,
        pricingQuantity: 0,
        revenue: 0,
      };

      current.orderIds.add(report.order.id);
      current.quantity += toNumber(product.quantity) ?? 0;
      current.pricingQuantity += toNumber(product.pricingQuantity) ?? 0;
      current.revenue += revenue;
      aggregate.set(master.id, current);
    }
  }

  return Array.from(aggregate.values()).sort((a, b) => {
    if (b.revenue !== a.revenue) return b.revenue - a.revenue;
    return a.code.localeCompare(b.code, "vi");
  });
}

function resolveMasterProduct(product: ProductRow, masterMap: Map<string, MasterProduct>) {
  const candidates = [product.productCode, product.model];
  for (const candidate of candidates) {
    const key = normalizeCode(candidate);
    if (!key) continue;
    const found = masterMap.get(key);
    if (found) return found;
  }
  return null;
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

function resolveDateFilter(query: RevenueQuery) {
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

function hasProductData(product: ProductRow) {
  const identity = [product.productName, product.productCode, product.model].some((value) => clean(value));
  const numeric = [product.pricingQuantity, product.quantity].some((value) => typeof value === "number" && value !== 0);
  const money = [product.unitPrice, product.amount].some((value) => (toNumber(value) ?? 0) !== 0);
  if (!identity && !numeric && !money) return false;
  if (clean(product.productName).toLocaleLowerCase("vi-VN") === "khác" && !clean(product.productCode) && !clean(product.model) && !numeric && !money) return false;
  return true;
}

function resolvedLineAmount(product: ProductRow) {
  const explicit = toNumber(product.amount);
  if (explicit !== null) return explicit;
  const pricingQuantity = toNumber(product.pricingQuantity);
  const unitPrice = toNumber(product.unitPrice);
  if (pricingQuantity === null || unitPrice === null) return 0;
  return roundMoney(pricingQuantity * unitPrice);
}

function normalizeCode(value: unknown) {
  return clean(value).toLocaleUpperCase("vi-VN").replace(/\s+/g, "");
}

function clean(value: unknown) {
  if (value === null || value === undefined) return "";
  const text = String(value).trim();
  return text === "-" || text === "—" ? "" : text;
}

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(String(value).replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/**
 * V112: cột "Loại ĐH" lấy đúng trường LOẠI ĐƠN của đơn (Sản xuất / Đơn hàng mẫu / Đơn làm lại).
 */
function StatusTag({ value }: { value: string | null | undefined }) {
  const label = orderTypeLabel(value);
  const style = label === "Sản xuất"
    ? "border-emerald-300 bg-emerald-50 text-emerald-800"
    : label === "Đơn làm lại"
      ? "border-violet-300 bg-violet-50 text-violet-800"
      : "border-slate-300 bg-slate-100 text-slate-700";
  return (
    <span className={`inline-flex items-center whitespace-nowrap rounded border px-1.5 py-0.5 text-[9px] font-bold 2xl:text-[10px] ${style}`}>
      {label}
    </span>
  );
}

function formatDate(value: Date | null) {
  return value ? new Intl.DateTimeFormat("vi-VN").format(value) : "—";
}

function formatMoney(value: unknown) {
  const n = toNumber(value);
  return n === null ? "—" : `${new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 0 }).format(n)} đ`;
}

function formatPercent(value: number) {
  return `${new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 2 }).format(value)}%`;
}

function formatNumber(value: unknown) {
  const n = toNumber(value);
  return n === null ? "—" : new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 0 }).format(n);
}

function formatDecimal(value: unknown) {
  const n = toNumber(value);
  return n === null ? "—" : new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 4 }).format(n);
}
