import { NextResponse } from "next/server";
import { applyAutoSchedule } from "@/lib/production/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * V136 — Xếp lịch tự động cho các bộ cửa.
 *
 * Body: { from?: "YYYY-MM-DD", rescheduleAll?: boolean }
 *  - mặc định chỉ xếp các bộ đang CHỜ XẾP LỊCH;
 *  - `rescheduleAll: true` = xếp lại mọi bộ đang mở (KHÔNG đụng bộ đã hoàn thành / đã giao / đã huỷ).
 *
 * Xếp tiến theo EDD + đơn làm lại trước, tôn trọng năng lực từng tổ và ngày nghỉ.
 * KHÔNG tự chạy nền — chỉ khi người dùng bấm nút (J8: không tự ý đổi lịch).
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as { from?: unknown; rescheduleAll?: unknown };
    const fromText = String(body.from ?? "").trim();
    const from = /^\d{4}-\d{2}-\d{2}$/.test(fromText) ? new Date(`${fromText}T00:00:00.000Z`) : undefined;

    const result = await applyAutoSchedule({
      from,
      rescheduleAll: body.rescheduleAll === true,
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("Auto schedule failed:", error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Không xếp lịch được." },
      { status: 400 },
    );
  }
}
