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

// V41.31: vẫn ẩn Excel/PDF cũ; hiện lại Excel V2 với nhãn người dùng "Xuất Excel".
const SHOW_LEGACY_EXPORT_BUTTONS = false;

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
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState("");

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
    setExportError("");
    setExportType(type);
  }

  function closeDialog() {
    if (isExporting) return;
    setExportType(null);
    setNote("");
    setExportError("");
  }

  async function downloadPdfV2(url: string) {
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) {
      const body = await response.text().catch(() => "");
      const contentType = response.headers.get("content-type") || "";
      const looksLikeHtml = contentType.includes("text/html") || /^\s*<!doctype html/i.test(body) || /^\s*<html/i.test(body);
      if (looksLikeHtml) {
        throw new Error(`Vercel trả HTTP ${response.status} khi tạo PDF V2. Không hiển thị HTML lỗi thô.`);
      }
      let apiError = "";
      try {
        const parsed = JSON.parse(body) as { error?: string };
        apiError = parsed.error || "";
      } catch {
        // Không phải JSON: chỉ giữ tối đa một đoạn ngắn, tránh đổ cả trang HTML vào UI.
      }
      throw new Error(apiError || body.slice(0, 600) || `HTTP ${response.status}`);
    }
    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    const disposition = response.headers.get("content-disposition") || "";
    const match = disposition.match(/filename="?([^";]+)"?/i);
    const filename = match?.[1] || `Thong-tin-don-hang-V2-${orderId}.pdf`;
    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 30_000);
  }

  async function confirmExport() {
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
      const notePart = trimmed ? `&note=${encodeURIComponent(trimmed)}` : "";
      setIsExporting(true);
      setExportError("");
      try {
        await downloadPdfV2(`/api/order_pdf_v2?orderId=${orderId}${notePart}`);
        setExportType(null);
        setNote("");
      } catch {
        // Chế độ an toàn chỉ chạy khi PDF đầy đủ thất bại. Mục tiêu là tránh
        // người dùng bị kẹt ở trang 500; cột Hình ảnh SP vẫn còn nhưng ảnh để trống.
        try {
          await downloadPdfV2(`/api/order_pdf_v2?orderId=${orderId}&noImages=1${notePart}`);
          setExportError("PDF đã xuất ở chế độ an toàn vì ảnh sản phẩm tải quá chậm. Vui lòng thử lại để lấy bản có ảnh.");
          window.alert("Xuất PDF đầy đủ gặp lỗi trên server. Hệ thống đã tự xuất bản an toàn không nhúng ảnh sản phẩm.");
          setExportType(null);
          setNote("");
        } catch (safeError) {
          const message = safeError instanceof Error ? safeError.message : String(safeError);
          setExportError(`Không thể xuất PDF: ${message}`);
        }
      } finally {
        setIsExporting(false);
      }
      return;
    }
    setExportType(null);
    setNote("");
    setExportError("");
  }

  const actionLabel = exportType === "excel" ? "Xuất Excel"
    : exportType === "pdf" ? "Xuất PDF"
      : exportType === "excelV2" ? "Xuất Excel"
        : "Xuất PDF";

  return (
    <>
      {SHOW_LEGACY_EXPORT_BUTTONS ? (
        <>
          <button type="button" className={excelClass} onClick={() => openDialog("excel")}>{excelLabel}</button>
          <button type="button" className={pdfClass} onClick={() => openDialog("pdf")}>{pdfLabel}</button>
        </>
      ) : null}
      <button type="button" className={excelV2Class} onClick={() => openDialog("excelV2")}>Xuất Excel</button>
      <button type="button" className={pdfV2Class} onClick={() => openDialog("pdfV2")}>Xuất PDF</button>

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
            {exportError ? <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{exportError}</div> : null}
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" className="erp-button-secondary" onClick={closeDialog} disabled={isExporting}>Hủy</button>
              <button type="button" className="erp-button" onClick={confirmExport} disabled={isExporting}>{isExporting ? "Đang xuất..." : actionLabel}</button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
