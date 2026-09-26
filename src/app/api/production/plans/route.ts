import { NextResponse } from "next/server";
import { approvePlan, createPlan, deletePlan, loadPlans, reopenPlan } from "@/lib/production/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * V137 — KẾ HOẠCH TUẦN.
 *
 * GET  /api/production/plans                     → danh sách kế hoạch + tổng hợp
 * POST /api/production/plans   { action, ... }
 *      action = "create"  { fromDate, toDate, note?, createdBy? }  → tạo + gán bộ trong khoảng ngày
 *      action = "approve" { id, approvedBy }                       → CHỐT kế hoạch (giám đốc nhà máy)
 *      action = "reopen"  { id, byName }                           → mở lại
 *      action = "delete"  { id }                                   → xoá kế hoạch (bộ trở về chưa gán)
 */

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function parseDate(value: unknown): Date | null {
  const text = String(value ?? "").trim();
  if (!DATE_PATTERN.test(text)) return null;
  return new Date(`${text}T00:00:00.000Z`);
}

function text(value: unknown, max = 500): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, max) : null;
}

export async function GET() {
  try {
    const plans = await loadPlans();
    return NextResponse.json({ ok: true, plans });
  } catch (error) {
    console.error("Load production plans failed:", error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Không tải được kế hoạch tuần." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const action = String(body.action ?? "");

    if (action === "create") {
      const fromDate = parseDate(body.fromDate);
      const toDate = parseDate(body.toDate);
      if (!fromDate || !toDate) {
        return NextResponse.json({ ok: false, error: "Cần chọn ngày bắt đầu và ngày kết thúc (dạng YYYY-MM-DD)." }, { status: 400 });
      }
      const result = await createPlan({
        fromDate,
        toDate,
        note: text(body.note, 2000),
        createdBy: text(body.createdBy, 120),
      });
      return NextResponse.json({ ok: true, ...result });
    }

    const id = Number(body.id);
    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json({ ok: false, error: "ID kế hoạch không hợp lệ." }, { status: 400 });
    }

    if (action === "approve") {
      const plan = await approvePlan(id, text(body.approvedBy, 120));
      return NextResponse.json({ ok: true, plan });
    }
    if (action === "reopen") {
      const plan = await reopenPlan(id, text(body.byName, 120));
      return NextResponse.json({ ok: true, plan });
    }
    if (action === "delete") {
      await deletePlan(id);
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ ok: false, error: "Hành động không hợp lệ." }, { status: 400 });
  } catch (error) {
    console.error("Update production plan failed:", error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Không cập nhật được kế hoạch." },
      { status: 400 },
    );
  }
}
