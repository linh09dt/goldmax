import Link from "next/link";
import { ErpShell } from "@/components/erp-shell";
import { prisma } from "@/lib/prisma";
import { clean, parseDealerFilter, resolveDatePreset } from "@/lib/order-list-filters";
import { buildDashboard, type DashboardOrder, type KpiBlock } from "@/lib/dashboard";
import { AttentionCard, BreakdownCard, KpiCard, MoneyFootnote, RankCard, TrendChart } from "@/components/dashboard/dashboard-ui";
import { formatMoneyShort, formatNumber } from "@/components/order-list/format";
import { ORDER_TYPE_OPTIONS } from "@/lib/order-form";

export const dynamic = "force-dynamic";

/**
 * V113 — Tab Tổng quan (dashboard báo cáo bán hàng).
 *
 * Nguyên tắc:
 *  - Số liệu bám đúng nghiệp vụ V112: DOANH THU = đơn loại "Sản xuất" + trạng thái "Đã xác nhận";
 *    đơn hàng mẫu / đơn làm lại / đơn nháp vẫn hiện ở cơ cấu & khối lượng nhưng không vào doanh thu.
 *  - Chỉ 3 lượt truy vấn DB: (1) kỳ đang xem + kỳ trước liền kề trong cùng một lần lấy dữ liệu,
 *    (2) 12 tháng cho biểu đồ, (3) danh sách đại lý cho bộ lọc. DB đang ở xa (~40–100 ms/lượt) nên
 *    số lượt truy vấn là thứ phải giữ thấp (xem V111).
 *  - Bộ lọc dùng lại `resolveDatePreset` + `parseDealerFilter` của màn Quản lý đơn hàng để hai nơi
 *    lọc giống nhau.
 */

const RANGE_PRESETS = [
  { value: "today", label: "Hôm nay" },
  { value: "week", label: "Tuần này" },
  { value: "month", label: "Tháng này" },
  { value: "quarter", label: "Quý này" },
  { value: "year", label: "Năm nay" },
  { value: "all", label: "Tất cả" },
] as const;

type DashboardQuery = {
  range?: string;
  from?: string;
  to?: string;
  dealer?: string;
  type?: string;
  status?: string;
  /** V130: trạng thái nháp/đã xác nhận (dùng cho drill-down). */
  state?: string;
};

const ORDER_INCLUDE = {
  items: {
    orderBy: { lineNo: "asc" as const },
    include: { details: { orderBy: { rowOrder: "asc" as const } } },
  },
};

function queryString(base: DashboardQuery, patch: Partial<DashboardQuery>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries({ ...base, ...patch })) {
    const text = clean(value);
    if (text) params.set(key, text);
  }
  const text = params.toString();
  return text ? `?${text}` : "";
}

export default async function Home({ searchParams }: { searchParams: Promise<DashboardQuery> }) {
  const query = await searchParams;
  const rangeKey = clean(query.range) || "year";
  const preset = rangeKey === "all" ? null : resolveDatePreset(rangeKey);
  const from = preset?.from ?? clean(query.from) ?? "";
  const to = preset?.to ?? clean(query.to) ?? "";
  const fromDate = from ? new Date(`${from}T00:00:00.000Z`) : null;
  const toDate = to ? new Date(`${to}T00:00:00.000Z`) : null;

  // Kỳ trước liền kề (cùng độ dài) để tính % tăng/giảm.
  let previousFrom: Date | null = null;
  // V130: cùng kỳ năm trước (lùi đúng 1 năm) để tính tăng trưởng.
  let priorFrom: Date | null = null;
  let priorTo: Date | null = null;
  if (fromDate && toDate) {
    const spanMs = toDate.getTime() - fromDate.getTime() + 86_400_000;
    previousFrom = new Date(fromDate.getTime() - spanMs);
    priorFrom = new Date(Date.UTC(fromDate.getUTCFullYear() - 1, fromDate.getUTCMonth(), fromDate.getUTCDate()));
    priorTo = new Date(Date.UTC(toDate.getUTCFullYear() - 1, toDate.getUTCMonth(), toDate.getUTCDate()));
  }
  const rangeStart = [previousFrom, priorFrom].filter((value): value is Date => Boolean(value)).reduce<Date | null>(
    (earliest, value) => (!earliest || value < earliest ? value : earliest),
    null,
  );

  const dealerFilter = parseDealerFilter(clean(query.dealer));
  const typeFilter = ORDER_TYPE_OPTIONS.some((option) => option.value === clean(query.type)) ? clean(query.type) : "";
  const statusFilter = ["NHAP", "DA_XAC_NHAN"].includes(clean(query.status)) ? clean(query.status) : "";

  const commonWhere = {
    ...(dealerFilter
      ? dealerFilter.kind === "code"
        ? { customerCode: dealerFilter.value }
        : { customerName: dealerFilter.value }
      : {}),
    ...(typeFilter ? { orderType: typeFilter } : {}),
    ...(statusFilter ? { status: statusFilter } : {}),
  };

  const today = new Date();
  const trendEnd = toDate ?? today;
  const trendStart = new Date(Date.UTC(trendEnd.getUTCFullYear(), trendEnd.getUTCMonth() - 11, 1));

  // (1) Kỳ đang xem + kỳ trước chung 1 truy vấn; (2) 12 tháng cho biểu đồ; (3) đại lý cho bộ lọc.
  const [rangeOrders, trendOrders, dealerRows] = await Promise.all([
    prisma.salesOrder.findMany({
      where: {
        ...commonWhere,
        ...(rangeStart || fromDate || toDate
          ? {
              orderDate: {
                ...(rangeStart || fromDate ? { gte: rangeStart ?? fromDate ?? undefined } : {}),
                ...(toDate ? { lte: toDate } : {}),
              },
            }
          : {}),
      },
      orderBy: [{ orderDate: "desc" }, { id: "desc" }],
      include: ORDER_INCLUDE,
    }),
    prisma.salesOrder.findMany({
      where: { ...commonWhere, orderDate: { gte: trendStart, lte: trendEnd } },
      orderBy: [{ orderDate: "asc" }],
      include: ORDER_INCLUDE,
    }),
    prisma.salesOrder.findMany({
      distinct: ["customerCode"],
      select: { customerCode: true, customerName: true },
      orderBy: { customerCode: "asc" },
    }),
  ]);

  const current = previousFrom
    ? rangeOrders.filter((order) => order.orderDate && order.orderDate >= (fromDate ?? previousFrom))
    : rangeOrders;
  // Chặn dưới bằng previousFrom vì truy vấn đã được mở rộng tới tận priorFrom (1 năm trước).
  const previous = previousFrom
    ? rangeOrders.filter(
        (order) =>
          order.orderDate &&
          order.orderDate >= previousFrom &&
          order.orderDate < (fromDate ?? previousFrom),
      )
    : [];
  const priorYearOrders =
    priorFrom && priorTo
      ? rangeOrders.filter((order) => order.orderDate && order.orderDate >= priorFrom && order.orderDate <= priorTo)
      : undefined;

  const periodLabel = rangeKey === "all"
    ? "tất cả các kỳ"
    : `${from ? new Date(from).toLocaleDateString("vi-VN", { timeZone: "UTC" }) : "…"} – ${to ? new Date(to).toLocaleDateString("vi-VN", { timeZone: "UTC" }) : "…"}`;

  const dashboard = buildDashboard(current as unknown as DashboardOrder[], {
    previousOrders: previous as unknown as DashboardOrder[],
    priorYearOrders: priorYearOrders as unknown as DashboardOrder[] | undefined,
    monthsWindow: trendOrders as unknown as DashboardOrder[],
    today,
    periodLabel,
    from: fromDate,
    to: toDate,
  });

  const kpis: KpiBlock[] = [
    {
      label: "Doanh thu",
      value: formatMoneyShort(dashboard.kpis.revenue),
      hint: `Đơn Sản xuất đã xác nhận · ${
        dashboard.kpis.revenueDelta === null ? "chưa có kỳ trước" : "so với kỳ trước liền kề"
      }${dashboard.kpis.revenueYoYDelta === null ? "" : ` · cùng kỳ năm trước ${dashboard.kpis.revenueYoYDelta >= 0 ? "+" : ""}${dashboard.kpis.revenueYoYDelta.toFixed(1)}%`}`,
      tone: "good",
      deltaPercent: dashboard.kpis.revenueDelta,
    },
    {
      label: "Đơn đã xác nhận",
      value: formatNumber(dashboard.kpis.confirmedOrders),
      hint: `${formatNumber(dashboard.kpis.confirmedSets)} bộ cửa · tỉ lệ xác nhận ${dashboard.kpis.confirmedShare.toFixed(0)}%`,
      tone: "neutral",
      deltaPercent: null,
    },
    {
      label: "Đơn nháp cần xử lý",
      value: formatNumber(dashboard.kpis.draftOrders),
      hint: `Giá trị tạm tính ${formatMoneyShort(dashboard.kpis.draftValue)} · chưa có Bộ số`,
      tone: dashboard.kpis.draftOrders > 0 ? "warn" : "neutral",
      deltaPercent: null,
    },
    {
      label: "Còn phải thu",
      value: formatMoneyShort(dashboard.kpis.receivable),
      hint: "Tổng thanh toán khi giao hàng của đơn đã xác nhận",
      tone: "neutral",
      deltaPercent: null,
    },
    {
      label: "Đơn quá hạn giao",
      value: formatNumber(dashboard.kpis.overdueCount),
      hint: "Đã xác nhận nhưng quá ngày cần giao",
      tone: dashboard.kpis.overdueCount > 0 ? "bad" : "good",
      deltaPercent: null,
    },
    {
      label: "Sản lượng",
      value: `${formatNumber(Math.round(dashboard.kpis.volume))} m²`,
      hint: `Giá trị đơn trung bình ${formatMoneyShort(dashboard.kpis.avgOrderValue)}`,
      tone: "neutral",
      deltaPercent: null,
    },
  ];

  const kpiHrefs: Record<string, string> = {
    "Doanh thu": `/orders${queryString({ from, to, dealer: clean(query.dealer) }, { type: "san_xuat", state: "da_xac_nhan" })}`,
    "Đơn đã xác nhận": `/orders${queryString({ from, to, dealer: clean(query.dealer) }, { state: "da_xac_nhan" })}`,
    "Đơn nháp cần xử lý": `/orders${queryString({ from, to, dealer: clean(query.dealer) }, { state: "nhap" })}`,
    "Còn phải thu": "/reports/receivables",
    "Đơn quá hạn giao": "/reports/production-load",
    "Sản lượng": "/reports/products",
  };

  const dealerOptions = dealerRows
    .map((row) => {
      const code = clean(row.customerCode);
      const name = clean(row.customerName);
      if (!code && !name) return null;
      return { value: code ? `C:${code}` : `N:${name}`, label: code && name ? `${code} - ${name}` : code || name };
    })
    .filter((row): row is { value: string; label: string } => Boolean(row))
    .sort((a, b) => a.label.localeCompare(b.label, "vi"));

  const ordersHref = `/orders${queryString({ from, to, dealer: clean(query.dealer) }, {})}`;
  const selectClass = "erp-input h-8 py-0 text-[11.5px]";

  return (
    <ErpShell
      title="Tổng quan"
      subtitle={`Báo cáo bán hàng · kỳ đang xem: ${periodLabel}`}
      actions={<Link className="erp-button-secondary" href="/orders/new">+ Tạo đơn hàng</Link>}
    >
      <div className="space-y-3">
        {/* Bộ lọc dùng chung cho cả trang */}
        <section className="erp-card flex flex-nowrap items-end gap-2 px-2.5 py-2">
          {/* V130.1: 1 DÒNG — vùng ô lọc cuộn ngang, nút ghim bên phải luôn hiển thị. */}
          <div className="erp-scrollbar flex min-w-0 flex-1 flex-nowrap items-end gap-2 overflow-x-auto pb-0.5">
            <div className="flex shrink-0 items-center gap-1">
              {RANGE_PRESETS.map((presetItem) => {
                const active = rangeKey === presetItem.value;
                return (
                  <Link
                    key={presetItem.value}
                    href={`/${queryString(query, { range: presetItem.value, from: "", to: "" })}`}
                    className={`inline-flex h-8 items-center whitespace-nowrap rounded-md border px-2.5 text-[11.5px] font-semibold transition ${
                      active ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
                    }`}
                  >
                    {presetItem.label}
                  </Link>
                );
              })}
            </div>
            <form id="dashboard-filter" className="flex min-w-max flex-nowrap items-end gap-2" action="/" method="get">
              <input type="hidden" name="range" value={rangeKey === "all" ? "all" : "custom"} />
              <label className="shrink-0 self-center whitespace-nowrap text-[10px] font-semibold uppercase tracking-wide text-slate-500">Từ</label>
              <input className={selectClass} style={{ width: 118 }} type="date" name="from" defaultValue={from} />
              <label className="shrink-0 self-center whitespace-nowrap text-[10px] font-semibold uppercase tracking-wide text-slate-500">Đến</label>
              <input className={selectClass} style={{ width: 118 }} type="date" name="to" defaultValue={to} />
              <select className={selectClass} style={{ width: 160 }} name="dealer" defaultValue={clean(query.dealer)}>
                <option value="">Tất cả đại lý</option>
                {dealerOptions.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
              <select className={selectClass} style={{ width: 132 }} name="type" defaultValue={typeFilter}>
                <option value="">Tất cả loại đơn</option>
                {ORDER_TYPE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
              <select className={selectClass} style={{ width: 124 }} name="status" defaultValue={statusFilter}>
                <option value="">Cả 2 trạng thái</option>
                <option value="DA_XAC_NHAN">Đã xác nhận</option>
                <option value="NHAP">Đơn nháp</option>
              </select>
            </form>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button className="erp-button h-8 whitespace-nowrap px-3 text-[11.5px]" type="submit" form="dashboard-filter">Lọc</button>
            <Link className="erp-button-secondary flex h-8 items-center whitespace-nowrap px-3 text-[11.5px]" href="/">Xoá lọc</Link>
            <Link className="erp-button-secondary flex h-8 items-center whitespace-nowrap px-3 text-[11.5px]" href={ordersHref}>Mở trong Quản lý đơn hàng</Link>
          </div>
        </section>

        {/* Dải KPI */}
        <section className="grid grid-cols-2 gap-2.5 md:grid-cols-3 xl:grid-cols-6">
          {kpis.map((kpi) => (
            <KpiCard key={kpi.label} kpi={kpi} href={kpiHrefs[kpi.label]} />
          ))}
        </section>

        {/* Xu hướng + cơ cấu */}
        <section className="grid gap-2.5 xl:grid-cols-[1.55fr_1fr]">
          <div className="erp-card p-3">
            <div className="flex items-baseline justify-between">
              <h2 className="erp-section-title">Doanh thu theo tháng</h2>
              <span className="erp-hint">12 tháng gần nhất</span>
            </div>
            <TrendChart months={dashboard.months} />
          </div>
          <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-1">
            <BreakdownCard
              title="Cơ cấu theo loại đơn"
              hint="Giá trị đơn của cả 2 trạng thái · chỉ đơn Sản xuất đã xác nhận vào doanh thu"
              rows={dashboard.byType}
              tone="type"
            />
            <BreakdownCard
              title="Theo trạng thái"
              hint="Lưu nháp = Đơn nháp · Lưu đơn hàng = Đã xác nhận"
              rows={dashboard.byStatus}
              tone="status"
            />
          </div>
        </section>

        {/* Xếp hạng */}
        <section className="grid gap-2.5 lg:grid-cols-3">
          <RankCard
            title="Top đại lý"
            hint="Theo doanh thu đơn Sản xuất đã xác nhận"
            rows={dashboard.topDealers}
            emptyText="Chưa có đơn Sản xuất đã xác nhận trong kỳ"
            hrefFor={(row) => `/orders?q=${encodeURIComponent(row.key)}`}
          />
          <RankCard
            title="Top NVKD"
            hint="Theo doanh thu đơn Sản xuất đã xác nhận"
            rows={dashboard.topEmployees}
            emptyText="Chưa có dữ liệu"
            hrefFor={(row) => `/reports/sales-performance?sales=${encodeURIComponent(row.key)}`}
          />
          <RankCard
            title="Top sản phẩm / Model"
            hint="Theo thành tiền dòng hàng (gồm phụ kiện)"
            rows={dashboard.topProducts}
            unitLabel="đơn vị"
            emptyText="Chưa có dòng hàng nào có KH/Lượng"
          />
        </section>

        <AttentionCard rows={dashboard.attention} />

        <MoneyFootnote
          revenue={dashboard.kpis.revenue}
          receivable={dashboard.kpis.receivable}
          volume={dashboard.kpis.volume}
        />
      </div>
    </ErpShell>
  );
}
