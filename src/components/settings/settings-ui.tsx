"use client";

import type { ReactNode } from "react";

/**
 * V76: các khối giao diện dùng chung cho tab CẤU HÌNH.
 * Mục tiêu: font chữ, khoảng cách, tiêu đề và bảng dữ liệu đồng nhất theo chuẩn ERP.
 */

export function SettingsSectionHeader({
  code,
  title,
  description,
  actions,
}: {
  code?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 pb-3">
      <div className="flex min-w-0 items-start gap-3">
        {code ? (
          <span className="mt-0.5 inline-flex h-7 min-w-9 items-center justify-center rounded-md bg-slate-900 px-2 text-[11px] font-bold tracking-wide text-cyan-300">
            {code}
          </span>
        ) : null}
        <div className="min-w-0">
          <h2 className="erp-section-title">{title}</h2>
          {description ? <p className="erp-hint mt-0.5 max-w-4xl">{description}</p> : null}
        </div>
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function SettingsCard({
  title,
  description,
  actions,
  children,
  bodyClassName = "p-3.5",
  className = "",
}: {
  title?: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  bodyClassName?: string;
  className?: string;
}) {
  return (
    <section className={`erp-card ${className}`}>
      {title ? (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 px-3.5 py-2">
          <div className="min-w-0">
            <h3 className="erp-subsection-title">{title}</h3>
            {description ? <p className="erp-hint mt-0.5">{description}</p> : null}
          </div>
          {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
        </div>
      ) : null}
      <div className={bodyClassName}>{children}</div>
    </section>
  );
}

export function SettingsNote({
  tone = "info",
  title,
  children,
}: {
  tone?: "info" | "success" | "warning" | "danger";
  title?: string;
  children: ReactNode;
}) {
  const toneClass = {
    info: "border-cyan-200 bg-cyan-50 text-slate-700",
    success: "border-emerald-200 bg-emerald-50 text-emerald-800",
    warning: "border-amber-200 bg-amber-50 text-amber-900",
    danger: "border-red-200 bg-red-50 text-red-800",
  }[tone];

  return (
    <div className={`rounded-lg border px-3.5 py-2.5 text-[12.5px] leading-6 ${toneClass}`}>
      {title ? <div className="font-semibold">{title}</div> : null}
      {children}
    </div>
  );
}

export function SettingsStat({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-0.5 text-[15px] font-semibold tabular-nums text-slate-900">{value}</div>
      {hint ? <div className="mt-0.5 text-[11px] text-slate-500">{hint}</div> : null}
    </div>
  );
}

export function SettingsFieldLabel({ children }: { children: ReactNode }) {
  return <span className="erp-field-label">{children}</span>;
}

export function SettingsBadge({
  children,
  tone = "slate",
}: {
  children: ReactNode;
  tone?: "slate" | "cyan" | "emerald" | "amber" | "red";
}) {
  const toneClass = {
    slate: "bg-slate-200 text-slate-700",
    cyan: "bg-cyan-100 text-cyan-800",
    emerald: "bg-emerald-100 text-emerald-800",
    amber: "bg-amber-100 text-amber-800",
    red: "bg-red-100 text-red-700",
  }[tone];
  return <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${toneClass}`}>{children}</span>;
}

/** Bảng dữ liệu chuẩn: cuộn ngang trong khung, header đậm, số căn phải. */
/**
 * Bảng dữ liệu chuẩn cho tab CẤU HÌNH — chế độ **full view** từ V85:
 * `table-layout: fixed` + `width: 100%` nên toàn bộ cột luôn nằm trong bề rộng khung,
 * không cần kéo ngang. Bề rộng cột khai báo bằng % ở hàng `<th>` đầu tiên (tổng 100%).
 * Giữ `overflow-x-auto` làm lưới an toàn nhưng bình thường sẽ không có gì để cuộn.
 */
export function SettingsTable({ children, className = "" }: { children: ReactNode; className?: string }) {
  // V94: cho phép khai báo bề rộng tối thiểu cho từng bảng (bảng nhiều cột cần cuộn ngang
  // để hiển thị đủ chữ, thay vì bóp cột lại và cắt chữ).
  return (
    <div className="erp-scrollbar overflow-x-auto">
      <table className={`erp-table erp-table-full ${className}`}>{children}</table>
    </div>
  );
}
