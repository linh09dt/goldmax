import Link from "next/link";
import { ErpShell } from "@/components/erp-shell";
import { BarList, ReportCard, ReportFilterBar, ReportKpi, reportKpiGrid } from "@/components/reports/report-ui";
import { buildProductReport } from "@/lib/reporting";
import { buildOrderListWhere, type OrderListQuery } from "@/lib/order-list-filters";
import { REVENUE_WHERE, buildReportExportHref, loadMasterProducts, loadReportFilterOptions, loadReportOrders, resolveReportQuery } from "@/lib/report-data";
import { formatDecimal, formatMoney, formatMoneyShort, formatNumber } from "@/components/order-list/format";

export const dynamic = "force-dynamic";

/** V130 — Báo cáo Sản phẩm: sản phẩm phát sinh doanh thu + sản phẩm chưa bán trong kỳ. */
export default async function ProductsReportPage({ searchParams }: { searchParams: Promise<OrderListQuery> }) {
  const params = await searchParams;
  const query = resolveReportQuery(params);
  const { where: baseWhere } = buildOrderListWhere(query);
  // Báo cáo sản phẩm CHỈ tính doanh thu (loại Sản xuất + đã xác nhận) nên phạm vi doanh thu
  // được trùm lên bộ lọc: dù người dùng có chọn `type` khác thì REVENUE_WHERE vẫn thắng.
  const where = { ...baseWhere, ...REVENUE_WHERE };

  const [orders, masters, options] = await Promise.all([loadReportOrders(where), loadMasterProducts(), loadReportFilterOptions()]);
  const report = buildProductReport(orders, masters);
  const exportHref = buildReportExportHref("/api/reports/products/export", query);

  return (
    <ErpShell
      title="Báo cáo Sản phẩm"
      subtitle="Sản phẩm phát sinh doanh thu theo bộ lọc: số đơn, số bộ, sản lượng, khoảng đơn giá và doanh thu."
      actions={
        <>
          <Link className="erp-button-secondary" href="/reports">← Danh sách báo cáo</Link>
          <Link className="erp-button" href="/reports/orders">Báo cáo Đơn hàng</Link>
        </>
      }
    >
      <div className="space-y-3">
        <ReportFilterBar
          query={query}
          options={options}
          exportHref={exportHref}
          action="/reports/products"
          fields={["range", "fromto", "dealer", "sales", "region"]}
        />

        <section className={reportKpiGrid}>
          <ReportKpi label="Tổng sản phẩm phát sinh doanh thu" value={formatNumber(report.totals.products)} hint="Mã hàng hóa / model xuất hiện trong đơn" tone="neutral" />
          <ReportKpi label="Tổng KH/Lượng" value={formatNumber(report.totals.pricingQuantity)} hint="Σ KH/Lượng của các dòng hàng" tone="neutral" />
          <ReportKpi label="Tổng SL" value={formatNumber(report.totals.quantity)} hint="Σ Số lượng thực xuất" tone="neutral" />
          <ReportKpi label="Số lượt bán theo đơn" value={formatNumber(report.totals.orderCount)} hint="Một sản phẩm bán ở nhiều đơn tính nhiều lượt" tone="neutral" />
          <ReportKpi label="Doanh thu" value={formatMoneyShort(report.totals.revenue)} hint="Chỉ đơn Sản xuất đã xác nhận" tone="good" />
          <ReportKpi label="Doanh thu TB / sản phẩm" value={formatMoneyShort(report.totals.revenue / Math.max(1, report.totals.products))} hint={`Trên ${formatNumber(report.totals.products)} sản phẩm`} tone="neutral" />
        </section>

        <ReportCard title="Top sản phẩm bán chạy" hint="Xếp theo doanh thu trong kỳ lọc" right={`${report.rows.length} sản phẩm`}>
          {report.rows.length === 0 ? (
            <p className="erp-hint py-8 text-center">Chưa có sản phẩm nào phát sinh doanh thu trong kỳ lọc.</p>
          ) : (
            <BarList
              rows={report.rows.slice(0, 10).map((row) => ({
                key: row.key,
                label: `${row.code} · ${row.name}`,
                value: row.revenue,
                orders: row.orderCount,
                share: 0,
              }))}
              formatValue={formatMoneyShort}
            />
          )}
        </ReportCard>

        <ReportCard
          title="Chi tiết sản phẩm phát sinh doanh thu"
          hint="Gom theo mã hàng trong danh mục; dòng không khớp danh mục được ghi chú riêng."
          right={<span><b className="tabular-nums text-slate-900">{report.rows.length}</b> sản phẩm</span>}
        >
          <div className="erp-scrollbar overflow-x-auto">
            <table className="erp-table">
              <thead>
                <tr>
                  <th className="text-center">STT</th>
                  <th>MODEL</th>
                  <th>TENHANG</th>
                  <th className="text-center">ĐVT</th>
                  <th className="text-right">Số đơn</th>
                  <th className="text-right">Số bộ</th>
                  <th className="text-right">Tổng SL</th>
                  <th className="text-right">Tổng KH/Lượng</th>
                  <th className="text-right">Đơn giá TB</th>
                  <th className="text-right">Đơn giá thấp nhất</th>
                  <th className="text-right">Đơn giá cao nhất</th>
                  <th className="text-right">Doanh thu</th>
                </tr>
              </thead>
              <tbody>
                {report.rows.length === 0 ? (
                  <tr>
                    <td colSpan={12} className="py-10 text-center text-slate-500">Không có sản phẩm phát sinh doanh thu trong kỳ lọc.</td>
                  </tr>
                ) : report.rows.map((row, index) => (
                  <tr key={row.key}>
                    <td className="text-center tabular-nums">{index + 1}</td>
                    <td className="erp-td-strong">{row.code}</td>
                    <td>
                      {row.name}
                      {row.matched ? null : (
                        <span className="ml-1 text-[10.5px] font-normal text-amber-700">(chưa có trong danh mục)</span>
                      )}
                    </td>
                    <td className="text-center">{row.unit || "—"}</td>
                    <td className="erp-td-num">{formatNumber(row.orderCount)}</td>
                    <td className="erp-td-num">{formatNumber(row.sets)}</td>
                    <td className="erp-td-num">{formatDecimal(row.quantity)}</td>
                    <td className="erp-td-num">{formatDecimal(row.pricingQuantity)}</td>
                    <td className="erp-td-num">{formatMoney(row.avgPrice)}</td>
                    <td className="erp-td-num">{formatMoney(row.minPrice)}</td>
                    <td className="erp-td-num">{formatMoney(row.maxPrice)}</td>
                    <td className="erp-td-num font-bold text-slate-900">{formatMoney(row.revenue)}</td>
                  </tr>
                ))}
              </tbody>
              {report.rows.length > 0 ? (
                <tfoot>
                  <tr className="bg-slate-100 font-bold text-slate-900">
                    <td className="px-1.5 py-2 text-right" colSpan={7}>TỔNG CỘNG ({report.rows.length} sản phẩm)</td>
                    <td className="erp-td-num px-1.5 py-2">{formatDecimal(report.totals.pricingQuantity)}</td>
                    <td className="px-1.5 py-2" colSpan={3} />
                    <td className="erp-td-num px-1.5 py-2">{formatMoney(report.totals.revenue)}</td>
                  </tr>
                </tfoot>
              ) : null}
            </table>
          </div>
        </ReportCard>

        <ReportCard
          title="Sản phẩm chưa phát sinh doanh thu trong kỳ"
          hint="Các mã có trong danh mục nhưng không xuất hiện trong đơn đã lọc."
          right={<span><b className="tabular-nums text-slate-900">{report.slowRows.length}</b> sản phẩm</span>}
        >
          <div className="erp-scrollbar overflow-x-auto">
            <table className="erp-table">
              <thead>
                <tr>
                  <th className="text-center">STT</th>
                  <th>MODEL</th>
                  <th>TENHANG</th>
                  <th className="text-center">ĐVT</th>
                </tr>
              </thead>
              <tbody>
                {report.slowRows.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-slate-500">Mọi sản phẩm trong danh mục đều đã phát sinh doanh thu trong kỳ.</td>
                  </tr>
                ) : report.slowRows.slice(0, 30).map((row, index) => (
                  <tr key={`${row.code}-${index}`}>
                    <td className="text-center tabular-nums">{index + 1}</td>
                    <td className="erp-td-strong">{row.code}</td>
                    <td>{row.name}</td>
                    <td className="text-center">{row.unit || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="erp-hint mt-2">
            Đây là các mã có trong danh mục nhưng không xuất hiện trong đơn đã lọc{report.slowRows.length > 30 ? ` — hiển thị 30/${report.slowRows.length} mã đầu tiên` : ""}.
          </p>
        </ReportCard>

        <p className="erp-hint">
          Chỉ tính đơn loại <b>Sản xuất</b> ở trạng thái <b>Đã xác nhận</b> — doanh thu ghi nhận {formatMoney(report.totals.revenue)} trên {formatNumber(report.totals.products)} sản phẩm.
        </p>
      </div>
    </ErpShell>
  );
}
