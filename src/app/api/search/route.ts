import { NextResponse } from "next/server";
import { globalSearch } from "@/lib/search";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** V130 — API tìm kiếm toàn cục cho Ctrl+K. */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const query = url.searchParams.get("q") ?? "";
    const result = await globalSearch(query);
    return NextResponse.json({ ok: true, query, ...result });
  } catch (error) {
    console.error("Global search failed:", error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Không thể tìm kiếm." },
      { status: 500 },
    );
  }
}
