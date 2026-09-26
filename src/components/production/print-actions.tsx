"use client";

/** V137 — Nút In / Lưu PDF cho các mẫu in phiếu lệnh sản xuất. */
export function PrintActions({ backHref }: { backHref?: string }) {
  return (
    <div className="prod-print-toolbar">
      <button className="erp-button" type="button" onClick={() => window.print()}>
        In / Lưu PDF
      </button>
      {backHref ? (
        <a className="erp-button-secondary" href={backHref}>
          ← Quay lại
        </a>
      ) : null}
      <button className="erp-button-secondary" type="button" onClick={() => window.close()}>
        Đóng
      </button>
    </div>
  );
}
