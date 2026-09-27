import Link from "next/link";
import { ErpShell } from "@/components/erp-shell";
import { PlanAutoRefresh } from "@/components/production/plan-auto-refresh";
import { StagePlanBoard } from "@/components/production/stage-plan-board";
import { dateKeyUtc, todayInVietnam } from "@/lib/production/calendar";

export const dynamic = "force-dynamic";

/**
 * V148 · đổi tên V157 — **XẾP LỊCH TOÀN XƯỞNG**.
 *
 * Một lượt bấm là máy xếp ngày kế hoạch cho MỌI công đoạn của cả dây chuyền
 * (Thiết kế → … → Kho) theo NĂNG LỰC công đoạn/tổ. Lead time chỉ để hiện cột
 * "Mốc (target)" và biết đơn có kịp hay không.
 *
 * ⚠ Đây là màn TỔNG THỂ (một lượt, không sửa tay). Màn chi tiết từng công đoạn
 * (hàng đợi, xác nhận từng ngày, thêm/bớt) là **"Xếp việc theo công đoạn"**.
 */
export default async function StagePlanPage() {
  const today = dateKeyUtc(todayInVietnam());

  return (
    <ErpShell
      title="Xếp lịch toàn xưởng"
      subtitle="Một lượt cho CẢ DÂY CHUYỀN: máy xếp ngày kế hoạch cho mọi công đoạn theo NĂNG LỰC công đoạn/tổ. Lead time chỉ để đối chiếu mốc và biết có kịp hay không."
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Link className="erp-button-secondary" href="/ke-hoach-san-xuat/xep-viec-theo-cong-doan">
            Xếp việc theo công đoạn (từng công đoạn)
          </Link>
          <Link className="erp-button-secondary" href="/ke-hoach-san-xuat">
            Bảng kế hoạch sản xuất
          </Link>
          <Link className="erp-button-secondary" href="/reports/production">
            Báo cáo sản xuất
          </Link>
        </div>
      }
    >
      <PlanAutoRefresh />
      <StagePlanBoard today={today} />
    </ErpShell>
  );
}
