"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  DEFAULT_CALCULATION_CONFIG,
  cloneCalculationConfig,
  normalizeLookup,
  type CalculationConfig,
  type CalculationRule,
  type CalculationScope,
  type InputSuggestionRule,
  type PricingQuantityRule,
} from "@/lib/calculation-config";
import {
  SettingsBadge,
  SettingsCard,
  SettingsNote,
  SettingsSectionHeader,
  SettingsTable,
} from "@/components/settings/settings-ui";

type CatalogItem = {
  code: string;
  name: string;
  productDescription: string | null;
  active: boolean;
};

type ApiResponse = {
  ok: boolean;
  config?: CalculationConfig;
  source?: "saved" | "suggested";
  error?: string;
};

const PRICING_OPTIONS: Array<{ value: PricingQuantityRule; label: string }> = [
  { value: "INHERIT", label: "Kế thừa cấu hình Nhóm" },
  { value: "MANUAL", label: "Nhập tay" },
  { value: "DOOR_AREA", label: "Cao × Rộng / 1.000.000" },
  { value: "TRIM_LINEAR", label: "(Cao × 2 + Rộng) / 1.000" },
  // V88: 3 công thức chọn thêm cho KH/Lượng (nhóm Phào/Phao và các nhóm tính theo mm).
  { value: "PERIMETER_LINEAR", label: "(Cao × 2 + Rộng × 2) / 1.000" },
  { value: "DOUBLE_HEIGHT_LINEAR", label: "Cao × 2 / 1.000" },
  { value: "WIDTH_LINEAR", label: "Rộng / 1.000" },
  // V85: rút gọn nhãn để không bị cắt trong bảng rule ở màn hẹp (1TK/2TK/3TK/4TK đã có ở khối ví dụ bên dưới).
  { value: "PANEL_COUNT", label: "Theo số TK ô thoáng" },
  { value: "PARENT_QUANTITY", label: "Theo SL bộ cửa cha" },
];

const INPUT_OPTIONS: Array<{ value: InputSuggestionRule; label: string }> = [
  { value: "INHERIT", label: "Kế thừa" },
  { value: "KEEP", label: "Nhập tay / giữ nguyên" },
  { value: "PARENT_HEIGHT", label: "Cao của cửa" },
  { value: "PARENT_WIDTH", label: "Rộng của cửa" },
  { value: "CLEAR", label: "Để trống" },
];

const SCOPE_OPTIONS: Array<{ value: CalculationScope; label: string }> = [
  { value: "MAIN", label: "Bộ cửa chính" },
  { value: "GROUP", label: "Theo nhóm hàng" },
  { value: "ITEM", label: "Theo Model / hàng hóa" },
];

/** V76: khối B1 của tab CẤU HÌNH — quy tắc tính KH/Lượng, đơn giá và Bộ số. */
export function CalculationConfigEditor() {
  const [config, setConfig] = useState<CalculationConfig>(() => cloneCalculationConfig(DEFAULT_CALCULATION_CONFIG));
  const [catalogItems, setCatalogItems] = useState<CatalogItem[]>([]);
  const [source, setSource] = useState<"saved" | "suggested">("suggested");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "error"; text: string } | null>(null);

  const load = useCallback(async (defaults = false) => {
    setBusy(true);
    setMessage(null);
    try {
      const [configResponse, itemsResponse] = await Promise.all([
        fetch(`/api/calculation-config${defaults ? "?defaults=true" : ""}`, { cache: "no-store" }),
        fetch("/api/items?active=true&limit=3000", { cache: "no-store" }),
      ]);
      const configResult = await configResponse.json() as ApiResponse;
      const itemsResult = await itemsResponse.json() as { ok: boolean; items?: CatalogItem[]; error?: string };
      if (!configResponse.ok || !configResult.ok || !configResult.config) throw new Error(configResult.error || "Không thể tải cấu hình.");
      if (!itemsResponse.ok || !itemsResult.ok) throw new Error(itemsResult.error || "Không thể tải Danh mục hàng hóa.");
      setConfig(configResult.config);
      setSource(configResult.source ?? "suggested");
      setCatalogItems(itemsResult.items ?? []);
      if (defaults) setMessage({ type: "ok", text: "Đã tạo lại cấu hình gợi ý từ Danh mục hàng hóa. Bấm Lưu cấu hình để áp dụng." });
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Không thể tải cấu hình." });
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => { void load(false); }, [load]);

  const groups = useMemo(
    () => Array.from(new Set(catalogItems.map((item) => item.name.trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b, "vi")),
    [catalogItems],
  );

  const activeRuleCount = useMemo(() => config.rules.filter((rule) => rule.active).length, [config.rules]);

  async function save() {
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch("/api/calculation-config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config }),
      });
      const result = await response.json() as ApiResponse;
      if (!response.ok || !result.ok || !result.config) throw new Error(result.error || "Không thể lưu cấu hình.");
      setConfig(result.config);
      setSource("saved");
      setMessage({ type: "ok", text: "Đã lưu cấu hình. Màn Tạo/Sửa đơn hàng sẽ dùng cấu hình này ngay." });
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Không thể lưu cấu hình." });
    } finally {
      setBusy(false);
    }
  }

  function addRule() {
    setConfig((current) => ({
      ...current,
      rules: [...current.rules, newRule()],
    }));
  }

  function patchRule(index: number, patch: Partial<CalculationRule>) {
    setConfig((current) => ({
      ...current,
      rules: current.rules.map((rule, ruleIndex) => ruleIndex === index ? { ...rule, ...patch } : rule),
    }));
  }

  function removeRule(index: number) {
    setConfig((current) => ({ ...current, rules: current.rules.filter((_, ruleIndex) => ruleIndex !== index) }));
  }

  function patchFramePrice(patch: Partial<CalculationConfig["framePrice"]>) {
    setConfig((current) => ({ ...current, framePrice: { ...current.framePrice, ...patch } }));
  }

  function patchSetNumberStart(value: number) {
    setConfig((current) => ({ ...current, setNumberStart: Math.max(1, Math.round(Number.isFinite(value) ? value : 1)) }));
  }

  return (
    <div className="space-y-4">
      <SettingsSectionHeader
        code="B1"
        title="Cấu hình tính toán"
        description="Quy tắc tính KH/Lượng, phụ thu theo Khuôn, đơn giá cửa và số bắt đầu Bộ số. Thay đổi chỉ áp dụng cho đơn lưu sau khi bấm Lưu cấu hình."
        actions={
          <>
            <span className={`erp-hint mr-1 ${source === "saved" ? "text-emerald-700" : "text-amber-700"}`}>
              {source === "saved" ? "● Cấu hình đã lưu" : "○ Đang dùng gợi ý từ Danh mục hàng hóa"}
            </span>
            <button className="erp-button-secondary" type="button" disabled={busy} onClick={() => void load(true)}>Tạo lại cấu hình gợi ý</button>
            <button className="erp-button-secondary" type="button" onClick={addRule}>+ Thêm rule</button>
            <button className="erp-button" type="button" disabled={busy} onClick={() => void save()}>{busy ? "Đang xử lý..." : "Lưu cấu hình"}</button>
          </>
        }
      />

      {message ? <SettingsNote tone={message.type === "ok" ? "success" : "danger"}>{message.text}</SettingsNote> : null}

      <SettingsNote tone="info" title="Thứ tự áp dụng">
        Cấu hình <b>Model / hàng hóa</b> ưu tiên cao nhất, sau đó đến <b>Nhóm hàng</b>. Nếu không có rule thì KH/Lượng nhập tay.
        Đề xuất Cao/Rộng chỉ điền khi chọn hàng hóa; người dùng vẫn sửa lại bằng tay được. KH/Lượng tự động được làm tròn theo số chữ số bên dưới.
        Đơn giá Bộ cửa lấy <b>Giá đại lý</b> từ Danh mục hàng hóa và có thể tự cộng phụ thu theo độ dày Khuôn.
      </SettingsNote>

      <SettingsCard
        title="Thông số chung"
        description="Áp dụng cho mọi đơn hàng tạo mới hoặc chỉnh sửa sau khi lưu."
      >
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <label className="block">
            <span className="erp-field-label">Làm tròn KH/Lượng</span>
            <select className="erp-input" value={config.decimalPlaces} onChange={(event) => setConfig((current) => ({ ...current, decimalPlaces: Number(event.target.value) }))}>
              {[0, 1, 2, 3, 4].map((value) => <option key={value} value={value}>{value} chữ số thập phân</option>)}
            </select>
            <span className="erp-hint mt-1 block">Chỉ ảnh hưởng cách hiển thị; tiền vẫn tính trên giá trị chính xác.</span>
          </label>
          <label className="block">
            <span className="erp-field-label">Số bắt đầu áp dụng Bộ số</span>
            <input
              className="erp-input text-right font-semibold tabular-nums text-sky-900"
              type="number"
              min="1"
              step="1"
              value={config.setNumberStart}
              onChange={(event) => patchSetNumberStart(Number(event.target.value))}
            />
            <span className="erp-hint mt-1 block">Số nhỏ nhất được dùng. Hệ thống vẫn cấp tiếp nếu dữ liệu cũ đã có số lớn hơn.</span>
          </label>
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
            <div className="erp-field-label">Cơ chế Bộ số</div>
            <ul className="space-y-1 text-[12px] leading-5 text-slate-600">
              <li>• Đơn <b>Nháp</b> / <b>Chờ khách hàng xác nhận</b>: chưa có Bộ số.</li>
              <li>• Chuyển sang <b>Đã xác nhận</b>: hệ thống cấp Bộ số tự động, tăng dần.</li>
              <li>• Sang <b>Đã chuyển sản xuất</b> hoặc <b>Đã hủy</b>: giữ nguyên Bộ số.</li>
            </ul>
          </div>
        </div>
      </SettingsCard>

      <SettingsCard
        title="Tự động tính Đơn giá cửa theo Khuôn"
        description="Giá gốc = Giá đại lý của Model cửa trong Danh mục hàng hóa. Hệ thống làm tròn Khuôn trước rồi cộng phụ thu."
        actions={
          <label className="inline-flex items-center gap-2 text-[12.5px] font-semibold text-slate-700">
            <input type="checkbox" className="h-4 w-4" checked={config.framePrice.enabled} onChange={(event) => patchFramePrice({ enabled: event.target.checked })} />
            Bật tự động tính giá
          </label>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <NumberSetting label="Làm tròn Khuôn về nấc (mm)" value={config.framePrice.roundToMm} onChange={(value) => patchFramePrice({ roundToMm: value })} />
          <NumberSetting label="Khuôn thường tiêu chuẩn đến (mm)" value={config.framePrice.standardMaxMm} onChange={(value) => patchFramePrice({ standardMaxMm: value })} />
          <NumberSetting label="Khuôn kép bắt đầu từ (mm)" value={config.framePrice.doubleMinMm} onChange={(value) => patchFramePrice({ doubleMinMm: value })} />
          <NumberSetting label="Khuôn kép cố định đến (mm)" value={config.framePrice.doubleMaxMm} onChange={(value) => patchFramePrice({ doubleMaxMm: value })} />
          <NumberSetting label="Mỗi nấc tăng (mm)" value={config.framePrice.stepMm} onChange={(value) => patchFramePrice({ stepMm: value })} />
          <NumberSetting label="Phụ thu / nấc khuôn thường (đ/m²)" value={config.framePrice.normalStepSurcharge} onChange={(value) => patchFramePrice({ normalStepSurcharge: value })} />
          <NumberSetting label="Phụ thu cố định khuôn kép (đ/m²)" value={config.framePrice.doubleSurcharge} onChange={(value) => patchFramePrice({ doubleSurcharge: value })} />
          <NumberSetting label="Phụ thu / nấc trên khuôn kép (đ/m²)" value={config.framePrice.overDoubleStepSurcharge} onChange={(value) => patchFramePrice({ overDoubleStepSurcharge: value })} />
        </div>
        <div className="mt-3">
          <SettingsNote tone="info" title="Mốc phụ thu đang áp dụng">
            <b>≤ {config.framePrice.standardMaxMm} mm = +0</b>; mỗi {config.framePrice.stepMm} mm vượt mốc cộng <b>{formatNumber(config.framePrice.normalStepSurcharge)} đ</b>;
            {" "}<b>{config.framePrice.doubleMinMm}–{config.framePrice.doubleMaxMm} mm = +{formatNumber(config.framePrice.doubleSurcharge)} đ</b>;
            {" "}trên {config.framePrice.doubleMaxMm} mm cộng tiếp <b>{formatNumber(config.framePrice.overDoubleStepSurcharge)} đ</b> mỗi {config.framePrice.stepMm} mm.
          </SettingsNote>
        </div>
      </SettingsCard>

      <section className="erp-card">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 px-3.5 py-2">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="erp-subsection-title">Rule tính KH/Lượng &amp; đề xuất nhập liệu</h3>
            <SettingsBadge tone="cyan">{config.rules.length} rule</SettingsBadge>
            <SettingsBadge tone="emerald">{activeRuleCount} đang dùng</SettingsBadge>
          </div>
          <button className="erp-button-secondary" type="button" onClick={addRule}>+ Thêm rule</button>
        </div>
        <SettingsTable>
          <thead>
            <tr>
              <th className="w-[12%]">Áp dụng cho</th>
              <th className="w-[9%]">Nhóm hàng</th>
              <th className="w-[10%]">Model / hàng hóa</th>
              {/* V89: điều kiện bộ cửa chính — cùng một phụ kiện nhưng khác loại cửa cha thì khác công thức. */}
              <th className="w-[13%]">Bộ cửa chính</th>
              <th className="w-[15%]">Cách tính KH/Lượng</th>
              <th className="w-[12%]">Đề xuất Cao</th>
              <th className="w-[12%]">Đề xuất Rộng</th>
              <th className="w-[10%]">Ghi chú</th>
              <th className="w-[3%] text-center">Dùng</th>
              <th className="w-[4%]"></th>
            </tr>
          </thead>
          <tbody>
            {config.rules.map((rule, index) => {
              const filteredItems = rule.groupName
                ? catalogItems.filter((item) => normalizeLookup(item.name) === normalizeLookup(rule.groupName))
                : catalogItems;
              // V89: danh sách model của bộ cửa chính khi rule đã giới hạn theo nhóm hàng của cửa cha.
              const parentGroupItems = rule.parentGroupName
                ? catalogItems.filter((item) => normalizeLookup(item.name) === normalizeLookup(rule.parentGroupName))
                : [];
              return (
                <tr key={rule.id} className={rule.active ? "bg-white" : "bg-slate-50 text-slate-500"}>
                  <td>
                    <select className="erp-cell-input" title={SCOPE_OPTIONS.find((option) => option.value === rule.scope)?.label ?? ""} value={rule.scope} onChange={(event) => {
                      const scope = event.target.value as CalculationScope;
                      patchRule(index, {
                        scope,
                        groupName: scope === "MAIN" ? "" : rule.groupName,
                        itemCode: scope === "ITEM" ? rule.itemCode : "",
                        parentGroupName: scope === "MAIN" ? "" : rule.parentGroupName,
                        parentItemCode: scope === "MAIN" ? "" : rule.parentItemCode,
                        pricingRule: scope === "MAIN" && rule.pricingRule === "INHERIT" ? "DOOR_AREA" : rule.pricingRule,
                      });
                    }}>
                      {SCOPE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                    </select>
                  </td>
                  <td>
                    {rule.scope === "MAIN" ? <span className="text-[12px] text-slate-400">—</span> : (
                      <select className="erp-cell-input" title={rule.groupName || "Chọn nhóm hàng"} value={rule.groupName} onChange={(event) => patchRule(index, { groupName: event.target.value, itemCode: rule.scope === "ITEM" ? "" : rule.itemCode })}>
                        <option value="">Chọn nhóm hàng</option>
                        {rule.groupName && !groups.some((group) => normalizeLookup(group) === normalizeLookup(rule.groupName)) ? <option value={rule.groupName}>{rule.groupName} (cũ)</option> : null}
                        {groups.map((group) => <option key={group} value={group}>{group}</option>)}
                      </select>
                    )}
                  </td>
                  <td>
                    {rule.scope !== "ITEM" ? (
                      <span className="text-[12px] text-slate-400">{rule.scope === "GROUP" ? "Tất cả Model trong nhóm" : "—"}</span>
                    ) : (
                      <select className="erp-cell-input" title={rule.itemCode || "Chọn Model / hàng hóa"} value={rule.itemCode} onChange={(event) => {
                        const item = catalogItems.find((candidate) => candidate.code === event.target.value);
                        patchRule(index, { itemCode: event.target.value, groupName: item?.name ?? rule.groupName });
                      }}>
                        <option value="">Chọn Model / hàng hóa</option>
                        {rule.itemCode && !catalogItems.some((item) => item.code === rule.itemCode) ? <option value={rule.itemCode}>{rule.itemCode} (cũ)</option> : null}
                        {filteredItems.map((item) => <option key={item.code} value={item.code}>{item.code}{item.productDescription ? ` · ${item.productDescription}` : ""}</option>)}
                      </select>
                    )}
                  </td>
                  {/* V89: chỉ áp dụng cho rule của dòng phụ kiện chi tiết (Theo nhóm hàng / Theo Model). */}
                  <td>
                    {rule.scope === "MAIN" ? (
                      <span className="text-[12px] text-slate-400">—</span>
                    ) : (
                      <div className="flex flex-col gap-1">
                        <select
                          className="erp-cell-input"
                          title={rule.parentGroupName ? `Chỉ khi bộ cửa chính thuộc nhóm: ${rule.parentGroupName}` : "Áp dụng cho mọi bộ cửa chính"}
                          value={rule.parentGroupName}
                          onChange={(event) => patchRule(index, { parentGroupName: event.target.value, parentItemCode: "" })}
                        >
                          <option value="">Mọi bộ cửa</option>
                          {rule.parentGroupName && !groups.some((group) => normalizeLookup(group) === normalizeLookup(rule.parentGroupName)) ? <option value={rule.parentGroupName}>{rule.parentGroupName} (cũ)</option> : null}
                          {groups.map((group) => <option key={group} value={group}>{group}</option>)}
                        </select>
                        {rule.parentGroupName ? (
                          <select
                            className="erp-cell-input"
                            title={rule.parentItemCode || "Mọi model trong nhóm"}
                            value={rule.parentItemCode}
                            onChange={(event) => patchRule(index, { parentItemCode: event.target.value })}
                          >
                            <option value="">Mọi model trong nhóm</option>
                            {rule.parentItemCode && !parentGroupItems.some((item) => item.code === rule.parentItemCode) ? <option value={rule.parentItemCode}>{rule.parentItemCode} (cũ)</option> : null}
                            {parentGroupItems.map((item) => <option key={item.code} value={item.code}>{item.code}{item.productDescription ? ` · ${item.productDescription}` : ""}</option>)}
                          </select>
                        ) : null}
                      </div>
                    )}
                  </td>
                  <td><RuleSelect value={rule.pricingRule} options={PRICING_OPTIONS} onChange={(value) => patchRule(index, { pricingRule: value as PricingQuantityRule })} /></td>
                  <td><RuleSelect value={rule.heightSuggestion} options={INPUT_OPTIONS} onChange={(value) => patchRule(index, { heightSuggestion: value as InputSuggestionRule })} /></td>
                  <td><RuleSelect value={rule.widthSuggestion} options={INPUT_OPTIONS} onChange={(value) => patchRule(index, { widthSuggestion: value as InputSuggestionRule })} /></td>
                  <td>
                    {/* V85: Ghi chú là chuỗi dài → dùng textarea để tự xuống dòng, hiện đủ nội dung trong cột hẹp. */}
                    <textarea
                      className="erp-cell-input"
                      rows={2}
                      title={rule.note}
                      value={rule.note}
                      onChange={(event) => patchRule(index, { note: event.target.value })}
                    />
                  </td>
                  <td className="text-center">
                    <input className="h-4 w-4" type="checkbox" checked={rule.active} onChange={(event) => patchRule(index, { active: event.target.checked })} />
                  </td>
                  <td>
                    <button className="rounded-md px-2 py-1 text-[12px] font-semibold text-red-600 hover:bg-red-50" type="button" onClick={() => removeRule(index)}>Xóa</button>
                  </td>
                </tr>
              );
            })}
            {config.rules.length === 0 ? <tr><td className="px-3 py-8 text-center text-slate-500" colSpan={10}>Chưa có rule tính toán.</td></tr> : null}
          </tbody>
        </SettingsTable>
        {/* V89: giải thích cột mới — cùng một phụ kiện nhưng khác loại cửa cha thì khác công thức. */}
        <div className="px-3.5 pb-3.5 pt-1">
          <SettingsNote tone="info" title="Cột “Bộ cửa chính”">
            Để trống = áp dụng cho <b>mọi bộ cửa</b>. Chọn nhóm hàng (và model nếu cần) khi cùng một phụ kiện
            dùng công thức khác nhau theo loại cửa — ví dụ <b>Phào rời của cửa sổ</b> và <b>Phào rời của cửa đi</b> dùng
            2 rule khác nhau. Cột này chỉ áp dụng cho rule <b>Theo nhóm hàng</b> và <b>Theo Model / hàng hóa</b>.
          </SettingsNote>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <Example title="Nhóm cửa" value="Cao × Rộng / 1.000.000" />
        <Example title="Phào / Phao" value="(Cao × 2 + Rộng) / 1.000" />
        <Example title="Ô thoáng" value="4TK → 4; 3TK → 3; 2TK → 2; 1TK → 1" />
        <Example title="Khóa" value="Theo SL bộ cửa cha" />
        <Example title="Bộ số" value="Tự tăng dần, tạo khi đơn Đã xác nhận" />
      </section>
    </div>
  );
}

function NumberSetting({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return (
    <label className="block">
      <span className="mb-1 block min-h-8 text-[11px] font-semibold uppercase leading-4 tracking-wide text-slate-500">{label}</span>
      <input className="erp-input text-right font-semibold tabular-nums text-sky-900" type="number" min="0" step="1" value={value} onChange={(event) => onChange(Number(event.target.value))} />
    </label>
  );
}

function RuleSelect({ value, options, onChange }: { value: string; options: Array<{ value: string; label: string }>; onChange: (value: string) => void }) {
  // V85: title = nhãn đang chọn, để ở màn hẹp (cột hẹp nên chữ bị cắt) vẫn xem được đầy đủ khi rê chuột.
  const label = options.find((option) => option.value === value)?.label ?? "";
  return <select className="erp-cell-input" title={label} value={value} onChange={(event) => onChange(event.target.value)}>{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>;
}

function Example({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3.5">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{title}</div>
      <div className="mt-1.5 text-[13px] font-semibold text-sky-900">{value}</div>
    </div>
  );
}

function formatNumber(value: number) {
  return Number.isFinite(value) ? new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 0 }).format(value) : String(value);
}

function newRule(): CalculationRule {
  return {
    id: typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `rule-${Date.now()}`,
    scope: "GROUP",
    groupName: "",
    itemCode: "",
    parentGroupName: "",
    parentItemCode: "",
    pricingRule: "MANUAL",
    heightSuggestion: "KEEP",
    widthSuggestion: "KEEP",
    active: true,
    note: "",
  };
}
