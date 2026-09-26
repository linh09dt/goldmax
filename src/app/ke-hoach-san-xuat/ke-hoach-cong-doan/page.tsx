import Link from "next/link";
import { ErpShell } from "@/components/erp-shell";
import { StagePlanBoard } from "@/components/production/stage-plan-board";
import { dateKeyUtc, todayInVietnam } from "@/lib/production/calendar";

export const dynamic = "force-dynamic";

/**
 * V148 — KẾ HOẠCH CHO TỪNG CÔNG ĐOẠN.
 *
 * Khác màn "Kế hoạch sản xuất" (theo dõi tiến độ) và khác mốc target V144:
 * màn này XẾP NGÀY KẾ HOẠCH cho từng công đoạn theo NĂNG LỰC của công đoạn/tổ.
 * Lead time chỉ dùng để hiện cột "Mốc (target)" và biết đơn có kịp hay không.
 */
export default async function StagePlanPage() {
  const today = dateKeyUtc(todayInVietnam());

  return (
    <ErpShell
      title="Kế hoạch theo công đoạn"
      subtitle="Xếp ngày kế hoạch cho từng công đoạn theo NĂNG LỰC công đoạn/tổ — lead time chỉ để đối chiếu mốc và biết có kịp hay không."
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Link className="erp-button-secondary" href="/ke-hoach-san-xuat">
            Bảng kế hoạch sản xuất
          </Link>
          <Link className="erp-button-secondary" href="/reports/production">
            Báo cáo sản xuất
          </Link>
        </div>
      }
    >
      <StagePlanBoard today={today} />
    </ErpShell>
  );
}
