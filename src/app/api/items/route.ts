import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { classifyItemByName, normalizeItemCategory } from "@/lib/item-category";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  const activeParam = url.searchParams.get("active");
  // V134: lọc theo phân loại hàng hóa (DOOR / ACCESSORY / PROCESSING).
  const categoryParam = normalizeItemCategory(url.searchParams.get("category"));
  const limit = Math.min(3000, Math.max(1, Number(url.searchParams.get("limit") ?? 1000) || 1000));

  const items = await prisma.itemMaster.findMany({
    where: {
      ...(activeParam === "true" ? { active: true } : activeParam === "false" ? { active: false } : {}),
      ...(categoryParam ? { category: categoryParam } : {}),
      ...(q ? {
        OR: [
          { code: { contains: q, mode: "insensitive" as const } },
          { name: { contains: q, mode: "insensitive" as const } },
          { productDescription: { contains: q, mode: "insensitive" as const } },
          { unit: { contains: q, mode: "insensitive" as const } },
        ],
      } : {}),
    },
    orderBy: [{ active: "desc" }, { name: "asc" }, { code: "asc" }],
    take: limit,
  });

  const [total, activeCount, inactiveCount, dealerPricedCount, retailPricedCount, imports] = await Promise.all([
    prisma.itemMaster.count(),
    prisma.itemMaster.count({ where: { active: true } }),
    prisma.itemMaster.count({ where: { active: false } }),
    prisma.itemMaster.count({ where: { dealerPrice: { not: null } } }),
    prisma.itemMaster.count({ where: { retailPrice: { not: null } } }),
    prisma.itemMasterImport.findMany({ orderBy: { importedAt: "desc" }, take: 10 }),
  ]);

  return NextResponse.json({
    ok: true,
    items,
    metrics: { total, activeCount, inactiveCount, dealerPricedCount, retailPricedCount },
    imports,
  });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      code?: unknown;
      name?: unknown;
      category?: unknown;
      productDescription?: unknown;
      unit?: unknown;
      dealerPrice?: unknown;
      retailPrice?: unknown;
      active?: unknown;
    };
    const code = requiredText(body.code, "MODEL");
    const name = requiredText(body.name, "TENHANG");

    const exists = await prisma.itemMaster.findUnique({ where: { code }, select: { id: true } });
    if (exists) return NextResponse.json({ ok: false, error: "MODEL đã tồn tại." }, { status: 409 });

    const item = await prisma.itemMaster.create({
      data: {
        code,
        name,
        // V134: người dùng chọn phân loại; không chọn thì đoán theo TENHANG.
        category: normalizeItemCategory(body.category) ?? classifyItemByName(name),
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
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Không thể thêm hàng hóa." }, { status: 400 });
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
