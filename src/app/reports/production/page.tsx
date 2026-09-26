import Link from "next/link";
import { ErpShell } from "@/components/erp-shell";
import { ReportCard, ReportKpi, reportKpiGrid } from "@/components/reports/report-ui";
import { formatDate, formatNumber } from "@/components/order-list/format";
import { SET_STATUS_LABELS } from "@/lib/production/catalog";
import { todayInVietnam } from "@/lib/production/calendar";
import { buildProductionReport } from "@/lib/production/reporting";
import { loadProductionReportData } from "@/lib/production/service";

export const dynamic = "force-dynamic";

/**
 * V137 — BÁO CÁO SẢN XUẤT: giao đúng hạn (OTD) · năng suất tổ · thời gian thực tế ·
 * lỗi & làm lại · lý do trễ · tồn thành phẩm.
 *
 * Mốc so sánh gốc (khảo sát 26/09/2026): tỷ lệ trễ hạn hiện nay ≈ 75%, tỷ lệ làm lại ≈ 3%.
 */
export default async function ProductionReportPage() {
  const data = await loadProductionReportData();
  const report = buildProductionReport({ ...data, today: todayInVietnam() });
  const hasRealTiming = report.totals.avgTaskHours !== null;

  return (
    <ErpShell
      title="Báo cáo sản xuất"
      subtitle="Giao đúng hạn · năng suất tổ · thời gian thực tế từng công đoạn · lỗi làm lại · lý do trễ · tồn thành phẩm."
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Link className="erp-button-secondary" href="/ke-hoach-san-xuat">
            Bảng kế hoạch sản xuất
          </Link>
          <Link className="erp-button-secondary" href="/reports">
            ← Trung tâm báo cáo
          </Link>
        </div>
      }
    >
      <div className="space-y-3">
        <section className={reportKpiGrid}>
          <ReportKpi
            label="Giao đúng hạn (OTD)"
            value={`${report.totals.onTimeRate.toFixed(0)}%`}
            hint={`${formatNumber(report.totals.onTime)}/${formatNumber(report.totals.delivered)} bộ đã giao`}
            tone={report.totals.delivered === 0 ? "neutral" : report.totals.onTimeRate >= 90 ? "good" : report.totals.onTimeRate >= 70 ? "warn" : "bad"}
          />
          <ReportKpi
            label="Bộ giao TRỄ"
            value={formatNumber(report.totals.late)}
            hint="Đã giao nhưng sau hạn giao khách"
            tone={report.totals.late > 0 ? "bad" : "good"}
          />
          <ReportKpi
            label="Bộ quá hạn CHƯA giao"
            value={formatNumber(report.totals.overdueOpen)}
            hint="Đang làm mà đã qua hạn giao"
            tone={report.totals.overdueOpen > 0 ? "bad" : "good"}
          />
          <ReportKpi
            label="Tỷ lệ làm lại"
            value={`${report.totals.reworkRate.toFixed(1)}%`}
            hint={`${formatNumber(report.totals.reworkTasks)} công đoạn làm lại`}
            tone={report.totals.reworkRate > 3 ? "bad" : report.totals.reworkRate > 0 ? "warn" : "good"}
          />
          <ReportKpi
            label="Thời gian SX trung bình"
            value={report.totals.avgProductionDays === null ? "—" : `${report.totals.avgProductionDays.toFixed(1)} ngày`}
            hint="Từ công đoạn đầu tiên đến khi đóng gói xong"
            tone="neutral"
          />
          <ReportKpi
            label="Thời gian TB / công đoạn"
            value={report.totals.avgTaskHours === null ? "chưa có dữ liệu" : `${report.totals.avgTaskHours.toFixed(1)} giờ`}
            hint="Từ mốc Bắt đầu → Xong xưởng đã ghi"
            tone={hasRealTiming ? "neutral" : "warn"}
          />
          <ReportKpi label="Bộ trong kế hoạch" value={formatNumber(report.totals.setsInPlan)} hint={`${formatNumber(report.totals.canh)} cánh`} tone="neutral" />
          <ReportKpi
            label="Đang tạm dừng"
            value={formatNumber(report.totals.paused)}
            hint="Công đoạn bị tạm dừng"
            tone={report.totals.paused > 0 ? "bad" : "neutral"}
          />
        </section>

        {!hasRealTiming ? (
          <p className="rounded-xl border border-amber-200 bg-amber-50/70 px-3 py-2 text-[12.5px] text-amber-900">
            <strong>Chưa có số liệu thời gian thực tế.</strong> Các chỉ số về thời gian sẽ có nghĩa khi văn phòng xưởng bấm <em>Đang làm</em> / <em>Xong</em> cho
            từng công đoạn trên phần mềm — hệ thống tự ghi mốc bắt đầu/kết thúc.
          </p>
        ) : null}

        <ReportCard title="Giao đúng hạn theo tuần" hint="Tính trên các bộ ĐÃ GIAO, xếp theo tuần hạn giao khách.">
          {report.weeklyOtd.length === 0 ? (
            <p className="px-3 py-6 text-center text-[12px] text-slate-500">Chưa có bộ nào được đánh dấu đã giao.</p>
          ) : (
            <div className="erp-scrollbar overflow-x-auto">
              <table className="erp-table">
                <thead>
                  <tr>
                    <th>Tuần (T2–CN)</th>
                    <th className="text-right">Đã giao</th>
                    <th className="text-right">Đúng hạn</th>
                    <th className="text-right">Trễ</th>
                    <th className="text-right">Tỷ lệ đúng hạn</th>
                    <th className="text-right">Trễ TB (ngày)</th>
                  </tr>
                </thead>
                <tbody>
                  {report.weeklyOtd.map((row) => (
                    <tr key={row.key}>
                      <td className="erp-td-strong">{row.label}</td>
                      <td className="erp-td-num">{formatNumber(row.delivered)}</td>
                      <td className="erp-td-num">{formatNumber(row.onTime)}</td>
                      <td className="erp-td-num">{formatNumber(row.late)}</td>
                      <td className={`erp-td-num font-semibold ${row.onTimeRate >= 90 ? "text-emerald-700" : row.onTimeRate >= 70 ? "text-amber-700" : "text-red-700"}`}>
                        {row.onTimeRate.toFixed(0)}%
                      </td>
                      <td className="erp-td-num">{row.late ? row.avgLateDays.toFixed(1) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </ReportCard>

        <div className="grid gap-3 lg:grid-cols-2">
          <ReportCard title="Năng suất & tải theo tổ" hint="Tải = số cánh đi qua tổ (mỗi bộ đếm 1 lần cho mỗi tổ).">
            {report.byWorkCenter.length === 0 ? (
              <p className="px-3 py-6 text-center text-[12px] text-slate-500">Chưa có công đoạn nào.</p>
            ) : (
              <div className="erp-scrollbar overflow-x-auto">
                <table className="erp-table">
                  <thead>
                    <tr>
                      <th>Tổ</th>
                      <th className="text-right">Bộ</th>
                      <th className="text-right">Cánh</th>
                      <th className="text-right">% tải</th>
                      <th className="text-right">CĐ xong</th>
                      <th className="text-right">Giờ TB/CĐ</th>
                      <th className="text-right">Làm lại</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.byWorkCenter.map((row) => (
                      <tr key={row.code}>
                        <td className="erp-td-strong">{row.name}</td>
                        <td className="erp-td-num">{formatNumber(row.sets)}</td>
                        <td className="erp-td-num">{formatNumber(row.canh)}</td>
                        <td className="erp-td-num">{row.percentOfLoad.toFixed(1)}%</td>
                        <td className="erp-td-num">{formatNumber(row.completedTasks)}</td>
                        <td className="erp-td-num">{row.avgHours === null ? "—" : row.avgHours.toFixed(1)}</td>
                        <td className={`erp-td-num ${row.reworkTasks ? "text-red-700" : ""}`}>{formatNumber(row.reworkTasks)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </ReportCard>

          <ReportCard title="Tỷ lệ hoàn thành theo lệnh con" hint="Cánh · Khung · Phào — trên toàn bộ bộ đang có trong kế hoạch.">
            <ul className="divide-y divide-slate-100">
              {report.byComponent.map((row) => (
                <li key={row.kind} className="px-3 py-2">
                  <div className="flex items-baseline justify-between text-[12.5px]">
                    <span className="font-medium text-slate-800">{row.label}</span>
                    <span className="tabular-nums text-slate-600">
                      {row.percent}% · {formatNumber(row.done)}/{formatNumber(row.total)} công đoạn
                    </span>
                  </div>
                  <div className="mt-1 h-2 w-full overflow-hidden rounded bg-slate-100">
                    <div className={`h-full ${row.percent >= 100 ? "bg-emerald-500" : row.percent > 0 ? "bg-cyan-500" : "bg-slate-300"}`} style={{ width: `${row.percent}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          </ReportCard>
        </div>

        <ReportCard title="Thời gian thực tế từng công đoạn (so với định mức)" hint="Định mức lấy từ danh mục công đoạn; thực tế lấy từ mốc xưởng đã ghi.">
          <div className="erp-scrollbar overflow-x-auto">
            <table className="erp-table">
              <thead>
                <tr>
                  <th>Công đoạn</th>
                  <th className="text-right">Định mức (giờ)</th>
                  <th className="text-right">Thực tế TB (giờ)</th>
                  <th className="text-right">Chênh</th>
                  <th className="text-right">Lượt xong</th>
                  <th className="text-right">Làm lại</th>
                </tr>
              </thead>
              <tbody>
                {report.byStage.map((row) => {
                  const diff = row.quotedHours !== null && row.avgActualHours !== null ? row.avgActualHours - row.quotedHours : null;
                  return (
                    <tr key={row.code}>
                      <td className="erp-td-strong">{row.name}</td>
                      <td className="erp-td-num">{row.quotedHours ?? "—"}</td>
                      <td className="erp-td-num">{row.avgActualHours === null ? "—" : row.avgActualHours.toFixed(1)}</td>
                      <td className={`erp-td-num ${diff === null ? "" : diff > 0 ? "text-red-700" : "text-emerald-700"}`}>
                        {diff === null ? "—" : `${diff > 0 ? "+" : ""}${diff.toFixed(1)}`}
                      </td>
                      <td className="erp-td-num">{formatNumber(row.completedTasks)}</td>
                      <td className={`erp-td-num ${row.reworkTasks ? "text-red-700" : ""}`}>{formatNumber(row.reworkTasks)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </ReportCard>

        <div className="grid gap-3 lg:grid-cols-2">
          <ReportCard title="Lý do trễ / tạm dừng / lỗi" hint="Đếm theo lý do ghi ở công đoạn (và ở bộ). Sửa danh mục lý do ở Cấu hình sản xuất.">
            {report.reasons.length === 0 ? (
              <p className="px-3 py-6 text-center text-[12px] text-slate-500">Chưa ghi lý do nào. Khi tạm dừng hoặc đánh dấu làm lại, chọn Lý do trên trang bộ cửa.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {report.reasons.slice(0, 12).map((row) => (
                  <li key={`${row.code}-${row.scope}`} className="flex items-center justify-between px-3 py-1.5 text-[12.5px]">
                    <span className="min-w-0 truncate text-slate-800" title={row.name}>{row.name}</span>
                    <span className="ml-2 shrink-0 tabular-nums text-slate-500">
                      {formatNumber(row.count)} · {row.scope}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </ReportCard>

          <ReportCard title="Tồn thành phẩm > 60 ngày chưa giao" hint="KHO5: đóng gói xong = hoàn thành sản xuất. GH9: quá 2 tháng coi là tồn.">
            {report.staleStock.length === 0 ? (
              <p className="px-3 py-6 text-center text-[12px] text-slate-500">Không có bộ nào tồn quá 60 ngày.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {report.staleStock.map((row) => (
                  <li key={row.id} className="flex items-center justify-between px-3 py-1.5 text-[12.5px]">
                    <Link className="font-semibold text-cyan-700 hover:underline" href={`/ke-hoach-san-xuat/bo/${row.id}`}>
                      {row.setNo || `#${row.id}`}
                    </Link>
                    <span className="min-w-0 flex-1 truncate px-2 text-slate-600">{row.customerName ?? "—"}</span>
                    <span className="shrink-0 tabular-nums text-slate-500">
                      xong {formatDate(row.finishedAt)} · {row.daysInStock} ngày
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </ReportCard>
        </div>

        <ReportCard title="Danh sách bộ GIAO TRỄ" hint="Đã giao muộn hơn hạn giao khách — dùng để tìm nguyên nhân." right={`${formatNumber(report.totals.late)} bộ`}>
          {report.lateSets.length === 0 ? (
            <p className="px-3 py-6 text-center text-[12px] text-slate-500">Không có bộ nào giao trễ.</p>
          ) : (
            <div className="erp-scrollbar overflow-x-auto">
              <table className="erp-table">
                <thead>
                  <tr>
                    <th>Bộ số</th>
                    <th>Mã đơn</th>
                    <th>Khách hàng</th>
                    <th>Hạn giao</th>
                    <th>Hoàn thành SX</th>
                    <th>Đã giao</th>
                    <th className="text-right">Trễ (ngày)</th>
                    <th>Trạng thái</th>
                  </tr>
                </thead>
                <tbody>
                  {report.lateSets.map((row) => (
                    <tr key={row.id}>
                      <td className="erp-td-strong">
                        <Link className="font-semibold text-cyan-700 hover:underline" href={`/ke-hoach-san-xuat/bo/${row.id}`}>
                          {row.setNo || `#${row.id}`}
                        </Link>
                      </td>
                      <td>{row.orderCode ?? "—"}</td>
                      <td className="max-w-[200px] truncate">{row.customerName ?? "—"}</td>
                      <td>{formatDate(row.dueDate)}</td>
                      <td>{formatDate(row.finishedAt)}</td>
                      <td>{formatDate(row.deliveredAt)}</td>
                      <td className="erp-td-num font-semibold text-red-700">{row.daysLate}</td>
                      <td>{SET_STATUS_LABELS[row.status] ?? row.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </ReportCard>

        <p className="erp-hint">
          Mốc so sánh gốc từ khảo sát nhà máy 26/09/2026: <strong>trễ hạn ≈ 75%</strong> · <strong>làm lại ≈ 3%</strong> · 1 người ≈ 1,45 m²/ngày ·
          trần xưởng ≈ 45–50 cánh/ngày. Sau vài tuần dùng phần mềm, so lại các con số này để biết đã cải thiện chưa.
        </p>
      </div>
    </ErpShell>
  );
}
