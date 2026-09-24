import { NextResponse } from "next/server";
import { filterCustomers, loadCustomerDirectory } from "@/lib/customers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** V79: danh sách khách hàng tự động tổng hợp từ các đơn hàng đã lưu. */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const query = url.searchParams.get("q") ?? "";
    const directory = await loadCustomerDirectory();
    const customers = filterCustomers(directory.customers, query);

    return NextResponse.json({
      ok: true,
      customers,
      matched: customers.length,
      totalCustomers: directory.customers.length,
      scannedOrders: directory.scannedOrders,
      totalOrders: directory.totalOrders,
    });
  } catch (error) {
    console.error("Load customers failed:", error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Không thể tải danh sách khách hàng." },
      { status: 500 },
    );
  }
}
