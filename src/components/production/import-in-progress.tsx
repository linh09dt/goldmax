"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatDate, formatNumber } from "@/components/order-list/format";

/**
 * V136 — Đưa bộ cửa của đơn đã xác nhận vào kế hoạch sản xuất (B8: nhập bộ đang dở).
 *
 * Idempotent: bộ đã có trong kế hoạch thì bỏ qua (chống trùng theo id dòng hàng
 * và theo mã đơn + Bộ số).
 */

export type UnplannedItem = {
  id: number;
  setNo: string | null;
  model: string | null;
  productName: string | null;
  paintColor: string | null;
  heightMm: number | null;
  widthMm: number | null;
  leavesPerSet: number | null;
  quantity: number | null;
  orderCode: string | null;
  orderType: string | null;
  customerName: string | null;
  dueDate: string | null;
};

export function ImportInProgress({ items, total }: { items: UnplannedItem[]; total: number }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "err"; text: string } | null>(null);

  const toggle = (id: number) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setMessage(null);
  };

  const toggleAll = () => {
    setSelected((current) => (current.size === items.length ? new Set() : new Set(items.map((item) => item.id))));
  };

  const submit = async (orderItemIds?: number[]) => {
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch("/api/production/sets", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(orderItemIds ? { orderItemIds } : {}),
      });
      const result = (await response.json()) as {
        ok?: boolean;
        error?: string;
        createdSets?: number;
        createdTasks?: number;
        skipped?: number;
      };
      if (!response.ok || !result.ok) throw new Error(result.error || "Không đưa được vào kế hoạch.");
      setMessage({
        tone: "ok",
        text: `Đã đưa ${result.createdSets ?? 0} bộ vào kế hoạch (${result.createdTasks ?? 0} công đoạn). Bỏ qua ${result.skipped ?? 0} bộ đã có.`,
      });
      setSelected(new Set());
      router.refresh();
    } catch (error) {
      setMessage({ tone: "err", text: error instanceof Error ? error.message : "Không đưa được vào kế hoạch." });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5">
        <span className="text-[12.5px] text-slate-600">
          Còn <strong>{formatNumber(total)}</strong> bộ cửa của đơn đã xác nhận chưa có trong kế hoạch.
        </span>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <button className="erp-button-secondary" type="button" disabled={busy || selected.size === 0} onClick={() => submit(Array.from(selected))}>
            Đưa {selected.size || ""} bộ đã chọn vào kế hoạch
          </button>
          <button className="erp-button" type="button" disabled={busy || total === 0} onClick={() => submit()}>
            {busy ? "Đang xử lý…" : "Đưa TẤT CẢ vào kế hoạch"}
          </button>
        </div>
      </div>

      {message ? (
        <p className={`rounded-lg px-3 py-2 text-[12.5px] ${message.tone === "ok" ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700"}`}>
          {message.text}
        </p>
      ) : null}

      {items.length === 0 ? (
        <p className="rounded-xl border border-slate-200 bg-white px-3 py-8 text-center text-[12.5px] text-slate-500">
          Mọi bộ cửa của đơn đã xác nhận đều đã có trong kế hoạch sản xuất.
        </p>
      ) : (
        <div className="erp-scrollbar overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="erp-table">
            <thead>
              <tr>
                <th className="w-10 text-center">
                  <input type="checkbox" checked={selected.size === items.length && items.length > 0} onChange={toggleAll} />
                </th>
                <th>Bộ số</th>
                <th>Mã đơn</th>
                <th>Loại đơn</th>
                <th>Khách hàng</th>
                <th>Model</th>
                <th>Màu sơn</th>
                <th className="text-right">Cao × Rộng</th>
                <th className="text-right">Cánh</th>
                <th>Hạn giao</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className={selected.has(item.id) ? "bg-cyan-50/60" : undefined}>
                  <td className="text-center">
                    <input type="checkbox" checked={selected.has(item.id)} onChange={() => toggle(item.id)} />
                  </td>
                  <td className="erp-td-strong">{item.setNo || `#${item.id}`}</td>
                  <td>{item.orderCode || "—"}</td>
                  <td className="text-[12px] text-slate-600">{item.orderType || "—"}</td>
                  <td className="max-w-[180px] truncate" title={item.customerName ?? ""}>{item.customerName || "—"}</td>
                  <td className="max-w-[150px] truncate" title={item.model ?? ""}>{item.model || "—"}</td>
                  <td>{item.paintColor || "—"}</td>
                  <td className="erp-td-num">{item.heightMm && item.widthMm ? `${item.heightMm} × ${item.widthMm}` : "—"}</td>
                  <td className="erp-td-num">{formatNumber((item.leavesPerSet || 1) * (item.quantity || 1))}</td>
                  <td>{item.dueDate ? formatDate(new Date(item.dueDate)) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
