import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { calculateShipping, DEFAULT_SHIPPING_RATES } from "@/lib/shipping";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const orderId = Number(body?.orderId);
    const deliveryKm = nonNegative(body?.deliveryKm);
    const region = String(body?.region ?? "").trim();
    const mountainDistrict = Boolean(body?.mountainDistrict);

    if (!Number.isInteger(orderId) || orderId <= 0) {
      return NextResponse.json({ ok: false, error: "Đơn hàng không hợp lệ." }, { status: 400 });
    }
    if (!region) {
      return NextResponse.json({ ok: false, error: "Vui lòng chọn vùng miền." }, { status: 400 });
    }
    if (deliveryKm <= 0) {
      return NextResponse.json({ ok: false, error: "Quãng đường phải lớn hơn 0 km." }, { status: 400 });
    }

    const [order, persistedRates, persistedMappings, itemMasters] = await Promise.all([
      prisma.salesOrder.findUnique({
        where: { id: orderId },
        include: { items: { orderBy: { lineNo: "asc" }, include: { details: true } } },
      }),
      prisma.shippingRate.findMany({ where: { active: true } }),
      prisma.shippingModelMapping.findMany({ where: { active: true } }),
      prisma.itemMaster.findMany({
        where: { active: true },
        select: { code: true, name: true },
      }),
    ]);
    if (!order) return NextResponse.json({ ok: false, error: "Không tìm thấy đơn hàng." }, { status: 404 });

    const rates = persistedRates.length
      ? persistedRates.map((row) => ({
          id: row.id,
          doorGroup: row.doorGroup,
          modelName: row.modelName,
          modelCode: row.modelCode,
          quantityTier: row.quantityTier,
          northLe100: decimal(row.northLe100),
          north101To200: decimal(row.north101To200),
          northOver200: decimal(row.northOver200),
          central: decimal(row.central),
          active: row.active,
        }))
      : DEFAULT_SHIPPING_RATES;

    const tenhangByCode = new Map<string, string>();
    const tenhangByName = new Map<string, string>();
    for (const item of itemMasters) {
      const name = item.name.trim();
      if (!name) continue;
      tenhangByCode.set(normalizeKey(item.code), name);
      const nameKey = normalizeKey(name);
      if (!tenhangByName.has(nameKey)) tenhangByName.set(nameKey, name);
    }

    const calculation = calculateShipping({
      items: order.items.map((item) => ({
        lineNo: item.lineNo,
        setNo: item.setNo,
        productName: item.productName,
        productCode: item.productCode,
        model: item.model,
        tenhang: resolveTenhang(item, tenhangByCode, tenhangByName),
        quantity: item.quantity,
      })),
      rates,
      mappings: persistedMappings,
      region,
      deliveryKm,
      mountainDistrict,
    });

    if (calculation.missingRateCount > 0) {
      const error = calculation.missingMappingCount > 0
        ? "Còn TENHANG chưa được cấu hình vận chuyển."
        : "Còn Model tính cước chưa có bảng giá. Vui lòng bổ sung bảng tiêu chuẩn trước khi áp dụng.";
      return NextResponse.json({ ok: false, error }, { status: 400 });
    }

    const lineTotal = order.items.reduce((sum, item) => {
      const main = decimal(item.amount);
      const detail = item.details.reduce((s, row) => s + decimal(row.amount), 0);
      return sum + main + detail;
    }, 0);

    const shippingFee = calculation.roundedTotal;
    const discountPercent = clampPercent(decimal(order.discountPercent));
    const depositAmount = decimal(order.depositAmount);
    const warehouseReceiptDeduction = decimal(order.warehouseReceiptDeduction);
    const subtotal = roundMoney(lineTotal + shippingFee);
    const discountAmount = roundMoney((subtotal * discountPercent) / 100);
    const totalAfterDiscount = roundMoney(Math.max(0, subtotal - discountAmount));
    const deliveryPayment = roundMoney(Math.max(0, totalAfterDiscount - depositAmount - warehouseReceiptDeduction));

    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.salesOrder.update({
        where: { id: orderId },
        data: {
          shippingFee,
          deliveryKm,
          region,
          shippingMountainDistrict: mountainDistrict,
          shippingCalculatedAt: new Date(),
          subtotal,
          discountPercent,
          discountAmount,
          totalAfterDiscount,
          deliveryPayment,
        },
        select: { id: true, orderCode: true, shippingFee: true, subtotal: true, totalAfterDiscount: true, deliveryPayment: true },
      });

      await tx.shippingCalculation.create({
        data: {
          orderId,
          region,
          deliveryKm,
          mountainDistrict,
          bandLabel: calculation.bandLabel,
          supportKm: calculation.supportKm,
          rawTotal: calculation.rawTotal,
          roundedTotal: calculation.roundedTotal,
          lines: calculation.lines,
          source: persistedRates.length ? "MASTER_DATA" : "BANG_CUOC_EXCEL_2024",
        },
      });

      return result;
    });

    return NextResponse.json({
      ok: true,
      order: {
        ...updated,
        shippingFee: decimal(updated.shippingFee),
        subtotal: decimal(updated.subtotal),
        totalAfterDiscount: decimal(updated.totalAfterDiscount),
        deliveryPayment: decimal(updated.deliveryPayment),
      },
      calculation,
    });
  } catch (error) {
    console.error("Apply shipping fee failed:", error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Không thể áp dụng cước vận chuyển vào đơn hàng." },
      { status: 400 },
    );
  }
}

function clampPercent(value: number) {
  return Math.min(100, Math.max(0, value));
}
function decimal(value: unknown) {
  const parsed = Number(String(value ?? 0));
  return Number.isFinite(parsed) ? parsed : 0;
}
function nonNegative(value: unknown) {
  const parsed = Number(String(value ?? 0).replace(/,/g, ""));
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}
function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}


function resolveTenhang(
  item: { productCode: string | null; model: string | null; productName: string | null },
  tenhangByCode: Map<string, string>,
  tenhangByName: Map<string, string>,
) {
  const byProductCode = tenhangByCode.get(normalizeKey(item.productCode));
  if (byProductCode) return byProductCode;

  const byModel = tenhangByCode.get(normalizeKey(item.model));
  if (byModel) return byModel;

  return tenhangByName.get(normalizeKey(item.productName)) ?? null;
}

function normalizeKey(value: unknown) {
  return String(value ?? "").trim().toUpperCase().replace(/\s+/g, " ");
}
