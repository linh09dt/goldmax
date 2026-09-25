import { readFile } from "node:fs/promises";

/**
 * V87: Logo GOLDMAX mới có tỉ lệ khung khác logo cũ (2000x2000 gốc, sau khi cắt nền trắng
 * còn ~2,7:1), nên không thể ghi cứng width/height khi chèn vào Excel — ExcelJS sẽ kéo giãn
 * ảnh theo đúng khung đó. Module này đọc kích thước pixel thật từ header PNG (chunk IHDR)
 * để tính chiều cao theo đúng tỉ lệ, không cần thư viện xử lý ảnh.
 */

const PNG_SIGNATURE_HEX = "89504e470d0a1a0a";

export type ImageSize = { width: number; height: number };

/** Đọc kích thước pixel của buffer PNG. Trả null nếu không phải PNG hợp lệ. */
export function readPngSize(buffer: Buffer): ImageSize | null {
  if (buffer.length < 24) return null;
  if (buffer.subarray(0, 8).toString("hex") !== PNG_SIGNATURE_HEX) return null;
  if (buffer.subarray(12, 16).toString("ascii") !== "IHDR") return null;

  const width = buffer.readUInt32BE(16);
  const height = buffer.readUInt32BE(20);
  if (width <= 0 || height <= 0) return null;
  return { width, height };
}

/** Như readPngSize nhưng đọc từ file; lỗi đọc file trả null để không chặn việc xuất. */
export async function readPngSizeFromFile(filePath: string): Promise<ImageSize | null> {
  try {
    return readPngSize(await readFile(filePath));
  } catch {
    return null;
  }
}

/**
 * Kích thước hiển thị của logo trong file xuất: cố định bề rộng, chiều cao suy ra từ tỉ lệ thật.
 * `fallbackAspect` dùng khi không đọc được file PNG (giữ hành vi cũ, không chặn xuất file).
 */
export async function logoBox(
  filePath: string,
  width: number,
  fallbackAspect = 2.7,
): Promise<ImageSize> {
  const size = await readPngSizeFromFile(filePath);
  const aspect = size && size.height > 0 ? size.width / size.height : fallbackAspect;
  return { width, height: Math.max(1, Math.round(width / aspect)) };
}
