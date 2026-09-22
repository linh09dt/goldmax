import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseOrderWorkbook } from "@/lib/order-excel";
import { DEFAULT_DISCOUNT_PERCENT } from "@/lib/order-output";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_FILE_SIZE = 20 * 1024 * 1024;

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ ok: false, error: "Chưa chọn file Excel." }, { status: 400 });
    }

    if (!file.name.toLowerCase().endsWith(".xlsx")) {
      return NextResponse.json({ ok: false, error: "Hiện tại chỉ hỗ trợ file .xlsx." }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ ok: false, error: "File vượt quá giới hạn 20 MB." }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const fileHash = createHash("sha256").update(buffer).digest("hex");
    const parsed = await parseOrderWorkbook(buffer);

    const duplicate = await prisma.orderImport.findFirst({
      where: { fileHash, order: { orderCode: parsed.orderCode } },
      select: { id: true },
    });

    let rebuildDetails = false;
    if (duplicate) {
      const current = await prisma.salesOrder.findUnique({
        where: { orderCode: parsed.orderCode },
        select: {
          id: true,
          items: {
            select: {
              lineNo: true,
              _count: { select: { details: true } },
            },
          },
        },
      });

      const currentCounts = new Map(
        (current?.items ?? []).map((item) => [item.lineNo, item._count.details]),
      );
      rebuildDetails = parsed.items.some(
        (item) => (currentCounts.get(item.lineNo) ?? 0) !== item.details.length,
      );

      if (!rebuildDetails) {
        return NextResponse.json({
          ok: true,
          action: "SKIPPED_DUPLICATE",
          orderCode: parsed.orderCode,
          importedItems: parsed.items.length,
          message: "File này đã được nhập trước đó và dữ liệu chi tiết đã đầy đủ.",
        });
      }
    }

    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.salesOrder.findUnique({
        where: { orderCode: parsed.orderCode },
        select: { id: true },
      });

      const lineTotal = parsed.items.reduce((sum, item) => {
        const main = resolvedAmount(item);
        const details = item.details.reduce((detailSum, detail) => detailSum + resolvedAmount(detail), 0);
        return sum + main + details;
      }, 0);
      const shippingFee = Math.max(0, parsed.shippingFee ?? 0);
      const subtotal = roundMoney(lineTotal + shippingFee);
      const discountPercent = clampPercent(parsed.discountPercent ?? DEFAULT_DISCOUNT_PERCENT);
      const discountAmount = roundMoney((subtotal * discountPercent) / 100);
      const totalAfterDiscount = roundMoney(Math.max(0, subtotal - discountAmount));
      const depositAmount = Math.max(0, parsed.depositAmount ?? 0);
      const warehouseReceiptDeduction = Math.max(0, parsed.warehouseReceiptDeduction ?? 0);
      const deliveryPayment = roundMoney(Math.max(0, totalAfterDiscount - depositAmount - warehouseReceiptDeduction));

      const orderData = {
        customerCode: parsed.customerCode,
        customerName: parsed.customerName,
        salesEmployeeCode: parsed.salesEmployeeCode,
        orderDate: parsed.orderDate,
        requiredDeliveryDate: parsed.requiredDeliveryDate,
        receiverAddress: parsed.receiverAddress,
        deliveryKm: parsed.deliveryKm,
        region: parsed.region,
        groupNo: parsed.groupNo,
        excelUpdateDate: parsed.excelUpdateDate,
        formCode: parsed.formCode,
        formEffectiveDate: parsed.formEffectiveDate,
        shippingFee,
        subtotal,
        discountPercent,
        discountAmount,
        totalAfterDiscount,
        depositAmount,
        warehouseReceiptDeduction,
        deliveryPayment,
        sourceFileName: file.name,
        sourceFileHash: fileHash,
        lastImportedAt: new Date(),
      };

      const order = existing
        ? await tx.salesOrder.update({ where: { id: existing.id }, data: orderData })
        : await tx.salesOrder.create({ data: { orderCode: parsed.orderCode, ...orderData } });

      if (existing) {
        await tx.salesOrderRequirement.deleteMany({ where: { orderId: order.id } });
        await tx.salesOrderItem.deleteMany({ where: { orderId: order.id } });
      }

      for (const item of parsed.items) {
        const createdItem = await tx.salesOrderItem.create({
          data: {
            orderId: order.id,
            lineNo: item.lineNo,
            setNo: item.setNo,
            productName: item.productName,
            productCode: item.productCode,
            model: item.model,
            openingDirection: item.openingDirection,
            trimDirection: item.trimDirection,
            paintColor: item.paintColor,
            heightMm: item.heightMm,
            widthMm: item.widthMm,
            frameMm: item.frameMm,
            clearHeightMm: item.clearHeightMm,
            clearWidthMm: item.clearWidthMm,
            panelInfo: item.panelInfo,
            trimBarsPerSet: item.trimBarsPerSet,
            trimType: item.trimType,
            lockModel: item.lockModel,
            windowBars: item.windowBars,
            leavesPerSet: item.leavesPerSet,
            quantity: item.quantity,
            unit: item.unit,
            pricingQuantity: item.pricingQuantity,
            unitPrice: item.unitPrice,
            amount: item.amount,
            note: item.note,
            modelCheck: item.modelCheck,
            priceCheck: item.priceCheck,
            sourceRow: item.sourceRow,
            rawBlock: item.rawBlock,
          },
        });

        if (item.details.length > 0) {
          await tx.salesOrderItemDetail.createMany({
            data: item.details.map((detail) => ({
              orderItemId: createdItem.id,
              rowOrder: detail.rowOrder,
              detailType: detail.detailType,
              setNo: detail.setNo,
              productName: detail.productName,
              productCode: detail.productCode,
              model: detail.model,
              openingDirection: detail.openingDirection,
              trimDirection: detail.trimDirection,
              paintColor: detail.paintColor,
              heightMm: detail.heightMm,
              widthMm: detail.widthMm,
              frameMm: detail.frameMm,
              clearHeightMm: detail.clearHeightMm,
              clearWidthMm: detail.clearWidthMm,
              panelInfo: detail.panelInfo,
              trimBarsPerSet: detail.trimBarsPerSet,
              trimType: detail.trimType,
              lockModel: detail.lockModel,
              windowBars: detail.windowBars,
              leavesPerSet: detail.leavesPerSet,
              quantity: detail.quantity,
              unit: detail.unit,
              pricingQuantity: detail.pricingQuantity,
              unitPrice: detail.unitPrice,
              amount: detail.amount,
              note: detail.note,
              modelCheck: detail.modelCheck,
              priceCheck: detail.priceCheck,
              sourceRow: detail.sourceRow,
            })),
          });
        }
      }

      if (parsed.requirements.length > 0) {
        await tx.salesOrderRequirement.createMany({
          data: parsed.requirements.map((requirement) => ({
            orderId: order.id,
            code: requirement.code,
            questionText: requirement.questionText,
            answer: requirement.answer,
            note: requirement.note,
            sortOrder: requirement.sortOrder,
          })),
        });
      }

      const importAction = rebuildDetails ? "REBUILT_DETAILS" : existing ? "UPDATED" : "CREATED";

      await tx.orderImport.create({
        data: {
          orderId: order.id,
          fileName: file.name,
          fileHash,
          action: importAction,
          sheetName: parsed.sheetName,
          importedItems: parsed.items.length,
        },
      });

      return { id: order.id, action: importAction };
    });

    return NextResponse.json({
      ok: true,
      ...result,
      orderCode: parsed.orderCode,
      importedItems: parsed.items.length,
      customerCode: parsed.customerCode,
      customerName: parsed.customerName,
    });
  } catch (error) {
    console.error("Order import failed:", error);
    const message = error instanceof Error ? error.message : "Nhập Excel thất bại.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}


function resolvedAmount(row: { amount: number | null; pricingQuantity: number | null; unitPrice: number | null }) {
  if (row.amount !== null && row.amount !== undefined && row.amount > 0) return row.amount;
  return Math.max(0, row.pricingQuantity ?? 0) * Math.max(0, row.unitPrice ?? 0);
}
function clampPercent(value: number) {
  return Math.min(100, Math.max(0, value));
}

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
