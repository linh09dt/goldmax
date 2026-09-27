import ExcelJS from "exceljs";
import { prisma } from "@/lib/prisma";
import { loadActiveStages, loadActiveWorkCenters } from "@/lib/production/service";
import { buildStagePlanGrid } from "@/lib/production/scheduling";
import { toneForWorkCenter } from "@/lib/production/work-center-colors";
import type { ProductionTaskRow } from "@/lib/production/catalog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * V159b — XUẤT EXCEL “BẢNG KẾ HOẠCH THEO NGÀY”.
 * V159c — thêm cột **Tổ** và tô nền nhạt theo tổ (khớp màu trên màn hình).
 *
 * Tham số: `?thang=YYYY-MM` (mặc định tháng hiện tại theo giờ VN).
 * Sheet 1 “Ke hoach theo ngay”: hàng = công đoạn, mỗi ngày 2 cột con KH / TT, cuối cùng là Tổng tháng,
 *   kèm hàng Tổng ngày và hàng Lũy kế tới ngày.
 * Sheet 2 “Du lieu”: dạng dài (Tổ · Công đoạn · Ngày · Kế hoạch · Thực tế) để dễ pivot.
 */

const WEEKDAY_LABELS = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];

const THIN = { style: "thin" as const, color: { argb: "FFCBD5E1" } };
const MEDIUM = { style: "medium" as const, color: { argb: "FF94A3B8" } };

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const requested = String(url.searchParams.get("thang") ?? "").match(/^(\d{4})-(\d{2})$/);
    const now = new Date();
    const month = requested
      ? new Date(Date.UTC(Number(requested[1]), Number(requested[2]) - 1, 1))
      : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const monthKey = `${month.getUTCFullYear()}-${String(month.getUTCMonth() + 1).padStart(2, "0")}`;

    const [stages, workCenters, tasks] = await Promise.all([
      loadActiveStages(),
      loadActiveWorkCenters(),
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
    const centerNames: Record<string, string> = {};
    for (const center of workCenters) centerNames[center.code] = center.name;

    const workbook = new ExcelJS.Workbook();
    workbook.creator = "Door Production ERP";
    workbook.created = new Date();

    const sheet = workbook.addWorksheet("Ke hoach theo ngay");
    const dayCount = grid.days.length;
    // Cột 1 = Công đoạn · cột 2 = Tổ · mỗi ngày 2 cột (KH, TT) · 2 cột cuối = Tổng tháng (KH, TT).
    const firstDayCol = 3;
    const totalCol = firstDayCol + dayCount * 2;
    const lastCol = totalCol + 1;

    sheet.getColumn(1).width = 30;
    sheet.getColumn(2).width = 22;
    for (let index = 0; index < dayCount * 2; index += 1) sheet.getColumn(firstDayCol + index).width = 4.6;
    sheet.getColumn(totalCol).width = 8;
    sheet.getColumn(lastCol).width = 8;

    sheet.mergeCells(1, 1, 1, lastCol);
    const title = sheet.getCell(1, 1);
    title.value = `KẾ HOẠCH SẢN XUẤT THEO NGÀY — THÁNG ${month.getUTCMonth() + 1}/${month.getUTCFullYear()}`;
    title.font = { bold: true, size: 13, color: { argb: "FF0F172A" } };
    title.alignment = { horizontal: "center", vertical: "middle" };
    sheet.getRow(1).height = 22;

    // Hàng 2 nhãn ngày (gộp 2 cột) + hàng 3 nhãn KH/TT.
    sheet.mergeCells(2, 1, 3, 1);
    sheet.getCell(2, 1).value = "Công đoạn";
    sheet.mergeCells(2, 2, 3, 2);
    sheet.getCell(2, 2).value = "Tổ";
    sheet.mergeCells(2, totalCol, 2, lastCol);
    sheet.getCell(2, totalCol).value = "Tổng tháng";

    grid.days.forEach((day, index) => {
      const col = firstDayCol + index * 2;
      sheet.mergeCells(2, col, 2, col + 1);
      sheet.getCell(2, col).value = `${day.getUTCDate()} (${WEEKDAY_LABELS[day.getUTCDay()]})`;
      sheet.getCell(3, col).value = "KH";
      sheet.getCell(3, col + 1).value = "TT";
    });
    sheet.getCell(3, totalCol).value = "KH";
    sheet.getCell(3, lastCol).value = "TT";

    const headerStyle = (rowNumber: number) => {
      const row = sheet.getRow(rowNumber);
      row.font = { bold: true, size: 10, color: { argb: "FFFFFFFF" } };
      row.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        if (colNumber > lastCol) return;
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E293B" } };
        cell.border = { top: MEDIUM, left: colNumber === 1 ? MEDIUM : THIN, bottom: MEDIUM, right: colNumber === lastCol ? MEDIUM : THIN };
      });
    };
    headerStyle(2);
    headerStyle(3);

    let rowNumber = 4;
    const writeValueRow = (
      label: string,
      centerLabel: string,
      planned: number[],
      actual: number[],
      total: [number, number],
      bold: boolean,
      fill?: string,
    ) => {
      const row = sheet.getRow(rowNumber);
      sheet.getCell(rowNumber, 1).value = label;
      sheet.getCell(rowNumber, 2).value = centerLabel;
      planned.forEach((value, index) => {
        if (value !== 0) sheet.getCell(rowNumber, firstDayCol + index * 2).value = value;
      });
      actual.forEach((value, index) => {
        if (value !== 0) sheet.getCell(rowNumber, firstDayCol + index * 2 + 1).value = value;
      });
      sheet.getCell(rowNumber, totalCol).value = total[0];
      sheet.getCell(rowNumber, lastCol).value = total[1];
      row.font = { bold, size: 10 };
      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        if (colNumber > lastCol) return;
        cell.border = { top: THIN, left: colNumber === 1 ? MEDIUM : THIN, bottom: THIN, right: colNumber === lastCol ? MEDIUM : THIN };
        if (fill) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: fill } };
      });
      rowNumber += 1;
      return row;
    };

    const usedCenters: string[] = [];
    for (const stageRow of grid.rows) {
      const code = stageRow.workCenterCode;
      if (code && !usedCenters.includes(code)) usedCenters.push(code);
      const centerLabel = code ? centerNames[code] ?? code : "—";
      writeValueRow(
        stageRow.stageName,
        centerLabel,
        stageRow.cells.map((cell) => cell.planned),
        stageRow.cells.map((cell) => cell.actual),
        [stageRow.plannedTotal, stageRow.actualTotal],
        false,
        // V159c: tô nền nhạt theo TỔ (khớp màu trên màn hình).
        code ? toneForWorkCenter(code).hex : undefined,
      );
    }
    writeValueRow(
      "TỔNG NGÀY",
      "",
      grid.dailyTotals.map((total) => total.planned),
      grid.dailyTotals.map((total) => total.actual),
      [grid.plannedTotal, grid.actualTotal],
      true,
      "FFF1F5F9",
    );
    writeValueRow(
      "LŨY KẾ TỚI NGÀY",
      "",
      grid.cumulative.map((total) => total.planned),
      grid.cumulative.map((total) => total.actual),
      [grid.plannedTotal, grid.actualTotal],
      true,
      "FFE2E8F0",
    );

    // Chú thích màu tổ.
    rowNumber += 1;
    sheet.getCell(rowNumber, 1).value = "Màu theo tổ:";
    sheet.getCell(rowNumber, 1).font = { bold: true, size: 10 };
    for (const code of usedCenters) {
      rowNumber += 1;
      const swatch = sheet.getCell(rowNumber, 1);
      swatch.value = "";
      swatch.fill = { type: "pattern", pattern: "solid", fgColor: { argb: toneForWorkCenter(code).hex } };
      swatch.border = { top: THIN, left: THIN, bottom: THIN, right: THIN };
      const label = sheet.getCell(rowNumber, 2);
      label.value = centerNames[code] ?? code;
      label.font = { size: 10 };
      label.alignment = { vertical: "middle" };
    }

    sheet.views = [{ state: "frozen", xSplit: 2, ySplit: 3 }];

    // Sheet 2 — dạng dài để pivot / lọc.
    const dataSheet = workbook.addWorksheet("Du lieu");
    dataSheet.columns = [
      { header: "Tổ", key: "center", width: 24 },
      { header: "Công đoạn", key: "stage", width: 34 },
      { header: "Ngày", key: "day", width: 13 },
      { header: "Kế hoạch", key: "planned", width: 12 },
      { header: "Thực tế", key: "actual", width: 12 },
    ];
    dataSheet.getRow(1).font = { bold: true };
    for (const stageRow of grid.rows) {
      const centerLabel = stageRow.workCenterCode ? centerNames[stageRow.workCenterCode] ?? stageRow.workCenterCode : "—";
      stageRow.cells.forEach((cell, index) => {
        if (cell.planned === 0 && cell.actual === 0) return;
        dataSheet.addRow({
          center: centerLabel,
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
