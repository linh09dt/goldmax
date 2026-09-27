import { NextResponse } from "next/server";
import { loadTeamReport } from "@/lib/production/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * V156 — BẢNG BÁO CÁO SẢN XUẤT CỦA MỘT TỔ (chỉ đọc).
 * GET ?team=<mã tổ>&stage=<mã công đoạn>&day=YYYY-MM-DD
 */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const report = await loadTeamReport({
      teamCode: url.searchParams.get("team"),
      stageCode: url.searchParams.get("stage"),
      day: url.searchParams.get("day"),
    });
    return NextResponse.json({ ok: true, ...report }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Team report failed:", error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Không đọc được báo cáo tổ." },
      { status: 400 },
    );
  }
}
