import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { MASTER_OPTION_GROUPS, parseItemAttributeWorkbook } from "@/lib/item-attribute-excel";
import { buildPriceAttributeIndex, findItemPriceMatch } from "@/lib/item-price-match";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ ok: false, error: "Vui lòng chọn file Excel đơn giá/ĐVT/màu." }, { status: 400 });
    }
    if (!file.name.toLowerCase().endsWith(".xlsx")) {
      return NextResponse.json({ ok: false, error: "Chỉ hỗ trợ file .xlsx." }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const parsed = await parseItemAttributeWorkbook(buffer);
    const currentItems = await prisma.itemMaster.findMany({
      select: { id: true, code: true, name: true, unit: true, dealerPrice: true },
    });

    const priceIndex = buildPriceAttributeIndex(parsed.attributes);
    const now = new Date();
    const matches = currentItems.flatMap((item) => {
      const match = findItemPriceMatch(item, priceIndex);
      return match ? [{ item, match }] : [];
    });

    const matchedItemIds = new Set(matches.map((row) => row.item.id));
    const unmatchedItemCount = currentItems.filter((item) => !matchedItemIds.has(item.id)).length;
    const usedPriceModels = new Set(matches.map((row) => normalizeKey(row.match.priceModelCode)));
    const unusedPriceModelCount = parsed.attributes.filter((row) => !usedPriceModels.has(normalizeKey(row.code))).length;

    let changedItemCount = 0;
    for (const row of matches) {
      const currentPrice = decimalToNumber(row.item.dealerPrice);
      const nextPrice = row.match.attribute.dealerPrice;
      const currentUnit = (row.item.unit ?? "").trim();
      const nextUnit = (row.match.attribute.unit ?? "").trim();
      if (currentUnit !== nextUnit || currentPrice !== nextPrice) changedItemCount += 1;
    }

    const matchCounts = {
      directCode: matches.filter((row) => row.match.method === "MA_HANG").length,
      directName: matches.filter((row) => row.match.method === "TEN_HANG").length,
      doorFamily: matches.filter((row) => row.match.method === "NHOM_GIA_CUA").length,
      windowFamily: matches.filter((row) => row.match.method === "NHOM_GIA_CUA_SO").length,
    };

    await prisma.$transaction(async (tx) => {
      for (const row of matches) {
        await tx.itemMaster.update({
          where: { id: row.item.id },
          data: {
            unit: row.match.attribute.unit || null,
            dealerPrice: row.match.attribute.dealerPrice,
            priceSourceFile: file.name,
            priceImportedAt: now,
          },
        });
      }

      for (const option of parsed.options) {
        await tx.masterOption.upsert({
          where: { groupCode_code: { groupCode: option.groupCode, code: option.code } },
          create: {
            groupCode: option.groupCode,
            code: option.code,
            name: option.name,
            sortOrder: option.sortOrder,
            active: true,
            source: "EXCEL_DON_GIA",
            lastSourceFile: file.name,
            lastImportedAt: now,
          },
          update: {
            name: option.name,
            sortOrder: option.sortOrder,
            source: "EXCEL_DON_GIA",
            lastSourceFile: file.name,
            lastImportedAt: now,
          },
        });
      }

      await tx.itemAttributeImport.create({
        data: {
          fileName: file.name,
          fileHash: parsed.fileHash,
          sheetName: parsed.sheetName,
          totalPriceRows: parsed.totalPriceRows,
          updatedItemCount: changedItemCount,
          missingItemCount: unmatchedItemCount,
          optionCount: parsed.options.length,
          issueCount: parsed.issues.length,
          issues: parsed.issues,
        },
      });
    });

    const optionCounts = Object.fromEntries(
      Object.keys(MASTER_OPTION_GROUPS).map((groupCode) => [groupCode, parsed.options.filter((option) => option.groupCode === groupCode).length]),
    );

    return NextResponse.json({
      ok: true,
      summary: {
        fileName: file.name,
        sheetName: parsed.sheetName,
        totalPriceRows: parsed.totalPriceRows,
        matchedItemCount: matches.length,
        changedItemCount,
        updatedItemCount: changedItemCount,
        unmatchedItemCount,
        missingItemCount: unmatchedItemCount,
        unusedPriceModelCount,
        matchCounts,
        optionCount: parsed.options.length,
        optionCounts,
        issues: parsed.issues,
      },
    });
  } catch (error) {
    console.error("Item attribute import failed:", error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Không thể nhập đơn giá, ĐVT và danh mục cấu hình." },
      { status: 400 },
    );
  }
}

function decimalToNumber(value: unknown) {
  if (value === null || value === undefined) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function normalizeKey(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "")
    .trim();
}
