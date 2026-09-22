import { ErpShell } from "@/components/erp-shell";
import { MasterOptions } from "@/components/master-options";

export const dynamic = "force-dynamic";

export default function MasterOptionsPage() {
  return (
    <ErpShell
      title="Danh mục cấu hình đơn hàng"
    >
      <MasterOptions />
    </ErpShell>
  );
}
