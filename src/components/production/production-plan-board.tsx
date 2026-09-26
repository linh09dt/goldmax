"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatDate, formatNumber } from "@/components/order-list/format";
import { SET_STATUS_LABELS } from "@/lib/production/catalog";

/**
 * V137 — KẾ HOẠCH TUẦN + CHỐT KẾ HOẠCH.
 *
 * J3: kế hoạch tuần do kinh doanh + sản xuất thống nhất, **giám đốc nhà máy chốt**.
 * J1: mọi thao tác chốt / mở lại đều ghi `production_logs`.
 */

export type PlanSetRow = {
  id: number;
  setNo: string | null;
  orderCode: string | null;
  customerName: string | null;
  model: string | null;
  paintColor: string | null;
  dueDate: string | null;
  status: string;
  percentDone: number;
  canh: number;
  plannedStart: string | null;
  plannedEnd: string | null;
};

export type PlanRow = {
  id: number;
  code: string;
  fromDate: string;
  toDate: string;
  status: string;
  createdBy: string | null;
  approvedBy: string | null;
  approvedAt: string | null;
  note: string | null;
  setCount: number;
  canhTotal: number;
  completed: number;
  inProgress: number;
  waiting: number;
  cancelled: number;
  sets: PlanSetRow[];
};

async function post(body: Record<string, unknown>): Promise<{ ok?: boolean; error?: string; assigned?: number; created?: boolean; code?: string }> {
  const response = await fetch("/api/production/plans", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body),
  });
  const result = (await response.json()) as { ok?: boolean; error?: string; assigned?: number; created?: boolean; code?: string };
  if (!response.ok || !result.ok) throw new Error(result.error || "Không thực hiện được.");
  return result;
}

const STATUS_STYLE: Record<string, string> = {
  NHAP: "bg-amber-100 text-amber-900",
  DA_CHOT: "bg-emerald-100 text-emerald-800",
};

export function ProductionPlanBoard({
  plans,
  defaultFrom,
  defaultTo,
}: {
  plans: PlanRow[];
  defaultFrom: string;
  defaultTo: string;
}) {
  const router = useRouter();
  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(defaultTo);
  const [note, setNote] = useState("");
  const [byName, setByName] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "err"; text: string } | null>(null);

  const run = async (body: Record<string, unknown>, okText: (result: Awaited<ReturnType<typeof post>>) => string) => {
    setBusy(true);
    setMessage(null);
    try {
      const result = await post(body);
      setMessage({ tone: "ok", text: okText(result) });
      router.refresh();
    } catch (error) {
      setMessage({ tone: "err", text: error instanceof Error ? error.message : "Không thực hiện được." });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      <section className="erp-card overflow-hidden">
        <div className="border-b border-slate-200 bg-slate-50 px-3 py-2">
          <h2 className="text-[13px] font-semibold text-slate-900">Tạo kế hoạch cho một khoảng ngày</h2>
          <p className="text-[11px] text-slate-500">
            Hệ thống gom mọi bộ cửa <strong>đã xếp lịch</strong> có ngày bắt đầu nằm trong khoảng này vào kế hoạch. Bấm lại cùng khoảng ngày sẽ
            không tạo trùng.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-3 px-3 py-3">
          <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Từ ngày
            <input className="erp-input mt-1 w-[150px]" type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
          </label>
          <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Đến ngày
            <input className="erp-input mt-1 w-[150px]" type="date" value={to} onChange={(event) => setTo(event.target.value)} />
          </label>
          <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Người lập
            <input className="erp-input mt-1 w-[190px]" placeholder="Tên người lập kế hoạch" value={byName} onChange={(event) => setByName(event.target.value)} />
          </label>
          <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Ghi chú
            <input className="erp-input mt-1 w-[260px]" placeholder="để trống" value={note} onChange={(event) => setNote(event.target.value)} />
          </label>
          <button
            className="erp-button"
            type="button"
            disabled={busy || !from || !to}
            onClick={() =>
              run({ action: "create", fromDate: from, toDate: to, note, createdBy: byName }, (result) =>
                `${result.created ? "Đã tạo" : "Đã có"} kế hoạch ${result.code} · gán ${result.assigned ?? 0} bộ.`,
              )
            }
          >
            {busy ? "Đang xử lý…" : "Tạo / gom bộ vào kế hoạch"}
          </button>
        </div>
        {message ? (
          <p className={`px-3 pb-2 text-[12.5px] ${message.tone === "ok" ? "text-emerald-700" : "text-red-600"}`}>{message.text}</p>
        ) : null}
      </section>

      {plans.length === 0 ? (
        <p className="rounded-xl border border-slate-200 bg-white px-3 py-8 text-center text-[12.5px] text-slate-500">
          Chưa có kế hoạch nào. Tạo kế hoạch tuần ở khung trên (sau khi đã “Xếp lịch tự động”).
        </p>
      ) : null}

      {plans.map((plan) => {
        const locked = plan.status === "DA_CHOT";
        return (
          <section key={plan.id} className="erp-card overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 px-3 py-2">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-[13px] font-semibold text-slate-900">Kế hoạch {plan.code}</h2>
                <span className={`rounded px-1.5 py-0.5 text-[11px] ${STATUS_STYLE[plan.status] ?? "bg-slate-100 text-slate-700"}`}>
                  {plan.status === "DA_CHOT" ? "ĐÃ CHỐT" : "Chưa chốt"}
                </span>
                <span className="text-[11.5px] text-slate-500">
                  {formatDate(new Date(plan.fromDate))} → {formatDate(new Date(plan.toDate))}
                  {plan.createdBy ? ` · lập bởi ${plan.createdBy}` : ""}
                  {plan.approvedBy ? ` · chốt bởi ${plan.approvedBy}${plan.approvedAt ? ` lúc ${formatDate(new Date(plan.approvedAt))}` : ""}` : ""}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {locked ? (
                  <button className="erp-button-secondary" type="button" disabled={busy} onClick={() => run({ action: "reopen", id: plan.id, byName }, () => `Đã mở lại kế hoạch ${plan.code}.`)}>
                    Mở lại
                  </button>
                ) : (
                  <button
                    className="erp-button"
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      if (!byName.trim()) {
                        setMessage({ tone: "err", text: "Nhập tên người chốt (giám đốc nhà máy) rồi bấm Chốt kế hoạch." });
                        return;
                      }
                      void run({ action: "approve", id: plan.id, approvedBy: byName }, () => `Đã chốt kế hoạch ${plan.code} — ${byName}.`);
                    }}
                  >
                    Chốt kế hoạch
                  </button>
                )}
                <button
                  className="erp-action-danger"
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    if (!window.confirm(`Xoá kế hoạch ${plan.code}? Các bộ trở về trạng thái chưa gán kế hoạch (không mất tiến độ).`)) return;
                    void run({ action: "delete", id: plan.id }, () => `Đã xoá kế hoạch ${plan.code}.`);
                  }}
                >
                  Xoá
                </button>
              </div>
            </div>

            {plan.note ? <p className="border-b border-slate-100 bg-amber-50/50 px-3 py-1.5 text-[11.5px] text-amber-900">Ghi chú: {plan.note}</p> : null}

            <div className="flex flex-wrap gap-x-6 gap-y-1 px-3 py-2 text-[12px] text-slate-700">
              <span><strong>{formatNumber(plan.setCount)}</strong> bộ</span>
              <span><strong>{formatNumber(plan.canhTotal)}</strong> cánh</span>
              <span className="text-emerald-700">hoàn thành <strong>{formatNumber(plan.completed)}</strong></span>
              <span className="text-blue-700">đang làm <strong>{formatNumber(plan.inProgress)}</strong></span>
              <span className="text-amber-700">chờ xếp lịch <strong>{formatNumber(plan.waiting)}</strong></span>
              {plan.cancelled ? <span className="text-slate-500">đã huỷ <strong>{formatNumber(plan.cancelled)}</strong></span> : null}
            </div>

            {plan.sets.length ? (
              <div className="erp-scrollbar max-h-[420px] overflow-auto">
                <table className="erp-table">
                  <thead className="sticky top-0">
                    <tr>
                      <th>Bộ số</th>
                      <th>Mã đơn</th>
                      <th>Khách hàng</th>
                      <th>Model</th>
                      <th>Màu</th>
                      <th className="text-right">Cánh</th>
                      <th>Hạn giao</th>
                      <th>Xếp lịch</th>
                      <th className="text-right">Tiến độ</th>
                      <th>Trạng thái</th>
                    </tr>
                  </thead>
                  <tbody>
                    {plan.sets.map((set) => (
                      <tr key={set.id}>
                        <td className="erp-td-strong">
                          <Link className="font-semibold text-cyan-700 hover:underline" href={`/ke-hoach-san-xuat/bo/${set.id}`}>
                            {set.setNo || `#${set.id}`}
                          </Link>
                        </td>
                        <td>{set.orderCode || "—"}</td>
                        <td className="max-w-[180px] truncate" title={set.customerName ?? ""}>{set.customerName || "—"}</td>
                        <td className="max-w-[150px] truncate" title={set.model ?? ""}>{set.model || "—"}</td>
                        <td>{set.paintColor || "—"}</td>
                        <td className="erp-td-num">{formatNumber(set.canh)}</td>
                        <td>{formatDate(set.dueDate ? new Date(set.dueDate) : null)}</td>
                        <td className="whitespace-nowrap text-[11.5px] text-slate-500">
                          {set.plannedStart ? `${formatDate(new Date(set.plannedStart))} → ${formatDate(set.plannedEnd ? new Date(set.plannedEnd) : null)}` : "chưa gán"}
                        </td>
                        <td className="erp-td-num">{set.percentDone}%</td>
                        <td>
                          <span className={`rounded px-1.5 py-0.5 text-[11px] ${set.status === "HUY" ? "bg-slate-200 text-slate-600" : "bg-slate-100 text-slate-700"}`}>
                            {SET_STATUS_LABELS[set.status] ?? set.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="px-3 py-4 text-center text-[12px] text-slate-500">
                Kế hoạch này chưa có bộ nào — các bộ phải được “Xếp lịch tự động” trước, rồi bấm “Tạo / gom bộ vào kế hoạch”.
              </p>
            )}
          </section>
        );
      })}
    </div>
  );
}
