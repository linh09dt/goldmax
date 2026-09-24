"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ORDER_STATUS_OPTIONS,
  createDefaultOrderForm,
  createOrderItem,
  newClientId,
  reindexItems,
  type OrderFormData,
  type OrderItemForm,
  type OrderLineForm,
} from "@/lib/order-form";

type Mode = "create" | "edit";

type CatalogItem = {
  id: number;
  code: string;
  name: string;
  productDescription: string | null;
  unit: string | null;
  dealerPrice: string | number | null;
  retailPrice: string | number | null;
};

type MasterOption = {
  id: number;
  groupCode: "PANEL_OPTION" | "OPENING_DIRECTION" | "TRIM_DIRECTION" | "PAINT_COLOR" | "DEALER_CODE";
  code: string;
  name: string;
  sortOrder: number;
};

type Props = {
  mode: Mode;
  orderId?: number;
  initialData?: OrderFormData;
};

type SaveOrderResponse = { ok: boolean; id?: number; error?: string };

const REQUIRED_ORDER_INFO_FIELDS = [
  { key: "customerCode", label: "Mã Đại Lý" },
  { key: "customerName", label: "Tên khách hàng" },
  { key: "salesEmployeeCode", label: "NVKD phụ trách" },
  { key: "orderCode", label: "Mã đơn hàng" },
  { key: "orderDate", label: "Ngày đặt hàng" },
  { key: "requiredDeliveryDate", label: "Ngày cần giao hàng" },
  { key: "status", label: "Trạng thái" },
  { key: "excelUpdateDate", label: "Ngày cập nhật" },
  { key: "receiverName", label: "Người nhận" },
  { key: "receiverPhone", label: "Số điện thoại" },
  { key: "deliveryKm", label: "Số Km giao hàng" },
  { key: "region", label: "Vùng miền" },
  { key: "receiverAddress", label: "Địa chỉ nhận hàng" },
] as const satisfies ReadonlyArray<{ key: keyof OrderFormData; label: string }>;

type RequiredOrderInfoKey = (typeof REQUIRED_ORDER_INFO_FIELDS)[number]["key"];

async function readJsonResponse(response: Response): Promise<SaveOrderResponse> {
  const text = await response.text();
  if (!text.trim()) {
    return { ok: false, error: `Máy chủ không trả dữ liệu (HTTP ${response.status}).` };
  }

  try {
    return JSON.parse(text) as SaveOrderResponse;
  } catch {
    return {
      ok: false,
      error: `Không thể lưu đơn hàng (HTTP ${response.status}). Máy chủ trả về dữ liệu không hợp lệ.`,
    };
  }
}


// ERP V22.1: discountPercent is editable per order.
export function OrderForm({ mode, orderId, initialData }: Props) {
  const router = useRouter();
  const [form, setForm] = useState<OrderFormData>(() => initialData ?? createDefaultOrderForm());
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "error"; text: string } | null>(null);
  const [invalidOrderInfoFields, setInvalidOrderInfoFields] = useState<Set<RequiredOrderInfoKey>>(() => new Set());
  const [catalogItems, setCatalogItems] = useState<CatalogItem[]>([]);
  const [masterOptions, setMasterOptions] = useState<MasterOption[]>([]);
  const excelInputRef = useRef<HTMLInputElement>(null);
  const importedFromExcelRef = useRef(false);
  const [excelImportBusy, setExcelImportBusy] = useState(false);
  const [excelImportMessage, setExcelImportMessage] = useState<{ type: "ok" | "error"; text: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    void Promise.all([
      fetch("/api/items?active=true&limit=3000", { cache: "no-store" }).then(async (response) => {
        const result = await response.json() as { ok: boolean; items?: CatalogItem[] };
        if (!cancelled && response.ok && result.ok) setCatalogItems(result.items ?? []);
      }),
      fetch("/api/master-options?active=true", { cache: "no-store" }).then(async (response) => {
        const result = await response.json() as { ok: boolean; items?: MasterOption[] };
        if (!cancelled && response.ok && result.ok) setMasterOptions(result.items ?? []);
      }),
    ]).catch(() => undefined);
    return () => { cancelled = true; };
  }, []);

  const optionValues = useMemo(() => ({
    panel: masterOptions.filter((item) => item.groupCode === "PANEL_OPTION"),
    opening: masterOptions.filter((item) => item.groupCode === "OPENING_DIRECTION"),
    trim: masterOptions.filter((item) => item.groupCode === "TRIM_DIRECTION"),
    color: masterOptions.filter((item) => item.groupCode === "PAINT_COLOR"),
    dealer: masterOptions.filter((item) => item.groupCode === "DEALER_CODE"),
  }), [masterOptions]);

  const doorCatalogItems = useMemo(() => catalogItems.filter(isDoorCatalogItem), [catalogItems]);
  const accessoryCatalogItems = useMemo(() => catalogItems.filter((item) => !isDoorCatalogItem(item)), [catalogItems]);
  const doorGroups = useMemo(() => catalogGroups(doorCatalogItems), [doorCatalogItems]);
  const accessoryGroups = useMemo(() => catalogGroups(accessoryCatalogItems), [accessoryCatalogItems]);

  // Khi tạo đơn mới, các dòng mẫu có MODEL trùng Master Data sẽ tự lấy
  // Tên sản phẩm diễn giải + MODEL + ĐVT + giá từ Danh mục hàng hóa.
  // Không tự ghi đè đơn cũ ở chế độ chỉnh sửa để giữ snapshot lịch sử.
  useEffect(() => {
    if (mode !== "create" || !catalogItems.length || importedFromExcelRef.current) return;
    setForm((current) => hydrateCreateFormFromCatalog(current, catalogItems));
  }, [mode, catalogItems]);

  const totals = useMemo(() => calculateTotals(form), [form]);

  function setField<K extends keyof OrderFormData>(key: K, value: OrderFormData[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    setInvalidOrderInfoFields((current) => {
      if (!current.has(key as RequiredOrderInfoKey)) return current;
      const next = new Set(current);
      next.delete(key as RequiredOrderInfoKey);
      return next;
    });
  }

  function addItem() {
    setForm((current) => ({ ...current, items: [...current.items, createOrderItem(current.items.length + 1, "empty")] }));
  }

  function duplicateItem(index: number) {
    setForm((current) => {
      const source = current.items[index];
      const copy: OrderItemForm = {
        ...source,
        clientId: newClientId(),
        details: source.details.map((detail) => ({ ...detail })),
      };
      const next = [...current.items];
      next.splice(index + 1, 0, copy);
      return { ...current, items: reindexItems(next) };
    });
  }

  function removeItem(index: number) {
    setForm((current) => {
      if (current.items.length === 1) return current;
      return { ...current, items: reindexItems(current.items.filter((_, itemIndex) => itemIndex !== index)) };
    });
  }

  function updateMain(index: number, key: keyof Omit<OrderItemForm, "clientId" | "lineNo" | "details">, value: string) {
    setForm((current) => {
      const items = [...current.items];
      items[index] = { ...items[index], [key]: value };
      return { ...current, items };
    });
  }

  function applyMainCatalog(itemIndex: number, catalog: CatalogItem) {
    setForm((current) => {
      const items = [...current.items];
      const currentItem = items[itemIndex];
      items[itemIndex] = {
        ...currentItem,
        productCode: catalog.code,
        productName: catalogProductName(catalog),
        model: catalog.code,
        unit: catalog.unit ?? currentItem.unit,
        unitPrice: catalogDefaultPrice(catalog, currentItem.unitPrice),
      };
      return { ...current, items };
    });
  }

  function applyDetailCatalog(itemIndex: number, detailIndex: number, catalog: CatalogItem) {
    setForm((current) => {
      const items = [...current.items];
      const item = items[itemIndex];
      const details = [...item.details];
      const currentDetail = details[detailIndex];
      details[detailIndex] = {
        ...currentDetail,
        productCode: catalog.code,
        productName: catalogProductName(catalog),
        model: catalog.code,
        unit: catalog.unit ?? currentDetail.unit,
        unitPrice: catalogDefaultPrice(catalog, currentDetail.unitPrice),
      };
      items[itemIndex] = { ...item, details };
      return { ...current, items };
    });
  }

  function updateDetail(itemIndex: number, detailIndex: number, key: keyof OrderLineForm, value: string) {
    setForm((current) => {
      const items = [...current.items];
      const item = items[itemIndex];
      const details = [...item.details];
      details[detailIndex] = { ...details[detailIndex], [key]: value };
      items[itemIndex] = { ...item, details };
      return { ...current, items };
    });
  }

  function addDetail(itemIndex: number) {
    setForm((current) => {
      const items = [...current.items];
      const item = items[itemIndex];
      const details = [
        ...item.details,
        {
          ...emptyDetail(item.details.length + 1),
          detailType: "HANG_KEM",
          setNo: "",
        },
      ];
      items[itemIndex] = { ...item, details };
      return { ...current, items };
    });
  }

  function removeDetail(itemIndex: number, detailIndex: number) {
    setForm((current) => {
      const items = [...current.items];
      const item = items[itemIndex];
      const details = item.details
        .filter((_, index) => index !== detailIndex)
        .map((row, index) => ({ ...row, rowOrder: index + 1 }));
      items[itemIndex] = { ...item, details };
      return { ...current, items };
    });
  }

  async function uploadImage(file: File, itemIndex: number, detailIndex?: number) {
    const data = new FormData();
    data.append("file", file);
    const response = await fetch("/api/orders/images", { method: "POST", body: data });
    const result = (await response.json()) as { ok: boolean; path?: string; error?: string };
    if (!result.ok || !result.path) throw new Error(result.error || "Không thể tải hình ảnh.");
    if (typeof detailIndex === "number") updateDetail(itemIndex, detailIndex, "imagePath", result.path);
    else updateMain(itemIndex, "imagePath", result.path);
  }

  async function importOrderTemplate(file: File) {
    if (excelImportBusy) return;
    if (mode === "edit") {
      const confirmed = window.confirm("Nhập Excel sẽ thay thế dữ liệu dòng hàng hiện tại bằng dữ liệu trong file. Ảnh đã tải sẽ được giữ lại khi tìm được dòng tương ứng. Tiếp tục?");
      if (!confirmed) return;
    }

    setExcelImportBusy(true);
    setExcelImportMessage(null);
    try {
      const data = new FormData();
      data.append("file", file);
      const response = await fetch("/api/orders/import-template", { method: "POST", body: data });
      const result = await response.json() as {
        ok: boolean;
        form?: OrderFormData;
        importedItems?: number;
        importedDetails?: number;
        ignoredRows?: number;
        warnings?: string[];
        error?: string;
      };
      if (!response.ok || !result.ok || !result.form) throw new Error(result.error || "Không thể đọc file Excel.");

      const imported = preserveImportedImages(form, result.form);
      // Import Excel là snapshot nghiêm ngặt: ô trống trong Excel phải tiếp tục trống.
      // Không dùng Master Data để tự bù TENHANG/MODEL/ĐVT/Đơn giá hay bất kỳ ô nào.
      importedFromExcelRef.current = true;
      setForm(imported);

      const warningText = (result.warnings ?? []).join(" ");
      setExcelImportMessage({
        type: "ok",
        text: `Đã nhập ${result.importedItems ?? imported.items.length} bộ cửa và ${result.importedDetails ?? 0} dòng hàng kèm. ${warningText}`.trim(),
      });
    } catch (error) {
      setExcelImportMessage({ type: "error", text: error instanceof Error ? error.message : "Không thể nhập Excel." });
    } finally {
      setExcelImportBusy(false);
      if (excelInputRef.current) excelInputRef.current.value = "";
    }
  }

  async function save() {
    setMessage(null);
    const missingFields = REQUIRED_ORDER_INFO_FIELDS.filter(({ key }) => {
      const value = form[key];
      return typeof value !== "string" || value.trim() === "";
    });
    if (missingFields.length) {
      setInvalidOrderInfoFields(new Set(missingFields.map(({ key }) => key)));
      setMessage({
        type: "error",
        text: `Vui lòng nhập đầy đủ thông tin bắt buộc: ${missingFields.map(({ label }) => label).join(", ")}.`,
      });
      document.getElementById("order-information")?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }

    setInvalidOrderInfoFields(new Set());
    setBusy(true);
    try {
      const url = mode === "create" ? "/api/orders" : `/api/orders/${orderId}`;
      const response = await fetch(url, {
        // Dùng POST cho cập nhật để tránh proxy/hosting trả HTML với PUT ở route động.
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(form),
      });
      const result = await readJsonResponse(response);
      if (!response.ok || !result.ok || !result.id) throw new Error(result.error || "Không thể lưu đơn hàng.");
      setMessage({ type: "ok", text: mode === "create" ? "Đã tạo đơn hàng." : "Đã cập nhật đơn hàng." });
      router.push(`/orders/${result.id}`);
      router.refresh();
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Không thể lưu đơn hàng." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="erp-card">
        <div className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="font-bold text-slate-900">Nhập dữ liệu từ mẫu Excel đơn hàng</h2>
          </div>
          <label className="erp-button-secondary inline-flex cursor-pointer items-center justify-center whitespace-nowrap">
            {excelImportBusy ? "Đang đọc Excel..." : "Nhập Excel mẫu đơn"}
            <input
              ref={excelInputRef}
              className="hidden"
              type="file"
              accept=".xlsb,.xlsx,application/vnd.ms-excel.sheet.binary.macroEnabled.12,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              disabled={excelImportBusy}
              onChange={(event) => { const file = event.target.files?.[0]; if (file) void importOrderTemplate(file); }}
            />
          </label>
        </div>
        {excelImportMessage ? (
          <div className={`border-t px-5 py-3 text-sm ${excelImportMessage.type === "ok" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-red-200 bg-red-50 text-red-800"}`}>{excelImportMessage.text}</div>
        ) : null}
      </section>

      <section id="order-information" className="erp-card scroll-mt-4 overflow-hidden">
        <div className="p-3 md:p-4">
          <div className="grid grid-cols-1 gap-x-3 gap-y-2.5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
            <div className="flex min-h-[57px] items-center rounded-lg border border-slate-200 bg-slate-50 px-4 shadow-sm">
              <h2 className="text-[15px] font-bold tracking-[-0.01em] text-slate-900">Thông tin đơn hàng</h2>
            </div>

            <Field label="Mã đơn hàng" required invalid={invalidOrderInfoFields.has("orderCode")}><TextInput value={form.orderCode} onChange={(v) => setField("orderCode", v)} /></Field>
            <Field label="Trạng thái" required invalid={invalidOrderInfoFields.has("status")}>
              <select className="erp-input" value={form.status} onChange={(e) => setField("status", e.target.value)}>
                {ORDER_STATUS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </Field>
            <Field label="Ngày cập nhật" required invalid={invalidOrderInfoFields.has("excelUpdateDate")}><DateInput value={form.excelUpdateDate} onChange={(v) => setField("excelUpdateDate", v)} /></Field>
            <div className="hidden lg:block" aria-hidden="true" />

            <Field label="NVKD phụ trách" required invalid={invalidOrderInfoFields.has("salesEmployeeCode")}><TextInput value={form.salesEmployeeCode} onChange={(v) => setField("salesEmployeeCode", v)} /></Field>
            <Field label="Mã Đại Lý" required invalid={invalidOrderInfoFields.has("customerCode")}><DealerCodeSelect value={form.customerCode} options={optionValues.dealer} onChange={(v) => setField("customerCode", v)} /></Field>
            <Field label="Tên khách hàng" required invalid={invalidOrderInfoFields.has("customerName")}><TextInput value={form.customerName} onChange={(v) => setField("customerName", v)} /></Field>
            <Field label="Ngày đặt hàng" required invalid={invalidOrderInfoFields.has("orderDate")}><DateInput value={form.orderDate} onChange={(v) => setField("orderDate", v)} /></Field>
            <Field label="Ngày cần giao hàng" required invalid={invalidOrderInfoFields.has("requiredDeliveryDate")}><DateInput value={form.requiredDeliveryDate} onChange={(v) => setField("requiredDeliveryDate", v)} /></Field>

            <Field label="Người nhận" required invalid={invalidOrderInfoFields.has("receiverName")}><TextInput value={form.receiverName} onChange={(v) => setField("receiverName", v)} /></Field>
            <Field label="Số điện thoại" required invalid={invalidOrderInfoFields.has("receiverPhone")}><TextInput value={form.receiverPhone} onChange={(v) => setField("receiverPhone", v)} /></Field>
            <Field label="Địa chỉ nhận hàng" required invalid={invalidOrderInfoFields.has("receiverAddress")}><TextInput value={form.receiverAddress} onChange={(v) => setField("receiverAddress", v)} /></Field>
            <Field label="Vùng miền" required invalid={invalidOrderInfoFields.has("region")}><TextInput value={form.region} onChange={(v) => setField("region", v)} /></Field>
            <Field label="Số Km giao hàng" required invalid={invalidOrderInfoFields.has("deliveryKm")}><NumberInput value={form.deliveryKm} onChange={(v) => setField("deliveryKm", v)} /></Field>

          </div>
        </div>
      </section>

      <section className="erp-card overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-slate-200 bg-white p-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-[17px] font-bold text-slate-900">Chi tiết đơn hàng theo từng bộ cửa</h2>
            <p className="mt-0.5 text-[12px] text-slate-500">Master-detail: xem nhanh toàn bộ, chỉ mở một dòng phụ kiện để chỉnh sửa.</p>
          </div>
          <Button onClick={addItem}>+ Thêm bộ cửa</Button>
        </div>

        <div className="space-y-5 bg-slate-50 p-3 md:p-4">
          {form.items.map((item, itemIndex) => (
            <DoorSetCard
              key={item.clientId}
              item={item}
              itemIndex={itemIndex}
              onChange={updateMain}
              onDetailChange={updateDetail}
              onUpload={uploadImage}
              onDuplicate={duplicateItem}
              onRemoveItem={removeItem}
              onAddDetail={addDetail}
              onRemoveDetail={removeDetail}
              catalogItems={catalogItems}
              doorCatalogItems={doorCatalogItems}
              doorGroups={doorGroups}
              accessoryCatalogItems={accessoryCatalogItems}
              accessoryGroups={accessoryGroups}
              onMainCatalogSelect={applyMainCatalog}
              onDetailCatalogSelect={applyDetailCatalog}
              optionValues={optionValues}
            />
          ))}
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="erp-card">
          <SectionTitle title="Câu hỏi thêm / Xác nhận" />
          <div className="divide-y divide-slate-200">
            {form.requirements.map((row, index) => (
              <div className="grid gap-2 px-4 py-2 md:grid-cols-[1fr_190px_1fr] md:items-center" key={row.code}>
                <div className="text-[12px] font-medium leading-4 text-slate-800">{index + 1}. {row.questionText}</div>
                <select
                  className="erp-input !px-2 !py-1 !text-[10px]"
                  value={row.answer}
                  onChange={(e) => setField("requirements", form.requirements.map((item, i) => i === index ? { ...item, answer: e.target.value } : item))}
                >
                  <option value="">Chưa xác nhận</option>
                  <option value="Có">Có</option>
                  <option value="Không">Không</option>
                  <option value="Đã xác nhận">Đã xác nhận</option>
                  <option value="Không áp dụng">Không áp dụng</option>
                </select>
                <input
                  className="erp-input !px-2 !py-1 !text-[10px]"
                  placeholder="Ghi chú xác nhận"
                  value={row.note}
                  onChange={(e) => setField("requirements", form.requirements.map((item, i) => i === index ? { ...item, note: e.target.value } : item))}
                />
              </div>
            ))}
          </div>
        </div>

        <div className="erp-card">
          <SectionTitle title="Tổng hợp giá trị đơn hàng" />
          <div className="space-y-1.5 p-3">
            <MoneyField label="Cước vận chuyển cả đơn hàng" value={form.shippingFee} onChange={(v) => setField("shippingFee", v)} />
            <MoneyDisplay label="Tổng tiền đơn hàng" value={totals.subtotal} emphasis />
            <PercentField label="Chiết khấu (%)" value={form.discountPercent} onChange={(v) => setField("discountPercent", v)} />
            <MoneyDisplay label="Số tiền chiết khấu" value={totals.discountAmount} />
            <MoneyDisplay label="Tổng giá trị sau khi trừ CK" value={totals.totalAfterDiscount} emphasis />
            <MoneyField label="Đặt cọc" value={form.depositAmount} onChange={(v) => setField("depositAmount", v)} />
            <MoneyField label="Trừ tiền nhận hàng tại kho" value={form.warehouseReceiptDeduction} onChange={(v) => setField("warehouseReceiptDeduction", v)} />
            <MoneyDisplay label="Thanh toán khi giao hàng" value={totals.deliveryPayment} emphasis />
          </div>
        </div>
      </section>

      <MasterDatalist id="opening-direction-options" items={optionValues.opening} />
      <MasterDatalist id="trim-direction-options" items={optionValues.trim} />
      <MasterDatalist id="paint-color-options" items={optionValues.color} />
      <MasterDatalist id="panel-options" items={optionValues.panel} />

      <section className="sticky bottom-3 z-20 flex flex-col gap-3 rounded-xl border border-slate-300 bg-white/95 p-4 shadow-xl backdrop-blur md:flex-row md:items-center md:justify-between">
        <div className="text-sm">
          {message ? <span className={message.type === "ok" ? "text-emerald-700" : "text-red-700"}>{message.text}</span> : null}
        </div>
        <button className="rounded-lg bg-cyan-600 px-5 py-2.5 font-semibold text-white hover:bg-cyan-500 disabled:opacity-50" type="button" disabled={busy} onClick={() => void save()}>
          {busy ? "Đang lưu..." : mode === "create" ? "Lưu đơn hàng" : "Lưu thay đổi"}
        </button>
      </section>
    </div>
  );
}


function DoorSetCard({
  item,
  itemIndex,
  onChange,
  onDetailChange,
  onUpload,
  onDuplicate,
  onRemoveItem,
  onAddDetail,
  onRemoveDetail,
  catalogItems,
  doorCatalogItems,
  doorGroups,
  accessoryCatalogItems,
  accessoryGroups,
  onMainCatalogSelect,
  onDetailCatalogSelect,
  optionValues,
}: {
  item: OrderItemForm;
  itemIndex: number;
  onChange: (index: number, key: keyof Omit<OrderItemForm, "clientId" | "lineNo" | "details">, value: string) => void;
  onDetailChange: (itemIndex: number, detailIndex: number, key: keyof OrderLineForm, value: string) => void;
  onUpload: (file: File, itemIndex: number, detailIndex?: number) => Promise<void>;
  onDuplicate: (index: number) => void;
  onRemoveItem: (index: number) => void;
  onAddDetail: (index: number) => void;
  onRemoveDetail: (itemIndex: number, detailIndex: number) => void;
  catalogItems: CatalogItem[];
  doorCatalogItems: CatalogItem[];
  doorGroups: string[];
  accessoryCatalogItems: CatalogItem[];
  accessoryGroups: string[];
  onMainCatalogSelect: (index: number, item: CatalogItem) => void;
  onDetailCatalogSelect: (itemIndex: number, detailIndex: number, item: CatalogItem) => void;
  optionValues: { panel: MasterOption[]; opening: MasterOption[]; trim: MasterOption[]; color: MasterOption[] };
}) {
  const inferredGroup = catalogGroupForCode(doorCatalogItems, item.productCode) || catalogGroupFromText(doorGroups, item.productName);
  const [selectedGroup, setSelectedGroup] = useState(inferredGroup);
  const [expandedDetailIndex, setExpandedDetailIndex] = useState<number | null>(null);
  const previousDetailCount = useRef(item.details.length);
  const change = (key: keyof Omit<OrderItemForm, "clientId" | "lineNo" | "details">) => (value: string) => onChange(itemIndex, key, value);

  useEffect(() => {
    const group = catalogGroupForCode(doorCatalogItems, item.productCode) || catalogGroupFromText(doorGroups, item.productName);
    if (group && group !== selectedGroup) setSelectedGroup(group);
  }, [doorCatalogItems, doorGroups, item.productCode, item.productName, selectedGroup]);

  useEffect(() => {
    if (item.details.length > previousDetailCount.current) {
      setExpandedDetailIndex(item.details.length - 1);
    } else if (expandedDetailIndex !== null && expandedDetailIndex >= item.details.length) {
      setExpandedDetailIndex(item.details.length ? item.details.length - 1 : null);
    }
    previousDetailCount.current = item.details.length;
  }, [item.details.length, expandedDetailIndex]);

  const groupItems = selectedGroup ? doorCatalogItems.filter((catalog) => sameText(catalog.name, selectedGroup)) : [];
  const itemTotal = lineAmount(item) + item.details.reduce((sum, detail) => sum + lineAmount(detail), 0);

  function changeGroup(nextGroup: string) {
    setSelectedGroup(nextGroup);
    const currentCatalog = findCatalog(catalogItems, item.productCode);
    if (!currentCatalog || !sameText(currentCatalog.name, nextGroup)) {
      change("productName")("");
      change("productCode")("");
      change("model")("");
      change("unit")("");
      change("unitPrice")("");
      change("modelCheck")("");
      change("priceCheck")("");
    }
  }

  function selectCatalog(catalog: CatalogItem) {
    setSelectedGroup(catalog.name);
    onMainCatalogSelect(itemIndex, catalog);
  }

  function removeDetail(detailIndex: number) {
    onRemoveDetail(itemIndex, detailIndex);
    setExpandedDetailIndex((current) => {
      if (current === null) return null;
      if (current === detailIndex) return null;
      return current > detailIndex ? current - 1 : current;
    });
  }

  return (
    <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <header className="flex flex-col gap-2 bg-slate-900 px-4 py-3 text-white lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <h3 className="text-[17px] font-extrabold tracking-[-0.01em]">Bộ cửa #{itemIndex + 1}{item.setNo ? ` · Bộ số ${item.setNo}` : ""}</h3>
          <p className="mt-0.5 truncate text-[12px] font-medium text-slate-300">
            {item.productName || selectedGroup || "Chưa chọn sản phẩm"}{item.model || item.productCode ? ` · ${item.model || item.productCode}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 lg:justify-end">
          <div className="mr-1 text-[21px] font-extrabold tabular-nums text-white">{formatMoney(itemTotal)}đ</div>
          <button className="rounded-lg border border-slate-600 bg-slate-800 px-3 py-1.5 text-[12px] font-semibold hover:bg-slate-700" type="button" onClick={() => onDuplicate(itemIndex)}>Nhân bản bộ</button>
          <button className="rounded-lg border border-red-500/70 bg-red-900/60 px-3 py-1.5 text-[12px] font-semibold text-red-50 hover:bg-red-800" type="button" onClick={() => onRemoveItem(itemIndex)}>Xóa</button>
        </div>
      </header>

      <div className="p-3 md:p-4">
        <div className="grid grid-cols-2 gap-x-3 gap-y-2 md:grid-cols-3 xl:grid-cols-6">
          <CardField label="Cao"><CardNumberInput value={item.heightMm} onChange={change("heightMm")} /></CardField>
          <CardField label="Rộng"><CardNumberInput value={item.widthMm} onChange={change("widthMm")} /></CardField>
          <CardField label="Khuôn"><CardNumberInput value={item.frameMm} onChange={change("frameMm")} /></CardField>
          <CardField label="SL bộ"><CardNumberInput value={item.quantity} onChange={change("quantity")} /></CardField>
          <CardField label="Ô thoáng"><CardInput value={item.panelInfo} onChange={change("panelInfo")} listId="panel-options" /></CardField>
          <CardField label="Hướng mở"><CardInput value={item.openingDirection} onChange={change("openingDirection")} listId="opening-direction-options" /></CardField>

          <CardField label="Phào"><CardInput value={item.trimDirection} onChange={change("trimDirection")} listId="trim-direction-options" /></CardField>
          <CardField label="Màu sơn"><CardInput value={item.paintColor} onChange={change("paintColor")} listId="paint-color-options" /></CardField>
          <CardField label="ĐVT"><CardInput value={item.unit} onChange={change("unit")} /></CardField>
          <CardField label="KH/Lượng"><CardNumberInput value={item.pricingQuantity} onChange={change("pricingQuantity")} step="0.0001" /></CardField>
          <CardField label="Đơn giá" className="xl:col-span-2">
            <CardSelectShell><GridPriceInput value={item.unitPrice} onChange={change("unitPrice")} catalog={findCatalog(catalogItems, item.productCode)} /></CardSelectShell>
          </CardField>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 border-t border-slate-200 pt-3 md:grid-cols-4 xl:grid-cols-12">
          <CardField label="Bộ số" className="xl:col-span-2">
            <CardInput value={item.setNo} onChange={change("setNo")} placeholder="VD: 12097" />
          </CardField>
          <CardField label="Nhóm cửa" className="xl:col-span-2">
            <CardSelectShell><GridGroupSelect value={selectedGroup} groups={doorGroups} placeholder="Chọn nhóm cửa" onChange={changeGroup} /></CardSelectShell>
          </CardField>
          <CardField label="Model" className="xl:col-span-3">
            <CardSelectShell>
              <GridCatalogSelect
                value={item.productCode}
                currentLabel={item.productCode}
                items={groupItems}
                display="model"
                placeholder={selectedGroup ? "Chọn Model" : "Chọn nhóm cửa trước"}
                disabled={!selectedGroup}
                onCatalogSelect={selectCatalog}
              />
            </CardSelectShell>
          </CardField>
          <CardField label="Tên sản phẩm" className="col-span-2 md:col-span-4 xl:col-span-5">
            <div className="min-h-9 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 text-[12px] font-medium text-slate-700">
              {item.productName || <span className="font-normal text-slate-400">Tự điền theo danh mục</span>}
            </div>
          </CardField>

          <CardField label="KT thông thủy - Cao" className="xl:col-span-2">
            <CardNumberInput value={item.clearHeightMm} onChange={change("clearHeightMm")} />
          </CardField>
          <CardField label="KT thông thủy - Rộng" className="xl:col-span-2">
            <CardNumberInput value={item.clearWidthMm} onChange={change("clearWidthMm")} />
          </CardField>
          <CardField label="Model khóa" className="xl:col-span-3">
            <CardInput value={item.lockModel} onChange={change("lockModel")} />
          </CardField>
          <CardField label="Loại phào" className="xl:col-span-2">
            <CardInput value={item.trimType} onChange={change("trimType")} />
          </CardField>
          <CardField label="Thanh phào / bộ" className="xl:col-span-1">
            <CardNumberInput value={item.trimBarsPerSet} onChange={change("trimBarsPerSet")} />
          </CardField>
          <CardField label="Nan ô thoáng" className="xl:col-span-1">
            <CardNumberInput value={item.windowBars} onChange={change("windowBars")} />
          </CardField>
          <CardField label="Cánh / bộ" className="xl:col-span-1">
            <CardNumberInput value={item.leavesPerSet} onChange={change("leavesPerSet")} />
          </CardField>

          <CardField label="Ghi chú" className="col-span-2 md:col-span-3 xl:col-span-8">
            <CardInput value={item.note} onChange={change("note")} placeholder="Nhập ghi chú kỹ thuật" />
          </CardField>
          <CardField label="Hình ảnh SP" className="col-span-2 md:col-span-1 xl:col-span-4">
            <div className="rounded-lg border border-slate-200 bg-white">
              <ImageCell path={item.imagePath} onUpload={(file) => onUpload(file, itemIndex)} />
            </div>
          </CardField>
        </div>
      </div>

      <section className="border-t border-slate-200 bg-slate-50/60 p-3 md:p-4">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h4 className="text-[15px] font-extrabold tracking-[-0.01em] text-slate-900">PHỤ KIỆN / CHI TIẾT CỦA BỘ CỬA ({item.details.length})</h4>
          <button className="rounded-lg bg-cyan-600 px-3.5 py-2 text-[12px] font-bold text-white shadow-sm hover:bg-cyan-500" type="button" onClick={() => onAddDetail(itemIndex)}>+ Thêm phụ kiện</button>
        </div>

        {item.details.length ? (
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <div className="hidden grid-cols-[2.4fr_1.35fr_0.45fr_0.55fr_0.75fr_0.85fr_1fr] gap-2 border-b border-slate-200 bg-slate-50 px-3 py-2 text-[11px] font-bold text-slate-600 lg:grid">
              <div>Chi tiết / Model</div>
              <div>KT dùng tính</div>
              <div className="text-center">SL</div>
              <div className="text-center">ĐVT</div>
              <div className="text-right">KH/Lượng</div>
              <div className="text-right">Đơn giá</div>
              <div className="text-right">Thành tiền</div>
            </div>
            <div className="divide-y divide-slate-200">
              {item.details.map((detail, detailIndex) => (
                <DetailMasterRow
                  key={`${item.clientId}-detail-${detail.rowOrder}-${detailIndex}`}
                  row={detail}
                  itemIndex={itemIndex}
                  detailIndex={detailIndex}
                  isOpen={expandedDetailIndex === detailIndex}
                  onToggle={() => setExpandedDetailIndex((current) => current === detailIndex ? null : detailIndex)}
                  onChange={onDetailChange}
                  onUpload={onUpload}
                  onRemove={removeDetail}
                  catalogItems={catalogItems}
                  accessoryCatalogItems={accessoryCatalogItems}
                  accessoryGroups={accessoryGroups}
                  onCatalogSelect={onDetailCatalogSelect}
                  optionValues={optionValues}
                />
              ))}
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-5 text-center text-[12px] text-slate-500">Chưa có phụ kiện / chi tiết. Bấm “+ Thêm phụ kiện” để thêm dòng.</div>
        )}
      </section>
    </article>
  );
}

function DetailMasterRow({
  row,
  itemIndex,
  detailIndex,
  isOpen,
  onToggle,
  onChange,
  onUpload,
  onRemove,
  catalogItems,
  accessoryCatalogItems,
  accessoryGroups,
  onCatalogSelect,
  optionValues,
}: {
  row: OrderLineForm;
  itemIndex: number;
  detailIndex: number;
  isOpen: boolean;
  onToggle: () => void;
  onChange: (itemIndex: number, detailIndex: number, key: keyof OrderLineForm, value: string) => void;
  onUpload: (file: File, itemIndex: number, detailIndex?: number) => Promise<void>;
  onRemove: (detailIndex: number) => void;
  catalogItems: CatalogItem[];
  accessoryCatalogItems: CatalogItem[];
  accessoryGroups: string[];
  onCatalogSelect: (itemIndex: number, detailIndex: number, item: CatalogItem) => void;
  optionValues: { panel: MasterOption[]; opening: MasterOption[]; trim: MasterOption[]; color: MasterOption[] };
}) {
  const inferredGroup = catalogGroupForCode(accessoryCatalogItems, row.productCode) || catalogGroupFromText(accessoryGroups, row.productName);
  const [selectedGroup, setSelectedGroup] = useState(inferredGroup);
  const change = (key: keyof OrderLineForm) => (value: string) => onChange(itemIndex, detailIndex, key, value);

  useEffect(() => {
    const group = catalogGroupForCode(accessoryCatalogItems, row.productCode) || catalogGroupFromText(accessoryGroups, row.productName);
    if (group && group !== selectedGroup) setSelectedGroup(group);
  }, [accessoryCatalogItems, accessoryGroups, row.productCode, row.productName, selectedGroup]);

  const groupItems = selectedGroup ? accessoryCatalogItems.filter((catalog) => sameText(catalog.name, selectedGroup)) : [];
  const orientation = detailOrientation(row);
  const title = row.productName || selectedGroup || "Chưa chọn chi tiết / phụ kiện";
  const code = row.productCode || row.model;
  const summaryDimensions = detailDimensionSummary(row, orientation);
  const pricingStatus = detailPricingStatus(row);

  function changeGroup(nextGroup: string) {
    setSelectedGroup(nextGroup);
    const currentCatalog = findCatalog(catalogItems, row.productCode);
    if (!currentCatalog || !sameText(currentCatalog.name, nextGroup)) {
      change("productName")("");
      change("productCode")("");
      change("model")("");
      change("unit")("");
      change("unitPrice")("");
      change("modelCheck")("");
      change("priceCheck")("");
    }
  }

  function selectCatalog(catalog: CatalogItem) {
    setSelectedGroup(catalog.name);
    onCatalogSelect(itemIndex, detailIndex, catalog);
  }

  return (
    <div className={isOpen ? "bg-cyan-50/30" : "bg-white"}>
      <button
        className={`grid w-full grid-cols-1 gap-1 px-3 py-2.5 text-left transition hover:bg-slate-50 lg:grid-cols-[2.4fr_1.35fr_0.45fr_0.55fr_0.75fr_0.85fr_1fr] lg:items-center lg:gap-2 ${isOpen ? "bg-cyan-50/60 ring-1 ring-inset ring-cyan-300" : ""}`}
        type="button"
        onClick={onToggle}
      >
        <div className="min-w-0 text-[13px] font-bold text-slate-900">
          <span className="mr-2 inline-block w-3 text-slate-500">{isOpen ? "▾" : "▸"}</span>
          <span className="align-middle">{title}{code ? ` · ${code}` : ""}</span>
        </div>
        <div className="text-[12px] font-medium text-slate-600"><span className="lg:hidden">KT: </span>{summaryDimensions}</div>
        <div className="text-[12px] font-medium text-slate-700 lg:text-center"><span className="lg:hidden">SL: </span>{row.quantity || "—"}</div>
        <div className="text-[12px] font-medium text-slate-700 lg:text-center"><span className="lg:hidden">ĐVT: </span>{row.unit || "—"}</div>
        <div className="text-[12px] font-semibold tabular-nums text-slate-700 lg:text-right"><span className="lg:hidden">KH/Lượng: </span>{row.pricingQuantity || "—"}</div>
        <div className="lg:text-right">{pricingStatus.priceNode}</div>
        <div className="lg:text-right">{pricingStatus.amountNode}</div>
      </button>

      {isOpen ? (
        <div className="border-t border-cyan-200 bg-white px-3 py-3">
          <div className="grid gap-2 md:grid-cols-3 xl:grid-cols-[1.25fr_1.25fr_0.7fr_0.7fr_0.7fr_0.72fr_0.82fr_0.9fr_1.65fr]">
            <CardField label="Nhóm hàng">
              <CardSelectShell><GridGroupSelect value={selectedGroup} groups={accessoryGroups} placeholder="Chọn nhóm hàng" onChange={changeGroup} /></CardSelectShell>
            </CardField>
            <CardField label="Model">
              <CardSelectShell>
                <GridCatalogSelect
                  value={row.productCode}
                  currentLabel={row.productCode}
                  items={groupItems}
                  display="model"
                  placeholder={selectedGroup ? "Chọn Model" : "Chọn nhóm trước"}
                  disabled={!selectedGroup}
                  onCatalogSelect={selectCatalog}
                />
              </CardSelectShell>
            </CardField>
            <CardField label="Cao" emphasized={orientation === "vertical"}><CardNumberInput value={row.heightMm} onChange={change("heightMm")} /></CardField>
            <CardField label="Rộng" emphasized={orientation === "horizontal"}><CardNumberInput value={row.widthMm} onChange={change("widthMm")} /></CardField>
            <CardField label="Khuôn"><CardNumberInput value={row.frameMm} onChange={change("frameMm")} /></CardField>
            <CardField label="ĐVT"><CardInput value={row.unit} onChange={change("unit")} /></CardField>
            <CardField label="KH/Lượng"><CardNumberInput value={row.pricingQuantity} onChange={change("pricingQuantity")} step="0.0001" /></CardField>
            <CardField label="Đơn giá"><CardSelectShell><GridPriceInput value={row.unitPrice} onChange={change("unitPrice")} catalog={findCatalog(catalogItems, row.productCode)} /></CardSelectShell></CardField>
            <CardField label="Ghi chú"><CardInput value={row.note} onChange={change("note")} placeholder="Nhập ghi chú..." /></CardField>
          </div>

          <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
            <details className="group min-w-0 flex-1 rounded-lg border border-dashed border-slate-200 bg-slate-50/70">
              <summary className="cursor-pointer list-none px-3 py-1.5 text-[11px] font-semibold text-cyan-700 marker:hidden">Thông số thêm <span className="inline-block transition-transform group-open:rotate-180">⌄</span></summary>
              <div className="grid gap-2 border-t border-slate-200 bg-white p-3 sm:grid-cols-2 lg:grid-cols-4">
                <CardField label="Tên sản phẩm" className="sm:col-span-2">
                  <div className="min-h-9 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 text-[12px] font-medium text-slate-700">
                    {row.productName || <span className="font-normal text-slate-400">Tự điền theo danh mục</span>}
                  </div>
                </CardField>
                <CardField label="SL"><CardNumberInput value={row.quantity} onChange={change("quantity")} /></CardField>
                <CardField label="Bộ số"><CardInput value={row.setNo} onChange={change("setNo")} /></CardField>
                <CardField label="Ô thoáng"><CardInput value={row.panelInfo} onChange={change("panelInfo")} listId="panel-options" /></CardField>
                <CardField label="Hướng mở"><CardInput value={row.openingDirection} onChange={change("openingDirection")} listId="opening-direction-options" /></CardField>
                <CardField label="Phào"><CardInput value={row.trimDirection} onChange={change("trimDirection")} listId="trim-direction-options" /></CardField>
                <CardField label="Màu sơn"><CardInput value={row.paintColor} onChange={change("paintColor")} listId="paint-color-options" /></CardField>
                <CardField label="KT thông thủy - Cao"><CardNumberInput value={row.clearHeightMm} onChange={change("clearHeightMm")} /></CardField>
                <CardField label="KT thông thủy - Rộng"><CardNumberInput value={row.clearWidthMm} onChange={change("clearWidthMm")} /></CardField>
                <CardField label="Số thanh phào / bộ"><CardNumberInput value={row.trimBarsPerSet} onChange={change("trimBarsPerSet")} /></CardField>
                <CardField label="Loại phào"><CardInput value={row.trimType} onChange={change("trimType")} /></CardField>
                <CardField label="Model khóa"><CardInput value={row.lockModel} onChange={change("lockModel")} /></CardField>
                <CardField label="Số nan ô thoáng"><CardNumberInput value={row.windowBars} onChange={change("windowBars")} /></CardField>
                <CardField label="Số cánh / bộ"><CardNumberInput value={row.leavesPerSet} onChange={change("leavesPerSet")} /></CardField>
                <CardField label="Hình ảnh SP" className="sm:col-span-2 lg:col-span-4">
                  <div className="rounded-lg border border-slate-200 bg-white"><ImageCell path={row.imagePath} onUpload={(file) => onUpload(file, itemIndex, detailIndex)} /></div>
                </CardField>
              </div>
            </details>
            <button className="rounded-md px-2 py-1.5 text-[11px] font-semibold text-red-600 hover:bg-red-50" type="button" onClick={() => onRemove(detailIndex)}>Xóa</button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function detailDimensionSummary(row: OrderLineForm, orientation: "vertical" | "horizontal" | "free"): string {
  const height = row.heightMm?.trim();
  const width = row.widthMm?.trim();
  const text = normalizeText(`${row.productName} ${row.productCode} ${row.model}`);
  if (text.includes("khoa")) return "Theo bộ cửa";
  if (orientation === "vertical") return height ? `C: ${height}` : "C: —";
  if (orientation === "horizontal") return width ? `R: ${width}` : "R: —";
  const values = [height ? `C: ${height}` : "", width ? `R: ${width}` : ""].filter(Boolean);
  return values.length ? values.join(" · ") : "—";
}

function detailPricingStatus(row: OrderLineForm): { priceNode: React.ReactNode; amountNode: React.ReactNode } {
  const price = numeric(row.unitPrice);
  const pricingQuantity = numeric(row.pricingQuantity);
  const productText = normalizeText(`${row.productName} ${row.productCode} ${row.model}`);
  const isLockOrCustom = productText.includes("khoa") && price <= 0;

  if (isLockOrCustom) {
    return {
      priceNode: <span className="text-[12px] font-semibold text-slate-500">—</span>,
      amountNode: <span className="inline-flex min-w-[52px] justify-center rounded border border-slate-300 bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-700">TC</span>,
    };
  }
  if (!row.pricingQuantity.trim() || pricingQuantity <= 0) {
    return {
      priceNode: price > 0 ? <span className="text-[12px] font-semibold tabular-nums text-slate-700">{formatMoney(price)}</span> : <span className="text-[12px] text-slate-400">—</span>,
      amountNode: <span className="inline-flex rounded border border-amber-300 bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700">Cần nhập KH/Lượng</span>,
    };
  }
  if (!row.unitPrice.trim() || price <= 0) {
    return {
      priceNode: <span className="inline-flex rounded border border-amber-300 bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700">Chưa có giá</span>,
      amountNode: <span className="text-[12px] font-semibold text-slate-400">—</span>,
    };
  }
  return {
    priceNode: <span className="text-[12px] font-semibold tabular-nums text-slate-700">{formatMoney(price)}</span>,
    amountNode: <span className="text-[13px] font-extrabold tabular-nums text-cyan-700">{formatMoney(lineAmount(row))}đ</span>,
  };
}


function DoorSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-3 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
      <div className="mb-3 flex items-center gap-2 text-[13px] font-bold text-slate-900">
        <span className="h-2 w-2 rounded-full bg-cyan-500" />
        {title}
      </div>
      {children}
    </section>
  );
}

function CardField({ label, children, className = "", emphasized = false }: { label: string; children: React.ReactNode; className?: string; emphasized?: boolean }) {
  return (
    <label className={`block min-w-0 ${className}`}>
      <span
        className={`mb-1 inline-flex max-w-full items-center rounded-md border px-2 py-0.5 text-[10px] font-semibold leading-4 ${emphasized ? "border-cyan-200 bg-cyan-50 text-cyan-700" : "border-slate-200 bg-slate-100 text-slate-600"}`}
        title={label}
      >
        <span className="truncate">{label}</span>
      </span>
      <div className={emphasized ? "rounded-lg ring-1 ring-cyan-300" : ""}>{children}</div>
    </label>
  );
}

function CardSelectShell({ children }: { children: React.ReactNode }) {
  return <div className="min-h-9 overflow-hidden rounded-lg border border-slate-300 bg-white focus-within:border-cyan-400 focus-within:ring-2 focus-within:ring-cyan-100">{children}</div>;
}

function CardInput({ value, onChange, placeholder, listId }: { value: string; onChange: (value: string) => void; placeholder?: string; listId?: string }) {
  return <input className="h-9 w-full min-w-0 rounded-lg border border-slate-300 bg-white px-2.5 text-[12px] font-medium text-slate-900 outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100" value={value} placeholder={placeholder} list={listId} onChange={(event) => onChange(event.target.value)} />;
}

function CardNumberInput({ value, onChange, step = "1" }: { value: string; onChange: (value: string) => void; step?: string }) {
  return <input className="h-9 w-full min-w-0 rounded-lg border border-slate-300 bg-white px-2.5 text-right text-[12px] font-semibold tabular-nums text-slate-900 outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100" type="number" step={step} value={value} onChange={(event) => onChange(event.target.value)} />;
}

function detailOrientation(row: OrderLineForm): "vertical" | "horizontal" | "free" {
  const text = normalizeText(`${row.productName} ${row.productCode} ${row.model}`);
  if (text.includes("phao") && (text.includes("dung") || text.includes("doc"))) return "vertical";
  if (text.includes("phao") && (text.includes("ngang") || text.includes("tran"))) return "horizontal";
  return "free";
}

function EditableMainRow({ item, itemIndex, onChange, onUpload, catalogItems, doorCatalogItems, doorGroups, onCatalogSelect, optionValues }: {
  item: OrderItemForm;
  itemIndex: number;
  onChange: (index: number, key: keyof Omit<OrderItemForm, "clientId" | "lineNo" | "details">, value: string) => void;
  onUpload: (file: File, itemIndex: number, detailIndex?: number) => Promise<void>;
  catalogItems: CatalogItem[];
  doorCatalogItems: CatalogItem[];
  doorGroups: string[];
  onCatalogSelect: (index: number, item: CatalogItem) => void;
  optionValues: { panel: MasterOption[]; opening: MasterOption[]; trim: MasterOption[]; color: MasterOption[] };
}) {
  const inferredGroup = catalogGroupForCode(doorCatalogItems, item.productCode) || catalogGroupFromText(doorGroups, item.productName);
  const [selectedGroup, setSelectedGroup] = useState(inferredGroup);
  const value = (key: keyof Omit<OrderItemForm, "clientId" | "lineNo" | "details">) => item[key] as string;
  const change = (key: keyof Omit<OrderItemForm, "clientId" | "lineNo" | "details">) => (v: string) => onChange(itemIndex, key, v);

  useEffect(() => {
    const group = catalogGroupForCode(doorCatalogItems, item.productCode) || catalogGroupFromText(doorGroups, item.productName);
    if (group && group !== selectedGroup) setSelectedGroup(group);
  }, [doorCatalogItems, doorGroups, item.productCode, item.productName, selectedGroup]);

  const groupItems = selectedGroup ? doorCatalogItems.filter((catalog) => sameText(catalog.name, selectedGroup)) : [];

  function changeGroup(nextGroup: string) {
    setSelectedGroup(nextGroup);
    const currentCatalog = findCatalog(catalogItems, item.productCode);
    if (!currentCatalog || !sameText(currentCatalog.name, nextGroup)) {
      change("productName")("");
      change("productCode")("");
      change("model")("");
      change("unit")("");
      change("unitPrice")("");
      change("modelCheck")("");
      change("priceCheck")("");
    }
  }

  function selectCatalog(catalog: CatalogItem) {
    setSelectedGroup(catalog.name);
    onCatalogSelect(itemIndex, catalog);
  }

  return (
    <tr className="bg-cyan-50/80 font-medium">
      <CellStatic>{item.lineNo}</CellStatic>
      <Cell><GridInput value={value("setNo")} onChange={change("setNo")} /></Cell>
      <Cell>
        <div className="min-w-0 divide-y divide-slate-200 bg-white/40">
          <GridGroupSelect value={selectedGroup} groups={doorGroups} placeholder="Chọn loại cửa" onChange={changeGroup} />
          <GridCatalogSelect
            value={value("productCode")}
            currentLabel={value("productName")}
            items={groupItems}
            display="description"
            placeholder={selectedGroup ? "Chọn tên sản phẩm" : "Chọn loại cửa trước"}
            disabled={!selectedGroup}
            onCatalogSelect={selectCatalog}
          />
        </div>
      </Cell>
      <Cell>
        <GridCatalogSelect
          value={value("productCode")}
          currentLabel={value("productCode")}
          items={groupItems}
          display="model"
          placeholder={selectedGroup ? "Chọn Model" : "Chọn loại cửa trước"}
          disabled={!selectedGroup}
          onCatalogSelect={selectCatalog}
        />
      </Cell>
      <Cell><GridInput value={value("panelInfo")} onChange={change("panelInfo")} listId="panel-options" /></Cell>
      <Cell><GridInput value={value("openingDirection")} onChange={change("openingDirection")} listId="opening-direction-options" /></Cell>
      <Cell><GridInput value={value("trimDirection")} onChange={change("trimDirection")} listId="trim-direction-options" /></Cell>
      <Cell><GridInput value={value("paintColor")} onChange={change("paintColor")} listId="paint-color-options" /></Cell>
      <Cell><GridNumber value={value("heightMm")} onChange={change("heightMm")} /></Cell>
      <Cell><GridNumber value={value("widthMm")} onChange={change("widthMm")} /></Cell>
      <Cell><GridNumber value={value("frameMm")} onChange={change("frameMm")} /></Cell>
      <Cell><GridNumber value={value("clearHeightMm")} onChange={change("clearHeightMm")} /></Cell>
      <Cell><GridNumber value={value("clearWidthMm")} onChange={change("clearWidthMm")} /></Cell>
      <Cell><GridNumber value={value("quantity")} onChange={change("quantity")} /></Cell>
      <Cell><GridInput value={value("unit")} onChange={change("unit")} /></Cell>
      <Cell><GridNumber value={value("pricingQuantity")} onChange={change("pricingQuantity")} step="0.0001" /></Cell>
      <Cell><GridPriceInput value={value("unitPrice")} onChange={change("unitPrice")} catalog={findCatalog(catalogItems, value("productCode"))} /></Cell>
      <CellStatic>{formatMoney(lineAmount(item))}</CellStatic>
      <Cell><GridInput value={value("note")} onChange={change("note")} /></Cell>
      <Cell><ImageCell path={item.imagePath} onUpload={(file) => onUpload(file, itemIndex)} /></Cell>
      <CellStatic>—</CellStatic>
    </tr>
  );
}

function EditableDetailRow({ row, itemIndex, detailIndex, onChange, onUpload, onRemove, catalogItems, accessoryCatalogItems, accessoryGroups, onCatalogSelect, optionValues }: {
  row: OrderLineForm;
  itemIndex: number;
  detailIndex: number;
  onChange: (itemIndex: number, detailIndex: number, key: keyof OrderLineForm, value: string) => void;
  onUpload: (file: File, itemIndex: number, detailIndex?: number) => Promise<void>;
  onRemove: (itemIndex: number, detailIndex: number) => void;
  catalogItems: CatalogItem[];
  accessoryCatalogItems: CatalogItem[];
  accessoryGroups: string[];
  onCatalogSelect: (itemIndex: number, detailIndex: number, item: CatalogItem) => void;
  optionValues: { panel: MasterOption[]; opening: MasterOption[]; trim: MasterOption[]; color: MasterOption[] };
}) {
  const inferredGroup = catalogGroupForCode(accessoryCatalogItems, row.productCode) || catalogGroupFromText(accessoryGroups, row.productName);
  const [selectedGroup, setSelectedGroup] = useState(inferredGroup);
  const change = (key: keyof OrderLineForm) => (value: string) => onChange(itemIndex, detailIndex, key, value);

  useEffect(() => {
    const group = catalogGroupForCode(accessoryCatalogItems, row.productCode) || catalogGroupFromText(accessoryGroups, row.productName);
    if (group && group !== selectedGroup) setSelectedGroup(group);
  }, [accessoryCatalogItems, accessoryGroups, row.productCode, row.productName, selectedGroup]);

  const groupItems = selectedGroup ? accessoryCatalogItems.filter((catalog) => sameText(catalog.name, selectedGroup)) : [];

  function changeGroup(nextGroup: string) {
    setSelectedGroup(nextGroup);
    const currentCatalog = findCatalog(catalogItems, row.productCode);
    if (!currentCatalog || !sameText(currentCatalog.name, nextGroup)) {
      change("productName")("");
      change("productCode")("");
      change("model")("");
      change("unit")("");
      change("unitPrice")("");
      change("modelCheck")("");
      change("priceCheck")("");
    }
  }

  function selectCatalog(catalog: CatalogItem) {
    setSelectedGroup(catalog.name);
    onCatalogSelect(itemIndex, detailIndex, catalog);
  }

  return (
    <tr className="hover:bg-slate-50">
      <CellStatic></CellStatic>
      <Cell><GridInput value={row.setNo} onChange={change("setNo")} /></Cell>
      <Cell>
        <div className="min-w-0 divide-y divide-slate-100">
          <GridGroupSelect value={selectedGroup} groups={accessoryGroups} placeholder="Chọn nhóm hàng kèm" onChange={changeGroup} />
          <GridCatalogSelect
            value={row.productCode}
            currentLabel={row.productName}
            items={groupItems}
            display="description"
            placeholder={selectedGroup ? "Chọn tên sản phẩm" : "Chọn nhóm trước"}
            disabled={!selectedGroup}
            onCatalogSelect={selectCatalog}
          />
        </div>
      </Cell>
      <Cell>
        <GridCatalogSelect
          value={row.productCode}
          currentLabel={row.productCode}
          items={groupItems}
          display="model"
          placeholder={selectedGroup ? "Chọn Model" : "Chọn nhóm trước"}
          disabled={!selectedGroup}
          onCatalogSelect={selectCatalog}
        />
      </Cell>
      <Cell><GridInput value={row.panelInfo} onChange={change("panelInfo")} listId="panel-options" /></Cell>
      <Cell><GridInput value={row.openingDirection} onChange={change("openingDirection")} listId="opening-direction-options" /></Cell>
      <Cell><GridInput value={row.trimDirection} onChange={change("trimDirection")} listId="trim-direction-options" /></Cell>
      <Cell><GridInput value={row.paintColor} onChange={change("paintColor")} listId="paint-color-options" /></Cell>
      <Cell><GridNumber value={row.heightMm} onChange={change("heightMm")} /></Cell>
      <Cell><GridNumber value={row.widthMm} onChange={change("widthMm")} /></Cell>
      <Cell><GridNumber value={row.frameMm} onChange={change("frameMm")} /></Cell>
      <Cell><GridNumber value={row.clearHeightMm} onChange={change("clearHeightMm")} /></Cell>
      <Cell><GridNumber value={row.clearWidthMm} onChange={change("clearWidthMm")} /></Cell>
      <Cell><GridNumber value={row.quantity} onChange={change("quantity")} /></Cell>
      <Cell><GridInput value={row.unit} onChange={change("unit")} /></Cell>
      <Cell><GridNumber value={row.pricingQuantity} onChange={change("pricingQuantity")} step="0.0001" /></Cell>
      <Cell><GridPriceInput value={row.unitPrice} onChange={change("unitPrice")} catalog={findCatalog(catalogItems, row.productCode)} /></Cell>
      <CellStatic>{formatMoney(lineAmount(row))}</CellStatic>
      <Cell><GridInput value={row.note} onChange={change("note")} /></Cell>
      <Cell><ImageCell path={row.imagePath} onUpload={(file) => onUpload(file, itemIndex, detailIndex)} /></Cell>
      <CellStatic><button className="text-red-600 hover:underline" type="button" onClick={() => onRemove(itemIndex, detailIndex)}>Xóa</button></CellStatic>
    </tr>
  );
}

function emptyDetail(rowOrder: number): OrderLineForm {
  return {
    rowOrder, detailType: "", setNo: "0", productName: "", productCode: "", model: "", openingDirection: "", trimDirection: "", paintColor: "",
    heightMm: "", widthMm: "", frameMm: "", clearHeightMm: "", clearWidthMm: "", panelInfo: "", trimBarsPerSet: "", trimType: "", lockModel: "",
    windowBars: "", leavesPerSet: "", quantity: "", unit: "", pricingQuantity: "", unitPrice: "", amount: "", note: "", imagePath: "", modelCheck: "", priceCheck: "",
  };
}

function calculateTotals(form: OrderFormData) {
  const itemTotal = form.items.reduce((sum, item) => sum + lineAmount(item) + item.details.reduce((s, row) => s + lineAmount(row), 0), 0);
  const subtotal = itemTotal + numeric(form.shippingFee);
  const discountPercent = percent(form.discountPercent);
  const discountAmount = subtotal * discountPercent / 100;
  const totalAfterDiscount = Math.max(0, subtotal - discountAmount);
  const deliveryPayment = Math.max(0, totalAfterDiscount - numeric(form.depositAmount) - numeric(form.warehouseReceiptDeduction));
  return { subtotal, discountAmount, totalAfterDiscount, deliveryPayment };
}

function lineAmount(line: { amount: string; pricingQuantity: string; unitPrice: string }) {
  const explicit = numericOrNull(line.amount);
  if (explicit !== null && explicit > 0) return explicit;
  return numeric(line.pricingQuantity) * numeric(line.unitPrice);
}
function numeric(value: string) { const n = Number(String(value || "").replaceAll(",", "")); return Number.isFinite(n) ? n : 0; }
function numericOrNull(value: string) { if (!String(value || "").trim()) return null; const n = numeric(value); return Number.isFinite(n) ? n : null; }
function percent(value: string) { return Math.min(100, Math.max(0, numeric(value))); }
function formatMoney(value: number) { return new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 0 }).format(value); }

function SectionTitle({ title }: { title: string }) { return <div className="border-b border-slate-200 bg-slate-50 px-4 py-2"><h2 className="text-[12px] font-bold leading-5 text-slate-900">{title}</h2></div>; }
function Field({ label, children, required, invalid }: { label: string; children: React.ReactNode; required?: boolean; invalid?: boolean }) {
  const invalidClass = invalid
    ? " [&_input]:border-red-500 [&_select]:border-red-500 [&_textarea]:border-red-500 [&_input]:ring-1 [&_select]:ring-1 [&_textarea]:ring-1 [&_input]:ring-red-200 [&_select]:ring-red-200 [&_textarea]:ring-red-200"
    : "";
  return (
    <label className={`flex min-w-0 flex-col${invalidClass} [&_.erp-input]:h-9 [&_.erp-input]:w-full [&_.erp-input]:rounded-md [&_.erp-input]:px-2.5 [&_.erp-input]:py-1.5 [&_.erp-input]:text-[13px]`}>
      <span className={`mb-1 block min-h-4 truncate text-[10px] font-semibold uppercase leading-4 tracking-[0.035em] xl:text-[11px] ${invalid ? "text-red-600" : "text-slate-500"}`} title={label}>
        {label}{required ? " *" : ""}
      </span>
      {children}
      {invalid ? <span className="mt-1 block text-[10px] font-medium text-red-600">Bắt buộc nhập</span> : null}
    </label>
  );
}
function TextInput({ value, onChange, placeholder }: { value: string; onChange: (value: string) => void; placeholder?: string }) { return <input className="erp-input" value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />; }
function DealerCodeSelect({ value, options, onChange }: { value: string; options: MasterOption[]; onChange: (value: string) => void }) {
  const hasCurrent = Boolean(value) && !options.some((item) => item.code === value);
  return (
    <select className="erp-input" value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">-- Chọn Mã Đại Lý --</option>
      {hasCurrent ? <option value={value}>{value} (đang lưu)</option> : null}
      {options.map((item) => <option key={item.id} value={item.code}>{item.name && item.name !== item.code ? `${item.code} - ${item.name}` : item.code}</option>)}
    </select>
  );
}
function NumberInput({ value, onChange }: { value: string; onChange: (value: string) => void }) { return <input className="erp-input" type="number" value={value} onChange={(e) => onChange(e.target.value)} />; }
function DateInput({ value, onChange }: { value: string; onChange: (value: string) => void }) { return <input className="erp-input" type="date" value={value} onChange={(e) => onChange(e.target.value)} />; }
function Button({ children, onClick, variant = "primary" }: { children: React.ReactNode; onClick: () => void; variant?: "primary" | "secondary" }) { return <button className={variant === "primary" ? "erp-button" : "erp-button-secondary"} type="button" onClick={onClick}>{children}</button>; }
function Th({ children, rowSpan, colSpan, center = false }: { children: React.ReactNode; w: string; rowSpan?: number; colSpan?: number; center?: boolean }) { return <th rowSpan={rowSpan} colSpan={colSpan} className={`break-words border border-slate-300 px-2 py-2 align-middle font-semibold ${center ? "text-center" : "text-left"}`}>{children}</th>; }
function Cell({ children }: { children: React.ReactNode }) { return <td className="min-w-0 border border-slate-200 p-0 align-middle">{children}</td>; }
function CellStatic({ children }: { children?: React.ReactNode }) { return <td className="min-w-0 break-words border border-slate-200 px-2 py-2.5 align-middle text-[13px] text-slate-700">{children}</td>; }
function GridInput({ value, onChange, listId }: { value: string; onChange: (value: string) => void; listId?: string }) { return <input className="h-9 w-full min-w-0 border-0 bg-transparent px-2.5 text-[12px] outline-none transition-colors focus:bg-cyan-50 focus:ring-1 focus:ring-inset focus:ring-cyan-300" list={listId} value={value} onChange={(e) => onChange(e.target.value)} />; }

function GridReadOnly({ value, placeholder }: { value: string; placeholder?: string }) {
  return <div className="min-h-9 w-full bg-slate-50 px-2.5 py-2 text-[12px] text-slate-700">{value || <span className="text-slate-400">{placeholder ?? "—"}</span>}</div>;
}

function GridGroupSelect({ value, groups, placeholder, onChange }: { value: string; groups: string[]; placeholder: string; onChange: (value: string) => void }) {
  return (
    <select className="h-9 w-full min-w-0 border-0 bg-transparent px-2.5 text-[12px] outline-none transition-colors focus:bg-cyan-50 focus:ring-1 focus:ring-inset focus:ring-cyan-300" value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">{placeholder}</option>
      {groups.map((group) => <option key={group} value={group}>{group}</option>)}
    </select>
  );
}

function GridCatalogSelect({ value, currentLabel, items, display, placeholder, disabled, onCatalogSelect }: { value: string; currentLabel?: string; items: CatalogItem[]; display: "description" | "model"; placeholder: string; disabled?: boolean; onCatalogSelect: (item: CatalogItem) => void }) {
  const hasCurrent = items.some((item) => sameText(item.code, value));
  return (
    <select
      className="h-9 w-full min-w-0 border-0 bg-transparent px-2.5 text-[12px] outline-none transition-colors focus:bg-cyan-50 focus:ring-1 focus:ring-inset focus:ring-cyan-300 disabled:bg-slate-100 disabled:text-slate-400"
      value={value}
      disabled={disabled}
      onChange={(e) => {
        const catalog = findCatalog(items, e.target.value);
        if (catalog) onCatalogSelect(catalog);
      }}
    >
      <option value="">{placeholder}</option>
      {value && !hasCurrent ? <option value={value}>{currentLabel || value} · dữ liệu cũ</option> : null}
      {items.map((item) => (
        <option key={item.id} value={item.code}>
          {display === "description" ? catalogProductName(item) : `${item.code} · ${catalogProductName(item)}`}
        </option>
      ))}
    </select>
  );
}

function hydrateCreateFormFromCatalog(form: OrderFormData, catalogItems: CatalogItem[]) {
  let changed = false;
  const byCode = new Map(catalogItems.map((item) => [item.code.trim().toLocaleLowerCase("vi"), item]));

  function hydrateLine<T extends OrderLineForm | OrderItemForm>(line: T): T {
    const lookup = (line.productCode || line.model || "").trim().toLocaleLowerCase("vi");
    if (!lookup) return line;
    const catalog = byCode.get(lookup);
    if (!catalog) return line;

    const nextName = catalogProductName(catalog);
    // Khi dữ liệu đến từ Excel, ưu tiên snapshot ĐVT/Đơn giá trong file.
    // Master Data chỉ bù vào khi Excel để trống.
    const nextUnit = String(line.unit || "").trim() ? line.unit : (catalog.unit ?? line.unit);
    const nextPrice = String(line.unitPrice || "").trim() ? line.unitPrice : catalogDefaultPrice(catalog, "");
    if (
      line.productName === nextName &&
      line.productCode === catalog.code &&
      line.model === catalog.code &&
      line.unit === nextUnit &&
      line.unitPrice === nextPrice
    ) return line;

    changed = true;
    return {
      ...line,
      productName: nextName,
      productCode: catalog.code,
      model: catalog.code,
      unit: nextUnit,
      unitPrice: nextPrice,
    };
  }

  const items = form.items.map((item) => {
    const hydratedMain = hydrateLine(item);
    const details = item.details.map((detail) => hydrateLine(detail));
    const detailChanged = details.some((detail, index) => detail !== item.details[index]);
    if (hydratedMain === item && !detailChanged) return item;
    return { ...hydratedMain, details };
  });

  return changed ? { ...form, items } : form;
}


function preserveImportedImages(current: OrderFormData, incoming: OrderFormData) {
  const currentMain = new Map<string, OrderItemForm>();
  for (const item of current.items) currentMain.set(lineIdentity(item), item);

  const items = incoming.items.map((item) => {
    const existing = currentMain.get(lineIdentity(item));
    const detailImages = new Map<string, string>();
    for (const detail of existing?.details ?? []) {
      if (detail.imagePath) detailImages.set(lineIdentity(detail), detail.imagePath);
    }
    return {
      ...item,
      imagePath: item.imagePath || existing?.imagePath || "",
      details: item.details.map((detail) => ({
        ...detail,
        imagePath: detail.imagePath || detailImages.get(lineIdentity(detail)) || "",
      })),
    };
  });
  return { ...incoming, items };
}

function lineIdentity(line: { setNo?: string; productCode?: string; model?: string; productName?: string }) {
  return [line.setNo || "", line.productCode || line.model || "", line.productName || ""].map(normalizeText).join("|");
}

function normalizeText(value: string) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .trim()
    .toLocaleLowerCase("vi");
}

function sameText(left: string, right: string) {
  return normalizeText(left) === normalizeText(right);
}

function isDoorCatalogItem(item: CatalogItem) {
  const group = normalizeText(item.name);
  return group.startsWith("cua ") || group === "cua";
}

function catalogGroups(items: CatalogItem[]) {
  const seen = new Map<string, string>();
  for (const item of items) {
    const key = normalizeText(item.name);
    if (key && !seen.has(key)) seen.set(key, item.name.trim());
  }
  return [...seen.values()].sort((a, b) => a.localeCompare(b, "vi"));
}

function catalogGroupForCode(items: CatalogItem[], code: string) {
  const catalog = findCatalog(items, code);
  return catalog?.name ?? "";
}

function catalogGroupFromText(groups: string[], value: string) {
  const normalized = normalizeText(value);
  if (!normalized) return "";
  return groups.find((group) => sameText(group, value)) || "";
}

function catalogDefaultPrice(item: CatalogItem, fallback: string) {
  if (item.dealerPrice !== null && item.dealerPrice !== undefined && String(item.dealerPrice).trim() !== "") return String(item.dealerPrice);
  if (item.retailPrice !== null && item.retailPrice !== undefined && String(item.retailPrice).trim() !== "") return String(item.retailPrice);
  return fallback;
}

function findCatalog(items: CatalogItem[], code: string) {
  const normalized = code.trim().toLocaleLowerCase("vi");
  if (!normalized) return undefined;
  return items.find((item) => item.code.trim().toLocaleLowerCase("vi") === normalized);
}

function catalogProductName(item: CatalogItem) {
  return item.productDescription?.trim() || item.name;
}

function catalogOptionLabel(item: CatalogItem) {
  const displayName = catalogProductName(item);
  const parts = [displayName];
  if (displayName !== item.name) parts.push(`TENHANG ${item.name}`);
  parts.push(`MODEL ${item.code}`);
  if (item.unit) parts.push(`ĐVT ${item.unit}`);
  if (item.dealerPrice !== null && item.dealerPrice !== undefined) parts.push(`ĐL ${formatCatalogPrice(item.dealerPrice)}`);
  if (item.retailPrice !== null && item.retailPrice !== undefined) parts.push(`BL ${formatCatalogPrice(item.retailPrice)}`);
  return parts.join(" · ");
}

function formatCatalogPrice(value: string | number) {
  const n = Number(value);
  return Number.isFinite(n) ? new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 0 }).format(n) : String(value);
}
function GridCatalogInput({ value, onChange, listId, mode, catalogItems, onCatalogSelect }: { value: string; onChange: (value: string) => void; listId: string; mode: "code" | "name"; catalogItems: CatalogItem[]; onCatalogSelect: (item: CatalogItem) => void }) {
  function resolve(nextValue: string) {
    const normalized = nextValue.trim().toLocaleLowerCase("vi");
    if (!normalized) return;
    const matches = catalogItems.filter((item) => {
      if (mode === "code") return item.code.trim().toLocaleLowerCase("vi") === normalized;
      return [catalogProductName(item), item.name].some((value) => value.trim().toLocaleLowerCase("vi") === normalized);
    });
    if (matches.length === 1) onCatalogSelect(matches[0]);
  }
  return <input className="h-9 w-full min-w-0 border-0 bg-transparent px-2.5 text-[12px] outline-none transition-colors focus:bg-cyan-50 focus:ring-1 focus:ring-inset focus:ring-cyan-300" list={listId} value={value} onChange={(e) => { onChange(e.target.value); resolve(e.target.value); }} onBlur={(e) => resolve(e.target.value)} />;
}
function GridNumber({ value, onChange, step = "1" }: { value: string; onChange: (value: string) => void; step?: string }) { return <input className="h-9 w-full min-w-0 border-0 bg-transparent px-2.5 text-right text-[12px] outline-none transition-colors focus:bg-cyan-50 focus:ring-1 focus:ring-inset focus:ring-cyan-300" type="number" step={step} value={value} onChange={(e) => onChange(e.target.value)} />; }
function GridPriceInput({ value, onChange, catalog }: { value: string; onChange: (value: string) => void; catalog?: CatalogItem }) {
  const dealer = catalog?.dealerPrice;
  const retail = catalog?.retailPrice;
  const hasDealer = dealer !== null && dealer !== undefined && String(dealer).trim() !== "";
  const hasRetail = retail !== null && retail !== undefined && String(retail).trim() !== "";
  return (
    <div className="w-full min-w-0">
      <input className="h-9 w-full min-w-0 border-0 bg-transparent px-2.5 text-right text-[12px] outline-none transition-colors focus:bg-cyan-50 focus:ring-1 focus:ring-inset focus:ring-cyan-300" type="number" step="1" value={value} onChange={(e) => onChange(e.target.value)} />
      {hasDealer || hasRetail ? (
        <div className="flex flex-wrap gap-0.5 border-t border-slate-100 px-0.5 py-0.5">
          {hasDealer ? <button className="rounded bg-cyan-50 px-1.5 py-0.5 text-[10px] font-semibold text-cyan-800 hover:bg-cyan-100" type="button" title={`Giá đại lý: ${formatCatalogPrice(dealer as string | number)} đ`} onClick={() => onChange(String(dealer))}>Đại lý</button> : null}
          {hasRetail ? <button className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800 hover:bg-amber-100" type="button" title={`Giá bán lẻ: ${formatCatalogPrice(retail as string | number)} đ`} onClick={() => onChange(String(retail))}>Bán lẻ</button> : null}
        </div>
      ) : null}
    </div>
  );
}
function ImageCell({ path, onUpload }: { path: string; onUpload: (file: File) => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function handleImage(file: File, source: "file" | "paste") {
    if (!file.type.startsWith("image/")) {
      setError("Clipboard không chứa hình ảnh.");
      return;
    }
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      setError("Chỉ hỗ trợ JPG, PNG hoặc WEBP.");
      return;
    }
    if (source === "paste" && path && !window.confirm("Dòng này đã có ảnh. Dán ảnh mới để thay thế?")) return;

    setBusy(true);
    setError("");
    try {
      await onUpload(file);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Không thể tải ảnh.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="flex min-h-[82px] cursor-default flex-col items-center justify-center gap-1.5 rounded-md px-1 py-2 text-center text-[11px] leading-tight outline-none transition-colors focus:bg-cyan-50 focus:ring-1 focus:ring-inset focus:ring-cyan-400"
      tabIndex={0}
      title="Bấm vào ô rồi nhấn Ctrl+V để dán ảnh"
      aria-label="Hình ảnh sản phẩm. Bấm vào ô rồi nhấn Ctrl+V để dán ảnh, hoặc chọn Tải ảnh."
      onPaste={(event) => {
        if (busy) return;
        const imageItem = Array.from(event.clipboardData.items).find(
          (item) => item.kind === "file" && item.type.startsWith("image/"),
        );
        const file = imageItem?.getAsFile();
        if (!file) {
          setError("Clipboard không có ảnh để dán.");
          return;
        }
        event.preventDefault();
        void handleImage(file, "paste");
      }}
    >
      {path ? (
        <a href={path} target="_blank" rel="noreferrer" className="inline-flex">
          <img src={path} alt="Hình sản phẩm" className="h-14 w-16 rounded border border-slate-200 bg-white object-contain" />
        </a>
      ) : null}
      <span className="font-semibold text-cyan-800">{busy ? "Đang tải..." : "Ctrl+V để dán"}</span>
      <label className={`break-words font-medium text-cyan-700 hover:underline ${busy ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}>
        {path ? "Đổi / tải ảnh" : "Tải ảnh"}
        <input
          className="hidden"
          type="file"
          accept="image/png,image/jpeg,image/webp"
          disabled={busy}
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            await handleImage(file, "file");
            e.target.value = "";
          }}
        />
      </label>
      {error ? <span className="max-w-full break-words text-[10px] text-red-600">{error}</span> : null}
    </div>
  );
}

function MasterDatalist({ id, items }: { id: string; items: MasterOption[] }) {
  return <datalist id={id}>{items.map((item) => <option key={`${item.groupCode}-${item.id}`} value={item.code}>{item.name}</option>)}</datalist>;
}
function MoneyField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) { return <div className="flex items-center justify-between gap-3"><label className="text-[10px] leading-4 text-slate-600">{label}</label><input className="erp-input w-44 !px-2 !py-1 !text-[10px] text-right" type="number" value={value} onChange={(e) => onChange(e.target.value)} /></div>; }
function PercentField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <label className="text-[10px] leading-4 text-slate-600">{label}</label>
      <div className="flex items-center gap-1.5">
        <input
          aria-label={label}
          className="erp-input w-32 !px-2 !py-1 !text-[10px] border-cyan-300 bg-white text-right font-semibold text-slate-900"
          type="number"
          inputMode="decimal"
          min="0"
          max="100"
          step="0.01"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={(e) => e.currentTarget.select()}
        />
        <span className="text-[10px] font-semibold text-slate-600">%</span>
      </div>
    </div>
  );
}
function MoneyDisplay({ label, value, emphasis }: { label: string; value: number; emphasis?: boolean }) { return <div className={`flex items-center justify-between gap-3 rounded-lg px-3 py-1.5 text-[10px] leading-4 ${emphasis ? "bg-slate-900 text-white" : "bg-slate-100"}`}><span>{label}</span><strong className="text-[11px]">{formatMoney(value)} đ</strong></div>; }
