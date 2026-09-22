import { NextResponse } from "next/server";
import { parseOrderInputTemplate } from "@/lib/order-input-template";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_FILE_SIZE = 20 * 1024 * 1024;
const ALLOWED_EXTENSIONS = [".xlsb", ".xlsx"];

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ ok: false, error: "Chưa chọn file Excel." }, { status: 400 });
    }

    const lowerName = file.name.toLowerCase();
    if (!ALLOWED_EXTENSIONS.some((extension) => lowerName.endsWith(extension))) {
      return NextResponse.json({ ok: false, error: "Chỉ hỗ trợ mẫu đơn hàng .xlsb hoặc .xlsx." }, { status: 400 });
    }
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ ok: false, error: "File vượt quá giới hạn 20 MB." }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const parsed = parseOrderInputTemplate(buffer, file.name);

    return NextResponse.json({
      ok: true,
      fileName: file.name,
      sheetName: parsed.sheetName,
      importedItems: parsed.importedItems,
      importedDetails: parsed.importedDetails,
      ignoredRows: parsed.ignoredRows,
      warnings: parsed.warnings,
      form: parsed.form,
    });
  } catch (error) {
    console.error("Import order input template failed:", error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Không thể đọc mẫu Excel đơn hàng." },
      { status: 400 },
    );
  }
}
