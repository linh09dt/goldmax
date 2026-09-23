
type UnknownRecord = Record<string, unknown>;

export type NormalizedOrderLine = {
  setNo: string | null;
  productName: string | null;
  productCode: string | null;
  model: string | null;
  openingDirection: string | null;
  trimDirection: string | null;
  paintColor: string | null;
  heightMm: number | null;
  widthMm: number | null;
  frameMm: number | null;
  clearHeightMm: number | null;
  clearWidthMm: number | null;
  panelInfo: string | null;
  trimBarsPerSet: number | null;
  trimType: string | null;
  lockModel: string | null;
  windowBars: string | null;
  leavesPerSet: number | null;
  quantity: number | null;
  unit: string | null;
  pricingQuantity: number | null;
  unitPrice: number | null;
  amount: number | null;
  note: string | null;
  imagePath: string | null;
  modelCheck: string | null;
  priceCheck: string | null;
};

export type NormalizedOrder = {
  orderCode: string;
  orderData: {
    status: string;
    customerCode: string | null;
    customerName: string | null;
    salesEmployeeCode: string | null;
    orderDate: Date | null;
    requiredDeliveryDate: Date | null;
    receiverName: string | null;
    receiverPhone: string | null;
    receiverAddress: string | null;
    deliveryKm: number | null;
    region: string | null;
    groupNo: number | null;
    excelUpdateDate: Date | null;
    formCode: string | null;
    formEffectiveDate: Date | null;
    shippingFee: number;
    subtotal: number;
    discountPercent: number;
    discountAmount: number;
    totalAfterDiscount: number;
    depositAmount: number;
    warehouseReceiptDeduction: number;
    deliveryPayment: number;
  };
  items: Array<{
    lineNo: number;
    data: NormalizedOrderLine;
    details: Array<{ rowOrder: number; detailType: string | null; data: NormalizedOrderLine }>;
  }>;
  requirements: Array<{
    code: string;
    questionText: string;
    answer: string | null;
    note: string | null;
    sortOrder: number;
  }>;
};

export function normalizeOrderPayload(input: unknown): NormalizedOrder {
  if (!isRecord(input)) throw new Error("Dữ liệu đơn hàng không hợp lệ.");

  const requiredInfo = normalizeRequiredOrderInfo(input);
  const orderCode = requiredInfo.orderCode;
  const rawItems = Array.isArray(input.items) ? input.items : [];
  if (rawItems.length === 0) throw new Error("Đơn hàng phải có ít nhất 1 bộ cửa.");

  const items = rawItems.map((rawItem, itemIndex) => {
    if (!isRecord(rawItem)) throw new Error(`Bộ cửa ${itemIndex + 1} không hợp lệ.`);
    const rawDetails = Array.isArray(rawItem.details) ? rawItem.details : [];
    return {
      lineNo: itemIndex + 1,
      data: normalizeLine(rawItem),
      details: rawDetails.filter(isRecord).map((row, rowIndex) => ({
        rowOrder: rowIndex + 1,
        detailType: optionalText(row.detailType),
        data: normalizeLine(row),
      })),
    };
  });

  const shippingFee = nonNegativeNumber(input.shippingFee) ?? 0;
  const discountPercent = clampPercent(nonNegativeNumber(input.discountPercent) ?? 0);
  const depositAmount = nonNegativeNumber(input.depositAmount) ?? 0;
  const warehouseReceiptDeduction = nonNegativeNumber(input.warehouseReceiptDeduction) ?? 0;

  const lineTotal = items.reduce((sum, item) => {
    const mainAmount = resolvedAmount(item.data);
    const detailsAmount = item.details.reduce((detailSum, detail) => detailSum + resolvedAmount(detail.data), 0);
    return sum + mainAmount + detailsAmount;
  }, 0);

  const subtotal = roundMoney(lineTotal + shippingFee);
  const discountAmount = roundMoney((subtotal * discountPercent) / 100);
  const totalAfterDiscount = roundMoney(Math.max(0, subtotal - discountAmount));
  const deliveryPayment = roundMoney(
    Math.max(0, totalAfterDiscount - depositAmount - warehouseReceiptDeduction),
  );

  for (const item of items) {
    item.data.amount = resolvedAmountOrNull(item.data);
    for (const detail of item.details) detail.data.amount = resolvedAmountOrNull(detail.data);
  }

  const rawRequirements = Array.isArray(input.requirements) ? input.requirements : [];
  const requirements = rawRequirements.filter(isRecord).map((row, index) => ({
    code: optionalText(row.code) || `CAU_HOI_${index + 1}`,
    questionText: optionalText(row.questionText) || `Câu hỏi ${index + 1}`,
    answer: optionalText(row.answer),
    note: optionalText(row.note),
    sortOrder: index + 1,
  }));

  return {
    orderCode,
    orderData: {
      status: requiredInfo.status,
      customerCode: requiredInfo.customerCode,
      customerName: requiredInfo.customerName,
      salesEmployeeCode: requiredInfo.salesEmployeeCode,
      orderDate: requiredInfo.orderDate,
      requiredDeliveryDate: requiredInfo.requiredDeliveryDate,
      receiverName: requiredInfo.receiverName,
      receiverPhone: requiredInfo.receiverPhone,
      receiverAddress: requiredInfo.receiverAddress,
      deliveryKm: requiredInfo.deliveryKm,
      region: requiredInfo.region,
      groupNo: requiredInfo.groupNo,
      excelUpdateDate: requiredInfo.excelUpdateDate,
      formCode: requiredInfo.formCode,
      formEffectiveDate: requiredInfo.formEffectiveDate,
      shippingFee,
      subtotal,
      discountPercent,
      discountAmount,
      totalAfterDiscount,
      depositAmount,
      warehouseReceiptDeduction,
      deliveryPayment,
    },
    items,
    requirements,
  };
}

function normalizeRequiredOrderInfo(input: UnknownRecord) {
  const textFields = [
    ["customerCode", "Mã Đại Lý"],
    ["customerName", "Tên khách hàng"],
    ["salesEmployeeCode", "NVKD phụ trách"],
    ["orderCode", "Mã đơn hàng"],
    ["status", "Trạng thái"],
    ["receiverName", "Người nhận"],
    ["receiverPhone", "Số điện thoại"],
    ["region", "Vùng miền"],
    ["formCode", "Mã biểu mẫu"],
    ["receiverAddress", "Địa chỉ nhận hàng"],
  ] as const;
  const dateFields = [
    ["orderDate", "Ngày đặt hàng"],
    ["requiredDeliveryDate", "Ngày cần giao hàng"],
    ["excelUpdateDate", "Ngày cập nhật"],
    ["formEffectiveDate", "Ngày hiệu lực"],
  ] as const;
  const numberFields = [
    ["deliveryKm", "Số Km giao hàng"],
    ["groupNo", "Nhóm"],
  ] as const;

  const missing = [
    ...textFields.filter(([key]) => !optionalText(input[key])).map(([, label]) => label),
    ...dateFields.filter(([key]) => !optionalText(input[key])).map(([, label]) => label),
    ...numberFields.filter(([key]) => input[key] === null || input[key] === undefined || String(input[key]).trim() === "").map(([, label]) => label),
  ];
  if (missing.length) {
    throw new Error(`Vui lòng nhập đầy đủ thông tin bắt buộc: ${missing.join(", ")}.`);
  }

  const orderDate = requiredDate(input.orderDate, "Ngày đặt hàng");
  const requiredDeliveryDate = requiredDate(input.requiredDeliveryDate, "Ngày cần giao hàng");
  const excelUpdateDate = requiredDate(input.excelUpdateDate, "Ngày cập nhật");
  const formEffectiveDate = requiredDate(input.formEffectiveDate, "Ngày hiệu lực");
  const deliveryKm = requiredNonNegativeNumber(input.deliveryKm, "Số Km giao hàng");
  const groupNo = requiredInteger(input.groupNo, "Nhóm");

  return {
    customerCode: requiredText(input.customerCode, "Mã Đại Lý"),
    customerName: requiredText(input.customerName, "Tên khách hàng"),
    salesEmployeeCode: requiredText(input.salesEmployeeCode, "NVKD phụ trách"),
    orderCode: requiredText(input.orderCode, "Mã đơn hàng"),
    status: requiredText(input.status, "Trạng thái"),
    orderDate,
    requiredDeliveryDate,
    excelUpdateDate,
    receiverName: requiredText(input.receiverName, "Người nhận"),
    receiverPhone: requiredText(input.receiverPhone, "Số điện thoại"),
    deliveryKm,
    region: requiredText(input.region, "Vùng miền"),
    groupNo,
    formCode: requiredText(input.formCode, "Mã biểu mẫu"),
    formEffectiveDate,
    receiverAddress: requiredText(input.receiverAddress, "Địa chỉ nhận hàng"),
  };
}

function normalizeLine(row: UnknownRecord): NormalizedOrderLine {
  return {
    setNo: optionalText(row.setNo),
    productName: optionalText(row.productName),
    productCode: optionalText(row.productCode),
    model: optionalText(row.model),
    openingDirection: optionalText(row.openingDirection),
    trimDirection: optionalText(row.trimDirection),
    paintColor: optionalText(row.paintColor),
    heightMm: integerOrNull(row.heightMm),
    widthMm: integerOrNull(row.widthMm),
    frameMm: integerOrNull(row.frameMm),
    clearHeightMm: integerOrNull(row.clearHeightMm),
    clearWidthMm: integerOrNull(row.clearWidthMm),
    panelInfo: optionalText(row.panelInfo),
    trimBarsPerSet: integerOrNull(row.trimBarsPerSet),
    trimType: optionalText(row.trimType),
    lockModel: optionalText(row.lockModel),
    windowBars: optionalText(row.windowBars),
    leavesPerSet: integerOrNull(row.leavesPerSet),
    quantity: integerOrNull(row.quantity),
    unit: optionalText(row.unit),
    pricingQuantity: nonNegativeNumber(row.pricingQuantity),
    unitPrice: nonNegativeNumber(row.unitPrice),
    amount: nonNegativeNumber(row.amount),
    note: optionalText(row.note),
    imagePath: optionalText(row.imagePath),
    modelCheck: optionalText(row.modelCheck),
    priceCheck: optionalText(row.priceCheck),
  };
}

function resolvedAmount(line: NormalizedOrderLine) {
  if (line.amount !== null) return line.amount;
  if (line.pricingQuantity !== null && line.unitPrice !== null) {
    return roundMoney(line.pricingQuantity * line.unitPrice);
  }
  return 0;
}

function resolvedAmountOrNull(line: NormalizedOrderLine) {
  const result = resolvedAmount(line);
  const hasPricing = line.amount !== null || (line.pricingQuantity !== null && line.unitPrice !== null);
  return hasPricing ? result : null;
}

function isRecord(value: unknown): value is UnknownRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function optionalText(value: unknown) {
  if (value === null || value === undefined) return null;
  const normalized = String(value).trim();
  return normalized ? normalized : null;
}

function requiredText(value: unknown, label: string) {
  const result = optionalText(value);
  if (!result) throw new Error(`${label} là bắt buộc.`);
  return result;
}

function numberOrNull(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const normalized = typeof value === "string" ? value.replace(/,/g, "").trim() : value;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function nonNegativeNumber(value: unknown) {
  const parsed = numberOrNull(value);
  return parsed === null ? null : Math.max(0, parsed);
}

function integerOrNull(value: unknown) {
  const parsed = numberOrNull(value);
  return parsed === null ? null : Math.trunc(parsed);
}

function parseDate(value: unknown) {
  const text = optionalText(value);
  if (!text) return null;
  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
}

function requiredDate(value: unknown, label: string) {
  const result = parseDate(value);
  if (!result) throw new Error(`${label} không hợp lệ.`);
  return result;
}

function requiredNonNegativeNumber(value: unknown, label: string) {
  const parsed = numberOrNull(value);
  if (parsed === null || parsed < 0) throw new Error(`${label} không hợp lệ.`);
  return parsed;
}

function requiredInteger(value: unknown, label: string) {
  const parsed = numberOrNull(value);
  if (parsed === null || !Number.isInteger(parsed)) throw new Error(`${label} không hợp lệ.`);
  return parsed;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function clampPercent(value: number) {
  return Math.min(100, Math.max(0, value));
}

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
