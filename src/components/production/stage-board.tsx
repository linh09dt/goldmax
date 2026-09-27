"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePlanVersion } from "@/components/production/use-plan-realtime";

/**
 * V152 — BẢNG ĐIỀU ĐỘ THỦ CÔNG THEO CÔNG ĐOẠN.
 *
 * Trái: **DANH SÁCH ĐỢI** — chỉ hiện bộ ĐỦ ĐIỀU KIỆN vào công đoạn này
 *        (công đoạn trước ĐÃ LÊN KẾ HOẠCH hoặc ĐÃ BÁO XONG).
 * Phải: các NGÀY — thêm/bớt bộ tuỳ ý.
 *
 * Thêm/bớt ở một công đoạn ⇒ **mọi công đoạn PHÍA SAU của bộ đó bị xoá khỏi kế hoạch ngay**.
 * Mọi thay đổi (của mình hoặc người khác) tự hiện — không cần F5.
 */

type BoardItem = {
  taskId: number;
  setId: number;
  scope: string;
  setNo: string | null;
  orderCode: string | null;
  customerName: string | null;
  productName: string | null;
  paintColor: string | null;
  dueDate: string | null;
  demand: number;
  unit: "CANH" | "BO";
  status: string;
  score: number;
  waitingFor: string[];
};

type BoardDay = {
  date: string;
  isWorkingDay: boolean;
  items: BoardItem[];
  worked: number;
  capacity: number | null;
  unit: "CANH" | "BO";
  ratio: number | null;
  tone: "ok" | "warn" | "bad";
};

type BoardData = {
  version: string;
  stage: {
    code: string;
    name: string;
    seq: number;
    workCenterCode: string | null;
    capacity: number | null;
    capacitySource: string;
    unit: "CANH" | "BO";
    requiresStage: string | null;
    changeoverMaxPerDay: number | null;
    batchMinQty: number | null;
    batchKey: string | null;
  };
  stages: Array<{ code: string; name: string; seq: number }>;
  from: string;
  days: BoardDay[];
  waiting: BoardItem[];
  blocked: BoardItem[];
  totals: { waiting: number; blocked: number; planned: number; unplannedItems: number };
  priority: {
    criteria: Array<{ code: string; weight: number }>;
    grouping: { code: string; tolerance: number } | null;
    batch: boolean;
  };
};

type Proposal = {
  mode: "HANG_DOI" | "GOM_LO";
  modeNote: string;
  criteria: Array<{ code: string; weight: number }>;
  grouping: { code: string; tolerance: number } | null;
  queue: Array<{ taskId: number; setNo: string | null; paintColor: string | null; demand: number; queueRank: number }>;
  days: Array<{ date: string; worked: number; capacity: number | null; ratio: number | null; tone: string; items: Array<{ taskId: number; setId: number; setNo: string | null; paintColor: string | null; demand: number; groupKey: string | null }> }>;
  assignments: Array<{ taskId: number; setId: number; day: string; queueRank: number }>;
  overflow: number[];
  usedDays: number;
};

const WEEKDAYS = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];

function shortDate(value: string): string {
  return `${value.slice(8, 10)}/${value.slice(5, 7)}`;
}

function weekdayOf(value: string): string {
  return WEEKDAYS[new Date(`${value}T00:00:00.000Z`).getUTCDay()];
}

function shiftDays(value: string, delta: number): string {
  const date = new Date(`${value}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + delta);
  return date.toISOString().slice(0, 10);
}

function toneClass(tone: string): string {
  if (tone === "bad") return "border-red-300 bg-red-50";
  if (tone === "warn") return "border-amber-300 bg-amber-50";
  return "border-slate-200 bg-white";
}

export function StageBoard({
  stages,
  today,
  initialStage,
}: {
  stages: Array<{ code: string; name: string; seq: number }>;
  today: string;
  initialStage?: string;
}) {
  const [stageCode, setStageCode] = useState(initialStage ?? stages[0]?.code ?? "");
  const [from, setFrom] = useState(today);
  const [dayCount, setDayCount] = useState(7);
  const [data, setData] = useState<BoardData | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [showBlocked, setShowBlocked] = useState(false);
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [message, setMessage] = useState<{ tone: "ok" | "err"; text: string } | null>(null);

  const load = useCallback(async () => {
    if (!stageCode) return;
    try {
      const response = await fetch(
        `/api/production/stage-board?stage=${encodeURIComponent(stageCode)}&from=${from}&days=${dayCount}`,
        { cache: "no-store" },
      );
      const payload = (await response.json()) as { ok?: boolean; error?: string } & BoardData;
      if (!response.ok || !payload.ok) throw new Error(payload.error || "Không tải được bảng điều độ.");
      setData(payload);
    } catch (error) {
      setMessage({ tone: "err", text: error instanceof Error ? error.message : "Lỗi không rõ." });
    }
  }, [stageCode, from, dayCount]);

  useEffect(() => {
    // Nạp dữ liệu khi đổi công đoạn / khoảng ngày. `load()` là hàm async nên setState
    // xảy ra SAU await, không phải render nối tiếp trong thân effect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  // REALTIME: ai đó đổi dữ liệu (kể cả chính mình) → tải lại ngay, không cần F5
  usePlanVersion(
    () => {
      void load();
    },
    { enabled: Boolean(stageCode) },
  );

  const action = async (body: Record<string, unknown>, label: string) => {
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch("/api/production/stage-board", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(body),
      });
      const payload = (await response.json()) as {
        ok?: boolean;
        error?: string;
        clearedDownstream?: number;
        action?: string;
      };
      if (!response.ok || !payload.ok) throw new Error(payload.error || "Không cập nhật được.");
      const cleared = Number(payload.clearedDownstream ?? 0);
      setMessage({
        tone: "ok",
        text: `${label}${cleared > 0 ? ` · đã xoá ${cleared} công đoạn PHÍA SAU khỏi kế hoạch` : ""}.`,
      });
      setSelected(null);
      await load();
    } catch (error) {
      setMessage({ tone: "err", text: error instanceof Error ? error.message : "Lỗi không rõ." });
    } finally {
      setBusy(false);
    }
  };

  /** BƯỚC 2 của luồng: hàng đợi (đã sắp theo tiêu chí ưu tiên) → điều độ tự động (đề xuất, CHƯA ghi). */
  const previewDispatch = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch("/api/production/stage-dispatch", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ action: "preview", stageCode, from, horizonDays: 120 }),
      });
      const payload = (await response.json()) as ({ ok?: boolean; error?: string } & Proposal);
      if (!response.ok || !payload.ok) throw new Error(payload.error || "Không điều độ được.");
      setProposal(payload);
      setMessage({
        tone: "ok",
        text: `Đề xuất (${payload.mode === "GOM_LO" ? "gom lô" : "theo hàng đợi"}): ${payload.assignments.length} bộ vào ${payload.usedDays} ngày${
          payload.overflow.length ? ` · ${payload.overflow.length} bộ vượt quá 120 ngày làm việc` : ""
        }. Chưa ghi gì — bấm “Xác nhận lên điều độ” để áp dụng.`,
      });
    } catch (error) {
      setMessage({ tone: "err", text: error instanceof Error ? error.message : "Lỗi không rõ." });
    } finally {
      setBusy(false);
    }
  };

  /** BƯỚC 3: XÁC NHẬN → ghi vào điều độ (và xoá công đoạn phía sau của các bộ vừa xếp). */
  const applyDispatch = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch("/api/production/stage-dispatch", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ action: "apply", stageCode, from, horizonDays: 120 }),
      });
      const payload = (await response.json()) as { ok?: boolean; error?: string; sets?: number; tasks?: number; cleared?: number; days?: number };
      if (!response.ok || !payload.ok) throw new Error(payload.error || "Không xác nhận được.");
      setProposal(null);
      setMessage({
        tone: "ok",
        text: `ĐÃ XÁC NHẬN: ${payload.tasks ?? 0} công đoạn của ${payload.sets ?? 0} bộ vào ${payload.days ?? 0} ngày${
          payload.cleared ? ` · xoá ${payload.cleared} công đoạn PHÍA SAU (sẽ xếp lại)` : ""
        }.`,
      });
      await load();
    } catch (error) {
      setMessage({ tone: "err", text: error instanceof Error ? error.message : "Lỗi không rõ." });
    } finally {
      setBusy(false);
    }
  };

  /** Đưa bộ của các ĐƠN MỚI (đã xác nhận, chưa có trong kế hoạch) vào module — rồi hiện ngay ở danh sách đợi. */
  const syncNewItems = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch("/api/production/sets", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({}),
      });
      const payload = (await response.json()) as { ok?: boolean; error?: string; createdSets?: number; createdTasks?: number };
      if (!response.ok || !payload.ok) throw new Error(payload.error || "Không nhập được bộ mới.");
      setMessage({
        tone: "ok",
        text: `Đã nhập ${payload.createdSets ?? 0} bộ mới vào kế hoạch (${payload.createdTasks ?? 0} công đoạn) — bộ đủ điều kiện đã hiện ở danh sách đợi.`,
      });
      await load();
    } catch (error) {
      setMessage({ tone: "err", text: error instanceof Error ? error.message : "Lỗi không rõ." });
    } finally {
      setBusy(false);
    }
  };

  const dayOptions = useMemo(() => data?.days ?? [], [data]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-2 rounded-xl border border-slate-200 bg-white px-3 py-3">
        <label className="flex flex-col gap-1 text-[12px]">
          <span className="font-medium text-slate-700">Công đoạn</span>
          <select className="erp-input w-[240px]" value={stageCode} onChange={(event) => setStageCode(event.target.value)}>
            {stages.map((stage) => (
              <option key={stage.code} value={stage.code}>
                {stage.seq}. {stage.name}
              </option>
            ))}
          </select>
        </label>
        <div className="flex items-end gap-1">
          <button type="button" className="erp-button-secondary" onClick={() => setFrom(shiftDays(from, -dayCount))}>
            ← {dayCount} ngày
          </button>
          <button type="button" className="erp-button-secondary" onClick={() => setFrom(today)}>
            Hôm nay
          </button>
          <button type="button" className="erp-button-secondary" onClick={() => setFrom(shiftDays(from, dayCount))}>
            {dayCount} ngày →
          </button>
        </div>
        <label className="flex flex-col gap-1 text-[12px]">
          <span className="font-medium text-slate-700">Số ngày hiện</span>
          <select className="erp-input w-[90px]" value={dayCount} onChange={(event) => setDayCount(Number(event.target.value))}>
            <option value={7}>7</option>
            <option value={14}>14</option>
            <option value={21}>21</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-[12px]">
          <span className="font-medium text-slate-700">Từ ngày</span>
          <input className="erp-input w-[150px]" type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
        </label>
        <button
          type="button"
          className="erp-button"
          disabled={busy || !data || data.totals.waiting === 0}
          title="Sắp hàng đợi theo tiêu chí ưu tiên, rồi dùng gom nhóm + năng lực để đề xuất ngày (chưa ghi)"
          onClick={() => previewDispatch()}
        >
          ⚙ Điều độ tự động (xem trước)
        </button>
        {data && data.totals.unplannedItems > 0 ? (
          <button
            type="button"
            className="erp-button"
            disabled={busy}
            title="Đưa các bộ của đơn ĐÃ XÁC NHẬN (chưa có trong kế hoạch) vào module sản xuất — sau đó chúng hiện ngay ở danh sách đợi"
            onClick={() => syncNewItems()}
          >
            ＋ Nhập {data.totals.unplannedItems} bộ từ đơn mới vào kế hoạch
          </button>
        ) : null}
        {data ? (
          <p className="erp-hint ml-auto">
            Tổ <strong>{data.stage.workCenterCode ?? "—"}</strong> · năng lực{" "}
            <strong>
              {data.stage.capacity ?? "chưa khai"} {data.stage.unit === "BO" ? "bộ" : "cánh"}/ngày
            </strong>{" "}
            ({data.stage.capacitySource === "CONG_DOAN" ? "khai riêng công đoạn" : data.stage.capacitySource === "TO" ? "theo tổ" : "chưa khai"})
            {data.stage.changeoverMaxPerDay ? ` · tối đa ${data.stage.changeoverMaxPerDay} lượt đổi/ngày` : ""}
          </p>
        ) : null}
      </div>

      {message ? (
        <p className={`text-[12.5px] ${message.tone === "ok" ? "text-emerald-700" : "text-red-700"}`}>{message.text}</p>
      ) : null}

      {proposal ? (
        <section className="erp-card overflow-hidden border-2 border-dashed border-cyan-400">
          <div className="flex flex-wrap items-center justify-between gap-2 bg-cyan-50 px-3 py-2">
            <div>
              <h2 className="text-[13px] font-bold text-cyan-900">
                ĐỀ XUẤT ĐIỀU ĐỘ TỰ ĐỘNG — {proposal.assignments.length} bộ · {proposal.usedDays} ngày
                <span className="ml-2 rounded bg-cyan-200 px-1.5 py-0.5 text-[11px] font-semibold">
                  {proposal.mode === "GOM_LO" ? "GOM LÔ" : "THEO HÀNG ĐỢI"}
                </span>
              </h2>
              <p className="erp-hint mt-0.5">
                {proposal.modeNote} · Thứ tự theo:{" "}
                {proposal.criteria.length
                  ? proposal.criteria.map((item) => `${item.code}(${item.weight})`).join(" · ")
                  : "chưa có tiêu chí nào (sắp theo ngày vào kế hoạch)"}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" className="erp-button" disabled={busy} onClick={() => applyDispatch()}>
                ✓ Xác nhận lên điều độ
              </button>
              <button type="button" className="erp-button-secondary" disabled={busy} onClick={() => setProposal(null)}>
                Bỏ đề xuất
              </button>
            </div>
          </div>
          <div className="grid gap-2 p-2 md:grid-cols-2 xl:grid-cols-4">
            {proposal.days.slice(0, 40).map((day) => (
              <div key={day.date} className="rounded-lg border border-cyan-200 bg-cyan-50/40 p-2">
                <div className="flex items-baseline justify-between">
                  <span className="text-[12px] font-semibold text-cyan-900">
                    {weekdayOf(day.date)} {shortDate(day.date)}
                  </span>
                  <span className="text-[11px] text-slate-600">
                    {day.worked}
                    {day.capacity ? `/${day.capacity}` : ""}
                    {day.ratio !== null ? ` · ${Math.round(day.ratio * 100)}%` : ""}
                  </span>
                </div>
                <ul className="mt-1 space-y-0.5 text-[11.5px] text-slate-700">
                  {day.items.slice(0, 12).map((item) => (
                    <li key={item.taskId} className="truncate">
                      #{proposal.queue.find((q) => q.taskId === item.taskId)?.queueRank ?? "—"} Bộ {item.setNo}
                      {item.paintColor ? ` · ${item.paintColor}` : ""} · {item.demand}
                    </li>
                  ))}
                  {day.items.length > 12 ? <li className="text-slate-500">… +{day.items.length - 12} bộ</li> : null}
                </ul>
              </div>
            ))}
            {proposal.days.length > 40 ? (
              <p className="erp-hint">… đề xuất kéo dài {proposal.days.length} ngày (đang hiện 40 ngày đầu).</p>
            ) : null}
          </div>
        </section>
      ) : null}

      <div className="grid gap-3 lg:grid-cols-[330px_1fr]">
        <section className="erp-card flex max-h-[70vh] flex-col overflow-hidden">
          <div className="border-b border-slate-200 bg-slate-50 px-3 py-2">
            <h2 className="text-[13px] font-bold text-slate-900">
              Danh sách đợi ({data?.totals.waiting ?? 0})
            </h2>
            <p className="erp-hint mt-0.5">
              Thứ tự trên→dưới theo:{" "}
              <strong>
                {data?.priority.criteria.length
                  ? data.priority.criteria.map((item) => `${item.code}(${item.weight})`).join(" · ")
                  : "chưa có tiêu chí — sắp theo ngày vào kế hoạch"}
              </strong>
              {data?.priority.batch ? " · đang GOM LÔ khi điều độ tự động" : ""}
            </p>
            <p className="erp-hint mt-0.5">
              Bấm một bộ để chọn rồi bấm <strong>＋</strong> ở ngày muốn xếp (thủ công), hoặc bấm{" "}
              <strong>⚙ Điều độ tự động</strong> để máy đề xuất rồi bạn xác nhận.
            </p>
          </div>
          <div className="erp-scrollbar flex-1 overflow-auto">
            {(data?.waiting ?? []).map((item, index) => (
              <button
                key={item.taskId}
                type="button"
                onClick={() => setSelected(selected === item.taskId ? null : item.taskId)}
                className={`block w-full border-b border-slate-100 px-3 py-2 text-left text-[12.5px] hover:bg-cyan-50 ${
                  selected === item.taskId ? "bg-cyan-100" : ""
                }`}
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-semibold text-slate-900">
                    <span className="mr-1 inline-block w-[22px] text-right text-slate-500">{index + 1}.</span>
                    Bộ {item.setNo ?? item.setId}
                    {item.scope !== "BO" ? ` · ${item.scope}` : ""}
                  </span>
                  <span className="whitespace-nowrap text-slate-600">
                    {item.demand} {item.unit === "BO" ? "bộ" : "cánh"}
                  </span>
                </div>
                <div className="mt-0.5 flex flex-wrap gap-x-2 text-[11.5px] text-slate-600">
                  <span>{item.orderCode ?? "—"}</span>
                  <span>· {item.customerName ?? "—"}</span>
                  {item.paintColor ? <span>· {item.paintColor}</span> : null}
                  {item.dueDate ? <span>· hạn {shortDate(item.dueDate)}</span> : null}
                  <span className="text-slate-400">· điểm {item.score.toFixed(0)}</span>
                </div>
              </button>
            ))}
            {data && !data.waiting.length ? (
              <p className="px-3 py-6 text-center text-[12px] text-slate-500">
                Chưa có bộ nào đủ điều kiện vào công đoạn này.
              </p>
            ) : null}
          </div>
          {data && data.totals.blocked > 0 ? (
            <div className="border-t border-slate-200 bg-slate-50 px-3 py-2">
              <button type="button" className="text-[12px] text-slate-600 underline" onClick={() => setShowBlocked(!showBlocked)}>
                {showBlocked ? "Ẩn" : "Xem"} {data.totals.blocked} bộ CHƯA đủ điều kiện
              </button>
              {showBlocked ? (
                <ul className="erp-scrollbar mt-1 max-h-[160px] space-y-0.5 overflow-auto text-[11.5px] text-slate-600">
                  {data.blocked.slice(0, 200).map((item) => (
                    <li key={item.taskId}>
                      Bộ {item.setNo ?? item.setId} — chờ: <strong>{item.waitingFor.join(", ")}</strong>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}
        </section>

        <section className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
          {dayOptions.map((day) => (
            <div key={day.date} className={`rounded-xl border p-2 ${toneClass(day.tone)} ${day.isWorkingDay ? "" : "opacity-60"}`}>
              <div className="flex items-baseline justify-between gap-2">
                <div>
                  <span className="text-[12.5px] font-bold text-slate-900">
                    {weekdayOf(day.date)} {shortDate(day.date)}
                  </span>
                  {!day.isWorkingDay ? <span className="ml-1 text-[11px] text-red-600">(nghỉ)</span> : null}
                </div>
                <button
                  type="button"
                  className="erp-button px-2 py-0.5 text-[11px]"
                  disabled={busy || selected === null}
                  title={selected === null ? "Chọn một bộ ở danh sách đợi trước" : "Thêm bộ đã chọn vào ngày này"}
                  onClick={() => action({ action: "assign", taskId: selected, date: day.date }, "Đã thêm vào ngày")}
                >
                  ＋ Thêm
                </button>
              </div>
              <p className="erp-hint mt-0.5">
                Tải <strong>{day.worked}</strong>
                {day.capacity ? `/${day.capacity}` : ""} {day.unit === "BO" ? "bộ" : "cánh"}
                {day.ratio !== null ? ` · ${Math.round(day.ratio * 100)}%` : ""} · {day.items.length} bộ
              </p>
              <ul className="mt-1 space-y-0.5">
                {day.items.map((item) => (
                  <li key={item.taskId} className="flex items-baseline justify-between gap-2 text-[12px]">
                    <span className="truncate">
                      Bộ {item.setNo ?? item.setId}
                      {item.scope !== "BO" ? ` · ${item.scope}` : ""}
                      {item.paintColor ? ` · ${item.paintColor}` : ""}
                    </span>
                    <span className="flex items-baseline gap-1 whitespace-nowrap">
                      <span className="text-slate-500">
                        {item.demand}
                        {item.unit === "BO" ? "b" : "c"}
                      </span>
                      <button
                        type="button"
                        className="text-red-600 hover:underline"
                        disabled={busy}
                        title="Bớt bộ này khỏi ngày (các công đoạn phía sau cũng bị xoá khỏi kế hoạch)"
                        onClick={() => action({ action: "unassign", taskId: item.taskId }, "Đã bớt khỏi kế hoạch")}
                      >
                        ✕
                      </button>
                    </span>
                  </li>
                ))}
                {!day.items.length ? <li className="py-2 text-center text-[11.5px] text-slate-400">Trống</li> : null}
              </ul>
            </div>
          ))}
        </section>
      </div>

      <p className="erp-hint">
        <strong>Quy tắc:</strong> thêm hay bớt ở một công đoạn ⇒ <strong>mọi công đoạn PHÍA SAU</strong> của cùng bộ bị xoá khỏi kế hoạch ngay
        (trừ công đoạn đã Xong). Bảng tự cập nhật khi có người khác thay đổi hoặc có đơn mới — <strong>không cần F5</strong>.
      </p>
    </div>
  );
}
