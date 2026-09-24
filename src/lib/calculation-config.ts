export const CALCULATION_CONFIG_SETTING_KEY = "ORDER_CALCULATION_CONFIG_V1";

export type CalculationScope = "MAIN" | "GROUP" | "ITEM";
export type PricingQuantityRule =
  | "INHERIT"
  | "MANUAL"
  | "DOOR_AREA"
  | "TRIM_LINEAR"
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

export function resolveCalculationRule(
  config: CalculationConfig,
  target: { scope: "MAIN" | "DETAIL"; groupName?: string | null; itemCode?: string | null },
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
        ...activeRules.filter((rule) => rule.scope === "GROUP" && groupMatches(rule.groupName, target.groupName ?? "")),
        ...activeRules.filter((rule) => rule.scope === "ITEM" && sameLookup(rule.itemCode, target.itemCode ?? "")),
      ];

  for (const rule of candidates) result = applyRule(result, rule);
  return result;
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
    const key = rule.scope === "MAIN"
      ? "MAIN"
      : rule.scope === "GROUP"
        ? `GROUP:${normalizeLookup(rule.groupName)}`
        : `ITEM:${normalizeLookup(rule.itemCode)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
