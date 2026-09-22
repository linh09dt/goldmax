import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET() {
  const rows = await prisma.shippingModelMapping.findMany({
    orderBy: [{ active: "desc" }, { sourceModel: "asc" }],
  });

  return NextResponse.json({ ok: true, rows });
}

export async function POST(request: Request) {
  try {
    const body: unknown = await request.json();
    const rawRows: unknown[] =
      body && typeof body === "object" && "rows" in body && Array.isArray((body as { rows?: unknown }).rows)
        ? (body as { rows: unknown[] }).rows
        : [];

    const rows = rawRows
      .map((raw) => {
        const source = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
        return {
          sourceModel: text(source.sourceModel),
          shippingModelCode: text(source.shippingModelCode).toUpperCase(),
          note: optionalText(source.note),
          active: source.active !== false,
        };
      })
      .filter((row) => row.sourceModel || row.shippingModelCode);

    const incomplete = rows.find((row) => !row.sourceModel || !row.shippingModelCode);
    if (incomplete) {
      return NextResponse.json(
        { ok: false, error: "Mỗi cấu hình phải có TENHANG và Model tính cước." },
        { status: 400 },
      );
    }

    const uniqueSources = new Set<string>();
    for (const row of rows) {
      const sourceKey = normalizeText(row.sourceModel);
      if (uniqueSources.has(sourceKey)) {
        return NextResponse.json(
          { ok: false, error: `TENHANG ${row.sourceModel} đang bị cấu hình trùng.` },
          { status: 400 },
        );
      }
      uniqueSources.add(sourceKey);
    }

    await prisma.$transaction(async (tx) => {
      await tx.shippingModelMapping.deleteMany({
        where: rows.length ? { sourceModel: { notIn: rows.map((row) => row.sourceModel) } } : {},
      });

      for (const row of rows) {
        await tx.shippingModelMapping.upsert({
          where: { sourceModel: row.sourceModel },
          create: row,
          update: {
            shippingModelCode: row.shippingModelCode,
            note: row.note,
            active: row.active,
          },
        });
      }
    });

    const saved = await prisma.shippingModelMapping.findMany({
      orderBy: [{ active: "desc" }, { sourceModel: "asc" }],
    });
    return NextResponse.json({ ok: true, rows: saved });
  } catch (error) {
    console.error("Save shipping model mappings failed:", error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Không thể lưu cấu hình TENHANG vận chuyển." },
      { status: 400 },
    );
  }
}

function text(value: unknown) {
  return String(value ?? "").trim();
}

function optionalText(value: unknown) {
  const valueText = text(value);
  return valueText || null;
}

function normalizeText(value: unknown) {
  return String(value ?? "").trim().toUpperCase().replace(/\s+/g, " ");
}
