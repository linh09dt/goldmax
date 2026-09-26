import Link from "next/link";
import { notFound } from "next/navigation";
import { ErpShell } from "@/components/erp-shell";
import { CreateProductionOrderButton } from "@/components/production/create-production-order-button";
import { OrderDeleteButton } from "@/components/order-delete-button";
import { OrderExportButtons } from "@/components/order-export-buttons";
import { prisma } from "@/lib/prisma";
import { resolveOrderItemDetails } from "@/lib/order-detail";
import { isConfirmedStatus, showsSetNumber, orderStatusLabel, orderTypeLabel } from "@/lib/order-form";
import { buildOutputGroups, calculateOutputTotals, hasRowContent } from "@/lib/order-output";

export const dynamic = "force-dynamic";

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const orderId = Number(id);
  if (!Number.isInteger(orderId)) notFound();

  const order = await prisma.salesOrder.findUnique({
    where: { id: orderId },
    include: {
      items: { orderBy: { lineNo: "asc" }, include: { details: { orderBy: { rowOrder: "asc" } }, images: { orderBy: { sortOrder: "asc" } } } },
      requirements: { orderBy: { sortOrder: "asc" } },
      imports: { orderBy: { importedAt: "desc" }, take: 10 },
    },
  });
  if (!order) notFound();

  const outputGroups = buildOutputGroups(order.items as any, resolveOrderItemDetails as any);
  const outputTotals = calculateOutputTotals(outputGroups, order);
  // V112: Bộ số chỉ hiển thị khi đơn ĐÃ XÁC NHẬN (bấm "Lưu đơn hàng").
  const showSetNumber = showsSetNumber(order.status);
  // V133.2: hiện dòng khi có DỮ LIỆU THẬT (không đòi phải có Số KH/Lượng) — nhờ vậy đơn chỉ nhập
  // phụ kiện/chi tiết, hoặc dòng phụ kiện không điền bộ số, vẫn hiện đầy đủ.
  const visibleItems = order.items.flatMap((item) => {
    const detailRows = resolveOrderItemDetails(item).filter((row) => hasRowContent(row as unknown as Record<string, unknown>));
    const showMainRow = hasRowContent(item as unknown as Record<string, unknown>);
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
          <CreateProductionOrderButton orderId={order.id} orderCode={order.orderCode} confirmed={isConfirmedStatus(order.status)} />
          <Link className="erp-button-secondary" href={`/orders/${order.id}/edit`}>Sửa đơn</Link>
          <OrderDeleteButton orderId={order.id} orderCode={order.orderCode} redirectAfterDelete />
        </>
      }
    >
      <section className="erp-card overflow-hidden">
        <div className="border-b border-slate-200 bg-slate-50 px-3 py-1.5">
          <h2 className="text-[12px] font-semibold tracking-normal text-slate-900">Thông tin đơn hàng</h2>
        </div>
        <div className="p-2.5">
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-[1.18fr_1.12fr_0.94fr_1.02fr_1.08fr_1.24fr_0.94fr_0.99fr_0.95fr_0.86fr_0.95fr_0.76fr_0.80fr_0.60fr]">
            <OrderInfoField label="Mã đơn hàng" value={order.orderCode} required />
            <OrderInfoField label="Loại đơn" value={orderTypeLabel(order.orderType)} required />
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
                  <div className="text-xs text-slate-300">{detailRows.length} dòng chi tiết</div>
                </div>
                <div className="w-full overflow-hidden">
                  <table className="w-full table-fixed border-collapse text-[9px] leading-tight xl:text-[10px]">
                    <colgroup>
                      <col style={{ width: "2.5%" }} />
                      <col style={{ width: "4%" }} />
                      <col style={{ width: "12%" }} />
                      <col style={{ width: "9%" }} />
                      <col style={{ width: "5%" }} />
                      <col style={{ width: "4.5%" }} />
                      <col style={{ width: "5.5%" }} />
                      <col style={{ width: "5%" }} />
                      <col style={{ width: "4%" }} />
                      <col style={{ width: "4%" }} />
                      <col style={{ width: "4%" }} />
                      <col style={{ width: "4%" }} />
                      <col style={{ width: "4%" }} />
                      <col style={{ width: "4.5%" }} />
                      <col style={{ width: "4%" }} />
                      <col style={{ width: "5%" }} />
                      <col style={{ width: "6%" }} />
                      <col style={{ width: "6.5%" }} />
                      <col style={{ width: "6.5%" }} />
                    </colgroup>
                    <thead className="bg-slate-200 text-slate-700">
                      <tr>
                        <Th rowSpan={2}>STT</Th><Th rowSpan={2}>BỘ SỐ</Th><Th rowSpan={2}>Tên sản phẩm<br/>(1)</Th><Th rowSpan={2}>Model<br/>(2)</Th><Th rowSpan={2}>Ô THOÁNG</Th>
                        <Th rowSpan={2}>Hướng mở<br/>(3)</Th><Th rowSpan={2}>Phào<br/>(Thuận - Nghịch)<br/>(4)</Th><Th rowSpan={2}>Màu sơn<br/>(5)</Th>
                        <Th colSpan={3} center>Kích thước cửa (mm)</Th><Th colSpan={2} center>KT thông thủy</Th><Th rowSpan={2}>Số lượng bộ<br/>(13)</Th>
                        <Th colSpan={4} center>Tính giá</Th><Th rowSpan={2}>Hình ảnh SP</Th>
                      </tr>
                      <tr>
                        <Th center>Cao<br/>(7)</Th><Th center>Rộng<br/>(8)</Th><Th center>Khuôn<br/>(9)</Th><Th center>Cao<br/>(10)</Th><Th center>Rộng<br/>(11)</Th>
                        <Th center>ĐVT<br/>(14)</Th><Th center>KH/Lượng<br/>(15)</Th><Th center>Đơn giá<br/>(16)</Th><Th center>Thành tiền<br/>(17)</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {/* V109: 1 ô Ảnh SP cho cả bộ cửa — merge từ dòng cửa xuống hết dòng phụ kiện. */}
                      {(() => {
                        const setImage = setImageOf(item, detailRows);
                        const itemRows = (showMainRow ? 1 : 0) + detailRows.length;
                        // Hàng "↳ Chi tiết / phụ kiện" nằm TRONG khối nên ô ảnh của dòng cửa phải trải qua nó.
                        const separatorRows = detailRows.length > 0 ? 1 : 0;
                        const span = itemRows + separatorRows;
                        return (
                          <>
                            {showMainRow ? (
                              <ReadRow lineNo={item.lineNo} row={item} main showSetNo={showSetNumber} imageSpan={span} imagePath={setImage} />
                            ) : null}
                            {detailRows.length > 0 ? (
                              <>
                                <tr>
                                  <td className="border border-slate-300 bg-slate-100 px-3 py-2 font-semibold text-slate-700" colSpan={18}>
                                    ↳ Chi tiết / phụ kiện / phụ phí của bộ cửa
                                  </td>
                                </tr>
                                {detailRows.map((row, index) => (
                                  <ReadRow
                                    key={row.id ?? `raw-${item.id}-${row.sourceRow ?? index}`}
                                    lineNo={null}
                                    row={row}
                                    showSetNo={showSetNumber}
                                    imageSpan={showMainRow ? 0 : (index === 0 ? itemRows : 0)}
                                    imagePath={setImage}
                                  />
                                ))}
                              </>
                            ) : null}
                          </>
                        );
                      })()}
                      {/* V105: ghi chú kỹ thuật in thành hàng riêng ở CUỐI bộ cửa, giống bản xuất Excel/PDF. */}
                      {itemNoteRows(item, detailRows, showMainRow).map((entry) => (
                        <tr key={entry.key} className="bg-rose-50/60">
                          <td className="whitespace-pre-line border border-slate-200 px-3 py-2 text-[10px] italic leading-snug text-red-600 xl:text-[11px]" colSpan={19}>
                            <span className="font-bold not-italic">
                              {showSetNumber && item.setNo ? `GHI CHÚ KỸ THUẬT (Bộ số ${item.setNo}):` : "GHI CHÚ KỸ THUẬT:"}
                            </span>{" "}
                            <span>{entry.note}</span>
                          </td>
                        </tr>
                      ))}
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

/** V105: các ghi chú kỹ thuật của 1 bộ cửa (dòng cửa + dòng phụ kiện đang hiển thị), in thành hàng riêng. */
function itemNoteRows(
  item: { id: number; note?: string | null },
  detailRows: Array<{ id?: number | null; note?: string | null; sourceRow?: number | null }>,
  showMainRow: boolean,
) {
  const rows: Array<{ key: string; note: string }> = [];
  const mainNote = cleanText(item.note);
  if (showMainRow && mainNote) rows.push({ key: `note-main-${item.id}`, note: mainNote });
  detailRows.forEach((row, index) => {
    const note = cleanText(row.note);
    if (note) rows.push({ key: `note-${item.id}-${row.id ?? row.sourceRow ?? index}`, note });
  });
  return rows;
}

/** V109: ảnh hiển thị ở ô merge của một bộ cửa — ưu tiên ảnh dòng cửa, chưa có thì lấy ảnh phụ kiện đầu tiên. */
function setImageOf(item: { imagePath?: string | null }, detailRows: Array<{ imagePath?: string | null }>) {
  const own = cleanText(item.imagePath);
  if (own) return own;
  const fromDetail = detailRows.map((row) => cleanText(row.imagePath)).find(Boolean);
  return fromDetail ?? null;
}

function cleanText(value: unknown) {
  if (value === null || value === undefined) return "";
  const text = String(value).trim();
  return text === "-" || text === "—" ? "" : text;
}

function ReadRow({ lineNo, row, main = false, showSetNo = false, imageSpan = 0, imagePath = null }: { lineNo: number | null; main?: boolean; showSetNo?: boolean; row: any; imageSpan?: number; imagePath?: string | null }) {
  return (
    <tr className={main ? "bg-cyan-50 font-medium" : "hover:bg-slate-50"}>
      <Td>{lineNo ?? ""}</Td><Td>{showSetNo ? (row.setNo || "") : ""}</Td><Td wide>{row.productName || ""}</Td><Td>{row.productCode || row.model || ""}</Td><Td wide>{row.panelInfo || ""}</Td>
      <Td>{row.openingDirection || ""}</Td><Td>{row.trimDirection || ""}</Td><Td>{row.paintColor || ""}</Td><Td>{row.heightMm ?? ""}</Td><Td>{row.widthMm ?? ""}</Td><Td>{row.frameMm ?? ""}</Td>
      <Td>{row.clearHeightMm ?? ""}</Td><Td>{row.clearWidthMm ?? ""}</Td><Td>{row.quantity ?? ""}</Td><Td>{row.unit || ""}</Td>{/* V74: dòng cửa hiển thị KHỐI LƯỢNG đến 2 số thập phân; dòng phụ kiện giữ tối đa 4. */}<Td>{main ? formatQuantity2(row.pricingQuantity) : formatNumber(row.pricingQuantity)}</Td><Td>{formatMoney(row.unitPrice)}</Td><Td>{formatMoney(row.amount)}</Td>
      {imageSpan > 0 ? (
        <td className="border border-slate-200 px-1 py-1.5 text-center align-middle" rowSpan={imageSpan}>
          {imagePath ? <ProductImage path={imagePath} /> : ""}
        </td>
      ) : null}
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
function statusLabel(value: string) { return orderStatusLabel(value); }
function importAction(value: string) { return value === "CREATED" ? "Tạo từ Excel" : value === "UPDATED" ? "Cập nhật từ Excel" : value === "REBUILT_DETAILS" ? "Khôi phục chi tiết từ Excel" : value; }
