import { prisma } from "@/lib/prisma";
import { normalizeCategoryRows, type ItemCategoryRow } from "@/lib/item-category";

/**
 * V135: nạp danh mục phân loại hàng hóa từ bảng `item_categories`.
 *
 * Nếu bảng chưa được tạo (chưa chạy migration) thì trả bộ mặc định + ghi log, để app
 * không sập vì thiếu dữ liệu cấu hình.
 */
export async function loadItemCategories(options?: { activeOnly?: boolean }): Promise<ItemCategoryRow[]> {
  try {
    const rows = await prisma.itemCategory.findMany({
      where: options?.activeOnly ? { active: true } : {},
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }, { code: "asc" }],
    });
    if (!rows.length) return normalizeCategoryRows(null);
    return normalizeCategoryRows(rows);
  } catch (error) {
    console.warn("Không đọc được bảng item_categories, dùng phân loại mặc định:", error instanceof Error ? error.message : error);
    return normalizeCategoryRows(null);
  }
}
