import Link from "next/link";
import { notFound } from "next/navigation";
import { ErpShell } from "@/components/erp-shell";
import { ReportCard, ReportKpi, reportKpiGrid } from "@/components/reports/report-ui";
import { SetProgressForm, type ProgressTask } from "@/components/production/set-progress-form";
import { StartProductionForm } from "@/components/production/start-production-form";
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
import { subtractWorkingDays, todayInVietnam, workingDaysBetween } from "@/lib/production/calendar";
import { buildWarnings, buildWorkCenterLoad, missingInfoForPlanning, setLeadDaysFromTasks } from "@/lib/production/scheduling";
import { loadActiveWorkCenters, loadSetDetail, parseIsoDateStrict, previewSetStart, type StartPreview } from "@/lib/production/service";

export const dynamic = "force-dynamic";

/**
 * V136 — Chi tiết 1 BỘ CỬA: timeline 13 công đoạn + ô cập nhật tiến độ.
 * Đây là màn nhập chính của văn phòng xưởng (KH21/KH23).
 */
export default async function ProductionSetPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ngay?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
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
  // V145: số ngày đường găng = tổng `lead_time_days` theo bước (cùng bước = song song, tính 1 lần).
  const leadDays = setLeadDaysFromTasks(tasks, stages, config);
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
  }).filter(
    (warning) =>
      warning.kind === "SAP_TRE" ||
      warning.kind === "CHUA_DU_THONG_TIN" ||
      warning.kind === "CHUA_CO_CHUONG_TRINH" ||
      warning.kind === "CHAM_CONG_DOAN" ||
      warning.kind === "KHONG_KIP",
  );

  // V142 — mã lệnh sản xuất: lệnh cha (bộ), 3 lệnh con và mã của từng công đoạn.
  const codeByTaskId = new Map<number, string>();
  const codeByKind = new Map<string, string>();
  for (const order of set.workOrders ?? []) {
    if (order.taskId !== null) codeByTaskId.set(order.taskId, order.code);
    else codeByKind.set(order.kind, order.code);
  }

  // V144 — chưa vào sản xuất thì cho xem trước MỐC theo ngày bắt đầu (?ngay=YYYY-MM-DD).
  // "Đã vào sản xuất" xét CẢ `started_at` LẪN trạng thái (bộ có thể thành DANG_SX do công đoạn đầu
  // được đặt tay trong form tiến độ, khi đó chưa có `started_at`).
  const started =
    setRow.startedAt !== null || setRow.status === "DANG_SX" || setRow.status === "HOAN_THANH" || setRow.status === "DA_GIAO";
  const todayVn = todayInVietnam().toISOString().slice(0, 10);
  const requestedStart = parseIsoDateStrict(query.ngay) ?? new Date(`${todayVn}T00:00:00.000Z`);
  const preview: StartPreview | null = started ? null : await previewSetStart(setId, requestedStart);
  const workshopDueOfSet = setRow.dueDate
    ? subtractWorkingDays(setRow.dueDate, config.deliveryBufferDays, calendar)
    : null;
  const storedLateDays =
    setRow.targetEnd && workshopDueOfSet && setRow.targetEnd.getTime() > workshopDueOfSet.getTime()
      ? workingDaysBetween(workshopDueOfSet, setRow.targetEnd, calendar)
      : null;

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
      // V142 — mã lệnh sản xuất của công đoạn (in trên phiếu, đối chiếu ở xưởng).
      workOrderCode: codeByTaskId.get(task.id) ?? null,
      // V144 — mốc (target) hệ thống tự suy từ ngày bắt đầu sản xuất.
      targetStart: task.targetStart ? new Date(task.targetStart).toISOString().slice(0, 10) : null,
      targetEnd: task.targetEnd ? new Date(task.targetEnd).toISOString().slice(0, 10) : null,
      // V141 — ngày kế hoạch của công đoạn để gán bằng tay trong form.
      plannedStart: task.plannedStart ? new Date(task.plannedStart).toISOString().slice(0, 10) : null,
      actualStart: task.actualStart ? new Date(task.actualStart).toISOString() : null,
      actualEnd: task.actualEnd ? new Date(task.actualEnd).toISOString() : null,
      assignee: task.assignee,
      isRework: task.isRework,
      reasonCode: task.reasonCode,
      note: task.note,
      lockedReason: lockedReasonOf(task),
    };
  });

  const doneCount = tasks.filter((task) => task.status === "XONG" && task.stageKind !== "CHO").length;  const workCount = tasks.filter((task) => task.stageKind !== "CHO" && task.status !== "BO_QUA").length;
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
          <ReportKpi label="Đường găng" value={`${formatNumber(leadDays)} ngày`} hint={`${tasks.length} công đoạn · cùng bước tính 1 lần`} tone="neutral" />
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
          title="Kế hoạch sản xuất của bộ"
          hint="V144 — nhập MỘT mốc ngày bắt đầu; hệ thống tự suy mốc (target) của mọi công đoạn theo thứ tự bước + số giờ."
        >
          <StartProductionForm setId={setRow.id} defaultDate={String(query.ngay ?? todayVn)} started={started} />
          {started ? (
            <p className="px-3 pb-3 text-[12.5px] text-slate-700">
              Đã đưa vào sản xuất từ <strong>{formatDate(setRow.startedAt)}</strong> · dự kiến xong{" "}
              <strong>{formatDate(setRow.targetEnd)}</strong>
              {storedLateDays !== null ? (
                <span className="font-semibold text-red-700">
                  {" "}· KHÔNG KỊP: muộn {Math.max(1, storedLateDays)} ngày so với hạn xưởng {formatDate(workshopDueOfSet)}
                </span>
              ) : workshopDueOfSet ? (
                <span className="text-emerald-700"> · kịp hạn xưởng {formatDate(workshopDueOfSet)}</span>
              ) : null}
            </p>
          ) : preview ? (
            <div className="space-y-2 px-3 pb-3">
              <p
                className={`rounded-lg px-3 py-2 text-[12.5px] ${
                  preview.lateDays !== null ? "bg-red-50 text-red-800" : "bg-emerald-50 text-emerald-800"
                }`}
              >
                Dự kiến xong <strong>{formatDate(preview.end)}</strong> · {preview.totalDays} ngày làm việc
                {preview.workshopDue
                  ? preview.lateDays !== null
                    ? ` · KHÔNG KỊP: muộn ${Math.max(1, preview.lateDays)} ngày so với hạn xưởng ${formatDate(preview.workshopDue)}`
                    : ` · kịp hạn xưởng ${formatDate(preview.workshopDue)}`
                  : " · đơn chưa có hạn giao"}
                {preview.movedToWorkingDay
                  ? ` · ${formatDate(preview.requestedStart)} là ngày nghỉ nên dời sang ${formatDate(preview.start)}`
                  : ""}
              </p>
              <div className="erp-scrollbar overflow-x-auto">
                <table className="erp-table">
                  <thead>
                    <tr>
                      <th className="text-right">Bước</th>
                      <th>Công đoạn của bước (chạy song song, cùng ngày)</th>
                      <th className="text-right">Số ngày</th>
                      <th>Mốc bắt đầu → xong</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.steps.map((step) => (
                      <tr key={step.seq}>
                        <td className="erp-td-num">{step.seq}</td>
                        <td>{step.codes.map((code) => stageByCode.get(code)?.name ?? code).join(" · ")}</td>
                        <td className="erp-td-num">{step.days}</td>
                        <td className="whitespace-nowrap">
                          {formatDate(new Date(`${step.start}T00:00:00.000Z`))}
                          {step.end !== step.start ? ` → ${formatDate(new Date(`${step.end}T00:00:00.000Z`))}` : ""}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <p className="erp-hint px-3 pb-3">
              Bộ chưa có công đoạn nào (danh mục công đoạn đang trống) — không suy được mốc.
            </p>
          )}
        </ReportCard>

        <ReportCard
          title="Lệnh sản xuất cha – con"
          hint="Cha = bộ cửa. Con = cánh / khung / phào — cắt, chấn, hàn, vân làm riêng từng phần; test cơ khí và sơn làm cho cả bộ."
        >
          <div className="erp-scrollbar overflow-x-auto">
            <table className="erp-table">
              <thead>
                <tr>
                  <th>Lệnh</th>
                  <th>Mã lệnh</th>
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
                  <td className="whitespace-nowrap text-[11px] font-medium tabular-nums text-slate-500">{codeByKind.get("BO") ?? "—"}</td>
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
                    <td className="whitespace-nowrap text-[11px] font-medium tabular-nums text-slate-500">{codeByKind.get(row.kind) ?? "—"}</td>
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
            todayVn={todayVn}
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
                ["Mã lệnh (bộ)", codeByKind.get("BO") ?? "—"],
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
                  <th className="whitespace-nowrap">Mốc (target)</th>
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
                      <td className="erp-td-num">{stage?.leadTimeDays ? `${stage.leadTimeDays} ngày` : "—"}</td>
                      <td className="whitespace-nowrap text-[11.5px]">
                        {task.targetStart ? (
                          <>
                            {formatDate(task.targetStart)}
                            {task.targetEnd && task.targetEnd.getTime() !== task.targetStart.getTime()
                              ? ` → ${formatDate(task.targetEnd)}`
                              : ""}
                          </>
                        ) : (
                          "—"
                        )}
                        {task.targetEnd &&
                        task.status !== "XONG" &&
                        task.status !== "BO_QUA" &&
                        task.targetEnd.toISOString().slice(0, 10) < todayVn ? (
                          <span className="ml-1 font-semibold text-red-700">chậm</span>
                        ) : null}
                      </td>
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
