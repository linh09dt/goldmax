import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { normalizeOrderPayload } from "@/lib/order-persistence";
import { resolveSetNumbers } from "@/lib/set-number";
import { ORDER_WRITE_TRANSACTION } from "@/lib/db-transaction";

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

    // V111: mỗi BẢNG một lượt ghi (createManyAndReturn + createMany) thay vì create từng dòng.
    // Đo thực tế: 25 bộ cửa trước đây = 61 lượt round trip; Prisma KHÔNG gộp nested write khi
    // dùng driver adapter nên phải gom theo bảng. Sau khi gom: ~8 lượt, không phụ thuộc số bộ cửa.
    // (Với DB remote ~85 ms/lượt, 61 lượt ≈ 5,2 giây > hạn mức 5 giây của transaction → lỗi
    // "A query cannot be executed on an expired transaction".)
    const { order, setNumbers } = await prisma.$transaction(async (tx) => {
      // Bộ số phải chốt trước khi ghi và nằm trong cùng transaction để không cấp trùng.
      const assignedSetNumbers = await resolveSetNumbers(tx, {
        status: normalized.orderData.status,
        incoming: normalized.items.map((item) => item.data.setNo),
      });

      const created = await tx.salesOrder.create({
        data: { orderCode: normalized.orderCode, ...normalized.orderData },
        select: { id: true, orderCode: true },
      });

      const createdItems = await tx.salesOrderItem.createManyAndReturn({
        data: normalized.items.map((item, index) => ({
          orderId: created.id,
          lineNo: item.lineNo,
          ...item.data,
          setNo: assignedSetNumbers[index] ?? null,
        })),
        select: { id: true, lineNo: true },
      });

      const idByLineNo = new Map(createdItems.map((row) => [row.lineNo, row.id]));
      const details = normalized.items.flatMap((item) =>
        item.details.map((detail) => ({
          orderItemId: idByLineNo.get(item.lineNo) as number,
          rowOrder: detail.rowOrder,
          detailType: detail.detailType,
          ...detail.data,
        })),
      );
      if (details.length) await tx.salesOrderItemDetail.createMany({ data: details });

      if (normalized.requirements.length) {
        await tx.salesOrderRequirement.createMany({
          data: normalized.requirements.map((row) => ({ orderId: created.id, ...row })),
        });
      }

      return { order: created, setNumbers: assignedSetNumbers };
    }, ORDER_WRITE_TRANSACTION);

    return NextResponse.json({ ok: true, id: order.id, orderCode: order.orderCode, setNumbers });
  } catch (error) {
    console.error("Create order failed:", error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Không thể tạo đơn hàng." },
      { status: 400 },
    );
  }
}
