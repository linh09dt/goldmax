"use client";

import { useMemo, useState } from "react";
import type { Dispatch, ReactNode, SetStateAction } from "react";
import {
  calculateShipping,
  DEFAULT_SHIPPING_RATES,
  SHIPPING_SUPPORT_KM,
  type ShippingRateRow,
} from "@/lib/shipping";

type OrderRow = {
  id: number;
  orderCode: string;
  status: string;
  customerCode: string | null;
  customerName: string | null;
  receiverAddress: string | null;
  region: string | null;
  deliveryKm: number | null;
  shippingFee: number;
  shippingMountainDistrict: boolean;
  shippingCalculatedAt: string | null;
  updatedAt: string;
  items: Array<{
    lineNo: number;
    setNo: string | null;
    productName: string | null;
    productCode: string | null;
    model: string | null;
    quantity: number | null;
  }>;
};

type Props = {
  orders: OrderRow[];
  initialRates: ShippingRateRow[];
  ratesPersisted: boolean;
};

type Tab = "calculator" | "rates";

export function ShippingCalculator({ orders, initialRates, ratesPersisted }: Props) {
  const [tab, setTab] = useState<Tab>("calculator");
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(orders[0]?.id ?? null);
  const selectedOrder = useMemo(() => orders.find((row) => row.id === selectedOrderId) ?? null, [orders, selectedOrderId]);
  const [region, setRegion] = useState(selectedOrder?.region || "Miền Bắc");
  const [deliveryKm, setDeliveryKm] = useState(String(selectedOrder?.deliveryKm ?? ""));
  const [mountainDistrict, setMountainDistrict] = useState(Boolean(selectedOrder?.shippingMountainDistrict));
  const [rates, setRates] = useState<ShippingRateRow[]>(initialRates);
  const [persisted, setPersisted] = useState(ratesPersisted);
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);

  const calculation = useMemo(() => {
    if (!selectedOrder) return null;
    return calculateShipping({
      items: selectedOrder.items,
      rates,
      region,
      deliveryKm: numberValue(deliveryKm),
      mountainDistrict,
    });
  }, [selectedOrder, rates, region, deliveryKm, mountainDistrict]);

  function changeOrder(value: string) {
    const id = Number(value);
    setSelectedOrderId(Number.isInteger(id) ? id : null);
    const order = orders.find((row) => row.id === id);
    if (order) {
      setRegion(order.region || "Miền Bắc");
      setDeliveryKm(String(order.deliveryKm ?? ""));
      setMountainDistrict(Boolean(order.shippingMountainDistrict));
      setNotice("");
    }
  }

  async function saveRates() {
    setSaving(true);
    setNotice("");
    try {
      const response = await fetch("/api/shipping-rates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: rates }),
      });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error || "Không thể lưu bảng giá.");
      setRates(data.rows);
      setPersisted(true);
      setNotice("Đã lưu bảng tiêu chuẩn cước vận chuyển vào PostgreSQL.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Không thể lưu bảng giá.");
    } finally {
      setSaving(false);
    }
  }

  async function applyToOrder() {
    if (!selectedOrder || !calculation) return;
    if (calculation.missingRateCount > 0) {
      setNotice("Còn Model chưa có bảng giá. Vui lòng bổ sung trước khi áp dụng vào đơn hàng.");
      return;
    }
    setSaving(true);
    setNotice("");
    try {
      const response = await fetch("/api/shipping-calculator/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: selectedOrder.id,
          deliveryKm: numberValue(deliveryKm),
          region,
          mountainDistrict,
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error || "Không thể cập nhật đơn hàng.");
      selectedOrder.shippingFee = calculation.roundedTotal;
      selectedOrder.region = region;
      selectedOrder.deliveryKm = numberValue(deliveryKm);
      selectedOrder.shippingMountainDistrict = mountainDistrict;
      selectedOrder.shippingCalculatedAt = new Date().toISOString();
      setNotice(`Đã áp dụng ${money(calculation.roundedTotal)} vào đơn ${selectedOrder.orderCode}.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Không thể cập nhật đơn hàng.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2 border-b border-slate-300">
        <TabButton active={tab === "calculator"} onClick={() => setTab("calculator")}>Tính cước theo đơn hàng</TabButton>
        <TabButton active={tab === "rates"} onClick={() => setTab("rates")}>Bảng tiêu chuẩn cước</TabButton>
      </div>

      {notice ? <div className="rounded-lg border border-cyan-200 bg-cyan-50 px-4 py-3 text-sm font-medium text-cyan-900">{notice}</div> : null}

      {tab === "calculator" ? (
        <>
          <section className="erp-card">
            <div className="border-b border-slate-200 bg-slate-50 px-5 py-4">
              <h2 className="font-bold">Thông tin tính cước</h2>
            </div>
            <div className="grid gap-4 p-5 md:grid-cols-2 xl:grid-cols-5">
              <Field label="Đơn hàng">
                <select className="erp-input" value={selectedOrderId ?? ""} onChange={(event) => changeOrder(event.target.value)}>
                  <option value="">Chọn đơn hàng</option>
                  {orders.map((order) => <option key={order.id} value={order.id}>{order.orderCode} · {order.customerName || order.customerCode || "Chưa có KH"}</option>)}
                </select>
              </Field>
              <Field label="Vùng miền">
                <select className="erp-input" value={region} onChange={(event) => setRegion(event.target.value)}>
                  <option value="Miền Bắc">Miền Bắc</option>
                  <option value="Miền Trung">Miền Trung</option>
                </select>
              </Field>
              <Field label="Quãng đường (km)">
                <input className="erp-input" type="number" min="0" step="0.1" value={deliveryKm} onChange={(event) => setDeliveryKm(event.target.value)} />
              </Field>
              <Field label="Huyện miền núi">
                <label className="flex h-[38px] items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-sm">
                  <input type="checkbox" checked={mountainDistrict} onChange={(event) => setMountainDistrict(event.target.checked)} /> Áp dụng khung miền núi
                </label>
              </Field>
              <Field label="Khung giá áp dụng">
                <div className="flex h-[38px] items-center rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-700">{calculation?.bandLabel ?? "—"}</div>
              </Field>
            </div>
          </section>

          {selectedOrder && calculation ? (
            <>
              <section className="erp-card">
                <div className="border-b border-slate-200 bg-slate-50 px-5 py-4">
                  <h2 className="font-bold">Chi tiết cước theo Model</h2>
                </div>
                <div className="erp-scrollbar overflow-x-auto">
                  <table className="min-w-[1250px] text-sm">
                    <thead className="bg-slate-900 text-left text-xs uppercase tracking-wide text-slate-200">
                      <tr>
                        <Th>Model</Th><Th>Mô tả</Th><Th>Số bộ</Th><Th>Mức đối chiếu</Th><Th>Khung giá</Th><Th>Đơn giá chuẩn/bộ</Th><Th>Cước toàn tuyến</Th><Th>NM hỗ trợ</Th><Th>Thu khách hàng</Th><Th>Dòng đơn hàng</Th><Th>Kiểm tra</Th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 bg-white">
                      {calculation.lines.length ? calculation.lines.map((row, index) => (
                        <tr key={`${row.modelCode}-${index}`} className={row.missingRate ? "bg-red-50" : "hover:bg-cyan-50/50"}>
                          <Td strong>{row.modelCode}</Td><Td>{row.modelName}</Td><Td>{row.quantity}</Td><Td>{row.quantityTier === 1 ? "1 bộ" : "2 bộ trở lên"}</Td><Td>{row.bandLabel}</Td>
                          <Td>{money(row.baseRatePerSet)}</Td><Td>{money(row.fullRouteFreight)}</Td><Td>{money(row.factorySupport)}</Td><Td strong>{money(row.customerFreight)}</Td><Td>{row.sourceLines.join(", ")}</Td>
                          <Td>{row.missingRate ? <span className="rounded-full bg-red-100 px-2 py-1 text-xs font-semibold text-red-700">Thiếu bảng giá</span> : <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-700">OK</span>}</Td>
                        </tr>
                      )) : <tr><td colSpan={11} className="px-4 py-10 text-center text-slate-500">Đơn hàng chưa có bộ cửa có số lượng để tính.</td></tr>}
                    </tbody>
                  </table>
                </div>
                <div className="grid gap-3 border-t border-slate-200 bg-slate-50 p-5 md:grid-cols-[1fr_auto] md:items-center">
                  <div className="text-sm text-slate-600">
                    <div>Địa chỉ nhận: <span className="font-medium text-slate-900">{selectedOrder.receiverAddress || "Chưa nhập"}</span></div>
                    <div className="mt-1">Cước hiện đang lưu trong đơn: <span className="font-semibold">{money(selectedOrder.shippingFee)}</span></div>
                    <div className="mt-1">Lần tính gần nhất: <span className="font-medium">{selectedOrder.shippingCalculatedAt ? new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short" }).format(new Date(selectedOrder.shippingCalculatedAt)) : "Chưa có"}</span></div>
                    <div className="mt-1">Tổng trước làm tròn: <span className="font-semibold">{money(calculation.rawTotal)}</span> · Làm tròn lên 1.000đ: <span className="font-bold text-cyan-700">{money(calculation.roundedTotal)}</span></div>
                  </div>
                  <button className="erp-button disabled:cursor-not-allowed disabled:opacity-50" disabled={saving || calculation.missingRateCount > 0 || numberValue(deliveryKm) <= 0} onClick={applyToOrder}>
                    {saving ? "Đang lưu..." : "Áp dụng cước vào đơn hàng"}
                  </button>
                </div>
              </section>
            </>
          ) : <div className="erp-card p-8 text-center text-slate-500">Chọn đơn hàng để tính cước vận chuyển.</div>}
        </>
      ) : (
        <section className="erp-card">
          <div className="flex flex-col gap-3 border-b border-slate-200 bg-slate-50 px-5 py-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="font-bold">Bảng tiêu chuẩn cước vận chuyển</h2>
            </div>
            <div className="flex flex-wrap gap-2">
              <button className="erp-button-secondary" onClick={() => setRates(DEFAULT_SHIPPING_RATES.map((row) => ({ ...row })))}>Khôi phục giá mẫu</button>
              <button className="erp-button" onClick={saveRates} disabled={saving}>{saving ? "Đang lưu..." : persisted ? "Lưu thay đổi" : "Lưu bảng giá vào DB"}</button>
            </div>
          </div>
          {!persisted ? <div className="border-b border-amber-200 bg-amber-50 px-5 py-3 text-sm text-amber-800">Hiện đang dùng bảng giá mẫu trong mã nguồn. Bấm “Lưu bảng giá vào DB” để tạo Master Data chính thức.</div> : null}
          <div className="erp-scrollbar overflow-x-auto">
            <table className="min-w-[1200px] text-sm">
              <thead className="bg-slate-900 text-left text-xs uppercase tracking-wide text-slate-200">
                <tr><Th>Nhóm cửa</Th><Th>Model</Th><Th>Mã Model</Th><Th>Số lượng đối chiếu</Th><Th>Miền Bắc ≤100km</Th><Th>Miền Bắc 101-200km</Th><Th>Miền Bắc &gt;200km / miền núi</Th><Th>Miền Trung</Th><Th>Trạng thái</Th></tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {rates.map((row, index) => (
                  <tr key={`${row.modelCode}-${row.quantityTier}`}>
                    <CellInput value={row.doorGroup} onChange={(value) => updateRate(index, "doorGroup", value, setRates)} />
                    <CellInput value={row.modelName} onChange={(value) => updateRate(index, "modelName", value, setRates)} wide />
                    <CellInput value={row.modelCode} onChange={(value) => updateRate(index, "modelCode", value.toUpperCase(), setRates)} />
                    <td className="border border-slate-200 px-2 py-2"><select className="erp-input min-w-[130px]" value={row.quantityTier} onChange={(event) => updateRate(index, "quantityTier", Number(event.target.value), setRates)}><option value={1}>1 bộ</option><option value={2}>2 bộ trở lên</option></select></td>
                    <MoneyInput value={row.northLe100} onChange={(value) => updateRate(index, "northLe100", value, setRates)} />
                    <MoneyInput value={row.north101To200} onChange={(value) => updateRate(index, "north101To200", value, setRates)} />
                    <MoneyInput value={row.northOver200} onChange={(value) => updateRate(index, "northOver200", value, setRates)} />
                    <MoneyInput value={row.central} onChange={(value) => updateRate(index, "central", value, setRates)} />
                    <td className="border border-slate-200 px-2 py-2 text-center"><input type="checkbox" checked={row.active !== false} onChange={(event) => updateRate(index, "active", event.target.checked, setRates)} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}

function updateRate<K extends keyof ShippingRateRow>(index: number, key: K, value: ShippingRateRow[K], setRates: Dispatch<SetStateAction<ShippingRateRow[]>>) {
  setRates((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, [key]: value } : row));
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return <button onClick={onClick} className={`border-b-2 px-4 py-3 text-sm font-semibold transition ${active ? "border-cyan-600 text-cyan-700" : "border-transparent text-slate-500 hover:text-slate-900"}`}>{children}</button>;
}
function Field({ label, children }: { label: string; children: ReactNode }) { return <label className="block"><span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</span>{children}</label>; }
function Th({ children }: { children: ReactNode }) { return <th className="whitespace-nowrap border border-slate-700 px-3 py-3 font-semibold">{children}</th>; }
function Td({ children, strong = false }: { children: ReactNode; strong?: boolean }) { return <td className={`whitespace-nowrap border border-slate-200 px-3 py-3 align-top ${strong ? "font-semibold text-slate-950" : "text-slate-700"}`}>{children}</td>; }
function CellInput({ value, onChange, wide = false }: { value: string; onChange: (value: string) => void; wide?: boolean }) { return <td className="border border-slate-200 px-2 py-2"><input className={`erp-input ${wide ? "min-w-[220px]" : "min-w-[130px]"}`} value={value} onChange={(event) => onChange(event.target.value)} /></td>; }
function MoneyInput({ value, onChange }: { value: number; onChange: (value: number) => void }) { return <td className="border border-slate-200 px-2 py-2"><input className="erp-input min-w-[145px] text-right" type="number" min="0" step="1000" value={value} onChange={(event) => onChange(numberValue(event.target.value))} /></td>; }
function money(value: number) { return `${new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 0 }).format(value || 0)} đ`; }
function numberValue(value: string | number | null | undefined) { const parsed = Number(String(value ?? "").replace(/,/g, "")); return Number.isFinite(parsed) ? Math.max(0, parsed) : 0; }
