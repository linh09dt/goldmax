import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { buildOrderExcel } from "@/lib/order-export";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const orderId = Number(id);

    if (!Number.isInteger(orderId)) {
      return NextResponse.json(
        {
          ok: false,
          error: "ID đơn hàng không hợp lệ.",
        },
        {
          status: 400,
        },
      );
    }

    const order = await prisma.salesOrder.findUnique({
      where: {
        id: orderId,
      },
      include: {
        items: {
          orderBy: {
            lineNo: "asc",
          },
          include: {
            details: {
              orderBy: {
                rowOrder: "asc",
              },
            },
          },
        },
        requirements: {
          orderBy: {
            sortOrder: "asc",
          },
        },
      },
    });

    if (!order) {
      return NextResponse.json(
        {
          ok: false,
          error: "Không tìm thấy đơn hàng.",
        },
        {
          status: 404,
        },
      );
    }

    const file = await buildOrderExcel(order as any);

    const safeCode = sanitizeFileName(
      order.orderCode || `don-hang-${order.id}`,
    );

    const asciiName = `don-hang-${order.id}.xlsx`;
    const utf8Name = encodeURIComponent(`${safeCode}.xlsx`);

    // Next.js 16 / TypeScript:
    // Buffer không còn được chấp nhận trực tiếp làm BodyInit.
    // Chuyển Buffer -> Uint8Array trước khi trả response.
    const responseBody = new Uint8Array(file);

    return new NextResponse(responseBody, {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",

        "Content-Disposition":
          `attachment; filename="${asciiName}"; filename*=UTF-8''${utf8Name}`,

        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("Export order Excel failed:", error);

    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Không thể xuất Excel đơn hàng.",
      },
      {
        status: 500,
      },
    );
  }
}

function sanitizeFileName(value: string) {
  return (
    value
      .replace(/[\\/:*?"<>|]/g, "-")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 120) || "don-hang"
  );
}