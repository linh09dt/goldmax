import Link from "next/link";
import { notFound } from "next/navigation";
import { ErpShell } from "@/components/erp-shell";
import { OrderDeleteButton } from "@/components/order-delete-button";
import { OrderExportButtons } from "@/components/order-export-buttons";
import { prisma } from "@/lib/prisma";
import { resolveOrderItemDetails } from "@/lib/order-detail";
import { showsSetNumber } from "@/lib/order-form";
import { buildOutputGroups, calculateOutputTotals, hasPricingQuantity } from "@/lib/order-output";

export const dynamic = "force-dynamic";

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const orderId = Number(id);
  if (!Number.isInteger(orderId)) notFound();

  const order = await prisma.salesOrder.findUnique({
    where: { id: orderId },
    include: {
      items: { orderBy: { lineNo: "asc" }, include: { details: { orderBy: { rowOrder: "asc" } } } },
      requirements: { orderBy: { sortOrder: "asc" } },
      imports: { orderBy: { importedAt: "desc" }, take: 10 },
    },
  });
  if (!order) notFound();

  const outputGroups = buildOutputGroups(order.items as any, resolveOrderItemDetails as any);
  const outputTotals = calculateOutputTotals(outputGroups, order);
  // V75: Bộ số chỉ hiển thị khi đơn đã sang trạng thái Đã xác nhận / Đã chuyển sản xuất.
  const showSetNumber = showsSetNumber(order.status);
  const visibleItems = order.items.flatMap((item) => {
    const detailRows = resolveOrderItemDetails(item).filter((row) => hasPricingQuantity(row.pricingQuantity));
    const showMainRow = hasPricingQuantity(item.pricingQuantity);
    if (!showMainRow && detailRows.length === 0) return [];
    return [{ item, detailRows, showMainRow }];
  });

  return (
    <ErpShell
      title={`Đơn hàng ${order.orderCode}`}
      actions={
        <>
          <Link className="erp-button-secondary" href="/orders">← Danh sách</Link>
          <OrderExportButtons orderId={order.id} pdfLabel="Xuất PDF" />
          <span className="mx-1 hidden h-7 w-px bg-slate-300 md:inline-block" aria-hidden="true" />
          <Link className="erp-button" href={`/orders/${order.id}/edit`}>Sửa đơn</Link>
          <OrderDeleteButton orderId={order.id} orderCode={order.orderCode} redirectAfterDelete />
        </>
      }
    >
      <section className="erp-card overflow-hidden">
        <div className="border-b border-slate-200 bg-slate-50 px-3 py-1.5">
          <h2 className="text-[12px] font-semibold tracking-normal text-slate-900">Thông tin đơn hàng</h2>
        </div>
        <div className="p-2.5">
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-[1.18fr_0.88fr_0.96fr_1.05fr_1.12fr_1.28fr_0.96fr_1.02fr_0.98fr_0.88fr_1.42fr_0.78fr_0.82fr]">
            <OrderInfoField label="Mã đơn hàng" value={order.orderCode} required />
            <OrderInfoField label="Trạng thái" value={statusLabel(order.status)} required />
            <OrderInfoField label="Ngày cập nhật" value={formatDate(order.excelUpdateDate)} required />
            <OrderInfoField label="NVKD phụ trách" value={order.salesEmployeeCode || "—"} required />
            <OrderInfoField label="Mã Đại Lý" value={order.customerCode || "—"} required />
            <OrderInfoField label="Tên khách hàng" value={order.customerName || "—"} required />
            <OrderInfoField label="Ngày đặt hàng" value={formatDate(order.orderDate)} required />
            <OrderInfoField label="Ngày cần giao hàng" value={formatDate(order.requiredDeliveryDate)} required />
            <OrderInfoField label="Người nhận" value={order.receiverName || "—"} />
            <OrderInfoField label="Số điện thoại" value={order.receiverPhone || "—"} required />
            <OrderInfoField label="Địa chỉ nhận hàng" value={order.receiverAddress || "—"} required />
            <OrderInfoField label="Vùng miền" value={order.region || "—"} />
            <OrderInfoField label="Số Km giao hàng" value={order.deliveryKm?.toString() || "—"} />
          </div>
        </div>
      </section>

      <section className="erp-card mt-6 overflow-hidden">
        <div className="border-b border-slate-200 bg-slate-50 px-5 py-4">
          <h2 className="font-bold">Chi tiết từng bộ cửa ({visibleItems.length})</h2>
        </div>
        <div className="space-y-5 bg-slate-50 p-4">
          {visibleItems.map(({ item, detailRows, showMainRow }) => {
            return (
              <div className="overflow-hidden rounded-xl border border-slate-300 bg-white" key={item.id}>
                <div className="flex flex-col gap-1 bg-slate-900 px-4 py-3 text-white md:flex-row md:items-center md:justify-between">
                  <div className="font-semibold">
                    Bộ cửa #{item.lineNo} {showSetNumber && item.setNo ? `· Bộ số ${item.setNo}` : ""} {item.productName ? `· ${item.productName}` : ""}
                  </div>
                  <div className="text-xs text-slate-300">{detailRows.length} dòng chi tiết có KH/Lượng</div>
                </div>
                <div className="w-full overflow-hidden">
                  <table className="w-full table-fixed border-collapse text-[9px] leading-tight xl:text-[10px]">
                    <colgroup>
                      <col style={{ width: "2%" }} />
                      <col style={{ width: "3.5%" }} />
                      <col style={{ width: "11%" }} />
                      <col style={{ width: "8%" }} />
                      <col style={{ width: "4.5%" }} />
                      <col style={{ width: "4%" }} />
                      <col style={{ width: "5%" }} />
                      <col style={{ width: "4.5%" }} />
                      <col style={{ width: "3.5%" }} />
                      <col style={{ width: "3.5%" }} />
                      <col style={{ width: "3.5%" }} />
                      <col style={{ width: "3.5%" }} />
                      <col style={{ width: "3.5%" }} />
                      <col style={{ width: "4%" }} />
                      <col style={{ width: "3.5%" }} />
                      <col style={{ width: "5%" }} />
                      <col style={{ width: "5.5%" }} />
                      <col style={{ width: "6%" }} />
                      <col style={{ width: "9.5%" }} />
                      <col style={{ width: "6.5%" }} />
                    </colgroup>
                    <thead className="bg-slate-200 text-slate-700">
                      <tr>
                        <Th rowSpan={2}>STT</Th><Th rowSpan={2}>BỘ SỐ</Th><Th rowSpan={2}>Tên sản phẩm<br/>(1)</Th><Th rowSpan={2}>Model<br/>(2)</Th><Th rowSpan={2}>Ô THOÁNG</Th>
                        <Th rowSpan={2}>Hướng mở<br/>(3)</Th><Th rowSpan={2}>Phào<br/>(Thuận - Nghịch)<br/>(4)</Th><Th rowSpan={2}>Màu sơn<br/>(5)</Th>
                        <Th colSpan={3} center>Kích thước cửa (mm)</Th><Th colSpan={2} center>KT thông thủy</Th><Th rowSpan={2}>Số lượng bộ<br/>(13)</Th>
                        <Th colSpan={4} center>Tính giá</Th><Th rowSpan={2}>Ghi chú<br/>(18)</Th><Th rowSpan={2}>Hình ảnh SP</Th>
                      </tr>
                      <tr>
                        <Th center>Cao<br/>(7)</Th><Th center>Rộng<br/>(8)</Th><Th center>Khuôn<br/>(9)</Th><Th center>Cao<br/>(10)</Th><Th center>Rộng<br/>(11)</Th>
                        <Th center>ĐVT<br/>(14)</Th><Th center>KH/Lượng<br/>(15)</Th><Th center>Đơn giá<br/>(16)</Th><Th center>Thành tiền<br/>(17)</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {showMainRow ? <ReadRow lineNo={item.lineNo} row={item} main showSetNo={showSetNumber} /> : null}
                      {detailRows.length > 0 ? (
                        <>
                          <tr>
                            <td className="border border-slate-300 bg-slate-100 px-3 py-2 font-semibold text-slate-700" colSpan={20}>
                              ↳ Chi tiết / phụ kiện / phụ phí của bộ cửa
                            </td>
                          </tr>
                          {detailRows.map((row, index) => (
                            <ReadRow key={row.id ?? `raw-${item.id}-${row.sourceRow ?? index}`} lineNo={null} row={row} showSetNo={showSetNumber} />
                          ))}
                        </>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="mt-6 grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="erp-card xl:col-start-2">
          <div className="border-b border-slate-200 bg-slate-50 px-5 py-4"><h2 className="font-bold">Tổng hợp giá trị</h2></div>
          <div className="space-y-2 p-5 text-sm">
            <MoneyLine label="Cước vận chuyển" value={outputTotals.shippingFee} />
            <MoneyLine label="Tổng tiền đơn hàng" value={outputTotals.orderTotal} strong />
            <MoneyLine label="Chiết khấu (%)" value={outputTotals.discountPercent} percent />
            <MoneyLine label="Số tiền chiết khấu" value={outputTotals.discountAmount} />
            <MoneyLine label="Tổng sau chiết khấu" value={outputTotals.afterDiscount} strong />
            <MoneyLine label="Đặt cọc" value={outputTotals.depositAmount} />
            <MoneyLine label="Trừ tiền nhận hàng tại kho" value={outputTotals.warehouseReceiptDeduction} />
            <MoneyLine label="Thanh toán khi giao hàng" value={outputTotals.paymentDue} strong />
          </div>
        </div>
      </section>

      <section className="erp-card mt-6">
        <div className="border-b border-slate-200 bg-slate-50 px-5 py-4"><h2 className="font-bold">Lịch sử nhập Excel</h2></div>
        <div className="divide-y divide-slate-200">
          {order.imports.length ? order.imports.map((entry) => (
            <div key={entry.id} className="flex flex-col justify-between gap-1 px-5 py-3 text-sm md:flex-row">
              <span>{importAction(entry.action)} · {entry.fileName} · {entry.importedItems} bộ cửa</span>
              <span className="text-slate-500">{formatDateTime(entry.importedAt)}</span>
            </div>
          )) : <div className="p-5 text-sm text-slate-500">Đơn này được tạo trực tiếp, chưa có lịch sử nhập Excel.</div>}
        </div>
      </section>
    </ErpShell>
  );
}

function ReadRow({ lineNo, row, main = false, showSetNo = false }: { lineNo: number | null; main?: boolean; showSetNo?: boolean; row: any }) {
  return (
    <tr className={main ? "bg-cyan-50 font-medium" : "hover:bg-slate-50"}>
      <Td>{lineNo ?? ""}</Td><Td>{showSetNo ? (row.setNo || "") : ""}</Td><Td wide>{row.productName || ""}</Td><Td>{row.productCode || row.model || ""}</Td><Td wide>{row.panelInfo || ""}</Td>
      <Td>{row.openingDirection || ""}</Td><Td>{row.trimDirection || ""}</Td><Td>{row.paintColor || ""}</Td><Td>{row.heightMm ?? ""}</Td><Td>{row.widthMm ?? ""}</Td><Td>{row.frameMm ?? ""}</Td>
      <Td>{row.clearHeightMm ?? ""}</Td><Td>{row.clearWidthMm ?? ""}</Td><Td>{row.quantity ?? ""}</Td><Td>{row.unit || ""}</Td>{/* V74: dòng cửa hiển thị KHỐI LƯỢNG đến 2 số thập phân; dòng phụ kiện giữ tối đa 4. */}<Td>{main ? formatQuantity2(row.pricingQuantity) : formatNumber(row.pricingQuantity)}</Td><Td>{formatMoney(row.unitPrice)}</Td><Td>{formatMoney(row.amount)}</Td>
      <Td wide>{row.note || ""}</Td><Td>{row.imagePath ? <ProductImage path={row.imagePath} /> : ""}</Td>
    </tr>
  );
}

function ProductImage({ path }: { path: string }) {
  return (
    <a href={path} target="_blank" rel="noreferrer" className="inline-flex">
      <img
        src={path}
        alt="Hình sản phẩm"
        className="h-14 w-14 rounded border border-slate-200 bg-white object-contain"
        loading="lazy"
      />
    </a>
  );
}
function OrderInfoField({ label, value, required = false }: { label: string; value: string; required?: boolean }) {
  return (
    <div className="min-w-0">
      <div className="flex min-h-[28px] items-end pb-0.5 text-[10px] font-medium uppercase leading-[1.05] text-slate-500">
        <span className="break-words">{label}{required ? <span className="ml-0.5 text-cyan-700">*</span> : null}</span>
      </div>
      <div className="flex h-8 min-w-0 items-center overflow-hidden rounded-md border border-slate-300 bg-white px-2 text-[12px] font-medium text-blue-800 shadow-sm">
        <span className="min-w-0 truncate" title={value}>{value}</span>
      </div>
    </div>
  );
}
function Th({ children, rowSpan, colSpan, center = false }: { children: React.ReactNode; rowSpan?: number; colSpan?: number; center?: boolean }) { return <th rowSpan={rowSpan} colSpan={colSpan} className={`overflow-hidden break-words border border-slate-300 px-1 py-1.5 align-middle font-semibold ${center ? "text-center" : "text-left"}`}>{children}</th>; }
function Td({ children }: { children: React.ReactNode; wide?: boolean }) { return <td className="min-w-0 overflow-hidden break-words border border-slate-200 px-1 py-1.5 align-top">{children}</td>; }
function MoneyLine({ label, value, strong, percent }: { label: string; value: unknown; strong?: boolean; percent?: boolean }) { return <div className={`flex justify-between gap-4 rounded-lg px-3 py-2 ${strong ? "bg-slate-900 text-white" : "bg-slate-50"}`}><span>{label}</span><span className="font-semibold">{percent ? `${formatNumber(value)} %` : formatMoney(value)}</span></div>; }
function formatDate(value: Date | null) { return value ? new Intl.DateTimeFormat("vi-VN").format(value) : "—"; }
function formatDateTime(value: Date) { return new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short" }).format(value); }
// V74: KHỐI LƯỢNG của dòng cửa — hiển thị đúng 2 số thập phân.
function formatQuantity2(value: unknown) { if (value === null || value === undefined || value === "") return "—"; const n = Number(String(value)); return Number.isFinite(n) ? new Intl.NumberFormat("vi-VN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n) : String(value); }
function formatNumber(value: unknown) { if (value === null || value === undefined || value === "") return "—"; const n = Number(String(value)); return Number.isFinite(n) ? new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 4 }).format(n) : String(value); }
function formatMoney(value: unknown) { if (value === null || value === undefined || value === "") return "—"; const n = Number(String(value)); return Number.isFinite(n) ? `${new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 0 }).format(n)} đ` : String(value); }
function statusLabel(value: string) { return ({ NHAP:"Nháp", CHO_XAC_NHAN:"Chờ khách hàng xác nhận", DA_XAC_NHAN:"Đã xác nhận", CHUYEN_SAN_XUAT:"Đã chuyển sản xuất", HUY:"Đã hủy" } as Record<string,string>)[value] ?? value; }
function importAction(value: string) { return value === "CREATED" ? "Tạo từ Excel" : value === "UPDATED" ? "Cập nhật từ Excel" : value === "REBUILT_DETAILS" ? "Khôi phục chi tiết từ Excel" : value; }
