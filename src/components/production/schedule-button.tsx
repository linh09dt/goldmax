"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * V136 — Nút Xếp lịch tự động.
 *
 * J8: nhà máy chọn "báo đỏ để xử lý", KHÔNG tự đề xuất lại lịch → vì vậy xếp lịch chỉ chạy
 * khi người dùng bấm, không tự chạy nền.
 */
export function ScheduleButton({ pendingCount }: { pendingCount: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [rescheduleAll, setRescheduleAll] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "err"; text: string } | null>(null);

  const run = async () => {
    if (rescheduleAll && !window.confirm("Xếp lại lịch cho TẤT CẢ bộ đang mở (kể cả bộ đã xếp lịch). Tiếp tục?")) return;
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch("/api/production/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ rescheduleAll }),
      });
      const result = (await response.json()) as {
        ok?: boolean;
        error?: string;
        scheduledSets?: number;
        scheduledTasks?: number;
        skippedSets?: number;
        overloadCells?: number;
        lastDay?: string | null;
      };
      if (!response.ok || !result.ok) throw new Error(result.error || "Không xếp lịch được.");
      setMessage({
        tone: "ok",
        text: `Đã xếp ${result.scheduledSets ?? 0} bộ (${result.scheduledTasks ?? 0} công đoạn) tới ngày ${result.lastDay ?? "—"}${
          result.overloadCells ? ` · ${result.overloadCells} chỗ vượt năng lực (xem cảnh báo)` : ""
        }${result.skippedSets ? ` · bỏ qua ${result.skippedSets} bộ đã xong hết công đoạn` : ""}.`,
      });
      router.refresh();
    } catch (error) {
      setMessage({ tone: "err", text: error instanceof Error ? error.message : "Không xếp lịch được." });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-2">
        <label className="flex items-center gap-1.5 text-[11.5px] text-slate-600">
          <input type="checkbox" checked={rescheduleAll} onChange={(event) => setRescheduleAll(event.target.checked)} />
          Xếp lại cả bộ đã có lịch
        </label>
        <button className="erp-button" type="button" disabled={busy || (!rescheduleAll && pendingCount === 0)} onClick={run}>
          {busy ? "Đang xếp…" : `Xếp lịch tự động${!rescheduleAll && pendingCount ? ` (${pendingCount})` : ""}`}
        </button>
      </div>
      {message ? (
        <span className={`text-[11.5px] ${message.tone === "ok" ? "text-emerald-700" : "text-red-600"}`}>{message.text}</span>
      ) : null}
    </div>
  );
}
