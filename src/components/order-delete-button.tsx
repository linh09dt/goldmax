"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Props = {
  orderId: number;
  orderCode: string;
  redirectAfterDelete?: boolean;
  compact?: boolean;
};

export function OrderDeleteButton({ orderId, orderCode, redirectAfterDelete = false, compact = false }: Props) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);

  async function removeOrder() {
    const confirmed = window.confirm(
      `Xóa đơn hàng ${orderCode}?\n\n` +
        "Toàn bộ bộ cửa, dòng chi tiết, yêu cầu xác nhận và lịch sử tính cước của đơn sẽ bị xóa. " +
        "Lịch sử import file được giữ lại để truy vết.\n\nHành động này không thể hoàn tác.",
    );
    if (!confirmed) return;

    setDeleting(true);
    try {
      const response = await fetch(`/api/orders/${orderId}`, { method: "DELETE" });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.ok) {
        window.alert(result.error || "Không thể xóa đơn hàng.");
        return;
      }

      if (redirectAfterDelete) {
        router.push("/orders");
      }
      router.refresh();
    } catch (error) {
      console.error("Delete order failed:", error);
      window.alert("Không thể kết nối máy chủ để xóa đơn hàng.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <button
      type="button"
      onClick={removeOrder}
      disabled={deleting}
      className={
        compact
          ? "erp-action-danger disabled:cursor-not-allowed disabled:opacity-50"
          : "rounded-lg border border-red-300 bg-red-50 px-3.5 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
      }
    >
      {deleting ? "Đang xóa..." : "Xóa đơn"}
    </button>
  );
}
