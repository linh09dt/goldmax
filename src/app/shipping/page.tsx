import { ErpShell } from "@/components/erp-shell";
import { ShippingCalculator } from "@/components/shipping-calculator";
import { prisma } from "@/lib/prisma";
import { DEFAULT_SHIPPING_RATES } from "@/lib/shipping";

export const dynamic = "force-dynamic";

export default async function ShippingPage() {
  const [orders, persistedRates, persistedMappings, itemMasters] = await Promise.all([
    prisma.salesOrder.findMany({
      orderBy: [{ requiredDeliveryDate: "asc" }, { id: "desc" }],
      select: {
        id: true,
        orderCode: true,
        status: true,
        customerCode: true,
        customerName: true,
        receiverAddress: true,
        region: true,
        deliveryKm: true,
        shippingFee: true,
        shippingMountainDistrict: true,
        shippingCalculatedAt: true,
        updatedAt: true,
        items: {
          orderBy: { lineNo: "asc" },
          select: {
            lineNo: true,
            setNo: true,
            productName: true,
            productCode: true,
            model: true,
            quantity: true,
          },
        },
      },
    }),
    prisma.shippingRate.findMany({
      orderBy: [{ doorGroup: "asc" }, { modelCode: "asc" }, { quantityTier: "asc" }],
    }),
    prisma.shippingModelMapping.findMany({
      orderBy: [{ active: "desc" }, { sourceModel: "asc" }],
    }),
    prisma.itemMaster.findMany({
      where: { active: true },
      select: { code: true, name: true },
      orderBy: [{ name: "asc" }, { code: "asc" }],
    }),
  ]);

  const rates = persistedRates.length
    ? persistedRates.map((row) => ({
        id: row.id,
        doorGroup: row.doorGroup,
        modelName: row.modelName,
        modelCode: row.modelCode,
        quantityTier: row.quantityTier,
        northLe100: Number(String(row.northLe100)),
        north101To200: Number(String(row.north101To200)),
        northOver200: Number(String(row.northOver200)),
        central: Number(String(row.central)),
        active: row.active,
      }))
    : DEFAULT_SHIPPING_RATES;

  const mappings = persistedMappings.map((row) => ({
    id: row.id,
    sourceModel: row.sourceModel,
    shippingModelCode: row.shippingModelCode,
    note: row.note,
    active: row.active,
  }));

  const tenhangByCode = new Map<string, string>();
  const tenhangByName = new Map<string, string>();
  for (const item of itemMasters) {
    const name = item.name.trim();
    if (!name) continue;
    tenhangByCode.set(normalizeKey(item.code), name);
    const nameKey = normalizeKey(name);
    if (!tenhangByName.has(nameKey)) tenhangByName.set(nameKey, name);
  }
  const knownTenhangs = Array.from(new Set(itemMasters.map((item) => item.name.trim()).filter(Boolean)))
    .sort((a, b) => a.localeCompare(b, "vi"));

  const safeOrders = orders.map((order) => ({
    id: order.id,
    orderCode: order.orderCode,
    status: order.status,
    customerCode: order.customerCode,
    customerName: order.customerName,
    receiverAddress: order.receiverAddress,
    region: order.region,
    deliveryKm: order.deliveryKm,
    shippingFee: Number(String(order.shippingFee ?? 0)),
    shippingMountainDistrict: order.shippingMountainDistrict,
    shippingCalculatedAt: order.shippingCalculatedAt?.toISOString() ?? null,
    updatedAt: order.updatedAt.toISOString(),
    items: order.items.map((item) => ({
      ...item,
      tenhang: resolveTenhang(item, tenhangByCode, tenhangByName),
    })),
  }));

  return (
    <ErpShell
      title="Tính cước vận chuyển"
    >
      <ShippingCalculator
        orders={safeOrders}
        initialRates={rates}
        ratesPersisted={persistedRates.length > 0}
        initialMappings={mappings}
        knownTenhangs={knownTenhangs}
      />
    </ErpShell>
  );
}


function resolveTenhang(
  item: { productCode: string | null; model: string | null; productName: string | null },
  tenhangByCode: Map<string, string>,
  tenhangByName: Map<string, string>,
) {
  const byProductCode = tenhangByCode.get(normalizeKey(item.productCode));
  if (byProductCode) return byProductCode;

  const byModel = tenhangByCode.get(normalizeKey(item.model));
  if (byModel) return byModel;

  return tenhangByName.get(normalizeKey(item.productName)) ?? null;
}

function normalizeKey(value: unknown) {
  return String(value ?? "").trim().toUpperCase().replace(/\s+/g, " ");
}
