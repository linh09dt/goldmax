import Link from "next/link";

/**
 * V159b — PHÂN TRANG dùng chung cho các bảng danh sách (mặc định 10 dòng/trang).
 * Server component: tự dựng href từ `basePath` + tham số giữ nguyên (`params`) + số trang của bảng này.
 */
export function TablePager({
  page,
  pageCount,
  total,
  basePath,
  pageKey,
  params = {},
}: {
  page: number;
  pageCount: number;
  total: number;
  basePath: string;
  /** Tên tham số số trang của bảng này (vd `cho`, `sx`). */
  pageKey: string;
  /** Các tham số khác cần giữ (vd `{ thang: "2026-09", sx: "2" }`). */
  params?: Record<string, string>;
}) {
  if (total === 0) return null;
  const hrefFor = (target: number) => {
    const search = new URLSearchParams(params);
    if (target <= 1) search.delete(pageKey);
    else search.set(pageKey, String(target));
    const query = search.toString();
    return query ? `${basePath}?${query}` : basePath;
  };

  // Cửa sổ số trang quanh trang hiện tại.
  const windowStart = Math.max(1, Math.min(page - 2, pageCount - 4));
  const windowEnd = Math.min(pageCount, windowStart + 4);
  const pages: number[] = [];
  for (let index = windowStart; index <= windowEnd; index += 1) pages.push(index);

  const buttonClass = "inline-flex h-7 min-w-[26px] items-center justify-center rounded border px-2 text-[11.5px] font-semibold transition";
  const activeClass = "border-slate-900 bg-slate-900 text-white";
  const idleClass = "border-slate-300 bg-white text-slate-700 hover:bg-slate-100";
  const disabledClass = "border-slate-200 bg-slate-50 text-slate-300";

  const nav = (target: number, label: string, disabled: boolean) =>
    disabled ? (
      <span className={`${buttonClass} ${disabledClass}`}>{label}</span>
    ) : (
      <Link className={`${buttonClass} ${idleClass}`} href={hrefFor(target)}>
        {label}
      </Link>
    );

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="mr-1 text-[11px] text-slate-500">
        Trang {page}/{pageCount} · {total} dòng
      </span>
      {nav(1, "«", page <= 1)}
      {nav(page - 1, "‹", page <= 1)}
      {pages.map((target) => (
        <Link key={target} className={`${buttonClass} ${target === page ? activeClass : idleClass}`} href={hrefFor(target)}>
          {target}
        </Link>
      ))}
      {nav(page + 1, "›", page >= pageCount)}
      {nav(pageCount, "»", page >= pageCount)}
    </div>
  );
}
