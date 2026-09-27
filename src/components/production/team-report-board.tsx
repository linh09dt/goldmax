"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePlanVersion } from "@/components/production/use-plan-realtime";
import {
  highlightOf,
  matchesFilter,
  STATUS_FILTER_LABELS,
  vietnamTimeLabel,
  type StatusFilter,
  type TaskAction,
} from "@/lib/production/team-report";

/**
 * V156 — BẢNG BÁO CÁO SẢN XUẤT CỦA MỘT TỔ (màn hình xưởng, dùng bằng ngón tay).
 *
 * Nguyên tắc thiết kế cho CÔNG NHÂN (theo yêu cầu nhà máy):
 *   • Một tổ một màn; trong tổ CHIA THEO CÔNG ĐOẠN.
 *   • Dòng chỉ có: STT · Khách hàng · Lô · Bộ số · SL kế hoạch — không gì thêm.
 *   • 4 nút to: Bắt đầu · Hoàn thành · Lỗi · Tạm dừng — **1 chạm là xong**, không form/popup.
 *   • MÀU cả dòng để ai nhìn vào cũng biết: đang làm (vàng) · lỗi (đỏ) · tạm dừng (xám) · hoàn thành (xanh).
 *   • Đầu mỗi công đoạn: THỰC TẾ HOÀN / KẾ HOẠCH + thanh tiến độ + CẢNH BÁO không kịp.
 *   • Bấm nhầm thì có nút ↩ Hoàn tác ngay trên dòng đó.
 */

type Row = {
  taskId: number;
  setId: number;
  setNo: string | null;
  orderCode: string | null;
  customerName: string | null;
  paintColor: string | null;
  model: string | null;
  lot: string;
  lotSource: string;
  qty: number;
  unit: "CANH" | "BO";
  status: string;
  qtyDone: number;
  actualStart: string | null;
  actualEnd: string | null;
  reasonCode: string | null;
  reasonName: string | null;
  note: string | null;
  prev: {
    names: string;
    status: "KHONG_CO" | "CHUA_LAM" | "DANG_LAM" | "XONG" | "LOI" | "TAM_DUNG";
    doneAt: string | null;
    text: string;
  };
};

type StageBlock = {
  code: string;
  name: string;
  seq: number;
  unit: "CANH" | "BO";
  capacity: number | null;
  capacitySource: string;
  criteria: Array<{ code: string; weight: number }>;
  grouping: { code: string; label: string } | null;
  totals: {
    rows: number;
    planQty: number;
    doneQty: number;
    doingQty: number;
    errorQty: number;
    pauseQty: number;
    notStarted: number;
    doneCount: number;
    doingCount: number;
    errorCount: number;
    pauseCount: number;
  };
  progress: {
    tone: "good" | "ok" | "warn" | "bad";
    headline: string;
    detail: string;
    percent: number;
    remaining: number;
    neededPerHour: number | null;
    actualPerHour: number | null;
  };
  rows: Row[];
};

type Report = {
  day: string;
  today: string;
  nowMinutes: number;
  shift: { startMinutes: number; endMinutes: number };
  teams: Array<{ code: string; name: string; stageCount: number; planQty: number; openQty: number; rows: number }>;
  team: { code: string; name: string } | null;
  stages: StageBlock[];
  totals: { planQty: number; doneQty: number; errorQty: number; pauseQty: number; rows: number };
  alerts: string[];
  reasons: { error: Array<{ code: string; name: string }>; pause: Array<{ code: string; name: string }> };
};

const TONE_BOX: Record<string, string> = {
  good: "border-emerald-400 bg-emerald-50 text-emerald-900",
  ok: "border-slate-300 bg-slate-50 text-slate-700",
  warn: "border-amber-400 bg-amber-50 text-amber-900",
  bad: "border-red-500 bg-red-50 text-red-900",
};

const TONE_BAR: Record<string, string> = {
  good: "bg-emerald-500",
  ok: "bg-slate-400",
  warn: "bg-amber-500",
  bad: "bg-red-500",
};

const UNIT_LABEL: Record<string, string> = { CANH: "cánh", BO: "bộ" };

const ACTION_BUTTONS: Array<{ action: Exclude<TaskAction, "HOAN_TAC">; label: string; icon: string; on: string; off: string }> = [
  { action: "BAT_DAU", label: "Bắt đầu", icon: "▶", on: "bg-amber-500 text-white border-amber-600", off: "bg-white text-amber-800 border-amber-300 hover:bg-amber-50" },
  { action: "HOAN_THANH", label: "Hoàn thành", icon: "✔", on: "bg-emerald-600 text-white border-emerald-700", off: "bg-white text-emerald-800 border-emerald-300 hover:bg-emerald-50" },
  { action: "LOI", label: "Lỗi", icon: "⚠", on: "bg-red-600 text-white border-red-700", off: "bg-white text-red-800 border-red-300 hover:bg-red-50" },
  { action: "TAM_DUNG", label: "Tạm dừng", icon: "⏸", on: "bg-slate-600 text-white border-slate-700", off: "bg-white text-slate-800 border-slate-300 hover:bg-slate-50" },
];

const STATUS_OF_ACTION: Record<string, string> = { BAT_DAU: "DANG_LAM", HOAN_THANH: "XONG", LOI: "LOI", TAM_DUNG: "TAM_DUNG" };

/** Giờ VN — KHÔNG dùng giờ máy (server chạy UTC, công nhân xem ở VN). */
const shortTime = vietnamTimeLabel;

function minutesLabel(minutes: number): string {
  const pad = (value: number) => String(Math.max(0, Math.floor(value))).padStart(2, "0");
  return `${pad(minutes / 60)}:${pad(minutes % 60)}`;
}

export function TeamReportBoard({ initial, today }: { initial: Report; today: string }) {
  // `today` để nút "Hôm nay" biết đang ở hôm nay hay ngày khác (đổi màu nút).

  const [report, setReport] = useState<Report>(initial);
  const [teamCode, setTeamCode] = useState<string>(initial.team?.code ?? "");
  const [day, setDay] = useState<string>(initial.day);
  const [filter, setFilter] = useState<StatusFilter>("CHUA_XONG");
  const [busyTaskId, setBusyTaskId] = useState<number | null>(null);
  const [undo, setUndo] = useState<Record<number, { status: string; reasonCode: string | null }>>({});
  const [message, setMessage] = useState<{ tone: "ok" | "err"; text: string } | null>(null);
  const [byName, setByName] = useState("");
  const firstLoad = useRef(true);

  useEffect(() => {
    const saved = window.localStorage.getItem("to-bao-cao-nguoi-bao");
    // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage chỉ có ở client, không đọc được lúc SSR
    if (saved) setByName(saved);
  }, []);

  const load = useCallback(
    async (options: { team?: string; ngay?: string; silent?: boolean } = {}) => {
      const params = new URLSearchParams();
      const team = options.team ?? teamCode;
      const ngay = options.ngay ?? day;
      if (team) params.set("team", team);
      if (ngay) params.set("day", ngay);
      try {
        const response = await fetch(`/api/production/team-report?${params.toString()}`, { cache: "no-store" });
        const payload = (await response.json()) as ({ ok?: boolean; error?: string } & Report);
        if (!response.ok || !payload.ok) throw new Error(payload.error || "Không đọc được báo cáo.");
        setReport((prev) => {
          // Chỉ đổi state khi DỮ LIỆU ĐỔI THẬT — tránh render lại làm công nhân bấm lệch nút.
          const next = payload as Report;
          if (options.silent && JSON.stringify(prev) === JSON.stringify(next)) return prev;
          return next;
        });
      } catch (error) {
        if (!options.silent) setMessage({ tone: "err", text: error instanceof Error ? error.message : "Lỗi không rõ." });
      }
    },
    [day, teamCode],
  );

  // Tự cập nhật: token phiên bản đổi (ai đó báo xong ở tổ khác) → tải lại bảng này.
  usePlanVersion(() => {
    if (busyTaskId === null) void load({ silent: true });
  }, { enabled: busyTaskId === null });

  // Nhịp riêng 15 giây cho màn xưởng (cập nhật cảnh báo kịp/không kịp theo giờ).
  useEffect(() => {
    const timer = setInterval(() => {
      if (busyTaskId === null) void load({ silent: true });
    }, 15000);
    return () => clearInterval(timer);
  }, [busyTaskId, load]);

  useEffect(() => {
    if (firstLoad.current) {
      firstLoad.current = false;
      return;
    }
    void load({ silent: true });
  }, [teamCode, day, load]);

  const act = async (row: Row, action: Exclude<TaskAction, "HOAN_TAC">, reasonCode?: string) => {
    setBusyTaskId(row.taskId);
    setMessage(null);
    try {
      const response = await fetch("/api/production/task-action", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ taskId: row.taskId, action, reasonCode: reasonCode ?? null, byName: byName || null }),
      });
      const payload = (await response.json()) as { ok?: boolean; error?: string; status?: string; warnings?: string[] };
      if (!response.ok || !payload.ok) throw new Error(payload.error || "Không cập nhật được.");
      const nextStatus = payload.status ?? STATUS_OF_ACTION[action];
      setUndo((prev) => ({ ...prev, [row.taskId]: { status: row.status, reasonCode: row.reasonCode } }));
      setReport((prev) => patchRow(prev, row.taskId, nextStatus));
      setMessage({
        tone: "ok",
        text: `Đã ${action === "HOAN_THANH" ? "HOÀN THÀNH" : action === "BAT_DAU" ? "bắt đầu" : action === "LOI" ? "báo LỖI" : "tạm dừng"} · Bộ ${row.setNo ?? row.setId}${
          payload.warnings?.length ? ` ⚠ ${payload.warnings.join(" · ")}` : ""
        }`,
      });
      void load({ silent: true });
    } catch (error) {
      setMessage({ tone: "err", text: error instanceof Error ? error.message : "Lỗi không rõ." });
    } finally {
      setBusyTaskId(null);
    }
  };

  const undoAction = async (row: Row) => {
    const prev = undo[row.taskId];
    if (!prev) return;
    setBusyTaskId(row.taskId);
    try {
      const response = await fetch("/api/production/task-action", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          taskId: row.taskId,
          action: "HOAN_TAC",
          prevStatus: prev.status,
          prevReasonCode: prev.reasonCode,
          byName: byName || null,
        }),
      });
      const payload = (await response.json()) as { ok?: boolean; error?: string; status?: string };
      if (!response.ok || !payload.ok) throw new Error(payload.error || "Không hoàn tác được.");
      setReport((prevReport) => patchRow(prevReport, row.taskId, payload.status ?? prev.status));
      setUndo((prevUndo) => {
        const next = { ...prevUndo };
        delete next[row.taskId];
        return next;
      });
      setMessage({ tone: "ok", text: `Đã hoàn tác · Bộ ${row.setNo ?? row.setId}` });
      void load({ silent: true });
    } catch (error) {
      setMessage({ tone: "err", text: error instanceof Error ? error.message : "Lỗi không rõ." });
    } finally {
      setBusyTaskId(null);
    }
  };

  const totalPlan = report.totals.planQty;
  const openQty = Math.max(0, totalPlan - report.totals.doneQty);

  const stageCards = useMemo(
    () =>
      report.stages.map((stage) => ({
        stage,
        rows: stage.rows.filter((row) => matchesFilter(row.status, filter)),
      })),
    [report.stages, filter],
  );

  return (
    <div className="space-y-3">
      {/* ===== Chọn tổ + ngày + người báo ===== */}
      <section className="erp-card p-2">
        <div className="flex flex-wrap items-center gap-1.5">
          {report.teams.map((team) => {
            const active = team.code === report.team?.code;
            return (
              <button
                key={team.code}
                type="button"
                onClick={() => setTeamCode(team.code)}
                className={`rounded-lg border px-3 py-2 text-[13.5px] font-semibold ${
                  active ? "border-cyan-600 bg-cyan-600 text-white" : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                }`}
              >
                {team.name}
                <span className={`ml-1.5 rounded px-1.5 py-0.5 text-[11px] ${active ? "bg-white/25" : "bg-slate-100 text-slate-600"}`}>
                  {team.rows}
                </span>
              </button>
            );
          })}
          <span className="mx-1 h-6 w-px bg-slate-200" />
          <input
            type="date"
            className="erp-input w-[150px]"
            value={day}
            onChange={(event) => setDay(event.target.value)}
          />
          <button
            type="button"
            className={day === today ? "erp-button" : "erp-button-secondary"}
            onClick={() => setDay(today)}
          >
            Hôm nay
          </button>
          <button type="button" className="erp-button-secondary" onClick={() => void load({ silent: false })}>
            ⟳ Tải lại
          </button>
          <input
            className="erp-input w-[170px]"
            placeholder="Tên người báo (ghi nhật ký)"
            value={byName}
            onChange={(event) => {
              setByName(event.target.value);
              window.localStorage.setItem("to-bao-cao-nguoi-bao", event.target.value);
            }}
          />
          <span className="ml-auto text-[12px] text-slate-500">
            Ca {minutesLabel(report.shift.startMinutes)}–{minutesLabel(report.shift.endMinutes)} · hiện tại{" "}
            <strong>{minutesLabel(report.nowMinutes)}</strong>
          </span>
        </div>

        {report.team ? (
          <p className="mt-1.5 text-[12.5px] text-slate-600">
            <strong>{report.team.name}</strong> · {report.stages.length} công đoạn · kế hoạch hôm nay{" "}
            <strong>{totalPlan}</strong> · còn phải làm <strong>{openQty}</strong> · Lỗi{" "}
            <strong className="text-red-700">{report.totals.errorQty}</strong> · Tạm dừng{" "}
            <strong>{report.totals.pauseQty}</strong>
          </p>
        ) : null}

        {report.alerts.length ? (
          <div className="mt-1.5 rounded-lg border-2 border-red-400 bg-red-50 px-3 py-2 text-[13px] font-semibold text-red-900">
            ⚠ {report.alerts.join(" · ")}
          </div>
        ) : null}

        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          {(Object.keys(STATUS_FILTER_LABELS) as StatusFilter[]).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              className={`rounded-full border px-3 py-1 text-[12.5px] ${
                filter === key ? "border-slate-800 bg-slate-800 text-white" : "border-slate-300 bg-white text-slate-700"
              }`}
            >
              {STATUS_FILTER_LABELS[key]}
            </button>
          ))}
        </div>

        {message ? (
          <p className={`mt-1.5 text-[13px] font-medium ${message.tone === "ok" ? "text-emerald-700" : "text-red-700"}`}>{message.text}</p>
        ) : null}
      </section>

      {/* ===== Từng công đoạn của tổ ===== */}
      {stageCards.map(({ stage, rows }, stageIndex) => (
        <section key={stage.code} className="erp-card overflow-hidden">
          <div className={`flex flex-wrap items-center gap-3 border-b px-3 py-2 ${TONE_BOX[stage.progress.tone]}`}>
            <div className="min-w-[190px]">
              <h2 className="text-[15px] font-bold">
                <span className="mr-1.5 inline-block rounded bg-white/70 px-1.5 text-[12px]">{stageIndex + 1}</span>
                {stage.name}
                <span className="ml-2 rounded bg-white/70 px-1.5 py-0.5 text-[11px] font-semibold">
                  {stage.unit === "CANH" ? "theo cánh" : "theo bộ"}
                  {stage.capacity ? ` · ${stage.capacity}/${UNIT_LABEL[stage.unit]}/ngày` : " · chưa khai năng lực"}
                </span>
              </h2>
            </div>

            <div className="min-w-[220px]">
              <div className="text-[13px] font-semibold">
                {stage.progress.headline}
              </div>
              <div className="mt-0.5 h-2.5 w-[220px] overflow-hidden rounded-full bg-white/70">
                <div
                  className={`h-full ${TONE_BAR[stage.progress.tone]}`}
                  style={{ width: `${Math.min(100, stage.progress.percent)}%` }}
                />
              </div>
            </div>

            <div className="text-[13px]">
              THỰC TẾ <strong className="text-[17px]">{stage.totals.doneQty}</strong> / KẾ HOẠCH{" "}
              <strong className="text-[17px]">{stage.totals.planQty}</strong> {UNIT_LABEL[stage.unit]} · còn{" "}
              <strong>{stage.progress.remaining}</strong>
            </div>

            <div className="flex flex-wrap gap-1 text-[12px]">
              <span className="rounded bg-amber-200 px-1.5 py-0.5 font-semibold text-amber-900">Đang làm {stage.totals.doingCount}</span>
              <span className="rounded bg-red-200 px-1.5 py-0.5 font-semibold text-red-900">Lỗi {stage.totals.errorCount}</span>
              <span className="rounded bg-slate-300 px-1.5 py-0.5 font-semibold text-slate-800">Tạm dừng {stage.totals.pauseCount}</span>
              <span className="rounded bg-emerald-200 px-1.5 py-0.5 font-semibold text-emerald-900">Xong {stage.totals.doneCount}</span>
            </div>

            <p className="w-full text-[12px] opacity-90">{stage.progress.detail}</p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-[13.5px]">
              <thead className="bg-slate-50 text-[12px] uppercase text-slate-500">
                <tr>
                  <th className="w-[46px] px-2 py-1.5 text-left">STT</th>
                  <th className="px-2 py-1.5 text-left">Khách hàng</th>
                  <th className="px-2 py-1.5 text-left">Lô</th>
                  <th className="w-[110px] px-2 py-1.5 text-left">Bộ số</th>
                  <th className="w-[120px] px-2 py-1.5 text-right">SL kế hoạch</th>
                  <th className="w-[170px] px-2 py-1.5 text-left">Công đoạn trước</th>
                  <th className="w-[150px] px-2 py-1.5 text-left">Trạng thái</th>
                  <th className="w-[460px] px-2 py-1.5 text-left">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => {
                  const tone = highlightOf(row.status);
                  const busy = busyTaskId === row.taskId;
                  return (
                    <tr key={row.taskId} className={`${tone.row} border-b border-slate-200`}>
                      <td className="px-2 py-1.5">
                        <div className="flex items-center gap-1.5">
                          <span className={`inline-block h-8 w-1.5 rounded ${tone.bar}`} />
                          <span className="text-[15px] font-bold text-slate-700">{index + 1}</span>
                        </div>
                      </td>
                      <td className="px-2 py-1.5">
                        <div className="font-semibold text-slate-900">{row.customerName ?? "—"}</div>
                        <div className="text-[11.5px] text-slate-500">
                          {row.orderCode ?? "—"}
                          {row.paintColor ? ` · ${row.paintColor}` : ""}
                          {row.model ? ` · ${row.model}` : ""}
                        </div>
                      </td>
                      <td className="px-2 py-1.5 text-[12.5px] text-slate-700">{row.lot}</td>
                      <td className="px-2 py-1.5">
                        <div className="text-[15px] font-bold text-slate-900">{row.setNo ?? row.setId}</div>
                      </td>
                      <td className="px-2 py-1.5 text-right">
                        <div className="text-[17px] font-bold text-slate-900">{row.qty}</div>
                        <div className="text-[11px] text-slate-500">{UNIT_LABEL[row.unit]}</div>
                      </td>
                      <td className="px-2 py-1.5">
                        {(() => {
                          const prevTone = highlightOf(row.prev.status);
                          return (
                            <>
                              <div className={`inline-block rounded border px-2 py-0.5 text-[12px] font-bold ${prevTone.chip}`}>
                                {prevTone.icon} {row.prev.text}
                              </div>
                              {row.prev.names ? <div className="text-[11px] text-slate-500">{row.prev.names}</div> : null}
                            </>
                          );
                        })()}
                      </td>
                      <td className="px-2 py-1.5">
                        <span className={`inline-block rounded border px-2 py-0.5 text-[12px] font-bold ${tone.chip}`}>
                          {tone.icon} {tone.label}
                        </span>
                        {row.status === "XONG" && row.actualEnd ? (
                          <div className="text-[11px] text-slate-500">xong {shortTime(row.actualEnd)}</div>
                        ) : null}
                        {row.status === "DANG_LAM" && row.actualStart ? (
                          <div className="text-[11px] text-slate-500">từ {shortTime(row.actualStart)}</div>
                        ) : null}
                        {row.reasonName ? <div className="text-[11px] text-red-700">{row.reasonName}</div> : null}
                      </td>
                      <td className="px-2 py-1.5">
                        <div className="flex flex-wrap items-center gap-1.5">
                          {ACTION_BUTTONS.map((button) => {
                            const active = row.status === STATUS_OF_ACTION[button.action];
                            return (
                              <button
                                key={button.action}
                                type="button"
                                disabled={busy}
                                onClick={() => void act(row, button.action)}
                                className={`min-h-[38px] min-w-[104px] rounded-lg border px-3 text-[13px] font-bold disabled:opacity-50 ${
                                  active ? button.on : button.off
                                }`}
                              >
                                {button.icon} {button.label}
                              </button>
                            );
                          })}
                          {undo[row.taskId] ? (
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => void undoAction(row)}
                              className="min-h-[38px] rounded-lg border border-slate-400 bg-white px-3 text-[13px] font-semibold text-slate-700 disabled:opacity-50"
                            >
                              ↩ Hoàn tác
                            </button>
                          ) : null}
                          {busy ? <span className="text-[12px] text-slate-500">đang lưu…</span> : null}

                          {row.status === "LOI" && report.reasons.error.length ? (
                            <select
                              className="erp-input h-[30px] w-[210px] text-[12px]"
                              value={row.reasonCode ?? ""}
                              onChange={(event) => void act(row, "LOI", event.target.value)}
                            >
                              <option value="">Chọn lý do lỗi…</option>
                              {report.reasons.error.map((reason) => (
                                <option key={reason.code} value={reason.code}>
                                  {reason.name}
                                </option>
                              ))}
                            </select>
                          ) : null}
                          {row.status === "TAM_DUNG" && report.reasons.pause.length ? (
                            <select
                              className="erp-input h-[30px] w-[210px] text-[12px]"
                              value={row.reasonCode ?? ""}
                              onChange={(event) => void act(row, "TAM_DUNG", event.target.value)}
                            >
                              <option value="">Chọn lý do tạm dừng…</option>
                              {report.reasons.pause.map((reason) => (
                                <option key={reason.code} value={reason.code}>
                                  {reason.name}
                                </option>
                              ))}
                            </select>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {!rows.length ? (
                  <tr>
                    <td colSpan={8} className="px-3 py-4 text-center text-[13px] text-slate-500">
                      Không có dòng nào khớp bộ lọc “{STATUS_FILTER_LABELS[filter]}”.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
      ))}

      {!stageCards.length ? (
        <section className="erp-card p-4 text-[13.5px] text-slate-600">
          Tổ này chưa gắn công đoạn nào (vào <strong>Cấu hình sản xuất → Công đoạn</strong> để gán “Tổ phụ trách”).
        </section>
      ) : null}
    </div>
  );
}

/** Cập nhật 1 dòng tại chỗ (không chờ tải lại) để công nhân thấy kết quả ngay. */
function patchRow(report: Report, taskId: number, status: string): Report {
  return {
    ...report,
    stages: report.stages.map((stage) => {
      const row = stage.rows.find((item) => item.taskId === taskId);
      if (!row) return stage;
      const rows = stage.rows.map((item) =>
        item.taskId === taskId
          ? {
              ...item,
              status,
              actualStart: status === "CHUA_LAM" ? null : item.actualStart ?? new Date().toISOString(),
              actualEnd: status === "XONG" ? new Date().toISOString() : null,
              qtyDone: status === "XONG" ? item.qty || item.qtyDone : 0,
            }
          : item,
      );
      return { ...stage, rows };
    }),
  };
}
