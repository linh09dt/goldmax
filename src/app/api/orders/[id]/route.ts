import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { normalizeOrderPayload } from "@/lib/order-persistence";

export const runtime = "nodejs";

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
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

    await prisma.$transaction(async (tx) => {
      await tx.salesOrder.update({
        where: { id: orderId },
        data: { orderCode: normalized.orderCode, ...normalized.orderData },
      });
      await tx.salesOrderRequirement.deleteMany({ where: { orderId } });
      await tx.salesOrderItem.deleteMany({ where: { orderId } });

      for (const item of normalized.items) {
        const createdItem = await tx.salesOrderItem.create({
          data: { orderId, lineNo: item.lineNo, ...item.data },
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
    });

    return NextResponse.json({ ok: true, id: orderId, orderCode: normalized.orderCode });
  } catch (error) {
    console.error("Update order failed:", error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Không thể cập nhật đơn hàng." },
      { status: 400 },
    );
  }
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
