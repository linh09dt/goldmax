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
  { value: "PANEL_COUNT", label: "Theo Ô thoáng 1TK/2TK/3TK" },
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

  return <div className="space-y-4">
    <section className="rounded-xl border border-cyan-200 bg-cyan-50 px-4 py-3 text-sm text-slate-700">
      <div className="font-semibold text-cyan-900">Logic áp dụng</div>
      <div className="mt-1 leading-6">
        Cấu hình <b>Model / hàng hóa</b> ưu tiên cao nhất, sau đó đến <b>Nhóm hàng</b>. Nếu không có rule thì KH/Lượng nhập tay.
        Đề xuất Cao/Rộng chỉ điền khi chọn hàng hóa; người dùng vẫn có thể sửa lại bằng tay. KH/Lượng tự động được làm tròn theo số chữ số bên dưới.
      </div>
    </section>

    {message ? <div className={`rounded-lg border px-4 py-3 text-sm ${message.type === "ok" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-red-200 bg-red-50 text-red-700"}`}>{message.text}</div> : null}

    <section className="erp-card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 px-4 py-3">
        <div>
          <h2 className="font-semibold">Thiết lập chung</h2>
          <p className="mt-0.5 text-xs text-slate-500">Nguồn hiện tại: {source === "saved" ? "Cấu hình đã lưu" : "Cấu hình gợi ý từ Danh mục hàng hóa"}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="erp-button-secondary" type="button" disabled={busy} onClick={() => void load(true)}>Tạo lại cấu hình gợi ý</button>
          <button className="erp-button-secondary" type="button" onClick={addRule}>+ Thêm rule</button>
          <button className="erp-button" type="button" disabled={busy} onClick={() => void save()}>{busy ? "Đang xử lý..." : "Lưu cấu hình"}</button>
        </div>
      </div>
      <div className="flex items-end gap-3 p-4">
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-slate-600">Làm tròn KH/Lượng</span>
          <select className="erp-input w-48" value={config.decimalPlaces} onChange={(event) => setConfig((current) => ({ ...current, decimalPlaces: Number(event.target.value) }))}>
            {[0, 1, 2, 3, 4].map((value) => <option key={value} value={value}>{value} chữ số thập phân</option>)}
          </select>
        </label>
      </div>
    </section>

    <section className="erp-card overflow-hidden">
      <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
        <h2 className="font-semibold">Rule tính KH/Lượng & đề xuất input</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1500px] text-sm">
          <thead className="bg-slate-900 text-left text-[11px] uppercase text-slate-200">
            <tr>
              <th className="px-3 py-2">Áp dụng cho</th>
              <th className="px-3 py-2">Nhóm hàng</th>
              <th className="px-3 py-2">Model / hàng hóa</th>
              <th className="px-3 py-2">Cách tính KH/Lượng</th>
              <th className="px-3 py-2">Đề xuất Cao</th>
              <th className="px-3 py-2">Đề xuất Rộng</th>
              <th className="px-3 py-2">Ghi chú</th>
              <th className="px-3 py-2">Dùng</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 bg-white">
            {config.rules.map((rule, index) => {
              const filteredItems = rule.groupName
                ? catalogItems.filter((item) => normalizeLookup(item.name) === normalizeLookup(rule.groupName))
                : catalogItems;
              return <tr key={rule.id} className="align-top">
                <td className="px-2 py-2">
                  <select className="erp-input min-w-40" value={rule.scope} onChange={(event) => {
                    const scope = event.target.value as CalculationScope;
                    patchRule(index, {
                      scope,
                      groupName: scope === "MAIN" ? "" : rule.groupName,
                      itemCode: scope === "ITEM" ? rule.itemCode : "",
                      pricingRule: scope === "MAIN" && rule.pricingRule === "INHERIT" ? "DOOR_AREA" : rule.pricingRule,
                    });
                  }}>
                    {SCOPE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                </td>
                <td className="px-2 py-2">
                  {rule.scope === "MAIN" ? <span className="inline-flex h-9 items-center text-xs text-slate-400">—</span> : <select className="erp-input min-w-52" value={rule.groupName} onChange={(event) => patchRule(index, { groupName: event.target.value, itemCode: rule.scope === "ITEM" ? "" : rule.itemCode })}>
                    <option value="">Chọn nhóm hàng</option>
                    {rule.groupName && !groups.some((group) => normalizeLookup(group) === normalizeLookup(rule.groupName)) ? <option value={rule.groupName}>{rule.groupName} (cũ)</option> : null}
                    {groups.map((group) => <option key={group} value={group}>{group}</option>)}
                  </select>}
                </td>
                <td className="px-2 py-2">
                  {rule.scope !== "ITEM" ? <span className="inline-flex h-9 items-center text-xs text-slate-400">{rule.scope === "GROUP" ? "Tất cả Model trong nhóm" : "—"}</span> : <select className="erp-input min-w-72" value={rule.itemCode} onChange={(event) => {
                    const item = catalogItems.find((candidate) => candidate.code === event.target.value);
                    patchRule(index, { itemCode: event.target.value, groupName: item?.name ?? rule.groupName });
                  }}>
                    <option value="">Chọn Model / hàng hóa</option>
                    {rule.itemCode && !catalogItems.some((item) => item.code === rule.itemCode) ? <option value={rule.itemCode}>{rule.itemCode} (cũ)</option> : null}
                    {filteredItems.map((item) => <option key={item.code} value={item.code}>{item.code}{item.productDescription ? ` · ${item.productDescription}` : ""}</option>)}
                  </select>}
                </td>
                <td className="px-2 py-2"><RuleSelect value={rule.pricingRule} options={PRICING_OPTIONS} onChange={(value) => patchRule(index, { pricingRule: value as PricingQuantityRule })} /></td>
                <td className="px-2 py-2"><RuleSelect value={rule.heightSuggestion} options={INPUT_OPTIONS} onChange={(value) => patchRule(index, { heightSuggestion: value as InputSuggestionRule })} /></td>
                <td className="px-2 py-2"><RuleSelect value={rule.widthSuggestion} options={INPUT_OPTIONS} onChange={(value) => patchRule(index, { widthSuggestion: value as InputSuggestionRule })} /></td>
                <td className="px-2 py-2"><input className="erp-input min-w-72" value={rule.note} onChange={(event) => patchRule(index, { note: event.target.value })} /></td>
                <td className="px-2 py-2 text-center"><input className="mt-2 h-4 w-4" type="checkbox" checked={rule.active} onChange={(event) => patchRule(index, { active: event.target.checked })} /></td>
                <td className="px-2 py-2"><button className="mt-1 rounded-md px-2 py-1 text-xs font-semibold text-red-600 hover:bg-red-50" type="button" onClick={() => removeRule(index)}>Xóa</button></td>
              </tr>;
            })}
            {config.rules.length === 0 ? <tr><td className="px-4 py-10 text-center text-slate-500" colSpan={9}>Chưa có rule tính toán.</td></tr> : null}
          </tbody>
        </table>
      </div>
    </section>

    <section className="grid gap-3 lg:grid-cols-2 xl:grid-cols-4">
      <Example title="Nhóm cửa" value="Cao × Rộng / 1.000.000" />
      <Example title="Phào / Phao" value="(Cao × 2 + Rộng) / 1.000" />
      <Example title="Ô thoáng" value="3TK → 3; 2TK → 2; 1TK → 1" />
      <Example title="Khóa" value="Theo SL bộ cửa cha" />
    </section>
  </div>;
}

function RuleSelect({ value, options, onChange }: { value: string; options: Array<{ value: string; label: string }>; onChange: (value: string) => void }) {
  return <select className="erp-input min-w-60" value={value} onChange={(event) => onChange(event.target.value)}>{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>;
}

function Example({ title, value }: { title: string; value: string }) {
  return <div className="rounded-xl border border-slate-200 bg-white p-4"><div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</div><div className="mt-2 text-sm font-semibold text-sky-900">{value}</div></div>;
}

function newRule(): CalculationRule {
  return {
    id: typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `rule-${Date.now()}`,
    scope: "GROUP",
    groupName: "",
    itemCode: "",
    pricingRule: "MANUAL",
    heightSuggestion: "KEEP",
    widthSuggestion: "KEEP",
    active: true,
    note: "",
  };
}
