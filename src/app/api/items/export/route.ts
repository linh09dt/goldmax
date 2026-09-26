import ExcelJS from "exceljs";
import { prisma } from "@/lib/prisma";
import { itemCategoryLabel, resolveItemCategory } from "@/lib/item-category";

export const runtime = "nodejs";

export async function GET() {
  const items = await prisma.itemMaster.findMany({
    orderBy: [{ name: "asc" }, { code: "asc" }],
  });

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Danh mục hàng hóa");
  sheet.columns = [
    { header: "STT", key: "stt", width: 8 },
    { header: "TENHANG", key: "name", width: 28 },
    { header: "TÊN SẢN PHẨM DIỄN GIẢI", key: "productDescription", width: 48 },
    { header: "MODEL", key: "code", width: 38 },
    { header: "PHÂN LOẠI", key: "category", width: 18 },
    { header: "ĐVT", key: "unit", width: 12 },
    { header: "GIÁ ĐẠI LÝ", key: "dealerPrice", width: 18 },
    { header: "GIÁ BÁN LẺ", key: "retailPrice", width: 18 },
    { header: "TRẠNG THÁI", key: "status", width: 18 },
  ];

  items.forEach((item, index) => {
    sheet.addRow({
      stt: index + 1,
      name: item.name,
      productDescription: item.productDescription ?? "",
      code: item.code,
      category: itemCategoryLabel(resolveItemCategory(item.category, item.name)),
      unit: item.unit ?? "",
      dealerPrice: item.dealerPrice === null ? null : Number(item.dealerPrice),
      retailPrice: item.retailPrice === null ? null : Number(item.retailPrice),
      status: item.active ? "Đang sử dụng" : "Ngưng sử dụng",
    });
  });

  const header = sheet.getRow(1);
  header.font = { bold: true, color: { argb: "FFFFFFFF" } };
  header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F172A" } };
  header.alignment = { vertical: "middle", horizontal: "center" };
  sheet.views = [{ state: "frozen", ySplit: 1 }];
  sheet.autoFilter = { from: "A1", to: "H1" };
  sheet.getColumn("dealerPrice").numFmt = "#,##0";
  sheet.getColumn("retailPrice").numFmt = "#,##0";

  const buffer = await workbook.xlsx.writeBuffer();
  const responseBody = new Uint8Array(buffer);

  return new Response(responseBody, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="masterdata-danh-muc-hang-hoa.xlsx"',
    },
  });
}
