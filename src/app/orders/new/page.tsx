import Link from "next/link";
import { ErpShell } from "@/components/erp-shell";
import { OrderForm } from "@/components/order-form";
import { createDefaultOrderForm } from "@/lib/order-form";

export default function NewOrderPage() {
  return (
    <ErpShell
      title="Tạo đơn hàng mẫu"
      actions={<Link className="erp-button-secondary" href="/orders">← Danh sách đơn hàng</Link>}
    >
      <OrderForm mode="create" initialData={createDefaultOrderForm()} />
    </ErpShell>
  );
}
