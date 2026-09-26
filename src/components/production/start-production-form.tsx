"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/**
 * V144 — "ĐƯA VÀO SẢN XUẤT": nhập MỘT mốc ngày bắt đầu.
 *  - "Xem mốc"  → tính trước mốc của mọi công đoạn (server render lại với ?ngay=…)
 *  - "Đưa vào sản xuất" → lưu mốc + bộ chuyển WIP ở công đoạn đầu tiên
 */
export function StartProductionForm({
  setId,
  defaultDate,
  started = false,
}: {
  setId: number;
  defaultDate: string;
  started?: boolean;
}) {
  const router = useRouter();
  const [date, setDate] = useState(defaultDate);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "err"; text: string } | null>(null);

  const preview = () => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return;
    router.push(`/ke-hoach-san-xuat/bo/${setId}?ngay=${date}`);
  };

  const start = async () => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      setMessage({ tone: "err", text: "Chọn ngày bắt đầu sản xuất." });
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/production/sets/${setId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "start", startDate: date }),
      });
      const result = (await response.json()) as { ok?: boolean; error?: string; end?: string; totalDays?: number };
      if (!response.ok || !result.ok) throw new Error(result.error || "Không đưa được bộ vào sản xuất.");
      setMessage({ tone: "ok", text: `Đã đưa vào sản xuất · dự kiến xong ${result.end ? `${result.end.slice(8, 10)}/${result.end.slice(5, 7)}/${result.end.slice(0, 4)}` : "—"} (${result.totalDays} ngày làm việc)` });
      router.push(`/ke-hoach-san-xuat/bo/${setId}`);
      router.refresh();
    } catch (error) {
      setMessage({ tone: "err", text: error instanceof Error ? error.message : "Lỗi không rõ." });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3 px-3 pb-3 pt-1">
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1 text-[12px]">
          <span className="font-medium text-slate-700">Ngày bắt đầu sản xuất</span>
          <input
            className="erp-input w-[160px]"
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
          />
        </label>
        <button type="button" className="erp-button-secondary" onClick={preview} disabled={busy || started}>
          Xem mốc các công đoạn
        </button>
        {!started ? (
          <button type="button" className="erp-button" onClick={start} disabled={busy}>
            {busy ? "Đang lưu…" : "Đưa vào sản xuất"}
          </button>
        ) : null}
      </div>

      {message ? (
        <p className={`text-[12.5px] ${message.tone === "ok" ? "text-emerald-700" : "text-red-700"}`}>{message.text}</p>
      ) : null}

      <p className="erp-hint">
        Nhập <strong>một mốc</strong> rồi bấm <em>Xem mốc</em> để thấy mốc (target) của mọi công đoạn phía sau; bấm{" "}
        <em>Đưa vào sản xuất</em> thì bộ chuyển sang <strong>đang sản xuất</strong> ở công đoạn đầu tiên.
        Số ngày mỗi bước = số giờ của bước ÷ giờ/ngày (2 ca × 8h = 16), bỏ Chủ nhật + ngày lễ; các công đoạn{" "}
        <strong>cùng bước chạy song song nên cùng ngày</strong>.
      </p>
    </div>
  );
}
