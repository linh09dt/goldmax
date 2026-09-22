import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const MAX_IMAGE_SIZE = 8 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ ok: false, error: "Chưa chọn hình ảnh." }, { status: 400 });
    }
    if (!ALLOWED_TYPES.has(file.type)) {
      return NextResponse.json({ ok: false, error: "Chỉ hỗ trợ JPG, PNG hoặc WEBP." }, { status: 400 });
    }
    if (file.size > MAX_IMAGE_SIZE) {
      return NextResponse.json({ ok: false, error: "Hình ảnh vượt quá giới hạn 8 MB." }, { status: 400 });
    }

    const extension = file.type === "image/png" ? ".png" : file.type === "image/webp" ? ".webp" : ".jpg";
    const fileName = `${Date.now()}-${randomUUID()}${extension}`;
    const relativeDirectory = path.join("uploads", "orders");
    const absoluteDirectory = path.join(process.cwd(), "public", relativeDirectory);
    await mkdir(absoluteDirectory, { recursive: true });
    await writeFile(path.join(absoluteDirectory, fileName), Buffer.from(await file.arrayBuffer()));

    return NextResponse.json({
      ok: true,
      path: `/${relativeDirectory.replaceAll(path.sep, "/")}/${fileName}`,
      note: "Đang dùng lưu trữ local. Khi chuyển Supabase sẽ thay adapter lưu trữ, không đổi dữ liệu đơn hàng.",
    });
  } catch (error) {
    console.error("Upload order image failed:", error);
    return NextResponse.json({ ok: false, error: "Không thể lưu hình ảnh." }, { status: 500 });
  }
}
