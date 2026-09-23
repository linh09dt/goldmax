import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const MAX_IMAGE_SIZE = 8 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const DEFAULT_BUCKET = "order-images";

type StorageConfig = {
  url: string;
  key: string;
  bucket: string;
};

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
    const objectPath = `orders/${fileName}`;
    const bytes = Buffer.from(await file.arrayBuffer());
    const storage = getStorageConfig();

    if (storage) {
      await ensurePublicBucket(storage);
      const publicUrl = await uploadToSupabase(storage, objectPath, bytes, file.type);
      return NextResponse.json({ ok: true, path: publicUrl });
    }

    if (process.env.NODE_ENV === "production") {
      return NextResponse.json(
        {
          ok: false,
          error: "Thiếu cấu hình Supabase Storage: SUPABASE_URL và SUPABASE_SERVICE_ROLE_KEY.",
        },
        { status: 500 },
      );
    }

    const relativeDirectory = path.join("uploads", "orders");
    const absoluteDirectory = path.join(process.cwd(), "public", relativeDirectory);
    await mkdir(absoluteDirectory, { recursive: true });
    await writeFile(path.join(absoluteDirectory, fileName), bytes);

    return NextResponse.json({
      ok: true,
      path: `/${relativeDirectory.replaceAll(path.sep, "/")}/${fileName}`,
    });
  } catch (error) {
    console.error("Upload order image failed:", error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Không thể lưu hình ảnh." },
      { status: 500 },
    );
  }
}

function getStorageConfig(): StorageConfig | null {
  const url = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "")
    .trim()
    .replace(/\/+$/, "");
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || "").trim();
  const bucket = (process.env.SUPABASE_ORDER_IMAGE_BUCKET || DEFAULT_BUCKET).trim() || DEFAULT_BUCKET;
  if (!url || !key) return null;
  return { url, key, bucket };
}

async function ensurePublicBucket(config: StorageConfig) {
  const bucketUrl = `${config.url}/storage/v1/bucket/${encodeURIComponent(config.bucket)}`;
  const headers = authHeaders(config.key);
  const existing = await fetch(bucketUrl, { method: "GET", headers, cache: "no-store" });

  if (existing.ok) return;
  if (existing.status !== 404) {
    throw new Error(`Không thể kiểm tra bucket hình ảnh (${existing.status}).`);
  }

  const created = await fetch(`${config.url}/storage/v1/bucket`, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({
      id: config.bucket,
      name: config.bucket,
      public: true,
      file_size_limit: MAX_IMAGE_SIZE,
      allowed_mime_types: Array.from(ALLOWED_TYPES),
    }),
  });

  if (!created.ok && created.status !== 409) {
    const detail = await safeResponseText(created);
    throw new Error(`Không thể tạo bucket hình ảnh${detail ? `: ${detail}` : "."}`);
  }
}

async function uploadToSupabase(
  config: StorageConfig,
  objectPath: string,
  bytes: Buffer,
  contentType: string,
) {
  const encodedPath = objectPath.split("/").map(encodeURIComponent).join("/");
  const response = await fetch(`${config.url}/storage/v1/object/${encodeURIComponent(config.bucket)}/${encodedPath}`, {
    method: "POST",
    headers: {
      ...authHeaders(config.key),
      "Content-Type": contentType,
      "x-upsert": "true",
      "Cache-Control": "3600",
    },
    body: new Uint8Array(bytes),
  });

  if (!response.ok) {
    const detail = await safeResponseText(response);
    throw new Error(`Không thể tải hình lên Supabase${detail ? `: ${detail}` : "."}`);
  }

  return `${config.url}/storage/v1/object/public/${encodeURIComponent(config.bucket)}/${encodedPath}`;
}

function authHeaders(key: string) {
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
  };
}

async function safeResponseText(response: Response) {
  try {
    return (await response.text()).trim().slice(0, 500);
  } catch {
    return "";
  }
}
