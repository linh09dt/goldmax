import Link from "next/link";
import type { ProductionWarning } from "@/lib/production/scheduling";

/**
 * V136 — Dải cảnh báo của module Lên kế hoạch sản xuất.
 *
 * KH29: nhà máy chỉ cần 2 cảnh báo — QUÁ TẢI TỔ và BỘ SẮP CHẬM TIẾN ĐỘ.
 * J9: không cần chuông/thông báo/Zalo — báo đỏ trong màn là đủ.
 */

const KIND_LABELS: Record<ProductionWarning["kind"], string> = {
  QUA_TAI_TO: "Quá tải",
  QUA_TAI_CONG_DOAN: "Quá tải công đoạn",
  SAP_TRE: "Sắp trễ",
  CHUA_DU_THONG_TIN: "Thiếu thông tin",
  CHUA_CO_CHUONG_TRINH: "Chờ chương trình",
  MAY_DUNG: "Máy dừng",
};

export function ProductionWarnings({ warnings }: { warnings: ProductionWarning[] }) {
  if (!warnings.length) {
    return (
      <section className="rounded-xl border border-emerald-200 bg-emerald-50/60 px-3 py-2.5 text-[12.5px] text-emerald-800">
        Không có cảnh báo — không tổ nào quá tải và không có bộ nào có nguy cơ trễ.
      </section>
    );
  }

  const badCount = warnings.filter((warning) => warning.level === "bad").length;

  return (
    <section className="erp-card overflow-hidden">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-slate-200 bg-slate-50 px-3 py-2">
        <h2 className="text-[13px] font-semibold text-slate-900">Cảnh báo</h2>
        <span className="text-[11px] text-slate-500">
          <span className="font-semibold text-red-700">{badCount} nghiêm trọng</span> · {warnings.length} tổng cộng
        </span>
      </div>
      <ul className="divide-y divide-slate-100">
        {warnings.slice(0, 24).map((warning, index) => (
          <li key={`${warning.kind}-${index}`} className="flex flex-wrap items-start gap-2 px-3 py-2">
            <span
              className={`mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide ${
                warning.level === "bad" ? "bg-red-100 text-red-800" : "bg-amber-100 text-amber-900"
              }`}
            >
              {KIND_LABELS[warning.kind]}
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-[12.5px] font-medium text-slate-900">
                {warning.href ? (
                  <Link className="text-cyan-700 hover:underline" href={warning.href}>
                    {warning.title}
                  </Link>
                ) : (
                  warning.title
                )}
              </div>
              <div className="text-[11.5px] text-slate-500">{warning.detail}</div>
            </div>
          </li>
        ))}
        {warnings.length > 24 ? (
          <li className="px-3 py-2 text-[11.5px] text-slate-500">… còn {warnings.length - 24} cảnh báo khác</li>
        ) : null}
      </ul>
    </section>
  );
}
