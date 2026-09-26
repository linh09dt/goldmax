import Link from "next/link";
import { ErpShell } from "@/components/erp-shell";
import { ReportCard, ReportKpi, reportKpiGrid } from "@/components/reports/report-ui";
import { formatDate, formatNumber } from "@/components/order-list/format";
import { eachDay, shortDayLabel, todayInVietnam, MS_DAY } from "@/lib/production/calendar";
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
  ALL_WORKSHOP,
  buildProductionSummary,
  buildWarnings,
  buildWorkCenterLoad,
  missingInfoForPlanning,
  sortSetsForPlanning,
} from "@/lib/production/scheduling";
import { countUnplannedOrderItems, loadProductionBoard } from "@/lib/production/service";
import { ProductionWarnings } from "@/components/production/production-warnings";
import { ScheduleButton } from "@/components/production/schedule-button";

export const dynamic = "force-dynamic";

/**
 * V136 — Màn chính module Lên kế hoạch sản xuất.
 *
 * KH24: mỗi ngày xưởng cần xem "việc hôm nay của tổ".
 * KH29: cảnh báo quá tải tổ + bộ sắp chậm tiến độ.
 */

const TONE_CELL: Record<string, string> = {
  ok: "bg-emerald-50 text-emerald-800",
  warn: "bg-amber-100 text-amber-900",
  bad: "bg-red-100 text-red-800 font-semibold",
};

const STATUS_TONE: Record<string, string> = {
  CHO_XEP_LICH: "bg-slate-100 text-slate-700",
  DA_XEP_LICH: "bg-cyan-100 text-cyan-800",
  DANG_SX: "bg-blue-100 text-blue-800",
  HOAN_THANH: "bg-emerald-100 text-emerald-800",
  DA_GIAO: "bg-emerald-600 text-white",
  TAM_DUNG: "bg-amber-100 text-amber-900",
  HUY: "bg-slate-200 text-slate-600",
};

type SearchParams = { team?: string; from?: string; to?: string; days?: string };

function parseDateInput(value: string | undefined): Date | null {
  const text = String(value ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return null;
  return new Date(`${text}T00:00:00.000Z`);
}

function toInputDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

export default async function ProductionPlanPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const today = todayInVietnam();
  const from = parseDateInput(params.from) ?? today;
  const days = Math.min(21, Math.max(1, Number(params.days) || 7));
  const to = new Date(from.getTime() + (days - 1) * MS_DAY);
  const teamFilter = String(params.team ?? "").trim();

  const [board, unplannedCount] = await Promise.all([
    loadProductionBoard({ from, to, includeUndated: true }),
    countUnplannedOrderItems(),
  ]);

  const { sets, tasks, workCenters, stages, config, calendar, programModels } = board;
  const loadCells = buildWorkCenterLoad({ sets, tasks, workCenters, from, to, config });
  const warnings = buildWarnings({ sets, tasks, stages, config, calendar, loadCells, today, modelsWithProgram: programModels });
  const summary = buildProductionSummary(sets, tasks);

  const dayList = eachDay(from, to);
  const centerRows = workCenters.filter((center) => {
    if (center.kind !== "TO") return false;
    return teamFilter ? center.code === teamFilter : true;
  });
  const cellAt = (centerCode: string, day: Date) =>
    loadCells.find((cell) => cell.workCenterCode === centerCode && cell.day.getTime() === day.getTime());
  const workshopAt = (day: Date) => cellAt(ALL_WORKSHOP, day);

  const tasksBySet = new Map<number, ProductionTaskRow[]>();
  for (const task of tasks) {
    const list = tasksBySet.get(task.setId);
    if (list) list.push(task);
    else tasksBySet.set(task.setId, [task]);
  }

  const visibleSets = teamFilter
    ? sets.filter((set) => (tasksBySet.get(set.id) ?? []).some((task) => task.workCenterCode === teamFilter))
    : sets;

  const waiting = sortSetsForPlanning(visibleSets.filter((set) => set.status === "CHO_XEP_LICH"));
  const running = sortSetsForPlanning(
    visibleSets.filter((set) => set.status === "DANG_SX" || set.status === "DA_XEP_LICH" || set.status === "TAM_DUNG"),
  );
  const finished = sortSetsForPlanning(visibleSets.filter((set) => set.status === "HOAN_THANH"));

  const filterHref = (patch: Record<string, string | undefined>) => {
    const query = new URLSearchParams();
    const merged = { team: teamFilter || undefined, from: toInputDate(from), days: String(days), ...patch };
    for (const [key, value] of Object.entries(merged)) if (value) query.set(key, value);
    return `/ke-hoach-san-xuat?${query.toString()}`;
  };

  return (
    <ErpShell
      title="Kế hoạch sản xuất"
      subtitle="Mỗi dòng là 1 bộ cửa. Tính tải theo CÁNH (đơn vị xưởng đang dùng), tiến độ theo từng công đoạn."
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <ScheduleButton pendingCount={summary.waiting} />
          <Link className="erp-button-secondary" href="/ke-hoach-san-xuat/nhap-do-dang">
            Nhập bộ đang sản xuất dở{unplannedCount > 0 ? ` (${formatNumber(unplannedCount)})` : ""}
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
          hint="Xếp theo hạn giao gần nhất trước (EDD). Cột “Phải bắt đầu” = hạn giao − đệm giao hàng − đường găng."
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

        <ReportCard
          title="Tải theo tổ và ngày"
          hint="Mỗi bộ chỉ đếm 1 lần cho mỗi tổ trong ngày, dù đi qua nhiều công đoạn của tổ đó. Đỏ = vượt năng lực, vàng = trên 85%."
          right={`${formatNumber(days)} ngày`}
        >
          <div className="mb-2 flex flex-wrap items-center gap-2 text-[12px]">
            <span className="text-slate-500">Lọc tổ:</span>
            <Link className={`rounded px-2 py-1 ${teamFilter ? "text-cyan-700 hover:underline" : "bg-slate-800 text-white"}`} href={filterHref({ team: undefined })}>
              Tất cả
            </Link>
            {workCenters
              .filter((center) => center.kind === "TO")
              .map((center) => (
                <Link
                  key={center.code}
                  className={`rounded px-2 py-1 ${teamFilter === center.code ? "bg-slate-800 text-white" : "text-cyan-700 hover:underline"}`}
                  href={filterHref({ team: center.code })}
                >
                  {center.name}
                </Link>
              ))}
            <span className="ml-auto flex items-center gap-3">
              <Link className="text-cyan-700 hover:underline" href={filterHref({ from: toInputDate(new Date(from.getTime() - days * MS_DAY)) })}>
                ← {days} ngày trước
              </Link>
              <Link className="text-cyan-700 hover:underline" href={filterHref({ from: toInputDate(today) })}>
                Hôm nay
              </Link>
              <Link className="text-cyan-700 hover:underline" href={filterHref({ from: toInputDate(new Date(from.getTime() + days * MS_DAY)) })}>
                {days} ngày sau →
              </Link>
            </span>
          </div>

          <div className="erp-scrollbar overflow-x-auto">
            <table className="erp-table">
              <thead>
                <tr>
                  <th className="min-w-[190px]">Tổ</th>
                  {dayList.map((day) => (
                    <th key={day.toISOString()} className="text-center">
                      {shortDayLabel(day)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {centerRows.map((center) => (
                  <tr key={center.code}>
                    <td className="erp-td-strong">
                      <div>{center.name}</div>
                      <div className="text-[11px] font-normal text-slate-500">
                        Năng lực: {center.capacityPerDay ? `${formatNumber(center.capacityPerDay)} ${center.capacityUnit}/ngày` : "chưa khai"}
                      </div>
                    </td>
                    {dayList.map((day) => {
                      const cell = cellAt(center.code, day);
                      return (
                        <td key={day.toISOString()} className={`text-center tabular-nums ${cell ? TONE_CELL[cell.tone] : "text-slate-300"}`}>
                          {cell ? (
                            <div>
                              <div>{formatNumber(cell.canh)}</div>
                              <div className="text-[10px] opacity-70">{cell.sets} bộ</div>
                            </div>
                          ) : (
                            "—"
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
                <tr className="border-t-2 border-slate-300">
                  <td className="erp-td-strong">
                    <div>Toàn xưởng</div>
                    <div className="text-[11px] font-normal text-slate-500">
                      Vàng &gt; {formatNumber(config.dailyWarnCanh)} · Đỏ &gt; {formatNumber(config.dailyMaxCanh)} cánh/ngày
                    </div>
                  </td>
                  {dayList.map((day) => {
                    const cell = workshopAt(day);
                    return (
                      <td key={day.toISOString()} className={`text-center tabular-nums ${cell ? TONE_CELL[cell.tone] : "text-slate-300"}`}>
                        {cell ? formatNumber(cell.canh) : "—"}
                      </td>
                    );
                  })}
                </tr>
              </tbody>
            </table>
          </div>
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
          {config.overlapHoursPerStep > 0
            ? ` Đang bật gối công đoạn ${config.overlapHoursPerStep} giờ/bước.`
            : " Chưa bật gối công đoạn (đang cộng dồn thời lượng — cách tính an toàn)."}
        </p>
      </div>
    </ErpShell>
  );
}
