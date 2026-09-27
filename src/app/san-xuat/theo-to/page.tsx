import Link from "next/link";
import { ErpShell } from "@/components/erp-shell";
import { TeamReportBoard } from "@/components/production/team-report-board";
import { dateKeyUtc, todayInVietnam } from "@/lib/production/calendar";
import { loadTeamReport } from "@/lib/production/service";

export const dynamic = "force-dynamic";

/**
 * V156 — BÁO CÁO SẢN XUẤT THEO TỔ (màn hình xưởng).
 *
 * Mỗi TỔ một màn; trong tổ chia theo CÔNG ĐOẠN. Dòng chỉ có STT · Khách hàng · Lô · Bộ số ·
 * SL kế hoạch + 4 nút 1-chạm: Bắt đầu · Hoàn thành · Lỗi · Tạm dừng. Màu cả dòng để nhìn là biết.
 * Đầu mỗi công đoạn hiện THỰC TẾ / KẾ HOẠCH và CẢNH BÁO nếu không kịp kế hoạch trong ngày.
 */
export default async function TeamReportPage({
  searchParams,
}: {
  searchParams: Promise<{ team?: string; day?: string }>;
}) {
  const params = await searchParams;
  const today = dateKeyUtc(todayInVietnam());
  const report = await loadTeamReport({ teamCode: params.team ?? null, day: params.day ?? null });

  return (
    <ErpShell
      title="Báo cáo sản xuất theo tổ"
      subtitle="Màn hình xưởng: chọn tổ → công đoạn → bấm 1 chạm để Bắt đầu / Hoàn thành / Lỗi / Tạm dừng. Tự cập nhật, không cần F5."
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Link className="erp-button-secondary" href="/ke-hoach-san-xuat/dieu-do">
            Điều độ công đoạn
          </Link>
          <Link className="erp-button-secondary" href="/reports/production">
            Báo cáo tổng hợp
          </Link>
        </div>
      }
    >
      <TeamReportBoard initial={report} today={today} />
    </ErpShell>
  );
}
