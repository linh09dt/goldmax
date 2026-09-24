import { ErpShell } from "@/components/erp-shell";
import { CustomerDirectory } from "@/components/customer-directory";

export const dynamic = "force-dynamic";

export default function CustomersPage() {
  return (
    <ErpShell
      title="Thông tin khách hàng"
      subtitle="Tự động tổng hợp từ các đơn hàng đã lưu: tên khách hàng, số điện thoại và địa chỉ nhận hàng."
    >
      <CustomerDirectory />
    </ErpShell>
  );
}
