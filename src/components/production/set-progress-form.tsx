"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { TASK_STATUS_LABELS, TASK_STATUS_OPTIONS, type TaskStatus } from "@/lib/production/catalog";

/**
 * V136 — Cập nhật tiến độ TỪNG CÔNG ĐOẠN của một bộ cửa (KH22/L2).
 *
 * KH21/KH23: nhập bằng máy tính ở xưởng, do văn phòng cập nhật.
 * Ghi gộp: mọi thay đổi gửi trong MỘT lượt POST → 1 lượt ghi DB (bài học V111).
 *
 * V141 — XẾP LỊCH BẰNG TAY: mỗi công đoạn có ô "Ngày KH". Ngày của BỘ tự suy = min/max
 * ngày các công đoạn (trừ khi bạn nhập thẳng ô "Xếp lịch từ / đến" bên trên).
 */

export type ProgressTask = {
  id: number;
  stageCode: string;
  stageName: string;
  stageKind: string;
  scope: string;
  scopeLabel: string;
  workCenterName: string | null;
  status: string;
  qtyExpected: number | null;
  qtyDone: number | null;
  /** V141 — ngày kế hoạch của công đoạn ("YYYY-MM-DD") để gán bằng tay. */
  plannedStart: string | null;
  actualStart: string | null;
  actualEnd: string | null;
  assignee: string | null;
  isRework: boolean;
  reasonCode: string | null;
  note: string | null;
  /** V142 — mã lệnh sản xuất của công đoạn (chỉ để xem, không sửa ở đây). */
  workOrderCode: string | null;
  /** V144 — MỐC (target) hệ thống tự suy từ ngày bắt đầu sản xuất (chỉ để xem). */
  targetStart: string | null;
  targetEnd: string | null;
  /** V136.1 — lý do đang bị khoá (chưa xong công đoạn bắt buộc). Null = được phép chạy. */
  lockedReason: string | null;
};

type ReasonOption = { code: string; name: string; group: string };

/** V137: lệnh con của bộ — số lượng sửa tay được (bộ cần số phào/cánh khác công thức). */
export type ComponentOrderInput = {
  id: number;
  kind: string;
  kindLabel: string;
  qtyExpected: number | null;
  /** Gợi ý số lượng theo công thức, để hiện cạnh ô nhập khi người dùng sửa khác. */
  formulaQty: number | null;
};

type Patch = {
  status?: TaskStatus;
  note?: string | null;
  reasonCode?: string | null;
  assignee?: string | null;
  isRework?: boolean;
  /** V141 — ngày kế hoạch gán tay; undefined = không đổi, null = xoá. */
  plannedStart?: string | null;
};

const STATUS_STYLE: Record<string, string> = {
  CHUA_LAM: "text-slate-500",
  DANG_LAM: "text-blue-700 font-semibold",
  XONG: "text-emerald-700 font-semibold",
  BO_QUA: "text-slate-400 italic",
  TAM_DUNG: "text-amber-700 font-semibold",
};

function formatDateTime(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  const pad = (number: number) => String(number).padStart(2, "0");
  return `${pad(date.getUTCDate())}/${pad(date.getUTCMonth() + 1)} ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}`;
}

export function SetProgressForm({
  setId,
  tasks,
  reasons,
  components = [],
  plannedStart,
  plannedEnd,
  todayVn,
  byName: initialByName,
}: {
  setId: number;
  tasks: ProgressTask[];
  reasons: ReasonOption[];
  components?: ComponentOrderInput[];
  plannedStart: string | null;
  plannedEnd: string | null;
  /** V144 — "hôm nay" theo giờ Việt Nam (server truyền xuống) để đánh dấu "chậm" cho đúng ngày. */
  todayVn: string;
  byName: string | null;
}) {
  const router = useRouter();
  const [patches, setPatches] = useState<Record<number, Patch>>({});
  const [componentQty, setComponentQty] = useState<Record<number, string>>(() =>
    Object.fromEntries(components.map((row) => [row.id, row.qtyExpected === null ? "" : String(row.qtyExpected)])),
  );
  const [start, setStart] = useState(plannedStart ?? "");
  const [end, setEnd] = useState(plannedEnd ?? "");
  const [byName, setByName] = useState(initialByName ?? "");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "err"; text: string } | null>(null);

  const dirtyCount = Object.keys(patches).length;
  // V141 — chỉ gửi ngày cấp bộ khi người dùng TỰ sửa 2 ô trên; nếu không, ngày bộ suy từ ngày công đoạn.
  const planDirty = start !== (plannedStart ?? "") || end !== (plannedEnd ?? "");
  const componentChanged = components.filter(
    (row) => (componentQty[row.id] ?? "") !== (row.qtyExpected === null ? "" : String(row.qtyExpected)),
  );
  const pauseReasons = useMemo(() => reasons.filter((reason) => reason.group === "TAM_DUNG"), [reasons]);
  const reworkReasons = useMemo(() => reasons.filter((reason) => reason.group === "LOI"), [reasons]);

  const valueOf = (task: ProgressTask, key: keyof Patch) => {
    const patch = patches[task.id];
    if (patch && key in patch) return patch[key];
    return task[key as keyof ProgressTask];
  };

  const setPatch = (taskId: number, patch: Patch) => {
    setPatches((current) => ({ ...current, [taskId]: { ...current[taskId], ...patch } }));
    setMessage(null);
  };

  const toggleRework = (task: ProgressTask) => {
    const next = !Boolean(valueOf(task, "isRework"));
    setPatch(task.id, { isRework: next, reasonCode: next ? (valueOf(task, "reasonCode") as string | null) : null });
  };

  const save = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/production/sets/${setId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          action: "update",
          byName: byName || null,
          ...(planDirty ? { plannedStart: start || null, plannedEnd: end || null } : {}),
          components: componentChanged.map((row) => ({
            id: row.id,
            qtyExpected: (componentQty[row.id] ?? "").trim() === "" ? null : Number(componentQty[row.id]),
          })),
          tasks: Object.entries(patches).map(([id, patch]) => ({
            id: Number(id),
            status: patch.status,
            plannedStart: patch.plannedStart,
            note: patch.note ?? undefined,
            reasonCode: patch.reasonCode ?? undefined,
            assignee: patch.assignee ?? undefined,
            isRework: patch.isRework,
          })),
        }),
      });
      const result = (await response.json()) as { ok?: boolean; error?: string; percentDone?: number; status?: string };
      if (!response.ok || !result.ok) throw new Error(result.error || "Không lưu được tiến độ.");
      setPatches({});
      // Sau khi lưu, `router.refresh()` cập nhật lại props nên ô "chưa lưu" tự hết —
      // không cần đồng bộ state bằng tay.
      setMessage({ tone: "ok", text: `Đã lưu. Tiến độ ${result.percentDone ?? 0}%.` });
      router.refresh();
    } catch (error) {
      setMessage({ tone: "err", text: error instanceof Error ? error.message : "Không lưu được tiến độ." });
    } finally {
      setBusy(false);
    }
  };

  const markDelivered = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/production/sets/${setId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ action: "delivered", byName: byName || null, deliveredDate: new Date().toISOString().slice(0, 10) }),
      });
      const result = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok || !result.ok) throw new Error(result.error || "Không đánh dấu được đã giao.");
      setMessage({ tone: "ok", text: "Đã đánh dấu ĐÃ GIAO hôm nay." });
      router.refresh();
    } catch (error) {
      setMessage({ tone: "err", text: error instanceof Error ? error.message : "Không đánh dấu được đã giao." });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5">
        <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          Xếp lịch từ
          <input className="erp-input mt-1 w-[150px]" type="date" value={start} onChange={(event) => setStart(event.target.value)} />
        </label>
        <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          đến
          <input className="erp-input mt-1 w-[150px]" type="date" value={end} onChange={(event) => setEnd(event.target.value)} />
        </label>
        <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          Người cập nhật
          <input
            className="erp-input mt-1 w-[190px]"
            placeholder="Tên người nhập"
            value={byName}
            onChange={(event) => setByName(event.target.value)}
          />
        </label>
        <div className="ml-auto flex items-center gap-2">
          {dirtyCount > 0 || componentChanged.length > 0 ? (
            <span className="text-[12px] text-amber-700">
              chưa lưu: {dirtyCount ? `${dirtyCount} công đoạn` : ""}
              {dirtyCount && componentChanged.length ? " · " : ""}
              {componentChanged.length ? `${componentChanged.length} số lượng lệnh con` : ""}
            </span>
          ) : null}
          <button className="erp-button" type="button" disabled={busy || (dirtyCount === 0 && componentChanged.length === 0)} onClick={save}>
            {busy ? "Đang lưu…" : "Lưu tiến độ"}
          </button>
          <button className="erp-button-secondary" type="button" disabled={busy} onClick={markDelivered}>
            Đánh dấu đã giao
          </button>
        </div>
      </div>

      {message ? (
        <p className={`rounded-lg px-3 py-2 text-[12.5px] ${message.tone === "ok" ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700"}`}>
          {message.text}
        </p>
      ) : null}

      {components.length ? (
        <div className="rounded-xl border border-slate-200 bg-white px-3 py-2.5">
          <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Số lượng lệnh con (sửa tay được)
          </div>
          <div className="flex flex-wrap items-end gap-4">
            {components.map((row) => {
              const value = componentQty[row.id] ?? "";
              const khacCongThuc = String(row.formulaQty ?? "") !== value && (value !== "" || row.formulaQty !== null);
              return (
                <label key={row.id} className="text-[11.5px] text-slate-600">
                  {row.kindLabel}
                  <input
                    className="erp-input mt-1 w-[110px]"
                    type="number"
                    min={0}
                    value={value}
                    onChange={(event) => {
                      setComponentQty((current) => ({ ...current, [row.id]: event.target.value }));
                      setMessage(null);
                    }}
                  />
                  <span className={`ml-1.5 text-[10.5px] ${khacCongThuc ? "text-amber-700" : "text-slate-400"}`}>
                    công thức: {row.formulaQty ?? "—"}
                  </span>
                </label>
              );
            })}
          </div>
        </div>
      ) : null}

      <div className="erp-scrollbar overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="erp-table">
          <thead>
            <tr>
              <th className="min-w-[200px]">Công đoạn</th>
              <th className="min-w-[150px]">Mã lệnh</th>
              <th className="min-w-[145px]">Mốc (target)</th>
              <th>Bộ phận</th>
              <th>Tổ phụ trách</th>
              <th className="text-right">SL</th>
              <th className="min-w-[140px]">Ngày KH</th>
              <th className="min-w-[130px]">Trạng thái</th>
              <th>Bắt đầu thực tế</th>
              <th>Xong thực tế</th>
              <th className="min-w-[170px]">Lý do</th>
              <th className="min-w-[150px]">Người làm</th>
              <th className="min-w-[180px]">Ghi chú</th>
              <th>Làm lại</th>
            </tr>
          </thead>
          <tbody>
            {tasks.map((task) => {
              const status = String(valueOf(task, "status") ?? task.status);
              const isWait = task.stageKind === "CHO";
              const locked = Boolean(task.lockedReason) && (status === "CHUA_LAM" || status === "DANG_LAM");
              const reasonChoices = status === "TAM_DUNG" ? pauseReasons : reworkReasons;
              return (
                <tr key={task.id} className={isWait ? "bg-slate-50/60" : locked ? "bg-amber-50/40" : undefined}>
                  <td className="erp-td-strong">
                    <div>{task.stageName}</div>
                    {locked ? (
                      <span className="mt-0.5 inline-block rounded bg-amber-100 px-1.5 py-0.5 text-[10.5px] font-medium text-amber-900">
                        🔒 chờ {task.lockedReason}
                      </span>
                    ) : null}
                  </td>
                  <td className="whitespace-nowrap text-[11px] font-medium tabular-nums text-slate-500">{task.workOrderCode ?? "—"}</td>
                  <td className="whitespace-nowrap text-[11.5px]">
                    {task.targetStart ? (
                      <>
                        {task.targetStart.slice(8, 10)}/{task.targetStart.slice(5, 7)}
                        {task.targetEnd && task.targetEnd !== task.targetStart
                          ? ` → ${task.targetEnd.slice(8, 10)}/${task.targetEnd.slice(5, 7)}`
                          : ""}
                      </>
                    ) : (
                      "—"
                    )}
                    {task.targetEnd && task.status !== "XONG" && task.status !== "BO_QUA" && task.targetEnd < todayVn ? (
                      <span className="ml-1 font-semibold text-red-700">chậm</span>
                    ) : null}
                  </td>
                  <td>{task.scopeLabel}</td>
                  <td className="text-[12px] text-slate-600">{task.workCenterName || "—"}</td>
                  <td className="erp-td-num">{task.qtyExpected ?? "—"}</td>
                  <td>
                    <input
                      className="erp-input w-[140px]"
                      type="date"
                      value={String(valueOf(task, "plannedStart") ?? "")}
                      onChange={(event) => setPatch(task.id, { plannedStart: event.target.value || null })}
                    />
                  </td>
                  <td>
                    <select
                      className={`erp-input ${STATUS_STYLE[status] ?? ""}`}
                      value={status}
                      onChange={(event) => setPatch(task.id, { status: event.target.value as TaskStatus })}
                    >
                      {TASK_STATUS_OPTIONS.map((option) => (
                        <option
                          key={option}
                          value={option}
                          disabled={locked && (option === "DANG_LAM" || option === "XONG")}
                        >
                          {TASK_STATUS_LABELS[option]}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="text-[11.5px] tabular-nums text-slate-500">{formatDateTime(task.actualStart)}</td>
                  <td className="text-[11.5px] tabular-nums text-slate-500">{formatDateTime(task.actualEnd)}</td>
                  <td>
                    <select
                      className="erp-input"
                      value={String(valueOf(task, "reasonCode") ?? "")}
                      onChange={(event) => setPatch(task.id, { reasonCode: event.target.value || null })}
                      disabled={status !== "TAM_DUNG" && !Boolean(valueOf(task, "isRework"))}
                    >
                      <option value="">—</option>
                      {reasonChoices.map((reason) => (
                        <option key={reason.code} value={reason.code}>
                          {reason.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <input
                      className="erp-input"
                      value={String(valueOf(task, "assignee") ?? "")}
                      placeholder="để trống"
                      onChange={(event) => setPatch(task.id, { assignee: event.target.value })}
                    />
                  </td>
                  <td>
                    <input
                      className="erp-input"
                      value={String(valueOf(task, "note") ?? "")}
                      placeholder="để trống"
                      onChange={(event) => setPatch(task.id, { note: event.target.value })}
                    />
                  </td>
                  <td className="text-center">
                    <input type="checkbox" checked={Boolean(valueOf(task, "isRework"))} onChange={() => toggleRework(task)} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="erp-hint">
        <strong>Xếp lịch bằng tay:</strong> gán <strong>Ngày KH</strong> cho từng công đoạn rồi bấm <strong>Lưu tiến độ</strong> —
        ngày của bộ tự tính bằng ngày sớm nhất → muộn nhất của các công đoạn, nên bảng tải và cột “Xếp lịch” luôn khớp.
        Hai ô “Xếp lịch từ / đến” ở trên là để <em>ghi đè</em> ngày cấp bộ khi cần. Công đoạn cùng một bước (Cắt cánh / Cắt khung / Cắt phào) nên gán cùng ngày.
      </p>
      <p className="erp-hint">
        Dòng có dấu 🔒 là chưa được chạy: phải báo hoàn thành công đoạn trước (ví dụ Test cơ khí chỉ mở khi{" "}
        <strong>cả 3 phần cánh + khung + phào</strong> đã hàn xong). Chọn “Xong” sẽ tự ghi mốc kết thúc. Khi tất cả công đoạn cần làm đều Xong, bộ chuyển sang <strong>Hoàn thành</strong> và ghi mốc
        hoàn thành sản xuất (mốc tính giao đúng hạn). Công đoạn “Chờ” là thời gian khô/nguội, không chiếm năng lực tổ.
      </p>
    </div>
  );
}
