import Link from "next/link";
import { ErpShell } from "@/components/erp-shell";
import { BarList, ReportCard, ReportFilterBar, ReportKpi, reportKpiGrid } from "@/components/reports/report-ui";
import { buildReceivablesReport } from "@/lib/reporting";
import { buildOrderListWhere, type OrderListQuery } from "@/lib/order-list-filters";
import { CONFIRMED_WHERE, buildReportExportHref, loadReportFilterOptions, loadReportOrders, resolveReportQuery } from "@/lib/report-data";
import { formatDate, formatMoney, formatMoneyShort, formatNumber } from "@/components/order-list/format";

export const dynamic = "force-dynamic";

/** V130 — Báo cáo Công nợ (còn phải thu): KPI + tuổi nợ theo hạn giao + chi tiết theo khách/đại lý. */
export default async function ReceivablesPage({ searchParams }: { searchParams: Promise<OrderListQuery> }) {
  const params = await searchParams;
  const query = resolveReportQuery(params);
  const base = buildOrderListWhere(query).where;
  // Công nợ chỉ tính đơn ĐÃ XÁC NHẬN — scope này thắng mọi bộ lọc trạng thái của người dùng.
  const where = { ...base, ...CONFIRMED_WHERE };

  const [orders, options] = await Promise.all([loadReportOrders(where), loadReportFilterOptions()]);
  const report = buildReceivablesReport(orders);
  const exportHref = buildReportExportHref("/api/reports/receivables/export", query);

  const totalValue = report.rows.reduce((sum, row) => sum + row.totalValue, 0);
  const totalPaid = report.rows.reduce((sum, row) => sum + row.paid, 0);
  const overdueShare = report.totals.remaining > 0 ? (report.totals.overdue / report.totals.remaining) * 100 : 0;

  return (
    <ErpShell
      title="Báo cáo Công nợ"
      subtitle="Công nợ còn phải thu của đơn đã xác nhận: đặt cọc + trừ phiếu kho so với tổng sau chiết khấu."
      actions={
        <>
          <Link className="erp-button-secondary" href="/reports">← Danh sách báo cáo</Link>
          <Link className="erp-button" href="/orders">Mở Quản lý đơn hàng</Link>
        </>
      }
    >
      <div className="space-y-3">
        <ReportFilterBar query={query} options={options} exportHref={exportHref} action="/reports/receivables" fields={["range", "fromto", "dealer", "sales", "region"]} />

        <section className={reportKpiGrid}>
          <ReportKpi
            label="Tổng còn phải thu"
            value={formatMoneyShort(report.totals.remaining)}
            hint={`${formatNumber(report.totals.orders)} đơn đã xác nhận`}
            tone="warn"
          />
          <ReportKpi
            label="Chưa đến hạn"
            value={formatMoneyShort(report.totals.notDue)}
            hint="Nằm trong hạn giao"
            tone="good"
          />
          <ReportKpi
            label="Quá hạn"
            value={formatMoneyShort(report.totals.overdue)}
            hint="Đã qua Ngày cần giao"
            tone="bad"
          />
          <ReportKpi
            label="Số đại lý/khách còn nợ"
            value={formatNumber(report.totals.customers)}
            hint="Có phát sinh trong kỳ lọc"
            tone="neutral"
          />
          <ReportKpi
            label="Số đơn đã xác nhận"
            value={formatNumber(report.totals.orders)}
            hint="Chỉ đơn đã cấp Bộ số"
            tone="neutral"
          />
          <ReportKpi
            label="Nợ quá hạn / tổng"
            value={`${overdueShare.toFixed(1)}%`}
            hint={`Quá hạn ${formatMoneyShort(report.totals.overdue)}`}
            tone={overdueShare > 8 ? "bad" : "warn"}
          />
        </section>

        <ReportCard
          title="Tuổi nợ theo hạn giao"
          hint="Tuổi nợ tính theo số ngày quá hạn so với Ngày cần giao của đơn (chưa có phiếu thu nên đây là mức đơn)."
          right={`${formatMoneyShort(report.totals.remaining)} còn phải thu`}
        >
          <BarList
            rows={report.buckets.map((bucket) => ({
              key: bucket.key,
              label: bucket.label,
              value: bucket.amount,
              orders: bucket.orders,
              share: 0,
              tone: bucket.tone,
            }))}
            formatValue={formatMoneyShort}
            unit="đơn"
          />
        </ReportCard>

        <ReportCard
          title="Chi tiết theo khách hàng / đại lý"
          hint="Còn nợ = Tổng mua sau chiết khấu − (đặt cọc + trừ phiếu kho). Bấm mã/tên để lọc đơn của khách."
          right={<span><b className="tabular-nums text-slate-900">{report.rows.length}</b> khách</span>}
        >
          <div className="erp-scrollbar overflow-x-auto">
            <table className="erp-table">
              <thead>
                <tr>
                  <th>Mã ĐL</th>
                  <th>Tên khách hàng</th>
                  <th className="text-center">Số đơn</th>
                  <th className="text-right">Tổng mua</th>
                  <th className="text-right">Đã trả (cọc + trừ kho)</th>
                  <th className="text-right">Còn nợ</th>
                  <th>Hạn giao cũ nhất</th>
                  <th className="text-center">Số ngày quá hạn</th>
                  <th>Mức cảnh báo</th>
                </tr>
              </thead>
              <tbody>
                {report.rows.length === 0 ? (
                  <tr><td colSpan={9} className="py-10 text-center text-slate-500">Không có đơn đã xác nhận nào còn phải thu theo bộ lọc.</td></tr>
                ) : report.rows.map((row) => {
                  const href = row.code !== "—" ? `/orders?dealer=C:${encodeURIComponent(row.code)}` : "/orders";
                  return (
                    <tr key={row.key}>
                      <td className="erp-td-strong">
                        <Link className="font-semibold text-cyan-700 hover:underline" href={href}>{row.code}</Link>
                      </td>
                      <td className="max-w-[240px] truncate" title={row.name}>
                        <Link className="text-slate-700 hover:underline" href={href}>{row.name}</Link>
                      </td>
                      <td className="text-center">{formatNumber(row.orderCount)}</td>
                      <td className="erp-td-num">{formatMoney(row.totalValue)}</td>
                      <td className="erp-td-num">{formatMoney(row.paid)}</td>
                      <td className="erp-td-num font-semibold text-slate-900">{formatMoney(row.remaining)}</td>
                      <td>{formatDate(row.oldestDue)}</td>
                      <td className="erp-td-num">{row.daysOverdue > 0 ? formatNumber(row.daysOverdue) : "—"}</td>
                      <td className={`font-semibold ${overdueTone(row.daysOverdue)}`}>{row.bucket}</td>
                    </tr>
                  );
                })}
              </tbody>
              {report.rows.length === 0 ? null : (
                <tfoot>
                  <tr className="bg-slate-100 font-bold text-slate-900">
                    <td className="px-3 py-2 text-right" colSpan={3}>TỔNG CỘNG ({formatNumber(report.rows.length)} khách)</td>
                    <td className="erp-td-num px-3 py-2">{formatMoney(totalValue)}</td>
                    <td className="erp-td-num px-3 py-2">{formatMoney(totalPaid)}</td>
                    <td className="erp-td-num px-3 py-2">{formatMoney(report.totals.remaining)}</td>
                    <td colSpan={3} />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </ReportCard>

        <p className="erp-hint">
          Công nợ hiện suy ra từ đơn hàng (đặt cọc + trừ phiếu kho so với tổng sau chiết khấu) vì chưa có phiếu thu nhiều lần; chỉ tính đơn đã xác nhận.
        </p>
      </div>
    </ErpShell>
  );
}

/** Màu mức cảnh báo theo số ngày quá hạn: chưa đến hạn = slate, 1–30 ngày = amber, 31+ ngày = đỏ. */
function overdueTone(daysOverdue: number): string {
  if (daysOverdue <= 0) return "text-slate-500";
  if (daysOverdue <= 30) return "text-amber-600";
  return "text-red-600";
}
