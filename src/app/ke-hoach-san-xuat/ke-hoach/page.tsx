import Link from "next/link";
import { ErpShell } from "@/components/erp-shell";
import { ProductionPlanBoard, type PlanRow } from "@/components/production/production-plan-board";
import { MS_DAY, todayInVietnam } from "@/lib/production/calendar";
import { loadPlans, readProductionConfig } from "@/lib/production/service";

export const dynamic = "force-dynamic";

/**
 * V137 — Kế hoạch tuần + CHỐT kế hoạch.
 *
 * J3: kế hoạch tuần do kinh doanh + sản xuất thống nhất, giám đốc nhà máy chốt.
 * J1: lưu lại ai chốt / mở lại lúc nào.
 */
export default async function ProductionWeekPlanPage() {
  const [plans, config] = await Promise.all([loadPlans(), readProductionConfig()]);
  const today = todayInVietnam();

  // Mặc định: từ Thứ 2 của tuần này → Chủ nhật (khoảng ngày, không phải ngày làm việc).
  const weekday = (today.getUTCDay() + 6) % 7; // Thứ 2 = 0
  const monday = new Date(today.getTime() - weekday * MS_DAY);
  const sunday = new Date(monday.getTime() + 6 * MS_DAY);

  const rows: PlanRow[] = plans.map((plan) => ({
    id: plan.id,
    code: plan.code,
    fromDate: plan.fromDate.toISOString(),
    toDate: plan.toDate.toISOString(),
    status: plan.status,
    createdBy: plan.createdBy,
    approvedBy: plan.approvedBy,
    approvedAt: plan.approvedAt ? plan.approvedAt.toISOString() : null,
    note: plan.note,
    setCount: plan.setCount,
    canhTotal: plan.canhTotal,
    completed: plan.completed,
    inProgress: plan.inProgress,
    waiting: plan.waiting,
    cancelled: plan.cancelled,
    sets: plan.sets.map((set) => ({
      id: set.id,
      setNo: set.setNo,
      orderCode: set.orderCode,
      customerName: set.customerName,
      model: set.model,
      paintColor: set.paintColor,
      dueDate: set.dueDate ? set.dueDate.toISOString() : null,
      status: set.status,
      percentDone: set.percentDone,
      canh: set.canh,
      plannedStart: set.plannedStart ? set.plannedStart.toISOString() : null,
      plannedEnd: set.plannedEnd ? set.plannedEnd.toISOString() : null,
    })),
  }));

  return (
    <ErpShell
      title="Kế hoạch tuần & chốt kế hoạch"
      subtitle="Gom các bộ cửa đã xếp lịch theo tuần, trình giám đốc nhà máy chốt. Mọi thao tác đều được ghi lịch sử."
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Link className="erp-button-secondary" href="/ke-hoach-san-xuat">
            ← Bảng kế hoạch
          </Link>
          <Link className="erp-button-secondary" href="/ke-hoach-san-xuat/cau-hinh">
            Cấu hình sản xuất
          </Link>
        </div>
      }
    >
      <div className="space-y-3">
        <ProductionPlanBoard plans={rows} defaultFrom={monday.toISOString().slice(0, 10)} defaultTo={sunday.toISOString().slice(0, 10)} />

        <p className="erp-hint">
          Ngày làm việc đang cấu hình: {config.workingDays.join(", ")} (0 = Chủ nhật). Bộ cửa chỉ vào được kế hoạch sau khi đã có ngày kế hoạch —
          hãy bấm <strong>Xếp lịch tự động</strong> ở Bảng kế hoạch trước. Chốt kế hoạch <strong>không khoá</strong> việc cập nhật tiến độ, nhưng
          mọi thay đổi sau đó đều được ghi vào lịch sử (J1).
        </p>
      </div>
    </ErpShell>
  );
}
