import Link from "next/link";
import { ErpShell } from "@/components/erp-shell";
import { ReportCard } from "@/components/reports/report-ui";
import { ImportInProgress, type UnplannedItem } from "@/components/production/import-in-progress";
import { countUnplannedOrderItems, loadUnplannedOrderItems } from "@/lib/production/service";

export const dynamic = "force-dynamic";

/**
 * V136 — Nhập các bộ đang sản xuất dở vào kế hoạch (B8: "có, hiện có tương đối nhiều bộ đang sản xuất dang dở").
 *
 * Sau khi đưa vào kế hoạch, mở từng bộ ở bảng kế hoạch để đánh dấu công đoạn đã xong.
 */
export default async function ImportInProgressPage() {
  const [rows, total] = await Promise.all([loadUnplannedOrderItems(300), countUnplannedOrderItems()]);

  const items: UnplannedItem[] = rows.map((row) => ({
    id: row.id,
    setNo: row.set_no,
    model: row.model,
    productName: row.product_name,
    paintColor: row.paint_color,
    heightMm: row.height_mm,
    widthMm: row.width_mm,
    leavesPerSet: row.leaves_per_set,
    quantity: row.quantity,
    orderCode: row.order_code,
    orderType: row.order_type,
    customerName: row.customer_name,
    dueDate: row.required_delivery_date ? new Date(row.required_delivery_date).toISOString() : null,
  }));

  return (
    <ErpShell
      title="Nhập bộ đang sản xuất dở"
      subtitle="Bộ cửa của đơn đã xác nhận nhưng chưa có trong kế hoạch sản xuất."
      actions={
        <Link className="erp-button-secondary" href="/ke-hoach-san-xuat">
          ← Bảng kế hoạch
        </Link>
      }
    >
      <div className="space-y-3">
        <ReportCard
          title="Danh sách bộ chưa vào kế hoạch"
          hint="Đưa vào kế hoạch sẽ sinh đủ công đoạn theo danh mục (bỏ qua công đoạn không cần với màu sơn 11/14, và Bồi Lares nếu model đã có chương trình)."
          right={`${total} bộ`}
        >
          <ImportInProgress items={items} total={total} />
        </ReportCard>

        {total > items.length ? (
          <p className="erp-hint">
            Đang hiện {items.length} bộ đầu (xếp theo hạn giao gần nhất). Bấm “Đưa TẤT CẢ vào kế hoạch” để nhập toàn bộ {total} bộ.
          </p>
        ) : null}

        <ReportCard title="Quy trình đề xuất" hint="Để dữ liệu tiến độ đúng ngay từ tuần đầu">
          <ol className="list-decimal space-y-1.5 px-6 py-3 text-[12.5px] text-slate-700">
            <li>Bấm <strong>Đưa TẤT CẢ vào kế hoạch</strong> để sinh công đoạn cho mọi bộ của đơn đã xác nhận.</li>
            <li>Vào <Link className="text-cyan-700 hover:underline" href="/ke-hoach-san-xuat">Bảng kế hoạch</Link>, mở từng bộ đang làm dở.</li>
            <li>Ở trang bộ cửa, đánh dấu các công đoạn <strong>đã xong</strong> và công đoạn <strong>đang làm</strong> — tiến độ % sẽ tự tính.</li>
            <li>Từ đó về sau, văn phòng chỉ cần cập nhật khi công đoạn chuyển bước.</li>
          </ol>
        </ReportCard>
      </div>
    </ErpShell>
  );
}
