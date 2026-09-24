"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  SettingsBadge,
  SettingsCard,
  SettingsNote,
  SettingsSectionHeader,
  SettingsTable,
} from "@/components/settings/settings-ui";

type GroupCode = "PANEL_OPTION" | "OPENING_DIRECTION" | "TRIM_DIRECTION" | "PAINT_COLOR" | "DEALER_CODE";
type OptionRow = {
  id: number;
  groupCode: GroupCode;
  code: string;
  name: string;
  sortOrder: number;
  active: boolean;
  source: string;
  lastSourceFile: string | null;
};

const GROUPS: Array<{ code: GroupCode; label: string; hint: string }> = [
  { code: "PAINT_COLOR", label: "Màu sơn", hint: "Mã màu dùng ở cột Màu sơn của bộ cửa" },
  { code: "OPENING_DIRECTION", label: "Hướng mở", hint: "Trái / phải / trong / ngoài…" },
  { code: "TRIM_DIRECTION", label: "Hướng phào", hint: "Phào thuận / nghịch" },
  { code: "PANEL_OPTION", label: "Ô thoáng / Pano / Nan chớp", hint: "Quy cách ô thoáng, ví dụ 1TK / 2TK" },
  { code: "DEALER_CODE", label: "Mã Đại Lý", hint: "Danh mục mã đại lý dùng khi lập đơn" },
];

/** V76: khối A2 của tab CẤU HÌNH — Danh mục cấu hình (thuộc tính chọn trong đơn). */
export function MasterOptions({ onSummary }: { onSummary?: (text: string) => void } = {}) {
  const [items, setItems] = useState<OptionRow[]>([]);
  const [group, setGroup] = useState<GroupCode>("PAINT_COLOR");
  const [message, setMessage] = useState("");
  const [newCode, setNewCode] = useState("");
  const [newName, setNewName] = useState("");
  const [newSort, setNewSort] = useState("0");

  const load = useCallback(async () => {
    const response = await fetch("/api/master-options", { cache: "no-store" });
    const result = await response.json() as { ok: boolean; items?: OptionRow[]; error?: string };
    if (!response.ok || !result.ok) throw new Error(result.error || "Không thể tải danh mục cấu hình.");
    setItems(result.items ?? []);
  }, []);

  useEffect(() => { void load().catch((error) => setMessage(error instanceof Error ? error.message : "Không thể tải dữ liệu.")); }, [load]);

  useEffect(() => {
    onSummary?.(`${items.length} giá trị`);
  }, [items.length, onSummary]);

  const filtered = useMemo(() => items.filter((item) => item.groupCode === group), [items, group]);
  const currentGroup = GROUPS.find((item) => item.code === group) ?? GROUPS[0];
  const currentLabel = currentGroup.label;
  const activeInGroup = filtered.filter((item) => item.active).length;

  async function add() {
    setMessage("");
    const response = await fetch("/api/master-options", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ groupCode: group, code: newCode, name: newName || newCode, sortOrder: newSort, active: true }),
    });
    const result = await response.json() as { ok: boolean; error?: string };
    if (!response.ok || !result.ok) { setMessage(result.error || "Không thể thêm giá trị."); return; }
    setNewCode(""); setNewName(""); setNewSort("0"); setMessage("Đã thêm giá trị mới."); await load();
  }

  async function update(item: OptionRow, patch: Partial<OptionRow>) {
    const next = { ...item, ...patch };
    const response = await fetch(`/api/master-options/${item.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ groupCode: next.groupCode, code: next.code, name: next.name, sortOrder: next.sortOrder, active: next.active }),
    });
    const result = await response.json() as { ok: boolean; error?: string };
    if (!response.ok || !result.ok) { setMessage(result.error || "Không thể cập nhật."); return; }
    setMessage("Đã cập nhật danh mục cấu hình."); await load();
  }

  async function remove(item: OptionRow) {
    if (item.groupCode !== "DEALER_CODE") return;
    if (!window.confirm(`Xóa Mã Đại Lý '${item.code}' khỏi danh mục? Dữ liệu đã lưu trong đơn hàng cũ không bị thay đổi.`)) return;
    setMessage("");
    const response = await fetch(`/api/master-options/${item.id}`, { method: "DELETE" });
    const result = await response.json() as { ok: boolean; error?: string };
    if (!response.ok || !result.ok) { setMessage(result.error || "Không thể xóa Mã Đại Lý."); return; }
    setMessage("Đã xóa Mã Đại Lý khỏi danh mục cấu hình.");
    await load();
  }

  return (
    <div className="space-y-4">
      <SettingsSectionHeader
        code="A2"
        title="Danh mục cấu hình"
        description="Các danh mục nhỏ dùng để chọn nhanh khi lập đơn. Giá trị đã dùng trong đơn cũ vẫn giữ nguyên khi ngưng sử dụng."
      />

      <div className="erp-card">
        <div className="erp-scrollbar flex items-stretch gap-2 overflow-x-auto p-2">
          {GROUPS.map((item) => {
            const active = group === item.code;
            const total = items.filter((row) => row.groupCode === item.code).length;
            const activeRows = items.filter((row) => row.groupCode === item.code && row.active).length;
            return (
              <button
                key={item.code}
                type="button"
                onClick={() => setGroup(item.code)}
                aria-current={active ? "true" : undefined}
                className={`min-w-[188px] shrink-0 rounded-lg border px-3 py-2 text-left transition ${
                  active ? "border-cyan-400 bg-cyan-50" : "border-slate-200 bg-white hover:bg-slate-50"
                }`}
              >
                <span className={`block text-[12.5px] font-semibold ${active ? "text-cyan-900" : "text-slate-800"}`}>{item.label}</span>
                <span className="mt-0.5 block text-[10.5px] text-slate-500">
                  {activeRows} đang dùng{total !== activeRows ? ` / ${total} giá trị` : ""}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {message ? <SettingsNote tone={message.includes("Không thể") ? "danger" : "success"}>{message}</SettingsNote> : null}

      <SettingsCard title={`Thêm ${currentLabel}`} description={currentGroup.hint} bodyClassName="p-3">
        <div className="grid gap-2.5 md:grid-cols-[1fr_1fr_140px_auto]">
          <label className="block">
            <span className="erp-field-label">Mã / giá trị</span>
            <input className="erp-input" placeholder="Mã hoặc giá trị" value={newCode} onChange={(e) => setNewCode(e.target.value)} />
          </label>
          <label className="block">
            <span className="erp-field-label">Tên hiển thị</span>
            <input className="erp-input" placeholder="Để trống sẽ lấy bằng Mã" value={newName} onChange={(e) => setNewName(e.target.value)} />
          </label>
          <label className="block">
            <span className="erp-field-label">Thứ tự</span>
            <input className="erp-input" type="number" value={newSort} onChange={(e) => setNewSort(e.target.value)} />
          </label>
          <div className="flex items-end">
            <button className="erp-button h-[38px] w-full whitespace-nowrap" type="button" onClick={() => void add()}>+ Thêm giá trị</button>
          </div>
        </div>
      </SettingsCard>

      <section className="erp-card">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 px-3.5 py-2">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="erp-subsection-title">{currentLabel}</h3>
            <SettingsBadge tone="cyan">{filtered.length} giá trị</SettingsBadge>
            <SettingsBadge tone="emerald">{activeInGroup} đang sử dụng</SettingsBadge>
          </div>
          <p className="erp-hint">Sửa trực tiếp trên bảng rồi bấm Lưu từng dòng.</p>
        </div>
        <SettingsTable minWidthClass="min-w-[1000px]">
          <thead>
            <tr>
              <th className="min-w-40">Mã</th>
              <th>Tên hiển thị</th>
              <th className="w-28 text-right">Thứ tự</th>
              <th className="w-40">Nguồn</th>
              <th className="w-36">Trạng thái</th>
              <th className="w-64">Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((item) => (
              <OptionEditor key={item.id} item={item} onSave={update} onDelete={item.groupCode === "DEALER_CODE" ? remove : undefined} />
            ))}
            {filtered.length === 0 ? <tr><td colSpan={6} className="px-3 py-8 text-center text-slate-500">Chưa có giá trị nào trong nhóm này.</td></tr> : null}
          </tbody>
        </SettingsTable>
      </section>
    </div>
  );
}

function OptionEditor({ item, onSave, onDelete }: { item: OptionRow; onSave: (item: OptionRow, patch: Partial<OptionRow>) => Promise<void>; onDelete?: (item: OptionRow) => Promise<void> }) {
  const [code, setCode] = useState(item.code);
  const [name, setName] = useState(item.name);
  const [sortOrder, setSortOrder] = useState(String(item.sortOrder));
  useEffect(() => { setCode(item.code); setName(item.name); setSortOrder(String(item.sortOrder)); }, [item]);
  return (
    <tr className={item.active ? "bg-white" : "bg-slate-50 text-slate-500"}>
      <td><input className="w-full rounded-md border border-slate-300 px-2 py-1 text-[12.5px] font-semibold text-sky-900" value={code} onChange={(e) => setCode(e.target.value)} /></td>
      <td><input className="w-full min-w-64 rounded-md border border-slate-300 px-2 py-1 text-[12.5px]" value={name} onChange={(e) => setName(e.target.value)} /></td>
      <td className="erp-td-num"><input className="w-20 rounded-md border border-slate-300 px-2 py-1 text-right text-[12.5px] tabular-nums" type="number" value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} /></td>
      <td>
        <div className="text-[12.5px]">{item.source === "EXCEL_DON_GIA" ? "Excel đơn giá" : "Thủ công"}</div>
        {item.lastSourceFile ? <div className="mt-0.5 truncate text-[10.5px] text-slate-500" title={item.lastSourceFile}>{item.lastSourceFile}</div> : null}
      </td>
      <td>
        <SettingsBadge tone={item.active ? "emerald" : "slate"}>{item.active ? "Đang sử dụng" : "Ngưng sử dụng"}</SettingsBadge>
      </td>
      <td>
        <div className="flex flex-wrap gap-3 text-[12.5px]">
          <button className="font-semibold text-sky-700 hover:text-sky-900" type="button" onClick={() => void onSave(item, { code, name, sortOrder: Number(sortOrder) || 0 })}>Lưu</button>
          <button className="font-semibold text-amber-700 hover:text-amber-900" type="button" onClick={() => void onSave(item, { active: !item.active })}>{item.active ? "Ngưng dùng" : "Kích hoạt"}</button>
          {onDelete ? <button className="font-semibold text-red-600 hover:text-red-800" type="button" onClick={() => void onDelete(item)}>Xóa</button> : null}
        </div>
      </td>
    </tr>
  );
}
