import { NextResponse } from "next/server";
import { applyStagePlan, previewStagePlan, type StagePlanScope } from "@/lib/production/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * V148 — KẾ HOẠCH CHO TỪNG CÔNG ĐOẠN (theo NĂNG LỰC).
 *
 * POST /api/production/stage-plan
 *   { action: "preview", from?, to?, scope?, setIds? }  → tính trước, KHÔNG ghi DB
 *   { action: "apply",   from?, to?, scope?, setIds?, byName? } → ghi `planned_start/planned_end`
 *
 * `scope`:
 *   "CHO_XEP_LICH" (mặc định) = chỉ bộ đang chờ xếp lịch
 *   "DANG_MO"                 = mọi bộ đang mở (chờ xếp lịch + đã xếp + đang sản xuất)
 *
 * Ngày xếp XUÔI theo năng lực công đoạn/tổ; lead time KHÔNG tham gia xếp ngày.
 */

const SCOPES: StagePlanScope[] = ["CHO_XEP_LICH", "DANG_MO"];

function readScope(value: unknown): StagePlanScope {
  const text = String(value ?? "").trim().toUpperCase();
  return (SCOPES as string[]).includes(text) ? (text as StagePlanScope) : "CHO_XEP_LICH";
}

function readIds(value: unknown): number[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const ids = value.map((item) => Number(item)).filter((item) => Number.isInteger(item) && item > 0);
  return ids.length ? ids : undefined;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const action = String(body.action ?? "preview").trim().toLowerCase();
    const query = {
      from: typeof body.from === "string" ? body.from : null,
      to: typeof body.to === "string" ? body.to : null,
      scope: readScope(body.scope),
      setIds: readIds(body.setIds),
    };

    if (action === "preview") {
      const result = await previewStagePlan(query);
      return NextResponse.json({ ok: true, action, scope: query.scope, ...result });
    }

    if (action === "apply") {
      const result = await applyStagePlan({
        ...query,
        byName: typeof body.byName === "string" ? body.byName : null,
      });
      return NextResponse.json({ ok: true, action, scope: query.scope, ...result });
    }

    return NextResponse.json({ ok: false, error: "Hành động không hợp lệ (preview | apply)." }, { status: 400 });
  } catch (error) {
    console.error("Stage plan failed:", error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Không lập được kế hoạch công đoạn." },
      { status: 400 },
    );
  }
}
