import Link from "next/link";
import { ErpShell } from "@/components/erp-shell";
import { ReportCard } from "@/components/reports/report-ui";
import { formatDate } from "@/components/order-list/format";
import { todayInVietnam } from "@/lib/production/calendar";
import { loadPrintWorkCenters } from "@/lib/production/print";

export const dynamic = "force-dynamic";

/** V137 — Màn chọn mẫu in cho xưởng. */
export default async function ProductionPrintIndexPage({ searchParams }: { searchParams: Promise<{ ngay?: string }> }) {
  const params = await searchParams;
  const today = todayInVietnam();
  const day = /^\d{4}-\d{2}-\d{2}$/.test(String(params.ngay ?? "")) ? String(params.ngay) : today.toISOString().slice(0, 10);
  const teams = (await loadPrintWorkCenters()).filter((center) => center.kind === "TO");

  return (
    <ErpShell
      title="In phiếu lệnh sản xuất"
      subtitle="Phiếu A4 dọc cho tổ. In theo tổ + ngày, hoặc in phiếu riêng cho từng bộ cửa."
      actions={
        <Link className="erp-button-secondary" href="/ke-hoach-san-xuat">
          ← Bảng kế hoạch
        </Link>
      }
    >
      <div className="space-y-3">
        <ReportCard title="Chọn ngày cần in" hint="Ngày để tra các công đoạn đã được xếp lịch.">
          <form className="flex flex-wrap items-end gap-3 px-3 py-3" method="GET">
            <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Ngày
              <input className="erp-input mt-1 w-[160px]" type="date" name="ngay" defaultValue={day} />
            </label>
            <button className="erp-button" type="submit">
              Xem theo ngày này
            </button>
            <span className="text-[12px] text-slate-500">
              Đang chọn: <strong>{formatDate(new Date(`${day}T00:00:00.000Z`))}</strong>
            </span>
          </form>
        </ReportCard>

        <ReportCard title="In danh sách việc theo ngày (dán ở xưởng)" hint="Mỗi tổ một trang — chỉ gồm việc của tổ đó trong ngày.">
          <div className="flex flex-wrap gap-2 px-3 py-3">
            <Link className="erp-button" href={`/ke-hoach-san-xuat/in/danh-sach-viec?ngay=${day}`}>
              In tất cả tổ (1 trang/tổ)
            </Link>
            {teams.map((team) => (
              <Link key={team.code} className="erp-button-secondary" href={`/ke-hoach-san-xuat/in/danh-sach-viec?ngay=${day}&to=${team.code}`}>
                {team.name}
              </Link>
            ))}
          </div>
        </ReportCard>

        <ReportCard title="In phiếu lệnh sản xuất A4" hint="Mỗi bộ cửa một phiếu: thông tin bộ, 3 lệnh con (cánh/khung/phào) và bảng công đoạn để tổ tích.">
          <div className="flex flex-wrap gap-2 px-3 py-3">
            <Link className="erp-button" href={`/ke-hoach-san-xuat/in/phieu-lenh?ngay=${day}`}>
              In phiếu cho mọi bộ có việc trong ngày
            </Link>
            {teams.map((team) => (
              <Link key={team.code} className="erp-button-secondary" href={`/ke-hoach-san-xuat/in/phieu-lenh?ngay=${day}&to=${team.code}`}>
                {team.name}
              </Link>
            ))}
          </div>
          <p className="erp-hint px-3 pb-3">
            Muốn in phiếu cho <strong>một bộ cụ thể</strong>: mở bộ đó ở Bảng kế hoạch rồi bấm <strong>“In phiếu lệnh SX”</strong> — phiếu chỉ gồm công
            đoạn của bộ đó.
          </p>
        </ReportCard>

        <ReportCard title="Cách in" hint="Mẫu đã đặt sẵn khổ A4 dọc — mỗi bộ/tổ là một trang.">
          <ol className="list-decimal space-y-1.5 px-6 py-3 text-[12.5px] text-slate-700">
            <li>Bấm nút mở mẫu in.</li>
            <li>Trong trang in, bấm <strong>“In / Lưu PDF”</strong>.</li>
            <li>Chọn máy in hoặc <strong>Save as PDF</strong>; khổ <strong>A4</strong>, hướng <strong>dọc</strong>, lề mặc định.</li>
            <li>Tắt “Headers and footers” nếu trình duyệt tự thêm ngày/địa chỉ trang.</li>
          </ol>
        </ReportCard>
      </div>
    </ErpShell>
  );
}
