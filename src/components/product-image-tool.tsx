"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * V110 — Công cụ "Chuẩn hóa ảnh SP".
 *
 * Mục đích: người dùng dán (Ctrl+V) hoặc kéo-thả ảnh sản phẩm vào đây, công cụ trả về
 * một ảnh đã chuẩn hóa đúng khung mà hệ thống dùng khi xuất file:
 *
 *  - Excel V1  — `src/lib/order-export.ts`  : khung ảnh 82 × 48 px  (tỉ lệ 1,708)
 *  - Excel V2  — `src/lib/order-export-v2.ts`: khung ảnh 58 × 36 px  (tỉ lệ 1,611)
 *  - PDF       — `python/reportlab_order_v2.py`: thumbnail tối đa 240 px, in trong khung 11 mm
 *  - Bản in web— `src/app/globals.css`      : tối đa 86 × 58 px
 *
 * Hai khung Excel là yếu tố quyết định, trung bình ≈ 1,66 → chọn tỉ lệ vàng 5:3.
 * Ảnh ra mặc định 400 × 240 px (5:3), nền trắng, JPEG — đúng tỉ lệ nên khi Excel ép vào
 * khung 82×48 / 58×36 ảnh gần như không bị méo; ảnh dọc/vuông (ảnh chụp điện thoại) thì bị
 * bóp rất mạnh, đây chính là thứ công cụ này loại bỏ.
 *
 * Toàn bộ xử lý chạy phía trình duyệt (canvas), không gửi ảnh lên máy chủ.
 */

const WHITE = "#FFFFFF";
const DEFAULT_TARGET_KB = 300;
const HARD_MIN_QUALITY = 0.5;

type Preset = { id: string; label: string; hint: string; width: number; height: number };

/** Tỉ lệ 5:3 cho mọi preset — khớp trung bình hai khung Excel (1,71 và 1,61). */
const PRESETS: Preset[] = [
  { id: "std", label: "400 × 240 px", hint: "Chuẩn — khuyên dùng cho mọi đơn", width: 400, height: 240 },
  { id: "sharp", label: "800 × 480 px", hint: "Nét hơn — khi cần in lớn / soi kỹ chi tiết", width: 800, height: 480 },
  { id: "light", label: "240 × 144 px", hint: "Nhẹ nhất — đơn rất nhiều bộ cửa", width: 240, height: 144 },
];

type Loaded = {
  name: string;
  type: string;
  bytes: number;
  width: number;
  height: number;
  url: string;
  bitmap: ImageBitmap;
};

type Result = {
  key: string;
  width: number;
  height: number;
  bytes: number;
  quality: number;
  blob: Blob;
  url: string;
  name: string;
};

export function ProductImageTool() {
  const [original, setOriginal] = useState<Loaded | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [presetId, setPresetId] = useState(PRESETS[0].id);
  const [fit, setFit] = useState<"contain" | "cover">("contain");
  const [targetKb, setTargetKb] = useState(DEFAULT_TARGET_KB);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [failedKey, setFailedKey] = useState<string | null>(null);
  // Lượt xử lý đã được copy vào clipboard — gắn với khóa lượt chạy nên khi đổi tùy chọn
  // hoặc dán ảnh khác thì badge tự ẩn, không bị thông báo cũ ghi đè.
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  // Khóa của lượt xử lý mới nhất — kết quả của lượt cũ (nếu về muộn) sẽ bị bỏ qua.
  const latestKeyRef = useRef<string | null>(null);

  // Thu hồi object URL khi thay ảnh / rời trang để không rò rỉ bộ nhớ.
  const urlsRef = useRef<string[]>([]);
  useEffect(() => () => { urlsRef.current.forEach((url) => URL.revokeObjectURL(url)); }, []);

  const trackUrl = useCallback((url: string) => {
    urlsRef.current.push(url);
    return url;
  }, []);

  /** Xử lý ảnh: cắt/đệm về đúng tỉ lệ preset, nền trắng, nén JPEG về mức KB mong muốn. */
  const process = useCallback(
    async (input: Loaded, preset: Preset, mode: "contain" | "cover", maxKb: number, key: string) => {
      const canvas = document.createElement("canvas");
      canvas.width = preset.width;
      canvas.height = preset.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Trình duyệt không hỗ trợ canvas.");

      // Ảnh PNG/WEBP trong suốt → đổ nền trắng trước, vì Excel/PDF không có nền trong suốt.
      ctx.fillStyle = WHITE;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const scale =
        mode === "cover"
          ? Math.max(preset.width / input.width, preset.height / input.height)
          : Math.min(preset.width / input.width, preset.height / input.height);
      const drawW = input.width * scale;
      const drawH = input.height * scale;
      const drawX = (preset.width - drawW) / 2;
      const drawY = (preset.height - drawH) / 2;

      drawSmooth(ctx, input.bitmap, input.width, input.height, drawX, drawY, drawW, drawH);

      const quality = await fitQuality(canvas, maxKb * 1024);
      const blob = await canvasToBlob(canvas, "image/jpeg", quality.value);
      const url = trackUrl(URL.createObjectURL(blob));

      // Người dùng đã đổi tùy chọn hoặc dán ảnh khác trong lúc xử lý → bỏ kết quả này.
      if (latestKeyRef.current !== key) {
        URL.revokeObjectURL(url);
        return;
      }

      setResult({
        key,
        width: preset.width,
        height: preset.height,
        bytes: blob.size,
        quality: quality.value,
        blob,
        url,
        name: outputName(input.name, preset),
      });
      setNotice(
        quality.hitFloor && blob.size > maxKb * 1024
          ? `Đã nén hết mức nhưng ảnh vẫn ${formatBytes(blob.size)} (> ${maxKb} KB). Vẫn dùng được, chỉ nặng hơn mức khuyên dùng.`
          : `Xong — ${preset.width} × ${preset.height} px, ${formatBytes(blob.size)}, chất lượng JPEG ${Math.round(quality.value * 100)}%.`,
      );
    },
    [trackUrl],
  );

  /** Chỉ đọc file thành bitmap và đưa vào state — việc xử lý do effect bên dưới lo,
   *  nhờ vậy dán ảnh và đổi tùy chọn đi chung đúng một đường. */
  const handleFile = useCallback(
    async (file: File) => {
      setError("");
      setNotice("");
      if (!file.type.startsWith("image/")) {
        setError("File không phải hình ảnh. Hãy dán/chọn file JPG, PNG hoặc WEBP.");
        return;
      }
      if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
        setError("Chỉ hỗ trợ JPG, PNG hoặc WEBP (hệ thống cũng chỉ nhận 3 định dạng này khi upload).");
        return;
      }
      setLoading(true);
      try {
        const bitmap = await loadBitmap(file);
        const url = trackUrl(URL.createObjectURL(file));
        setOriginal({
          name: file.name || "anh-dan-tu-clipboard",
          type: file.type,
          bytes: file.size,
          width: bitmap.width,
          height: bitmap.height,
          url,
          bitmap,
        });
      } catch {
        setError("Không đọc được ảnh này. Thử copy lại ảnh (chuột phải → Copy image) rồi dán lại.");
      } finally {
        setLoading(false);
      }
    },
    [trackUrl],
  );

  // Dán ảnh mới HOẶC đổi kích thước / kiểu khung / mức KB → xử lý lại trên ảnh gốc đang có.
  // Không setState đồng bộ trong effect: trạng thái "đang xử lý" được suy ra từ khóa lượt chạy.
  useEffect(() => {
    if (!original) return;
    const preset = PRESETS.find((item) => item.id === presetId) ?? PRESETS[0];
    const key = `${original.url}|${presetId}|${fit}|${targetKb}`;
    latestKeyRef.current = key;
    process(original, preset, fit, targetKb, key).catch(() => {
      setFailedKey(key);
      setError("Không xử lý lại được ảnh. Thử chọn lại kích thước hoặc dán ảnh khác.");
    });
  }, [original, presetId, fit, targetKb, process]);

  // Ctrl+V ở bất kỳ đâu trong trang — giống thao tác dán vào ô Hình ảnh SP.
  useEffect(() => {
    function onPaste(event: ClipboardEvent) {
      const item = Array.from(event.clipboardData?.items ?? []).find((entry) => entry.type.startsWith("image/"));
      const file = item?.getAsFile();
      if (!file) return;
      event.preventDefault();
      void handleFile(file);
    }
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [handleFile]);

  // Trạng thái suy ra: đã có ảnh gốc nhưng kết quả chuẩn hóa chưa khớp tùy chọn hiện tại.
  const jobKey = original ? `${original.url}|${presetId}|${fit}|${targetKb}` : null;
  const processing = Boolean(jobKey) && result?.key !== jobKey && failedKey !== jobKey;
  const busy = loading || processing;
  const ratioWarning = original ? ratioDeviation(original.width, original.height) : 0;
  const tooSmall = original ? Math.max(original.width, original.height) < 240 : false;

  function download() {
    if (!result) return;
    const link = document.createElement("a"); // tải xuống qua blob URL đã tạo sẵn
    link.href = result.url;
    link.download = result.name;
    document.body.appendChild(link);
    link.click();
    link.remove();
  }

  /** Copy dạng PNG để clipboard nhận (hầu hết trình duyệt chỉ cho copy clipboard dạng PNG),
   *  nhờ vậy có thể dán thẳng vào ô "Hình ảnh SP" trong form đơn hàng. */
  async function copyToClipboard() {
    if (!result || !jobKey) return;
    try {
      const png = await canvasToBlob(await jpegBlobToCanvas(result.blob, result.width, result.height), "image/png", 1);
      await navigator.clipboard.write([new ClipboardItem({ "image/png": png })]);
      setCopiedKey(jobKey);
      setError("");
    } catch {
      setCopiedKey(null);
      setError("Trình duyệt không cho copy ảnh. Dùng nút “Tải ảnh chuẩn” rồi chọn file khi upload.");
    }
  }

  function reset() {
    setOriginal(null);
    setResult(null);
    setFailedKey(null);
    setCopiedKey(null);
    setError("");
    setNotice("");
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div className="space-y-5">
      <section className="erp-card p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="erp-section-title">Dán ảnh sản phẩm để chuẩn hóa</h2>
            <p className="erp-hint mt-1">
              Copy ảnh ở bất kỳ đâu (Snipping Tool, Zalo, Facebook, Excel, trình duyệt…) rồi bấm <b>Ctrl + V</b>.
              Hoặc kéo-thả file vào khung bên dưới.
            </p>
          </div>
          {original ? (
            <button type="button" className="erp-button-secondary" onClick={reset}>
              Làm lại
            </button>
          ) : null}
        </div>

        <div
          onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            const file = event.dataTransfer.files?.[0];
            if (file) void handleFile(file);
          }}
          onClick={() => inputRef.current?.click()}
          role="button"
          tabIndex={0}
          aria-label="Chọn hoặc dán ảnh sản phẩm"
          onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") inputRef.current?.click(); }}
          className={`mt-4 flex min-h-[150px] cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-6 py-8 text-center transition ${
            dragging ? "border-cyan-500 bg-cyan-50" : "border-slate-300 bg-slate-50 hover:border-cyan-400 hover:bg-cyan-50/40"
          }`}
        >
          <span className="text-2xl" aria-hidden="true">🖼️</span>
          <span className="text-sm font-semibold text-slate-700">
            {busy ? "Đang xử lý ảnh…" : "Bấm vào đây để chọn file — hoặc Ctrl + V để dán ảnh"}
          </span>
          <span className="erp-hint">Hỗ trợ JPG, PNG, WEBP. Ảnh được xử lý ngay trên máy bạn, không tải lên máy chủ.</span>
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void handleFile(file);
            }}
          />
        </div>

        {error ? (
          <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[12px] font-medium text-red-700">{error}</p>
        ) : null}
        {notice ? (
          <p className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-[12px] font-medium text-emerald-700">{notice}</p>
        ) : null}
      </section>

      {original ? (
        <section className="erp-card p-5">
          <h2 className="erp-section-title">Tùy chọn ảnh ra</h2>
          <div className="mt-4 grid gap-4 lg:grid-cols-3">
            <label className="block">
              <span className="erp-field-label">Kích thước ảnh chuẩn (tỉ lệ 5:3)</span>
              <select className="erp-input" value={presetId} onChange={(event) => setPresetId(event.target.value)}>
                {PRESETS.map((preset) => (
                  <option key={preset.id} value={preset.id}>
                    {preset.label} — {preset.hint}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="erp-field-label">Kiểu đưa ảnh vào khung</span>
              <select className="erp-input" value={fit} onChange={(event) => setFit(event.target.value as "contain" | "cover")}>
                <option value="contain">Vừa khung — giữ trọn ảnh, thêm nền trắng (an toàn)</option>
                <option value="cover">Tràn khung — lấp đầy ô, cắt bớt cạnh thừa</option>
              </select>
            </label>

            <label className="block">
              <span className="erp-field-label">Dung lượng tối đa (KB)</span>
              <input
                type="number"
                min={30}
                max={2000}
                step={10}
                className="erp-input"
                value={targetKb}
                onChange={(event) => setTargetKb(Math.min(2000, Math.max(30, Number(event.target.value) || DEFAULT_TARGET_KB)))}
              />
              <span className="erp-hint mt-1 block">Công cụ tự hạ chất lượng JPEG để không vượt mức này (mặc định 300 KB).</span>
            </label>
          </div>

          {ratioWarning > 15 ? (
            <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-800">
              Ảnh gốc {original.width}×{original.height} lệch <b>{Math.round(ratioWarning)}%</b> so với tỉ lệ 5:3 của khung xuất file.
              Nếu để nguyên, Excel sẽ ép ảnh vào khung 82×48 px và <b>bóp méo hình</b>. Chế độ <b>“Vừa khung”</b> (đang chọn) sẽ đệm nền trắng
              để giữ đúng hình dáng; chế độ <b>“Tràn khung”</b> sẽ cắt bớt cạnh để lấp đầy ô.
            </p>
          ) : null}

          {tooSmall ? (
            <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-800">
              Ảnh gốc chỉ {original.width}×{original.height} px. Bản PDF lấy ảnh tối đa 240 px rồi in trong khung 11 mm —
              ảnh nhỏ hơn 240 px cạnh dài sẽ hơi mờ khi in. Nên dùng ảnh gốc lớn hơn.
            </p>
          ) : null}
        </section>
      ) : null}

      {original && result ? (
        <section className="erp-card p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="erp-section-title">Kết quả</h2>
            <div className="flex flex-wrap items-center gap-2">
              {copiedKey && copiedKey === jobKey ? (
                <span className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-[12px] font-semibold text-emerald-700">
                  ✓ Đã copy — sang form đơn hàng, bấm vào ô “Hình ảnh SP” rồi Ctrl + V
                </span>
              ) : null}
              <button type="button" className="erp-button" onClick={download} disabled={busy}>
                Tải ảnh chuẩn (.jpg)
              </button>
              <button type="button" className="erp-button-secondary" onClick={() => void copyToClipboard()} disabled={busy}>                Copy để dán vào ô ảnh
              </button>
            </div>
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <figure className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <figcaption className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Ảnh gốc · {original.width} × {original.height} px · {formatBytes(original.bytes)}
              </figcaption>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={original.url} alt="Ảnh gốc" className="mx-auto max-h-[220px] w-auto rounded-lg border border-slate-200 bg-white object-contain" />
              <p className="erp-hint mt-2">
                Tỉ lệ gốc {aspect(original.width, original.height)} — so với khung xuất file (1,71) lệch {Math.round(ratioWarning)}%.
              </p>
            </figure>

            <figure className="rounded-xl border border-cyan-300 bg-cyan-50/40 p-3">
              <figcaption className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-cyan-700">
                Ảnh chuẩn · {result.width} × {result.height} px · {formatBytes(result.bytes)} · JPEG {Math.round(result.quality * 100)}%
              </figcaption>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={result.url} alt="Ảnh chuẩn" className="mx-auto rounded-lg border border-cyan-200 bg-white object-contain" />
              <p className="erp-hint mt-2 break-all">
                Tên file: <b>{result.name}</b>
              </p>
            </figure>
          </div>

          <div className="mt-5 rounded-xl border border-slate-200 bg-white p-4">
            <h3 className="erp-subsection-title">Xem thử trong đúng khung của từng nơi xuất file</h3>
            <p className="erp-hint mt-1">
              Đây là kích cỡ thật mà hệ thống vẽ ảnh ra. Ảnh chuẩn đúng tỉ lệ nên hình không bị kéo giãn.
            </p>
            <div className="mt-3 flex flex-wrap items-end gap-5">
              <FramePreview src={result.url} width={82} height={48} label="Excel V1 (82 × 48 px)" />
              <FramePreview src={result.url} width={58} height={36} label="Excel V2 (58 × 36 px)" />
              <FramePreview src={result.url} width={86} height={58} label="Bản in web (86 × 58 px)" />
              <FramePreview src={result.url} width={240} height={144} label="PDF (khung 11 mm ≈ 240 px)" />
            </div>
          </div>
        </section>
      ) : null}

      <section className="erp-card p-5">
        <h2 className="erp-section-title">Cách dùng nhanh</h2>
        <ol className="mt-3 space-y-2 text-[13px] text-slate-700">
          <li><b>1.</b> Copy ảnh sản phẩm → dán vào khung phía trên (Ctrl + V).</li>
          <li><b>2.</b> Chọn 400 × 240 px (mặc định) và để “Vừa khung” nếu ảnh không phải ảnh ngang đúng tỉ lệ.</li>
          <li><b>3.</b> Bấm <b>Copy để dán vào ô ảnh</b>, rồi vào form đơn hàng, bấm vào ô <b>Hình ảnh SP</b> và Ctrl + V. Hoặc bấm <b>Tải ảnh chuẩn</b> rồi dùng nút “Tải ảnh” như bình thường.</li>
        </ol>
        <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[12px] text-slate-600">
          Khung ảnh hệ thống đang dùng: Excel V1 <b>82 × 48 px</b> · Excel V2 <b>58 × 36 px</b> · PDF <b>240 px / 11 mm</b> · bản in web <b>86 × 58 px</b>.
          Tỉ lệ chung ≈ <b>1,66 (5:3)</b> — đó là lý do công cụ này xuất ảnh 5:3.
        </div>
      </section>
    </div>
  );
}

function FramePreview({ src, width, height, label }: { src: string; width: number; height: number; label: string }) {
  return (
    <figure className="text-center">
      <div className="rounded border border-slate-300 bg-white p-0.5" style={{ width: width + 8, height: height + 8 }}>
        {/* object-fill để mô phỏng đúng cách Excel kéo ảnh vào khung cố định. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={label} style={{ width, height, objectFit: "fill" }} className="block" />
      </div>
      <figcaption className="erp-hint mt-1.5">{label}</figcaption>
    </figure>
  );
}

/** Đọc ảnh thành ImageBitmap, ưu tiên xoay theo EXIF (ảnh chụp điện thoại hay bị quay ngang). */
async function loadBitmap(file: File): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    return await createImageBitmap(file);
  }
}

/**
 * Vẽ ảnh xuống canvas với thuật toán hạ mẫu từng bước (halving) — tránh ảnh răng cưa/mờ
 * khi ảnh gốc lớn hơn khung đích nhiều lần (ảnh điện thoại 3000–4000 px).
 */
function drawSmooth(
  ctx: CanvasRenderingContext2D,
  bitmap: ImageBitmap,
  sourceWidth: number,
  sourceHeight: number,
  dx: number,
  dy: number,
  dw: number,
  dh: number,
) {
  let current: HTMLCanvasElement | ImageBitmap = bitmap;
  let currentWidth = sourceWidth;
  let currentHeight = sourceHeight;

  while (currentWidth / 2 >= Math.abs(dw) * 1.5 && currentHeight / 2 >= Math.abs(dh) * 1.5) {
    const step = document.createElement("canvas");
    step.width = Math.max(1, Math.round(currentWidth / 2));
    step.height = Math.max(1, Math.round(currentHeight / 2));
    const stepCtx = step.getContext("2d");
    if (!stepCtx) break;
    stepCtx.imageSmoothingEnabled = true;
    stepCtx.imageSmoothingQuality = "high";
    stepCtx.drawImage(current, 0, 0, currentWidth, currentHeight, 0, 0, step.width, step.height);
    current = step;
    currentWidth = step.width;
    currentHeight = step.height;
  }

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(current, 0, 0, currentWidth, currentHeight, dx, dy, dw, dh);
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Không tạo được ảnh."))), type, quality);
  });
}

async function jpegBlobToCanvas(blob: Blob, width: number, height: number): Promise<HTMLCanvasElement> {
  const bitmap = await createImageBitmap(blob);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Không tạo được canvas.");
  ctx.fillStyle = WHITE;
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(bitmap, 0, 0, width, height);
  return canvas;
}

/** Hạ dần chất lượng JPEG cho tới khi file nhỏ hơn mức KB mong muốn. */
async function fitQuality(canvas: HTMLCanvasElement, maxBytes: number) {
  let value = 0.88;
  let blob = await canvasToBlob(canvas, "image/jpeg", value);
  while (blob.size > maxBytes && value > HARD_MIN_QUALITY) {
    value = Math.max(HARD_MIN_QUALITY, value - 0.08);
    blob = await canvasToBlob(canvas, "image/jpeg", value);
  }
  return { value, hitFloor: value <= HARD_MIN_QUALITY && blob.size > maxBytes };
}

function outputName(originalName: string, preset: Preset) {
  const base = originalName
    .replace(/\.[a-z0-9]+$/i, "")
    .replace(/[^\p{L}\p{N}\-_ ]+/gu, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 60) || "anh-sp";
  return `${base}_chuan-${preset.width}x${preset.height}.jpg`;
}

function ratioDeviation(width: number, height: number) {
  if (!width || !height) return 0;
  const target = 5 / 3;
  const actual = width / height;
  return Math.abs(actual - target) / target * 100;
}

function aspect(width: number, height: number) {
  if (!height) return "—";
  return (width / height).toFixed(2).replace(".", ",");
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
