import ExcelJS from "exceljs";
import { filterCustomers, loadCustomerDirectory } from "@/lib/customers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** V79: xuất danh sách khách hàng (tổng hợp từ đơn hàng) ra Excel. */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const query = url.searchParams.get("q") ?? "";
    const directory = await loadCustomerDirectory();
    const customers = filterCustomers(directory.customers, query);

    const workbook = new ExcelJS.Workbook();
    workbook.creator = "Door Production ERP";
    const sheet = workbook.addWorksheet("Khach hang");
    sheet.columns = [
      { header: "STT", key: "index", width: 6 },
      { header: "Tên khách hàng", key: "name", width: 34 },
      { header: "Số điện thoại", key: "phone", width: 16 },
      { header: "Địa chỉ", key: "address", width: 46 },
      { header: "Mã Đại Lý", key: "customerCode", width: 14 },
      { header: "NVKD phụ trách", key: "salesEmployeeCode", width: 16 },
      { header: "Vùng miền", key: "region", width: 14 },
      { header: "Số đơn", key: "orderCount", width: 9 },
      { header: "Tổng tiền đơn hàng", key: "totalAmount", width: 18 },
      { header: "Đơn gần nhất", key: "lastOrderCode", width: 20 },
      { header: "Ngày đơn gần nhất", key: "lastOrderDate", width: 16 },
    ];
    sheet.getRow(1).font = { bold: true };
    sheet.getRow(1).alignment = { vertical: "middle", horizontal: "center" };
    sheet.getRow(1).height = 22;

    customers.forEach((customer, index) => {
      sheet.addRow({
        index: index + 1,
        name: customer.name,
        phone: customer.phone ?? "",
        address: customer.address ?? "",
        customerCode: customer.customerCode ?? "",
        salesEmployeeCode: customer.salesEmployeeCode ?? "",
        region: customer.region ?? "",
        orderCount: customer.orderCount,
        totalAmount: customer.totalAmount,
        lastOrderCode: customer.orders[0]?.orderCode ?? "",
        lastOrderDate: formatDate(customer.lastOrderDate),
      });
    });

    sheet.getColumn("totalAmount").numFmt = "#,##0";
    sheet.getColumn("orderCount").alignment = { horizontal: "center" };

    const buffer = await workbook.xlsx.writeBuffer();
    const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    return new Response(buffer as ArrayBuffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="danh-sach-khach-hang-${stamp}.xlsx"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("Export customers failed:", error);
    return new Response(
      JSON.stringify({ ok: false, error: error instanceof Error ? error.message : "Không thể xuất danh sách khách hàng." }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
}

function formatDate(value: string | null) {
  if (!value) return "";
  const [year, month, day] = value.split("-");
  return year && month && day ? `${day}/${month}/${year}` : value;
}
