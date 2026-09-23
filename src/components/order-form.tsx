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
  groupCode: "PANEL_OPTION" | "OPENING_DIRECTION" | "TRIM_DIRECTION" | "PAINT_COLOR";
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
    setBusy(true);
    setMessage(null);
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

      <section className="erp-card">
        <SectionTitle title="Thông tin đơn hàng" />
        <div className="grid gap-4 p-5 md:grid-cols-2 xl:grid-cols-4">
          <Field label="Mã khách hàng"><TextInput value={form.customerCode} onChange={(v) => setField("customerCode", v)} /></Field>
          <Field label="Tên khách hàng"><TextInput value={form.customerName} onChange={(v) => setField("customerName", v)} /></Field>
          <Field label="NVKD phụ trách"><TextInput value={form.salesEmployeeCode} onChange={(v) => setField("salesEmployeeCode", v)} /></Field>
          <Field label="Mã đơn hàng" required><TextInput value={form.orderCode} onChange={(v) => setField("orderCode", v)} /></Field>
          <Field label="Ngày đặt hàng"><DateInput value={form.orderDate} onChange={(v) => setField("orderDate", v)} /></Field>
          <Field label="Ngày cần giao hàng"><DateInput value={form.requiredDeliveryDate} onChange={(v) => setField("requiredDeliveryDate", v)} /></Field>
          <Field label="Trạng thái">
            <select className="erp-input" value={form.status} onChange={(e) => setField("status", e.target.value)}>
              {ORDER_STATUS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </Field>
          <Field label="Ngày cập nhật"><DateInput value={form.excelUpdateDate} onChange={(v) => setField("excelUpdateDate", v)} /></Field>
          <Field label="Người nhận"><TextInput value={form.receiverName} onChange={(v) => setField("receiverName", v)} /></Field>
          <Field label="Số điện thoại"><TextInput value={form.receiverPhone} onChange={(v) => setField("receiverPhone", v)} /></Field>
          <Field label="Số Km giao hàng"><NumberInput value={form.deliveryKm} onChange={(v) => setField("deliveryKm", v)} /></Field>
          <Field label="Vùng miền"><TextInput value={form.region} onChange={(v) => setField("region", v)} /></Field>
          <Field label="Nhóm"><NumberInput value={form.groupNo} onChange={(v) => setField("groupNo", v)} /></Field>
          <Field label="Mã biểu mẫu"><TextInput value={form.formCode} onChange={(v) => setField("formCode", v)} /></Field>
          <Field label="Ngày hiệu lực"><DateInput value={form.formEffectiveDate} onChange={(v) => setField("formEffectiveDate", v)} /></Field>
          <Field label="Địa chỉ nhận hàng" wide><textarea className="erp-input min-h-20 resize-y" value={form.receiverAddress} onChange={(e) => setField("receiverAddress", e.target.value)} /></Field>
        </div>
      </section>

      <section className="erp-card overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-slate-200 bg-white p-5 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <h2 className="text-lg font-bold">Chi tiết đơn hàng theo từng bộ cửa</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={addItem}>+ Bộ cửa</Button>
          </div>
        </div>

        <div className="space-y-6 bg-slate-50 p-3 md:p-5">
          {form.items.map((item, itemIndex) => (
            <div key={item.clientId} className="overflow-hidden rounded-xl border border-slate-300 bg-white shadow-sm">
              <div className="flex flex-col gap-2 border-b border-slate-200 bg-slate-900 px-4 py-3 text-white md:flex-row md:items-center md:justify-between">
                <div className="font-semibold">Bộ cửa #{itemIndex + 1} {item.setNo ? `· Bộ số ${item.setNo}` : ""}</div>
                <div className="flex flex-wrap gap-2">
                  <button className="erp-action-dark" type="button" onClick={() => duplicateItem(itemIndex)}>Nhân bản bộ</button>
                  <button className="erp-action-dark" type="button" onClick={() => addDetail(itemIndex)}>+ Chi tiết / phụ kiện / phụ phí của bộ cửa</button>
                  <button className="erp-action-danger" type="button" onClick={() => removeItem(itemIndex)}>Xóa bộ</button>
                </div>
              </div>

              <div className="w-full overflow-hidden">
                <table className="w-full table-fixed border-collapse text-[9px] leading-tight xl:text-[10px]">
                  <colgroup>
                    <col style={{ width: "2%" }} />
                    <col style={{ width: "3.5%" }} />
                    <col style={{ width: "11%" }} />
                    <col style={{ width: "8%" }} />
                    <col style={{ width: "4.5%" }} />
                    <col style={{ width: "4%" }} />
                    <col style={{ width: "5%" }} />
                    <col style={{ width: "4.5%" }} />
                    <col style={{ width: "3.5%" }} />
                    <col style={{ width: "3.5%" }} />
                    <col style={{ width: "3.5%" }} />
                    <col style={{ width: "3.5%" }} />
                    <col style={{ width: "3.5%" }} />
                    <col style={{ width: "4%" }} />
                    <col style={{ width: "3.5%" }} />
                    <col style={{ width: "5%" }} />
                    <col style={{ width: "5.5%" }} />
                    <col style={{ width: "6%" }} />
                    <col style={{ width: "8%" }} />
                    <col style={{ width: "5.5%" }} />
                    <col style={{ width: "2.5%" }} />
                  </colgroup>
                  <thead className="sticky top-0 z-10 bg-slate-200 text-slate-700">
                    <tr>
                      <Th w="56" rowSpan={2}>STT</Th><Th w="100" rowSpan={2}>BỘ SỐ</Th><Th w="320" rowSpan={2}>Tên sản phẩm<br/>(1)</Th><Th w="220" rowSpan={2}>Model<br/>(2)</Th><Th w="140" rowSpan={2}>Ô THOÁNG</Th>
                      <Th w="95" rowSpan={2}>Hướng mở<br/>(3)</Th><Th w="125" rowSpan={2}>Phào<br/>(Thuận - Nghịch)<br/>(4)</Th><Th w="95" rowSpan={2}>Màu sơn<br/>(5)</Th>
                      <Th w="270" colSpan={3} center>Kích thước cửa (mm)</Th><Th w="190" colSpan={2} center>KT thông thủy</Th><Th w="115" rowSpan={2}>Số lượng bộ<br/>(13)</Th>
                      <Th w="460" colSpan={4} center>Tính giá</Th><Th w="260" rowSpan={2}>Ghi chú<br/>(18)</Th><Th w="155" rowSpan={2}>Hình ảnh SP</Th><Th w="70" rowSpan={2}>Xóa</Th>
                    </tr>
                    <tr>
                      <Th w="90" center>Cao<br/>(7)</Th><Th w="90" center>Rộng<br/>(8)</Th><Th w="85" center>Khuôn<br/>(9)</Th>
                      <Th w="95" center>Cao<br/>(10)</Th><Th w="95" center>Rộng<br/>(11)</Th>
                      <Th w="85" center>ĐVT<br/>(14)</Th><Th w="110" center>KH/Lượng<br/>(15)</Th><Th w="125" center>Đơn giá<br/>(16)</Th><Th w="140" center>Thành tiền<br/>(17)</Th>
                    </tr>
                  </thead>
                  <tbody>
                    <EditableMainRow
                      item={item}
                      itemIndex={itemIndex}
                      onChange={updateMain}
                      onUpload={uploadImage}
                      catalogItems={catalogItems}
                      doorCatalogItems={doorCatalogItems}
                      doorGroups={doorGroups}
                      onCatalogSelect={applyMainCatalog}
                      optionValues={optionValues}
                    />
                    {item.details.map((detail, detailIndex) => (
                      <EditableDetailRow
                        key={`${item.clientId}-${detailIndex}`}
                        row={detail}
                        itemIndex={itemIndex}
                        detailIndex={detailIndex}
                        onChange={updateDetail}
                        onUpload={uploadImage}
                        onRemove={removeDetail}
                        catalogItems={catalogItems}
                        accessoryCatalogItems={accessoryCatalogItems}
                        accessoryGroups={accessoryGroups}
                        onCatalogSelect={applyDetailCatalog}
                        optionValues={optionValues}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="erp-card">
          <SectionTitle title="Câu hỏi thêm / Xác nhận" />
          <div className="divide-y divide-slate-200">
            {form.requirements.map((row, index) => (
              <div className="grid gap-3 p-4 md:grid-cols-[1fr_190px_1fr] md:items-center" key={row.code}>
                <div className="font-medium text-slate-800">{index + 1}. {row.questionText}</div>
                <select
                  className="erp-input"
                  value={row.answer}
                  onChange={(e) => setField("requirements", form.requirements.map((item, i) => i === index ? { ...item, answer: e.target.value } : item))}
                >
                  <option value="">Chưa xác nhận</option>
                  <option value="Có">Có</option>
                  <option value="Không">Không</option>
                  <option value="Đã xác nhận">Đã xác nhận</option>
                  <option value="Không áp dụng">Không áp dụng</option>
                </select>
                <TextInput
                  placeholder="Ghi chú xác nhận"
                  value={row.note}
                  onChange={(value) => setField("requirements", form.requirements.map((item, i) => i === index ? { ...item, note: value } : item))}
                />
              </div>
            ))}
          </div>
        </div>

        <div className="erp-card">
          <SectionTitle title="Tổng hợp giá trị đơn hàng" />
          <div className="space-y-3 p-5">
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
    <tr className="bg-cyan-50 font-medium">
      <CellStatic>{item.lineNo}</CellStatic>
      <Cell><GridInput value={value("setNo")} onChange={change("setNo")} /></Cell>
      <Cell>
        <div className="min-w-0 divide-y divide-slate-200">
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

function SectionTitle({ title }: { title: string }) { return <div className="border-b border-slate-200 bg-slate-50 px-5 py-4"><h2 className="font-bold text-slate-900">{title}</h2></div>; }
function Field({ label, children, required, wide }: { label: string; children: React.ReactNode; required?: boolean; wide?: boolean }) { return <label className={wide ? "md:col-span-2 xl:col-span-2" : ""}><span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">{label}{required ? " *" : ""}</span>{children}</label>; }
function TextInput({ value, onChange, placeholder }: { value: string; onChange: (value: string) => void; placeholder?: string }) { return <input className="erp-input" value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />; }
function NumberInput({ value, onChange }: { value: string; onChange: (value: string) => void }) { return <input className="erp-input" type="number" value={value} onChange={(e) => onChange(e.target.value)} />; }
function DateInput({ value, onChange }: { value: string; onChange: (value: string) => void }) { return <input className="erp-input" type="date" value={value} onChange={(e) => onChange(e.target.value)} />; }
function Button({ children, onClick, variant = "primary" }: { children: React.ReactNode; onClick: () => void; variant?: "primary" | "secondary" }) { return <button className={variant === "primary" ? "erp-button" : "erp-button-secondary"} type="button" onClick={onClick}>{children}</button>; }
function Th({ children, rowSpan, colSpan, center = false }: { children: React.ReactNode; w: string; rowSpan?: number; colSpan?: number; center?: boolean }) { return <th rowSpan={rowSpan} colSpan={colSpan} className={`overflow-hidden break-words border border-slate-300 px-1 py-1.5 align-middle font-semibold ${center ? "text-center" : "text-left"}`}>{children}</th>; }
function Cell({ children }: { children: React.ReactNode }) { return <td className="min-w-0 overflow-hidden border border-slate-200 p-0 align-top">{children}</td>; }
function CellStatic({ children }: { children?: React.ReactNode }) { return <td className="min-w-0 overflow-hidden break-words border border-slate-200 px-1 py-1.5 align-middle text-slate-700">{children}</td>; }
function GridInput({ value, onChange, listId }: { value: string; onChange: (value: string) => void; listId?: string }) { return <input className="h-8 w-full min-w-0 border-0 bg-transparent px-1 text-[9px] outline-none focus:bg-cyan-50 xl:text-[10px]" list={listId} value={value} onChange={(e) => onChange(e.target.value)} />; }

function GridReadOnly({ value, placeholder }: { value: string; placeholder?: string }) {
  return <div className="min-h-8 w-full bg-slate-50 px-1 py-1.5 text-[9px] text-slate-700 xl:text-[10px]">{value || <span className="text-slate-400">{placeholder ?? "—"}</span>}</div>;
}

function GridGroupSelect({ value, groups, placeholder, onChange }: { value: string; groups: string[]; placeholder: string; onChange: (value: string) => void }) {
  return (
    <select className="h-8 w-full min-w-0 border-0 bg-transparent px-1 text-[9px] outline-none focus:bg-cyan-50 xl:text-[10px]" value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">{placeholder}</option>
      {groups.map((group) => <option key={group} value={group}>{group}</option>)}
    </select>
  );
}

function GridCatalogSelect({ value, currentLabel, items, display, placeholder, disabled, onCatalogSelect }: { value: string; currentLabel?: string; items: CatalogItem[]; display: "description" | "model"; placeholder: string; disabled?: boolean; onCatalogSelect: (item: CatalogItem) => void }) {
  const hasCurrent = items.some((item) => sameText(item.code, value));
  return (
    <select
      className="h-8 w-full min-w-0 border-0 bg-transparent px-1 text-[9px] outline-none focus:bg-cyan-50 disabled:bg-slate-100 disabled:text-slate-400 xl:text-[10px]"
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
  return <input className="h-8 w-full min-w-0 border-0 bg-transparent px-1 text-[9px] outline-none focus:bg-cyan-50 xl:text-[10px]" list={listId} value={value} onChange={(e) => { onChange(e.target.value); resolve(e.target.value); }} onBlur={(e) => resolve(e.target.value)} />;
}
function GridNumber({ value, onChange, step = "1" }: { value: string; onChange: (value: string) => void; step?: string }) { return <input className="h-8 w-full min-w-0 border-0 bg-transparent px-1 text-right text-[9px] outline-none focus:bg-cyan-50 xl:text-[10px]" type="number" step={step} value={value} onChange={(e) => onChange(e.target.value)} />; }
function GridPriceInput({ value, onChange, catalog }: { value: string; onChange: (value: string) => void; catalog?: CatalogItem }) {
  const dealer = catalog?.dealerPrice;
  const retail = catalog?.retailPrice;
  const hasDealer = dealer !== null && dealer !== undefined && String(dealer).trim() !== "";
  const hasRetail = retail !== null && retail !== undefined && String(retail).trim() !== "";
  return (
    <div className="w-full min-w-0">
      <input className="h-8 w-full min-w-0 border-0 bg-transparent px-1 text-right text-[9px] outline-none focus:bg-cyan-50 xl:text-[10px]" type="number" step="1" value={value} onChange={(e) => onChange(e.target.value)} />
      {hasDealer || hasRetail ? (
        <div className="flex flex-wrap gap-0.5 border-t border-slate-100 px-0.5 py-0.5">
          {hasDealer ? <button className="rounded bg-cyan-50 px-1 py-0.5 text-[8px] font-semibold text-cyan-800 hover:bg-cyan-100" type="button" title={`Giá đại lý: ${formatCatalogPrice(dealer as string | number)} đ`} onClick={() => onChange(String(dealer))}>Đại lý</button> : null}
          {hasRetail ? <button className="rounded bg-amber-50 px-1 py-0.5 text-[8px] font-semibold text-amber-800 hover:bg-amber-100" type="button" title={`Giá bán lẻ: ${formatCatalogPrice(retail as string | number)} đ`} onClick={() => onChange(String(retail))}>Bán lẻ</button> : null}
        </div>
      ) : null}
    </div>
  );
}
function ImageCell({ path, onUpload }: { path: string; onUpload: (file: File) => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <div className="flex min-h-12 flex-col items-center justify-center gap-1 px-0.5 py-1 text-center text-[8px] leading-tight">
      {path ? (
        <a href={path} target="_blank" rel="noreferrer" className="inline-flex">
          <img src={path} alt="Hình sản phẩm" className="h-10 w-12 rounded border border-slate-200 bg-white object-contain" />
        </a>
      ) : null}
      <label className="cursor-pointer break-words font-medium text-cyan-700 hover:underline">
        {busy ? "Đang tải" : path ? "Đổi ảnh" : "Tải ảnh"}
        <input
          className="hidden"
          type="file"
          accept="image/png,image/jpeg,image/webp"
          disabled={busy}
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            setBusy(true);
            setError("");
            try {
              await onUpload(file);
            } catch (uploadError) {
              setError(uploadError instanceof Error ? uploadError.message : "Không thể tải ảnh.");
            } finally {
              setBusy(false);
              e.target.value = "";
            }
          }}
        />
      </label>
      {error ? <span className="max-w-full break-words text-[7px] text-red-600">{error}</span> : null}
    </div>
  );
}

function MasterDatalist({ id, items }: { id: string; items: MasterOption[] }) {
  return <datalist id={id}>{items.map((item) => <option key={`${item.groupCode}-${item.id}`} value={item.code}>{item.name}</option>)}</datalist>;
}
function MoneyField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) { return <div className="flex items-center justify-between gap-4"><label className="text-sm text-slate-600">{label}</label><input className="erp-input w-44 text-right" type="number" value={value} onChange={(e) => onChange(e.target.value)} /></div>; }
function PercentField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <label className="text-sm text-slate-600">{label}</label>
      <div className="flex items-center gap-2">
        <input
          aria-label={label}
          className="erp-input w-32 border-cyan-300 bg-white text-right font-semibold text-slate-900"
          type="number"
          inputMode="decimal"
          min="0"
          max="100"
          step="0.01"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={(e) => e.currentTarget.select()}
        />
        <span className="font-semibold text-slate-600">%</span>
      </div>
    </div>
  );
}
function MoneyDisplay({ label, value, emphasis }: { label: string; value: number; emphasis?: boolean }) { return <div className={`flex items-center justify-between gap-4 rounded-lg px-3 py-2 ${emphasis ? "bg-slate-900 text-white" : "bg-slate-100"}`}><span className="text-sm">{label}</span><strong>{formatMoney(value)} đ</strong></div>; }
