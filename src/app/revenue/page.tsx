import Link from "next/link";
import { ErpShell } from "@/components/erp-shell";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

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
  const dealers = buildDealerOptions(filterSource);
  const customers: string[] = Array.from(
    new Set<string>(filterSource.map((row) => clean(row.receiverName)).filter(Boolean)),
  ).sort((a, b) => a.localeCompare(b, "vi"));

  return (
    <ErpShell title="Theo dõi doanh thu">
      <section className="erp-card p-4">
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
            <Link href="/revenue" className="erp-button-secondary flex h-10 flex-1 items-center justify-center">Xóa lọc</Link>
          </div>
        </form>
      </section>

      <section className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <Metric title="Tổng tiền đơn hàng" value={formatMoney(summary.total)} />
        <Metric title="Tổng tiền chiết khấu" value={formatMoney(summary.discountAmount)} />
        <Metric title="Tổng tiền sau CK" value={formatMoney(summary.afterDiscount)} />
        <Metric title="Tổng đặt cọc" value={formatMoney(summary.deposit)} />
        <Metric title="Tổng còn lại" value={formatMoney(summary.remaining)} />
      </section>

      <section className="erp-card mt-6 overflow-hidden">
        <div className="border-b border-slate-200 bg-slate-50 px-5 py-4">
          <h2 className="font-bold">Theo dõi doanh thu theo đơn hàng</h2>
        </div>

        <div className="w-full overflow-hidden">
          <table className="w-full table-fixed border-collapse text-[10px] 2xl:text-xs">
            <colgroup>
              {[4, 8, 7, 12, 12, 7, 11, 10, 12, 8, 9].map((width, index) => (
                <col key={index} style={{ width: `${width}%` }} />
              ))}
            </colgroup>
            <thead className="bg-[#a9bee1] text-center text-slate-950">
              <tr>
                <Th>STT</Th>
                <Th>Ngày</Th>
                <Th>Mã ĐL</Th>
                <Th>Tên ĐL</Th>
                <Th>Số ĐH</Th>
                <Th>Loại ĐH</Th>
                <Th>Tổng Tiền</Th>
                <Th>CK</Th>
                <Th>Tổng tiền sau CK</Th>
                <Th>Đặt Cọc</Th>
                <Th>Còn Lại</Th>
              </tr>
            </thead>
            <tbody className="bg-white">
              {reportRows.length === 0 ? (
                <tr>
                  <td className="px-4 py-12 text-center text-slate-500" colSpan={11}>Không có đơn hàng phù hợp bộ lọc.</td>
                </tr>
              ) : reportRows.map((row, index) => (
                <RevenueOrderRows key={row.order.id} row={row} index={index + 1} />
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="erp-card mt-6 overflow-hidden">
        <div className="border-b border-slate-200 bg-slate-50 px-5 py-4">
          <h2 className="font-bold">Sản phẩm phát sinh doanh thu</h2>
        </div>
        <div className="w-full overflow-hidden">
          <table className="w-full table-fixed border-collapse text-[10px] 2xl:text-xs">
            <colgroup>
              {[4, 15, 27, 15, 7, 7, 8, 8, 9].map((width, index) => (
                <col key={index} style={{ width: `${width}%` }} />
              ))}
            </colgroup>
            <thead className="bg-[#a9bee1] text-center text-slate-950">
              <tr>
                <Th>STT</Th>
                <Th>TENHANG</Th>
                <Th>Tên sản phẩm diễn giải</Th>
                <Th>MODEL</Th>
                <Th>ĐVT</Th>
                <Th>Số đơn</Th>
                <Th>Tổng SL</Th>
                <Th>Tổng KH/Lượng</Th>
                <Th>Doanh thu</Th>
              </tr>
            </thead>
            <tbody className="bg-white">
              {productRevenueRows.length === 0 ? (
                <tr>
                  <td className="px-4 py-12 text-center text-slate-500" colSpan={9}>Chưa có sản phẩm trong danh mục phát sinh doanh thu.</td>
                </tr>
              ) : productRevenueRows.map((row, index) => (
                <tr key={row.masterId} className="border-t border-slate-300 hover:bg-cyan-50/60">
                  <Td className="text-center">{index + 1}</Td>
                  <Td>{row.name}</Td>
                  <Td>{row.productDescription || row.name}</Td>
                  <Td className="font-semibold">{row.code}</Td>
                  <Td className="text-center">{row.unit || "—"}</Td>
                  <Td className="text-right">{formatNumber(row.orderIds.size)}</Td>
                  <Td className="text-right">{formatDecimal(row.quantity)}</Td>
                  <Td className="text-right">{formatDecimal(row.pricingQuantity)}</Td>
                  <Td className="text-right font-bold">{formatMoney(row.revenue)}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </ErpShell>
  );
}

function RevenueOrderRows({
  row,
  index,
}: {
  row: {
    order: {
      id: number;
      orderCode: string;
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
    <tr className="border-t border-slate-300 bg-white align-top hover:bg-cyan-50/60">
      <Td className="text-center">{index}</Td>
      <Td className="text-center">{formatDate(row.order.orderDate)}</Td>
      <Td className="font-semibold">{row.order.customerCode || "—"}</Td>
      <Td>{row.order.customerName || "—"}</Td>
      <Td>
        <Link className="font-semibold text-cyan-700 hover:underline" href={`/orders/${row.order.id}`}>
          {row.order.orderCode}
        </Link>
      </Td>
      <Td className="text-center">Sản xuất</Td>
      <Td className="text-right font-semibold">{formatMoney(row.total)}</Td>
      <Td className="text-right">
        <div className="font-bold">{formatPercent(row.discountPercent)}</div>
        <div className="mt-0.5 text-[9px] text-slate-500 2xl:text-[10px]">{formatMoney(row.discountAmount)}</div>
      </Td>
      <Td className="text-right font-semibold">{formatMoney(row.afterDiscount)}</Td>
      <Td className="text-right">{formatMoney(row.deposit)}</Td>
      <Td className="text-right font-bold">{formatMoney(row.remaining)}</Td>
    </tr>
  );
}

function FilterField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-slate-600">{label}</span>
      {children}
    </label>
  );
}

function Metric({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-medium text-slate-500">{title}</p>
      <p className="mt-2 text-xl font-bold text-slate-950">{value}</p>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="break-words border border-slate-500 px-1 py-2 font-bold leading-tight">{children}</th>;
}

function Td({ children, className = "" }: { children?: React.ReactNode; className?: string }) {
  return <td className={`break-words border border-slate-300 px-1.5 py-2 leading-tight ${className}`}>{children}</td>;
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
