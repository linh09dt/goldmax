import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { normalizeCategoryUsage } from "@/lib/item-category";

export const runtime = "nodejs";

/** V135: sửa phân loại hàng hóa (đổi tên / cách dùng / thứ tự / trạng thái). Mã KHÔNG đổi. */
export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const categoryId = Number(id);
    if (!Number.isFinite(categoryId)) return NextResponse.json({ ok: false, error: "Phân loại không hợp lệ." }, { status: 400 });

    const current = await prisma.itemCategory.findUnique({ where: { id: categoryId } });
    if (!current) return NextResponse.json({ ok: false, error: "Không tìm thấy phân loại." }, { status: 404 });

    const body = (await request.json()) as { name?: unknown; usage?: unknown; separateGroup?: unknown; sortOrder?: unknown; active?: unknown };
    const name = body.name === undefined ? current.name : String(body.name ?? "").trim();
    if (!name) return NextResponse.json({ ok: false, error: "Tên phân loại không được để trống." }, { status: 400 });

    const category = await prisma.itemCategory.update({
      where: { id: categoryId },
      data: {
        name,
        usage: body.usage === undefined ? current.usage : normalizeCategoryUsage(body.usage),
        separateGroup: body.separateGroup === undefined ? current.separateGroup : body.separateGroup === true,
        sortOrder: Number.isFinite(Number(body.sortOrder)) ? Number(body.sortOrder) : current.sortOrder,
        active: body.active === undefined ? current.active : body.active !== false,
      },
    });
    return NextResponse.json({ ok: true, category });
  } catch (error) {
    console.error("Update item category failed:", error);
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Không thể cập nhật phân loại." }, { status: 400 });
  }
}

/** V135: xoá phân loại. Nếu còn hàng hóa đang dùng thì phải chuyển chúng sang phân loại khác (`?moveTo=CODE`). */
export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const categoryId = Number(id);
    if (!Number.isFinite(categoryId)) return NextResponse.json({ ok: false, error: "Phân loại không hợp lệ." }, { status: 400 });

    const current = await prisma.itemCategory.findUnique({ where: { id: categoryId } });
    if (!current) return NextResponse.json({ ok: false, error: "Không tìm thấy phân loại." }, { status: 404 });

    const url = new URL(request.url);
    const moveTo = (url.searchParams.get("moveTo") ?? "").trim().toLocaleUpperCase("vi-VN");

    const itemCount = await prisma.itemMaster.count({ where: { category: current.code } });
    if (itemCount > 0) {
      if (!moveTo) {
        return NextResponse.json(
          { ok: false, itemCount, error: `Còn ${itemCount} hàng hóa đang ở phân loại "${current.name}". Chọn phân loại thay thế để chuyển trước khi xoá.` },
          { status: 409 },
        );
      }
      if (moveTo === current.code) {
        return NextResponse.json({ ok: false, error: "Phân loại thay thế phải khác phân loại đang xoá." }, { status: 400 });
      }
      const target = await prisma.itemCategory.findUnique({ where: { code: moveTo }, select: { code: true, name: true } });
      if (!target) return NextResponse.json({ ok: false, error: "Phân loại thay thế không tồn tại." }, { status: 400 });

      await prisma.$transaction([
        prisma.itemMaster.updateMany({ where: { category: current.code }, data: { category: target.code } }),
        prisma.itemCategory.delete({ where: { id: categoryId } }),
      ]);
      return NextResponse.json({ ok: true, movedItems: itemCount, movedTo: target });
    }

    await prisma.itemCategory.delete({ where: { id: categoryId } });
    return NextResponse.json({ ok: true, movedItems: 0 });
  } catch (error) {
    console.error("Delete item category failed:", error);
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Không thể xoá phân loại." }, { status: 400 });
  }
}
