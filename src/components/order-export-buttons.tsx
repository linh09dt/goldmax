"use client";

import { useState } from "react";

type Props = {
  orderId: number;
  compact?: boolean;
  excelLabel?: string;
  pdfLabel?: string;
  classNameExcel?: string;
  classNamePdf?: string;
};

type ExportType = "excel" | "pdf" | "excelV2" | "pdfV2" | null;

export function OrderExportButtons({
  orderId,
  compact = false,
  excelLabel = "Xuất Excel",
  pdfLabel = "PDF",
  classNameExcel,
  classNamePdf,
}: Props) {
  const [exportType, setExportType] = useState<ExportType>(null);
  const [note, setNote] = useState("");

  const defaultButton = compact
    ? "inline-flex h-8 items-center justify-center rounded-md px-3 text-[11px] font-semibold text-white shadow-sm transition"
    : "erp-button-secondary";

  const excelClass = classNameExcel || (compact
    ? `${defaultButton} border border-emerald-700 bg-emerald-600 hover:bg-emerald-500`
    : defaultButton);
  const pdfClass = classNamePdf || (compact
    ? `${defaultButton} border border-slate-700 bg-slate-700 hover:bg-slate-600`
    : defaultButton);
  const excelV2Class = compact
    ? `${defaultButton} border border-blue-800 bg-blue-700 hover:bg-blue-600`
    : "inline-flex h-10 items-center justify-center rounded-lg border border-blue-800 bg-blue-700 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-600";
  const pdfV2Class = compact
    ? `${defaultButton} border border-amber-700 bg-amber-600 hover:bg-amber-500`
    : "inline-flex h-10 items-center justify-center rounded-lg border border-amber-700 bg-amber-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-amber-500";

  function openDialog(type: Exclude<ExportType, null>) {
    setNote("");
    setExportType(type);
  }

  function closeDialog() {
    setExportType(null);
    setNote("");
  }

  function confirmExport() {
    if (!exportType) return;
    const trimmed = note.trim();
    const query = trimmed ? `?note=${encodeURIComponent(trimmed)}` : "";

    if (exportType === "excel") {
      window.location.href = `/api/orders/${orderId}/export${query}`;
    } else if (exportType === "pdf") {
      const separator = query ? "&" : "?";
      window.open(`/orders/${orderId}/print${query}${separator}auto=1`, "_blank", "noopener,noreferrer");
    } else if (exportType === "excelV2") {
      window.location.href = `/api/orders/${orderId}/export-v2${query}`;
    } else {
      const separator = query ? "&" : "?";
      window.location.href = `/api/order_pdf_v2?orderId=${orderId}${query ? `${separator}${query.slice(1)}` : ""}`;
    }
    closeDialog();
  }

  const actionLabel = exportType === "excel" ? "Xuất Excel"
    : exportType === "pdf" ? "Xuất PDF"
      : exportType === "excelV2" ? "Xuất Excel V2"
        : "Xuất PDF V2";

  return (
    <>
      <button type="button" className={excelClass} onClick={() => openDialog("excel")}>{excelLabel}</button>
      <button type="button" className={pdfClass} onClick={() => openDialog("pdf")}>{pdfLabel}</button>
      <button type="button" className={excelV2Class} onClick={() => openDialog("excelV2")}>Excel V2</button>
      <button type="button" className={pdfV2Class} onClick={() => openDialog("pdfV2")}>PDF V2</button>

      {exportType ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/45 p-4" onMouseDown={closeDialog}>
          <div className="w-full max-w-xl rounded-xl border border-slate-200 bg-white p-5 shadow-2xl" onMouseDown={(event) => event.stopPropagation()}>
            <div className="mb-3 text-base font-bold text-slate-900">Chú thích khi xuất</div>
            <textarea
              className="min-h-28 w-full resize-y rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Nhập chú thích cần in trên đơn hàng..."
              autoFocus
            />
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" className="erp-button-secondary" onClick={closeDialog}>Hủy</button>
              <button type="button" className="erp-button" onClick={confirmExport}>{actionLabel}</button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
