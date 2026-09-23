"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

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

const GROUPS: Array<{ code: GroupCode; label: string }> = [
  { code: "PAINT_COLOR", label: "Màu sơn" },
  { code: "OPENING_DIRECTION", label: "Hướng mở" },
  { code: "TRIM_DIRECTION", label: "Hướng phào" },
  { code: "PANEL_OPTION", label: "Ô thoáng / Pano / Nan chớp" },
  { code: "DEALER_CODE", label: "Mã Đại Lý" },
];

export function MasterOptions() {
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

  const filtered = useMemo(() => items.filter((item) => item.groupCode === group), [items, group]);
  const currentLabel = GROUPS.find((item) => item.code === group)?.label ?? group;

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

  return <div className="space-y-6">
    {message ? <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm">{message}</div> : null}

    <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
      {GROUPS.map((item) => <button key={item.code} type="button" onClick={() => setGroup(item.code)} className={`rounded-xl border p-4 text-left ${group === item.code ? "border-cyan-500 bg-cyan-50" : "border-slate-200 bg-white"}`}>
        <div className="font-semibold">{item.label}</div>
        <div className="mt-1 text-sm text-slate-500">{items.filter((row) => row.groupCode === item.code && row.active).length} đang sử dụng</div>
      </button>)}
    </section>

    <section className="erp-card">
      <div className="border-b border-slate-200 bg-slate-50 px-5 py-4"><h2 className="font-bold">Thêm {currentLabel}</h2></div>
      <div className="grid gap-3 p-5 md:grid-cols-[1fr_1fr_160px_140px]">
        <input className="erp-input" placeholder="Mã / giá trị" value={newCode} onChange={(e) => setNewCode(e.target.value)} />
        <input className="erp-input" placeholder="Tên hiển thị" value={newName} onChange={(e) => setNewName(e.target.value)} />
        <input className="erp-input" type="number" placeholder="Thứ tự" value={newSort} onChange={(e) => setNewSort(e.target.value)} />
        <button className="erp-button" type="button" onClick={() => void add()}>+ Thêm</button>
      </div>
    </section>

    <section className="erp-card overflow-hidden">
      <div className="border-b border-slate-200 bg-slate-50 px-5 py-4"><h2 className="font-bold">{currentLabel}</h2></div>
      <div className="overflow-x-auto">
        <table className="min-w-[900px] w-full text-sm">
          <thead className="bg-slate-900 text-left text-xs uppercase text-slate-200"><tr><th className="px-4 py-3">Mã</th><th className="px-4 py-3">Tên hiển thị</th><th className="px-4 py-3">Thứ tự</th><th className="px-4 py-3">Nguồn</th><th className="px-4 py-3">Trạng thái</th><th className="px-4 py-3">Thao tác</th></tr></thead>
          <tbody className="divide-y divide-slate-200 bg-white">
            {filtered.map((item) => <OptionEditor key={item.id} item={item} onSave={update} onDelete={item.groupCode === "DEALER_CODE" ? remove : undefined} />)}
            {filtered.length === 0 ? <tr><td colSpan={6} className="px-4 py-10 text-center text-slate-500">Chưa có dữ liệu.</td></tr> : null}
          </tbody>
        </table>
      </div>
    </section>
  </div>;
}

function OptionEditor({ item, onSave, onDelete }: { item: OptionRow; onSave: (item: OptionRow, patch: Partial<OptionRow>) => Promise<void>; onDelete?: (item: OptionRow) => Promise<void> }) {
  const [code, setCode] = useState(item.code);
  const [name, setName] = useState(item.name);
  const [sortOrder, setSortOrder] = useState(String(item.sortOrder));
  useEffect(() => { setCode(item.code); setName(item.name); setSortOrder(String(item.sortOrder)); }, [item]);
  return <tr>
    <td className="px-4 py-3"><input className="erp-input min-w-40" value={code} onChange={(e) => setCode(e.target.value)} /></td>
    <td className="px-4 py-3"><input className="erp-input min-w-64" value={name} onChange={(e) => setName(e.target.value)} /></td>
    <td className="px-4 py-3"><input className="erp-input w-24" type="number" value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} /></td>
    <td className="px-4 py-3"><div>{item.source === "EXCEL_DON_GIA" ? "Excel đơn giá" : "Thủ công"}</div>{item.lastSourceFile ? <div className="mt-1 text-xs text-slate-500">{item.lastSourceFile}</div> : null}</td>
    <td className="px-4 py-3"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${item.active ? "bg-emerald-100 text-emerald-800" : "bg-slate-200 text-slate-600"}`}>{item.active ? "Đang sử dụng" : "Ngưng sử dụng"}</span></td>
    <td className="px-4 py-3"><div className="flex gap-3"><button className="text-cyan-700 hover:underline" type="button" onClick={() => void onSave(item, { code, name, sortOrder: Number(sortOrder) || 0 })}>Lưu</button><button className="text-amber-700 hover:underline" type="button" onClick={() => void onSave(item, { active: !item.active })}>{item.active ? "Ngưng dùng" : "Kích hoạt"}</button>{onDelete ? <button className="text-red-700 hover:underline" type="button" onClick={() => void onDelete(item)}>Xóa</button> : null}</div></td>
  </tr>;
}
