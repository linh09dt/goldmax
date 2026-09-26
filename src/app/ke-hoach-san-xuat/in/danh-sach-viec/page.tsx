import { notFound } from "next/navigation";
import { PrintActions } from "@/components/production/print-actions";
import { DailyWorkSheet } from "@/components/production/print-sheets";
import { todayInVietnam } from "@/lib/production/calendar";
import { loadPrintSets, loadPrintWorkCenters } from "@/lib/production/print";

export const dynamic = "force-dynamic";

/**
 * V137 — DANH SÁCH VIỆC THEO NGÀY, dán ở xưởng.
 *
 *   ?ngay=YYYY-MM-DD   → một trang cho mỗi tổ
 *   &to=<mã tổ>        → chỉ in tổ đó
 */
export default async function PrintDailyWorkPage({
  searchParams,
}: {
  searchParams: Promise<{ ngay?: string; to?: string }>;
}) {
  const params = await searchParams;
  const dayText = /^\d{4}-\d{2}-\d{2}$/.test(String(params.ngay ?? ""))
    ? String(params.ngay)
    : todayInVietnam().toISOString().slice(0, 10);
  const day = new Date(`${dayText}T00:00:00.000Z`);

  const [sets, teams] = await Promise.all([
    loadPrintSets({ day, workCenterCode: params.to || undefined, limit: 200 }),
    loadPrintWorkCenters(),
  ]);
  if (!sets.length) notFound();

  const teamList = teams.filter((center) => center.kind === "TO").filter((center) => (params.to ? center.code === params.to : true));

  const sheets = teamList
    .map((team) => {
      const rows = sets.flatMap((set) =>
        set.tasks
          .filter((task) => task.workCenterCode === team.code && task.stageKind !== "CHO")
          .map((task) => ({
            setId: set.id,
            setNo: set.setNo,
            orderCode: set.orderCode,
            customerName: set.customerName,
            model: set.model,
            paintColor: set.paintColor,
            stageName: task.stageName,
            scopeLabel: task.scopeLabel,
            qtyExpected: task.qtyExpected,
            dueDate: set.dueDate,
            taskId: task.id,
            workOrderCode: task.workOrderCode,
          })),
      );
      return { team, rows };
    })
    .filter((sheet) => sheet.rows.length > 0);

  if (!sheets.length) notFound();

  return (
    <div className="prod-print-root">
      <PrintActions backHref="/ke-hoach-san-xuat/in" />
      <p className="prod-print-legend mx-auto mb-2 max-w-[210mm] text-center">
        Danh sách việc theo ngày {dayText} · {sheets.length} tổ · {sheets.reduce((sum, sheet) => sum + sheet.rows.length, 0)} việc
      </p>
      {sheets.map((sheet) => (
        <DailyWorkSheet key={sheet.team.code} workCenterName={sheet.team.name} day={day} rows={sheet.rows} />
      ))}
    </div>
  );
}
