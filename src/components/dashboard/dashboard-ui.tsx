import Link from "next/link";
import { formatDate, formatMoney, formatMoneyShort, formatNumber } from "@/components/order-list/format";
import type { AttentionRow, BreakdownRow, KpiBlock, MonthPoint, RankRow } from "@/lib/dashboard";

/**
 * V113 — Thành phần trình bày của tab Tổng quan. Chỉ nhận số liệu đã tính sẵn (thuần hiển thị),
 * không truy vấn DB, để trang `/` giữ đúng 2 lượt truy vấn và dễ kiểm thử.
 */

const TONE_CLASS: Record<KpiBlock["tone"], { box: string; value: string; badge: string }> = {
  neutral: { box: "border-slate-200 bg-white", value: "text-slate-900", badge: "bg-slate-100 text-slate-600" },
  good: { box: "border-emerald-200 bg-emerald-50/60", value: "text-emerald-800", badge: "bg-emerald-100 text-emerald-700" },
  warn: { box: "border-amber-200 bg-amber-50/60", value: "text-amber-800", badge: "bg-amber-100 text-amber-700" },
  bad: { box: "border-red-200 bg-red-50/60", value: "text-red-700", badge: "bg-red-100 text-red-700" },
};

export function KpiCard({ kpi }: { kpi: KpiBlock }) {
  const tone = TONE_CLASS[kpi.tone];
  return (
    <div className={`rounded-xl border px-3 py-2.5 shadow-sm ${tone.box}`}>
      <div className="flex items-start justify-between gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{kpi.label}</span>
        {kpi.deltaPercent !== null ? (
          <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold tabular-nums ${kpi.deltaPercent >= 0 ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>
            {kpi.deltaPercent >= 0 ? "▲" : "▼"} {Math.abs(kpi.deltaPercent).toFixed(1)}%
          </span>
        ) : null}
      </div>
      <div className={`mt-1 text-[19px] font-bold leading-tight tabular-nums ${tone.value}`}>{kpi.value}</div>
      <div className="mt-0.5 text-[10.5px] text-slate-500">{kpi.hint}</div>
    </div>
  );
}

/** Biểu đồ cột doanh thu + đường số đơn theo tháng (SVG thuần, không thêm thư viện). */
export function TrendChart({ months }: { months: MonthPoint[] }) {
  if (!months.length) {
    return <p className="erp-hint py-8 text-center">Chưa có đơn Sản xuất đã xác nhận trong khoảng thời gian này.</p>;
  }
  const width = 720;
  const height = 210;
  const padding = { top: 16, right: 12, bottom: 26, left: 52 };
  const innerWidth = width - padding.left - padding.right;
  const innerHeight = height - padding.top - padding.bottom;
  const maxRevenue = Math.max(...months.map((m) => m.revenue), 1);
  const maxOrders = Math.max(...months.map((m) => m.orders), 1);
  const step = innerWidth / months.length;
  const barWidth = Math.min(38, step * 0.55);

  const points = months.map((month, index) => {
    const x = padding.left + step * index + step / 2;
    const y = padding.top + innerHeight - (month.orders / maxOrders) * innerHeight;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-[210px] w-full min-w-[560px]" role="img" aria-label="Doanh thu và số đơn theo tháng">
        {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
          const y = padding.top + innerHeight * ratio;
          return (
            <g key={ratio}>
              <line x1={padding.left} x2={width - padding.right} y1={y} y2={y} stroke="#e2e8f0" strokeWidth={1} />
              <text x={padding.left - 6} y={y + 3} textAnchor="end" fontSize={9} fill="#94a3b8">
                {formatMoneyShort(maxRevenue * (1 - ratio))}
              </text>
            </g>
          );
        })}
        {months.map((month, index) => {
          const barHeight = (month.revenue / maxRevenue) * innerHeight;
          const x = padding.left + step * index + (step - barWidth) / 2;
          const y = padding.top + innerHeight - barHeight;
          return (
            <g key={month.key}>
              <rect x={x} y={y} width={barWidth} height={Math.max(1, barHeight)} rx={3} fill="#0891b2" opacity={0.85} />
              <text x={padding.left + step * index + step / 2} y={height - 8} textAnchor="middle" fontSize={9.5} fill="#64748b">
                {month.label}
              </text>
            </g>
          );
        })}
        <polyline points={points.join(" ")} fill="none" stroke="#f59e0b" strokeWidth={2} />
        {months.map((month, index) => {
          const [x, y] = points[index].split(",");
          return <circle key={month.key} cx={x} cy={y} r={3} fill="#fff" stroke="#f59e0b" strokeWidth={2} />;
        })}
      </svg>
      <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-[10.5px] text-slate-500">
        <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-cyan-600" /> Doanh thu (đơn Sản xuất đã xác nhận)</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-amber-500" /> Số đơn</span>
        <span className="ml-auto tabular-nums">
          Cao nhất: {formatMoneyShort(Math.max(...months.map((m) => m.revenue)))} · {months.reduce((sum, m) => sum + m.orders, 0)} đơn
        </span>
      </div>
    </div>
  );
}

export function BreakdownCard({
  title,
  hint,
  rows,
  tone,
}: {
  title: string;
  hint?: string;
  rows: BreakdownRow[];
  tone: "type" | "status";
}) {
  const total = rows.reduce((sum, row) => sum + row.orders, 0);
  return (
    <div className="erp-card p-3">
      <div className="flex items-baseline justify-between">
        <h3 className="erp-subsection-title">{title}</h3>
        <span className="text-[10.5px] text-slate-500">{total} đơn · giá trị đơn</span>
      </div>
      {hint ? <p className="erp-hint mt-0.5">{hint}</p> : null}
      <div className="mt-2 space-y-2">
        {rows.map((row) => {
          const color =
            tone === "status"
              ? row.key === "DA_XAC_NHAN" ? "bg-emerald-500" : "bg-amber-400"
              : row.label === "Sản xuất" ? "bg-cyan-600" : row.label === "Đơn làm lại" ? "bg-violet-500" : "bg-slate-400";
          return (
            <div key={row.key}>
              <div className="flex items-baseline justify-between gap-2 text-[11.5px]">
                <span className="min-w-0 truncate font-semibold text-slate-700">{row.label}</span>
                <span className="shrink-0 tabular-nums text-slate-600">
                  {row.orders} đơn
                  <span className="ml-1 text-slate-400">·</span>
                  <span className="ml-1 font-semibold text-slate-800">{formatMoneyShort(row.value)}</span>
                </span>
              </div>
              <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.max(row.share, row.orders ? 3 : 0)}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function RankCard({
  title,
  hint,
  rows,
  unitLabel = "KH/Lượng",
  emptyText = "Chưa có dữ liệu",
}: {
  title: string;
  hint?: string;
  rows: RankRow[];
  unitLabel?: string;
  emptyText?: string;
}) {
  const max = Math.max(...rows.map((row) => row.revenue), 1);
  return (
    <div className="erp-card flex flex-col p-3">
      <div className="flex items-baseline justify-between">
        <h3 className="erp-subsection-title">{title}</h3>
        <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Doanh thu</span>
      </div>
      {hint ? <p className="erp-hint mt-0.5">{hint}</p> : null}
      {rows.length === 0 ? (
        <p className="erp-hint mt-3">{emptyText}</p>
      ) : (
        <ol className="mt-2 space-y-1.5">
          {rows.map((row, index) => (
            <li key={row.key} className="grid grid-cols-[16px_minmax(0,1fr)_auto] items-center gap-2">
              <span className="text-[10.5px] font-bold tabular-nums text-slate-400">{index + 1}</span>
              <span className="min-w-0">
                <span className="block truncate text-[11.5px] font-semibold text-slate-800" title={row.label}>{row.label}</span>
                <span className="mt-0.5 block h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                  <span className="block h-full rounded-full bg-cyan-500" style={{ width: `${(row.revenue / max) * 100}%` }} />
                </span>
                <span className="mt-0.5 block truncate text-[10px] text-slate-500">
                  {row.sub ? `${row.sub} · ` : ""}{row.orders} dòng · {formatNumber(row.volume)} {unitLabel}
                </span>
              </span>
              <span className="shrink-0 text-right text-[11.5px] font-bold tabular-nums text-slate-900">{formatMoneyShort(row.revenue)}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

export function AttentionCard({ rows }: { rows: AttentionRow[] }) {
  return (
    <div className="erp-card overflow-hidden">
      <div className="flex items-baseline justify-between border-b border-slate-200 bg-slate-50 px-3 py-2">
        <h3 className="erp-subsection-title">Đơn cần chú ý</h3>
        <span className="text-[10.5px] text-slate-500">Quá hạn · đến hạn 7 ngày · nháp chưa xác nhận</span>
      </div>
      {rows.length === 0 ? (
        <p className="erp-hint px-3 py-4">Không có đơn nào cần chú ý. </p>
      ) : (
        <table className="erp-table">
          <thead>
            <tr>
              <th>Đơn hàng</th>
              <th>Khách hàng</th>
              <th>Mốc ngày</th>
              <th className="text-right">Tình trạng</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={`${row.type}-${row.orderCode}`}>
                <td className="erp-td-strong">
                  <Link className="text-cyan-700 hover:underline" href={`/orders?q=${encodeURIComponent(row.orderCode)}`}>{row.orderCode}</Link>
                </td>
                <td className="max-w-[220px] truncate" title={row.customer}>{row.customer}</td>
                <td>{formatDate(row.date)}</td>
                <td className="text-right">
                  <span className={`inline-flex whitespace-nowrap rounded-full border px-2 py-0.5 text-[10.5px] font-bold ${row.tone === "bad" ? "border-red-300 bg-red-50 text-red-700" : "border-amber-300 bg-amber-50 text-amber-800"}`}>
                    {row.hint}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export function MoneyFootnote({ revenue, receivable, volume }: { revenue: number; receivable: number; volume: number }) {
  return (
    <p className="erp-hint">
      Doanh thu tính trên đơn <b>loại Sản xuất</b> ở trạng thái <b>Đã xác nhận</b>: {formatMoney(revenue)} · còn phải thu{" "}
      {formatMoney(receivable)} · sản lượng {formatNumber(volume)}.
    </p>
  );
}
