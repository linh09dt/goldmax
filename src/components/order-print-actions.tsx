"use client";

import { useEffect } from "react";

export function OrderPrintActions({ autoPrint = false }: { autoPrint?: boolean }) {
  useEffect(() => {
    if (!autoPrint) return;
    const timer = window.setTimeout(() => window.print(), 450);
    return () => window.clearTimeout(timer);
  }, [autoPrint]);

  return (
    <div className="order-print-toolbar print:hidden">
      <button type="button" onClick={() => window.print()}>In / Lưu PDF</button>
      <button type="button" className="secondary" onClick={() => window.close()}>Đóng</button>
    </div>
  );
}
