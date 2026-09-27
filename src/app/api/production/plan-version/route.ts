import { NextResponse } from "next/server";
import { productionPlanVersion } from "@/lib/production/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * V152 — TOKEN PHIÊN BẢN dữ liệu kế hoạch (dùng cho REALTIME).
 *
 * Client hỏi vài giây một lần (rất nhẹ: 1 câu SQL đếm + max(updated_at)). Token đổi ⇒
 * có thay đổi ở đơn hàng / bộ / công đoạn (thêm bớt bộ, báo xong, nhập đơn mới…) ⇒
 * client tự tải lại. **Không cần F5.**
 */
export async function GET() {
  try {
    return NextResponse.json({ ok: true, version: await productionPlanVersion() }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Plan version failed:", error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Không đọc được phiên bản kế hoạch." },
      { status: 500 },
    );
  }
}
