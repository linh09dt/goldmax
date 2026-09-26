import Link from "next/link";
import { ORDER_LIST_STATE_FILTERS, ORDER_LIST_PRESETS, buildOrderListQueryString, type OrderListQuery } from "@/lib/order-list-filters";
import { ORDER_TYPE_OPTIONS } from "@/lib/order-form";
import { formatMoney, formatMoneyShort, formatNumber } from "@/components/order-list/format";
import type { FilterOption } from "@/lib/report-data";

/**
 * V130 — Thành phần trình bày dùng chung cho nhóm trang BÁO CÁO.
 * Chỉ nhận số liệu đã tính sẵn (thuần hiển thị), không truy vấn DB.
 *
 * V130.1: thanh lọc của MỌI trang báo cáo được gom về ĐÚNG 1 DÒNG
 * (flex-nowrap + cuộn ngang khi màn hình hẹp) — gồm cả nút Lọc / Xoá lọc / Xuất Excel.
 */

export type KpiTone = "neutral" | "good" | "warn" | "bad";

const TONE_CLASS: Record<KpiTone, { box: string; value: string }> = {
  neutral: { box: "border-slate-200 bg-white", value: "text-slate-900" },
  good: { box: "border-emerald-200 bg-emerald-50/60", value: "text-emerald-800" },
  warn: { box: "border-amber-200 bg-amber-50/60", value: "text-amber-800" },
  bad: { box: "border-red-200 bg-red-50/60", value: "text-red-700" },
};

export function ReportKpi({
  label,
  value,
  hint,
  tone = "neutral",
  href,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: KpiTone;
  href?: string;
}) {
  const style = TONE_CLASS[tone];
  const inner = (
    <div className={`h-full rounded-xl border px-3 py-2.5 shadow-sm transition ${style.box} ${href ? "hover:ring-2 hover:ring-cyan-300" : ""}`}>
      <div className="flex items-start justify-between gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{label}</span>
        {href ? <span className="text-[10px] font-bold text-cyan-600">›</span> : null}
      </div>
      <div className={`mt-1 text-[19px] font-bold leading-tight tabular-nums ${style.value}`}>{value}</div>
      {hint ? <div className="mt-0.5 text-[10.5px] text-slate-500">{hint}</div> : null}
    </div>
  );
  if (href) {
    return (
      <Link href={href} className="block h-full">
        {inner}
      </Link>
    );
  }
  return inner;
}

/** Delta so kỳ trước / cùng kỳ — trả về chuỗi và màu. */
export function deltaText(deltaPercent: number | null, suffix = "so kỳ trước"): { text: string; tone: KpiTone } {
  if (deltaPercent === null) return { text: `Chưa có số ${suffix}`, tone: "neutral" };
  const arrow = deltaPercent >= 0 ? "▲" : "▼";
  return { text: `${arrow} ${Math.abs(deltaPercent).toFixed(1)}% ${suffix}`, tone: deltaPercent >= 0 ? "good" : "bad" };
}

export function ReportCard({
  title,
  hint,
  right,
  children,
  className = "",
}: {
  title: string;
  hint?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`erp-card overflow-hidden ${className}`}>
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-slate-200 bg-slate-50 px-3 py-2">
        <div>
          <h2 className="text-[13px] font-bold text-slate-900">{title}</h2>
          {hint ? <p className="erp-hint mt-0.5">{hint}</p> : null}
        </div>
        {right ? <div className="text-[11px] text-slate-500">{right}</div> : null}
      </div>
      <div className="p-3">{children}</div>
    </section>
  );
}

export const reportKpiGrid = "grid grid-cols-2 gap-2.5 md:grid-cols-3 xl:grid-cols-6";

type FieldKey = "range" | "fromto" | "dealer" | "sales" | "region" | "type" | "state" | "q";

export function ReportFilterBar({
  query,
  options,
  exportHref,
  fields = ["range", "fromto", "dealer", "sales", "region"],
  action,
}: {
  query: OrderListQuery;
  options: { dealers: FilterOption[]; customers: FilterOption[]; sales: FilterOption[]; regions: FilterOption[] };
  exportHref?: string;
  fields?: FieldKey[];
  action: string;
}) {
  const show = (key: FieldKey) => fields.includes(key);
  const inputClass = "erp-input h-9";
  const labelClass = "block whitespace-nowrap text-[10px] font-bold uppercase tracking-wide text-slate-500";

  return (
    <form method="GET" action={action} className="erp-card flex flex-nowrap items-end gap-2 px-3 py-2.5">
      <div className="erp-scrollbar flex min-w-0 flex-1 flex-nowrap items-end gap-2 overflow-x-auto pb-0.5">
        {show("range") ? (
          <div className="flex shrink-0 items-center gap-1">
            {ORDER_LIST_PRESETS.map((preset) => {
              const active = query.range === preset.value;
              return (
                <Link
                  key={preset.value}
                  href={`${action}${buildOrderListQueryString({ ...query, range: preset.value, from: "", to: "" })}`}
                  className={`inline-flex h-9 items-center whitespace-nowrap rounded-md border px-2.5 text-[11.5px] font-semibold transition ${
                    active ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  {preset.label}
                </Link>
              );
            })}
          </div>
        ) : null}

        {show("fromto") ? (
          <>
            <label className="shrink-0">
              <span className={labelClass}>Từ ngày</span>
              <input className={`${inputClass} mt-1`} style={{ width: 118 }} type="date" name="from" defaultValue={query.from ?? ""} />
            </label>
            <label className="shrink-0">
              <span className={labelClass}>Đến ngày</span>
              <input className={`${inputClass} mt-1`} style={{ width: 118 }} type="date" name="to" defaultValue={query.to ?? ""} />
            </label>
          </>
        ) : null}

        {show("q") ? (
          <label className="shrink-0">
            <span className={labelClass}>Tìm nhanh</span>
            <input className={`${inputClass} mt-1`} style={{ width: 170 }} type="search" name="q" defaultValue={query.q ?? ""} placeholder="Mã đơn, khách hàng, SĐT…" />
          </label>
        ) : null}

        {show("dealer") ? (
          <label className="shrink-0">
            <span className={labelClass}>Đại lý</span>
            <select className={`${inputClass} mt-1`} style={{ width: 165 }} name="dealer" defaultValue={query.dealer ?? ""}>
              <option value="">Tất cả đại lý</option>
              {options.dealers.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
        ) : null}

        {show("sales") ? (
          <label className="shrink-0">
            <span className={labelClass}>Nhân viên Sales</span>
            <select className={`${inputClass} mt-1`} style={{ width: 115 }} name="sales" defaultValue={query.sales ?? ""}>
              <option value="">Tất cả NVKD</option>
              {options.sales.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
        ) : null}

        {show("region") ? (
          <label className="shrink-0">
            <span className={labelClass}>Vùng miền</span>
            <select className={`${inputClass} mt-1`} style={{ width: 120 }} name="region" defaultValue={query.region ?? ""}>
              <option value="">Tất cả vùng</option>
              {options.regions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
        ) : null}

        {show("type") ? (
          <label className="shrink-0">
            <span className={labelClass}>Loại đơn</span>
            <select className={`${inputClass} mt-1`} style={{ width: 130 }} name="type" defaultValue={query.type ?? ""}>
              <option value="">Tất cả loại đơn</option>
              {ORDER_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
        ) : null}

        {show("state") ? (
          <label className="shrink-0">
            <span className={labelClass}>Trạng thái</span>
            <select className={`${inputClass} mt-1`} style={{ width: 130 }} name="state" defaultValue={query.state ?? ""}>
              {ORDER_LIST_STATE_FILTERS.map((option) => (
                <option key={option.value} value={option.value === "all" ? "" : option.value}>{option.label}</option>
              ))}
            </select>
          </label>
        ) : null}

      </div>
      <div className="flex shrink-0 items-center gap-2">
        <button type="submit" className="erp-button h-9 whitespace-nowrap px-3.5 text-[12px]">Lọc</button>
        <Link className="erp-button-secondary flex h-9 items-center whitespace-nowrap px-3.5 text-[12px]" href={action}>Xoá lọc</Link>
        {exportHref ? (
          <a
            className="inline-flex h-9 items-center whitespace-nowrap rounded-lg border border-emerald-700 bg-emerald-600 px-3.5 text-[12px] font-semibold text-white transition hover:bg-emerald-500"
            href={exportHref}
          >
            ⤓ Xuất Excel
          </a>
        ) : null}
      </div>
    </form>
  );
}

export function BarList({
  rows,
  unit = "đơn",
  formatValue = formatMoneyShort,
}: {
  rows: Array<{ key: string; label: string; value: number; orders: number; share: number; tone?: string }>;
  unit?: string;
  formatValue?: (value: unknown) => string;
}) {
  const max = Math.max(...rows.map((row) => row.value), 1);
  return (
    <div className="space-y-2">
      {rows.map((row) => (
        <div key={row.key}>
          <div className="flex items-baseline justify-between gap-2 text-[11.5px]">
            <span className="min-w-0 truncate font-semibold text-slate-700">{row.label}</span>
            <span className="shrink-0 tabular-nums text-slate-600">
              {formatNumber(row.orders)} {unit}
              <span className="ml-1 text-slate-400">·</span>
              <span className="ml-1 font-semibold text-slate-800">{formatValue(row.value)}</span>
            </span>
          </div>
          <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className={`h-full rounded-full ${toneClass(row.tone)}`}
              style={{ width: `${Math.max((row.value / max) * 100, row.orders ? 3 : 0)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function toneClass(tone?: string): string {
  if (tone === "bad") return "bg-red-500";
  if (tone === "warn") return "bg-amber-400";
  if (tone === "good") return "bg-emerald-500";
  return "bg-cyan-600";
}

export function MoneyCell({ value, bold = false }: { value: unknown; bold?: boolean }) {
  return <span className={`tabular-nums ${bold ? "font-bold text-slate-900" : "text-slate-700"}`}>{formatMoney(value)}</span>;
}
