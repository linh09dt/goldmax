import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { normalizeOrderPayload } from "@/lib/order-persistence";
import { resolveSetNumbers } from "@/lib/set-number";

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

    const { order, setNumbers } = await prisma.$transaction(async (tx) => {
      const created = await tx.salesOrder.create({
        data: { orderCode: normalized.orderCode, ...normalized.orderData },
      });

      // V75/V91: Bộ số tự tăng dần — chỉ cấp khi đơn ở trạng thái Sản xuất (bấm Lưu đơn hàng).
      const assignedSetNumbers = await resolveSetNumbers(tx, {
        status: normalized.orderData.status,
        incoming: normalized.items.map((item) => item.data.setNo),
      });

      for (const [index, item] of normalized.items.entries()) {
        const createdItem = await tx.salesOrderItem.create({
          data: { orderId: created.id, lineNo: item.lineNo, ...item.data, setNo: assignedSetNumbers[index] },
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

      return { order: created, setNumbers: assignedSetNumbers };
    });

    return NextResponse.json({ ok: true, id: order.id, orderCode: order.orderCode, setNumbers });
  } catch (error) {
    console.error("Create order failed:", error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Không thể tạo đơn hàng." },
      { status: 400 },
    );
  }
}
