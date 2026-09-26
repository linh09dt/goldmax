/**
 * V136 — Cấu hình module Lên kế hoạch sản xuất.
 *
 * Lưu trong `system_settings` dưới MỘT key JSON, đúng cách `ORDER_CALCULATION_CONFIG_V1`
 * đang làm (`src/lib/calculation-config.ts`) — không cần bảng mới, sửa được trong app.
 *
 * Mọi con số ở đây lấy từ kết quả khảo sát nhà máy 2026-09-26 (222/230 câu) và đều
 * SỬA ĐƯỢC ở màn Cấu hình sản xuất. Không hard-code nghiệp vụ trong code.
 */

export const PRODUCTION_CONFIG_SETTING_KEY = "PRODUCTION_CONFIG_V1";

export type ProductionConfig = {
  version: 1;
  /** Ngày làm việc trong tuần: 0 = Chủ nhật … 6 = Thứ 7. A2: "không tính chủ nhật và ngày lễ". */
  workingDays: number[];
  shiftsPerDay: number;
  hoursPerShift: number;
  /** Đơn vị lên kế hoạch. B1: "làm theo số bộ" → luôn là bộ. */
  planUnit: "BO";
  /** Đơn vị tính tải. Xưởng nói bằng CÁNH (lá cửa) — xem V136 mục 2.13. */
  capacityUnit: "CANH";
  /**
   * Đệm trước hạn giao (ngày làm việc).
   * B6/GH2: hạn giao là NGÀY GIAO TỚI KHÁCH, nên xưởng phải xong sớm hơn để còn gọi xe ghép (GH3).
   */
  deliveryBufferDays: number;
  /**
   * Gối công đoạn (giờ mỗi bước). C6: "thông thường chúng tôi gối công đoạn 1 ngày" → đặt 24 để bật.
   * 0 = cộng dồn toàn bộ thời lượng (cách tính an toàn, mặc định).
   */
  overlapHoursPerStep: number;
  /** Ngưỡng cảnh báo vàng và đỏ cho toàn xưởng (KH6/KH7: quá 70 cánh/ngày là quá nhiều). */
  dailyWarnCanh: number;
  dailyMaxCanh: number;
  /** Loại đơn đưa vào kế hoạch. Người dùng chốt 2026-09-26: TẤT CẢ loại đơn đều vào kế hoạch. */
  entryOrderTypes: string[];
  /** Điều kiện đủ thông tin mới xếp lịch (B3/KH5: khách đã xác nhận + đủ kích thước/hướng mở/màu). */
  requireInfoBeforePlan: Array<"heightMm" | "widthMm" | "openingDirection" | "paintColor">;
  /** Sơn: gom lô màu tối thiểu bao nhiêu cánh (SON7). */
  paintBatchMinCanh: number;
  /** Chấn: tối đa mấy lượt đổi khuôn mỗi ngày (CH4). */
  bendChangeoverMaxPerDay: number;
  /** Có tính các khoảng CHỜ (chờ khô sau sơn, sau vân, sau Bồi Lares…) vào thời lượng không. */
  waitsEnabled: boolean;
  /** J8: trễ hạn chỉ BÁO ĐỎ, không tự đề xuất lại lịch. */
  autoReschedule: boolean;
};

export const DEFAULT_PRODUCTION_CONFIG: ProductionConfig = {
  version: 1,
  // A2: làm thứ 2 → thứ 7, nghỉ Chủ nhật. Ngày lễ để trong bảng production_calendar.
  workingDays: [1, 2, 3, 4, 5, 6],
  shiftsPerDay: 2,
  hoursPerShift: 8,
  planUnit: "BO",
  capacityUnit: "CANH",
  // Giao tới khách bằng xe ghép nên chừa 1 ngày làm việc.
  deliveryBufferDays: 1,
  overlapHoursPerStep: 0,
  dailyWarnCanh: 70,
  dailyMaxCanh: 80,
  entryOrderTypes: ["MAU", "SAN_XUAT", "LAM_LAI"],
  requireInfoBeforePlan: ["heightMm", "widthMm", "openingDirection", "paintColor"],
  paintBatchMinCanh: 20,
  bendChangeoverMaxPerDay: 2,
  waitsEnabled: true,
  autoReschedule: false,
};

const VALID_WEEKDAYS = new Set([0, 1, 2, 3, 4, 5, 6]);
const VALID_INFO_FIELDS = new Set(["heightMm", "widthMm", "openingDirection", "paintColor"]);
const VALID_ORDER_TYPES = new Set(["MAU", "SAN_XUAT", "LAM_LAI"]);

function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function boolValue(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

/** Chuẩn hoá cấu hình đọc từ DB / từ client — luôn trả về object đủ trường, giá trị hợp lệ. */
export function normalizeProductionConfig(
  value: unknown,
  fallback: ProductionConfig = DEFAULT_PRODUCTION_CONFIG,
): ProductionConfig {
  if (!value || typeof value !== "object") return { ...fallback, workingDays: [...fallback.workingDays] };
  const source = value as Record<string, unknown>;

  const workingDays = Array.isArray(source.workingDays)
    ? Array.from(new Set(source.workingDays.map((day) => Number(day)).filter((day) => VALID_WEEKDAYS.has(day)))).sort()
    : [...fallback.workingDays];
  // Không cho rỗng — nếu rỗng thì mọi ngày đều là ngày nghỉ, không tính được ngày xong.
  const safeWorkingDays = workingDays.length ? workingDays : [...fallback.workingDays];

  const entryOrderTypes = Array.isArray(source.entryOrderTypes)
    ? Array.from(new Set(source.entryOrderTypes.map((item) => String(item ?? "").trim()).filter((item) => VALID_ORDER_TYPES.has(item))))
    : [...fallback.entryOrderTypes];

  const requireInfoBeforePlan = Array.isArray(source.requireInfoBeforePlan)
    ? Array.from(
        new Set(
          source.requireInfoBeforePlan
            .map((item) => String(item ?? "").trim())
            .filter((item): item is ProductionConfig["requireInfoBeforePlan"][number] => VALID_INFO_FIELDS.has(item)),
        ),
      )
    : [...fallback.requireInfoBeforePlan];

  return {
    version: 1,
    workingDays: safeWorkingDays,
    shiftsPerDay: Math.round(clampNumber(source.shiftsPerDay, 1, 4, fallback.shiftsPerDay)),
    hoursPerShift: clampNumber(source.hoursPerShift, 1, 24, fallback.hoursPerShift),
    planUnit: "BO",
    capacityUnit: "CANH",
    deliveryBufferDays: Math.round(clampNumber(source.deliveryBufferDays, 0, 30, fallback.deliveryBufferDays)),
    overlapHoursPerStep: clampNumber(source.overlapHoursPerStep, 0, 24, fallback.overlapHoursPerStep),
    dailyWarnCanh: clampNumber(source.dailyWarnCanh, 1, 10_000, fallback.dailyWarnCanh),
    dailyMaxCanh: clampNumber(source.dailyMaxCanh, 1, 10_000, fallback.dailyMaxCanh),
    entryOrderTypes: entryOrderTypes.length ? entryOrderTypes : [...fallback.entryOrderTypes],
    requireInfoBeforePlan,
    paintBatchMinCanh: Math.round(clampNumber(source.paintBatchMinCanh, 1, 1000, fallback.paintBatchMinCanh)),
    bendChangeoverMaxPerDay: Math.round(clampNumber(source.bendChangeoverMaxPerDay, 1, 50, fallback.bendChangeoverMaxPerDay)),
    waitsEnabled: boolValue(source.waitsEnabled, fallback.waitsEnabled),
    autoReschedule: boolValue(source.autoReschedule, fallback.autoReschedule),
  };
}

export function cloneProductionConfig(config: ProductionConfig): ProductionConfig {
  return {
    ...config,
    workingDays: [...config.workingDays],
    entryOrderTypes: [...config.entryOrderTypes],
    requireInfoBeforePlan: [...config.requireInfoBeforePlan],
  };
}

/** Kiểm tra hợp lệ trước khi ghi — ném lỗi tiếng Việt cho người dùng. */
export function validateProductionConfig(config: ProductionConfig) {
  if (!config.workingDays.length) throw new Error("Phải chọn ít nhất 1 ngày làm việc trong tuần.");
  if (!config.entryOrderTypes.length) throw new Error("Phải chọn ít nhất 1 loại đơn được đưa vào kế hoạch.");
  if (config.dailyMaxCanh < config.dailyWarnCanh) {
    throw new Error("Ngưỡng đỏ (cánh/ngày) phải lớn hơn hoặc bằng ngưỡng vàng.");
  }
  if (config.hoursPerShift * config.shiftsPerDay < 1) {
    throw new Error("Số giờ làm việc mỗi ngày phải lớn hơn 0.");
  }
}

export const WEEKDAY_LABELS: Record<number, string> = {
  0: "Chủ nhật",
  1: "Thứ 2",
  2: "Thứ 3",
  3: "Thứ 4",
  4: "Thứ 5",
  5: "Thứ 6",
  6: "Thứ 7",
};
