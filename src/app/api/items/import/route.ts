import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseItemMasterWorkbook } from "@/lib/item-excel";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ ok: false, error: "Vui lòng chọn file Excel." }, { status: 400 });
    }
    if (!file.name.toLowerCase().endsWith(".xlsx")) {
      return NextResponse.json({ ok: false, error: "Chỉ hỗ trợ file .xlsx." }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const parsed = await parseItemMasterWorkbook(buffer);
    const codes = parsed.items.map((item) => item.code);
    const skippedRows = parsed.issues.reduce((sum, issue) => sum + issue.rows.length, 0);
    const existing = await prisma.itemMaster.findMany({ where: { code: { in: codes } } });
    const existingByCode = new Map(existing.map((item) => [item.code, item]));

    const newRows = parsed.items.filter((item) => !existingByCode.has(item.code));
    const changedRows = parsed.items.filter((item) => {
      const current = existingByCode.get(item.code);
      return Boolean(current && current.name !== item.name);
    });
    const unchangedRows = parsed.items.filter((item) => {
      const current = existingByCode.get(item.code);
      return Boolean(current && current.name === item.name);
    });

    await prisma.$transaction(async (tx) => {
      if (newRows.length) {
        await tx.itemMaster.createMany({
          data: newRows.map((item) => ({
            code: item.code,
            name: item.name,
            active: true,
            source: "EXCEL",
            lastSourceFile: file.name,
            lastImportedAt: new Date(),
          })),
        });
      }

      for (const item of changedRows) {
        await tx.itemMaster.update({
          where: { code: item.code },
          data: {
            name: item.name,
            source: "EXCEL",
            lastSourceFile: file.name,
            lastImportedAt: new Date(),
          },
        });
      }

      if (unchangedRows.length) {
        await tx.itemMaster.updateMany({
          where: { code: { in: unchangedRows.map((item) => item.code) } },
          data: { lastSourceFile: file.name, lastImportedAt: new Date() },
        });
      }

      await tx.itemMasterImport.create({
        data: {
          fileName: file.name,
          fileHash: parsed.fileHash,
          sheetName: parsed.sheetName,
          totalRows: parsed.totalRows,
          newCount: newRows.length,
          changedCount: changedRows.length,
          unchangedCount: unchangedRows.length,
          skippedCount: skippedRows,
          errorCount: skippedRows,
          issues: parsed.issues,
        },
      });
    });

    return NextResponse.json({
      ok: true,
      summary: {
        fileName: file.name,
        sheetName: parsed.sheetName,
        totalRows: parsed.totalRows,
        newCount: newRows.length,
        changedCount: changedRows.length,
        unchangedCount: unchangedRows.length,
        skippedCount: skippedRows,
        issues: parsed.issues,
      },
    });
  } catch (error) {
    console.error("Item master import failed:", error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Không thể nhập danh mục hàng hóa." },
      { status: 400 },
    );
  }
}
