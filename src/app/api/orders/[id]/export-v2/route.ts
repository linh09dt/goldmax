import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { buildOrderExcelV2 } from "@/lib/order-export-v2";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const orderId = Number(id);
    if (!Number.isInteger(orderId)) {
      return NextResponse.json({ ok: false, error: "ID đơn hàng không hợp lệ." }, { status: 400 });
    }

    const order = await prisma.salesOrder.findUnique({
      where: { id: orderId },
      include: {
        items: { orderBy: { lineNo: "asc" }, include: { details: { orderBy: { rowOrder: "asc" } }, images: { orderBy: { sortOrder: "asc" } } } },
        requirements: { orderBy: { sortOrder: "asc" } },
      },
    });
    if (!order) return NextResponse.json({ ok: false, error: "Không tìm thấy đơn hàng." }, { status: 404 });

    const note = normalizeExportNote(new URL(request.url).searchParams.get("note"));
    const file = await buildOrderExcelV2(order as any, note);
    const safeCode = sanitizeFileName(order.orderCode || `don-hang-${order.id}`);
    return new NextResponse(new Uint8Array(file), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="bao-gia-v2-${order.id}.xlsx"; filename*=UTF-8''${encodeURIComponent(`${safeCode}-V2.xlsx`)}`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("Export order Excel V2 failed:", error);
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Không thể xuất Excel V2." }, { status: 500 });
  }
}

function sanitizeFileName(value: string) {
  return value.replace(/[\\/:*?"<>|]/g, "-").replace(/\s+/g, " ").trim().slice(0, 120) || "don-hang";
}
function normalizeExportNote(value: string | null) {
  return (value || "").replace(/\r\n?/g, "\n").trim().slice(0, 1000);
}
