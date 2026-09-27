import Link from "next/link";
import { ErpShell } from "@/components/erp-shell";
import { PlanAutoRefresh } from "@/components/production/plan-auto-refresh";
import { PlanSetTable } from "@/components/production/plan-set-table";
import { StagePlanGridTable } from "@/components/production/stage-plan-grid";
import { TablePager } from "@/components/production/table-pager";
import { ReportCard, ReportKpi } from "@/components/reports/report-ui";
import { formatDate, formatNumber } from "@/components/order-list/format";
import { dateKeyUtc, isWorkingDay, MS_DAY, startOfDayUtc, todayInVietnam } from "@/lib/production/calendar";
import type { ProductionTaskRow } from "@/lib/production/catalog";
import {
  buildProductionSummary,
  buildSetTableRows,
  buildSetWarningTags,
  buildStagePlanGrid,
  sortSetsForPlanning,
} from "@/lib/production/scheduling";
import { countUnplannedOrderItems, loadProductionBoard } from "@/lib/production/service";

export const dynamic = "force-dynamic";

/**
 * V136 — Màn chính module Lên kế hoạch sản xuất.
 * V158 — bảng “Bộ chờ xếp lịch” đủ cột theo yêu cầu.
 * V159 — bảng “Đang sản xuất” cùng bộ cột; bỏ dải cảnh báo; thêm cột “Cảnh báo” cho 2 bảng;
 *        xếp 8 card trên 1 dòng; thêm “Bảng kế hoạch theo ngày” (hàng = công đoạn, cột = ngày trong tháng).
 */

const pad2 = (value: number) => String(value).padStart(2, "0");
const monthKeyOf = (value: Date) => `${value.getUTCFullYear()}-${pad2(value.getUTCMonth() + 1)}`;

/** V159b — mỗi trang của 2 bảng danh sách hiện 10 dòng. */
const PAGE_SIZE = 10;

export default async function ProductionPlanPage({
  searchParams,
}: {
  searchParams: Promise<{ thang?: string; cho?: string; sx?: string }>;
}) {
  const query = await searchParams;
  const today = todayInVietnam();

  const [board, unplannedCount] = await Promise.all([loadProductionBoard(), countUnplannedOrderItems()]);
  const { sets, tasks, stages, config, calendar, programModels } = board;
  const summary = buildProductionSummary(sets, tasks);

  const tasksBySet = new Map<number, ProductionTaskRow[]>();
  for (const task of tasks) {
    const list = tasksBySet.get(task.setId);
    if (list) list.push(task);
    else tasksBySet.set(task.setId, [task]);
  }

  const warnings = buildSetWarningTags({ sets, tasks, stages, config, calendar, today, modelsWithProgram: programModels });

  const waiting = sortSetsForPlanning(sets.filter((set) => set.status === "CHO_XEP_LICH"));
  const running = sortSetsForPlanning(
    sets.filter((set) => set.status === "DANG_SX" || set.status === "DA_XEP_LICH" || set.status === "TAM_DUNG"),
  );
  const finished = sortSetsForPlanning(sets.filter((set) => set.status === "HOAN_THANH"));

  const waitingRows = buildSetTableRows({ sets: waiting, tasksBySet, stages, config, warnings });
  const runningRows = buildSetTableRows({ sets: running, tasksBySet, stages, config, warnings });

  // V159b — phân trang 10 dòng/trang cho 2 bảng danh sách.
  const toPage = (raw: string | undefined, total: number) => {
    const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
    const parsed = Number.parseInt(String(raw ?? "1"), 10);
    const page = Number.isFinite(parsed) ? Math.min(Math.max(1, parsed), pageCount) : 1;
    return { page, pageCount };
  };
  const waitingPageInfo = toPage(query.cho, waitingRows.length);
  const runningPageInfo = toPage(query.sx, runningRows.length);
  const waitingSlice = waitingRows.slice((waitingPageInfo.page - 1) * PAGE_SIZE, waitingPageInfo.page * PAGE_SIZE);
  const runningSlice = runningRows.slice((runningPageInfo.page - 1) * PAGE_SIZE, runningPageInfo.page * PAGE_SIZE);
  const waitingPagerParams: Record<string, string> = {};
  if (query.thang) waitingPagerParams.thang = query.thang;
  if (runningPageInfo.page > 1) waitingPagerParams.sx = String(runningPageInfo.page);
  const runningPagerParams: Record<string, string> = {};
  if (query.thang) runningPagerParams.thang = query.thang;
  if (waitingPageInfo.page > 1) runningPagerParams.cho = String(waitingPageInfo.page);

  // --- Bảng kế hoạch theo ngày: tháng đang xem (?thang=YYYY-MM), mặc định tháng hiện tại ---
  const requested = String(query.thang ?? "").match(/^(\d{4})-(\d{2})$/);
  const monthStart = requested
    ? new Date(Date.UTC(Number(requested[1]), Number(requested[2]) - 1, 1))
    : new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
  const monthKey = monthKeyOf(monthStart);
  const prevMonth = new Date(Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth() - 1, 1));
  const nextMonth = new Date(Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth() + 1, 1));
  const grid = buildStagePlanGrid({ stages, tasks, month: monthStart });
  const workingDayFlags = grid.days.map((day) => isWorkingDay(startOfDayUtc(day), calendar));
  const todayKey = dateKeyUtc(today);

  const kpis: Array<{ label: string; value: string; hint: string; tone: "neutral" | "good" | "warn" | "bad" }> = [
    { label: "Bộ trong kế hoạch", value: formatNumber(summary.total), hint: "Đã đưa từ đơn vào sản xuất", tone: "neutral" },
    { label: "Chờ xếp lịch", value: formatNumber(summary.waiting), hint: "Chưa gán ngày/tổ", tone: summary.waiting > 0 ? "warn" : "neutral" },
    { label: "Đang sản xuất", value: formatNumber(summary.inProgress), hint: "Đã xếp lịch hoặc đang làm", tone: "neutral" },
    { label: "Hoàn thành / đã giao", value: `${formatNumber(summary.completed)} / ${formatNumber(summary.delivered)}`, hint: "Đóng gói xong / đã giao khách", tone: "good" },
    { label: "Tổng cánh", value: formatNumber(summary.totalCanh), hint: "Quy đổi từ số cánh × số bộ", tone: "neutral" },
    { label: "Tiến độ trung bình", value: `${summary.avgPercent}%`, hint: "Theo công đoạn đã xong", tone: "neutral" },
    { label: "Chưa nhập vào kế hoạch", value: formatNumber(unplannedCount), hint: "Bộ của đơn đã xác nhận còn ngoài kế hoạch", tone: unplannedCount > 0 ? "warn" : "neutral" },
    { label: "Tạm dừng", value: formatNumber(summary.paused), hint: "Có công đoạn bị tạm dừng", tone: summary.paused > 0 ? "bad" : "neutral" },
  ];

  return (
    <ErpShell
      title="Kế hoạch sản xuất"
      subtitle="Mỗi dòng là 1 bộ cửa. Mở một bộ để cập nhật tiến độ từng công đoạn."
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Link className="erp-button" href="/ke-hoach-san-xuat/xep-lich-toan-xuong">
            Xếp lịch toàn xưởng (cả dây chuyền)</Link>
          <Link className="erp-button-secondary" href="/ke-hoach-san-xuat/nhap-do-dang">
            Nhập bộ đang sản xuất dở{unplannedCount > 0 ? ` (${formatNumber(unplannedCount)})` : ""}
          </Link>
          <Link className="erp-button-secondary" href="/ke-hoach-san-xuat/in">
            In phiếu lệnh SX
          </Link>
          <Link className="erp-button-secondary" href="/ke-hoach-san-xuat/cau-hinh">
            Cấu hình sản xuất
          </Link>
        </div>
      }
    >
      <PlanAutoRefresh />
      <div className="space-y-3">
        {/* V159 — 8 card nằm CHUNG 1 DÒNG (cuộn ngang khi màn hình hẹp). */}
        <section className="erp-scrollbar flex flex-nowrap gap-2.5 overflow-x-auto pb-1">
          {kpis.map((kpi) => (
            <div key={kpi.label} className="w-[172px] shrink-0">
              <ReportKpi label={kpi.label} value={kpi.value} hint={kpi.hint} tone={kpi.tone} />
            </div>
          ))}
        </section>

        <ReportCard
          title="Bộ chờ xếp lịch"
          hint="Xếp theo hạn giao gần nhất trước (EDD). Cột “Cảnh báo” chỉ hiện TÊN cảnh báo (rê chuột để xem diễn giải). Mỗi trang 10 dòng. **Xếp lịch bằng tay**: mở một bộ → gán ngày kế hoạch cho từng công đoạn."
          right={
            <TablePager
              page={waitingPageInfo.page}
              pageCount={waitingPageInfo.pageCount}
              total={waitingRows.length}
              basePath="/ke-hoach-san-xuat"
              pageKey="cho"
              params={waitingPagerParams}
            />
          }
        >
          <PlanSetTable rows={waitingSlice} emptyText="Không còn bộ nào chờ xếp lịch." />
        </ReportCard>

        <ReportCard
          title="Đang sản xuất"
          hint="Cùng bộ cột với bảng Bộ chờ xếp lịch. Cột “Cảnh báo” so SỐ NGÀY CHẬM với LEAD TIME của công đoạn đang chậm: ≤ 1× = Chậm nhẹ · ≤ 2× = Chậm · > 2× = Chậm nặng. Mỗi trang 10 dòng."
          right={
            <TablePager
              page={runningPageInfo.page}
              pageCount={runningPageInfo.pageCount}
              total={runningRows.length}
              basePath="/ke-hoach-san-xuat"
              pageKey="sx"
              params={runningPagerParams}
            />
          }
        >
          <PlanSetTable rows={runningSlice} emptyText="Chưa có bộ nào đang sản xuất." />
        </ReportCard>

        <ReportCard
          title="Bảng kế hoạch theo ngày"
          hint="Hàng = tất cả công đoạn · cột = mọi ngày trong tháng. Mỗi ô 2 số: kế hoạch (ngày kế hoạch) và thực tế (ngày báo xong)."
          right={
            <div className="flex flex-wrap items-center gap-2">
              <Link className="erp-button-secondary h-7 px-2 text-[11px]" href={`/ke-hoach-san-xuat?thang=${monthKeyOf(prevMonth)}`}>
                ← Tháng trước
              </Link>
              <span className="font-semibold text-slate-700">Tháng {monthStart.getUTCMonth() + 1}/{monthStart.getUTCFullYear()}</span>
              <Link className="erp-button-secondary h-7 px-2 text-[11px]" href={`/ke-hoach-san-xuat?thang=${monthKeyOf(nextMonth)}`}>
                Tháng sau →
              </Link>
              <form method="GET" action="/ke-hoach-san-xuat" className="flex items-center gap-1">
                <input className="erp-input h-7 px-2 text-[11px]" type="month" name="thang" defaultValue={monthKey} />
                <button className="erp-button h-7 px-2 text-[11px]" type="submit">Xem</button>
              </form>
              <a
                className="erp-button-secondary h-7 px-2 text-[11px]"
                href={`/api/production/stage-plan/export?thang=${monthKey}`}
              >
                Xuất Excel
              </a>
            </div>
          }
        >
          <StagePlanGridTable grid={grid} workingDays={workingDayFlags} todayKey={todayKey} />
        </ReportCard>

        <ReportCard title="Đã hoàn thành sản xuất" hint="Đóng gói xong = hoàn thành sản xuất (KHO5). Đã giao khách thì ghi ngày giao thực tế ở trang chi tiết bộ." right={`${formatNumber(finished.length)} bộ`}>
          {finished.length === 0 ? (
            <p className="py-6 text-center text-[12px] text-slate-500">Chưa có bộ nào hoàn thành.</p>
          ) : (
            <div className="erp-scrollbar overflow-x-auto">
              <table className="erp-table">
                <thead>
                  <tr>
                    <th>Bộ số</th>
                    <th>Mã đơn</th>
                    <th>Khách hàng</th>
                    <th>Hạn giao</th>
                    <th>Hoàn thành</th>
                    <th>Đúng hạn?</th>
                  </tr>
                </thead>
                <tbody>
                  {finished.slice(0, 200).map((set) => {
                    const completed = set.actualCompletedAt ? new Date(set.actualCompletedAt) : null;
                    const onTime = completed && set.dueDate ? completed.getTime() <= new Date(set.dueDate).getTime() + MS_DAY - 1 : null;
                    return (
                      <tr key={set.id}>
                        <td className="erp-td-strong">
                          <Link className="font-semibold text-cyan-700 hover:underline" href={`/ke-hoach-san-xuat/bo/${set.id}`}>
                            {set.setNo || `#${set.id}`}
                          </Link>
                        </td>
                        <td>{set.orderCode || "—"}</td>
                        <td className="max-w-[200px] truncate">{set.customerName || "—"}</td>
                        <td>{formatDate(set.dueDate)}</td>
                        <td>{completed ? formatDate(completed) : "—"}</td>
                        <td>
                          {onTime === null ? (
                            <span className="text-slate-400">—</span>
                          ) : onTime ? (
                            <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[11px] text-emerald-800">đúng hạn</span>
                          ) : (
                            <span className="rounded bg-red-100 px-1.5 py-0.5 text-[11px] text-red-800">trễ</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </ReportCard>

        <p className="erp-hint">
          Ngày làm việc theo cấu hình: {config.workingDays.join(", ")} (0 = Chủ nhật) — không tính Chủ nhật và ngày lễ.
          Đã trừ {config.deliveryBufferDays} ngày đệm vì hạn giao là ngày giao tới khách.
          {config.overlapDaysPerStep > 0
            ? ` Đang bật gối công đoạn ${config.overlapDaysPerStep} ngày/bước.`
            : " Chưa bật gối công đoạn (đang cộng dồn số ngày — cách tính an toàn)."}{" "}
          Cảnh báo quá tải tổ / công đoạn theo ngày xem ở màn “Xếp việc theo công đoạn” và “Xếp lịch toàn xưởng”
          (thanh tải mỗi ngày đổi màu khi vượt năng lực).
        </p>
      </div>
    </ErpShell>
  );
}
