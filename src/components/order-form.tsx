"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  createDefaultOrderForm,
  createOrderItem,
  localTodayInput,
  isProductionStatus,
  newClientId,
  orderStatusLabel,
  reindexItems,
  showsSetNumber,
  statusAfterSave,
  type OrderFormData,
  type OrderItemForm,
  type OrderLineForm,
  type OrderSaveAction,
} from "@/lib/order-form";
import {
  DEFAULT_CALCULATION_CONFIG,
  calculateDoorUnitPrice,
  cloneCalculationConfig,
  resolveCalculationRule,
  type CalculationConfig,
  type InputSuggestionRule,
  type PricingQuantityRule,
} from "@/lib/calculation-config";

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

type SaveOrderResponse = { ok: boolean; id?: number; error?: string; setNumbers?: Array<string | null> };

// V91: trạng thái do nút Lưu quyết định (Lưu nháp = Đơn hàng mẫu, Lưu đơn hàng = Sản xuất) nên
// không còn là trường người dùng phải nhập.
const REQUIRED_ORDER_INFO_FIELDS = [
  { key: "customerCode", label: "Mã Đại Lý" },
  { key: "customerName", label: "Tên khách hàng" },
  { key: "salesEmployeeCode", label: "NVKD phụ trách" },
  { key: "orderCode", label: "Mã đơn hàng" },
  { key: "orderDate", label: "Ngày đặt hàng" },
  { key: "requiredDeliveryDate", label: "Ngày cần giao hàng" },
  { key: "excelUpdateDate", label: "Ngày cập nhật" },
  { key: "receiverPhone", label: "Số điện thoại" },
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
  const [persistedOrderId, setPersistedOrderId] = useState<number | undefined>(orderId);
  const [message, setMessage] = useState<{ type: "ok" | "error"; text: string } | null>(null);
  const [invalidOrderInfoFields, setInvalidOrderInfoFields] = useState<Set<RequiredOrderInfoKey>>(() => new Set());
  const [catalogItems, setCatalogItems] = useState<CatalogItem[]>([]);
  const [masterOptions, setMasterOptions] = useState<MasterOption[]>([]);
  const [calculationConfig, setCalculationConfig] = useState<CalculationConfig>(() => cloneCalculationConfig(DEFAULT_CALCULATION_CONFIG));
  const [calculationConfigLoaded, setCalculationConfigLoaded] = useState(false);
  const excelInputRef = useRef<HTMLInputElement>(null);
  const importedFromExcelRef = useRef(false);
  const [excelImportBusy, setExcelImportBusy] = useState(false);
  const [excelImportMessage, setExcelImportMessage] = useState<{ type: "ok" | "error"; text: string } | null>(null);
  // V77: thu gọn / mở rộng từng bộ cửa để đơn nhiều bộ vẫn theo dõi được.
  const [collapsedItems, setCollapsedItems] = useState<Set<string>>(() => new Set());
  // V77: mốc ngày do server trả về — dùng để biết người dùng đã sửa ô ngày hay chưa.
  const serverDefaultDatesRef = useRef({
    orderDate: initialData?.orderDate ?? "",
    excelUpdateDate: initialData?.excelUpdateDate ?? "",
  });

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
      fetch("/api/calculation-config", { cache: "no-store" })
        .then(async (response) => {
          const result = await response.json() as { ok: boolean; config?: CalculationConfig };
          if (!cancelled && response.ok && result.ok && result.config) setCalculationConfig(result.config);
          if (!cancelled) setCalculationConfigLoaded(true);
        })
        .catch(() => { if (!cancelled) setCalculationConfigLoaded(true); }),
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
  // Tên sản phẩm diễn giải + MODEL + ĐVT + giá Đại lý từ Danh mục hàng hóa.
  // Không tự ghi đè đơn cũ ở chế độ chỉnh sửa để giữ snapshot lịch sử.
  useEffect(() => {
    if (mode !== "create" || !catalogItems.length || importedFromExcelRef.current) return;
    setForm((current) => hydrateCreateFormFromCatalog(current, catalogItems));
  }, [mode, catalogItems]);

  // KH/Lượng tự động theo loại dòng. Không chạy lại ngay sau import Excel để giữ snapshot import nghiêm ngặt;
  // sau đó mọi chỉnh sửa trên form sẽ áp dụng công thức mới.
  useEffect(() => {
    if (!catalogItems.length || !calculationConfigLoaded || importedFromExcelRef.current) return;
    setForm((current) => recalculateAutomaticPricingForm(current, catalogItems, calculationConfig, { applyDoorUnitPrice: mode === "create" }));
  }, [catalogItems, calculationConfig, calculationConfigLoaded]);

  // V77: Tạo đơn mới lấy ngày đặt hàng / ngày cập nhật theo giờ máy người dùng,
  // chỉ thay khi người dùng chưa sửa hai ô này (tránh ghi đè dữ liệu đã nhập).
  useEffect(() => {
    if (mode !== "create") return;
    const today = localTodayInput();
    const defaults = serverDefaultDatesRef.current;
    setForm((current) => {
      const orderDate = current.orderDate === defaults.orderDate ? today : current.orderDate;
      const excelUpdateDate = current.excelUpdateDate === defaults.excelUpdateDate ? today : current.excelUpdateDate;
      if (orderDate === current.orderDate && excelUpdateDate === current.excelUpdateDate) return current;
      return { ...current, orderDate, excelUpdateDate };
    });
  }, [mode]);

  const totals = useMemo(() => calculateTotals(form), [form]);
  const detailCount = useMemo(() => form.items.reduce((sum, item) => sum + item.details.length, 0), [form.items]);
  // V75/V91: Bộ số chỉ hiện khi đơn đã vào Sản xuất (bấm Lưu đơn hàng).
  const setNumberVisible = useMemo(() => showsSetNumber(form.status), [form.status]);

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
        // V75: bộ cửa nhân bản phải nhận Bộ số mới, không dùng lại số của bộ gốc.
        setNo: "",
        details: source.details.map((detail) => ({ ...detail, setNo: "" })),
      };
      const next = [...current.items];
      next.splice(index + 1, 0, copy);
      return { ...current, items: reindexItems(next) };
    });
  }

  function removeItem(index: number) {
    const target = form.items[index];
    // V77: giữ ít nhất 1 bộ cửa — nút Xóa đã bị vô hiệu hoá nên đây chỉ là chốt an toàn.
    if (!target || form.items.length <= 1) return;
    if (target.details.length > 0 || target.imagePath) {
      const accepted = window.confirm(
        `Xóa bộ cửa #${index + 1}${target.productName ? ` (${target.productName})` : ""}?\n\n` +
        `Bộ cửa này có ${target.details.length} dòng phụ kiện / chi tiết` +
        `${target.imagePath ? " và 1 hình ảnh sản phẩm" : ""} — xóa sẽ mất dữ liệu đã nhập.`,
      );
      if (!accepted) return;
    }
    setForm((current) => ({ ...current, items: reindexItems(current.items.filter((_, itemIndex) => itemIndex !== index)) }));
  }

  function toggleItemCollapsed(clientId: string) {
    setCollapsedItems((current) => {
      const next = new Set(current);
      if (next.has(clientId)) next.delete(clientId);
      else next.add(clientId);
      return next;
    });
  }

  function collapseAllItems() {
    setCollapsedItems(new Set(form.items.map((item) => item.clientId)));
  }

  function expandAllItems() {
    setCollapsedItems(new Set());
  }

  function updateMain(index: number, key: keyof Omit<OrderItemForm, "clientId" | "lineNo" | "details">, value: string) {
    setForm((current) => {
      const items = [...current.items];
      // V59: KH/Lượng nhập tay được đánh dấu để không bị tính lại tự động.
      const draft = { ...items[index], [key]: value };
      const nextItem = key === "pricingQuantity" ? { ...draft, pricingManual: "1" } : draft;
      items[index] = recalculateAutomaticPricingQuantity(nextItem, catalogItems, calculationConfig, { applyDoorUnitPrice: key === "frameMm" });
      return { ...current, items };
    });
  }

  function applyMainCatalog(itemIndex: number, catalog: CatalogItem) {
    setForm((current) => {
      const items = [...current.items];
      const currentItem = items[itemIndex];
      items[itemIndex] = recalculateAutomaticPricingQuantity({
        ...currentItem,
        productCode: catalog.code,
        productName: catalogProductName(catalog),
        model: catalog.code,
        unit: catalog.unit ?? currentItem.unit,
        unitPrice: catalogDefaultPrice(catalog, currentItem.unitPrice),
        // V59: đổi Model thì bỏ đánh dấu nhập tay để KH/Lượng tự tính lại theo cấu hình.
        pricingManual: "",
      }, catalogItems, calculationConfig, { applyDoorUnitPrice: true });
      return { ...current, items };
    });
  }

  function applyDetailCatalog(itemIndex: number, detailIndex: number, catalog: CatalogItem) {
    setForm((current) => {
      const items = [...current.items];
      const item = items[itemIndex];
      const details = [...item.details];
      const currentDetail = details[detailIndex];
      details[detailIndex] = applyAccessoryDimensionSuggestion({
        ...currentDetail,
        productCode: catalog.code,
        productName: catalogProductName(catalog),
        model: catalog.code,
        unit: catalog.unit ?? currentDetail.unit,
        unitPrice: catalogDefaultPrice(catalog, currentDetail.unitPrice),
        // V59: đổi Model thì bỏ đánh dấu nhập tay để KH/Lượng tự tính lại theo cấu hình.
        pricingManual: "",
      }, item, catalog, calculationConfig, parentDoorTarget(item, catalogItems));
      items[itemIndex] = recalculateAutomaticPricingQuantity({ ...item, details }, catalogItems, calculationConfig);
      return { ...current, items };
    });
  }

  function updateDetail(itemIndex: number, detailIndex: number, key: keyof OrderLineForm, value: string) {
    setForm((current) => {
      const items = [...current.items];
      const item = items[itemIndex];
      const details = [...item.details];
      // V59: KH/Lượng nhập tay được đánh dấu để không bị tính lại tự động.
      const draft = { ...details[detailIndex], [key]: value };
      details[detailIndex] = key === "pricingQuantity" ? { ...draft, pricingManual: "1" } : draft;
      items[itemIndex] = recalculateAutomaticPricingQuantity({ ...item, details }, catalogItems, calculationConfig);
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

  /**
   * V91: chỉ còn 2 hành động lưu.
   * - "DRAFT" (Lưu nháp): đơn giữ/trở về trạng thái Đơn hàng mẫu.
   * - "ORDER" (Lưu đơn hàng): chuyển đơn sang trạng thái Sản xuất.
   * V93: lưu xong (cả 2 hành động) đều mở trang chi tiết đơn.
   */
  async function save(action: OrderSaveAction) {
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
      const targetOrderId = persistedOrderId;
      const url = targetOrderId ? `/api/orders/${targetOrderId}` : "/api/orders";
      const nextStatus = statusAfterSave(form.status, action);
      const response = await fetch(url, {
        // Dùng POST cho cập nhật để tránh proxy/hosting trả HTML với PUT ở route động.
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ ...form, status: nextStatus }),
      });
      const result = await readJsonResponse(response);
      if (!response.ok || !result.ok || !result.id) throw new Error(result.error || "Không thể lưu đơn hàng.");
      setPersistedOrderId(result.id);
      // V91: cập nhật trạng thái hiển thị ngay theo hành động vừa bấm.
      setForm((current) => ({ ...current, status: nextStatus }));
      // V75: hiển thị Bộ số vừa được hệ thống cấp mà không cần tải lại trang.
      if (result.setNumbers?.length) {
        const assigned = result.setNumbers;
        setForm((current) => ({
          ...current,
          status: nextStatus,
          items: current.items.map((item, index) =>
            assigned[index] ? { ...item, setNo: assigned[index] as string } : item),
        }));
      }
      setMessage({
        type: "ok",
        text: `${targetOrderId ? "Đã cập nhật" : "Đã tạo"} đơn hàng — trạng thái ${orderStatusLabel(nextStatus)}.`,
      });
      // V93: sau khi lưu, cả Lưu nháp và Lưu đơn hàng đều mở trang chi tiết đơn.
      router.push(`/orders/${result.id}`);
      router.refresh();
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Không thể lưu đơn hàng." });
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="order-entry-compact space-y-3 text-[12px]" style={{ fontFamily: '"Segoe UI", Tahoma, Arial, sans-serif' }}>
      <section className="erp-card">
        <div className="flex flex-col gap-2 p-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-[13px] font-semibold text-slate-900">Nhập dữ liệu từ mẫu Excel đơn hàng</h2>
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
          <div className={`border-t px-3 py-2 text-[11px] ${excelImportMessage.type === "ok" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-red-200 bg-red-50 text-red-800"}`}>{excelImportMessage.text}</div>
        ) : null}
      </section>

      <section id="order-information" className="erp-card scroll-mt-4 overflow-hidden">
        <div className="border-b border-slate-200 bg-slate-50 px-3 py-1.5">
          <h2 className="text-[12px] font-semibold tracking-normal text-slate-900">Thông tin đơn hàng</h2>
        </div>
        {/* V80: đưa toàn bộ 13 ô thông tin đơn hàng lên 1 hàng (như yêu cầu). */}
        <div className="p-2.5">
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-[8fr_12.4fr_6.8fr_7.2fr_minmax(52px,5.6fr)_9.1fr_6.8fr_7.2fr_6.8fr_6.4fr_11.4fr_4.7fr_3.1fr]">
            <Field label="Mã đơn hàng" required invalid={invalidOrderInfoFields.has("orderCode")}><TextInput value={form.orderCode} onChange={(v) => setField("orderCode", v)} /></Field>
            <Field label="Trạng thái">
              {/* V91: trạng thái do nút Lưu quyết định — chỉ hiển thị để biết, không chọn tay. */}
              <span
                className={`erp-input flex items-center gap-1.5 font-semibold ${isProductionStatus(form.status) ? "text-emerald-700" : "text-slate-700"}`}
                title="Lưu nháp = Đơn hàng mẫu · Lưu đơn hàng = Sản xuất"
              >
                <span className={`inline-block h-1.5 w-1.5 shrink-0 rounded-full ${isProductionStatus(form.status) ? "bg-emerald-500" : "bg-slate-400"}`} />
                <span className="truncate">{orderStatusLabel(form.status)}</span>
              </span>
            </Field>
            <Field label="Ngày cập nhật" required invalid={invalidOrderInfoFields.has("excelUpdateDate")}><DateInput value={form.excelUpdateDate} onChange={(v) => setField("excelUpdateDate", v)} /></Field>
            <Field label="NVKD phụ trách" required invalid={invalidOrderInfoFields.has("salesEmployeeCode")}><TextInput value={form.salesEmployeeCode} onChange={(v) => setField("salesEmployeeCode", v)} /></Field>
            <Field label="Mã Đại Lý" required invalid={invalidOrderInfoFields.has("customerCode")}><DealerCodeSelect value={form.customerCode} options={optionValues.dealer} onChange={(v) => setField("customerCode", v)} /></Field>
            <Field label="Tên khách hàng" required invalid={invalidOrderInfoFields.has("customerName")}><TextInput value={form.customerName} onChange={(v) => setField("customerName", v)} /></Field>
            <Field label="Ngày đặt hàng" required invalid={invalidOrderInfoFields.has("orderDate")}><DateInput value={form.orderDate} onChange={(v) => setField("orderDate", v)} /></Field>
            <Field label="Ngày cần giao" title="Ngày cần giao hàng" required invalid={invalidOrderInfoFields.has("requiredDeliveryDate")}><DateInput value={form.requiredDeliveryDate} onChange={(v) => setField("requiredDeliveryDate", v)} /></Field>
            <Field label="Người nhận"><TextInput value={form.receiverName} onChange={(v) => setField("receiverName", v)} /></Field>
            <Field label="Số điện thoại" required invalid={invalidOrderInfoFields.has("receiverPhone")}><TextInput value={form.receiverPhone} onChange={(v) => setField("receiverPhone", v)} /></Field>
            <Field label="Địa chỉ nhận hàng" required invalid={invalidOrderInfoFields.has("receiverAddress")}><TextInput value={form.receiverAddress} onChange={(v) => setField("receiverAddress", v)} /></Field>
            <Field label="Vùng miền"><TextInput value={form.region} onChange={(v) => setField("region", v)} /></Field>
            <Field label="Số Km" title="Số Km giao hàng"><NumberInput value={form.deliveryKm} onChange={(v) => setField("deliveryKm", v)} /></Field>
          </div>
        </div>
      </section>

      <section className="erp-card overflow-hidden">
        <div className="flex flex-col gap-2 border-b border-slate-200 bg-white px-3 py-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-[14px] font-semibold text-slate-900">Chi tiết đơn hàng theo từng bộ cửa</h2>
            <p className="mt-0.5 text-[10px] text-slate-500">
              {form.items.length} bộ cửa · {detailCount} dòng phụ kiện · Tổng {formatMoney(totals.subtotal)}đ
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button className="rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50" type="button" onClick={collapseAllItems}>Thu gọn tất cả</button>
            <button className="rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50" type="button" onClick={expandAllItems}>Mở rộng tất cả</button>
            <Button onClick={addItem}>+ Thêm bộ cửa</Button>
          </div>
        </div>

        <div className="space-y-3 bg-slate-50 p-2.5">
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
              showSetNumber={setNumberVisible}
              collapsed={collapsedItems.has(item.clientId)}
              onToggleCollapse={() => toggleItemCollapsed(item.clientId)}
              canRemoveItem={form.items.length > 1}
              quantityDecimalPlaces={calculationConfig.decimalPlaces}
            />
          ))}
        </div>
      </section>

      <section className="grid gap-3 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="erp-card xl:col-start-2">
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

      <section className="sticky bottom-2 z-20 flex flex-col gap-2 rounded-lg border border-slate-300 bg-white/95 px-3 py-2 shadow-lg backdrop-blur md:flex-row md:items-center md:justify-between">
        <div className="flex min-w-0 flex-wrap items-center gap-1.5 text-[11px]">
          <span className="rounded-md bg-slate-900 px-2 py-1 font-semibold tabular-nums text-white">Cả đơn: {formatMoney(totals.subtotal)}đ</span>
          <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-slate-600">{form.items.length} bộ cửa</span>
          <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-slate-600">{detailCount} phụ kiện</span>
          <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 tabular-nums text-slate-600">Còn lại: {formatMoney(totals.deliveryPayment)}đ</span>
          {message ? <span className={message.type === "ok" ? "text-emerald-700" : "text-red-700"}>{message.text}</span> : null}
        </div>
        <div className="flex items-center gap-2">
          {/* V91: 2 hành động lưu — Lưu nháp giữ đơn ở trạng thái Đơn hàng mẫu, Lưu đơn hàng chuyển sang Sản xuất. */}
          <button
            className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-[12px] font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            type="button"
            disabled={busy}
            onClick={() => void save("DRAFT")}
            title="Lưu nháp — giữ đơn ở trạng thái Đơn hàng mẫu, sau đó mở trang chi tiết đơn"
          >
            {busy ? "Đang lưu..." : "Lưu nháp"}
          </button>
          <button
            className="rounded-md bg-cyan-600 px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-cyan-500 disabled:opacity-50"
            type="button"
            disabled={busy}
            onClick={() => void save("ORDER")}
            title="Lưu và chuyển đơn sang trạng thái Sản xuất"
          >
            {busy ? "Đang lưu..." : "Lưu đơn hàng"}
          </button>
        </div>
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
  showSetNumber,
  collapsed,
  onToggleCollapse,
  canRemoveItem,
  quantityDecimalPlaces,
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
  showSetNumber: boolean;
  collapsed: boolean;
  onToggleCollapse: () => void;
  canRemoveItem: boolean;
  quantityDecimalPlaces: number;
}) {
  const inferredGroup = catalogGroupForCode(doorCatalogItems, item.productCode) || catalogGroupFromText(doorGroups, item.productName);
  const [selectedGroup, setSelectedGroup] = useState(inferredGroup);
  const change = (key: keyof Omit<OrderItemForm, "clientId" | "lineNo" | "details">) => (value: string) => onChange(itemIndex, key, value);

  useEffect(() => {
    const group = catalogGroupForCode(doorCatalogItems, item.productCode) || catalogGroupFromText(doorGroups, item.productName);
    if (group && group !== selectedGroup) setSelectedGroup(group);
  }, [doorCatalogItems, doorGroups, item.productCode, item.productName, selectedGroup]);


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
  }

  return (
    <article className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <header className="flex flex-col gap-1.5 bg-slate-900 px-3 py-2 text-white lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <h3 className="text-[14px] font-semibold tracking-normal">Bộ cửa #{itemIndex + 1}{showSetNumber && item.setNo ? ` · Bộ số ${item.setNo}` : ""}</h3>
          <p className="mt-0.5 truncate text-[10px] font-normal text-slate-300">
            {item.productName || selectedGroup || "Chưa chọn sản phẩm"}{item.model || item.productCode ? ` · ${item.model || item.productCode}` : ""}
            {item.quantity ? ` · SL bộ ${item.quantity}` : ""}{collapsed && item.details.length ? ` · ${item.details.length} phụ kiện (đang thu gọn)` : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 lg:justify-end">
          <div className="mr-1 text-[17px] font-semibold tabular-nums text-white">{formatMoney(itemTotal)}đ</div>
          <button
            className="rounded-md border border-slate-600 bg-slate-800 px-2.5 py-1 text-[11px] font-medium hover:bg-slate-700"
            type="button"
            onClick={onToggleCollapse}
            aria-expanded={!collapsed}
            title={collapsed ? "Mở rộng bộ cửa" : "Thu gọn bộ cửa"}
          >
            {collapsed ? "▸ Mở rộng" : "▾ Thu gọn"}
          </button>
          <button className="rounded-md border border-slate-600 bg-slate-800 px-2.5 py-1 text-[11px] font-medium hover:bg-slate-700" type="button" onClick={() => onDuplicate(itemIndex)}>Nhân bản bộ</button>
          <button
            className="rounded-md border border-red-500/70 bg-red-900/60 px-2.5 py-1 text-[11px] font-medium text-red-50 hover:bg-red-800 disabled:cursor-not-allowed disabled:border-slate-700 disabled:bg-slate-800/60 disabled:text-slate-500"
            type="button"
            disabled={!canRemoveItem}
            title={canRemoveItem ? "Xóa bộ cửa này" : "Đơn hàng phải có ít nhất 1 bộ cửa"}
            onClick={() => onRemoveItem(itemIndex)}
          >
            Xóa
          </button>
        </div>
      </header>

      {collapsed ? (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 bg-white px-3 py-2 text-[11px] text-slate-600">
          <span>SL bộ: <b className="text-slate-900">{item.quantity || "—"}</b></span>
          <span>KH/Lượng: <b className="text-slate-900">{item.pricingQuantity ? formatPricingQuantityDisplay(item.pricingQuantity, quantityDecimalPlaces) : "—"}</b></span>
          <span>Đơn giá: <b className="text-slate-900">{formatMoney(numeric(item.unitPrice))}đ</b></span>
          <span>Ghi chú: <b className="text-slate-900">{item.note ? item.note.slice(0, 60) : "—"}</b></span>
        </div>
      ) : (
      <>
      <div className="p-2.5">
        {/* Full-view UI: 17 trường Bộ cửa trên 1 dòng; ẩn riêng Tên sản phẩm; không cuộn ngang. */}
        {/* V79: 17 ô Bộ cửa trên 1 hàng (theo yêu cầu), giữ style nhãn/ô nhập như mockup. */}
        <div>
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 lg:grid-cols-6 xl:grid-cols-[5.4fr_9.2fr_minmax(168px,15.2fr)_minmax(56px,3.9fr)_minmax(46px,3.9fr)_4.9fr_4.9fr_4.3fr_4.3fr_4.3fr_4.3fr_minmax(46px,4.3fr)_minmax(30px,3.3fr)_minmax(34px,3fr)_4.9fr_7.5fr_5.6fr]">
            <CardField label="Bộ số">
              {/* V75: Bộ số tự tăng dần, không nhập tay. Chỉ hiển thị số đã được tạo. */}
              <CardReadonlyValue
                value={showSetNumber ? item.setNo : ""}
                placeholder="Tự động"
                title={showSetNumber
                  ? (item.setNo ? `Bộ số ${item.setNo} do hệ thống cấp tự động` : "Bộ số sẽ được tạo tự động khi bấm Lưu đơn hàng")
                  : "Bộ số sẽ được tạo tự động khi bấm Lưu đơn hàng (trạng thái Sản xuất)"}
              />
            </CardField>
            <CardField label="Nhóm cửa">
              <CardSelectShell><GridGroupSelect value={selectedGroup} groups={doorGroups} placeholder="Chọn nhóm cửa" onChange={changeGroup} /></CardSelectShell>
            </CardField>
            <CardField label="Model">
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
            <CardField label="Ô thoáng"><CardSuggestionInput value={item.panelInfo} onChange={change("panelInfo")} items={optionValues.panel} /></CardField>
            <CardField label="Hướng mở"><CardSuggestionInput value={item.openingDirection} onChange={change("openingDirection")} items={optionValues.opening} /></CardField>
            <CardField label="Phào"><CardSuggestionInput value={item.trimDirection} onChange={change("trimDirection")} items={optionValues.trim} /></CardField>
            <CardField label="Màu sơn"><CardSuggestionInput value={item.paintColor} onChange={change("paintColor")} items={optionValues.color} /></CardField>
            <CardField label="Cao"><CardNumberInput value={item.heightMm} onChange={change("heightMm")} /></CardField>
            <CardField label="Rộng"><CardNumberInput value={item.widthMm} onChange={change("widthMm")} /></CardField>
            <CardField label="Khuôn"><CardNumberInput value={item.frameMm} onChange={change("frameMm")} /></CardField>
            <CardField label="TT Cao" title="Kích thước thông thủy - Cao"><CardNumberInput value={item.clearHeightMm} onChange={change("clearHeightMm")} /></CardField>
            <CardField label="TT Rộng" title="Kích thước thông thủy - Rộng"><CardNumberInput value={item.clearWidthMm} onChange={change("clearWidthMm")} /></CardField>
            <CardField label="SL bộ"><CardNumberInput value={item.quantity} onChange={change("quantity")} /></CardField>
            <CardField label="ĐVT"><CardInput value={item.unit} onChange={change("unit")} /></CardField>
            <CardField label="KH/L" title="KH/Lượng"><CardNumberInput value={item.pricingQuantity} onChange={change("pricingQuantity")} step="0.01" /></CardField>
            <CardField label="Đơn giá">
              <CardSelectShell><GridPriceInput value={item.unitPrice} onChange={change("unitPrice")} catalog={findCatalog(catalogItems, item.productCode)} /></CardSelectShell>
            </CardField>
            <CardField label="Thành tiền">
              <div className="flex h-8 min-w-0 items-center justify-end rounded-md border border-slate-200 bg-slate-50 px-1.5 text-[11.5px] font-semibold tabular-nums text-sky-900" title={`${formatMoney(lineAmount(item))}đ`}>
                {formatMoney(lineAmount(item))}đ
              </div>
            </CardField>
          </div>
        </div>

        {/* Ghi chú + ảnh tách riêng bên dưới dòng thông tin Bộ cửa. */}
        <div className="mt-2 grid grid-cols-1 gap-1.5 border-t border-slate-200 pt-2 lg:grid-cols-[minmax(0,1fr)_190px]">
          <CardField label="Ghi chú">
            <CardInput value={item.note} onChange={change("note")} placeholder="Nhập ghi chú kỹ thuật" />
          </CardField>
          {/* V109: 1 ô ảnh cho CẢ BỘ CỬA (dòng cửa + mọi dòng phụ kiện) — giống các bảng xem/xuất file.
              Dòng phụ kiện không có ô ảnh riêng; khi bộ cửa chưa có ảnh, hệ thống lấy ảnh phụ kiện
              đầu tiên (nếu có) để hiển thị ở bảng chi tiết và bản in. */}
          <CardField label="Hình ảnh SP (cả bộ cửa)">
            <div className="rounded-md border border-slate-200 bg-white">
              <ImageCell path={item.imagePath} onUpload={(file) => onUpload(file, itemIndex)} />
            </div>
            <p className="mt-1 text-[10px] leading-snug text-slate-500">Ảnh dùng cho cả bộ cửa này (gồm mọi phụ kiện / chi tiết bên dưới).</p>
          </CardField>
        </div>
      </div>

      <section className="border-t border-slate-200 bg-slate-50/60 p-2.5">
        <div className="mb-1.5 flex flex-wrap items-center justify-between gap-1.5">
          <h4 className="text-[13px] font-semibold tracking-normal text-slate-900">PHỤ KIỆN / CHI TIẾT CỦA BỘ CỬA ({item.details.length})</h4>
          <button className="rounded-md bg-cyan-600 px-2.5 py-1.5 text-[11px] font-semibold text-white shadow-sm hover:bg-cyan-500" type="button" onClick={() => onAddDetail(itemIndex)}>+ Thêm phụ kiện</button>
        </div>

        {item.details.length ? (
          <div className="space-y-1.5">
            {item.details.map((detail, detailIndex) => (
              <DetailMasterRow
                key={`${item.clientId}-detail-${detail.rowOrder}-${detailIndex}`}
                row={detail}
                itemIndex={itemIndex}
                detailIndex={detailIndex}
                onChange={onDetailChange}
                onRemove={removeDetail}
                catalogItems={catalogItems}
                accessoryCatalogItems={accessoryCatalogItems}
                accessoryGroups={accessoryGroups}
                onCatalogSelect={onDetailCatalogSelect}
              />
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-slate-300 bg-white px-3 py-3 text-center text-[11px] text-slate-500">Chưa có phụ kiện / chi tiết. Bấm “+ Thêm phụ kiện” để thêm dòng.</div>
        )}
      </section>
      </>
      )}
    </article>
  );
}

function DetailMasterRow({
  row,
  itemIndex,
  detailIndex,
  onChange,
  onRemove,
  catalogItems,
  accessoryCatalogItems,
  accessoryGroups,
  onCatalogSelect,
}: {
  row: OrderLineForm;
  itemIndex: number;
  detailIndex: number;
  onChange: (itemIndex: number, detailIndex: number, key: keyof OrderLineForm, value: string) => void;
  onRemove: (detailIndex: number) => void;
  catalogItems: CatalogItem[];
  accessoryCatalogItems: CatalogItem[];
  accessoryGroups: string[];
  onCatalogSelect: (itemIndex: number, detailIndex: number, item: CatalogItem) => void;
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
    <div className="rounded-lg border border-slate-200 bg-white px-2.5 py-2">
          {/* V77: bỏ min-width cứng — lưới co theo màn hình nên không còn thanh cuộn ngang. */}
          <div className="grid grid-cols-2 gap-1.5 md:grid-cols-4 xl:grid-cols-[8.6fr_35.3fr_4.2fr_4.2fr_4.2fr_3.6fr_7.9fr_7.2fr_8.2fr_12.9fr]">
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
            <CardField label="KH/Lượng"><CardNumberInput value={row.pricingQuantity} onChange={change("pricingQuantity")} step="0.01" /></CardField>
            <CardField label="Đơn giá"><CardSelectShell><GridPriceInput value={row.unitPrice} onChange={change("unitPrice")} catalog={findCatalog(catalogItems, row.productCode)} /></CardSelectShell></CardField>
            <CardField label="Thành tiền">
              <div className="flex h-8 min-w-0 items-center justify-end rounded-md border border-slate-200 bg-slate-50 px-1.5 text-[10px] font-semibold tabular-nums text-sky-900" title={`${formatMoney(lineAmount(row))}đ`}>
                {formatMoney(lineAmount(row))}đ
              </div>
            </CardField>
            <CardField label="Ghi chú">
              <div className="flex min-w-0 items-center gap-1">
                <div className="min-w-0 flex-1"><CardInput value={row.note} onChange={change("note")} placeholder="Nhập ghi chú..." /></div>
                <button className="h-8 shrink-0 rounded-md border border-red-200 bg-white px-2 text-[10px] font-semibold text-red-600 hover:bg-red-50" type="button" onClick={() => onRemove(detailIndex)}>Xóa</button>
              </div>
            </CardField>
          </div>
    </div>
  );
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

function CardField({ label, title, children, className = "", emphasized = false }: { label: string; title?: string; children: React.ReactNode; className?: string; emphasized?: boolean }) {
  return (
    <label className={`flex min-w-0 flex-col ${className}`}>
      {/* V78: khung nhãn trải đúng bằng bề ngang khung input bên dưới (theo mockup). */}
      <span
        className={`mb-1 flex h-[22px] w-full min-w-0 items-center rounded border px-1.5 text-[9px] font-semibold uppercase leading-[10px] ${emphasized ? "border-cyan-200 bg-cyan-50 text-cyan-700" : "border-slate-200 bg-slate-100 text-slate-600"}`}
        title={title ?? label}
      >
        <span className="line-clamp-2 min-w-0 break-words">{label}</span>
      </span>
      <div className={emphasized ? "rounded-md ring-1 ring-cyan-300" : ""}>{children}</div>
    </label>
  );
}

function CardSelectShell({ children }: { children: React.ReactNode }) {
  return <div className="min-h-8 overflow-hidden rounded-md border border-slate-300 bg-white focus-within:border-cyan-400 focus-within:ring-1 focus-within:ring-cyan-100">{children}</div>;
}

function CardInput({ value, onChange, placeholder, listId }: { value: string; onChange: (value: string) => void; placeholder?: string; listId?: string }) {
  return <input className="h-8 w-full min-w-0 rounded-md border border-slate-300 bg-white px-2 text-[11.5px] font-medium text-sky-900 placeholder:text-slate-400 outline-none transition focus:border-cyan-400 focus:ring-1 focus:ring-cyan-100" value={value} placeholder={placeholder} list={listId} onChange={(event) => onChange(event.target.value)} />;
}

/** V75: ô chỉ đọc cho Bộ số — hệ thống tự cấp, người dùng không nhập tay. */
function CardReadonlyValue({ value, title, placeholder = "—" }: { value: string; title?: string; placeholder?: string }) {
  return (
    <div
      className={`flex h-8 w-full min-w-0 items-center rounded-md border px-2 text-[11.5px] font-semibold tabular-nums ${value ? "border-sky-200 bg-sky-50 text-sky-900" : "border-dashed border-slate-300 bg-slate-100 text-slate-400"}`}
      title={title}
    >
      <span className={`truncate ${value ? "" : "text-[10px] font-normal italic"}`}>{value || placeholder}</span>
    </div>
  );
}

function CardSuggestionInput({ value, onChange, items, placeholder }: { value: string; onChange: (value: string) => void; items: MasterOption[]; placeholder?: string }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative min-w-0">
      <input
        className="h-8 w-full min-w-0 rounded-md border border-slate-300 bg-white px-2 pr-7 text-[11px] font-medium text-sky-900 outline-none transition placeholder:text-slate-400 focus:border-cyan-400 focus:ring-1 focus:ring-cyan-100"
        value={value}
        placeholder={placeholder}
        onChange={(event) => {
          onChange(event.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => window.setTimeout(() => setOpen(false), 120)}
        onKeyDown={(event) => {
          if (event.key === "Escape") setOpen(false);
          if (event.key === "ArrowDown") setOpen(true);
        }}
      />
      <button
        type="button"
        aria-label="Mở danh sách đề xuất"
        className="absolute inset-y-0 right-0 flex w-7 items-center justify-center text-[11px] font-bold text-cyan-700 hover:text-cyan-900"
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => setOpen((current) => !current)}
      >
        ▾
      </button>
      {open && items.length ? (
        <div className="absolute left-0 top-full z-[80] mt-1 max-h-52 min-w-full overflow-auto rounded-md border border-slate-200 bg-white py-1 shadow-xl">
          {items.map((option) => (
            <button
              key={`${option.groupCode}-${option.id}`}
              type="button"
              className={`flex w-full items-start gap-1.5 whitespace-nowrap px-2 py-1.5 text-left text-[11px] hover:bg-cyan-50 ${sameText(option.code, value) ? "bg-cyan-50 font-semibold text-cyan-800" : "text-slate-800"}`}
              onMouseDown={(event) => {
                event.preventDefault();
                onChange(option.code);
                setOpen(false);
              }}
            >
              <span className="font-semibold">{option.code}</span>
              {option.name && !sameText(option.name, option.code) ? <span className="text-slate-500">· {option.name}</span> : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function CardNumberInput({ value, onChange, step = "1", readOnly = false, autoCalculated = false }: { value: string; onChange: (value: string) => void; step?: string; readOnly?: boolean; autoCalculated?: boolean }) {
  const displayValue = autoCalculated && readOnly ? formatPricingQuantityDisplay(value, 2) : value;
  return (
    <input
      className={`h-8 w-full min-w-0 rounded-md border px-2 text-right text-[11.5px] font-semibold tabular-nums text-sky-900 outline-none transition ${readOnly ? "cursor-default border-sky-200 bg-sky-50" : "border-slate-300 bg-white focus:border-cyan-400 focus:ring-1 focus:ring-cyan-100"}`}
      type={autoCalculated && readOnly ? "text" : "number"}
      step={step}
      value={displayValue}
      readOnly={readOnly}
      title={autoCalculated ? `KH/Lượng tự động · Giá trị chính xác: ${value || "—"}` : undefined}
      onChange={(event) => onChange(event.target.value)}
    />
  );
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
      {/* V75: Bộ số do hệ thống tự cấp, chỉ hiển thị. */}
      <CellStatic>{item.setNo || ""}</CellStatic>
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
      {/* V75: Bộ số do hệ thống tự cấp, chỉ hiển thị. */}
      <CellStatic>{row.setNo || ""}</CellStatic>
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
      <Cell><GridNumber value={row.pricingQuantity} onChange={change("pricingQuantity")} step="0.01" /></Cell>
      <Cell><GridPriceInput value={row.unitPrice} onChange={change("unitPrice")} catalog={findCatalog(catalogItems, row.productCode)} /></Cell>
      <CellStatic>{formatMoney(lineAmount(row))}</CellStatic>
      <Cell><GridInput value={row.note} onChange={change("note")} /></Cell>
      <Cell><ImageCell path={row.imagePath} onUpload={(file) => onUpload(file, itemIndex, detailIndex)} /></Cell>
      <CellStatic><button className="text-red-600 hover:underline" type="button" onClick={() => onRemove(itemIndex, detailIndex)}>Xóa</button></CellStatic>
    </tr>
  );
}

type AutomaticRecalculationOptions = { applyDoorUnitPrice?: boolean };

function recalculateAutomaticPricingForm(form: OrderFormData, catalogItems: CatalogItem[], calculationConfig: CalculationConfig, options: AutomaticRecalculationOptions = {}) {
  let changed = false;
  const items = form.items.map((item) => {
    const next = recalculateAutomaticPricingQuantity(item, catalogItems, calculationConfig, options);
    if (next !== item) changed = true;
    return next;
  });
  return changed ? { ...form, items } : form;
}

function recalculateAutomaticPricingQuantity(item: OrderItemForm, catalogItems: CatalogItem[], calculationConfig: CalculationConfig, options: AutomaticRecalculationOptions = {}): OrderItemForm {
  let changed = false;
  let nextItem = item;
  const mainCatalog = findCatalog(catalogItems, item.productCode || item.model);
  const mainRule = resolveCalculationRule(calculationConfig, {
    scope: "MAIN",
    groupName: mainCatalog?.name || item.productName,
    itemCode: item.productCode || item.model,
  });

  const mainPricingQuantity = item.pricingManual === "1"
    ? null
    : calculatePricingQuantityByRule(mainRule.pricingRule, item, item);
  if (mainPricingQuantity !== null && item.pricingQuantity !== mainPricingQuantity) {
    nextItem = { ...nextItem, pricingQuantity: mainPricingQuantity, amount: "" };
    changed = true;
  }

  if (options.applyDoorUnitPrice && mainCatalog && calculationConfig.framePrice.enabled) {
    const baseDealerPrice = catalogDealerPriceNumber(mainCatalog);
    const frameMm = positiveNumber(nextItem.frameMm);
    const calculatedUnitPrice = baseDealerPrice === null
      ? null
      : calculateDoorUnitPrice(baseDealerPrice, frameMm, calculationConfig.framePrice);
    if (calculatedUnitPrice !== null) {
      const nextUnitPrice = formatUnitPrice(calculatedUnitPrice);
      if (nextItem.unitPrice !== nextUnitPrice) {
        nextItem = { ...nextItem, unitPrice: nextUnitPrice, amount: "" };
        changed = true;
      }
    }
  }

  const details = nextItem.details.map((detail) => {
    // V59: dòng đã nhập KH/Lượng bằng tay thì giữ nguyên.
    if (detail.pricingManual === "1") return detail;
    const catalog = findCatalog(catalogItems, detail.productCode || detail.model);
    const resolved = resolveCalculationRule(calculationConfig, {
      scope: "DETAIL",
      groupName: catalog?.name || detail.productName,
      itemCode: detail.productCode || detail.model,
      ...parentDoorTarget(nextItem, catalogItems),
    });
    const calculated = calculatePricingQuantityByRule(resolved.pricingRule, detail, nextItem);
    if (calculated === null || detail.pricingQuantity === calculated) return detail;
    changed = true;
    return { ...detail, pricingQuantity: calculated, amount: "" };
  });

  if (details.some((detail, index) => detail !== nextItem.details[index])) {
    nextItem = { ...nextItem, details };
  }

  return changed ? nextItem : item;
}

function calculatePricingQuantityByRule(
  rule: Exclude<PricingQuantityRule, "INHERIT">,
  line: Pick<OrderLineForm, "heightMm" | "widthMm">,
  parent: OrderItemForm,
): string | null {
  if (rule === "MANUAL") return null;

  if (rule === "DOOR_AREA") {
    const height = positiveNumber(line.heightMm);
    const width = positiveNumber(line.widthMm);
    if (height === null || width === null) return "";
    return formatPricingQuantityExact((height * width) / 1_000_000);
  }

  if (rule === "TRIM_LINEAR") {
    const height = positiveNumber(line.heightMm);
    const width = positiveNumber(line.widthMm);
    if (height === null && width === null) return "";
    return formatPricingQuantityExact(((height ?? 0) * 2 + (width ?? 0)) / 1000);
  }

  // V88: 3 công thức chiều dài chọn thêm (nhóm Phào/Phao và các nhóm tính theo mm).
  if (rule === "PERIMETER_LINEAR") {
    const height = positiveNumber(line.heightMm);
    const width = positiveNumber(line.widthMm);
    if (height === null && width === null) return "";
    return formatPricingQuantityExact((((height ?? 0) * 2) + (width ?? 0) * 2) / 1000);
  }

  if (rule === "DOUBLE_HEIGHT_LINEAR") {
    const height = positiveNumber(line.heightMm);
    if (height === null) return "";
    return formatPricingQuantityExact((height * 2) / 1000);
  }

  if (rule === "WIDTH_LINEAR") {
    const width = positiveNumber(line.widthMm);
    if (width === null) return "";
    return formatPricingQuantityExact(width / 1000);
  }

  if (rule === "PANEL_COUNT") return panelCountFromDoor(parent.panelInfo);

  const quantity = positiveNumber(parent.quantity);
  return quantity === null ? "" : formatPricingQuantityExact(quantity);
}

function panelCountFromDoor(panelInfo: string) {
  const match = String(panelInfo || "").trim().toUpperCase().match(/^(\d+)\s*TK\b/);
  if (!match) return "";
  const count = Number(match[1]);
  return Number.isFinite(count) && count > 0 ? String(count) : "";
}

function positiveNumber(value: string) {
  const normalized = String(value || "").trim().replace(",", ".");
  if (!normalized) return null;
  const number = Number(normalized);
  return Number.isFinite(number) && number > 0 ? number : null;
}

function formatPricingQuantityExact(value: number) {
  if (!Number.isFinite(value)) return "";
  // Giữ độ chính xác của công thức để Thành tiền dùng toàn bộ phần thập phân.
  // Các công thức hiện tại xuất phát từ kích thước mm nên tối đa chỉ cần vài chữ số thập phân.
  return Number(value.toFixed(12)).toString();
}

function formatPricingQuantityDisplay(value: string, decimalPlaces = 2) {
  const number = Number(String(value || "").replace(",", "."));
  if (!Number.isFinite(number)) return value;
  const places = Math.max(0, Math.min(4, Math.round(decimalPlaces)));
  return new Intl.NumberFormat("vi-VN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: places,
  }).format(number);
}

function applyAccessoryDimensionSuggestion(
  detail: OrderLineForm,
  parent: OrderItemForm,
  catalog: CatalogItem,
  calculationConfig: CalculationConfig,
  parentDoor: { parentGroupName: string; parentItemCode: string },
): OrderLineForm {
  const resolved = resolveCalculationRule(calculationConfig, {
    scope: "DETAIL",
    groupName: catalog.name,
    itemCode: catalog.code,
    ...parentDoor,
  });

  return {
    ...detail,
    heightMm: suggestedInputValue(resolved.heightSuggestion, detail.heightMm, parent),
    widthMm: suggestedInputValue(resolved.widthSuggestion, detail.widthMm, parent),
  };
}

function suggestedInputValue(
  rule: Exclude<InputSuggestionRule, "INHERIT">,
  currentValue: string,
  parent: OrderItemForm,
) {
  if (rule === "PARENT_HEIGHT") return String(parent.heightMm || "").trim();
  if (rule === "PARENT_WIDTH") return String(parent.widthMm || "").trim();
  if (rule === "CLEAR") return "";
  return currentValue;
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

function SectionTitle({ title }: { title: string }) { return <div className="border-b border-slate-200 bg-slate-50 px-3 py-1.5"><h2 className="text-[11px] font-semibold leading-4 text-slate-900">{title}</h2></div>; }
function Field({ label, title, children, required, invalid }: { label: string; title?: string; children: React.ReactNode; required?: boolean; invalid?: boolean }) {
  const invalidClass = invalid
    ? " [&_input]:border-red-500 [&_select]:border-red-500 [&_textarea]:border-red-500 [&_input]:ring-1 [&_select]:ring-1 [&_textarea]:ring-1 [&_input]:ring-red-200 [&_select]:ring-red-200 [&_textarea]:ring-red-200"
    : "";
  return (
    <label className={`flex min-w-0 flex-col${invalidClass} [&_.erp-input]:h-8 [&_.erp-input]:w-full [&_.erp-input]:rounded-md [&_.erp-input]:px-2 [&_.erp-input]:py-1 [&_.erp-input]:text-[12px] [&_.erp-input]:font-medium [&_.erp-input]:text-sky-900`}>
      <span
        className={`mb-1 flex h-[22px] w-full min-w-0 items-center rounded border px-1.5 text-[9px] font-semibold uppercase leading-[10px] ${invalid ? "border-red-200 bg-red-50 text-red-600" : "border-slate-200 bg-slate-100 text-slate-600"}`}
        title={title ?? label}
      >
        <span className="line-clamp-2 min-w-0 break-words">{label}{required ? " *" : ""}</span>
      </span>
      {children}
      {invalid ? <span className="mt-0.5 block text-[9px] font-medium text-red-600">Bắt buộc nhập</span> : null}
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
function GridInput({ value, onChange, listId }: { value: string; onChange: (value: string) => void; listId?: string }) { return <input className="h-9 w-full min-w-0 border-0 bg-transparent px-2.5 text-[12px] font-medium text-sky-900 outline-none transition-colors focus:bg-cyan-50 focus:ring-1 focus:ring-inset focus:ring-cyan-300" list={listId} value={value} onChange={(e) => onChange(e.target.value)} />; }

function GridReadOnly({ value, placeholder }: { value: string; placeholder?: string }) {
  return <div className="min-h-9 w-full bg-slate-50 px-2.5 py-2 text-[12px] text-slate-700">{value || <span className="text-slate-400">{placeholder ?? "—"}</span>}</div>;
}

function GridGroupSelect({ value, groups, placeholder, onChange }: { value: string; groups: string[]; placeholder: string; onChange: (value: string) => void }) {
  return (
    <select className="h-8 w-full min-w-0 border-0 bg-transparent px-2 text-[11px] font-medium text-sky-900 outline-none transition-colors focus:bg-cyan-50 focus:ring-1 focus:ring-inset focus:ring-cyan-300" value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">{placeholder}</option>
      {groups.map((group) => <option key={group} value={group}>{group}</option>)}
    </select>
  );
}

function GridCatalogSelect({ value, currentLabel, items, display, placeholder, disabled, onCatalogSelect }: { value: string; currentLabel?: string; items: CatalogItem[]; display: "description" | "model"; placeholder: string; disabled?: boolean; onCatalogSelect: (item: CatalogItem) => void }) {
  const hasCurrent = items.some((item) => sameText(item.code, value));
  // V80: ô đã chọn hiện đầy đủ "MODEL · tên diễn giải"; tooltip giữ nguyên nội dung khi cột còn hẹp.
  const currentItem = items.find((item) => sameText(item.code, value));
  const selectedLabel = currentItem
    ? (display === "description" ? catalogProductName(currentItem) : `${currentItem.code} · ${catalogProductName(currentItem)}`)
    : (currentLabel ? `${currentLabel} · dữ liệu cũ` : placeholder);
  return (
    <select
      className="h-8 w-full min-w-0 border-0 bg-transparent px-2 text-[11px] font-medium text-sky-900 outline-none transition-colors focus:bg-cyan-50 focus:ring-1 focus:ring-inset focus:ring-cyan-300 disabled:bg-slate-100 disabled:text-slate-400"
      value={value}
      title={selectedLabel}
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
  // Đơn hàng chỉ dùng giá Đại lý từ Master Data. Không fallback sang giá Bán lẻ.
  if (item.dealerPrice !== null && item.dealerPrice !== undefined && String(item.dealerPrice).trim() !== "") return String(item.dealerPrice);
  return fallback;
}

function catalogDealerPriceNumber(item: CatalogItem) {
  if (item.dealerPrice === null || item.dealerPrice === undefined || String(item.dealerPrice).trim() === "") return null;
  const value = Number(item.dealerPrice);
  return Number.isFinite(value) ? value : null;
}

function formatUnitPrice(value: number) {
  return Number.isInteger(value) ? String(value) : String(Math.round(value * 100) / 100);
}

function findCatalog(items: CatalogItem[], code: string) {
  const normalized = code.trim().toLocaleLowerCase("vi");
  if (!normalized) return undefined;
  return items.find((item) => item.code.trim().toLocaleLowerCase("vi") === normalized);
}

/**
 * V89: xác định “bộ cửa chính” (cửa cha) của một dòng phụ kiện chi tiết để lọc rule theo loại cửa.
 * Nhóm hàng lấy từ Danh mục hàng hóa theo model của cửa; nếu không tra được thì lấy tên hàng trên đơn.
 */
function parentDoorTarget(parent: OrderItemForm, catalogItems: CatalogItem[]) {
  const catalog = findCatalog(catalogItems, parent.productCode || parent.model);
  return {
    parentGroupName: catalog?.name || parent.productName,
    parentItemCode: parent.productCode || parent.model,
  };
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
  return <input className="h-8 w-full min-w-0 border-0 bg-transparent px-2 text-[11px] font-medium text-sky-900 outline-none transition-colors focus:bg-cyan-50 focus:ring-1 focus:ring-inset focus:ring-cyan-300" list={listId} value={value} onChange={(e) => { onChange(e.target.value); resolve(e.target.value); }} onBlur={(e) => resolve(e.target.value)} />;
}
function GridNumber({ value, onChange, step = "1" }: { value: string; onChange: (value: string) => void; step?: string }) { return <input className="h-8 w-full min-w-0 border-0 bg-transparent px-2 text-right text-[11px] font-semibold tabular-nums text-sky-900 outline-none transition-colors focus:bg-cyan-50 focus:ring-1 focus:ring-inset focus:ring-cyan-300" type="number" step={step} value={value} onChange={(e) => onChange(e.target.value)} />; }
function GridPriceInput({ value, onChange }: { value: string; onChange: (value: string) => void; catalog?: CatalogItem }) {
  return <input className="h-8 w-full min-w-0 border-0 bg-transparent px-2 text-right text-[11px] font-semibold tabular-nums text-sky-900 outline-none transition-colors focus:bg-cyan-50 focus:ring-1 focus:ring-inset focus:ring-cyan-300" type="number" step="1" value={value} onChange={(e) => onChange(e.target.value)} />;
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
      className="flex min-h-[58px] cursor-default flex-col items-center justify-center gap-1 rounded-md px-1 py-1.5 text-center text-[10px] leading-tight outline-none transition-colors focus:bg-cyan-50 focus:ring-1 focus:ring-inset focus:ring-cyan-400"
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
