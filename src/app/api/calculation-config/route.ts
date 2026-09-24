import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  CALCULATION_CONFIG_SETTING_KEY,
  buildSuggestedCalculationConfig,
  normalizeCalculationConfig,
  type CalculationConfig,
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
    validateConfig(config);

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

function validateConfig(config: CalculationConfig) {
  const frame = config.framePrice;
  if (frame.roundToMm <= 0 || frame.stepMm <= 0) throw new Error("Nấc làm tròn Khuôn và nấc tính phụ thu phải lớn hơn 0.");
  if (frame.standardMaxMm >= frame.doubleMinMm) throw new Error("Mốc Khuôn thường phải nhỏ hơn mốc bắt đầu Khuôn kép.");
  if (frame.doubleMinMm > frame.doubleMaxMm) throw new Error("Mốc bắt đầu Khuôn kép không được lớn hơn mốc kết thúc Khuôn kép.");

  const activeMain = config.rules.filter((rule) => rule.active && rule.scope === "MAIN");
  if (activeMain.length > 1) throw new Error("Chỉ được có 1 cấu hình đang dùng cho Bộ cửa chính.");

  const seen = new Set<string>();
  for (const rule of config.rules.filter((item) => item.active)) {
    const key = rule.scope === "MAIN"
      ? "MAIN"
      : rule.scope === "GROUP"
        ? `GROUP:${rule.groupName.trim().toUpperCase()}`
        : `ITEM:${rule.itemCode.trim().toUpperCase()}`;
    if (seen.has(key)) throw new Error(`Cấu hình đang bị trùng: ${rule.scope === "ITEM" ? rule.itemCode : rule.groupName || "Bộ cửa chính"}.`);
    seen.add(key);
  }
}
