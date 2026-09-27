/**
 * V159c — MÀU NHẠT THEO TỔ để phân biệt các tổ trong BẢNG KẾ HOẠCH THEO NGÀY.
 *
 * Dùng chung cho màn hình (class Tailwind `bg-*`/`swatch`) và file Excel (mã màu ARGB `hex`).
 * Viết class ĐẦY ĐỦ (không nối chuỗi) để Tailwind giữ được các class này khi build.
 */
export type WorkCenterTone = {
  /** Nền nhạt của cả hàng. */
  bg: string;
  /** Ô màu nhỏ ở chú thích tổ. */
  swatch: string;
  /** Mã màu ARGB cho Excel. */
  hex: string;
};

export const WORK_CENTER_TONES: Record<string, WorkCenterTone> = {
  TO_THIET_KE: { bg: "bg-sky-50", swatch: "bg-sky-300", hex: "FFF0F9FF" },
  TO_MAY: { bg: "bg-amber-50", swatch: "bg-amber-300", hex: "FFFFFBEB" },
  TO_HAN: { bg: "bg-rose-50", swatch: "bg-rose-300", hex: "FFFFF1F2" },
  TO_SON: { bg: "bg-violet-50", swatch: "bg-violet-300", hex: "FFF5F3FF" },
  TO_VAN: { bg: "bg-teal-50", swatch: "bg-teal-300", hex: "FFF0FDFA" },
  TO_DONG_GOI: { bg: "bg-lime-50", swatch: "bg-lime-300", hex: "FFF7FEE7" },
  KHO: { bg: "bg-green-50", swatch: "bg-green-300", hex: "FFF0FDF4" },
  KY_THUAT: { bg: "bg-indigo-50", swatch: "bg-indigo-300", hex: "FFEEF2FF" },
  NGOAI: { bg: "bg-orange-50", swatch: "bg-orange-300", hex: "FFFFF7ED" },
};

export const DEFAULT_WORK_CENTER_TONE: WorkCenterTone = {
  bg: "bg-white",
  swatch: "bg-slate-300",
  hex: "FFFFFFFF",
};

export function toneForWorkCenter(code: string | null | undefined): WorkCenterTone {
  if (!code) return DEFAULT_WORK_CENTER_TONE;
  return WORK_CENTER_TONES[code] ?? DEFAULT_WORK_CENTER_TONE;
}
