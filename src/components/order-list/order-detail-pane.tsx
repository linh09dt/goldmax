import Link from "next/link";
import { OrderDeleteButton } from "@/components/order-delete-button";
import { OrderExportButtons } from "@/components/order-export-buttons";
import { isProductionStatus, orderStatusLabel, showsSetNumber } from "@/lib/order-form";
import { formatDate, formatDecimal, formatMoney, formatNumber, textOrDash } from "@/components/order-list/format";

/**
 * V100: cột PHẢI của màn Quản lý đơn hàng (dạng chia 2 cột) — chi tiết đơn đang chọn.
 * Bảng hàng hóa ở đây hiển thị các cột chính; bảng đầy đủ 23 cột vẫn nằm ở trang chi tiết đơn
 * và ở file Excel xuất ra.
 */

export type OrderDetailLine = {
  id: number;
  setNo: string | null;
  productCode: string | null;
  model: string | null;
  productName: string | null;
  unit: string | null;
  quantity: number | null;
  heightMm: number | null;
  widthMm: number | null;
  frameMm: number | null;
  openingDirection: string | null;
  paintColor: string | null;
  pricingQuantity: number | null;
  unitPrice: unknown;
  amount: unknown;
  note: string | null;
  details?: OrderDetailLine[];
};

export type OrderDetailData = {
  id: number;
  orderCode: string;
  status: string;
  orderDate: Date | null;
  requiredDeliveryDate: Date | null;
  customerName: string | null;
  customerCode: string | null;
  salesEmployeeCode: string | null;
  receiverName: string | null;
  receiverPhone: string | null;
  receiverAddress: string | null;
  deliveryKm: number | null;
  region: string | null;
  subtotal: unknown;
  totalAfterDiscount: unknown;
  depositAmount: unknown;
  deliveryPayment: unknown;
  items: OrderDetailLine[];
};

export function OrderDetailPane({ order }: { order: OrderDetailData | null }) {
  if (!order) {
    return (
      <section className="erp-card flex min-h-[640px] items-center justify-center p-8 text-center text-slate-500">
        <div>
          <div className="text-[13px] font-semibold">Chọn một đơn ở cột bên trái</div>
          <div className="mt-1 text-[11.5px]">Chi tiết đơn sẽ hiện ngay tại đây, không cần mở trang mới.</div>
        </div>
      </section>
    );
  }

  const quantityTotal = order.items.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
  const detailCount = order.items.reduce((sum, item) => sum + (item.details?.length ?? 0), 0);

  return (
    <section className="erp-card flex min-h-[640px] flex-col overflow-hidden">
      {/* Đầu trang: mã đơn + trạng thái + thao tác */}
      <div className="flex flex-wrap items-start justify-between gap-2 border-b border-slate-200 px-3 py-2.5">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Link className="text-[15px] font-bold text-cyan-700 hover:underline" href={`/orders/${order.id}`}>{order.orderCode}</Link>
            <StatusBadge value={order.status} />
          </div>
          <div className="mt-1 text-[11.5px] text-slate-600">
            Đặt {formatDate(order.orderDate)} · Hạn giao <b className="text-slate-800">{formatDate(order.requiredDeliveryDate)}</b>
            {order.salesEmployeeCode ? <> · NVKD: <b className="text-slate-800">{order.salesEmployeeCode}</b></> : null}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <Link className="erp-button-secondary h-8 px-2.5 text-[11px]" href={`/orders/${order.id}/edit`}>Sửa đơn</Link>
          <OrderExportButtons orderId={order.id} compact />
          <OrderDeleteButton orderId={order.id} orderCode={order.orderCode} compact />
        </div>
      </div>

      {/* Thông tin nhận hàng */}
      <div className="grid gap-2 border-b border-slate-200 bg-[#fbfdff] px-3 py-2.5 sm:grid-cols-2 xl:grid-cols-4">
        <DetailField label="Khách hàng" value={`${textOrDash(order.customerName)}${order.customerCode ? ` (${order.customerCode})` : ""}`} />
        <DetailField label="Người nhận" value={`${textOrDash(order.receiverName)}${order.receiverPhone ? ` · ${order.receiverPhone}` : ""}`} />
        <DetailField label="Địa chỉ nhận hàng" value={textOrDash(order.receiverAddress)} />
        <DetailField
          label="Số km / Vùng miền"
          value={`${order.deliveryKm !== null && Number.isFinite(order.deliveryKm) ? `${formatNumber(order.deliveryKm)} km` : "—"}${order.region ? ` · ${order.region}` : ""}`}
        />
      </div>

      {/* Tổng hợp */}
      <div className="grid grid-cols-2 gap-2 border-b border-slate-200 px-3 py-2.5 xl:grid-cols-4">
        <TotalBox label="Bộ cửa" value={formatNumber(order.items.length)} />
        <TotalBox label="Số lượng" value={formatNumber(quantityTotal)} hint={detailCount > 0 ? `${detailCount} phụ kiện` : undefined} />
        <TotalBox label="Tổng tiền hàng" value={formatMoney(order.totalAfterDiscount ?? order.subtotal)} emphasis />
        <TotalBox label="Còn phải thu" value={formatMoney(order.deliveryPayment)} hint={order.depositAmount ? `Đã cọc ${formatMoney(order.depositAmount)}` : undefined} />
      </div>

      {/* Bảng hàng hóa */}
      <div className="border-b border-slate-200 px-3 py-2 text-[10.5px] font-bold uppercase tracking-wide text-cyan-700">
        Hàng hóa ({order.items.length} bộ cửa{detailCount > 0 ? ` · ${detailCount} phụ kiện` : ""})
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        <table className="w-full table-fixed border-collapse text-[11px]">
          <colgroup>
            {[20, 8, 5, 7, 7, 6, 7, 8, 7, 5, 9, 10, 11].map((width, index) => (
              <col key={index} style={{ width: `${width}%` }} />
            ))}
          </colgroup>
          <thead className="sticky top-0 z-10 bg-slate-900 text-left text-[9.5px] uppercase tracking-tight text-slate-200">
            <tr>
              <th className="px-2 py-1.5">Mã hàng</th>
              <th className="px-1 py-1.5">Bộ số</th>
              <th className="px-1 py-1.5 text-right">SL</th>
              <th className="px-1 py-1.5 text-right">Cao</th>
              <th className="px-1 py-1.5 text-right">Rộng</th>
              <th className="px-1 py-1.5 text-right">Khuôn</th>
              <th className="px-1 py-1.5">Hướng mở</th>
              <th className="px-1 py-1.5">Màu sơn</th>
              <th className="px-1 py-1.5 text-right">KH/L</th>
              <th className="px-1 py-1.5">ĐVT</th>
              <th className="px-1 py-1.5 text-right">Đơn giá</th>
              <th className="px-1 py-1.5 text-right">Thành tiền</th>
              <th className="px-1 py-1.5">Ghi chú</th>
            </tr>
          </thead>
          <tbody>
            {order.items.length === 0 ? (
              <tr>
                <td className="px-2 py-6 text-center text-slate-500" colSpan={13}>Đơn chưa có hàng hóa.</td>
              </tr>
            ) : null}
            {order.items.flatMap((item, itemIndex) => {
              const rows = [
                <ItemRow key={`main-${item.id}`} line={item} main showSetNumber={showsSetNumber(order.status)} topBorder={itemIndex > 0} />,
                ...(item.details ?? []).map((detail) => (
                  <ItemRow key={`detail-${detail.id}`} line={detail} main={false} showSetNumber={showsSetNumber(order.status)} topBorder={false} />
                )),
              ];
              return rows;
            })}
          </tbody>
        </table>
      </div>

      {/* Chân trang */}
      <div className="flex flex-wrap items-center gap-2 border-t border-slate-200 bg-slate-50 px-3 py-2">
        <Link className="erp-button-secondary h-8 px-2.5 text-[11px]" href={`/orders/${order.id}/print`}>In / Lưu PDF</Link>
        <Link className="erp-button-secondary h-8 px-2.5 text-[11px]" href={`/orders/${order.id}`}>Xem đầy đủ 23 cột</Link>
        <span className="text-[11px] text-slate-500">Bấm đơn ở cột trái để đổi đơn đang xem — không cần rời trang.</span>
      </div>
    </section>
  );
}

function StatusBadge({ value }: { value: string }) {
  const label = orderStatusLabel(value);
  const style = isProductionStatus(value)
    ? "border-emerald-300 bg-emerald-50 text-emerald-800"
    : label === "Đã hủy"
      ? "border-red-300 bg-red-50 text-red-700"
      : "border-slate-300 bg-slate-100 text-slate-700";
  return <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10.5px] font-bold ${style}`}>● {label}</span>;
}

function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <div className="text-[9.5px] font-bold uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-0.5 break-words font-semibold text-slate-800" title={value}>{value}</div>
    </div>
  );
}

function TotalBox({ label, value, hint, emphasis = false }: { label: string; value: string; hint?: string; emphasis?: boolean }) {
  return (
    <div className={`rounded-lg border px-2.5 py-1.5 ${emphasis ? "border-cyan-200 bg-cyan-50" : "border-slate-200 bg-white"}`}>
      <div className="text-[9.5px] font-bold uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-0.5 text-[15px] font-bold tabular-nums text-slate-900">{value}</div>
      {hint ? <div className="text-[10.5px] text-slate-500">{hint}</div> : null}
    </div>
  );
}

function ItemRow({
  line,
  main,
  showSetNumber,
  topBorder,
}: {
  line: OrderDetailLine;
  main: boolean;
  showSetNumber: boolean;
  topBorder: boolean;
}) {
  const top = topBorder ? "border-t-2 border-slate-200" : "";
  return (
    <tr className={`${main ? "bg-white font-semibold text-slate-900" : "bg-slate-50/70 text-slate-700"} ${top}`}>
      <td className={`px-2 py-1.5 align-top ${main ? "" : "pl-4"}`}>
        <div className="break-words">{textOrDash(line.productCode || line.model || line.productName)}</div>
        {line.productName && line.productCode && line.productName !== line.productCode ? (
          <div className="text-[10px] font-normal text-slate-500">{line.productName}</div>
        ) : null}
      </td>
      <td className="px-1 py-1.5 text-center tabular-nums">{showSetNumber && line.setNo ? line.setNo : "—"}</td>
      <td className="px-1 py-1.5 text-right tabular-nums">{formatNumber(line.quantity)}</td>
      <td className="px-1 py-1.5 text-right tabular-nums">{formatNumber(line.heightMm)}</td>
      <td className="px-1 py-1.5 text-right tabular-nums">{formatNumber(line.widthMm)}</td>
      <td className="px-1 py-1.5 text-right tabular-nums">{formatNumber(line.frameMm)}</td>
      <td className="px-1 py-1.5">{textOrDash(line.openingDirection)}</td>
      <td className="px-1 py-1.5">{textOrDash(line.paintColor)}</td>
      <td className="px-1 py-1.5 text-right tabular-nums">{formatDecimal(line.pricingQuantity)}</td>
      <td className="px-1 py-1.5">{textOrDash(line.unit)}</td>
      <td className="px-1 py-1.5 text-right tabular-nums">{formatMoney(line.unitPrice)}</td>
      <td className="px-1 py-1.5 text-right font-bold tabular-nums">{formatMoney(line.amount)}</td>
      <td className="px-1 py-1.5"><span className="break-words">{textOrDash(line.note)}</span></td>
    </tr>
  );
}
