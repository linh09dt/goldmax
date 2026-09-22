import { ErpShell } from "@/components/erp-shell";
import { ShippingCalculator } from "@/components/shipping-calculator";
import { prisma } from "@/lib/prisma";
import { DEFAULT_SHIPPING_RATES } from "@/lib/shipping";

export const dynamic = "force-dynamic";

export default async function ShippingPage() {
  const [orders, persistedRates, persistedMappings] = await Promise.all([
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
    items: order.items,
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
      />
    </ErpShell>
  );
}
