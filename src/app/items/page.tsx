import { ErpShell } from "@/components/erp-shell";
import { ItemMaster } from "@/components/item-master";

export const dynamic = "force-dynamic";

export default function ItemsPage() {
  return (
    <ErpShell
      title="Danh mục hàng hóa"
    >
      <ItemMaster />
    </ErpShell>
  );
}
