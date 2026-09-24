"use client";

import { useState } from "react";

export function OrderPdfPreviewButton({ orderId }: { orderId: number }) {
  const [loading, setLoading] = useState(false);

  async function download(url: string) {
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) {
      const body = await response.text().catch(() => "");
      let message = body.slice(0, 500) || `HTTP ${response.status}`;
      try {
        const parsed = JSON.parse(body) as { error?: string };
        message = parsed.error || message;
      } catch {
        // giữ message dạng text
      }
      throw new Error(message);
    }

    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    const disposition = response.headers.get("content-disposition") || "";
    const match = disposition.match(/filename="?([^";]+)"?/i);
    const filename = match?.[1] || `Bao-gia-Mau-moi-${orderId}.pdf`;
    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 30_000);
  }

  async function handleClick() {
    if (loading) return;
    setLoading(true);
    try {
      await download(`/api/order_pdf_preview?orderId=${orderId}`);
    } catch (firstError) {
      // Chỉ là fallback an toàn cho giai đoạn test: nếu ảnh remote làm endpoint lỗi,
      // vẫn cho người dùng xem layout PDF mới không ảnh.
      try {
        await download(`/api/order_pdf_preview?orderId=${orderId}&noImages=1`);
        window.alert("PDF mẫu mới đã xuất ở chế độ không ảnh vì tải ảnh gặp lỗi. Hãy thử lại để test bản đầy đủ.");
      } catch (safeError) {
        const message = safeError instanceof Error
          ? safeError.message
          : firstError instanceof Error
            ? firstError.message
            : "Không thể xuất PDF mẫu mới.";
        window.alert(message);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      className="inline-flex h-10 items-center justify-center rounded-lg border border-violet-700 bg-violet-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-60"
      title="PDF mẫu mới để test, không thay thế PDF hiện tại"
    >
      {loading ? "Đang tạo PDF mẫu..." : "PDF Mẫu Mới"}
    </button>
  );
}
