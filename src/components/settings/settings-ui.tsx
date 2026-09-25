"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

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

/**
 * V95: ô chọn dùng trong bảng cấu hình, nhãn hiển thị ĐƯỢC XUỐNG DÒNG.
 * <select> gốc chỉ hiển thị 1 dòng nên khi cột hẹp bị cắt chữ ("Khuôn biệt thự…");
 * ở đây dựng bằng button + danh sách để bảng nằm gọn trong khung mà vẫn đủ chữ.
 */
export function WrapSelect({
  value,
  options,
  onChange,
  title,
  placeholder = "—",
  className = "",
}: {
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
  title?: string;
  placeholder?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  // Mở lên trên khi ô nằm gần đáy màn hình, tránh danh sách bị che.
  const [opensUp, setOpensUp] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const current = options.find((option) => option.value === value);

  function toggleOpen() {
    if (!open && boxRef.current && typeof window !== "undefined") {
      const rect = boxRef.current.getBoundingClientRect();
      setOpensUp(rect.bottom + 300 > window.innerHeight);
    }
    setOpen((isOpen) => !isOpen);
  }

  useEffect(() => {
    if (!open) return undefined;
    function onDocumentDown(event: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocumentDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onDocumentDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div className={`relative min-w-0 ${className}`} ref={boxRef}>
      <button
        type="button"
        className="flex w-full items-start gap-1 rounded-md border border-slate-300 bg-white px-1.5 py-1 text-left text-[11.5px] leading-4 text-slate-900 outline-none transition hover:border-slate-400 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100"
        title={title ?? current?.label}
        aria-expanded={open}
        onClick={toggleOpen}
      >
        <span className={`min-w-0 flex-1 whitespace-normal break-words ${current ? "" : "italic text-slate-400"}`}>{current?.label ?? placeholder}</span>
        <span aria-hidden className="mt-0.5 shrink-0 text-[9px] leading-none text-slate-500">{open ? "▲" : "▼"}</span>
      </button>
      {open ? (
        <div className={`absolute left-0 z-[80] max-h-64 w-max min-w-full max-w-[340px] overflow-auto rounded-md border border-slate-200 bg-white py-1 shadow-xl ${opensUp ? "bottom-full mb-1" : "top-full mt-1"}`}>
          {options.length === 0 ? <div className="px-2 py-1.5 text-[11.5px] italic text-slate-400">Không có lựa chọn</div> : null}
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              className={`block w-full whitespace-normal break-words px-2 py-1.5 text-left text-[11.5px] leading-4 hover:bg-cyan-50 ${option.value === value ? "bg-cyan-50 font-semibold text-cyan-800" : "text-slate-800"}`}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                onChange(option.value);
                setOpen(false);
              }}
            >
              {option.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
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
