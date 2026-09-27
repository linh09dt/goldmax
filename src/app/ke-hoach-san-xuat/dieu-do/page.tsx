import Link from "next/link";
import { ErpShell } from "@/components/erp-shell";
import { PlanAutoRefresh } from "@/components/production/plan-auto-refresh";
import { StageBoard } from "@/components/production/stage-board";
import { dateKeyUtc, todayInVietnam } from "@/lib/production/calendar";
import { loadActiveStages } from "@/lib/production/service";

export const dynamic = "force-dynamic";

/**
 * V152 — ĐIỀU ĐỘ THỦ CÔNG THEO CÔNG ĐOẠN.
 *
 * Danh sách đợi của từng công đoạn (chỉ hiện bộ đã đủ điều kiện) + kế hoạch từng ngày,
 * thêm/bớt bộ bằng tay. Thêm/bớt ở một công đoạn ⇒ xoá mọi công đoạn phía sau của bộ đó.
 * Toàn bộ màn tự cập nhật khi dữ liệu đổi — không cần F5.
 */
export default async function StageDispatchPage() {
  const stages = await loadActiveStages();

  return (
    <ErpShell
      title="Điều độ theo công đoạn"
      subtitle="Danh sách đợi của từng công đoạn + xếp tay vào từng ngày. Thêm/bớt ở một công đoạn sẽ xoá kế hoạch của mọi công đoạn phía sau."
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Link className="erp-button-secondary" href="/ke-hoach-san-xuat/ke-hoach-cong-doan">
            Kế hoạch theo công đoạn (tự động)
          </Link>
          <Link className="erp-button-secondary" href="/ke-hoach-san-xuat">
            Bảng kế hoạch sản xuất
          </Link>
        </div>
      }
    >
      <PlanAutoRefresh />
      <StageBoard
        stages={stages.map((stage) => ({ code: stage.code, name: stage.name, seq: stage.seq }))}
        today={dateKeyUtc(todayInVietnam())}
      />
    </ErpShell>
  );
}
