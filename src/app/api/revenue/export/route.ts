import ExcelJS from "exceljs";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RevenueQuery = {
  date?: string;
  month?: string;
  year?: string;
  from?: string;
  to?: string;
  dealer?: string;
  customer?: string;
};

type RevenueProduct = {
  productName: string | null;
  productCode: string | null;
  model: string | null;
  quantity: number | null;
  unit: string | null;
  pricingQuantity: number | null;
  unitPrice: unknown;
  amount: unknown;
  note: string | null;
};

type MasterProduct = {
  id: number;
  code: string;
  name: string;
  productDescription: string | null;
  salesModel: string | null;
  unit: string | null;
};

type ProductRevenueRow = {
  masterId: number;
  code: string;
  name: string;
  productDescription: string | null;
  unit: string | null;
  orderIds: Set<number>;
  quantity: number;
  pricingQuantity: number;
  revenue: number;
};

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const query: RevenueQuery = {
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
      orderBy: [{ orderDate: "desc" }, { id: "desc" }],
      include: {
        items: {
          orderBy: { lineNo: "asc" },
          include: { details: { orderBy: { rowOrder: "asc" } } },
        },
      },
    });

    const masterProducts: MasterProduct[] = await prisma.itemMaster.findMany({
      orderBy: [{ name: "asc" }, { code: "asc" }],
      select: {
        id: true,
        code: true,
        name: true,
        productDescription: true,
        salesModel: true,
        unit: true,
      },
    });

    const reportRows = orders.map((order) => {
      const products: RevenueProduct[] = [];

      for (const item of order.items) {
        const main: RevenueProduct = {
          productName: item.productName,
          productCode: item.productCode,
          model: item.model,
          quantity: item.quantity,
          unit: item.unit,
          pricingQuantity: item.pricingQuantity,
          unitPrice: item.unitPrice,
          amount: item.amount,
          note: item.note,
        };
        if (hasProductData(main)) products.push(main);

        for (const detail of item.details) {
          const child: RevenueProduct = {
            productName: detail.productName,
            productCode: detail.productCode,
            model: detail.model,
            quantity: detail.quantity,
            unit: detail.unit,
            pricingQuantity: detail.pricingQuantity,
            unitPrice: detail.unitPrice,
            amount: detail.amount,
            note: detail.note,
          };
          if (hasProductData(child)) products.push(child);
        }
      }

      const goodsTotal = products.reduce((sum, product) => sum + resolvedLineAmount(product), 0);
      const shippingFee = toNumber(order.shippingFee) ?? 0;
      const total = toNumber(order.subtotal) ?? roundMoney(goodsTotal + shippingFee);
      const discountPercent = toNumber(order.discountPercent) ?? 0;
      const discountAmount = toNumber(order.discountAmount) ?? roundMoney((total * discountPercent) / 100);
      const afterDiscount = toNumber(order.totalAfterDiscount) ?? roundMoney(Math.max(0, total - discountAmount));
      const deposit = toNumber(order.depositAmount) ?? 0;
      const warehouseDeduction = toNumber(order.warehouseReceiptDeduction) ?? 0;
      const remaining = toNumber(order.deliveryPayment) ?? roundMoney(Math.max(0, afterDiscount - deposit - warehouseDeduction));

      return {
        order,
        products,
        goodsTotal,
        shippingFee,
        total,
        discountPercent,
        discountAmount,
        afterDiscount,
        deposit,
        warehouseDeduction,
        remaining,
      };
    });

    const workbook = new ExcelJS.Workbook();
    workbook.creator = "Door Production ERP";
    workbook.created = new Date();

    const orderSheet = workbook.addWorksheet("Doanh thu đơn hàng", {
      views: [{ state: "frozen", ySplit: 1 }],
    });
    orderSheet.columns = [
      { header: "STT", key: "stt", width: 7 },
      { header: "Ngày", key: "orderDate", width: 14 },
      { header: "Mã ĐL", key: "customerCode", width: 14 },
      { header: "Tên ĐL", key: "customerName", width: 24 },
      { header: "Số đơn hàng", key: "orderCode", width: 22 },
      { header: "Loại đơn hàng", key: "orderType", width: 16 },
      { header: "Tiền hàng", key: "goodsTotal", width: 16 },
      { header: "Cước vận chuyển", key: "shippingFee", width: 16 },
      { header: "Tổng tiền", key: "total", width: 16 },
      { header: "% CK", key: "discountPercent", width: 11 },
      { header: "Tiền CK", key: "discountAmount", width: 16 },
      { header: "Tổng sau CK", key: "afterDiscount", width: 16 },
      { header: "Đặt cọc", key: "deposit", width: 16 },
      { header: "Trừ phiếu kho", key: "warehouseDeduction", width: 16 },
      { header: "Còn lại", key: "remaining", width: 16 },
      { header: "Người nhận", key: "receiverName", width: 20 },
      { header: "SĐT", key: "receiverPhone", width: 15 },
      { header: "Địa chỉ nhận", key: "receiverAddress", width: 38 },
    ];

    reportRows.forEach((row, index) => {
      orderSheet.addRow({
        stt: index + 1,
        orderDate: row.order.orderDate ?? null,
        customerCode: row.order.customerCode ?? "",
        customerName: row.order.customerName ?? "",
        orderCode: row.order.orderCode,
        orderType: "Sản xuất",
        goodsTotal: row.goodsTotal,
        shippingFee: row.shippingFee,
        total: row.total,
        discountPercent: row.discountPercent,
        discountAmount: row.discountAmount,
        afterDiscount: row.afterDiscount,
        deposit: row.deposit,
        warehouseDeduction: row.warehouseDeduction,
        remaining: row.remaining,
        receiverName: row.order.receiverName ?? "",
        receiverPhone: row.order.receiverPhone ?? "",
        receiverAddress: row.order.receiverAddress ?? "",
      });
    });
    styleSheet(orderSheet);
    orderSheet.getColumn("orderDate").numFmt = "dd/mm/yyyy";
    setMoneyColumns(orderSheet, ["goodsTotal", "shippingFee", "total", "discountAmount", "afterDiscount", "deposit", "warehouseDeduction", "remaining"]);
    orderSheet.getColumn("discountPercent").numFmt = "0.##";

    const detailSheet = workbook.addWorksheet("Hàng hóa theo đơn", {
      views: [{ state: "frozen", ySplit: 1 }],
    });
    detailSheet.columns = [
      { header: "STT", key: "stt", width: 7 },
      { header: "Ngày", key: "orderDate", width: 14 },
      { header: "Số đơn hàng", key: "orderCode", width: 22 },
      { header: "Mã ĐL", key: "customerCode", width: 14 },
      { header: "Tên ĐL", key: "customerName", width: 24 },
      { header: "Người nhận", key: "receiverName", width: 20 },
      { header: "Bộ số", key: "setNo", width: 12 },
      { header: "Loại dòng", key: "lineType", width: 28 },
      { header: "STT dòng", key: "lineNo", width: 10 },
      { header: "Tên sản phẩm", key: "productName", width: 28 },
      { header: "Mã hàng", key: "productCode", width: 22 },
      { header: "Model", key: "model", width: 22 },
      { header: "ĐVT", key: "unit", width: 10 },
      { header: "Số lượng", key: "quantity", width: 12 },
      { header: "KH/Lượng", key: "pricingQuantity", width: 12 },
      { header: "Đơn giá", key: "unitPrice", width: 16 },
      { header: "Thành tiền", key: "amount", width: 18 },
      { header: "Ghi chú", key: "note", width: 36 },
      { header: "Hình ảnh SP", key: "imagePath", width: 36 },
    ];

    let detailNo = 0;
    for (const report of reportRows) {
      for (const item of report.order.items) {
        detailNo += 1;
        addDetailRow(detailSheet, detailNo, report.order, {
          setNo: item.setNo,
          lineType: "Bộ cửa / hàng chính",
          lineNo: item.lineNo,
          productName: item.productName,
          productCode: item.productCode,
          model: item.model,
          unit: item.unit,
          quantity: item.quantity,
          pricingQuantity: item.pricingQuantity,
          unitPrice: item.unitPrice,
          amount: item.amount,
          note: item.note,
          imagePath: item.imagePath,
        });
        styleDetailRow(detailSheet.getRow(detailSheet.rowCount), true);

        for (const detail of item.details) {
          detailNo += 1;
          addDetailRow(detailSheet, detailNo, report.order, {
            setNo: detail.setNo,
            lineType: "Chi tiết / phụ kiện / phụ phí",
            lineNo: `${item.lineNo}.${detail.rowOrder}`,
            productName: detail.productName,
            productCode: detail.productCode,
            model: detail.model,
            unit: detail.unit,
            quantity: detail.quantity,
            pricingQuantity: detail.pricingQuantity,
            unitPrice: detail.unitPrice,
            amount: detail.amount,
            note: detail.note,
            imagePath: detail.imagePath,
          });
          styleDetailRow(detailSheet.getRow(detailSheet.rowCount), false);
        }
      }
    }
    styleSheet(detailSheet);
    detailSheet.getColumn("orderDate").numFmt = "dd/mm/yyyy";
    detailSheet.getColumn("quantity").numFmt = "#,##0.####";
    detailSheet.getColumn("pricingQuantity").numFmt = "#,##0.####";
    setMoneyColumns(detailSheet, ["unitPrice", "amount"]);

    const productRevenueRows = buildProductRevenue(reportRows, masterProducts);
    const productSheet = workbook.addWorksheet("Doanh thu sản phẩm", {
      views: [{ state: "frozen", ySplit: 1 }],
    });
    productSheet.columns = [
      { header: "STT", key: "stt", width: 7 },
      { header: "TENHANG", key: "name", width: 26 },
      { header: "Tên sản phẩm diễn giải", key: "description", width: 36 },
      { header: "MODEL", key: "code", width: 22 },
      { header: "ĐVT", key: "unit", width: 10 },
      { header: "Số đơn", key: "orderCount", width: 12 },
      { header: "Tổng SL", key: "quantity", width: 14 },
      { header: "Tổng KH/Lượng", key: "pricingQuantity", width: 16 },
      { header: "Doanh thu", key: "revenue", width: 18 },
    ];
    productRevenueRows.forEach((row, index) => {
      productSheet.addRow({
        stt: index + 1,
        name: row.name,
        description: row.productDescription || row.name,
        code: row.code,
        unit: row.unit ?? "",
        orderCount: row.orderIds.size,
        quantity: row.quantity,
        pricingQuantity: row.pricingQuantity,
        revenue: row.revenue,
      });
    });
    styleSheet(productSheet);
    productSheet.getColumn("quantity").numFmt = "#,##0.####";
    productSheet.getColumn("pricingQuantity").numFmt = "#,##0.####";
    productSheet.getColumn("revenue").numFmt = "#,##0";

    const buffer = await workbook.xlsx.writeBuffer();
    const stamp = new Date().toISOString().slice(0, 10).replaceAll("-", "");

    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="theo-doi-doanh-thu-${stamp}.xlsx"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("Export revenue Excel failed:", error);
    return Response.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Không thể xuất Excel doanh thu.",
      },
      { status: 500 },
    );
  }
}

type DetailExportInput = {
  setNo: string | null;
  lineType: string;
  lineNo: number | string;
  productName: string | null;
  productCode: string | null;
  model: string | null;
  unit: string | null;
  quantity: number | null;
  pricingQuantity: number | null;
  unitPrice: unknown;
  amount: unknown;
  note: string | null;
  imagePath: string | null;
};

function addDetailRow(
  sheet: ExcelJS.Worksheet,
  stt: number,
  order: {
    orderDate: Date | null;
    orderCode: string;
    customerCode: string | null;
    customerName: string | null;
    receiverName: string | null;
  },
  line: DetailExportInput,
) {
  const product: RevenueProduct = {
    productName: line.productName,
    productCode: line.productCode,
    model: line.model,
    quantity: line.quantity,
    unit: line.unit,
    pricingQuantity: line.pricingQuantity,
    unitPrice: line.unitPrice,
    amount: line.amount,
    note: line.note,
  };

  sheet.addRow({
    stt,
    orderDate: order.orderDate ?? null,
    orderCode: order.orderCode,
    customerCode: order.customerCode ?? "",
    customerName: order.customerName ?? "",
    receiverName: order.receiverName ?? "",
    setNo: line.setNo ?? "",
    lineType: line.lineType,
    lineNo: line.lineNo,
    productName: line.productName ?? "",
    productCode: line.productCode ?? "",
    model: line.model ?? "",
    unit: line.unit ?? "",
    quantity: finiteNumber(line.quantity),
    pricingQuantity: finiteNumber(line.pricingQuantity),
    unitPrice: toNumber(line.unitPrice),
    amount: resolvedLineAmount(product),
    note: line.note ?? "",
    imagePath: line.imagePath ?? "",
  });
}

function styleSheet(sheet: ExcelJS.Worksheet) {
  const header = sheet.getRow(1);
  header.height = 30;
  header.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 10 };
  header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F172A" } };
  header.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  sheet.autoFilter = { from: "A1", to: sheet.getCell(1, sheet.columnCount).address };
  for (let rowNo = 2; rowNo <= sheet.rowCount; rowNo += 1) {
    const row = sheet.getRow(rowNo);
    row.alignment = { vertical: "top", wrapText: true };
    row.eachCell({ includeEmpty: true }, (cell) => {
      cell.border = {
        top: { style: "thin", color: { argb: "FFE2E8F0" } },
        left: { style: "thin", color: { argb: "FFE2E8F0" } },
        bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
        right: { style: "thin", color: { argb: "FFE2E8F0" } },
      };
    });
  }
}

function styleDetailRow(row: ExcelJS.Row, main: boolean) {
  if (!main) return;
  row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE0F7FA" } };
  row.font = { bold: true, color: { argb: "FF0F172A" } };
}

function setMoneyColumns(sheet: ExcelJS.Worksheet, keys: string[]) {
  for (const key of keys) sheet.getColumn(key).numFmt = "#,##0";
}

function buildProductRevenue(
  reportRows: Array<{ order: { id: number }; products: RevenueProduct[] }>,
  masterProducts: MasterProduct[],
) {
  const masterMap = new Map<string, MasterProduct>();
  for (const item of masterProducts) {
    masterMap.set(normalizeCode(item.code), item);
    const salesModel = normalizeCode(item.salesModel);
    if (salesModel && !masterMap.has(salesModel)) masterMap.set(salesModel, item);
  }

  const aggregate = new Map<number, ProductRevenueRow>();

  for (const report of reportRows) {
    for (const product of report.products) {
      const revenue = resolvedLineAmount(product);
      if (revenue <= 0) continue;

      const master = resolveMasterProduct(product, masterMap);
      if (!master) continue;

      const current = aggregate.get(master.id) ?? {
        masterId: master.id,
        code: master.code,
        name: master.name,
        productDescription: master.productDescription,
        unit: master.unit,
        orderIds: new Set<number>(),
        quantity: 0,
        pricingQuantity: 0,
        revenue: 0,
      };

      current.orderIds.add(report.order.id);
      current.quantity += toNumber(product.quantity) ?? 0;
      current.pricingQuantity += toNumber(product.pricingQuantity) ?? 0;
      current.revenue += revenue;
      aggregate.set(master.id, current);
    }
  }

  return Array.from(aggregate.values()).sort((a, b) => {
    if (b.revenue !== a.revenue) return b.revenue - a.revenue;
    return a.code.localeCompare(b.code, "vi");
  });
}

function resolveMasterProduct(product: RevenueProduct, masterMap: Map<string, MasterProduct>) {
  for (const candidate of [product.productCode, product.model]) {
    const key = normalizeCode(candidate);
    if (!key) continue;
    const found = masterMap.get(key);
    if (found) return found;
  }
  return null;
}

function hasProductData(product: RevenueProduct) {
  const identity = [product.productName, product.productCode, product.model].some((value) => clean(value));
  const numeric = [product.pricingQuantity, product.quantity].some(
    (value) => typeof value === "number" && value !== 0,
  );
  const money = [product.unitPrice, product.amount].some((value) => (toNumber(value) ?? 0) !== 0);
  if (!identity && !numeric && !money) return false;
  if (
    clean(product.productName).toLocaleLowerCase("vi-VN") === "khác" &&
    !clean(product.productCode) &&
    !clean(product.model) &&
    !numeric &&
    !money
  ) return false;
  return true;
}

function resolvedLineAmount(product: RevenueProduct) {
  const explicit = toNumber(product.amount);
  if (explicit !== null) return explicit;
  const pricingQuantity = toNumber(product.pricingQuantity);
  const unitPrice = toNumber(product.unitPrice);
  if (pricingQuantity === null || unitPrice === null) return 0;
  return roundMoney(pricingQuantity * unitPrice);
}

function resolveDateFilter(query: RevenueQuery) {
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

function parseDealerFilter(value: unknown) {
  const text = clean(value);
  if (!text) return null;
  if (text.startsWith("C:")) return { kind: "code" as const, value: text.slice(2) };
  if (text.startsWith("N:")) return { kind: "name" as const, value: text.slice(2) };
  return { kind: "code" as const, value: text };
}

function normalizeCode(value: unknown) {
  return clean(value).toLocaleUpperCase("vi-VN").replace(/\s+/g, "");
}

function clean(value: unknown) {
  if (value === null || value === undefined) return "";
  const text = String(value).trim();
  return text === "-" || text === "—" ? "" : text;
}

function finiteNumber(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(String(value).replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
