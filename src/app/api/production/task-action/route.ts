import { NextResponse } from "next/server";
import { applyTaskAction } from "@/lib/production/service";
import type { TaskAction } from "@/lib/production/team-report";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * V156 — MỘT CHẠM CỦA CÔNG NHÂN.
 * POST { taskId, action: BAT_DAU | HOAN_THANH | LOI | TAM_DUNG | HOAN_TAC, reasonCode?, qtyDone?, byName? }
 *
 * Ghi trong MỘT transaction: trạng thái công đoạn + ngày vào sản xuất (nếu là bộ đầu tiên)
 * + % & trạng thái bộ + nhật ký. Trả `warnings` (vd công đoạn trước chưa xong) — KHÔNG chặn.
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const taskId = Number(body.taskId);
    if (!Number.isInteger(taskId) || taskId <= 0) {
      return NextResponse.json({ ok: false, error: "Thiếu taskId." }, { status: 400 });
    }
    const action = String(body.action ?? "").trim().toUpperCase() as TaskAction;
    const result = await applyTaskAction({
      taskId,
      action,
      reasonCode: typeof body.reasonCode === "string" ? body.reasonCode : null,
      qtyDone: Number.isFinite(Number(body.qtyDone)) ? Number(body.qtyDone) : null,
      byName: typeof body.byName === "string" ? body.byName : null,
      prevStatus: typeof body.prevStatus === "string" ? body.prevStatus : null,
      prevReasonCode: typeof body.prevReasonCode === "string" ? body.prevReasonCode : null,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("Task action failed:", error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Không cập nhật được." },
      { status: 400 },
    );
  }
}
