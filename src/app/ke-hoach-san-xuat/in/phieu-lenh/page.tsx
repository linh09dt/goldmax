import { notFound } from "next/navigation";
import { PrintActions } from "@/components/production/print-actions";
import { ProductionOrderSheet } from "@/components/production/print-sheets";
import { todayInVietnam } from "@/lib/production/calendar";
import { loadPrintSets, loadPrintWorkCenters } from "@/lib/production/print";

export const dynamic = "force-dynamic";

/**
 * V137 — In PHIẾU LỆNH SẢN XUẤT (A4 dọc).
 *
 *   ?bo=<id>            → phiếu cho MỘT bộ cửa (đủ 24 công đoạn)
 *   ?ngay=YYYY-MM-DD    → phiếu cho mọi bộ có việc trong ngày
 *   &to=<mã tổ>         → chỉ công đoạn của tổ đó
 */
export default async function PrintProductionOrderPage({
  searchParams,
}: {
  searchParams: Promise<{ bo?: string; ngay?: string; to?: string }>;
}) {
  const params = await searchParams;
  const setId = Number(params.bo);
  const teams = await loadPrintWorkCenters();
  const team = params.to ? teams.find((center) => center.code === params.to) : undefined;

  let sets;
  let title: string;

  if (Number.isInteger(setId) && setId > 0) {
    sets = await loadPrintSets({ setId });
    title = "Phiếu lệnh sản xuất — một bộ cửa";
  } else {
    const dayText = /^\d{4}-\d{2}-\d{2}$/.test(String(params.ngay ?? ""))
      ? String(params.ngay)
      : todayInVietnam().toISOString().slice(0, 10);
    const day = new Date(`${dayText}T00:00:00.000Z`);
    sets = await loadPrintSets({
      day,
      workCenterCode: team?.code,
      onlyTasksOfWorkCenter: Boolean(team),
      limit: 80,
    });
    title = `Phiếu lệnh sản xuất — ngày ${dayText}${team ? ` · ${team.name}` : ""}`;
  }

  if (!sets.length) notFound();

  return (
    <div className="prod-print-root">
      <PrintActions backHref="/ke-hoach-san-xuat/in" />
      <p className="prod-print-legend mx-auto mb-2 max-w-[210mm] text-center">{title} · {sets.length} phiếu</p>
      {sets.map((set) => (
        <ProductionOrderSheet key={set.id} set={set} teamLabel={team?.name ?? null} />
      ))}
    </div>
  );
}
