import { NextResponse } from "next/server";
import { applyStageDispatch, previewStageDispatch } from "@/lib/production/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * V153 — ĐIỀU ĐỘ TỰ ĐỘNG THEO CÔNG ĐOẠN.
 *
 * Luồng: tiêu chí ưu tiên → HÀNG ĐỢI có thứ tự → gom nhóm + năng lực → đề xuất ngày
 *        → người dùng XÁC NHẬN → rồi mới thêm/bớt thủ công.
 *
 * POST { action: "preview", stageCode, from?, horizonDays? } → đề xuất (KHÔNG ghi)
 * POST { action: "apply",   stageCode, from?, horizonDays?, byName? } → XÁC NHẬN, ghi vào kế hoạch
 *      (đồng thời xoá kế hoạch các công đoạn PHÍA SAU của những bộ vừa xếp)
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const action = String(body.action ?? "preview").trim().toLowerCase();
    const stageCode = String(body.stageCode ?? "").trim();
    if (!stageCode) return NextResponse.json({ ok: false, error: "Thiếu stageCode." }, { status: 400 });

    const query = {
      stageCode,
      from: typeof body.from === "string" ? body.from : null,
      horizonDays: Number.isFinite(Number(body.horizonDays)) ? Number(body.horizonDays) : null,
    };

    if (action === "preview") {
      const preview = await previewStageDispatch(query);
      return NextResponse.json({ ok: true, ...preview }, { headers: { "Cache-Control": "no-store" } });
    }
    if (action === "apply") {
      const result = await applyStageDispatch({
        ...query,
        byName: typeof body.byName === "string" ? body.byName : null,
      });
      return NextResponse.json({ ok: true, ...result });
    }
    return NextResponse.json({ ok: false, error: "Hành động không hợp lệ (preview | apply)." }, { status: 400 });
  } catch (error) {
    console.error("Stage dispatch failed:", error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Không điều độ được công đoạn." },
      { status: 400 },
    );
  }
}
