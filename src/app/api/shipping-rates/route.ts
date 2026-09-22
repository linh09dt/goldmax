import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { DEFAULT_SHIPPING_RATES } from "@/lib/shipping";

export const runtime = "nodejs";

export async function GET() {
  const rows = await prisma.shippingRate.findMany({
    orderBy: [{ doorGroup: "asc" }, { modelCode: "asc" }, { quantityTier: "asc" }],
  });

  return NextResponse.json({
    ok: true,
    persisted: rows.length > 0,
    rows: rows.length > 0 ? rows.map(serialize) : DEFAULT_SHIPPING_RATES,
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const rows = Array.isArray(body?.rows) ? body.rows : [];
    if (!rows.length) {
      return NextResponse.json({ ok: false, error: "Không có dữ liệu bảng giá để lưu." }, { status: 400 });
    }

    await prisma.$transaction(async (tx) => {
      for (const raw of rows) {
        const modelCode = text(raw.modelCode).toUpperCase();
        const quantityTier = Math.trunc(number(raw.quantityTier));
        if (!modelCode || ![1, 2].includes(quantityTier)) continue;

        await tx.shippingRate.upsert({
          where: { modelCode_quantityTier: { modelCode, quantityTier } },
          create: {
            doorGroup: text(raw.doorGroup) || "KHÁC",
            modelName: text(raw.modelName) || modelCode,
            modelCode,
            quantityTier,
            northLe100: money(raw.northLe100),
            north101To200: money(raw.north101To200),
            northOver200: money(raw.northOver200),
            central: money(raw.central),
            active: raw.active !== false,
            source: "EXCEL_2024",
          },
          update: {
            doorGroup: text(raw.doorGroup) || "KHÁC",
            modelName: text(raw.modelName) || modelCode,
            northLe100: money(raw.northLe100),
            north101To200: money(raw.north101To200),
            northOver200: money(raw.northOver200),
            central: money(raw.central),
            active: raw.active !== false,
          },
        });
      }
    });

    const saved = await prisma.shippingRate.findMany({
      orderBy: [{ doorGroup: "asc" }, { modelCode: "asc" }, { quantityTier: "asc" }],
    });
    return NextResponse.json({ ok: true, rows: saved.map(serialize) });
  } catch (error) {
    console.error("Save shipping rates failed:", error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Không thể lưu bảng giá cước vận chuyển." },
      { status: 400 },
    );
  }
}

function serialize(row: {
  id: number;
  doorGroup: string;
  modelName: string;
  modelCode: string;
  quantityTier: number;
  northLe100: unknown;
  north101To200: unknown;
  northOver200: unknown;
  central: unknown;
  active: boolean;
}) {
  return {
    id: row.id,
    doorGroup: row.doorGroup,
    modelName: row.modelName,
    modelCode: row.modelCode,
    quantityTier: row.quantityTier,
    northLe100: Number(String(row.northLe100)),
    north101To200: Number(String(row.north101To200)),
    northOver200: Number(String(row.northOver200)),
    central: Number(String(row.central)),
    active: row.active,
  };
}

function text(value: unknown) {
  return String(value ?? "").trim();
}
function number(value: unknown) {
  const parsed = Number(String(value ?? "").replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}
function money(value: unknown) {
  return Math.max(0, number(value));
}
