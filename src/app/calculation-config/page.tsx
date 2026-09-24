import { ErpShell } from "@/components/erp-shell";
import { CalculationConfigEditor } from "@/components/calculation-config";

export const dynamic = "force-dynamic";

export default function CalculationConfigPage() {
  return (
    <ErpShell title="Cấu hình tính toán đơn hàng">
      <CalculationConfigEditor />
    </ErpShell>
  );
}
