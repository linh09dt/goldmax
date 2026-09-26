import Link from "next/link";
import { ErpShell } from "@/components/erp-shell";
import { BarList, ReportCard, ReportFilterBar, ReportKpi, reportKpiGrid } from "@/components/reports/report-ui";
import { TrendChart } from "@/components/dashboard/dashboard-ui";
import { buildOrderReport } from "@/lib/reporting";
import { buildOrderListWhere, type OrderListQuery } from "@/lib/order-list-filters";
import { buildReportExportHref, loadReportFilterOptions, loadReportOrders, resolveReportQuery } from "@/lib/report-data";
import { formatDate, formatMoney, formatMoneyShort, formatNumber } from "@/components/order-list/format";
import { orderStatusLabel, orderTypeLabel } from "@/lib/order-form";

export const dynamic = "force-dynamic";

/** V130 — Báo cáo Đơn hàng: KPI + đơn theo tháng/loại/trạng thái/vùng + bảng đơn. */
export default async function OrdersReportPage({ searchParams }: { searchParams: Promise<OrderListQuery> }) {
  const params = await searchParams;
  const query = resolveReportQuery(params);
  const { where } = buildOrderListWhere(query);

  const [orders, options] = await Promise.all([loadReportOrders(where), loadReportFilterOptions()]);
  const report = buildOrderReport(orders);
  const exportHref = buildReportExportHref("/api/reports/orders/export", query);

  return (
    <ErpShell
      title="Báo cáo Đơn hàng"
      subtitle="Toàn bộ đơn theo bộ lọc: số lượng, giá trị, trạng thái, vùng miền và tiến độ giao."
      actions={
        <>
          <Link className="erp-button-secondary" href="/reports">← Danh sách báo cáo</Link>
          <Link className="erp-button" href="/orders">Mở Quản lý đơn hàng</Link>
        </>
      }
    >
      <div className="space-y-3">
        <ReportFilterBar query={query} options={options} exportHref={exportHref} action="/reports/orders" fields={["range", "fromto", "dealer", "sales", "region", "type", "state", "q"]} />

        <section className={reportKpiGrid}>
          <ReportKpi label="Tổng đơn" value={formatNumber(report.totals.count)} hint={`${report.totals.sets} bộ cửa · ${formatNumber(Math.round(report.totals.volume))} m²`} href="/orders" tone="neutral" />
          <ReportKpi label="Đã xác nhận" value={formatNumber(report.totals.confirmedCount)} hint={`Tỉ lệ xác nhận ${report.totals.confirmedShare.toFixed(0)}%`} tone="good" href={`/orders?state=da_xac_nhan`} />
          <ReportKpi label="Đơn nháp" value={formatNumber(report.totals.draftCount)} hint={report.totals.cancelledCount ? `${report.totals.cancelledCount} đơn đã hủy` : "Chưa xác nhận"} tone={report.totals.draftCount ? "warn" : "neutral"} href="/orders?state=nhap" />
          <ReportKpi label="Quá hạn giao" value={formatNumber(report.totals.overdueCount)} hint="Đã xác nhận nhưng quá ngày cần giao" tone={report.totals.overdueCount ? "bad" : "good"} href="/reports/production-load" />
          <ReportKpi label="Giá trị đơn" value={formatMoneyShort(report.totals.orderValue)} hint={`TB ${formatMoneyShort(report.totals.avgOrderValue)}/đơn`} tone="neutral" />
          <ReportKpi label="Doanh thu ghi nhận" value={formatMoneyShort(report.totals.revenue)} hint="Chỉ đơn Sản xuất đã xác nhận" tone="good" href={`/orders?type=san_xuat&state=da_xac_nhan`} />
        </section>

        <section className="grid gap-2.5 xl:grid-cols-[1.55fr_1fr]">
          <div className="erp-card p-3">
            <div className="flex items-baseline justify-between">
              <h2 className="erp-section-title">Đơn hàng theo tháng</h2>
              <span className="erp-hint">12 tháng gần nhất trong kỳ lọc</span>
            </div>
            <TrendChart months={report.byMonth} />
          </div>
          <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-1">
            <ReportCard title="Cơ cấu theo loại đơn" hint="Giá trị đơn của cả 2 trạng thái">
              <BarList rows={report.byType} formatValue={formatMoneyShort} />
            </ReportCard>
            <ReportCard title="Theo trạng thái" hint="Đã xác nhận = đã cấp Bộ số">
              <BarList rows={report.byStatus} formatValue={formatMoneyShort} />
            </ReportCard>
          </div>
        </section>

        <section className="grid gap-2.5 lg:grid-cols-2">
          <ReportCard title="Doanh thu / giá trị theo vùng miền" hint="Theo trường Vùng miền của đơn">
            <BarList rows={report.byRegion} formatValue={formatMoneyShort} />
          </ReportCard>
          <ReportCard title="Tỉ trọng đơn theo loại" right={`${report.totals.count} đơn`}>
            <BarList rows={report.byType.map((row) => ({ ...row, value: row.orders, share: row.share }))} formatValue={(value) => `${formatNumber(Number(value))} đơn`} />
          </ReportCard>
        </section>

        <ReportCard
          title="Danh sách đơn hàng"
          hint="Bấm mã đơn để mở chi tiết"
          right={<span><b className="tabular-nums text-slate-900">{report.totals.count}</b> đơn</span>}
        >
          <div className="erp-scrollbar overflow-x-auto">
            <table className="erp-table">
              <thead>
                <tr>
                  <th>Mã đơn</th>
                  <th>Ngày đặt</th>
                  <th>Khách hàng</th>
                  <th>NVKD</th>
                  <th className="text-center">Loại đơn</th>
                  <th className="text-center">Trạng thái</th>
                  <th className="text-right">Giá trị đơn</th>
                  <th className="text-right">Còn phải thu</th>
                  <th>Hạn giao</th>
                </tr>
              </thead>
              <tbody>
                {orders.length === 0 ? (
                  <tr><td colSpan={9} className="py-10 text-center text-slate-500">Không có đơn phù hợp bộ lọc.</td></tr>
                ) : orders.map((order) => (
                  <tr key={order.id}>
                    <td className="erp-td-strong">
                      <Link className="font-semibold text-cyan-700 hover:underline" href={`/orders/${order.id}`}>{order.orderCode}</Link>
                    </td>
                    <td>{formatDate(order.orderDate)}</td>
                    <td className="max-w-[220px] truncate" title={order.customerName ?? ""}>{order.customerName || order.customerCode || "—"}</td>
                    <td>{order.salesEmployeeCode || "—"}</td>
                    <td className="text-center">{orderTypeLabel(order.orderType)}</td>
                    <td className="text-center">{orderStatusLabel(order.status)}</td>
                    <td className="erp-td-num font-semibold text-slate-900">{formatMoney(order.totalAfterDiscount)}</td>
                    <td className="erp-td-num">{formatMoney(order.deliveryPayment)}</td>
                    <td>{formatDate(order.requiredDeliveryDate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ReportCard>

        <p className="erp-hint">
          Doanh thu chỉ tính đơn <b>loại Sản xuất</b> ở trạng thái <b>Đã xác nhận</b>: {formatMoney(report.totals.revenue)} · giá trị đơn (mọi loại): {formatMoney(report.totals.orderValue)}.
        </p>
      </div>
    </ErpShell>
  );
}
