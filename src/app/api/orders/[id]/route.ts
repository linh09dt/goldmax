import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { normalizeOrderPayload } from "@/lib/order-persistence";
import { resolveSetNumbers } from "@/lib/set-number";

export const runtime = "nodejs";

async function updateOrder(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const orderId = Number(id);
    if (!Number.isInteger(orderId)) {
      return NextResponse.json({ ok: false, error: "ID đơn hàng không hợp lệ." }, { status: 400 });
    }

    const normalized = normalizeOrderPayload(await request.json());
    const duplicate = await prisma.salesOrder.findFirst({
      where: { orderCode: normalized.orderCode, NOT: { id: orderId } },
      select: { id: true },
    });
    if (duplicate) {
      return NextResponse.json({ ok: false, error: "Mã đơn hàng đang được sử dụng bởi đơn khác." }, { status: 409 });
    }

    const exists = await prisma.salesOrder.findUnique({ where: { id: orderId }, select: { id: true } });
    if (!exists) return NextResponse.json({ ok: false, error: "Không tìm thấy đơn hàng." }, { status: 404 });

    const assignedSetNumbers = await prisma.$transaction(async (tx) => {
      await tx.salesOrder.update({
        where: { id: orderId },
        data: { orderCode: normalized.orderCode, ...normalized.orderData },
      });
      await tx.salesOrderRequirement.deleteMany({ where: { orderId } });
      await tx.salesOrderItem.deleteMany({ where: { orderId } });

      // V75: giữ nguyên Bộ số đã cấp; chỉ sinh số mới cho bộ cửa chưa có số khi
      // đơn ở trạng thái cho phép (Đã xác nhận / Đã chuyển sản xuất).
      const setNumbers = await resolveSetNumbers(tx, {
        status: normalized.orderData.status,
        incoming: normalized.items.map((item) => item.data.setNo),
      });

      for (const [index, item] of normalized.items.entries()) {
        const createdItem = await tx.salesOrderItem.create({
          data: { orderId, lineNo: item.lineNo, ...item.data, setNo: setNumbers[index] },
        });
        if (item.details.length) {
          await tx.salesOrderItemDetail.createMany({
            data: item.details.map((detail) => ({
              orderItemId: createdItem.id,
              rowOrder: detail.rowOrder,
              detailType: detail.detailType,
              ...detail.data,
            })),
          });
        }
      }

      if (normalized.requirements.length) {
        await tx.salesOrderRequirement.createMany({
          data: normalized.requirements.map((row) => ({ orderId, ...row })),
        });
      }

      return setNumbers;
    });

    return NextResponse.json({
      ok: true,
      id: orderId,
      orderCode: normalized.orderCode,
      setNumbers: assignedSetNumbers,
    });
  } catch (error) {
    console.error("Update order failed:", error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Không thể cập nhật đơn hàng." },
      { status: 400 },
    );
  }
}

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  return updateOrder(request, context);
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  return updateOrder(request, context);
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const orderId = Number(id);
    if (!Number.isInteger(orderId)) {
      return NextResponse.json({ ok: false, error: "ID đơn hàng không hợp lệ." }, { status: 400 });
    }

    const order = await prisma.salesOrder.findUnique({
      where: { id: orderId },
      select: { id: true, orderCode: true },
    });
    if (!order) {
      return NextResponse.json({ ok: false, error: "Không tìm thấy đơn hàng." }, { status: 404 });
    }

    await prisma.salesOrder.delete({ where: { id: orderId } });

    return NextResponse.json({ ok: true, id: order.id, orderCode: order.orderCode });
  } catch (error) {
    console.error("Delete order failed:", error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Không thể xóa đơn hàng." },
      { status: 400 },
    );
  }
}
