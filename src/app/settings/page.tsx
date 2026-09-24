import { ErpShell } from "@/components/erp-shell";
import { SettingsWorkspace } from "@/components/settings/settings-workspace";
import { normalizeSettingsTab } from "@/components/settings/settings-tabs";

export const dynamic = "force-dynamic";

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const params = await searchParams;
  return (
    <ErpShell
      title="Cấu hình"
      subtitle="Khai báo dữ liệu nền (hàng hóa, thuộc tính) và quy tắc tính toán dùng chung cho mọi đơn hàng."
    >
      <SettingsWorkspace initialTab={normalizeSettingsTab(params?.tab)} />
    </ErpShell>
  );
}
