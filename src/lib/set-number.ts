import type { Prisma } from "@/generated/prisma/client";
import {
  CALCULATION_CONFIG_SETTING_KEY,
  DEFAULT_SET_NUMBER_START,
  normalizeCalculationConfig,
} from "@/lib/calculation-config";
import { SET_NUMBER_STATUSES } from "@/lib/order-form";

/**
 * V75: Bộ số do hệ thống tự tăng dần, người dùng không nhập tay.
 *
 * Quy tắc:
 * - Đơn ở trạng thái Đơn nháp (bấm Lưu nháp): Bộ số CHƯA được tạo (để trống).
 * - V112: Bộ số chỉ được tạo khi bấm Lưu đơn hàng — đơn chuyển sang trạng thái Đã xác nhận,
 *   áp dụng cho MỌI loại đơn (Đơn hàng mẫu / Sản xuất / Đơn làm lại).
 * - Đơn đã có Bộ số thì không bao giờ đổi số.
 * - Số bắt đầu lấy từ cấu hình tính toán (CalculationConfig.setNumberStart).
 * - Không dùng lại số đã cấp: bộ đếm lưu ở SystemSetting, đồng thời luôn lớn hơn
 *   số lớn nhất đang có trong dữ liệu để tránh trùng với đơn nhập từ Excel.
 */

export const SET_NUMBER_COUNTER_KEY = "ORDER_SET_NUMBER_COUNTER";

/** V112: chỉ trạng thái "Đã xác nhận" mới sinh Bộ số (mọi loại đơn). */
export const SET_NUMBER_ASSIGN_STATUSES: readonly string[] = SET_NUMBER_STATUSES;

/** Trạng thái đang hiển thị Bộ số trên màn Tạo đơn / Chi tiết đơn (V112: đã xác nhận). */
export function canAssignSetNumbers(status: string | null | undefined) {
  return SET_NUMBER_ASSIGN_STATUSES.includes(String(status ?? "").trim());
}

const SET_NO_PATTERN = /^\d+$/;
const MAX_SET_NO_DIGITS = 18;

/** Bộ số hợp lệ là chuỗi số dương; "0", rỗng, chữ lẫn số đều coi như chưa có số. */
export function normalizeSetNoValue(value: string | null | undefined): string | null {
  const text = String(value ?? "").trim();
  if (!text || text.length > MAX_SET_NO_DIGITS || !SET_NO_PATTERN.test(text)) return null;
  if (Number(text) === 0) return null;
  return text;
}

export async function readSetNumberStart(tx: Prisma.TransactionClient): Promise<number> {
  const setting = await tx.systemSetting.findUnique({
    where: { key: CALCULATION_CONFIG_SETTING_KEY },
    select: { value: true },
  });
  if (!setting?.value) return DEFAULT_SET_NUMBER_START;
  try {
    return normalizeCalculationConfig(JSON.parse(setting.value)).setNumberStart;
  } catch {
    return DEFAULT_SET_NUMBER_START;
  }
}

/**
 * Trả về Bộ số cho từng bộ cửa của đơn theo đúng thứ tự đầu vào.
 * - Giữ nguyên số đã có (không đổi số của đơn đã xác nhận).
 * - Chỉ cấp số mới khi trạng thái đơn cho phép sinh Bộ số.
 */
export async function resolveSetNumbers(
  tx: Prisma.TransactionClient,
  options: { status: string; incoming: Array<string | null | undefined> },
): Promise<Array<string | null>> {
  const kept = options.incoming.map((value) => normalizeSetNoValue(value));
  if (!canAssignSetNumbers(options.status)) return kept;

  const missingCount = kept.filter((value) => value === null).length;
  if (missingCount === 0) return kept;

  const start = await readSetNumberStart(tx);
  const assigned = await reserveSetNumbers(tx, start, missingCount, highestNumericSetNo(kept));
  let cursor = 0;
  return kept.map((value) => value ?? assigned[cursor++]);
}

/** Số lớn nhất trong các Bộ số đang giữ của chính đơn này (tránh cấp trùng khi thêm bộ cửa mới). */
function highestNumericSetNo(values: Array<string | null>) {
  let highest = 0;
  for (const value of values) {
    const parsed = Number.parseInt(String(value ?? ""), 10);
    if (Number.isFinite(parsed) && parsed > highest) highest = parsed;
  }
  return highest;
}

/** Cấp một dải số liên tiếp, đảm bảo không trùng số đã dùng. */
async function reserveSetNumbers(tx: Prisma.TransactionClient, start: number, count: number, keptHighest = 0) {
  const floor = Math.max(1, Math.floor(Number.isFinite(start) ? start : DEFAULT_SET_NUMBER_START));

  // Khóa bộ đếm: INSERT ... ON CONFLICT DO NOTHING tạo hàng khoá nếu chưa có.
  await tx.$executeRaw`
    INSERT INTO system_settings ("key", "value", "created_at", "updated_at")
    VALUES (${SET_NUMBER_COUNTER_KEY}, ${String(Math.max(0, floor - 1))}, now(), now())
    ON CONFLICT (key) DO NOTHING`;

  // V111: gộp SELECT ... FOR UPDATE + MAX + UPDATE thành MỘT câu UPDATE ... RETURNING.
  // Câu UPDATE tự khóa hàng bộ đếm nên hai đơn lưu cùng lúc vẫn không nhận trùng Bộ số,
  // còn số lớn nhất đang dùng được tính bằng subquery ngay trong biểu thức GREATEST.
  // Giá trị mới = max(bộ đếm + count, floor + count - 1, số lớn nhất đang dùng + count, số đang giữ + count)
  // → tương đương first = max(lastUsed + 1, floor, highestInUse + 1, keptHighest + 1).
  const rows = await tx.$queryRaw<Array<{ last_value: bigint | number | string | null }>>`
    UPDATE system_settings
    SET "value" = GREATEST(
          COALESCE(NULLIF("value", '')::bigint, 0) + ${count},
          ${floor + count - 1}::bigint,
          (SELECT COALESCE(MAX("set_no"::bigint), 0) FROM sales_order_items
             WHERE "set_no" ~ '^[0-9]{1,18}$') + ${count},
          ${keptHighest + count}::bigint
        )::text,
        "updated_at" = now()
    WHERE "key" = ${SET_NUMBER_COUNTER_KEY}
    RETURNING "value"::bigint AS last_value`;

  const lastAssigned = toSafeInteger(rows[0]?.last_value);
  const first = Math.max(floor, lastAssigned - count + 1);
  return Array.from({ length: count }, (_, index) => String(first + index));
}

function toSafeInteger(value: unknown) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}
