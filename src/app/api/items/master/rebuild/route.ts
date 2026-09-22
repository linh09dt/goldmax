import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseMasterItemWorkbookV14 } from "@/lib/item-master-v14-excel";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const file = form.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json(
        { ok: false, error: "Vui lòng chọn file Master Data Excel." },
        { status: 400 },
      );
    }

    if (!file.name.toLowerCase().endsWith(".xlsx")) {
      return NextResponse.json(
        { ok: false, error: "Chỉ hỗ trợ file .xlsx." },
        { status: 400 },
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const parsed = await parseMasterItemWorkbookV14(buffer);

    if (!parsed.items.length) {
      return NextResponse.json(
        { ok: false, error: "Không tìm thấy hàng hóa hợp lệ trong cặp cột TENHANG/MODEL." },
        { status: 400 },
      );
    }

    const skippedCount = parsed.issues.reduce(
      (sum, issue) => sum + issue.rows.length,
      0,
    );

    await prisma.$transaction(
      async (tx) => {
        // Reset đúng phạm vi Master Data hàng hóa.
        // Không đụng tới dữ liệu đơn hàng.
        await tx.itemMaster.deleteMany();
        await tx.itemMasterImport.deleteMany();

        // Master file chỉ cung cấp TENHANG + MODEL.
        // ĐVT/Giá được cấu hình riêng sau khi tạo lại Master Data.
        await tx.itemMaster.createMany({
          data: parsed.items.map((item) => ({
            code: item.model,
            name: item.name,
            salesName: item.name,
            salesModel: item.model,
            unit: null,
            dealerPrice: null,
            retailPrice: null,
            active: true,
            source: "MASTER_FILE",
            lastSourceFile: file.name,
            lastImportedAt: new Date(),
          })),
        });

        await tx.itemMasterImport.create({
          data: {
            fileName: file.name,
            fileHash: parsed.fileHash,
            sheetName: parsed.sheetName,
            totalRows: parsed.totalRows,
            newCount: parsed.items.length,
            changedCount: 0,
            unchangedCount: 0,
            skippedCount,
            errorCount: parsed.issues.length,
            issues: parsed.issues,
          },
        });
      },
      { timeout: 30_000 },
    );

    return NextResponse.json({
      ok: true,
      summary: {
        fileName: file.name,
        sheetName: parsed.sheetName,
        totalRows: parsed.totalRows,
        importedCount: parsed.items.length,
        skippedCount,
        issueCount: parsed.issues.length,
        issues: parsed.issues,
        sourceColumns: parsed.sourceColumns,
      },
    });
  } catch (error) {
    console.error("Rebuild Item Master V15 failed:", error);

    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Không thể tạo lại Danh mục hàng hóa.",
      },
      { status: 500 },
    );
  }
}
