"use client";

import { useMemo, useState } from "react";
import { ReportCard, ReportKpi, reportKpiGrid } from "@/components/reports/report-ui";

/**
 * V148 — Màn "KẾ HOẠCH CHO TỪNG CÔNG ĐOẠN".
 *
 * Xem trước (không ghi) → xem tải mỗi công đoạn × ngày + ngày kế hoạch từng bộ → mới bấm GHI.
 * Ngày xếp XUÔI theo NĂNG LỰC; cột "Mốc (target)" chỉ để đối chiếu "có kịp không" (từ lead time).
 */

type LoadCell = {
  day: string;
  stageCode: string;
  stageName: string;
  seq: number;
  workCenterCode: string | null;
  worked: number;
  unit: "CANH" | "BO";
  capacity: number | null;
  capacitySource: "CONG_DOAN" | "TO" | "CHUA_KHAI";
  ratio: number | null;
  tone: "ok" | "warn" | "bad";
  sets: number;
};

type SetRow = {
  setId: number;
  setNo: string | null;
  orderCode: string | null;
  customerName: string | null;
  paintColor: string | null;
  dueDate: string | null;
  plannedStart: string | null;
  plannedEnd: string | null;
  canh: number;
  tasksPlanned: number;
  tasksTotal: number;
  targetEnd: string | null;
  lateVsTarget: boolean;
  workshopDue: string | null;
  lateVsDue: boolean;
};

type Warning = { kind: string; stageCode: string | null; setId: number | null; message: string };

type ApplyResult = { sets: number; tasks: number; statuses: number; warnings: number };

type PreviewResult = {
  tasks: Array<{ setId: number; state: string }>;
  loads: LoadCell[];
  warnings: Warning[];
  sets: SetRow[];
  stats: {
    setsPlanned: number;
    tasksPlanned: number;
    tasksKept: number;
    tasksSkipped: number;
    tasksOverflow: number;
    firstDay: string | null;
    lastDay: string | null;
    workingDays: number;
  };
};

const SOURCE_LABELS: Record<string, string> = {
  CONG_DOAN: "công đoạn",
  TO: "theo tổ",
  CHUA_KHAI: "chưa khai",
};

function formatDay(value: string | null | undefined): string {
  if (!value) return "—";
  const text = value.slice(0, 10);
  return `${text.slice(8, 10)}/${text.slice(5, 7)}/${text.slice(0, 4)}`;
}

function toneClass(tone: string): string {
  if (tone === "bad") return "bg-red-50 text-red-700";
  if (tone === "warn") return "bg-amber-50 text-amber-800";
  return "bg-emerald-50 text-emerald-800";
}

export function StagePlanBoard({ today }: { today: string }) {
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState("");
  const [scope, setScope] = useState("CHO_XEP_LICH");
  const [stageFilter, setStageFilter] = useState("");
  const [busy, setBusy] = useState<"preview" | "apply" | null>(null);
  const [result, setResult] = useState<PreviewResult | null>(null);
  const [message, setMessage] = useState<{ tone: "ok" | "err"; text: string } | null>(null);

  const request = async (action: "preview" | "apply") => {
    setBusy(action);
    setMessage(null);
    try {
      const response = await fetch("/api/production/stage-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ action, from: from || null, to: to || null, scope }),
      });
      const payload = (await response.json()) as ({ ok?: boolean; error?: string } & PreviewResult & Partial<ApplyResult>);
      if (!response.ok || !payload.ok) throw new Error(payload.error || "Không lập được kế hoạch.");

      if (action === "preview") {
        setResult(payload);
        setMessage({
          tone: "ok",
          text: `Xem trước: ${payload.stats.setsPlanned} bộ · ${payload.stats.tasksPlanned} công đoạn được xếp · ${payload.warnings.length} cảnh báo. Chưa ghi gì vào hệ thống.`,
        });
      } else {
        await request("preview");
        setMessage({
          tone: "ok",
          text: `Đã ghi kế hoạch cho ${payload.sets ?? 0} bộ · ${payload.tasks ?? 0} công đoạn (${payload.statuses ?? 0} bộ chuyển sang Đã xếp lịch).`,
        });
      }
    } catch (error) {
      setMessage({ tone: "err", text: error instanceof Error ? error.message : "Lỗi không rõ." });
    } finally {
      setBusy(null);
    }
  };

  const stageOptions = useMemo(() => {
    if (!result) return [];
    const map = new Map<string, string>();
    for (const cell of result.loads) map.set(cell.stageCode, cell.stageName);
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1], "vi"));
  }, [result]);

  const loadRows = useMemo(() => {
    if (!result) return [];
    const rows = stageFilter ? result.loads.filter((cell) => cell.stageCode === stageFilter) : result.loads;
    return rows.slice(0, 400);
  }, [result, stageFilter]);

  const setRows = useMemo(() => {
    if (!result) return [];
    return [...result.sets]
      .sort((a, b) => {
        if (a.lateVsDue !== b.lateVsDue) return a.lateVsDue ? -1 : 1;
        if (a.lateVsTarget !== b.lateVsTarget) return a.lateVsTarget ? -1 : 1;
        const dueA = a.dueDate ? Date.parse(a.dueDate) : Number.POSITIVE_INFINITY;
        const dueB = b.dueDate ? Date.parse(b.dueDate) : Number.POSITIVE_INFINITY;
        return dueA - dueB;
      })
      .slice(0, 200);
  }, [result]);

  const stats = result?.stats;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-2 rounded-xl border border-slate-200 bg-white px-3 py-3">
        <label className="flex flex-col gap-1 text-[12px]">
          <span className="font-medium text-slate-700">Từ ngày</span>
          <input className="erp-input w-[150px]" type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
        </label>
        <label className="flex flex-col gap-1 text-[12px]">
          <span className="font-medium text-slate-700">Đến ngày (bỏ trống = +120 ngày làm việc)</span>
          <input className="erp-input w-[150px]" type="date" value={to} onChange={(event) => setTo(event.target.value)} />
        </label>
        <label className="flex flex-col gap-1 text-[12px]">
          <span className="font-medium text-slate-700">Phạm vi</span>
          <select className="erp-input w-[210px]" value={scope} onChange={(event) => setScope(event.target.value)}>
            <option value="CHO_XEP_LICH">Bộ đang chờ xếp lịch</option>
            <option value="DANG_MO">Mọi bộ đang mở (chờ + đã xếp + đang sản xuất)</option>
          </select>
        </label>
        <button type="button" className="erp-button-secondary" onClick={() => request("preview")} disabled={busy !== null}>
          {busy === "preview" ? "Đang tính…" : "Xem trước kế hoạch"}
        </button>
        <button
          type="button"
          className="erp-button"
          onClick={() => request("apply")}
          disabled={busy !== null || !result || result.stats.tasksPlanned === 0}
        >
          {busy === "apply" ? "Đang ghi…" : "Ghi kế hoạch vào hệ thống"}
        </button>
      </div>

      {message ? (
        <p className={`text-[12.5px] ${message.tone === "ok" ? "text-emerald-700" : "text-red-700"}`}>{message.text}</p>
      ) : null}

      {stats ? (
        <div className={reportKpiGrid}>
          <ReportKpi label="Bộ được xếp" value={String(stats.setsPlanned)} />
          <ReportKpi label="Công đoạn được xếp" value={String(stats.tasksPlanned)} />
          <ReportKpi label="Ngày đầu → ngày cuối" value={`${formatDay(stats.firstDay)} → ${formatDay(stats.lastDay)}`} />
          <ReportKpi label="Số ngày làm việc" value={String(stats.workingDays)} />
          <ReportKpi
            label="Bộ trễ hạn giao"
            value={String(result?.sets.filter((row) => row.lateVsDue).length ?? 0)}
            tone={(result?.sets.some((row) => row.lateVsDue) ?? false) ? "bad" : "good"}
          />
          <ReportKpi label="Cảnh báo" value={String(result?.warnings.length ?? 0)} />
        </div>
      ) : null}

      {result && result.warnings.length ? (
        <ReportCard title={`Cảnh báo (${result.warnings.length})`}>
          <ul className="max-h-[220px] space-y-1 overflow-auto text-[12.5px] text-amber-900">
            {result.warnings.slice(0, 30).map((warning, index) => (
              <li key={`${warning.kind}-${warning.setId ?? "x"}-${index}`} className="flex gap-2">
                <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[11px] font-semibold text-amber-900">{warning.kind}</span>
                <span>{warning.message}</span>
              </li>
            ))}
            {result.warnings.length > 30 ? (
              <li className="text-slate-500">… còn {result.warnings.length - 30} cảnh báo khác.</li>
            ) : null}
          </ul>
        </ReportCard>
      ) : null}

      {result ? (
        <ReportCard
          title="Tải theo công đoạn × ngày"
          right={
            <select className="erp-input w-[240px]" value={stageFilter} onChange={(event) => setStageFilter(event.target.value)}>
              <option value="">Tất cả công đoạn</option>
              {stageOptions.map(([code, name]) => (
                <option key={code} value={code}>
                  {name}
                </option>
              ))}
            </select>
          }
        >
          <div className="max-h-[460px] overflow-auto">
            <table className="erp-table w-full text-[12.5px]">
              <thead className="sticky top-0 bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-2 py-1 text-left">Ngày</th>
                  <th className="px-2 py-1 text-left">Công đoạn</th>
                  <th className="px-2 py-1 text-left">Tổ</th>
                  <th className="px-2 py-1 text-right">Số bộ</th>
                  <th className="px-2 py-1 text-right">Tải</th>
                  <th className="px-2 py-1 text-right">Năng lực/ngày</th>
                  <th className="px-2 py-1 text-right">% tải</th>
                  <th className="px-2 py-1 text-left">Nguồn</th>
                </tr>
              </thead>
              <tbody>
                {loadRows.map((cell) => (
                  <tr key={`${cell.day}-${cell.stageCode}`} className={toneClass(cell.tone)}>
                    <td className="px-2 py-1 whitespace-nowrap">{formatDay(cell.day)}</td>
                    <td className="px-2 py-1">{cell.stageName}</td>
                    <td className="px-2 py-1">{cell.workCenterCode ?? "—"}</td>
                    <td className="px-2 py-1 text-right">{cell.sets}</td>
                    <td className="px-2 py-1 text-right">
                      {cell.worked} {cell.unit === "BO" ? "bộ" : "cánh"}
                    </td>
                    <td className="px-2 py-1 text-right">{cell.capacity ?? "—"}</td>
                    <td className="px-2 py-1 text-right">{cell.ratio === null ? "—" : `${Math.round(cell.ratio * 100)}%`}</td>
                    <td className="px-2 py-1">{SOURCE_LABELS[cell.capacitySource] ?? cell.capacitySource}</td>
                  </tr>
                ))}
                {!loadRows.length ? (
                  <tr>
                    <td className="px-2 py-3 text-slate-500" colSpan={8}>
                      Không có tải nào trong khoảng đã chọn.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
          {result.loads.length > 400 ? (
            <p className="erp-hint mt-2">Đang hiện 400/{result.loads.length} dòng — lọc theo công đoạn để xem phần còn lại.</p>
          ) : null}
        </ReportCard>
      ) : null}

      {result ? (
        <ReportCard title={`Ngày kế hoạch theo bộ (${result.sets.length})`}>
          <div className="max-h-[420px] overflow-auto">
            <table className="erp-table w-full text-[12.5px]">
              <thead className="sticky top-0 bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-2 py-1 text-left">Bộ</th>
                  <th className="px-2 py-1 text-left">Đơn</th>
                  <th className="px-2 py-1 text-left">Khách</th>
                  <th className="px-2 py-1 text-left">Màu</th>
                  <th className="px-2 py-1 text-left">Ngày KH</th>
                  <th className="px-2 py-1 text-left">Mốc (target)</th>
                  <th className="px-2 py-1 text-left">Hạn giao</th>
                  <th className="px-2 py-1 text-center">Kịp hạn?</th>
                </tr>
              </thead>
              <tbody>
                {setRows.map((row) => (
                  <tr key={row.setId} className={row.lateVsDue ? "bg-red-50 text-red-800" : row.lateVsTarget ? "bg-amber-50 text-amber-900" : undefined}>
                    <td className="px-2 py-1 font-semibold">{row.setNo ?? row.setId}</td>
                    <td className="px-2 py-1">{row.orderCode ?? "—"}</td>
                    <td className="px-2 py-1">{row.customerName ?? "—"}</td>
                    <td className="px-2 py-1">{row.paintColor ?? "—"}</td>
                    <td className="px-2 py-1 whitespace-nowrap">
                      {formatDay(row.plannedStart)} → {formatDay(row.plannedEnd)}
                    </td>
                    <td className="px-2 py-1 whitespace-nowrap">{formatDay(row.targetEnd)}</td>
                    <td className="px-2 py-1 whitespace-nowrap">{formatDay(row.dueDate)}</td>
                    <td className="px-2 py-1 text-center">{row.lateVsDue ? "✗ trễ" : "✓"}</td>
                  </tr>
                ))}
                {!setRows.length ? (
                  <tr>
                    <td className="px-2 py-3 text-slate-500" colSpan={8}>
                      Không có bộ nào trong phạm vi đã chọn.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
          {result.sets.length > 200 ? (
            <p className="erp-hint mt-2">Đang hiện 200/{result.sets.length} bộ.</p>
          ) : null}
        </ReportCard>
      ) : null}

      <p className="erp-hint">
        <strong>Ngày kế hoạch</strong> xếp XUÔI theo <strong>năng lực</strong> từng công đoạn/tổ: mỗi (công đoạn, ngày) chỉ nhận tối đa
        năng lực khai ở Cấu hình; hết chỗ thì bộ trôi sang ngày làm việc kế tiếp, nên một công đoạn có thể chiếm nhiều ngày.
        Cột <strong>Mốc (target)</strong> suy từ <strong>lead time</strong> (cột &quot;Số ngày&quot;) — chỉ để biết đơn có kịp hay không.
        Bấm <em>Ghi kế hoạch</em> mới lưu vào <code>planned_start/planned_end</code>; bộ đang chờ xếp lịch sẽ chuyển sang{" "}
        <strong>Đã xếp lịch</strong>.
      </p>
      <p className="erp-hint">
        <strong>Lưu ý về năng lực:</strong> mỗi <em>công đoạn</em> đang là một nguồn năng lực riêng (đúng như Cấu hình → Công đoạn).
        Nếu nhiều công đoạn cùng một tổ (vd tổ Máy gánh Bồi Lares + Cắt ×3 + Chấn ×3), chúng <strong>chưa dùng chung một hàng đợi</strong> —
        cần chốt có tách năng lực theo tổ hay không (xem tài liệu V147 mục 5.4).
      </p>
    </div>
  );
}
