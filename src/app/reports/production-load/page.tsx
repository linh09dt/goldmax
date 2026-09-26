import Link from "next/link";
import { ErpShell } from "@/components/erp-shell";
import { BarList, ReportCard, ReportFilterBar, ReportKpi, reportKpiGrid } from "@/components/reports/report-ui";
import { buildProductionLoad } from "@/lib/reporting";
import { buildOrderListWhere, type OrderListQuery } from "@/lib/order-list-filters";
import { CONFIRMED_WHERE, buildReportExportHref, loadReportFilterOptions, loadReportOrders, resolveReportQuery } from "@/lib/report-data";
import { formatDate, formatMoney, formatMoneyShort, formatNumber } from "@/components/order-list/format";

export const dynamic = "force-dynamic";

/** V130 — Tải sản xuất theo tuần: 8 tuần tới + đơn quá hạn, chỉ tính đơn đã xác nhận. */
export default async function ProductionLoadPage({ searchParams }: { searchParams: Promise<OrderListQuery> }) {
  const params = await searchParams;
  const query = resolveReportQuery(params);
  const base = buildOrderListWhere(query).where;
  // Tải sản xuất chỉ quan tâm đơn đã xác nhận — scope xác nhận luôn thắng bộ lọc trạng thái.
  const where = { ...base, ...CONFIRMED_WHERE };

  const [orders, options] = await Promise.all([loadReportOrders(where), loadReportFilterOptions()]);
  const report = buildProductionLoad(orders);
  const exportHref = buildReportExportHref("/api/reports/production-load/export", query);

  const bucketsWithItems = report.buckets.filter((bucket) => bucket.items.length > 0);

  return (
    <ErpShell
      title="Tải sản xuất theo tuần"
      subtitle="Đơn đã xác nhận xếp theo Ngày cần giao: các đơn quá hạn và 8 tuần tới."
    >
      <div className="space-y-3">
        <ReportFilterBar query={query} options={options} exportHref={exportHref} action="/reports/production-load" fields={["fromto", "dealer", "sales", "region"]} />

        <section className={reportKpiGrid}>
          <ReportKpi label="Đơn đã xác nhận có hạn giao" value={formatNumber(report.totals.orders)} hint="Nguồn cho tải sản xuất" tone="neutral" />
          <ReportKpi label="Tổng số bộ cửa" value={formatNumber(report.totals.sets)} hint="Số dòng có KH/Lượng" tone="neutral" />
          <ReportKpi label="Tổng KH/Lượng m²" value={formatNumber(Math.round(report.totals.volume))} hint="Σ KH/Lượng của dòng hàng" tone="neutral" />
          <ReportKpi label="Tổng giá trị" value={formatMoneyShort(report.totals.value)} hint="Giá trị đơn sau chiết khấu" tone="neutral" />
          <ReportKpi label="Đơn quá hạn" value={formatNumber(report.totals.overdue)} hint="Hạn giao trước hôm nay" tone={report.totals.overdue > 0 ? "bad" : "neutral"} />
          <ReportKpi label="Số tuần theo dõi" value="8" hint="tuần này + 7 tuần tới" tone="neutral" />
        </section>

        <ReportCard title="Khối lượng theo tuần" hint="Sản lượng (m²) đã xác nhận theo tuần giao" right={`${formatNumber(report.totals.orders)} đơn`}>
          <BarList
            rows={report.buckets.map((bucket) => ({
              key: bucket.key,
              label: bucket.label,
              value: bucket.volume,
              orders: bucket.orders,
              share: 0,
              tone: bucket.tone,
            }))}
            unit="đơn"
            formatValue={(value) => formatNumber(value as number)}
          />
        </ReportCard>

        <ReportCard title="Chi tiết từng tuần" hint="Mã đơn bấm để mở chi tiết" right={`${bucketsWithItems.length} nhóm`}>
          {bucketsWithItems.length === 0 ? (
            <p className="py-8 text-center text-[12px] text-slate-500">Không có đơn đã xác nhận nào có hạn giao trong phạm vi theo dõi.</p>
          ) : (
            <div className="space-y-4">
              {bucketsWithItems.map((bucket) => (
                <div key={bucket.key}>
                  <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-slate-200 pb-1.5">
                    <h3 className={`text-[12.5px] font-bold ${bucket.key === "overdue" ? "text-red-700" : "text-slate-900"}`}>{bucket.label}</h3>
                    <span className="text-[11px] tabular-nums text-slate-500">
                      {formatNumber(bucket.orders)} đơn · {formatNumber(bucket.sets)} bộ · {formatNumber(bucket.volume)} m² · {formatMoney(bucket.value)}
                    </span>
                  </div>
                  <div className="erp-scrollbar mt-1.5 overflow-x-auto">
                    <table className="erp-table">
                      <thead>
                        <tr>
                          <th>Mã đơn</th>
                          <th>Khách hàng</th>
                          <th>Hạn giao</th>
                          <th className="text-right">Số bộ</th>
                          <th className="text-right">KH/Lượng</th>
                          <th className="text-right">Giá trị</th>
                        </tr>
                      </thead>
                      <tbody>
                        {bucket.items.map((item) => (
                          <tr key={item.id}>
                            <td className="erp-td-strong">
                              <Link className="font-semibold text-cyan-700 hover:underline" href={`/orders/${item.id}`}>{item.orderCode}</Link>
                            </td>
                            <td className="max-w-[240px] truncate" title={item.customer}>{item.customer}</td>
                            <td>{formatDate(item.due)}</td>
                            <td className="erp-td-num">{formatNumber(item.sets)}</td>
                            <td className="erp-td-num">{formatNumber(item.volume)}</td>
                            <td className="erp-td-num font-semibold text-slate-900">{formatMoney(item.value)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ReportCard>

        <ReportCard title="Phân bổ theo vùng miền" hint="Chỉ tính đơn đã xác nhận có hạn giao">
          <BarList rows={report.byRegion} formatValue={formatMoneyShort} unit="đơn" />
        </ReportCard>

        <p className="erp-hint">
          Chỉ tính đơn đã xác nhận, xếp theo Ngày cần giao. Đơn quá hạn là đơn có hạn giao trước hôm nay.
        </p>
      </div>
    </ErpShell>
  );
}
