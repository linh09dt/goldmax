import { NextResponse } from "next/server";
import { syncProductionSets } from "@/lib/production/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * V136 — Đưa bộ cửa từ đơn hàng vào kế hoạch sản xuất.
 *
 * Body (tất cả đều tuỳ chọn):
 *   { orderItemIds?: number[], orderIds?: number[], limit?: number }
 * Không truyền gì = đồng bộ TẤT CẢ bộ cửa của đơn đã xác nhận (dùng cho lần chạy đầu / nhập bộ đang dở).
 *
 * Idempotent: bộ đã có trong kế hoạch thì bỏ qua (chống trùng theo id dòng hàng
 * và theo mã đơn + Bộ số — bộ số không đổi khi sửa đơn).
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      orderItemIds?: unknown;
      orderIds?: unknown;
      limit?: unknown;
    };

    const toIntArray = (value: unknown): number[] | undefined => {
      if (!Array.isArray(value)) return undefined;
      const numbers = value
        .map((item) => Number(item))
        .filter((item) => Number.isInteger(item) && item > 0);
      return numbers.length ? numbers : undefined;
    };

    const result = await syncProductionSets({
      orderItemIds: toIntArray(body.orderItemIds),
      orderIds: toIntArray(body.orderIds),
      limit: Number.isInteger(Number(body.limit)) && Number(body.limit) > 0 ? Number(body.limit) : undefined,
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("Sync production sets failed:", error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Không thể đưa bộ cửa vào kế hoạch." },
      { status: 400 },
    );
  }
}
