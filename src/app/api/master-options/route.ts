import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { MASTER_OPTION_GROUPS, type MasterOptionGroupCode } from "@/lib/item-attribute-excel";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const group = (url.searchParams.get("group") ?? "").trim();
  const activeParam = url.searchParams.get("active");

  const items = await prisma.masterOption.findMany({
    where: {
      ...(group ? { groupCode: group } : {}),
      ...(activeParam === "true" ? { active: true } : activeParam === "false" ? { active: false } : {}),
    },
    orderBy: [{ groupCode: "asc" }, { sortOrder: "asc" }, { code: "asc" }],
  });

  return NextResponse.json({ ok: true, items, groups: MASTER_OPTION_GROUPS });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { groupCode?: unknown; code?: unknown; name?: unknown; sortOrder?: unknown; active?: unknown };
    const groupCode = requiredGroup(body.groupCode);
    const code = requiredText(body.code, "Mã giá trị");
    const name = String(body.name ?? code).trim() || code;
    const sortOrder = numberOrZero(body.sortOrder);

    const exists = await prisma.masterOption.findUnique({ where: { groupCode_code: { groupCode, code } }, select: { id: true } });
    if (exists) return NextResponse.json({ ok: false, error: "Giá trị này đã tồn tại trong nhóm." }, { status: 409 });

    const item = await prisma.masterOption.create({
      data: { groupCode, code, name, sortOrder, active: body.active !== false, source: "THU_CONG" },
    });
    return NextResponse.json({ ok: true, item });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Không thể thêm danh mục cấu hình." }, { status: 400 });
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
