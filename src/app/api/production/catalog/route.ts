import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { normalizeProductionConfig, validateProductionConfig } from "@/lib/production/config";
import { loadReasons, loadStages, loadWorkCenters, readProductionConfig, saveProductionConfig } from "@/lib/production/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * V136 — Đọc/ghi DANH MỤC sản xuất (dùng cho màn Cấu hình sản xuất).
 *
 * GET    /api/production/catalog            → { config, workCenters, stages, reasons, programs, holidays }
 * PUT    /api/production/catalog            → { config } lưu cấu hình
 * POST   /api/production/catalog            → { entity, ... } thêm/cập nhật 1 mục danh mục
 * DELETE /api/production/catalog?entity=&id=→ xoá 1 mục danh mục
 *
 * `entity`: workCenter | stage | reason | program | holiday
 */

type Row = Record<string, unknown>;

function str(value: unknown, max: number): string | null {
  if (value === null || value === undefined) return null;
  const trimmed = String(value).trim();
  return trimmed ? trimmed.slice(0, max) : null;
}

function num(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function int(value: unknown): number | null {
  const parsed = num(value);
  return parsed === null ? null : Math.trunc(parsed);
}

function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function required(value: unknown, max: number, label: string): string {
  const text = str(value, max);
  if (!text) throw new Error(`${label} là bắt buộc.`);
  return text;
}

export async function GET() {
  try {
    const [config, workCenters, stages, reasons, programs, holidays] = await Promise.all([
      readProductionConfig(),
      loadWorkCenters(),
      loadStages(),
      loadReasons(),
      prisma.productionProgram.findMany({ orderBy: [{ model: "asc" }, { version: "desc" }] }),
      prisma.productionCalendar.findMany({ orderBy: { date: "asc" } }),
    ]);
    return NextResponse.json({ ok: true, config, workCenters, stages, reasons, programs, holidays });
  } catch (error) {
    console.error("Load production catalog failed:", error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Không thể tải danh mục sản xuất." },
      { status: 500 },
    );
  }
}

export async function PUT(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as { config?: unknown };
    const config = normalizeProductionConfig(body.config);
    validateProductionConfig(config);
    const saved = await saveProductionConfig(config);
    return NextResponse.json({ ok: true, config: saved });
  } catch (error) {
    console.error("Save production config failed:", error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Không thể lưu cấu hình sản xuất." },
      { status: 400 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as Row;
    const entity = String(body.entity ?? "");
    const id = int(body.id);

    switch (entity) {
      case "workCenter": {
        const data = {
          code: required(body.code, 40, "Mã tổ"),
          name: required(body.name, 120, "Tên tổ"),
          kind: str(body.kind, 20) ?? "TO",
          peopleCount: int(body.peopleCount),
          shiftsPerDay: int(body.shiftsPerDay),
          hoursPerShift: num(body.hoursPerShift),
          capacityPerDay: num(body.capacityPerDay),
          capacityUnit: str(body.capacityUnit, 10) ?? "CANH",
          active: bool(body.active, true),
          sortOrder: int(body.sortOrder) ?? 0,
          note: str(body.note, 2000),
        };
        const row = id
          ? await prisma.productionWorkCenter.update({ where: { id }, data })
          : await prisma.productionWorkCenter.create({ data });
        return NextResponse.json({ ok: true, row });
      }

      case "stage": {
        const data = {
          code: required(body.code, 40, "Mã công đoạn"),
          name: required(body.name, 160, "Tên công đoạn"),
          kind: str(body.stageKind, 20) ?? "GIA_CONG",
          scopeMode: str(body.scopeMode, 20) ?? "BO",
          scopeParts: str(body.scopeParts, 60),
          workCenterCode: str(body.workCenterCode, 40),
          seq: int(body.seq) ?? 0,
          leadTimeHours: num(body.leadTimeHours),
          setupMinutes: int(body.setupMinutes),
          capacityPerDay: num(body.capacityPerDay),
          capacityUnit: str(body.capacityUnit, 10) ?? "CANH",
          batchKey: str(body.batchKey, 30),
          batchMinQty: int(body.batchMinQty),
          changeoverMaxPerDay: int(body.changeoverMaxPerDay),
          isQcPoint: bool(body.isQcPoint, false),
          reworkToStage: str(body.reworkToStage, 40),
          skipCondition: str(body.skipCondition, 160),
          requiresStage: str(body.requiresStage, 40),
          active: bool(body.active, true),
          note: str(body.note, 2000),
        };
        const row = id
          ? await prisma.productionStage.update({ where: { id }, data })
          : await prisma.productionStage.create({ data });
        return NextResponse.json({ ok: true, row });
      }

      case "reason": {
        const data = {
          code: required(body.code, 40, "Mã lý do"),
          name: required(body.name, 160, "Tên lý do"),
          group: str(body.reasonGroup, 20) ?? "TAM_DUNG",
          sortOrder: int(body.sortOrder) ?? 0,
          active: bool(body.active, true),
        };
        const row = id
          ? await prisma.productionReason.update({ where: { id }, data })
          : await prisma.productionReason.create({ data });
        return NextResponse.json({ ok: true, row });
      }

      case "program": {
        const madeAtText = str(body.madeAt, 40);
        const data = {
          model: required(body.model, 100, "Model"),
          fileName: str(body.fileName, 255),
          version: int(body.version) ?? 1,
          machine: str(body.machine, 120),
          madeBy: str(body.madeBy, 120),
          madeAt: madeAtText ? new Date(madeAtText) : null,
          durationMinutes: int(body.durationMinutes),
          reusable: bool(body.reusable, true),
          note: str(body.note, 2000),
        };
        const row = id
          ? await prisma.productionProgram.update({ where: { id }, data })
          : await prisma.productionProgram.create({ data });
        return NextResponse.json({ ok: true, row });
      }

      case "holiday": {
        const dateText = required(body.date, 10, "Ngày nghỉ");
        if (!/^\d{4}-\d{2}-\d{2}$/.test(dateText)) throw new Error("Ngày nghỉ không hợp lệ (cần dạng YYYY-MM-DD).");
        const date = new Date(`${dateText}T00:00:00.000Z`);
        const row = await prisma.productionCalendar.upsert({
          where: { date },
          create: { date, isWorkingDay: bool(body.isWorkingDay, false), note: str(body.note, 160) },
          update: { isWorkingDay: bool(body.isWorkingDay, false), note: str(body.note, 160) },
        });
        return NextResponse.json({ ok: true, row });
      }

      default:
        return NextResponse.json({ ok: false, error: "Loại danh mục không hợp lệ." }, { status: 400 });
    }
  } catch (error) {
    console.error("Save production catalog failed:", error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Không thể lưu danh mục sản xuất." },
      { status: 400 },
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const url = new URL(request.url);
    const entity = String(url.searchParams.get("entity") ?? "");
    const id = Number(url.searchParams.get("id"));
    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json({ ok: false, error: "ID không hợp lệ." }, { status: 400 });
    }
    switch (entity) {
      case "workCenter":
        await prisma.productionWorkCenter.delete({ where: { id } });
        break;
      case "stage":
        await prisma.productionStage.delete({ where: { id } });
        break;
      case "reason":
        await prisma.productionReason.delete({ where: { id } });
        break;
      case "program":
        await prisma.productionProgram.delete({ where: { id } });
        break;
      case "holiday":
        await prisma.productionCalendar.delete({ where: { id } });
        break;
      default:
        return NextResponse.json({ ok: false, error: "Loại danh mục không hợp lệ." }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Delete production catalog failed:", error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Không thể xoá mục danh mục." },
      { status: 400 },
    );
  }
}
