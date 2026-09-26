import Link from "next/link";
import { ErpShell } from "@/components/erp-shell";
import { ReportCard, ReportKpi, reportKpiGrid } from "@/components/reports/report-ui";
import { formatDate, formatNumber } from "@/components/order-list/format";
import { todayInVietnam, MS_DAY } from "@/lib/production/calendar";
import {
  canhEquivalentOf,
  componentProgress,
  COMPONENT_KINDS,
  COMPONENT_LABELS,
  SET_STATUS_LABELS,
  percentDoneOf,
  type ProductionTaskRow,
} from "@/lib/production/catalog";
import {
  buildProductionSummary,
  buildStageLoad,
  buildWarnings,
  buildWorkCenterLoad,
  missingInfoForPlanning,
  sortSetsForPlanning,
} from "@/lib/production/scheduling";
import { countUnplannedOrderItems, loadProductionBoard } from "@/lib/production/service";
import { ProductionWarnings } from "@/components/production/production-warnings";

export const dynamic = "force-dynamic";

/**
 * V136 — Màn chính module Lên kế hoạch sản xuất.
 *
 * KH24: mỗi ngày xưởng cần xem "việc hôm nay của tổ".
 * KH29: cảnh báo quá tải tổ + bộ sắp chậm tiến độ.
 */

const STATUS_TONE: Record<string, string> = {
  CHO_XEP_LICH: "bg-slate-100 text-slate-700",
  DA_XEP_LICH: "bg-cyan-100 text-cyan-800",
  DANG_SX: "bg-blue-100 text-blue-800",
  HOAN_THANH: "bg-emerald-100 text-emerald-800",
  DA_GIAO: "bg-emerald-600 text-white",
  TAM_DUNG: "bg-amber-100 text-amber-900",
  HUY: "bg-slate-200 text-slate-600",
};

/** V146 — số ngày tính cảnh báo quá tải (bảng tải theo tổ/ngày đã bỏ, cảnh báo vẫn dùng). */
const LOAD_WINDOW_DAYS = 7;

export default async function ProductionPlanPage() {
  const today = todayInVietnam();
  const from = today;
  const to = new Date(from.getTime() + (LOAD_WINDOW_DAYS - 1) * MS_DAY);

  // V146: KHÔNG lọc bộ theo khoảng ngày nữa (bảng "Tải theo tổ và ngày" đã bỏ) — bảng kế hoạch hiện MỌI bộ,
  // còn khoảng ngày chỉ dùng để tính cảnh báo quá tải (7 ngày kể từ hôm nay).
  const [board, unplannedCount] = await Promise.all([loadProductionBoard(), countUnplannedOrderItems()]);

  const { sets, tasks, workCenters, stages, config, calendar, programModels } = board;
  const loadCells = buildWorkCenterLoad({ sets, tasks, workCenters, from, to, config });
  const stageLoadCells = buildStageLoad({ sets, tasks, workCenters, stages, from, to, config });
  const warnings = buildWarnings({ sets, tasks, stages, config, calendar, loadCells, stageLoadCells, today, modelsWithProgram: programModels });
  const summary = buildProductionSummary(sets, tasks);

  const tasksBySet = new Map<number, ProductionTaskRow[]>();
  for (const task of tasks) {
    const list = tasksBySet.get(task.setId);
    if (list) list.push(task);
    else tasksBySet.set(task.setId, [task]);
  }

  const waiting = sortSetsForPlanning(sets.filter((set) => set.status === "CHO_XEP_LICH"));
  const running = sortSetsForPlanning(
    sets.filter((set) => set.status === "DANG_SX" || set.status === "DA_XEP_LICH" || set.status === "TAM_DUNG"),
  );
  const finished = sortSetsForPlanning(sets.filter((set) => set.status === "HOAN_THANH"));

  return (
    <ErpShell
      title="Kế hoạch sản xuất"
      subtitle="Mỗi dòng là 1 bộ cửa. Mở một bộ để cập nhật tiến độ từng công đoạn."
      actions={
        <div className="flex flex-wrap items-center gap-2">
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
      <div className="space-y-3">
        <section className={reportKpiGrid}>
          <ReportKpi label="Bộ trong kế hoạch" value={formatNumber(summary.total)} hint="Đã đưa từ đơn vào sản xuất" tone="neutral" />
          <ReportKpi label="Chờ xếp lịch" value={formatNumber(summary.waiting)} hint="Chưa gán ngày/tổ" tone={summary.waiting > 0 ? "warn" : "neutral"} />
          <ReportKpi label="Đang sản xuất" value={formatNumber(summary.inProgress)} hint="Đã xếp lịch hoặc đang làm" tone="neutral" />
          <ReportKpi label="Hoàn thành / đã giao" value={`${formatNumber(summary.completed)} / ${formatNumber(summary.delivered)}`} hint="Đóng gói xong / đã giao khách" tone="good" />
          <ReportKpi label="Tổng cánh" value={formatNumber(summary.totalCanh)} hint="Quy đổi từ số cánh × số bộ" tone="neutral" />
          <ReportKpi label="Tiến độ trung bình" value={`${summary.avgPercent}%`} hint="Theo công đoạn đã xong" tone="neutral" />
          <ReportKpi label="Chưa nhập vào kế hoạch" value={formatNumber(unplannedCount)} hint="Bộ của đơn đã xác nhận còn ngoài kế hoạch" tone={unplannedCount > 0 ? "warn" : "neutral"} />
          <ReportKpi label="Tạm dừng" value={formatNumber(summary.paused)} hint="Có công đoạn bị tạm dừng" tone={summary.paused > 0 ? "bad" : "neutral"} />
        </section>

        <ProductionWarnings warnings={warnings} />

        <ReportCard
          title="Bộ chờ xếp lịch"
          hint="Xếp theo hạn giao gần nhất trước (EDD). Cột “Phải bắt đầu” = hạn giao − đệm giao hàng − đường găng. **Xếp lịch bằng tay**: mở một bộ → gán ngày kế hoạch cho từng công đoạn."
          right={`${formatNumber(waiting.length)} bộ`}
        >
          {waiting.length === 0 ? (
            <p className="py-6 text-center text-[12px] text-slate-500">Không còn bộ nào chờ xếp lịch.</p>
          ) : (
            <div className="erp-scrollbar overflow-x-auto">
              <table className="erp-table">
                <thead>
                  <tr>
                    <th>Bộ số</th>
                    <th>Mã đơn</th>
                    <th>Khách hàng</th>
                    <th>Model</th>
                    <th>Màu sơn</th>
                    <th className="text-right">Cao × Rộng</th>
                    <th className="text-right">Cánh</th>
                    <th>Hạn giao</th>
                    <th>Thiếu thông tin</th>
                  </tr>
                </thead>
                <tbody>
                  {waiting.slice(0, 200).map((set) => {
                    const missing = missingInfoForPlanning(set, config);
                    return (
                      <tr key={set.id}>
                        <td className="erp-td-strong">
                          <Link className="font-semibold text-cyan-700 hover:underline" href={`/ke-hoach-san-xuat/bo/${set.id}`}>
                            {set.setNo || `#${set.id}`}
                          </Link>
                        </td>
                        <td>{set.orderCode || "—"}</td>
                        <td className="max-w-[200px] truncate" title={set.customerName ?? ""}>{set.customerName || "—"}</td>
                        <td className="max-w-[160px] truncate" title={set.model ?? ""}>{set.model || "—"}</td>
                        <td>{set.paintColor || "—"}</td>
                        <td className="erp-td-num">{set.heightMm && set.widthMm ? `${set.heightMm} × ${set.widthMm}` : "—"}</td>
                        <td className="erp-td-num">{formatNumber(canhEquivalentOf(set))}</td>
                        <td>{formatDate(set.dueDate)}</td>
                        <td>{missing.length ? <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[11px] text-amber-900">{missing.join(", ")}</span> : <span className="text-slate-400">đủ</span>}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </ReportCard>

        <ReportCard title="Đang sản xuất" hint="Mở một bộ để cập nhật tiến độ từng công đoạn." right={`${formatNumber(running.length)} bộ`}>
          {running.length === 0 ? (
            <p className="py-6 text-center text-[12px] text-slate-500">Chưa có bộ nào đang sản xuất.</p>
          ) : (
            <div className="erp-scrollbar overflow-x-auto">
              <table className="erp-table">
                <thead>
                  <tr>
                    <th>Bộ số</th>
                    <th>Mã đơn</th>
                    <th>Khách hàng</th>
                    <th>Model</th>
                    <th className="text-right">Cánh</th>
                    <th>Hạn giao</th>
                    <th>Xếp lịch</th>
                    <th className="text-right">Tiến độ</th>
                    <th>Trạng thái</th>
                    <th>Công đoạn đang làm</th>
                    <th>Tiến độ lệnh con</th>
                  </tr>
                </thead>
                <tbody>
                  {running.slice(0, 200).map((set) => {
                    const setTasks = tasksBySet.get(set.id) ?? [];
                    const current = setTasks
                      .filter((task) => task.status === "DANG_LAM" || task.status === "CHUA_LAM")
                      .map((task) => task.stageCode)
                      .slice(0, 2)
                      .join(", ");
                    return (
                      <tr key={set.id}>
                        <td className="erp-td-strong">
                          <Link className="font-semibold text-cyan-700 hover:underline" href={`/ke-hoach-san-xuat/bo/${set.id}`}>
                            {set.setNo || `#${set.id}`}
                          </Link>
                        </td>
                        <td>{set.orderCode || "—"}</td>
                        <td className="max-w-[180px] truncate" title={set.customerName ?? ""}>{set.customerName || "—"}</td>
                        <td className="max-w-[150px] truncate" title={set.model ?? ""}>{set.model || "—"}</td>
                        <td className="erp-td-num">{formatNumber(canhEquivalentOf(set))}</td>
                        <td>{formatDate(set.dueDate)}</td>
                        <td className="whitespace-nowrap text-[12px] text-slate-500">
                          {set.plannedStart ? `${formatDate(set.plannedStart)} → ${formatDate(set.plannedEnd)}` : "chưa gán"}
                        </td>
                        <td className="erp-td-num">{percentDoneOf(setTasks)}%</td>
                        <td>
                          <span className={`rounded px-1.5 py-0.5 text-[11px] ${STATUS_TONE[set.status] ?? "bg-slate-100 text-slate-700"}`}>
                            {SET_STATUS_LABELS[set.status] ?? set.status}
                          </span>
                        </td>
                        <td className="text-[12px] text-slate-600">{current || "—"}</td>
                        <td>
                          <div className="flex flex-wrap gap-1">
                            {COMPONENT_KINDS.map((kind) => {
                              const progress = componentProgress(setTasks, kind);
                              const tone =
                                progress.percent >= 100
                                  ? "bg-emerald-100 text-emerald-800"
                                  : progress.percent > 0
                                    ? "bg-blue-100 text-blue-800"
                                    : "bg-slate-100 text-slate-600";
                              return (
                                <span key={kind} className={`rounded px-1.5 py-0.5 text-[10.5px] ${tone}`} title={`${COMPONENT_LABELS[kind]} · ${progress.done}/${progress.total} công đoạn`}>
                                  {COMPONENT_LABELS[kind]} {progress.percent}%
                                </span>
                              );
                            })}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
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
          Bảng kế hoạch hiện tất cả bộ; cảnh báo quá tải tính cho {LOAD_WINDOW_DAYS} ngày kể từ hôm nay.
        </p>
      </div>
    </ErpShell>
  );
}
