import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const itemId = Number(id);
    if (!Number.isInteger(itemId)) {
      return NextResponse.json({ ok: false, error: "ID hàng hóa không hợp lệ." }, { status: 400 });
    }

    const body = (await request.json()) as {
      code?: unknown;
      name?: unknown;
      productDescription?: unknown;
      unit?: unknown;
      dealerPrice?: unknown;
      retailPrice?: unknown;
      active?: unknown;
    };
    const code = requiredText(body.code, "MODEL");
    const name = requiredText(body.name, "TENHANG");

    const duplicate = await prisma.itemMaster.findFirst({
      where: { code, NOT: { id: itemId } },
      select: { id: true },
    });
    if (duplicate) {
      return NextResponse.json({ ok: false, error: "MODEL đang được sử dụng bởi hàng hóa khác." }, { status: 409 });
    }

    const item = await prisma.itemMaster.update({
      where: { id: itemId },
      data: {
        code,
        name,
        salesName: name,
        salesModel: code,
        productDescription: optionalText(body.productDescription),
        unit: optionalText(body.unit),
        dealerPrice: decimalOrNull(body.dealerPrice, "Giá đại lý"),
        retailPrice: decimalOrNull(body.retailPrice, "Giá bán lẻ"),
        active: body.active !== false,
        source: "THU_CONG",
      },
    });

    return NextResponse.json({ ok: true, item });
  } catch (error) {
    console.error("Update item master failed:", error);
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Không thể cập nhật hàng hóa." }, { status: 400 });
  }
}


export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const itemId = Number(id);
    if (!Number.isInteger(itemId)) {
      return NextResponse.json({ ok: false, error: "ID hàng hóa không hợp lệ." }, { status: 400 });
    }

    const existing = await prisma.itemMaster.findUnique({
      where: { id: itemId },
      select: { id: true, code: true, name: true },
    });
    if (!existing) {
      return NextResponse.json({ ok: false, error: "Hàng hóa không còn tồn tại." }, { status: 404 });
    }

    await prisma.itemMaster.delete({ where: { id: itemId } });

    return NextResponse.json({
      ok: true,
      deleted: existing,
      message: `Đã xóa ${existing.code} - ${existing.name}.`,
    });
  } catch (error) {
    console.error("Delete item master failed:", error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Không thể xóa hàng hóa." },
      { status: 400 },
    );
  }
}

function requiredText(value: unknown, label: string) {
  const text = String(value ?? "").trim();
  if (!text) throw new Error(`${label} là bắt buộc.`);
  return text;
}

function optionalText(value: unknown) {
  const text = String(value ?? "").trim();
  return text || null;
}

function decimalOrNull(value: unknown, label: string) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const normalized = raw.replaceAll(".", "").replaceAll(",", "").replace(/\s/g, "");
  const number = Number(normalized);
  if (!Number.isFinite(number) || number < 0) throw new Error(`${label} không hợp lệ.`);
  return number.toFixed(2);
}
