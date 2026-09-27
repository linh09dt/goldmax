import ExcelJS from "exceljs";
import { prisma } from "@/lib/prisma";
import { loadActiveStages } from "@/lib/production/service";
import { buildStagePlanGrid } from "@/lib/production/scheduling";
import type { ProductionTaskRow } from "@/lib/production/catalog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * V159b — XUẤT EXCEL “BẢNG KẾ HOẠCH THEO NGÀY”.
 *
 * Tham số: `?thang=YYYY-MM` (mặc định tháng hiện tại theo giờ VN).
 * Sheet 1 “Ke hoach theo ngay”: hàng = công đoạn, mỗi ngày 2 cột con KH / TT, cuối cùng là Tổng tháng,
 *   kèm hàng Tổng ngày và hàng Lũy kế tới ngày.
 * Sheet 2 “Du lieu”: dạng dài (Công đoạn · Ngày · Kế hoạch · Thực tế) để dễ pivot.
 */

const WEEKDAY_LABELS = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const requested = String(url.searchParams.get("thang") ?? "").match(/^(\d{4})-(\d{2})$/);
    const now = new Date();
    const month = requested
      ? new Date(Date.UTC(Number(requested[1]), Number(requested[2]) - 1, 1))
      : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const monthKey = `${month.getUTCFullYear()}-${String(month.getUTCMonth() + 1).padStart(2, "0")}`;

    const [stages, tasks] = await Promise.all([
      loadActiveStages(),
      prisma.productionTask.findMany({
        select: {
          setId: true,
          stageCode: true,
          status: true,
          qtyExpected: true,
          qtyDone: true,
          plannedStart: true,
          targetStart: true,
          actualEnd: true,
          seq: true,
        },
      }),
    ]);
    const grid = buildStagePlanGrid({ stages, tasks: tasks as unknown as ProductionTaskRow[], month });

    const workbook = new ExcelJS.Workbook();
    workbook.creator = "Door Production ERP";
    workbook.created = new Date();

    const sheet = workbook.addWorksheet("Ke hoach theo ngay");
    const dayCount = grid.days.length;
    // Cột 1 = Công đoạn · mỗi ngày 2 cột (KH, TT) · 2 cột cuối = Tổng tháng (KH, TT).
    const lastCol = 1 + dayCount * 2 + 2;

    sheet.getColumn(1).width = 36;
    for (let index = 0; index < dayCount * 2; index += 1) sheet.getColumn(2 + index).width = 5.5;
    sheet.getColumn(lastCol - 1).width = 8;
    sheet.getColumn(lastCol).width = 8;

    sheet.mergeCells(1, 1, 1, lastCol);
    const title = sheet.getCell(1, 1);
    title.value = `KẾ HOẠCH SẢN XUẤT THEO NGÀY — THÁNG ${month.getUTCMonth() + 1}/${month.getUTCFullYear()}`;
    title.font = { bold: true, size: 13, color: { argb: "FF0F172A" } };
    title.alignment = { horizontal: "center", vertical: "middle" };
    sheet.getRow(1).height = 22;

    // Hàng 2 nhãn ngày (gộp 2 cột) + hàng 3 nhãn KH/TT.
    sheet.mergeCells(2, 1, 3, 1);
    const nameHeader = sheet.getCell(2, 1);
    nameHeader.value = "Công đoạn";
    sheet.mergeCells(2, lastCol - 1, 2, lastCol);
    const totalHeader = sheet.getCell(2, lastCol - 1);
    totalHeader.value = "Tổng tháng";

    grid.days.forEach((day, index) => {
      const col = 2 + index * 2;
      sheet.mergeCells(2, col, 2, col + 1);
      const cell = sheet.getCell(2, col);
      cell.value = `${day.getUTCDate()} (${WEEKDAY_LABELS[day.getUTCDay()]})`;
      sheet.getCell(3, col).value = "KH";
      sheet.getCell(3, col + 1).value = "TT";
    });
    sheet.getCell(3, lastCol - 1).value = "KH";
    sheet.getCell(3, lastCol).value = "TT";

    const headerStyle = (rowNumber: number) => {
      const row = sheet.getRow(rowNumber);
      row.font = { bold: true, size: 10, color: { argb: "FFFFFFFF" } };
      row.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
      row.eachCell({ includeEmpty: true }, (cell) => {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E293B" } };
        cell.border = { top: { style: "thin" }, left: { style: "thin" }, bottom: { style: "thin" }, right: { style: "thin" } };
      });
    };
    headerStyle(2);
    headerStyle(3);

    let rowNumber = 4;
    const writeValueRow = (label: string, planned: number[], actual: number[], total: [number, number], bold: boolean, fill?: string) => {
      const row = sheet.getRow(rowNumber);
      sheet.getCell(rowNumber, 1).value = label;
      planned.forEach((value, index) => {
        if (value !== 0) sheet.getCell(rowNumber, 2 + index * 2).value = value;
      });
      actual.forEach((value, index) => {
        if (value !== 0) sheet.getCell(rowNumber, 3 + index * 2).value = value;
      });
      sheet.getCell(rowNumber, lastCol - 1).value = total[0];
      sheet.getCell(rowNumber, lastCol).value = total[1];
      row.font = { bold, size: 10 };
      row.eachCell({ includeEmpty: true }, (cell) => {
        cell.border = { top: { style: "thin", color: { argb: "FFE2E8F0" } }, left: { style: "thin", color: { argb: "FFE2E8F0" } }, bottom: { style: "thin", color: { argb: "FFE2E8F0" } }, right: { style: "thin", color: { argb: "FFE2E8F0" } } };
        if (fill) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: fill } };
      });
      rowNumber += 1;
    };

    for (const stageRow of grid.rows) {
      writeValueRow(
        `${stageRow.stageName}`,
        stageRow.cells.map((cell) => cell.planned),
        stageRow.cells.map((cell) => cell.actual),
        [stageRow.plannedTotal, stageRow.actualTotal],
        false,
      );
    }
    writeValueRow(
      "TỔNG NGÀY",
      grid.dailyTotals.map((total) => total.planned),
      grid.dailyTotals.map((total) => total.actual),
      [grid.plannedTotal, grid.actualTotal],
      true,
      "FFF1F5F9",
    );
    writeValueRow(
      "LŨY KẾ TỚI NGÀY",
      grid.cumulative.map((total) => total.planned),
      grid.cumulative.map((total) => total.actual),
      [grid.plannedTotal, grid.actualTotal],
      true,
      "FFE2E8F0",
    );

    sheet.views = [{ state: "frozen", xSplit: 1, ySplit: 3 }];

    // Sheet 2 — dạng dài để pivot / lọc.
    const dataSheet = workbook.addWorksheet("Du lieu");
    dataSheet.columns = [
      { header: "Công đoạn", key: "stage", width: 36 },
      { header: "Ngày", key: "day", width: 13 },
      { header: "Kế hoạch", key: "planned", width: 12 },
      { header: "Thực tế", key: "actual", width: 12 },
    ];
    dataSheet.getRow(1).font = { bold: true };
    for (const stageRow of grid.rows) {
      stageRow.cells.forEach((cell, index) => {
        if (cell.planned === 0 && cell.actual === 0) return;
        dataSheet.addRow({
          stage: stageRow.stageName,
          day: `${String(grid.days[index].getUTCDate()).padStart(2, "0")}/${String(grid.days[index].getUTCMonth() + 1).padStart(2, "0")}/${grid.days[index].getUTCFullYear()}`,
          planned: cell.planned,
          actual: cell.actual,
        });
      });
    }

    const buffer = await workbook.xlsx.writeBuffer();
    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="ke-hoach-theo-ngay-${monthKey}.xlsx"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("Export stage plan Excel failed:", error);
    return Response.json(
      { ok: false, error: error instanceof Error ? error.message : "Không thể xuất bảng kế hoạch theo ngày." },
      { status: 500 },
    );
  }
}
