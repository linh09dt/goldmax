import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { loadItemCategories } from "@/lib/item-category-store";
import {
  normalizeCategoryCode,
  normalizeCategoryUsage,
  suggestCategoryCode,
} from "@/lib/item-category";

export const runtime = "nodejs";

/** V135: danh mục PHÂN LOẠI hàng hóa — đọc/ghi được từ tab Cấu hình (A3). */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const activeParam = url.searchParams.get("active");
  const categories = await loadItemCategories({ activeOnly: activeParam === "true" });
  const counts = await prisma.itemMaster.groupBy({ by: ["category"], _count: { _all: true } }).catch(() => []);
  const usageByCode = new Map(counts.map((row) => [row.category ?? "", row._count._all]));
  return NextResponse.json({
    ok: true,
    categories: categories.map((category) => ({ ...category, itemCount: usageByCode.get(category.code) ?? 0 })),
  });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { code?: unknown; name?: unknown; usage?: unknown; separateGroup?: unknown; sortOrder?: unknown };
    const name = String(body.name ?? "").trim();
    if (!name) return NextResponse.json({ ok: false, error: "Vui lòng nhập tên phân loại." }, { status: 400 });

    const code = normalizeCategoryCode(body.code) ?? suggestCategoryCode(name);
    const duplicated = await prisma.itemCategory.findUnique({ where: { code }, select: { id: true } });
    if (duplicated) {
      return NextResponse.json({ ok: false, error: `Mã phân loại "${code}" đã tồn tại. Đổi tên khác hoặc sửa mục đang có.` }, { status: 409 });
    }

    const maxOrder = await prisma.itemCategory.aggregate({ _max: { sortOrder: true } });
    const category = await prisma.itemCategory.create({
      data: {
        code,
        name,
        usage: normalizeCategoryUsage(body.usage),
        separateGroup: body.separateGroup === true,
        sortOrder: Number.isFinite(Number(body.sortOrder)) ? Number(body.sortOrder) : (maxOrder._max.sortOrder ?? 0) + 10,
        active: true,
      },
    });
    return NextResponse.json({ ok: true, category });
  } catch (error) {
    console.error("Create item category failed:", error);
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Không thể thêm phân loại." }, { status: 400 });
  }
}
