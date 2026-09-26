"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

/**
 * V137 — Nút "Tạo lệnh sản xuất" ngay trên trang ĐƠN HÀNG.
 *
 * Đưa TẤT CẢ bộ cửa của đơn này vào kế hoạch sản xuất (app tự sinh lệnh cha + 3 lệnh con + công đoạn).
 * Idempotent: bộ đã có lệnh thì bỏ qua, không tạo trùng.
 *
 * Chỉ dùng được với đơn ĐÃ XÁC NHẬN — đơn nháp không có Bộ số nên không vào kế hoạch được.
 */
export function CreateProductionOrderButton({
  orderId,
  orderCode,
  confirmed,
}: {
  orderId: number;
  orderCode: string;
  confirmed: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "warn" | "err"; text: string } | null>(null);

  const run = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch("/api/production/sets", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ orderIds: [orderId] }),
      });
      const result = (await response.json()) as {
        ok?: boolean;
        error?: string;
        createdSets?: number;
        createdTasks?: number;
        skipped?: number;
      };
      if (!response.ok || !result.ok) throw new Error(result.error || "Không tạo được lệnh sản xuất.");
      const created = result.createdSets ?? 0;
      const skipped = result.skipped ?? 0;
      setMessage({
        tone: created > 0 ? "ok" : "warn",
        text:
          created > 0
            ? `Đã tạo ${created} lệnh sản xuất (${result.createdTasks ?? 0} công đoạn) cho đơn ${orderCode}.`
            : `Không có bộ nào mới — ${skipped} bộ của đơn ${orderCode} đã có lệnh sản xuất.`,
      });
      router.refresh();
    } catch (error) {
      setMessage({ tone: "err", text: error instanceof Error ? error.message : "Không tạo được lệnh sản xuất." });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        className="erp-button"
        type="button"
        disabled={busy || !confirmed}
        title={confirmed ? "Đưa mọi bộ cửa của đơn này vào kế hoạch sản xuất" : "Đơn nháp chưa có Bộ số — bấm “Lưu đơn hàng” trước"}
        onClick={run}
      >
        {busy ? "Đang tạo…" : "Tạo lệnh sản xuất"}
      </button>
      {!confirmed ? (
        <span className="text-[10.5px] text-slate-500">Đơn nháp — chưa có Bộ số</span>
      ) : null}
      {message ? (
        <span
          className={`max-w-[420px] text-right text-[11px] ${
            message.tone === "ok" ? "text-emerald-700" : message.tone === "warn" ? "text-amber-700" : "text-red-600"
          }`}
        >
          {message.text}{" "}
          {message.tone === "ok" ? (
            <Link className="font-semibold underline" href="/ke-hoach-san-xuat">
              Mở kế hoạch sản xuất
            </Link>
          ) : null}
        </span>
      ) : null}
    </div>
  );
}
