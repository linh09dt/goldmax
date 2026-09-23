import ExcelJS from "exceljs";
import type { SalesOrderGetPayload } from "@/generated/prisma/models/SalesOrder";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type OrderQuery = {
  date?: string;
  month?: string;
  year?: string;
  from?: string;
  to?: string;
  dealer?: string;
  customer?: string;
};

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const query: OrderQuery = {
      date: url.searchParams.get("date") ?? undefined,
      month: url.searchParams.get("month") ?? undefined,
      year: url.searchParams.get("year") ?? undefined,
      from: url.searchParams.get("from") ?? undefined,
      to: url.searchParams.get("to") ?? undefined,
      dealer: url.searchParams.get("dealer") ?? undefined,
      customer: url.searchParams.get("customer") ?? undefined,
    };

    const dateFilter = resolveDateFilter(query);
    const dealerFilter = parseDealerFilter(query.dealer);
    const customerFilter = clean(query.customer);

    const orders = await prisma.salesOrder.findMany({
      where: {
        ...(dateFilter ? { orderDate: dateFilter } : {}),
        ...(dealerFilter
          ? dealerFilter.kind === "code"
            ? { customerCode: dealerFilter.value }
            : { customerName: dealerFilter.value }
          : {}),
        ...(customerFilter ? { receiverName: customerFilter } : {}),
      },
      orderBy: [{ requiredDeliveryDate: "asc" }, { id: "desc" }],
      include: {
        items: {
          orderBy: { lineNo: "asc" },
          include: {
            details: { orderBy: { rowOrder: "asc" } },
          },
        },
      },
    });

    const workbook = new ExcelJS.Workbook();
    workbook.creator = "Door Production ERP";
    workbook.created = new Date();

    const sheet = workbook.addWorksheet("Danh sách đơn hàng", {
      views: [{ state: "frozen", ySplit: 1 }],
    });

    sheet.columns = [
      { header: "STT", key: "stt", width: 7 },
      { header: "Ngày đơn hàng", key: "orderDate", width: 14 },
      { header: "Số đơn hàng", key: "orderCode", width: 22 },
      { header: "Hạn giao hàng", key: "requiredDeliveryDate", width: 14 },
      { header: "Trạng thái", key: "status", width: 18 },
      { header: "Mã Đại Lý", key: "customerCode", width: 15 },
      { header: "Tên khách hàng", key: "customerName", width: 24 },
      { header: "Mã NV bán hàng", key: "salesEmployeeCode", width: 16 },
      { header: "Người nhận", key: "receiverName", width: 20 },
      { header: "SĐT người nhận", key: "receiverPhone", width: 16 },
      { header: "Địa chỉ nhận", key: "receiverAddress", width: 38 },
      { header: "Số Km giao", key: "deliveryKm", width: 12 },
      { header: "Khu vực", key: "region", width: 16 },
      { header: "Mã bộ đánh số", key: "setNo", width: 15 },
      { header: "Loại dòng", key: "lineType", width: 24 },
      { header: "STT dòng", key: "lineNo", width: 10 },
      { header: "Tên sản phẩm", key: "productName", width: 30 },
      { header: "Mã hàng", key: "productCode", width: 24 },
      { header: "Model", key: "model", width: 22 },
      { header: "ĐVT", key: "unit", width: 10 },
      { header: "Ô thoáng / Panel", key: "panelInfo", width: 22 },
      { header: "Hướng mở", key: "openingDirection", width: 12 },
      { header: "Hướng phào", key: "trimDirection", width: 14 },
      { header: "Màu sơn - mã vân", key: "paintColor", width: 18 },
      { header: "Chiều cao ô chờ", key: "heightMm", width: 14 },
      { header: "Chiều rộng ô chờ", key: "widthMm", width: 14 },
      { header: "Độ dày khuôn", key: "frameMm", width: 13 },
      { header: "Cao thông thủy", key: "clearHeightMm", width: 14 },
      { header: "Rộng thông thủy", key: "clearWidthMm", width: 14 },
      { header: "Số thanh phào / bộ", key: "trimBarsPerSet", width: 14 },
      { header: "Loại phào", key: "trimType", width: 14 },
      { header: "Model khóa", key: "lockModel", width: 18 },
      { header: "Kiểu song", key: "windowBars", width: 18 },
      { header: "Số cánh / bộ", key: "leavesPerSet", width: 12 },
      { header: "Số lượng", key: "quantity", width: 11 },
      { header: "KH/Lượng", key: "pricingQuantity", width: 12 },
      { header: "Đơn giá", key: "unitPrice", width: 16 },
      { header: "Thành tiền", key: "amount", width: 18 },
      { header: "Ghi chú", key: "note", width: 34 },
      { header: "Hình ảnh SP", key: "imagePath", width: 36 },
      { header: "Cước vận chuyển", key: "shippingFee", width: 17 },
      { header: "Tổng trước CK", key: "subtotal", width: 17 },
      { header: "% Chiết khấu", key: "discountPercent", width: 13 },
      { header: "Tiền chiết khấu", key: "discountAmount", width: 17 },
      { header: "Tổng sau CK", key: "totalAfterDiscount", width: 17 },
      { header: "Đặt cọc", key: "depositAmount", width: 16 },
    ];

    let exportRow = 0;
    let orderNo = 0;

    for (const order of orders) {
      orderNo += 1;
      let hasAnyLine = false;

      for (const item of order.items) {
        hasAnyLine = true;
        exportRow += 1;
        addExportRow(sheet, {
          orderNo,
          order,
          lineType: "Bộ cửa / hàng chính",
          lineNo: item.lineNo,
          row: item,
        });
        styleDataRow(sheet.getRow(exportRow + 1), true);

        for (const detail of item.details) {
          hasAnyLine = true;
          exportRow += 1;
          addExportRow(sheet, {
            orderNo,
            order,
            lineType: "Chi tiết / phụ kiện / phụ phí",
            lineNo: `${item.lineNo}.${detail.rowOrder}`,
            row: detail,
          });
          styleDataRow(sheet.getRow(exportRow + 1), false);
        }
      }

      if (!hasAnyLine) {
        exportRow += 1;
        addExportRow(sheet, {
          orderNo,
          order,
          lineType: "Đơn chưa có hàng hóa",
          lineNo: "",
          row: null,
        });
        styleDataRow(sheet.getRow(exportRow + 1), false);
      }
    }

    const header = sheet.getRow(1);
    header.height = 32;
    header.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 10 };
    header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F172A" } };
    header.alignment = { vertical: "middle", horizontal: "center", wrapText: true };

    sheet.autoFilter = { from: "A1", to: "AT1" };
    sheet.getColumn("orderDate").numFmt = "dd/mm/yyyy";
    sheet.getColumn("requiredDeliveryDate").numFmt = "dd/mm/yyyy";
    sheet.getColumn("deliveryKm").numFmt = "#,##0.##";
    sheet.getColumn("pricingQuantity").numFmt = "#,##0.####";
    sheet.getColumn("unitPrice").numFmt = "#,##0";
    sheet.getColumn("amount").numFmt = "#,##0";
    sheet.getColumn("shippingFee").numFmt = "#,##0";
    sheet.getColumn("subtotal").numFmt = "#,##0";
    sheet.getColumn("discountPercent").numFmt = "0.####";
    sheet.getColumn("discountAmount").numFmt = "#,##0";
    sheet.getColumn("totalAfterDiscount").numFmt = "#,##0";
    sheet.getColumn("depositAmount").numFmt = "#,##0";

    const buffer = await workbook.xlsx.writeBuffer();
    const responseBody = new Uint8Array(buffer);
    const stamp = new Date().toISOString().slice(0, 10).replaceAll("-", "");

    return new Response(responseBody, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="danh-sach-don-hang-${stamp}.xlsx"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("Export order list Excel failed:", error);
    return Response.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Không thể xuất danh sách đơn hàng.",
      },
      { status: 500 },
    );
  }
}

type ExportOrder = SalesOrderGetPayload<{
  include: {
    items: {
      include: { details: true };
    };
  };
}>;

type ExportLineData = {
  setNo: string | null;
  productName: string | null;
  productCode: string | null;
  model: string | null;
  unit: string | null;
  panelInfo: string | null;
  openingDirection: string | null;
  trimDirection: string | null;
  paintColor: string | null;
  heightMm: number | null;
  widthMm: number | null;
  frameMm: number | null;
  clearHeightMm: number | null;
  clearWidthMm: number | null;
  trimBarsPerSet: number | null;
  trimType: string | null;
  lockModel: string | null;
  windowBars: string | null;
  leavesPerSet: number | null;
  quantity: number | null;
  pricingQuantity: number | null;
  unitPrice: unknown;
  amount: unknown;
  note: string | null;
  imagePath: string | null;
};

type ExportRowInput = {
  orderNo: number;
  order: ExportOrder;
  lineType: string;
  lineNo: number | string;
  row: ExportLineData | null;
};

function addExportRow(sheet: ExcelJS.Worksheet, input: ExportRowInput) {
  const { orderNo, order, lineType, lineNo, row } = input;
  sheet.addRow({
    stt: orderNo,
    orderDate: order.orderDate ?? null,
    orderCode: order.orderCode,
    requiredDeliveryDate: order.requiredDeliveryDate ?? null,
    status: statusLabel(order.status),
    customerCode: order.customerCode ?? "",
    customerName: order.customerName ?? "",
    salesEmployeeCode: order.salesEmployeeCode ?? "",
    receiverName: order.receiverName ?? "",
    receiverPhone: order.receiverPhone ?? "",
    receiverAddress: order.receiverAddress ?? "",
    deliveryKm: order.deliveryKm ?? null,
    region: order.region ?? "",
    setNo: row?.setNo ?? "",
    lineType,
    lineNo,
    productName: row?.productName ?? "",
    productCode: row?.productCode ?? "",
    model: row?.model ?? "",
    unit: row?.unit ?? "",
    panelInfo: row?.panelInfo ?? "",
    openingDirection: row?.openingDirection ?? "",
    trimDirection: row?.trimDirection ?? "",
    paintColor: row?.paintColor ?? "",
    heightMm: finiteNumber(row?.heightMm),
    widthMm: finiteNumber(row?.widthMm),
    frameMm: finiteNumber(row?.frameMm),
    clearHeightMm: finiteNumber(row?.clearHeightMm),
    clearWidthMm: finiteNumber(row?.clearWidthMm),
    trimBarsPerSet: finiteNumber(row?.trimBarsPerSet),
    trimType: row?.trimType ?? "",
    lockModel: row?.lockModel ?? "",
    windowBars: row?.windowBars ?? "",
    leavesPerSet: finiteNumber(row?.leavesPerSet),
    quantity: finiteNumber(row?.quantity),
    pricingQuantity: finiteNumber(row?.pricingQuantity),
    unitPrice: toNumber(row?.unitPrice),
    amount: toNumber(row?.amount),
    note: row?.note ?? "",
    imagePath: row?.imagePath ?? "",
    shippingFee: toNumber(order.shippingFee),
    subtotal: toNumber(order.subtotal),
    discountPercent: toNumber(order.discountPercent),
    discountAmount: toNumber(order.discountAmount),
    totalAfterDiscount: toNumber(order.totalAfterDiscount),
    depositAmount: toNumber(order.depositAmount),
  });
}

function styleDataRow(row: ExcelJS.Row, main: boolean) {
  row.alignment = { vertical: "top", wrapText: true };
  row.height = 22;
  if (main) {
    row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE0F7FA" } };
    row.font = { bold: true, color: { argb: "FF0F172A" } };
  }
  row.eachCell({ includeEmpty: true }, (cell) => {
    cell.border = {
      top: { style: "thin", color: { argb: "FFE2E8F0" } },
      left: { style: "thin", color: { argb: "FFE2E8F0" } },
      bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
      right: { style: "thin", color: { argb: "FFE2E8F0" } },
    };
  });
}

function finiteNumber(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function toNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(String(value));
  return Number.isFinite(n) ? n : null;
}

function statusLabel(value: string) {
  const labels: Record<string, string> = {
    NHAP: "Nháp",
    CHO_XAC_NHAN: "Chờ xác nhận",
    DA_XAC_NHAN: "Đã xác nhận",
    CHUYEN_SAN_XUAT: "Đã chuyển sản xuất",
    HUY: "Đã hủy",
  };
  return labels[value] ?? value;
}

function parseDealerFilter(value: unknown) {
  const text = clean(value);
  if (!text) return null;
  if (text.startsWith("C:")) return { kind: "code" as const, value: text.slice(2) };
  if (text.startsWith("N:")) return { kind: "name" as const, value: text.slice(2) };
  return { kind: "code" as const, value: text };
}

function resolveDateFilter(query: OrderQuery) {
  const from = parseIsoDate(query.from);
  const to = parseIsoDate(query.to);
  if (from || to) {
    return {
      ...(from ? { gte: from } : {}),
      ...(to ? { lte: to } : {}),
    };
  }

  const exact = parseIsoDate(query.date);
  if (exact) return { equals: exact };

  const monthText = clean(query.month);
  const monthMatch = /^(\d{4})-(\d{2})$/.exec(monthText);
  if (monthMatch) {
    const year = Number(monthMatch[1]);
    const month = Number(monthMatch[2]);
    if (month >= 1 && month <= 12) {
      return {
        gte: new Date(Date.UTC(year, month - 1, 1)),
        lt: new Date(Date.UTC(year, month, 1)),
      };
    }
  }

  const year = Number(clean(query.year));
  if (Number.isInteger(year) && year >= 2000 && year <= 2100) {
    return {
      gte: new Date(Date.UTC(year, 0, 1)),
      lt: new Date(Date.UTC(year + 1, 0, 1)),
    };
  }

  return null;
}

function parseIsoDate(value: unknown) {
  const text = clean(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return null;
  const [year, month, day] = text.split("-").map(Number);
  if (!year || !month || !day) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) return null;
  return date;
}

function clean(value: unknown) {
  if (value === null || value === undefined) return "";
  const text = String(value).trim();
  return text === "-" || text === "—" ? "" : text;
}
