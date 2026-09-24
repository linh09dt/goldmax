import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { resolveOrderItemDetails } from "@/lib/order-detail";
import { buildOutputGroups, calculateOutputTotals, cleanText, outputLineAmount } from "@/lib/order-output";
import { OrderPrintActions } from "@/components/order-print-actions";

export const dynamic = "force-dynamic";

export default async function PrintOrderPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ auto?: string; note?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const orderId = Number(id);
  if (!Number.isInteger(orderId)) notFound();

  const order = await prisma.salesOrder.findUnique({
    where: { id: orderId },
    include: {
      items: { orderBy: { lineNo: "asc" }, include: { details: { orderBy: { rowOrder: "asc" } } } },
      requirements: { orderBy: { sortOrder: "asc" } },
    },
  });
  if (!order) notFound();

  const groups = buildOutputGroups(order.items as any, resolveOrderItemDetails as any);
  const totals = calculateOutputTotals(groups, order);
  const exportNote = normalizeExportNote(query.note);

  return (
    <main className="order-print-root">
      <OrderPrintActions autoPrint={query.auto === "1"} />
      <article className="order-print-sheet">
        <header className="order-print-header">
          <div className="order-print-brand">
            <img src="/goldmax-logo.png" alt="GOLDMAX" />
          </div>
          <div className="order-print-title">
            <h1>CÔNG TY TNHH SXTM GOLDMAX VIỆT NAM</h1>
            <h2>THÔNG TIN ĐƠN HÀNG</h2>
          </div>
          <div className="order-print-badge">MẪU CỬA</div>

          <div className="order-print-meta-grid">
            <Meta label="Tên khách hàng" value={order.customerName || order.receiverName || order.customerCode || ""} />
            <Meta label="Địa chỉ" value={order.receiverAddress || ""} />
            <Meta label="Ngày đặt hàng" value={formatDate(order.orderDate)} />
            <Meta label="Mã đại lý" value={order.customerCode || ""} />
            <Meta label="Mã nhân viên" value={order.salesEmployeeCode || ""} />
            <Meta label="Ngày trả dự kiến" value={formatDate(order.requiredDeliveryDate)} />
          </div>
        </header>

        <table className="order-print-table">
          <colgroup>
            <col style={{ width: "2.21%" }} />
            <col style={{ width: "4.42%" }} />
            <col style={{ width: "9.71%" }} />
            <col style={{ width: "8.83%" }} />
            <col style={{ width: "4.42%" }} />
            <col style={{ width: "3.53%" }} />
            <col style={{ width: "4.42%" }} />
            <col style={{ width: "3.97%" }} />
            <col style={{ width: "3.31%" }} />
            <col style={{ width: "3.31%" }} />
            <col style={{ width: "3.31%" }} />
            <col style={{ width: "3.31%" }} />
            <col style={{ width: "3.31%" }} />
            <col style={{ width: "3.97%" }} />
            <col style={{ width: "3.53%" }} />
            <col style={{ width: "4.42%" }} />
            <col style={{ width: "5.74%" }} />
            <col style={{ width: "6.62%" }} />
            <col style={{ width: "10.60%" }} />
            <col style={{ width: "7.06%" }} />
          </colgroup>
          <thead>
            <tr>
              <th rowSpan={2}>STT</th><th rowSpan={2}>BỘ SỐ</th><th rowSpan={2}>Tên sản phẩm<br/>(1)</th><th rowSpan={2}>Model<br/>(2)</th>
              <th rowSpan={2}>Ô THOÁNG</th><th rowSpan={2}>Hướng mở<br/>(3)</th><th rowSpan={2}>Phào<br/>(Thuận - Nghịch)<br/>(4)</th><th rowSpan={2} className="paint-header">Màu sơn<br/>(5)</th>
              <th colSpan={3}>Kích thước cửa (mm)</th><th colSpan={2}>KT thông thủy</th><th rowSpan={2}>Số lượng bộ<br/>(13)</th>
              <th colSpan={4}>Tính giá</th><th rowSpan={2}>Ghi chú<br/>(18)</th><th rowSpan={2}>Hình ảnh SP<br/>(19)</th>
            </tr>
            <tr><th>Cao<br/>(7)</th><th>Rộng<br/>(8)</th><th>Khuôn<br/>(9)</th><th>Cao<br/>(10)</th><th>Rộng<br/>(11)</th><th>ĐVT<br/>(14)</th><th>KH/Lượng<br/>(15)</th><th>Đơn giá<br/>(16)</th><th>Thành tiền<br/>(17)</th></tr>
          </thead>
          <tbody>
            {groups.map((group) => group.rows.map((entry, index) => (
              <tr key={`${group.lineNo}-${index}`} className={entry.main ? "main-row" : "detail-row"}>
                <td>{entry.firstInGroup ? group.lineNo : ""}</td>
                <td>{entry.firstInGroup ? group.setNo : ""}</td>
                <td>{cleanText(entry.row.productName) || ""}</td>
                <td>{cleanText(entry.row.productCode) || cleanText(entry.row.model) || ""}</td>
                <td>{cleanText(entry.row.panelInfo) || ""}</td>
                <td>{cleanText(entry.row.openingDirection) || ""}</td>
                <td>{cleanText(entry.row.trimDirection) || ""}</td>
                <td>{cleanText(entry.row.paintColor) || ""}</td>
                <td className={detailDimensionClass(entry.main, entry.row.heightMm)}>{number(entry.row.heightMm)}</td>
                <td className={detailDimensionClass(entry.main, entry.row.widthMm)}>{number(entry.row.widthMm)}</td>
                <td className={detailDimensionClass(entry.main, entry.row.frameMm)}>{number(entry.row.frameMm)}</td>
                <td>{number(entry.row.clearHeightMm)}</td><td>{number(entry.row.clearWidthMm)}</td><td>{number(entry.row.quantity)}</td>
                <td>{cleanText(entry.row.unit) || ""}</td><td>{decimal(entry.row.pricingQuantity)}</td><td>{money(entry.row.unitPrice)}</td><td>{money(outputLineAmount(entry.row))}</td>
                <td className="note">{cleanText(entry.row.note) || ""}</td>
                <td className="product-image">{rowImagePath(entry.row, entry.main, group.imagePath) ? <img src={rowImagePath(entry.row, entry.main, group.imagePath)!} alt={entry.main ? `Bộ ${group.setNo || group.lineNo}` : cleanText(entry.row.productName) || "Chi tiết / phụ kiện"} /> : ""}</td>
              </tr>
            )))}
            {!groups.length ? <tr><td colSpan={20} className="empty">Không có dòng hàng hóa nào có KH/Lượng để xuất.</td></tr> : null}
          </tbody>
          <tfoot>
            {exportNote ? <tr className="export-note-row"><td colSpan={20}>{exportNote}</td></tr> : null}
            {totals.shippingFee > 0 ? <TotalRow label="CƯỚC VẬN CHUYỂN" value={totals.shippingFee} /> : null}
            <TotalRow label="TỔNG ĐƠN HÀNG" value={totals.orderTotal} />
            {totals.discountPercent > 0 && totals.discountAmount > 0 ? (
              <TotalRow label={`CHIẾT KHẤU ${totals.discountPercent}%`} value={totals.discountAmount} />
            ) : null}
            <TotalRow label="CÒN LẠI" value={totals.afterDiscount} />
            <TotalRow label="ĐẶT CỌC" value={totals.depositAmount} />
            {totals.warehouseReceiptDeduction > 0 ? <TotalRow label="TRỪ TIỀN NHẬN HÀNG TẠI KHO" value={totals.warehouseReceiptDeduction} /> : null}
            <TotalRow label="CÒN LẠI VẪN THANH TOÁN" value={totals.paymentDue} red />
          </tfoot>
        </table>

        <section className="order-print-notes">
          <strong>Ghi chú:</strong>
          <div className="note-indent"><strong>Khách hàng xác nhận các thông tin sau:</strong></div>
          {order.requirements.map((item) => (
            <div className="note-indent" key={item.id}>- {item.questionText}{item.answer || item.note ? `: ${[item.answer, item.note].filter(Boolean).join(" - ")}` : ""}</div>
          ))}
        </section>
      </article>
    </main>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return <div className="order-print-meta"><strong>{label}:</strong> <span>{value}</span></div>;
}
function TotalRow({ label, value, red = false }: { label: string; value: number; red?: boolean }) {
  return <tr className={red ? "total-row red" : "total-row"}><td colSpan={17}>{label}</td><td colSpan={3}>{money(value)}</td></tr>;
}
function detailDimensionClass(main: boolean, value: unknown) {
  const n = Number(String(value ?? ""));
  return !main && Number.isFinite(n) && n !== 0 ? "detail-dimension" : undefined;
}
function normalizeExportNote(value: string | undefined) {
  return (value || "").replace(/\r\n?/g, "\n").trim().slice(0, 1000);
}
function rowImagePath(row: Record<string, any>, main: boolean, groupImagePath: string | null) {
  return cleanText(row.imagePath) || (main ? cleanText(groupImagePath) : null);
}

function formatDate(value: Date | null) { return value ? new Intl.DateTimeFormat("vi-VN").format(value) : ""; }
function money(value: unknown) { const n = Number(String(value ?? "")); return Number.isFinite(n) ? new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(n) : ""; }
function number(value: unknown) { const n = Number(String(value ?? "")); return Number.isFinite(n) && n !== 0 ? new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(n) : ""; }
function decimal(value: unknown) { const n = Number(String(value ?? "")); return Number.isFinite(n) && n !== 0 ? new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n) : ""; }
