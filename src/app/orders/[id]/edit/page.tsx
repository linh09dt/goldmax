import Link from "next/link";
import { notFound } from "next/navigation";
import { ErpShell } from "@/components/erp-shell";
import { OrderForm } from "@/components/order-form";
import { prisma } from "@/lib/prisma";
import { resolveOrderItemDetails } from "@/lib/order-detail";
import { newClientId, toDateInput, type OrderFormData } from "@/lib/order-form";

export const dynamic = "force-dynamic";

export default async function EditOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
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

  const initialData: OrderFormData = {
    orderCode: order.orderCode,
    status: order.status,
    customerCode: order.customerCode ?? "",
    customerName: order.customerName ?? "",
    salesEmployeeCode: order.salesEmployeeCode ?? "",
    orderDate: toDateInput(order.orderDate),
    requiredDeliveryDate: toDateInput(order.requiredDeliveryDate),
    receiverName: order.receiverName ?? "",
    receiverPhone: order.receiverPhone ?? "",
    receiverAddress: order.receiverAddress ?? "",
    deliveryKm: textNumber(order.deliveryKm),
    region: order.region ?? "",
    groupNo: textNumber(order.groupNo),
    excelUpdateDate: toDateInput(order.excelUpdateDate),
    formCode: order.formCode ?? "",
    formEffectiveDate: toDateInput(order.formEffectiveDate),
    shippingFee: textNumber(order.shippingFee),
    discountPercent: textNumber(order.discountPercent),
    depositAmount: textNumber(order.depositAmount),
    warehouseReceiptDeduction: textNumber(order.warehouseReceiptDeduction),
    requirements: order.requirements.map((row) => ({
      code: row.code,
      questionText: row.questionText,
      answer: row.answer ?? "",
      note: row.note ?? "",
      sortOrder: row.sortOrder,
    })),
    items: order.items.map((item) => ({
      clientId: newClientId(),
      lineNo: item.lineNo,
      ...lineToForm(item),
      details: resolveOrderItemDetails(item).map((row, index) => ({
        rowOrder: row.rowOrder || index + 1,
        detailType: row.detailType ?? "",
        ...lineToForm(row),
      })),
    })),
  };

  return (
    <ErpShell
      title={`Chỉnh sửa đơn ${order.orderCode}`}
      actions={<Link className="erp-button-secondary" href={`/orders/${order.id}`}>← Chi tiết đơn</Link>}
    >
      <OrderForm mode="edit" orderId={order.id} initialData={initialData} />
    </ErpShell>
  );
}

function lineToForm(line: {
  setNo: string | null; productName: string | null; productCode: string | null; model: string | null; openingDirection: string | null;
  trimDirection: string | null; paintColor: string | null; heightMm: number | null; widthMm: number | null; frameMm: number | null;
  clearHeightMm: number | null; clearWidthMm: number | null; panelInfo: string | null; trimBarsPerSet: number | null; trimType: string | null;
  lockModel: string | null; windowBars: string | null; leavesPerSet: number | null; quantity: number | null; unit: string | null;
  pricingQuantity: number | null; unitPrice: unknown; amount: unknown; note: string | null; imagePath: string | null; modelCheck: string | null; priceCheck: string | null;
}) {
  return {
    setNo: line.setNo ?? "", productName: line.productName ?? "", productCode: line.productCode ?? "", model: line.model ?? "",
    openingDirection: line.openingDirection ?? "", trimDirection: line.trimDirection ?? "", paintColor: line.paintColor ?? "",
    heightMm: textNumber(line.heightMm), widthMm: textNumber(line.widthMm), frameMm: textNumber(line.frameMm), clearHeightMm: textNumber(line.clearHeightMm), clearWidthMm: textNumber(line.clearWidthMm),
    panelInfo: line.panelInfo ?? "", trimBarsPerSet: textNumber(line.trimBarsPerSet), trimType: line.trimType ?? "", lockModel: line.lockModel ?? "", windowBars: line.windowBars ?? "",
    leavesPerSet: textNumber(line.leavesPerSet), quantity: textNumber(line.quantity), unit: line.unit ?? "", pricingQuantity: textNumber(line.pricingQuantity),
    unitPrice: textNumber(line.unitPrice), amount: textNumber(line.amount), note: line.note ?? "", imagePath: line.imagePath ?? "", modelCheck: line.modelCheck ?? "", priceCheck: line.priceCheck ?? "",
  };
}

function textNumber(value: unknown) {
  if (value === null || value === undefined) return "";
  return String(value);
}
