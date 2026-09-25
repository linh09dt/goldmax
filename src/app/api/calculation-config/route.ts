import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  CALCULATION_CONFIG_SETTING_KEY,
  buildSuggestedCalculationConfig,
  normalizeCalculationConfig,
  validateCalculationConfig,
} from "@/lib/calculation-config";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const defaultsOnly = url.searchParams.get("defaults") === "true";

    if (!defaultsOnly) {
      const setting = await prisma.systemSetting.findUnique({
        where: { key: CALCULATION_CONFIG_SETTING_KEY },
        select: { value: true, updatedAt: true },
      });
      if (setting?.value) {
        const config = normalizeCalculationConfig(JSON.parse(setting.value));
        return NextResponse.json({ ok: true, config, source: "saved", updatedAt: setting.updatedAt });
      }
    }

    const items = await prisma.itemMaster.findMany({
      where: { active: true },
      select: { code: true, name: true, productDescription: true },
      orderBy: [{ name: "asc" }, { code: "asc" }],
      take: 5000,
    });
    const config = buildSuggestedCalculationConfig(items);
    return NextResponse.json({ ok: true, config, source: "suggested", updatedAt: null });
  } catch (error) {
    console.error("Load calculation config failed:", error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Không thể tải cấu hình tính toán." },
      { status: 500 },
    );
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json() as { config?: unknown };
    const config = normalizeCalculationConfig(body.config);
    // V90: kiểm tra trùng rule nằm trong lib (cùng khoá với dedupeRules) — đã tính cả cột Bộ cửa chính.
    validateCalculationConfig(config);

    const setting = await prisma.systemSetting.upsert({
      where: { key: CALCULATION_CONFIG_SETTING_KEY },
      create: { key: CALCULATION_CONFIG_SETTING_KEY, value: JSON.stringify(config) },
      update: { value: JSON.stringify(config) },
      select: { updatedAt: true },
    });

    return NextResponse.json({ ok: true, config, source: "saved", updatedAt: setting.updatedAt });
  } catch (error) {
    console.error("Save calculation config failed:", error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Không thể lưu cấu hình tính toán." },
      { status: 400 },
    );
  }
}
