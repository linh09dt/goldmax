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

const JPEG_SOF_MARKERS = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf]);

/**
 * V110b: đọc kích thước pixel của buffer JPEG (quét marker SOF) — dùng để biết tỉ lệ thật
 * của ảnh sản phẩm trước khi đặt vào ô Excel, tránh kéo giãn/bóp méo. Không cần thư viện ảnh.
 */
export function readJpegSize(buffer: Buffer): ImageSize | null {
  if (buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8) return null;

  let offset = 2;
  while (offset + 8 < buffer.length) {
    if (buffer[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = buffer[offset + 1];
    // Marker không có phần độ dài (khôi phục, RST, SOI/EOI).
    if (marker === 0xff || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd9)) {
      offset += 2;
      continue;
    }
    const segmentLength = buffer.readUInt16BE(offset + 2);
    if (segmentLength < 2) return null;
    if (JPEG_SOF_MARKERS.has(marker)) {
      const height = buffer.readUInt16BE(offset + 5);
      const width = buffer.readUInt16BE(offset + 7);
      return width > 0 && height > 0 ? { width, height } : null;
    }
    offset += 2 + segmentLength;
  }
  return null;
}

/** Kích thước pixel của buffer PNG hoặc JPEG; không đọc được (vd. WEBP) trả null. */
export function readImageSize(buffer: Buffer): ImageSize | null {
  return readPngSize(buffer) ?? readJpegSize(buffer);
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
