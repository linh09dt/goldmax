import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { normalizeOrderPayload } from "@/lib/order-persistence";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const normalized = normalizeOrderPayload(await request.json());

    const exists = await prisma.salesOrder.findUnique({
      where: { orderCode: normalized.orderCode },
      select: { id: true },
    });
    if (exists) {
      return NextResponse.json(
        { ok: false, error: "Mã đơn hàng đã tồn tại. Vui lòng dùng mã khác hoặc mở đơn hiện tại để chỉnh sửa." },
        { status: 409 },
      );
    }

    const order = await prisma.$transaction(async (tx) => {
      const created = await tx.salesOrder.create({
        data: { orderCode: normalized.orderCode, ...normalized.orderData },
      });

      for (const item of normalized.items) {
        const createdItem = await tx.salesOrderItem.create({
          data: { orderId: created.id, lineNo: item.lineNo, ...item.data },
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
          data: normalized.requirements.map((row) => ({ orderId: created.id, ...row })),
        });
      }

      return created;
    });

    return NextResponse.json({ ok: true, id: order.id, orderCode: order.orderCode });
  } catch (error) {
    console.error("Create order failed:", error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Không thể tạo đơn hàng." },
      { status: 400 },
    );
  }
}
