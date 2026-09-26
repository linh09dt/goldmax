/**
 * V134 — Phân loại hàng hóa của tab CẤU HÌNH.
 *
 * Trước đây danh mục chỉ chia 2 khối bằng cách ĐOÁN theo tên TENHANG (bắt đầu bằng "Cửa").
 * Từ V134 phân loại là DỮ LIỆU THẬT: cột `item_masters.category` với 3 giá trị:
 *
 * - `DOOR`        → CẤP CỬA   (dùng làm dòng chính / bộ cửa trong đơn)
 * - `ACCESSORY`   → PHỤ KIỆN  (dùng làm dòng phụ kiện / chi tiết)
 * - `PROCESSING`  → CHI PHÍ GIA CÔNG (các dòng chi phí gia công / khoét / phụ phí)
 *
 * Heuristic theo tên (`classifyItemByName`) chỉ dùng để:
 * 1. Nạp dữ liệu cũ / tạo lại Master Data từ file Excel (chưa có cột phân loại),
 * 2. Dự phòng khi một dòng chưa có `category`.
 * Người dùng luôn sửa được phân loại trong tab Cấu hình.
 */

export const ITEM_CATEGORIES = ["DOOR", "ACCESSORY", "PROCESSING"] as const;

export type ItemCategory = (typeof ITEM_CATEGORIES)[number];

export const ITEM_CATEGORY_DEFAULT: ItemCategory = "ACCESSORY";

/** Thứ tự + nhãn hiển thị của 3 khối trong tab Cấu hình. */
export const ITEM_CATEGORY_SECTIONS: Array<{
  key: ItemCategory;
  label: string;
  badgeTone: "cyan" | "amber" | "red";
  hint: string;
}> = [
  { key: "DOOR", label: "CẤP CỬA", badgeTone: "cyan", hint: "Bộ cửa — dùng làm dòng chính trong đơn" },
  { key: "ACCESSORY", label: "PHỤ KIỆN", badgeTone: "amber", hint: "Dùng làm dòng phụ kiện / chi tiết trong đơn" },
  { key: "PROCESSING", label: "CHI PHÍ GIA CÔNG", badgeTone: "red", hint: "Chi phí gia công / khoét / phụ phí — nhập ở dòng chi tiết" },
];

const CATEGORY_LABELS: Record<ItemCategory, string> = {
  DOOR: "Cấp cửa",
  ACCESSORY: "Phụ kiện",
  PROCESSING: "Chi phí gia công",
};

export function isItemCategory(value: unknown): value is ItemCategory {
  return typeof value === "string" && (ITEM_CATEGORIES as readonly string[]).includes(value);
}

export function normalizeItemCategory(value: unknown): ItemCategory | null {
  if (isItemCategory(value)) return value;
  if (typeof value !== "string") return null;
  const text = value.trim().toLocaleUpperCase("vi-VN");
  return isItemCategory(text) ? text : null;
}

export function itemCategoryLabel(value: unknown): string {
  const category = normalizeItemCategory(value);
  return category ? CATEGORY_LABELS[category] : CATEGORY_LABELS.ACCESSORY;
}

export function itemCategoryBadgeTone(value: unknown): "cyan" | "amber" | "red" {
  const category = normalizeItemCategory(value);
  return ITEM_CATEGORY_SECTIONS.find((section) => section.key === category)?.badgeTone ?? "amber";
}

/** Bỏ dấu + hạ chữ thường (giống normalizeText ở order-form/item-master). */
export function normalizeCategoryText(value: unknown): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .trim()
    .toLocaleLowerCase("vi")
    .replace(/\s+/g, " ");
}

/** Các cụm từ nhận diện dòng CHI PHÍ GIA CÔNG khi chưa có cột phân loại. */
const PROCESSING_PATTERNS = [
  "gia cong",
  "chi phi",
  "phu phi",
  "khoet",
  "chi phi khoet",
  "gia cong o kinh",
];

/**
 * Đoán phân loại theo TENHANG (chỉ dùng khi dòng chưa có `category`):
 * - bắt đầu bằng "Cửa" → CẤP CỬA
 * - chứa "gia công" / "chi phí" / "phụ phí" / "khoét" → CHI PHÍ GIA CÔNG
 * - còn lại → PHỤ KIỆN
 */
export function classifyItemByName(name: unknown): ItemCategory {
  const text = normalizeCategoryText(name);
  if (!text) return ITEM_CATEGORY_DEFAULT;
  if (text === "cua" || text.startsWith("cua ")) return "DOOR";
  if (PROCESSING_PATTERNS.some((pattern) => text.includes(pattern))) return "PROCESSING";
  return ITEM_CATEGORY_DEFAULT;
}

/**
 * Phân loại của một hàng hóa: ưu tiên cột `category`, chưa có thì đoán theo tên.
 * Dùng chung cho tab Cấu hình và form tạo đơn để hai nơi không lệch nhau.
 */
export function resolveItemCategory(category: unknown, name: unknown): ItemCategory {
  return normalizeItemCategory(category) ?? classifyItemByName(name);
}

export function isDoorCategory(category: unknown, name: unknown): boolean {
  return resolveItemCategory(category, name) === "DOOR";
}
