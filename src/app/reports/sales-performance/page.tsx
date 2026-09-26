import Link from "next/link";
import { ErpShell } from "@/components/erp-shell";
import { BarList, ReportCard, ReportFilterBar, ReportKpi, reportKpiGrid } from "@/components/reports/report-ui";
import { buildSalesReport } from "@/lib/reporting";
import { buildOrderListWhere, type OrderListQuery } from "@/lib/order-list-filters";
import { buildReportExportHref, loadReportFilterOptions, loadReportOrders, resolveReportQuery } from "@/lib/report-data";
import { formatMoney, formatMoneyShort, formatNumber } from "@/components/order-list/format";

export const dynamic = "force-dynamic";

const UNASSIGNED = "(chưa gán)";

/** V130 — Báo cáo Nhân viên Sales: KPI chung + xếp hạng doanh thu + bảng hiệu suất theo NVKD. */
export default async function SalesPerformancePage({ searchParams }: { searchParams: Promise<OrderListQuery> }) {
  const params = await searchParams;
  const query = resolveReportQuery(params);
  const { where } = buildOrderListWhere(query);

  const [orders, options] = await Promise.all([loadReportOrders(where), loadReportFilterOptions()]);
  const report = buildSalesReport(orders);
  const exportHref = buildReportExportHref("/api/reports/sales-performance/export", query);

  return (
    <ErpShell
      title="Báo cáo Nhân viên Sales"
      subtitle="Hiệu suất theo NVKD: số đơn, tỉ lệ xác nhận, doanh thu, đã thu và công nợ còn lại."
      actions={
        <>
          <Link className="erp-button-secondary" href="/reports">← Danh sách báo cáo</Link>
          <Link className="erp-button" href="/orders">Mở Quản lý đơn hàng</Link>
        </>
      }
    >
      <div className="space-y-3">
        <ReportFilterBar query={query} options={options} exportHref={exportHref} action="/reports/sales-performance" fields={["range", "fromto", "dealer", "sales", "region", "type", "state"]} />

        <section className={reportKpiGrid}>
          <ReportKpi label="Tổng đơn" value={formatNumber(report.totals.orderCount)} tone="neutral" />
          <ReportKpi label="Đã xác nhận" value={formatNumber(report.totals.confirmedCount)} hint={`Tỉ lệ xác nhận ${report.totals.confirmRate.toFixed(0)}%`} tone="good" />
          <ReportKpi label="Doanh thu" value={formatMoneyShort(report.totals.revenue)} hint="Chỉ đơn Sản xuất đã xác nhận" tone="good" />
          <ReportKpi label="Đã thu" value={formatMoneyShort(report.totals.collected)} tone="neutral" />
          <ReportKpi label="Còn phải thu" value={formatMoneyShort(report.totals.remaining)} tone="warn" />
          <ReportKpi label="Giá trị đơn TB" value={formatMoneyShort(report.totals.avgOrderValue)} tone="neutral" />
        </section>

        <ReportCard title="Xếp hạng theo doanh thu" hint="Top 10 NVKD theo doanh thu (đơn Sản xuất đã xác nhận)">
          <BarList
            rows={report.rows.slice(0, 10).map((row) => ({
              key: row.key,
              label: row.code,
              value: row.revenue,
              orders: row.orderCount,
              share: 0,
            }))}
            formatValue={formatMoneyShort}
          />
        </ReportCard>

        <ReportCard
          title="Bảng hiệu suất theo nhân viên"
          hint="Bấm mã NVKD để mở danh sách đơn của nhân viên đó"
          right={<span><b className="tabular-nums text-slate-900">{report.rows.length}</b> NVKD</span>}
        >
          <div className="erp-scrollbar overflow-x-auto">
            <table className="erp-table">
              <thead>
                <tr>
                  <th>NVKD</th>
                  <th className="text-right">Số đơn</th>
                  <th className="text-right">Đã xác nhận</th>
                  <th className="text-right">Nháp</th>
                  <th className="text-right">Số bộ</th>
                  <th className="text-right">Doanh thu</th>
                  <th className="text-right">Đã thu</th>
                  <th className="text-right">Còn phải thu</th>
                  <th className="text-right">Giá trị đơn TB</th>
                  <th className="text-right">Tỉ lệ xác nhận</th>
                  <th className="text-right">Quá hạn</th>
                </tr>
              </thead>
              <tbody>
                {report.rows.length === 0 ? (
                  <tr><td colSpan={11} className="py-10 text-center text-slate-500">Không có đơn phù hợp bộ lọc.</td></tr>
                ) : report.rows.map((row) => (
                  <tr key={row.key}>
                    <td className="erp-td-strong">
                      {row.code === UNASSIGNED ? (
                        <span className="text-slate-500">{row.code}</span>
                      ) : (
                        <Link className="font-semibold text-cyan-700 hover:underline" href={`/orders?sales=${encodeURIComponent(row.code)}`}>{row.code}</Link>
                      )}
                    </td>
                    <td className="erp-td-num">{formatNumber(row.orderCount)}</td>
                    <td className="erp-td-num">{formatNumber(row.confirmedCount)}</td>
                    <td className="erp-td-num">{formatNumber(row.draftCount)}</td>
                    <td className="erp-td-num">{formatNumber(row.sets)}</td>
                    <td className="erp-td-num font-semibold text-slate-900">{formatMoney(row.revenue)}</td>
                    <td className="erp-td-num">{formatMoney(row.collected)}</td>
                    <td className="erp-td-num">{formatMoney(row.remaining)}</td>
                    <td className="erp-td-num">{formatMoneyShort(row.avgOrderValue)}</td>
                    <td className="erp-td-num">{formatNumber(Math.round(row.confirmRate))}%</td>
                    <td className={`erp-td-num ${row.overdueCount ? "font-semibold text-red-600" : ""}`}>{formatNumber(row.overdueCount)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-slate-200 bg-slate-50 font-bold text-slate-900">
                  <td className="px-3 py-2.5">TỔNG CỘNG</td>
                  <td className="erp-td-num px-3 py-2.5">{formatNumber(report.totals.orderCount)}</td>
                  <td className="erp-td-num px-3 py-2.5">{formatNumber(report.totals.confirmedCount)}</td>
                  <td className="erp-td-num px-3 py-2.5">—</td>
                  <td className="erp-td-num px-3 py-2.5">—</td>
                  <td className="erp-td-num px-3 py-2.5">{formatMoney(report.totals.revenue)}</td>
                  <td className="erp-td-num px-3 py-2.5">{formatMoney(report.totals.collected)}</td>
                  <td className="erp-td-num px-3 py-2.5">{formatMoney(report.totals.remaining)}</td>
                  <td className="erp-td-num px-3 py-2.5">{formatMoneyShort(report.totals.avgOrderValue)}</td>
                  <td className="erp-td-num px-3 py-2.5">{formatNumber(Math.round(report.totals.confirmRate))}%</td>
                  <td className="erp-td-num px-3 py-2.5">—</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </ReportCard>

        <p className="erp-hint">
          Doanh thu chỉ tính đơn <b>loại Sản xuất</b> ở trạng thái <b>Đã xác nhận</b>. <b>Đã thu</b> = giá trị đơn − còn phải thu (suy ra từ đơn, chưa có phiếu thu).
        </p>
      </div>
    </ErpShell>
  );
}
