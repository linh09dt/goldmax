import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { MASTER_OPTION_GROUPS, type MasterOptionGroupCode } from "@/lib/item-attribute-excel";

export const runtime = "nodejs";

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const optionId = Number(id);
    if (!Number.isInteger(optionId)) return NextResponse.json({ ok: false, error: "ID cấu hình không hợp lệ." }, { status: 400 });

    const body = (await request.json()) as { groupCode?: unknown; code?: unknown; name?: unknown; sortOrder?: unknown; active?: unknown };
    const groupCode = requiredGroup(body.groupCode);
    const code = requiredText(body.code, "Mã giá trị");
    const name = String(body.name ?? code).trim() || code;
    const sortOrder = numberOrZero(body.sortOrder);

    const duplicate = await prisma.masterOption.findFirst({
      where: { groupCode, code, NOT: { id: optionId } },
      select: { id: true },
    });
    if (duplicate) return NextResponse.json({ ok: false, error: "Mã giá trị đã tồn tại trong nhóm." }, { status: 409 });

    const item = await prisma.masterOption.update({
      where: { id: optionId },
      data: { groupCode, code, name, sortOrder, active: body.active !== false, source: "THU_CONG" },
    });
    return NextResponse.json({ ok: true, item });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Không thể cập nhật danh mục cấu hình." }, { status: 400 });
  }
}


export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const optionId = Number(id);
    if (!Number.isInteger(optionId)) return NextResponse.json({ ok: false, error: "ID cấu hình không hợp lệ." }, { status: 400 });

    const current = await prisma.masterOption.findUnique({ where: { id: optionId }, select: { id: true, groupCode: true } });
    if (!current) return NextResponse.json({ ok: false, error: "Không tìm thấy giá trị cấu hình." }, { status: 404 });
    if (current.groupCode !== "DEALER_CODE") {
      return NextResponse.json({ ok: false, error: "Chức năng xóa trực tiếp hiện chỉ áp dụng cho Mã Đại Lý." }, { status: 400 });
    }

    await prisma.masterOption.delete({ where: { id: optionId } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Không thể xóa Mã Đại Lý." }, { status: 400 });
  }
}

function requiredGroup(value: unknown) {
  const group = String(value ?? "").trim() as MasterOptionGroupCode;
  if (!(group in MASTER_OPTION_GROUPS)) throw new Error("Nhóm cấu hình không hợp lệ.");
  return group;
}
function requiredText(value: unknown, label: string) {
  const text = String(value ?? "").trim();
  if (!text) throw new Error(`${label} là bắt buộc.`);
  return text;
}
function numberOrZero(value: unknown) {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? Math.trunc(number) : 0;
}
