"use client";

import { useEffect } from "react";

export function OrderPrintActions({ autoPrint = false }: { autoPrint?: boolean }) {
  const printWhenImagesReady = async () => {
    const images = Array.from(document.querySelectorAll<HTMLImageElement>(".order-print-sheet img"));
    await Promise.all(images.map((img) => {
      if (img.complete) return Promise.resolve();
      return new Promise<void>((resolve) => {
        let settled = false;
        const done = () => {
          if (settled) return;
          settled = true;
          resolve();
        };
        img.addEventListener("load", done, { once: true });
        img.addEventListener("error", done, { once: true });
        window.setTimeout(done, 2500);
      });
    }));
    window.setTimeout(() => window.print(), 100);
  };

  useEffect(() => {
    if (!autoPrint) return;
    void printWhenImagesReady();
    // Chỉ tự in khi trang được mở với auto=1.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoPrint]);

  return (
    <div className="order-print-toolbar print:hidden">
      <button type="button" onClick={() => void printWhenImagesReady()}>In / Lưu PDF</button>
      <button type="button" className="secondary" onClick={() => window.close()}>Đóng</button>
    </div>
  );
}
