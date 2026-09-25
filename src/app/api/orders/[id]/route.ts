import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { normalizeOrderPayload } from "@/lib/order-persistence";
import { resolveSetNumbers } from "@/lib/set-number";
import { ORDER_WRITE_TRANSACTION } from "@/lib/db-transaction";
import { isConfirmedStatus } from "@/lib/order-form";

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

    // V111: xóa hàng cũ rồi mỗi BẢNG một lượt ghi (createManyAndReturn + createMany) thay vì
    // create từng dòng — trước đây mỗi bộ cửa là 2 lượt round trip nên đơn lớn vượt hạn mức
    // 5 giây của transaction khi DB ở xa ("expired transaction").
    const assignedSetNumbers = await prisma.$transaction(async (tx) => {
      // V112: đọc trạng thái + Bộ số hiện có TRƯỚC khi xoá để hai việc dưới đây không phụ thuộc client:
      //  - không cho hạ cấp đơn đã xác nhận về nháp;
      //  - giữ nguyên Bộ số đã cấp kể cả khi payload không gửi kèm.
      const current = await tx.salesOrder.findUnique({
        where: { id: orderId },
        select: { status: true },
      });
      const existingItems = await tx.salesOrderItem.findMany({
        where: { orderId },
        select: { lineNo: true, setNo: true },
      });
      const keptSetNoByLineNo = new Map(existingItems.map((item) => [item.lineNo, item.setNo]));

      const incomingStatus = normalized.orderData.status;
      const nextStatus = isConfirmedStatus(current?.status) && !isConfirmedStatus(incomingStatus)
        ? String(current?.status)
        : incomingStatus;

      // V75/V91/V112: giữ nguyên Bộ số đã cấp; chỉ sinh số mới cho bộ cửa chưa có số
      // khi đơn đã xác nhận (bấm Lưu đơn hàng).
      const setNumbers = await resolveSetNumbers(tx, {
        status: nextStatus,
        incoming: normalized.items.map((item) => item.data.setNo ?? keptSetNoByLineNo.get(item.lineNo) ?? null),
      });

      await tx.salesOrderRequirement.deleteMany({ where: { orderId } });
      await tx.salesOrderItem.deleteMany({ where: { orderId } });

      await tx.salesOrder.update({
        where: { id: orderId },
        data: { orderCode: normalized.orderCode, ...normalized.orderData, status: nextStatus },
      });

      const createdItems = await tx.salesOrderItem.createManyAndReturn({
        data: normalized.items.map((item, index) => ({
          orderId,
          lineNo: item.lineNo,
          ...item.data,
          setNo: setNumbers[index] ?? null,
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
          data: normalized.requirements.map((row) => ({ orderId, ...row })),
        });
      }

      return setNumbers;
    }, ORDER_WRITE_TRANSACTION);

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
