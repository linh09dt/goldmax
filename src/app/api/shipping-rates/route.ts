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
    const body: unknown = await request.json();
    const rawRows = readRows(body);
    if (!rawRows.length) {
      return NextResponse.json({ ok: false, error: "Không có dữ liệu bảng giá để lưu." }, { status: 400 });
    }

    const rows = rawRows.map(normalizeRow);
    const invalid = rows.find((row) => !row.modelCode || ![1, 2].includes(row.quantityTier));
    if (invalid) {
      return NextResponse.json(
        { ok: false, error: "Bảng giá có dòng thiếu Mã Model hoặc Số lượng đối chiếu không hợp lệ." },
        { status: 400 },
      );
    }

    const keys = new Set<string>();
    for (const row of rows) {
      const key = `${row.modelCode}|${row.quantityTier}`;
      if (keys.has(key)) {
        return NextResponse.json(
          { ok: false, error: `Trùng cấu hình bảng giá: ${row.modelCode} - ${row.quantityTier === 1 ? "1 bộ" : "2 bộ trở lên"}.` },
          { status: 400 },
        );
      }
      keys.add(key);
    }

    // Màn hình này luôn gửi toàn bộ Master bảng giá. Ghi đè toàn bộ trong cùng
    // transaction để "Khôi phục giá mẫu" thực sự thay thế dữ liệu cũ trên Supabase,
    // đồng thời không để lại dòng cũ nếu người dùng đổi Mã Model.
    await prisma.$transaction(async (tx) => {
      await tx.shippingRate.deleteMany();
      await tx.shippingRate.createMany({
        data: rows.map((row) => ({
          doorGroup: row.doorGroup,
          modelName: row.modelName,
          modelCode: row.modelCode,
          quantityTier: row.quantityTier,
          northLe100: row.northLe100,
          north101To200: row.north101To200,
          northOver200: row.northOver200,
          central: row.central,
          active: row.active,
          source: "MASTER_UI",
        })),
      });
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

type NormalizedShippingRate = {
  doorGroup: string;
  modelName: string;
  modelCode: string;
  quantityTier: number;
  northLe100: number;
  north101To200: number;
  northOver200: number;
  central: number;
  active: boolean;
};

function readRows(body: unknown): Record<string, unknown>[] {
  if (!isRecord(body) || !Array.isArray(body.rows)) return [];
  return body.rows.filter(isRecord);
}

function normalizeRow(raw: Record<string, unknown>): NormalizedShippingRate {
  const modelCode = text(raw.modelCode).toUpperCase();
  return {
    doorGroup: text(raw.doorGroup) || "KHÁC",
    modelName: text(raw.modelName) || modelCode,
    modelCode,
    quantityTier: Math.trunc(number(raw.quantityTier)),
    northLe100: money(raw.northLe100),
    north101To200: money(raw.north101To200),
    northOver200: money(raw.northOver200),
    central: money(raw.central),
    active: raw.active !== false,
  };
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
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
