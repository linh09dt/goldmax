import ExcelJS from "exceljs";
import { buildOrderListWhere, type OrderListQuery } from "@/lib/order-list-filters";
import {
  CONFIRMED_WHERE,
  REVENUE_WHERE,
  loadMasterProducts,
  loadReportOrders,
  resolveReportQuery,
} from "@/lib/report-data";
import { buildOrderReport, buildProductReport, buildProductionLoad, buildReceivablesReport, buildSalesReport } from "@/lib/reporting";
import { orderStatusLabel, orderTypeLabel } from "@/lib/order-form";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * V130 — Xuất Excel dùng chung cho nhóm BÁO CÁO.
 * Giữ đúng bộ lọc đang xem trên màn hình (from/to/dealer/sales/region/type/state/q).
 * Đường dẫn: /api/reports/<type>/export
 */

const REPORT_TITLES: Record<string, string> = {
  orders: "Don-hang",
  products: "San-pham",
  "sales-performance": "Nhan-vien-Sales",
  receivables: "Cong-no",
  "production-load": "Tai-san-xuat",
};

type Query = OrderListQuery & { range?: string };

export async function GET(request: Request, context: { params: Promise<{ type: string }> }) {
  const { type } = await context.params;
  if (!REPORT_TITLES[type]) {
    return new Response("Báo cáo không tồn tại.", { status: 404 });
  }

  const url = new URL(request.url);
  const raw: Query = Object.fromEntries(url.searchParams.entries());
  const query = resolveReportQuery(raw);
  const { where: baseWhere } = buildOrderListWhere(query);

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "GOLDMAX ERP";
  workbook.created = new Date();

  if (type === "orders") {
    const orders = await loadReportOrders(baseWhere);
    const report = buildOrderReport(orders);
    const sheet = addSheet(workbook, "Don hang", ["Mã đơn", "Ngày đặt", "Khách hàng", "Mã ĐL", "NVKD", "Vùng", "Loại đơn", "Trạng thái", "Giá trị đơn", "Còn phải thu", "Hạn giao"],
      [22, 12, 28, 12, 12, 14, 16, 14, 16, 16, 12]);
    for (const order of orders) {
      sheet.addRow([
        order.orderCode,
        dateText(order.orderDate),
        order.customerName ?? "",
        order.customerCode ?? "",
        order.salesEmployeeCode ?? "",
        order.region ?? "",
        orderTypeLabel(order.orderType),
        orderStatusLabel(order.status),
        Number(order.totalAfterDiscount ?? 0),
        Number(order.deliveryPayment ?? 0),
        dateText(order.requiredDeliveryDate),
      ]);
    }
    addTotals(sheet, 11, (row) => {
      row.getCell(1).value = `TỔNG CỘNG (${report.totals.count} đơn)`;
      row.getCell(9).value = report.totals.orderValue;
      row.getCell(10).value = report.totals.remaining;
    });
    moneyColumns(sheet, [9, 10]);
  }

  if (type === "products") {
    const [orders, masters] = await Promise.all([loadReportOrders({ ...baseWhere, ...REVENUE_WHERE }), loadMasterProducts()]);
    const report = buildProductReport(orders, masters);
    const sheet = addSheet(workbook, "San pham", ["STT", "MODEL", "TENHANG", "ĐVT", "Số đơn", "Số bộ", "SL", "KH/Lượng", "Đơn giá TB", "Giá thấp nhất", "Giá cao nhất", "Doanh thu"],
      [6, 34, 26, 8, 9, 9, 10, 12, 16, 16, 16, 16]);
    report.rows.forEach((row, index) => {
      sheet.addRow([index + 1, row.code, row.name + (row.matched ? "" : " (chưa có trong danh mục)"), row.unit ?? "", row.orderCount, row.sets, row.quantity, row.pricingQuantity, row.avgPrice, row.minPrice, row.maxPrice, row.revenue]);
    });
    const totalRow = sheet.addRow(["", "", `TỔNG CỘNG (${report.totals.products} sản phẩm)`, "", "", "", report.totals.quantity, report.totals.pricingQuantity, "", "", "", report.totals.revenue]);
    totalRow.font = { bold: true };
    moneyColumns(sheet, [9, 10, 11, 12]);
  }

  if (type === "sales-performance") {
    const orders = await loadReportOrders(baseWhere);
    const report = buildSalesReport(orders);
    const sheet = addSheet(workbook, "Nhan vien Sales", ["NVKD", "Số đơn", "Đã xác nhận", "Nháp", "Số bộ", "Doanh thu", "Đã thu", "Còn phải thu", "Giá trị đơn TB", "Tỉ lệ xác nhận", "Quá hạn"],
      [16, 10, 12, 10, 10, 18, 18, 18, 18, 14, 10]);
    for (const row of report.rows) {
      sheet.addRow([row.code, row.orderCount, row.confirmedCount, row.draftCount, row.sets, row.revenue, row.collected, row.remaining, row.avgOrderValue, `${row.confirmRate.toFixed(1)}%`, row.overdueCount]);
    }
    const totalRow = sheet.addRow(["TỔNG CỘNG", report.totals.orderCount, report.totals.confirmedCount, "", "", report.totals.revenue, report.totals.collected, report.totals.remaining, report.totals.avgOrderValue, `${report.totals.confirmRate.toFixed(1)}%`, ""]);
    totalRow.font = { bold: true };
    moneyColumns(sheet, [6, 7, 8, 9]);
  }

  if (type === "receivables") {
    const orders = await loadReportOrders({ ...baseWhere, ...CONFIRMED_WHERE });
    const report = buildReceivablesReport(orders);
    const sheet = addSheet(workbook, "Cong no", ["STT", "Mã ĐL", "Khách hàng", "Số đơn", "Tổng mua", "Đã trả", "Còn nợ", "Hạn giao cũ nhất", "Số ngày quá hạn", "Mức cảnh báo"],
      [6, 12, 30, 10, 18, 18, 18, 14, 14, 20]);
    report.rows.forEach((row, index) => {
      sheet.addRow([index + 1, row.code, row.name, row.orderCount, row.totalValue, row.paid, row.remaining, dateText(row.oldestDue), row.daysOverdue, row.bucket]);
    });
    const totalRow = sheet.addRow(["", "", `TỔNG CỘNG (${report.totals.customers} khách)`, report.totals.orders, "", "", report.totals.remaining, "", "", ""]);
    totalRow.font = { bold: true };
    moneyColumns(sheet, [5, 6, 7]);

    const bucketSheet = addSheet(workbook, "Tuoi no", ["Nhóm tuổi nợ", "Số đơn", "Số tiền"], [26, 12, 18]);
    for (const bucket of report.buckets) {
      bucketSheet.addRow([bucket.label, bucket.orders, bucket.amount]);
    }
    moneyColumns(bucketSheet, [3]);
  }

  if (type === "production-load") {
    const orders = await loadReportOrders({ ...baseWhere, ...CONFIRMED_WHERE });
    const report = buildProductionLoad(orders);
    const sheet = addSheet(workbook, "Tai san xuat", ["Tuần", "Mã đơn", "Khách hàng", "Hạn giao", "Số bộ", "KH/Lượng", "Giá trị"],
      [28, 22, 28, 12, 10, 12, 18]);
    for (const bucket of report.buckets) {
      for (const item of bucket.items) {
        sheet.addRow([bucket.label, item.orderCode, item.customer, dateText(item.due), item.sets, item.volume, item.value]);
      }
    }
    const totalRow = sheet.addRow([`TỔNG CỘNG (${report.totals.orders} đơn)`, "", "", "", report.totals.sets, report.totals.volume, report.totals.value]);
    totalRow.font = { bold: true };
    moneyColumns(sheet, [7]);
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="bao-cao-${REPORT_TITLES[type]}-${stamp}.xlsx"`,
    },
  });
}

function addSheet(workbook: ExcelJS.Workbook, name: string, headers: string[], widths: number[]) {
  const sheet = workbook.addWorksheet(name);
  sheet.addRow(headers);
  const header = sheet.getRow(1);
  header.font = { bold: true, color: { argb: "FFFFFFFF" } };
  header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F172A" } };
  header.alignment = { vertical: "middle", horizontal: "center" };
  sheet.views = [{ state: "frozen", ySplit: 1 }];
  widths.forEach((width, index) => {
    sheet.getColumn(index + 1).width = width;
  });
  return sheet;
}

function moneyColumns(sheet: ExcelJS.Worksheet, columns: number[]) {
  for (const index of columns) sheet.getColumn(index).numFmt = "#,##0";
}

function addTotals(sheet: ExcelJS.Worksheet, columnCount: number, fill: (row: ExcelJS.Row) => void) {
  const row = sheet.addRow(new Array(columnCount).fill(""));
  row.font = { bold: true };
  fill(row);
}

function dateText(value: Date | null | undefined) {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (input: number) => String(input).padStart(2, "0");
  return `${pad(date.getUTCDate())}/${pad(date.getUTCMonth() + 1)}/${date.getUTCFullYear()}`;
}
