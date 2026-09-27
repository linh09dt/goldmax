import Link from "next/link";
import { ErpShell } from "@/components/erp-shell";
import { PlanAutoRefresh } from "@/components/production/plan-auto-refresh";
import { StageBoard } from "@/components/production/stage-board";
import { dateKeyUtc, todayInVietnam } from "@/lib/production/calendar";
import { loadActiveStages } from "@/lib/production/service";

export const dynamic = "force-dynamic";

/**
 * V152 · đổi tên V157 — **XẾP VIỆC THEO CÔNG ĐOẠN** (điều độ từng công đoạn).
 *
 * Mỗi lần làm MỘT công đoạn: hàng đợi đã sắp theo tiêu chí ưu tiên → máy đề xuất ngày
 * (gom nhóm + năng lực) → XÁC NHẬN → rồi thêm/bớt thủ công. Thêm/bớt ở một công đoạn ⇒
 * xoá mọi công đoạn phía sau của bộ đó. Màn tự cập nhật, không cần F5.
 *
 * ⚠ Đây là màn CHI TIẾT TỪNG CÔNG ĐOẠN. Màn xếp một lượt cho cả dây chuyền là
 * **"Xếp lịch toàn xưởng"**.
 */
export default async function StageDispatchPage() {
  const stages = await loadActiveStages();

  return (
    <ErpShell
      title="Xếp việc theo công đoạn"
      subtitle="Chọn MỘT công đoạn: hàng đợi đã sắp theo tiêu chí ưu tiên → máy đề xuất ngày → bạn xác nhận → thêm/bớt thủ công. Thêm/bớt ở một công đoạn sẽ xoá kế hoạch của mọi công đoạn phía sau."
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Link className="erp-button-secondary" href="/ke-hoach-san-xuat/xep-lich-toan-xuong">
            Xếp lịch toàn xưởng (cả dây chuyền)
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
