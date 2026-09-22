import Link from "next/link";
import { ErpShell } from "@/components/erp-shell";

export default function Home() {
  return (
    <ErpShell title="Tổng quan ERP sản xuất cửa">
      <section className="erp-card p-6">
        <h2 className="text-lg font-bold">Quản lý đơn hàng</h2>
        <div className="mt-5 flex flex-wrap gap-2">
          <Link className="erp-button" href="/orders/new">
            Tạo đơn hàng
          </Link>
          <Link className="erp-button-secondary" href="/orders">
            Danh sách đơn hàng
          </Link>
        </div>
      </section>
    </ErpShell>
  );
}
