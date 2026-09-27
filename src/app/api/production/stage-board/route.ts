import { NextResponse } from "next/server";
import { loadStageBoard, writeTaskPlan } from "@/lib/production/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * V152 — BẢNG ĐIỀU ĐỘ THỦ CÔNG theo công đoạn.
 *
 * GET  /api/production/stage-board?stage=SON&from=2026-10-01&days=7
 *      → { version, stage, stages, days[], waiting[], blocked[], totals }
 *        `waiting` = bộ ĐỦ ĐIỀU KIỆN vào kế hoạch (công đoạn trước đã lên kế hoạch HOẶC đã báo xong)
 *        `blocked` = chưa đủ điều kiện (kèm `waitingFor` để biết đang chờ công đoạn nào)
 *
 * POST { action: "assign" | "unassign", taskId, date?, byName? }
 *      → thêm/bớt bộ ở một công đoạn. **Xoá luôn mọi công đoạn PHÍA SAU** của cùng bộ.
 */

function readNumber(value: string | null): number | undefined {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const stage = String(url.searchParams.get("stage") ?? "").trim();
    if (!stage) return NextResponse.json({ ok: false, error: "Thiếu tham số ?stage=<mã công đoạn>." }, { status: 400 });
    const data = await loadStageBoard({
      stageCode: stage,
      from: url.searchParams.get("from"),
      days: readNumber(url.searchParams.get("days")) ?? 7,
    });
    return NextResponse.json({ ok: true, ...data }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Load stage board failed:", error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Không tải được bảng điều độ." },
      { status: 400 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const action = String(body.action ?? "").trim().toLowerCase();
    const taskId = Number(body.taskId);
    if (!Number.isInteger(taskId) || taskId <= 0) {
      return NextResponse.json({ ok: false, error: "Thiếu taskId hợp lệ." }, { status: 400 });
    }
    const byName = typeof body.byName === "string" ? body.byName : null;

    if (action === "assign") {
      const date = typeof body.date === "string" ? body.date : "";
      const result = await writeTaskPlan({ taskId, date, byName });
      return NextResponse.json({ ok: true, ...result });
    }
    if (action === "unassign") {
      const result = await writeTaskPlan({ taskId, date: null, byName });
      return NextResponse.json({ ok: true, ...result });
    }
    return NextResponse.json({ ok: false, error: "Hành động không hợp lệ (assign | unassign)." }, { status: 400 });
  } catch (error) {
    console.error("Write task plan failed:", error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Không cập nhật được kế hoạch." },
      { status: 400 },
    );
  }
}
