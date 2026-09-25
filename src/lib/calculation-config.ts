export const CALCULATION_CONFIG_SETTING_KEY = "ORDER_CALCULATION_CONFIG_V1";

export type CalculationScope = "MAIN" | "GROUP" | "ITEM";

/**
 * Cách tính KH/Lượng theo kích thước (mm). Kết quả là mét dài hoặc m²:
 * - DOOR_AREA: Cao × Rộng / 1.000.000 — diện tích (m²), dùng cho Bộ cửa chính.
 * - TRIM_LINEAR: (Cao × 2 + Rộng) / 1.000 — 2 cạnh dọc + 1 cạnh ngang, dùng cho Phào/Phao.
 * - V88 thêm 3 công thức chọn thêm cho Phào/Phao và các nhóm tính theo mm:
 *   PERIMETER_LINEAR: (Cao × 2 + Rộng × 2) / 1.000 — chu vi (4 cạnh).
 *   DOUBLE_HEIGHT_LINEAR: Cao × 2 / 1.000 — chỉ 2 cạnh dọc.
 *   WIDTH_LINEAR: Rộng / 1.000 — chỉ cạnh ngang.
 */
export type PricingQuantityRule =
  | "INHERIT"
  | "MANUAL"
  | "DOOR_AREA"
  | "TRIM_LINEAR"
  | "PERIMETER_LINEAR"
  | "DOUBLE_HEIGHT_LINEAR"
  | "WIDTH_LINEAR"
  | "PANEL_COUNT"
  | "PARENT_QUANTITY";
export type InputSuggestionRule =
  | "INHERIT"
  | "KEEP"
  | "PARENT_HEIGHT"
  | "PARENT_WIDTH"
  | "CLEAR";

export type FramePriceConfig = {
  enabled: boolean;
  roundToMm: number;
  standardMaxMm: number;
  doubleMinMm: number;
  doubleMaxMm: number;
  stepMm: number;
  normalStepSurcharge: number;
  doubleSurcharge: number;
  overDoubleStepSurcharge: number;
};

export type CalculationRule = {
  id: string;
  scope: CalculationScope;
  groupName: string;
  itemCode: string;
  /**
   * V89: điều kiện "bộ cửa chính" cho rule áp lên dòng phụ kiện chi tiết — để cùng một phụ kiện
   * (ví dụ Phào rời) dùng công thức khác nhau theo loại cửa cha (cửa sổ / cửa đi).
   * Để trống = áp dụng cho mọi bộ cửa (giữ nguyên hành vi trước V89).
   */
  parentGroupName: string;
  parentItemCode: string;
  pricingRule: PricingQuantityRule;
  heightSuggestion: InputSuggestionRule;
  widthSuggestion: InputSuggestionRule;
  active: boolean;
  note: string;
};

export type CalculationConfig = {
  version: 2;
  decimalPlaces: number;
  /**
   * V75: Số bắt đầu áp dụng cho Bộ số. Bộ số do hệ thống tự tăng dần khi đơn
   * chuyển sang trạng thái Đã xác nhận; đây là số nhỏ nhất được dùng.
   */
  setNumberStart: number;
  framePrice: FramePriceConfig;
  rules: CalculationRule[];
};

export type CalculationCatalogItem = {
  code: string;
  name: string;
  productDescription?: string | null;
};

export type ResolvedCalculationRule = {
  pricingRule: Exclude<PricingQuantityRule, "INHERIT">;
  heightSuggestion: Exclude<InputSuggestionRule, "INHERIT">;
  widthSuggestion: Exclude<InputSuggestionRule, "INHERIT">;
  matchedRuleIds: string[];
};

export const DEFAULT_FRAME_PRICE_CONFIG: FramePriceConfig = {
  enabled: true,
  roundToMm: 10,
  standardMaxMm: 140,
  doubleMinMm: 180,
  doubleMaxMm: 250,
  stepMm: 10,
  normalStepSurcharge: 10_000,
  doubleSurcharge: 110_000,
  overDoubleStepSurcharge: 10_000,
};

export const DEFAULT_SET_NUMBER_START = 1;

export const DEFAULT_CALCULATION_CONFIG: CalculationConfig = {
  version: 2,
  decimalPlaces: 2,
  setNumberStart: DEFAULT_SET_NUMBER_START,
  framePrice: { ...DEFAULT_FRAME_PRICE_CONFIG },
  rules: [
    {
      id: "main-door-area",
      scope: "MAIN",
      groupName: "",
      itemCode: "",
      parentGroupName: "",
      parentItemCode: "",
      pricingRule: "DOOR_AREA",
      heightSuggestion: "KEEP",
      widthSuggestion: "KEEP",
      active: true,
      note: "Bộ cửa chính: KH/Lượng = Cao × Rộng / 1.000.000",
    },
    {
      id: "group-phao",
      scope: "GROUP",
      groupName: "Phào",
      itemCode: "",
      parentGroupName: "",
      parentItemCode: "",
      pricingRule: "TRIM_LINEAR",
      heightSuggestion: "KEEP",
      widthSuggestion: "KEEP",
      active: true,
      note: "Nhóm Phào/Phao: KH/Lượng = (Cao × 2 + Rộng) / 1.000",
    },
    {
      id: "group-o-thoang",
      scope: "GROUP",
      groupName: "Ô Thoáng",
      itemCode: "",
      parentGroupName: "",
      parentItemCode: "",
      pricingRule: "PANEL_COUNT",
      heightSuggestion: "KEEP",
      widthSuggestion: "KEEP",
      active: true,
      note: "Ô thoáng: lấy số 1TK/2TK/3TK/4TK từ Bộ cửa cha",
    },
    {
      id: "group-khoa",
      scope: "GROUP",
      groupName: "Khóa",
      itemCode: "",
      parentGroupName: "",
      parentItemCode: "",
      pricingRule: "PARENT_QUANTITY",
      heightSuggestion: "KEEP",
      widthSuggestion: "KEEP",
      active: true,
      note: "Khóa: KH/Lượng = SL bộ cửa cha",
    },
  ],
};

const PRICING_RULES = new Set<PricingQuantityRule>([
  "INHERIT",
  "MANUAL",
  "DOOR_AREA",
  "TRIM_LINEAR",
  // V88: 3 công thức chọn thêm cho cách tính KH/Lượng.
  "PERIMETER_LINEAR",
  "DOUBLE_HEIGHT_LINEAR",
  "WIDTH_LINEAR",
  "PANEL_COUNT",
  "PARENT_QUANTITY",
]);
const INPUT_RULES = new Set<InputSuggestionRule>([
  "INHERIT",
  "KEEP",
  "PARENT_HEIGHT",
  "PARENT_WIDTH",
  "CLEAR",
]);
const SCOPES = new Set<CalculationScope>(["MAIN", "GROUP", "ITEM"]);

export function normalizeCalculationConfig(value: unknown, fallback: CalculationConfig = DEFAULT_CALCULATION_CONFIG): CalculationConfig {
  if (!value || typeof value !== "object") return cloneCalculationConfig(fallback);
  const source = value as Record<string, unknown>;
  const decimalPlaces = clampInteger(source.decimalPlaces, 0, 4, fallback.decimalPlaces);
  const rawRules = Array.isArray(source.rules) ? source.rules : fallback.rules;
  const rules = rawRules
    .map((raw, index) => normalizeRule(raw, index))
    .filter((rule): rule is CalculationRule => Boolean(rule));
  const framePrice = normalizeFramePriceConfig(source.framePrice, fallback.framePrice);
  const setNumberStart = positiveInteger(source.setNumberStart, fallback.setNumberStart);
  return { version: 2, decimalPlaces, setNumberStart, framePrice, rules };
}

export function cloneCalculationConfig(config: CalculationConfig): CalculationConfig {
  return {
    version: 2,
    decimalPlaces: config.decimalPlaces,
    setNumberStart: config.setNumberStart,
    framePrice: { ...config.framePrice },
    rules: config.rules.map((rule) => ({ ...rule })),
  };
}

export function buildSuggestedCalculationConfig(items: CalculationCatalogItem[]): CalculationConfig {
  const rules: CalculationRule[] = [
    { ...DEFAULT_CALCULATION_CONFIG.rules[0] },
  ];

  const groupNames = Array.from(new Set(items.map((item) => item.name.trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b, "vi"));
  for (const groupName of groupNames) {
    const normalized = normalizeLookup(groupName);
    let pricingRule: PricingQuantityRule | null = null;
    let note = "";
    if (normalized.startsWith("phao")) {
      pricingRule = "TRIM_LINEAR";
      note = "KH/Lượng = (Cao × 2 + Rộng) / 1.000";
    } else if (normalized.startsWith("o thoang")) {
      pricingRule = "PANEL_COUNT";
      note = "KH/Lượng lấy từ 1TK/2TK/3TK/4TK của Bộ cửa cha";
    } else if (normalized.startsWith("khoa")) {
      pricingRule = "PARENT_QUANTITY";
      note = "KH/Lượng = SL bộ cửa cha";
    }
    if (!pricingRule) continue;
    rules.push({
      id: `group-${safeId(groupName)}`,
      scope: "GROUP",
      groupName,
      itemCode: "",
      parentGroupName: "",
      parentItemCode: "",
      pricingRule,
      heightSuggestion: "KEEP",
      widthSuggestion: "KEEP",
      active: true,
      note,
    });
  }

  for (const item of items) {
    const source = normalizeLookup([item.name, item.productDescription, item.code].filter(Boolean).join(" "));
    let heightSuggestion: InputSuggestionRule | null = null;
    let widthSuggestion: InputSuggestionRule | null = null;
    let note = "";

    if (source.includes("phao biet thu dung")) {
      heightSuggestion = "PARENT_HEIGHT";
      widthSuggestion = "CLEAR";
      note = "Đề xuất Cao = Cao cửa; Rộng để trống";
    } else if (source.includes("phao biet thu ngang") || source.includes("phao biet thu dinh")) {
      heightSuggestion = "CLEAR";
      widthSuggestion = "PARENT_WIDTH";
      note = "Đề xuất Rộng = Rộng cửa; Cao để trống";
    } else if (source.includes("phao roi")) {
      heightSuggestion = "PARENT_HEIGHT";
      widthSuggestion = "PARENT_WIDTH";
      note = "Đề xuất Cao/Rộng theo Bộ cửa cha";
    }

    if (!heightSuggestion || !widthSuggestion) continue;
    rules.push({
      id: `item-${safeId(item.code)}`,
      scope: "ITEM",
      groupName: item.name,
      itemCode: item.code,
      parentGroupName: "",
      parentItemCode: "",
      pricingRule: "INHERIT",
      heightSuggestion,
      widthSuggestion,
      active: true,
      note,
    });
  }

  return {
    version: 2,
    decimalPlaces: 2,
    setNumberStart: DEFAULT_SET_NUMBER_START,
    framePrice: { ...DEFAULT_FRAME_PRICE_CONFIG },
    rules: dedupeRules(rules),
  };
}

export type CalculationTarget = {
  scope: "MAIN" | "DETAIL";
  groupName?: string | null;
  itemCode?: string | null;
  /** V89: nhóm hàng / model của BỘ CỬA CHÍNH (cha) — dùng để lọc rule theo loại cửa. */
  parentGroupName?: string | null;
  parentItemCode?: string | null;
};

export function resolveCalculationRule(
  config: CalculationConfig,
  target: CalculationTarget,
): ResolvedCalculationRule {
  let result: ResolvedCalculationRule = {
    pricingRule: "MANUAL",
    heightSuggestion: "KEEP",
    widthSuggestion: "KEEP",
    matchedRuleIds: [],
  };

  const activeRules = config.rules.filter((rule) => rule.active);
  const candidates = target.scope === "MAIN"
    ? activeRules.filter((rule) => rule.scope === "MAIN")
    : [
        ...activeRules.filter((rule) => rule.scope === "GROUP" && groupMatches(rule.groupName, target.groupName ?? "") && parentMatches(rule, target)),
        ...activeRules.filter((rule) => rule.scope === "ITEM" && sameLookup(rule.itemCode, target.itemCode ?? "") && parentMatches(rule, target)),
      ];

  for (const rule of candidates) result = applyRule(result, rule);
  return result;
}

/**
 * V89: rule có điều kiện "bộ cửa chính" chỉ áp dụng khi bộ cửa cha khớp; để trống = áp cho mọi cửa.
 * Rule ở phạm vi Bộ cửa chính (MAIN) không dùng điều kiện này.
 */
function parentMatches(rule: CalculationRule, target: CalculationTarget) {
  if (rule.parentGroupName && !groupMatches(rule.parentGroupName, target.parentGroupName ?? "")) return false;
  if (rule.parentItemCode && !sameLookup(rule.parentItemCode, target.parentItemCode ?? "")) return false;
  return true;
}

export function roundFrameMm(frameMm: number, config: FramePriceConfig) {
  const roundTo = Math.max(1, Math.round(config.roundToMm));
  return Math.round(frameMm / roundTo) * roundTo;
}

export function calculateDoorFrameSurcharge(frameMm: number, config: FramePriceConfig) {
  if (!config.enabled || !Number.isFinite(frameMm) || frameMm <= 0) return 0;
  const rounded = roundFrameMm(frameMm, config);
  const stepMm = Math.max(1, config.stepMm);

  if (rounded <= config.standardMaxMm) return 0;
  if (rounded < config.doubleMinMm) {
    const steps = Math.max(0, Math.round((rounded - config.standardMaxMm) / stepMm));
    return steps * config.normalStepSurcharge;
  }
  if (rounded <= config.doubleMaxMm) return config.doubleSurcharge;

  const overSteps = Math.max(0, Math.round((rounded - config.doubleMaxMm) / stepMm));
  return config.doubleSurcharge + overSteps * config.overDoubleStepSurcharge;
}

export function calculateDoorUnitPrice(baseDealerPrice: number, frameMm: number | null, config: FramePriceConfig) {
  if (!Number.isFinite(baseDealerPrice)) return null;
  if (!config.enabled || frameMm === null || !Number.isFinite(frameMm) || frameMm <= 0) return baseDealerPrice;
  return baseDealerPrice + calculateDoorFrameSurcharge(frameMm, config);
}

export function normalizeLookup(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * V90: khoá so trùng rule — cùng phạm vi VÀ cùng điều kiện "bộ cửa chính" thì mới coi là trùng.
 * Nhờ vậy cùng một Model phụ kiện (ví dụ Phào rời PR) vẫn tạo được nhiều rule cho các loại cửa
 * khác nhau (Cửa Đi 1 Cánh / Cửa Đi 2 Cánh / Cửa sổ ...).
 * Dùng chung cho `dedupeRules()` và `validateCalculationConfig()` để hai chỗ không lệch nhau.
 */
export function calculationRuleKey(rule: CalculationRule) {
  if (rule.scope === "MAIN") return "MAIN";
  return [
    rule.scope,
    normalizeLookup(rule.scope === "GROUP" ? rule.groupName : rule.itemCode),
    normalizeLookup(rule.parentGroupName),
    normalizeLookup(rule.parentItemCode),
  ].join(":");
}

/** Nhãn rule dùng trong thông báo lỗi khi lưu cấu hình. */
export function calculationRuleLabel(rule: CalculationRule) {
  const base = rule.scope === "ITEM" ? rule.itemCode : rule.groupName || "Bộ cửa chính";
  if (rule.scope === "MAIN") return base;
  const parent = rule.parentGroupName
    ? `${rule.parentGroupName}${rule.parentItemCode ? ` · ${rule.parentItemCode}` : ""}`
    : "mọi bộ cửa";
  return `${base} (bộ cửa chính: ${parent})`;
}

/**
 * Kiểm tra cấu hình trước khi lưu (đồng bộ với quy tắc ở bảng Cấu hình tính toán).
 * V90: chuyển từ API route vào lib để dùng chung khoá so trùng với `dedupeRules()` và test được.
 */
export function validateCalculationConfig(config: CalculationConfig) {
  const frame = config.framePrice;
  if (frame.roundToMm <= 0 || frame.stepMm <= 0) throw new Error("Nấc làm tròn Khuôn và nấc tính phụ thu phải lớn hơn 0.");
  if (frame.standardMaxMm >= frame.doubleMinMm) throw new Error("Mốc Khuôn thường phải nhỏ hơn mốc bắt đầu Khuôn kép.");
  if (frame.doubleMinMm > frame.doubleMaxMm) throw new Error("Mốc bắt đầu Khuôn kép không được lớn hơn mốc kết thúc Khuôn kép.");

  const activeMain = config.rules.filter((rule) => rule.active && rule.scope === "MAIN");
  if (activeMain.length > 1) throw new Error("Chỉ được có 1 cấu hình đang dùng cho Bộ cửa chính.");

  const seen = new Set<string>();
  for (const rule of config.rules.filter((item) => item.active)) {
    const key = calculationRuleKey(rule);
    if (seen.has(key)) {
      throw new Error(`Cấu hình đang bị trùng: ${calculationRuleLabel(rule)} — đã có rule khác cùng phạm vi và cùng bộ cửa chính. Khác bộ cửa chính thì tạo được nhiều rule.`);
    }
    seen.add(key);
  }
}

function normalizeFramePriceConfig(value: unknown, fallback: FramePriceConfig): FramePriceConfig {
  const source = value && typeof value === "object" ? value as Record<string, unknown> : {};
  return {
    enabled: source.enabled === undefined ? fallback.enabled : source.enabled !== false,
    roundToMm: positiveInteger(source.roundToMm, fallback.roundToMm),
    standardMaxMm: nonNegativeNumber(source.standardMaxMm, fallback.standardMaxMm),
    doubleMinMm: nonNegativeNumber(source.doubleMinMm, fallback.doubleMinMm),
    doubleMaxMm: nonNegativeNumber(source.doubleMaxMm, fallback.doubleMaxMm),
    stepMm: positiveInteger(source.stepMm, fallback.stepMm),
    normalStepSurcharge: nonNegativeNumber(source.normalStepSurcharge, fallback.normalStepSurcharge),
    doubleSurcharge: nonNegativeNumber(source.doubleSurcharge, fallback.doubleSurcharge),
    overDoubleStepSurcharge: nonNegativeNumber(source.overDoubleStepSurcharge, fallback.overDoubleStepSurcharge),
  };
}

function normalizeRule(value: unknown, index: number): CalculationRule | null {
  if (!value || typeof value !== "object") return null;
  const source = value as Record<string, unknown>;
  const scope = SCOPES.has(String(source.scope) as CalculationScope) ? String(source.scope) as CalculationScope : "GROUP";
  const pricingRule = PRICING_RULES.has(String(source.pricingRule) as PricingQuantityRule)
    ? String(source.pricingRule) as PricingQuantityRule
    : "INHERIT";
  const heightSuggestion = INPUT_RULES.has(String(source.heightSuggestion) as InputSuggestionRule)
    ? String(source.heightSuggestion) as InputSuggestionRule
    : "INHERIT";
  const widthSuggestion = INPUT_RULES.has(String(source.widthSuggestion) as InputSuggestionRule)
    ? String(source.widthSuggestion) as InputSuggestionRule
    : "INHERIT";
  const groupName = String(source.groupName ?? "").trim();
  const itemCode = String(source.itemCode ?? "").trim();
  if (scope === "GROUP" && !groupName) return null;
  if (scope === "ITEM" && !itemCode) return null;

  return {
    id: String(source.id ?? "").trim() || `rule-${index + 1}`,
    scope,
    groupName,
    itemCode,
    // V89: điều kiện bộ cửa chính — cấu hình cũ (chưa có 2 field này) mặc định = mọi bộ cửa.
    parentGroupName: String(source.parentGroupName ?? "").trim(),
    parentItemCode: String(source.parentItemCode ?? "").trim(),
    pricingRule,
    heightSuggestion,
    widthSuggestion,
    active: source.active !== false,
    note: String(source.note ?? "").trim(),
  };
}

function applyRule(current: ResolvedCalculationRule, rule: CalculationRule): ResolvedCalculationRule {
  return {
    pricingRule: rule.pricingRule === "INHERIT" ? current.pricingRule : rule.pricingRule,
    heightSuggestion: rule.heightSuggestion === "INHERIT" ? current.heightSuggestion : rule.heightSuggestion,
    widthSuggestion: rule.widthSuggestion === "INHERIT" ? current.widthSuggestion : rule.widthSuggestion,
    matchedRuleIds: [...current.matchedRuleIds, rule.id],
  };
}

function groupMatches(configured: string, actual: string) {
  const configuredNormalized = normalizeLookup(configured);
  const actualNormalized = normalizeLookup(actual);
  if (!configuredNormalized || !actualNormalized) return false;
  return actualNormalized === configuredNormalized || actualNormalized.startsWith(`${configuredNormalized} `);
}

function sameLookup(left: string, right: string) {
  const a = normalizeLookup(left);
  const b = normalizeLookup(right);
  return Boolean(a && b && a === b);
}

function clampInteger(value: unknown, min: number, max: number, fallback: number) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(min, Math.min(max, Math.round(number)));
}

function positiveInteger(value: unknown, fallback: number) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return fallback;
  return Math.max(1, Math.round(number));
}

function nonNegativeNumber(value: unknown, fallback: number) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) return fallback;
  return number;
}

function safeId(value: string) {
  return normalizeLookup(value).replace(/\s+/g, "-") || "rule";
}

function dedupeRules(rules: CalculationRule[]) {
  const seen = new Set<string>();
  return rules.filter((rule) => {
    // V89/V90: điều kiện bộ cửa chính nằm trong khoá, để cùng một phụ kiện vẫn giữ được
    // nhiều rule cho các loại cửa khác nhau (ví dụ Phào rời của cửa sổ và của cửa đi).
    const key = calculationRuleKey(rule);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
