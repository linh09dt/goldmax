export type ShippingRateRow = {
  id?: number;
  doorGroup: string;
  modelName: string;
  modelCode: string;
  quantityTier: number;
  northLe100: number;
  north101To200: number;
  northOver200: number;
  central: number;
  active?: boolean;
};

export type ShippingOrderItemInput = {
  lineNo: number;
  setNo: string | null;
  productName: string | null;
  productCode: string | null;
  model: string | null;
  quantity: number | null;
};

export type ShippingLineResult = {
  modelCode: string;
  modelName: string;
  quantity: number;
  quantityTier: number;
  bandLabel: string;
  baseRatePerSet: number;
  fullRouteFreight: number;
  factorySupport: number;
  customerFreight: number;
  missingRate: boolean;
  sourceLines: number[];
};

export const SHIPPING_SUPPORT_KM = 50;

export const DEFAULT_SHIPPING_RATES: ShippingRateRow[] = [
  { doorGroup: "CỬA ĐI", modelName: "1 cánh - SV1", modelCode: "SV1", quantityTier: 1, northLe100: 200000, north101To200: 300000, northOver200: 300000, central: 400000 },
  { doorGroup: "CỬA ĐI", modelName: "1 cánh - SV1", modelCode: "SV1", quantityTier: 2, northLe100: 150000, north101To200: 200000, northOver200: 250000, central: 350000 },
  { doorGroup: "CỬA ĐI", modelName: "2 cánh - SV2", modelCode: "SV2", quantityTier: 1, northLe100: 300000, north101To200: 350000, northOver200: 400000, central: 600000 },
  { doorGroup: "CỬA ĐI", modelName: "2 cánh - SV2", modelCode: "SV2", quantityTier: 2, northLe100: 250000, north101To200: 300000, northOver200: 350000, central: 500000 },
  { doorGroup: "CỬA ĐI", modelName: "4 cánh - SV4", modelCode: "SV4", quantityTier: 1, northLe100: 500000, north101To200: 600000, northOver200: 800000, central: 1000000 },
  { doorGroup: "CỬA ĐI", modelName: "4 cánh - SV4", modelCode: "SV4", quantityTier: 2, northLe100: 400000, north101To200: 500000, northOver200: 700000, central: 800000 },
  { doorGroup: "CỬA SỔ", modelName: "1 cánh - SVCS1", modelCode: "SVCS1", quantityTier: 1, northLe100: 200000, north101To200: 250000, northOver200: 300000, central: 400000 },
  { doorGroup: "CỬA SỔ", modelName: "1 cánh - SVCS1", modelCode: "SVCS1", quantityTier: 2, northLe100: 150000, north101To200: 200000, northOver200: 250000, central: 350000 },
  { doorGroup: "CỬA SỔ", modelName: "2 cánh - SVCS2", modelCode: "SVCS2", quantityTier: 1, northLe100: 250000, north101To200: 300000, northOver200: 400000, central: 500000 },
  { doorGroup: "CỬA SỔ", modelName: "2 cánh - SVCS2", modelCode: "SVCS2", quantityTier: 2, northLe100: 200000, north101To200: 250000, northOver200: 300000, central: 400000 },
  { doorGroup: "CỬA SỔ", modelName: "3 cánh - SVCS3", modelCode: "SVCS3", quantityTier: 1, northLe100: 400000, north101To200: 500000, northOver200: 600000, central: 700000 },
  { doorGroup: "CỬA SỔ", modelName: "3 cánh - SVCS3", modelCode: "SVCS3", quantityTier: 2, northLe100: 300000, north101To200: 400000, northOver200: 500000, central: 600000 },
  { doorGroup: "CỬA SỔ", modelName: "4 cánh - SVCS4", modelCode: "SVCS4", quantityTier: 1, northLe100: 400000, north101To200: 500000, northOver200: 600000, central: 700000 },
  { doorGroup: "CỬA SỔ", modelName: "4 cánh - SVCS4", modelCode: "SVCS4", quantityTier: 2, northLe100: 300000, north101To200: 400000, northOver200: 500000, central: 600000 },
];

export function calculateShipping(input: {
  items: ShippingOrderItemInput[];
  rates: ShippingRateRow[];
  region: string;
  deliveryKm: number;
  mountainDistrict?: boolean;
}) {
  const deliveryKm = finiteNonNegative(input.deliveryKm);
  const region = normalizeText(input.region);
  const activeRates = input.rates.filter((row) => row.active !== false);

  const grouped = new Map<string, { quantity: number; sourceLines: number[] }>();
  for (const item of input.items) {
    const quantity = Math.max(0, Math.trunc(item.quantity ?? 0));
    if (!quantity) continue;
    const modelCode = resolveModelCode(item.model, item.productCode, activeRates);
    if (!modelCode) {
      const key = `__MISSING__${item.lineNo}`;
      grouped.set(key, { quantity, sourceLines: [item.lineNo] });
      continue;
    }
    const current = grouped.get(modelCode) ?? { quantity: 0, sourceLines: [] };
    current.quantity += quantity;
    current.sourceLines.push(item.lineNo);
    grouped.set(modelCode, current);
  }

  const lines: ShippingLineResult[] = [];
  for (const [modelCode, group] of grouped.entries()) {
    if (modelCode.startsWith("__MISSING__")) {
      lines.push({
        modelCode: "Chưa có Model",
        modelName: "Không xác định được Model từ bộ cửa",
        quantity: group.quantity,
        quantityTier: group.quantity > 1 ? 2 : 1,
        bandLabel: bandLabel(region, deliveryKm, Boolean(input.mountainDistrict)),
        baseRatePerSet: 0,
        fullRouteFreight: 0,
        factorySupport: 0,
        customerFreight: 0,
        missingRate: true,
        sourceLines: group.sourceLines,
      });
      continue;
    }

    const quantityTier = group.quantity > 1 ? 2 : 1;
    const rate = activeRates.find((row) => normalizeCode(row.modelCode) === modelCode && row.quantityTier === quantityTier);
    if (!rate) {
      lines.push({
        modelCode,
        modelName: modelCode,
        quantity: group.quantity,
        quantityTier,
        bandLabel: bandLabel(region, deliveryKm, Boolean(input.mountainDistrict)),
        baseRatePerSet: 0,
        fullRouteFreight: 0,
        factorySupport: 0,
        customerFreight: 0,
        missingRate: true,
        sourceLines: group.sourceLines,
      });
      continue;
    }

    const baseRatePerSet = selectRate(rate, region, deliveryKm, Boolean(input.mountainDistrict));
    const fullRouteFreight = baseRatePerSet * group.quantity;
    const billableKm = Math.max(0, deliveryKm - SHIPPING_SUPPORT_KM);
    const customerFreight = deliveryKm > 0 ? (baseRatePerSet / deliveryKm) * billableKm * group.quantity : 0;
    const factorySupport = Math.max(0, fullRouteFreight - customerFreight);

    lines.push({
      modelCode,
      modelName: rate.modelName,
      quantity: group.quantity,
      quantityTier,
      bandLabel: bandLabel(region, deliveryKm, Boolean(input.mountainDistrict)),
      baseRatePerSet,
      fullRouteFreight: roundMoney(fullRouteFreight),
      factorySupport: roundMoney(factorySupport),
      customerFreight: roundMoney(customerFreight),
      missingRate: baseRatePerSet <= 0,
      sourceLines: group.sourceLines,
    });
  }

  const rawTotal = lines.reduce((sum, row) => sum + row.customerFreight, 0);
  const roundedTotal = rawTotal > 0 ? Math.ceil(rawTotal / 1000) * 1000 : 0;
  const missingRateCount = lines.filter((row) => row.missingRate).length;

  return {
    region,
    deliveryKm,
    mountainDistrict: Boolean(input.mountainDistrict),
    supportKm: SHIPPING_SUPPORT_KM,
    bandLabel: bandLabel(region, deliveryKm, Boolean(input.mountainDistrict)),
    lines,
    rawTotal: roundMoney(rawTotal),
    roundedTotal,
    missingRateCount,
  };
}

export function selectRate(rate: ShippingRateRow, region: string, deliveryKm: number, mountainDistrict: boolean) {
  const normalizedRegion = normalizeText(region);
  if (normalizedRegion === "MIỀN TRUNG" || normalizedRegion === "MIEN TRUNG") return deliveryKm > 200 ? finiteNonNegative(rate.central) : 0;
  if (normalizedRegion === "MIỀN BẮC" || normalizedRegion === "MIEN BAC") {
    if (mountainDistrict || deliveryKm > 200) return finiteNonNegative(rate.northOver200);
    if (deliveryKm > 100) return finiteNonNegative(rate.north101To200);
    return finiteNonNegative(rate.northLe100);
  }
  return 0;
}

export function bandLabel(region: string, deliveryKm: number, mountainDistrict: boolean) {
  const normalizedRegion = normalizeText(region);
  if (normalizedRegion === "MIỀN TRUNG" || normalizedRegion === "MIEN TRUNG") return deliveryKm > 200 ? "Miền Trung · Từ Nghệ An trở vào" : "Miền Trung · cần quãng đường > 200 km";
  if (normalizedRegion === "MIỀN BẮC" || normalizedRegion === "MIEN BAC") {
    if (mountainDistrict) return "Miền Bắc · Huyện miền núi";
    if (deliveryKm <= 100) return "Miền Bắc · ≤ 100 km";
    if (deliveryKm <= 200) return "Miền Bắc · > 100 đến 200 km";
    return "Miền Bắc · > 200 km";
  }
  return "Chưa xác định vùng miền";
}

function resolveModelCode(model: string | null, productCode: string | null, rates: ShippingRateRow[]) {
  const direct = normalizeCode(model);
  if (direct && rates.some((row) => normalizeCode(row.modelCode) === direct)) return direct;
  const product = normalizeCode(productCode);
  if (!product) return "";
  const known = Array.from(new Set(rates.map((row) => normalizeCode(row.modelCode)).filter(Boolean))).sort((a, b) => b.length - a.length);
  return known.find((code) => product === code || product.startsWith(`${code}-`)) ?? "";
}

function normalizeCode(value: unknown) {
  return String(value ?? "").trim().toUpperCase();
}

function normalizeText(value: unknown) {
  return String(value ?? "").trim().toUpperCase().replace(/\s+/g, " ");
}

function finiteNonNegative(value: unknown) {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? Math.max(0, number) : 0;
}

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
