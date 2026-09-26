/**
 * V135 — Phân loại hàng hóa: ĐỌC TỪ DỮ LIỆU, không hard-code.
 *
 * Danh mục phân loại nằm ở bảng `item_categories` (tab Cấu hình → A3 Phân loại hàng hóa):
 * người dùng thêm / đổi tên / xoá / đổi cách dùng được. `item_masters.category` giữ MÃ phân loại
 * (không phải tên) nên đổi tên phân loại không phải sửa dữ liệu hàng hóa.
 *
 * - `usage = MAIN`   → nhóm này dùng làm DÒNG CHÍNH / BỘ CỬA khi lập đơn
 * - `usage = DETAIL` → dùng làm DÒNG PHỤ KIỆN / CHI TIẾT
 * - `separateGroup`  → khi lập đơn, các nhóm hàng thuộc phân loại này nằm trong optgroup riêng
 *
 * File này chỉ giữ 3 dòng MẶC ĐỊNH để: (1) nạp seed ở migration, (2) dự phòng khi bảng trống
 * hoặc API chưa kịp tải — app không bao giờ vỡ vì thiếu danh mục.
 */

export type CategoryUsage = "MAIN" | "DETAIL";

export type ItemCategoryRow = {
  id?: number;
  code: string;
  name: string;
  usage: CategoryUsage;
  separateGroup: boolean;
  sortOrder: number;
  active: boolean;
};

/** Dự phòng khi bảng `item_categories` trống (giống seed của migration). */
export const DEFAULT_ITEM_CATEGORIES: ItemCategoryRow[] = [
  { code: "DOOR", name: "Cấp cửa", usage: "MAIN", separateGroup: false, sortOrder: 10, active: true },
  { code: "ACCESSORY", name: "Phụ kiện", usage: "DETAIL", separateGroup: false, sortOrder: 20, active: true },
  { code: "PROCESSING", name: "Chi phí gia công", usage: "DETAIL", separateGroup: true, sortOrder: 30, active: true },
];

/** Màu badge cho từng khối trong tab Cấu hình (theo thứ tự, tự lặp lại). */
export const CATEGORY_TONES = ["cyan", "amber", "red", "emerald", "slate"] as const;
export type CategoryTone = (typeof CATEGORY_TONES)[number];

export function categoryToneAt(index: number): CategoryTone {
  return CATEGORY_TONES[((index % CATEGORY_TONES.length) + CATEGORY_TONES.length) % CATEGORY_TONES.length];
}

export function normalizeCategoryUsage(value: unknown): CategoryUsage {
  return String(value ?? "").trim().toLocaleUpperCase("vi-VN") === "MAIN" ? "MAIN" : "DETAIL";
}

/** Mã phân loại: chỉ chữ/số/gạch, tối đa 40 ký tự (đủ an toàn cho cột DB). */
export function normalizeCategoryCode(value: unknown): string | null {
  const raw = String(value ?? "").trim().toLocaleUpperCase("vi-VN");
  if (!raw) return null;
  const cleaned = raw.replace(/[^A-Z0-9_-]/g, "_").replace(/_{2,}/g, "_").replace(/^_+|_+$/g, "").slice(0, 40);
  return cleaned || null;
}

/** Bỏ dấu để tạo mã từ tên (ví dụ "Chi phí gia công" → "CHI_PHI_GIA_CONG"). */
export function suggestCategoryCode(name: unknown): string {
  const text = String(name ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .replace(/[^A-Za-z0-9]+/g, "_")
    .replace(/_{2,}/g, "_")
    .replace(/^_+|_+$/g, "");
  return normalizeCategoryCode(text) ?? "PHAN_LOAI";
}

export function normalizeText(value: unknown): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .trim()
    .toLocaleLowerCase("vi")
    .replace(/\s+/g, " ");
}

export function sortItemCategories(rows: ItemCategoryRow[]): ItemCategoryRow[] {
  return [...rows].sort(
    (a, b) => a.sortOrder - b.sortOrder
      || a.name.localeCompare(b.name, "vi") || a.code.localeCompare(b.code, "vi"),
  );
}

/** Chuẩn hoá danh sách nhận từ API/DB; rỗng thì dùng bộ mặc định để app không vỡ. */
export function normalizeCategoryRows(rows: unknown): ItemCategoryRow[] {
  if (!Array.isArray(rows)) return sortItemCategories(DEFAULT_ITEM_CATEGORIES);
  const list = rows
    .filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === "object")
    .map((row) => ({
      id: typeof row.id === "number" ? row.id : undefined,
      code: normalizeCategoryCode(row.code) ?? "",
      name: String(row.name ?? "").trim(),
      usage: normalizeCategoryUsage(row.usage),
      separateGroup: row.separateGroup === true || row.separate_group === true,
      sortOrder: Number.isFinite(Number(row.sortOrder ?? row.sort_order)) ? Number(row.sortOrder ?? row.sort_order) : 0,
      active: row.active !== false,
    }))
    .filter((row) => Boolean(row.code) && Boolean(row.name));
  return list.length ? sortItemCategories(list) : sortItemCategories(DEFAULT_ITEM_CATEGORIES);
}

export function findCategoryRow(rows: ItemCategoryRow[], code: unknown): ItemCategoryRow | null {
  const normalized = normalizeCategoryCode(code);
  if (!normalized) return null;
  return rows.find((row) => row.code === normalized) ?? null;
}

/** Tên hiển thị của một mã phân loại; mã lạ (dữ liệu cũ) thì hiện chính mã đó. */
export function categoryLabel(rows: ItemCategoryRow[], code: unknown): string {
  return findCategoryRow(rows, code)?.name ?? (normalizeCategoryCode(code) ?? "—");
}

const PROCESSING_HINTS = ["process", "gia_cong", "chi_phi", "phu_phi"];

/**
 * Đoán phân loại cho một TENHANG khi dòng chưa có mã phân loại (nạp Excel / tạo lại Master Data).
 * Ưu tiên mã quen thuộc nếu còn trong danh mục; không thì chọn theo cách dùng (MAIN / DETAIL / nhóm riêng).
 */
export function classifyItemByName(name: unknown, rows: ItemCategoryRow[] = DEFAULT_ITEM_CATEGORIES): string {
  const text = normalizeText(name);
  const list = sortItemCategories(rows);
  const byCode = (code: string) => list.find((row) => row.code === code)?.code;
  const byUsage = (usage: CategoryUsage, separateGroup?: boolean) =>
    list.find((row) => row.usage === usage && (separateGroup === undefined || row.separateGroup === separateGroup))?.code;

  if (text === "cua" || text.startsWith("cua ")) {
    return byCode("DOOR") ?? byUsage("MAIN") ?? list[0]?.code ?? "DOOR";
  }
  const isProcessing = ["gia cong", "chi phi", "phu phi", "khoet"].some((pattern) => text.includes(pattern));
  if (isProcessing) {
    return byCode("PROCESSING")
      ?? list.find((row) => row.usage === "DETAIL" && row.separateGroup && PROCESSING_HINTS.some((hint) => row.code.toLocaleLowerCase("vi").includes(hint)))?.code
      ?? byUsage("DETAIL", true)
      ?? byUsage("DETAIL")
      ?? list[0]?.code
      ?? "PROCESSING";
  }
  return byCode("ACCESSORY") ?? byUsage("DETAIL", false) ?? byUsage("DETAIL") ?? list[0]?.code ?? "ACCESSORY";
}

/** Phân loại của một hàng hóa: dùng mã đã lưu; chưa có thì đoán theo tên. */
export function resolveItemCategory(category: unknown, name: unknown, rows?: ItemCategoryRow[]): string {
  return normalizeCategoryCode(category) ?? classifyItemByName(name, rows);
}

export function isMainCategory(rows: ItemCategoryRow[], code: unknown, name?: unknown): boolean {
  const resolved = resolveItemCategory(code, name, rows);
  const row = findCategoryRow(rows, resolved);
  if (row) return row.usage === "MAIN";
  // Mã lạ không có trong danh mục: dự phòng theo quy ước cũ (TENHANG bắt đầu bằng "Cửa").
  return normalizeText(name).startsWith("cua");
}

export function isSameCategory(left: unknown, right: unknown): boolean {
  const a = normalizeCategoryCode(left);
  const b = normalizeCategoryCode(right);
  return Boolean(a) && a === b;
}
