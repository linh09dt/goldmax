import Link from "next/link";
import { ErpShell } from "@/components/erp-shell";

export const dynamic = "force-dynamic";

/**
 * V130 — Trung tâm báo cáo: điểm vào cho toàn bộ báo cáo dựng được từ dữ liệu hiện có.
 * Mỗi thẻ ghi rõ nguồn dữ liệu để người dùng biết báo cáo đang tính từ gì.
 */

const REPORTS: Array<{ href: string; title: string; description: string; source: string }> = [
  {
    href: "/",
    title: "Tổng quan bán hàng",
    description: "6 KPI điều hành, doanh thu 12 tháng, cơ cấu loại đơn, top đại lý/NVKD/sản phẩm, đơn cần chú ý.",
    source: "sales_orders + dòng hàng",
  },
  {
    href: "/revenue",
    title: "Theo dõi doanh thu",
    description: "Tổng tiền, chiết khấu, đặt cọc, còn lại theo đơn; sản phẩm phát sinh doanh thu; xuất Excel 3 sheet.",
    source: "sales_orders (chỉ đơn Sản xuất đã xác nhận)",
  },
  {
    href: "/reports/orders",
    title: "Báo cáo Đơn hàng",
    description: "Số đơn, tỉ lệ xác nhận, quá hạn, đơn theo tháng/loại/trạng thái/vùng miền và bảng đơn chi tiết.",
    source: "sales_orders",
  },
  {
    href: "/reports/products",
    title: "Báo cáo Sản phẩm",
    description: "Top sản phẩm bán chạy, doanh thu theo sản phẩm, đơn giá TB/thấp nhất/cao nhất, sản phẩm chưa phát sinh.",
    source: "sales_order_items ↔ item_masters",
  },
  {
    href: "/reports/sales-performance",
    title: "Báo cáo Nhân viên Sales",
    description: "Số đơn, doanh thu, đã thu, còn phải thu, giá trị đơn TB và tỉ lệ xác nhận theo từng NVKD.",
    source: "sales_orders.sales_employee_code",
  },
  {
    href: "/reports/receivables",
    title: "Báo cáo Công nợ",
    description: "Còn phải thu theo khách/đại lý, tuổi nợ (chưa đến hạn · 1–7 · 8–30 · 31–60 · >60 ngày) kèm cảnh báo.",
    source: "sales_orders (đã xác nhận) — suy ra từ đơn",
  },
  {
    href: "/reports/production",
    title: "Báo cáo Sản xuất (OTD)",
    description: "Giao đúng hạn, bộ giao trễ, tỷ lệ làm lại, thời gian thực tế từng công đoạn so với định mức, năng suất tổ, lý do trễ, tồn thành phẩm.",
    source: "production_sets + production_tasks (mốc thực tế xưởng ghi)",
  },
  {
    href: "/reports/production-load",
    title: "Tải sản xuất theo tuần",
    description: "Khối lượng bộ cửa phải giao theo tuần (tuần này + 7 tuần tới), danh sách đơn quá hạn, phân bổ vùng miền.",
    source: "sales_orders.required_delivery_date (đã xác nhận)",
  },
];

export default function ReportsHubPage() {
  return (
    <ErpShell
      title="Trung tâm báo cáo"
      subtitle="Các báo cáo dựng trực tiếp từ dữ liệu đơn hàng, danh mục hàng hóa và cước vận chuyển hiện có."
    >
      <div className="grid gap-2.5 md:grid-cols-2 xl:grid-cols-3">
        {REPORTS.map((report) => (
          <Link
            key={report.href}
            href={report.href}
            className="erp-card group flex flex-col p-3 transition hover:ring-2 hover:ring-cyan-300"
          >
            <div className="flex items-start justify-between gap-2">
              <h2 className="text-[13px] font-bold text-slate-900 group-hover:text-cyan-700">{report.title}</h2>
              <span className="text-[13px] font-bold text-cyan-600">›</span>
            </div>
            <p className="mt-1 flex-1 text-[11.5px] leading-5 text-slate-600">{report.description}</p>
            <p className="mt-2 text-[10px] font-semibold uppercase tracking-wide text-slate-400">Nguồn: {report.source}</p>
          </Link>
        ))}
      </div>

      <p className="erp-hint mt-4">
        Chưa có báo cáo <b>lợi nhuận/biên lợi nhuận</b> vì danh mục hàng hóa chưa có giá vốn; và chưa có báo cáo <b>thanh toán/giao hàng</b> vì hệ thống chưa có phiếu thu và trạng thái giao nhận.
      </p>
    </ErpShell>
  );
}
