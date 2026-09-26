import Link from "next/link";
import { ErpShell } from "@/components/erp-shell";
import { ProductionConfigScreen } from "@/components/production/production-config";
import { prisma } from "@/lib/prisma";
import { loadReasons, loadStages, loadWorkCenters, readProductionConfig } from "@/lib/production/service";

export const dynamic = "force-dynamic";

/**
 * V136 — Cấu hình sản xuất: tổ & năng lực, công đoạn, lý do, chương trình máy cắt, ngày nghỉ,
 * và các con số điều khiển thuật toán xếp lịch.
 */
export default async function ProductionConfigPage() {
  const [config, workCenters, stages, reasons, programs, holidays] = await Promise.all([
    readProductionConfig(),
    loadWorkCenters(),
    loadStages(),
    loadReasons(),
    prisma.productionProgram.findMany({ orderBy: [{ model: "asc" }, { version: "desc" }] }),
    prisma.productionCalendar.findMany({ orderBy: { date: "asc" } }),
  ]);

  return (
    <ErpShell
      title="Cấu hình sản xuất"
      subtitle="Danh mục công đoạn và năng lực tổ nằm ở đây — sửa được, không hard-code trong code."
      actions={
        <Link className="erp-button-secondary" href="/ke-hoach-san-xuat">
          ← Bảng kế hoạch
        </Link>
      }
    >
      <ProductionConfigScreen
        config={config}
        workCenters={workCenters.map((row) => ({
          id: row.id,
          code: row.code,
          name: row.name,
          kind: row.kind,
          peopleCount: row.peopleCount,
          shiftsPerDay: row.shiftsPerDay,
          hoursPerShift: row.hoursPerShift,
          capacityPerDay: row.capacityPerDay,
          capacityUnit: row.capacityUnit,
          active: row.active,
          sortOrder: row.sortOrder,
          note: row.note,
        }))}
        stages={stages.map((row) => ({
          id: row.id,
          code: row.code,
          name: row.name,
          kind: row.kind,
          scopeMode: row.scopeMode,
          scopeParts: row.scopeParts,
          workCenterCode: row.workCenterCode,
          seq: row.seq,
          leadTimeDays: row.leadTimeDays,
          setupMinutes: row.setupMinutes,
          capacityPerDay: row.capacityPerDay,
          batchKey: row.batchKey,
          batchMinQty: row.batchMinQty,
          changeoverMaxPerDay: row.changeoverMaxPerDay,
          isQcPoint: row.isQcPoint,
          reworkToStage: row.reworkToStage,
          skipCondition: row.skipCondition,
          requiresStage: row.requiresStage,
          active: row.active,
          note: row.note,
        }))}
        reasons={reasons.map((row) => ({ id: row.id, code: row.code, name: row.name, group: row.group, sortOrder: row.sortOrder, active: row.active }))}
        programs={programs.map((row) => ({
          id: row.id,
          model: row.model,
          fileName: row.fileName,
          version: row.version,
          machine: row.machine,
          madeBy: row.madeBy,
          durationMinutes: row.durationMinutes,
          reusable: row.reusable,
          note: row.note,
        }))}
        holidays={holidays.map((row) => ({
          id: row.id,
          date: row.date.toISOString().slice(0, 10),
          isWorkingDay: row.isWorkingDay,
          note: row.note,
        }))}
      />
    </ErpShell>
  );
}
