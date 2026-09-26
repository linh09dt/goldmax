import Link from "next/link";
import { notFound } from "next/navigation";
import { ErpShell } from "@/components/erp-shell";
import { ReportCard, ReportKpi, reportKpiGrid } from "@/components/reports/report-ui";
import { SetProgressForm, type ProgressTask } from "@/components/production/set-progress-form";
import { ProductionWarnings } from "@/components/production/production-warnings";
import { formatDate, formatNumber } from "@/components/order-list/format";
import {
  componentProgress,
  componentQuantities,
  COMPONENT_KINDS,
  COMPONENT_LABELS,
  SCOPE_LABELS,
  SET_STATUS_LABELS,
  STAGE_KIND_LABELS,
  percentDoneOf,
  taskUnlockState,
  type ComponentKind,
  type ProductionSetRow,
  type ProductionTaskRow,
} from "@/lib/production/catalog";
import { hoursToWorkingDays, subtractWorkingDays, todayInVietnam } from "@/lib/production/calendar";
import { buildWarnings, buildWorkCenterLoad, missingInfoForPlanning, setLeadHoursFromTasks } from "@/lib/production/scheduling";
import { loadActiveWorkCenters, loadSetDetail } from "@/lib/production/service";

export const dynamic = "force-dynamic";

/**
 * V136 — Chi tiết 1 BỘ CỬA: timeline 13 công đoạn + ô cập nhật tiến độ.
 * Đây là màn nhập chính của văn phòng xưởng (KH21/KH23).
 */
export default async function ProductionSetPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const setId = Number(id);
  if (!Number.isInteger(setId) || setId <= 0) notFound();

  const [detail, workCenters] = await Promise.all([loadSetDetail(setId), loadActiveWorkCenters()]);
  if (!detail) notFound();

  const { set, config, stages, reasons, calendar, logs, programModels } = detail;
  const setRow = set as unknown as ProductionSetRow;
  const tasks = set.tasks as unknown as ProductionTaskRow[];
  const stageByCode = new Map(stages.map((stage) => [stage.code, stage]));
  const centerByCode = new Map(workCenters.map((center) => [center.code, center]));

  const canh = Number(setRow.canhEquivalent) || 1;
  const missing = missingInfoForPlanning(setRow, config);
  const leadHours = setLeadHoursFromTasks(tasks, stages, config);
  const leadDays = hoursToWorkingDays(leadHours, config);
  const workshopDue = setRow.dueDate ? subtractWorkingDays(setRow.dueDate, config.deliveryBufferDays, calendar) : null;
  const modelHasProgram = programModels.has(String(setRow.model ?? "").trim().toUpperCase());

  const warnings = buildWarnings({
    sets: [setRow],
    tasks,
    stages,
    config,
    calendar,
    loadCells: buildWorkCenterLoad({ sets: [setRow], tasks, workCenters, from: todayInVietnam(), to: todayInVietnam(), config }),
    today: todayInVietnam(),
    modelsWithProgram: programModels,
  }).filter((warning) => warning.kind === "SAP_TRE" || warning.kind === "CHUA_DU_THONG_TIN" || warning.kind === "CHUA_CO_CHUONG_TRINH");

  // V136.1 — trạng thái khoá của từng công đoạn (gate đủ bộ).
  const lockRows = tasks.map((task) => ({ stageCode: task.stageCode, scope: task.scope, status: task.status }));
  const lockedReasonOf = (task: ProductionTaskRow): string | null => {
    const state = taskUnlockState(task, lockRows, stageByCode);
    if (state.unlocked) return null;
    return state.waitingFor.map((code) => stageByCode.get(code)?.name ?? code).join(", ");
  };

  // Số lượng theo CÔNG THỨC (để so với số sửa tay trên form).
  const formulaQty = componentQuantities(setRow, { cuaDi: config.defaultTrimCuaDi, cuaSo: config.defaultTrimCuaSo });
  const componentRows = COMPONENT_KINDS.map((kind) => {
    const progress = componentProgress(tasks, kind);
    const child = (set.componentOrders ?? []).find((row) => row.kind === kind);
    return { kind: kind as ComponentKind, progress, qtyExpected: child?.qtyExpected ?? null, childId: child?.id ?? null };
  });

  const progressTasks: ProgressTask[] = tasks.map((task) => {
    const stage = stageByCode.get(task.stageCode);
    return {
      id: task.id,
      stageCode: task.stageCode,
      stageName: stage?.name ?? task.stageCode,
      stageKind: task.stageKind,
      scope: task.scope,
      scopeLabel: SCOPE_LABELS[task.scope] ?? task.scope,
      workCenterName: task.workCenterCode ? centerByCode.get(task.workCenterCode)?.name ?? task.workCenterCode : null,
      status: task.status,
      qtyExpected: task.qtyExpected,
      qtyDone: task.qtyDone,
      actualStart: task.actualStart ? new Date(task.actualStart).toISOString() : null,
      actualEnd: task.actualEnd ? new Date(task.actualEnd).toISOString() : null,
      assignee: task.assignee,
      isRework: task.isRework,
      reasonCode: task.reasonCode,
      note: task.note,
      lockedReason: lockedReasonOf(task),
    };
  });

  const doneCount = tasks.filter((task) => task.status === "XONG" && task.stageKind !== "CHO").length;
  const workCount = tasks.filter((task) => task.stageKind !== "CHO" && task.status !== "BO_QUA").length;
  const skipped = tasks.filter((task) => task.status === "BO_QUA");

  return (
    <ErpShell
      title={`Bộ cửa ${setRow.setNo || `#${setRow.id}`}`}
      subtitle={`${setRow.orderCode ?? ""} · ${setRow.customerName ?? ""} · ${setRow.model ?? "chưa rõ model"}`}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Link className="erp-button-secondary" href="/ke-hoach-san-xuat">
            ← Bảng kế hoạch
          </Link>
          <a className="erp-button" href={`/ke-hoach-san-xuat/in/phieu-lenh?bo=${setRow.id}`} target="_blank" rel="noreferrer">
            In phiếu lệnh SX
          </a>
          {setRow.orderId ? (
            <Link className="erp-button-secondary" href={`/orders/${setRow.orderId}`}>
              Mở đơn hàng
            </Link>
          ) : null}
        </div>
      }
    >
      <div className="space-y-3">
        <section className={reportKpiGrid}>
          <ReportKpi label="Trạng thái" value={SET_STATUS_LABELS[setRow.status] ?? setRow.status} hint="Suy từ trạng thái công đoạn" tone={setRow.status === "TAM_DUNG" ? "bad" : setRow.status === "HOAN_THANH" || setRow.status === "DA_GIAO" ? "good" : "neutral"} />
          <ReportKpi label="Tiến độ" value={`${percentDoneOf(tasks)}%`} hint={`${doneCount}/${workCount} công đoạn xong`} tone="neutral" />
          <ReportKpi label="Số cánh" value={formatNumber(canh)} hint={`${setRow.leavesPerSet ?? 1} cánh × ${setRow.quantity ?? 1} bộ`} tone="neutral" />
          <ReportKpi
            label="Hạn giao"
            value={formatDate(setRow.dueDate)}
            hint={workshopDue ? `Xưởng phải xong trước ${formatDate(workshopDue)}` : "chưa có hạn giao"}
            tone={setRow.dueDate && setRow.dueDate.getTime() < todayInVietnam().getTime() ? "bad" : "neutral"}
          />
          <ReportKpi label="Đường găng" value={`${formatNumber(leadDays)} ngày`} hint={`${formatNumber(leadHours)} giờ · ${tasks.length} công đoạn`} tone="neutral" />
          <ReportKpi
            label="Chương trình máy cắt"
            value={modelHasProgram ? "đã có" : "chưa có"}
            hint={modelHasProgram ? "Model đã có chương trình → Bồi Lares bỏ qua" : "Bồi Lares chặn Cắt"}
            tone={modelHasProgram ? "good" : "warn"}
          />
          <ReportKpi label="Thông tin xếp lịch" value={missing.length ? "còn thiếu" : "đủ"} hint={missing.length ? `Thiếu: ${missing.join(", ")}` : "Đã đủ để xếp lịch"} tone={missing.length ? "warn" : "good"} />
          <ReportKpi label="Đã giao" value={setRow.actualDeliveredAt ? formatDate(new Date(setRow.actualDeliveredAt)) : "chưa"} hint="Ngày giao thực tế (L13)" tone={setRow.actualDeliveredAt ? "good" : "neutral"} />
        </section>

        <ProductionWarnings warnings={warnings} />

        <ReportCard
          title="Lệnh sản xuất cha – con"
          hint="Cha = bộ cửa. Con = cánh / khung / phào — cắt, chấn, hàn, vân làm riêng từng phần; test cơ khí và sơn làm cho cả bộ."
        >
          <div className="erp-scrollbar overflow-x-auto">
            <table className="erp-table">
              <thead>
                <tr>
                  <th>Lệnh</th>
                  <th>Phần</th>
                  <th className="text-right">Số lượng</th>
                  <th className="text-right">Tiến độ</th>
                  <th>Trạng thái</th>
                  <th>Xếp lịch</th>
                  <th>Việc phải làm</th>
                </tr>
              </thead>
              <tbody>
                <tr className="bg-slate-50/70">
                  <td className="erp-td-strong">CHA</td>
                  <td>Bộ cửa {setRow.setNo || `#${setRow.id}`}</td>
                  <td className="erp-td-num">{setRow.quantity ?? 1}</td>
                  <td className="erp-td-num font-semibold">{percentDoneOf(tasks)}%</td>
                  <td>{SET_STATUS_LABELS[setRow.status] ?? setRow.status}</td>
                  <td className="whitespace-nowrap text-[12px] text-slate-500">
                    {setRow.plannedStart ? `${formatDate(setRow.plannedStart)} → ${formatDate(setRow.plannedEnd)}` : "chưa gán"}
                  </td>
                  <td className="text-[11.5px] text-slate-500">Thiết kế · Bồi Lares · Test cơ khí · Sơn · Lắp kính · Đóng gói · Kho</td>
                </tr>
                {componentRows.map((row) => (
                  <tr key={row.kind}>
                    <td className="erp-td-strong">CON</td>
                    <td className="font-medium text-slate-800">{COMPONENT_LABELS[row.kind]}</td>
                    <td className="erp-td-num">{row.qtyExpected ?? "—"}</td>
                    <td className="erp-td-num font-semibold">{row.progress.percent}%</td>
                    <td>{SET_STATUS_LABELS[row.progress.status] ?? row.progress.status}</td>
                    <td className="whitespace-nowrap text-[12px] text-slate-500">
                      {row.progress.plannedStart ? `${formatDate(row.progress.plannedStart)} → ${formatDate(row.progress.plannedEnd)}` : "chưa gán"}
                    </td>
                    <td className="text-[11.5px] text-slate-500">
                      Cắt · Chấn · Hàn · Vân{row.kind === "CANH" ? " · Ép cánh" : ""} ({row.progress.done}/{row.progress.total} công đoạn)
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="erp-hint px-3 pb-3 pt-1">
            Gate: <strong>Test cơ khí</strong> chỉ mở khi cả 3 lệnh con đã hàn xong. <strong>Lắp kính + Vệ sinh/Đóng gói</strong> chỉ mở khi cả 3
            lệnh con đã vân xong. Sơn làm cho cả bộ 1 lượt, sau khi test đạt.
          </p>
        </ReportCard>

        <ReportCard title="Cập nhật tiến độ theo công đoạn" hint="Thay đổi nhiều dòng rồi bấm Lưu một lần — hệ thống ghi gộp trong 1 lượt.">
          <SetProgressForm
            setId={setRow.id}
            tasks={progressTasks}
            reasons={reasons.map((reason) => ({ code: reason.code, name: reason.name, group: reason.group }))}
            components={componentRows
              .filter((row): row is typeof row & { childId: number } => row.childId !== null)
              .map((row) => ({
                id: row.childId,
                kind: row.kind,
                kindLabel: COMPONENT_LABELS[row.kind],
                qtyExpected: row.qtyExpected,
                formulaQty: formulaQty[row.kind],
              }))}
            plannedStart={setRow.plannedStart ? setRow.plannedStart.toISOString().slice(0, 10) : null}
            plannedEnd={setRow.plannedEnd ? setRow.plannedEnd.toISOString().slice(0, 10) : null}
            byName={null}
          />
          {skipped.length ? (
            <p className="erp-hint mt-2">
              Bỏ qua {skipped.length} công đoạn: {skipped.map((task) => `${stageByCode.get(task.stageCode)?.name ?? task.stageCode} (${SCOPE_LABELS[task.scope] ?? task.scope})`).join(", ")}
            </p>
          ) : null}
        </ReportCard>

        <div className="grid gap-3 lg:grid-cols-2">
          <ReportCard title="Thông tin bộ cửa" hint="Đọc từ đơn hàng — sửa ở module đơn hàng, không sửa tại đây.">
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 px-3 py-3 text-[12.5px]">
              {[
                ["Bộ số", setRow.setNo ?? "—"],
                ["Mã đơn", setRow.orderCode ?? "—"],
                ["Loại đơn", setRow.orderType],
                ["Khách hàng", setRow.customerName ?? "—"],
                ["Sản phẩm", setRow.productName ?? "—"],
                ["Model", setRow.model ?? "—"],
                ["Hướng mở", setRow.openingDirection ?? "—"],
                ["Màu sơn", setRow.paintColor ?? "—"],
                ["Mã vân", setRow.veneerCode ?? "—"],
                ["Cao × Rộng", setRow.heightMm && setRow.widthMm ? `${setRow.heightMm} × ${setRow.widthMm} mm` : "—"],
                ["Số cánh / bộ", formatNumber(setRow.leavesPerSet ?? 1)],
                ["Số bộ", formatNumber(setRow.quantity ?? 1)],
                ["Số phào / bộ", formatNumber(setRow.trimBarsPerSet ?? 1)],
                ["KH/Lượng", setRow.pricingQuantity === null ? "—" : formatNumber(setRow.pricingQuantity)],
                ["Hoàn thành SX", setRow.actualCompletedAt ? formatDate(new Date(setRow.actualCompletedAt)) : "—"],
              ].map(([label, value]) => (
                <div key={label} className="min-w-0">
                  <dt className="text-[10.5px] font-semibold uppercase tracking-wide text-slate-500">{label}</dt>
                  <dd className="truncate text-slate-800" title={String(value)}>{value}</dd>
                </div>
              ))}
            </dl>
          </ReportCard>

          <ReportCard title="Lịch sử cập nhật" hint="J1: lưu ai đổi gì, lúc nào (chưa có đăng nhập nên tên do người nhập gõ).">
            {logs.length === 0 ? (
              <p className="px-3 py-6 text-center text-[12px] text-slate-500">Chưa có thay đổi nào.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {logs.map((log) => (
                  <li key={log.id} className="px-3 py-1.5 text-[12px]">
                    <span className="font-medium text-slate-800">{log.action}</span>
                    <span className="text-slate-500">
                      {" "}
                      · {log.field ?? ""} {log.oldValue ? `“${log.oldValue}” → ` : ""}
                      {log.newValue ? `“${log.newValue}”` : ""}
                    </span>
                    <span className="ml-1 text-slate-400">
                      · {log.byName || "không rõ"} · {formatDate(log.createdAt)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </ReportCard>
        </div>

        <ReportCard title="Danh sách công đoạn theo thứ tự" hint="Từ danh mục công đoạn — sửa ở Cấu hình sản xuất.">
          <div className="erp-scrollbar overflow-x-auto">
            <table className="erp-table">
              <thead>
                <tr>
                  <th className="text-right">Bước</th>
                  <th>Công đoạn</th>
                  <th>Loại</th>
                  <th>Bộ phận</th>
                  <th>Tổ</th>
                  <th className="text-right">Thời lượng</th>
                  <th className="text-right">SL dự kiến</th>
                  <th>Ghi chú danh mục</th>
                </tr>
              </thead>
              <tbody>
                {tasks.map((task) => {
                  const stage = stageByCode.get(task.stageCode);
                  return (
                    <tr key={task.id}>
                      <td className="erp-td-num">{task.seq}</td>
                      <td className="erp-td-strong">{stage?.name ?? task.stageCode}</td>
                      <td className="text-[12px] text-slate-600">{STAGE_KIND_LABELS[task.stageKind] ?? task.stageKind}</td>
                      <td>{SCOPE_LABELS[task.scope] ?? task.scope}</td>
                      <td className="text-[12px] text-slate-600">{task.workCenterCode ? centerByCode.get(task.workCenterCode)?.name ?? task.workCenterCode : "—"}</td>
                      <td className="erp-td-num">{stage?.leadTimeHours ? `${stage.leadTimeHours} giờ` : "—"}</td>
                      <td className="erp-td-num">{task.qtyExpected ?? "—"}</td>
                      <td className="max-w-[420px] text-[11.5px] text-slate-500">{stage?.note ?? ""}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </ReportCard>
      </div>
    </ErpShell>
  );
}
