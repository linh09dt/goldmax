"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  SettingsBadge,
  SettingsCard,
  SettingsNote,
  SettingsSectionHeader,
  SettingsTable,
} from "@/components/settings/settings-ui";
import {
  categoryToneAt,
  normalizeCategoryRows,
  type ItemCategoryRow,
} from "@/lib/item-category";

type CategoryRow = ItemCategoryRow & { itemCount?: number };

const cellInputClass = "erp-cell-input";

/**
 * V135 — Tab Cấu hình / A3: PHÂN LOẠI HÀNG HÓA.
 *
 * Trước đây 3 phân loại (Cấp cửa / Phụ kiện / Chi phí gia công) bị hard-code trong code.
 * Nay là dữ liệu của bảng `item_categories`: thêm / đổi tên / đổi cách dùng / đổi thứ tự / xoá
 * ngay tại đây. Mã phân loại KHÔNG đổi khi đổi tên nên hàng hóa giữ nguyên phân loại.
 */
export function ItemCategories({ onSummary }: { onSummary?: (text: string) => void } = {}) {
  const [rows, setRows] = useState<CategoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [message, setMessage] = useState<{ type: "ok" | "error"; text: string } | null>(null);

  // Sửa tại chỗ
  const [drafts, setDrafts] = useState<Record<number, { name: string; usage: string; separateGroup: boolean; sortOrder: number }>>({});
  // Xoá: phân loại còn hàng thì phải chọn nơi chuyển
  const [deleting, setDeleting] = useState<{ row: CategoryRow; moveTo: string } | null>(null);

  // Thêm mới
  const [newName, setNewName] = useState("");
  const [newUsage, setNewUsage] = useState("DETAIL");
  const [newSeparate, setNewSeparate] = useState(false);
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/item-categories", { cache: "no-store" });
      const result = await response.json() as { ok: boolean; categories?: CategoryRow[]; error?: string };
      if (!response.ok || !result.ok) throw new Error(result.error || "Không thể tải phân loại hàng hóa.");
      const list = normalizeCategoryRows(result.categories).map((row) => ({
        ...row,
        itemCount: (result.categories ?? []).find((entry) => entry.code === row.code)?.itemCount ?? 0,
      }));
      setRows(list);
      setDrafts(Object.fromEntries(list.map((row) => [row.id ?? 0, { name: row.name, usage: row.usage, separateGroup: row.separateGroup, sortOrder: row.sortOrder }])));
    } catch (error) {
      setRows(normalizeCategoryRows(null));
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Không thể tải phân loại hàng hóa." });
    } finally {
      setLoading(false);
    }
  }, []);

  // Hoãn 1 nhịp để không gọi setState đồng bộ ngay trong effect (tránh cascading render).
  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);
  useEffect(() => { onSummary?.(`${rows.length} phân loại`); }, [rows.length, onSummary]);

  const totalItems = useMemo(() => rows.reduce((sum, row) => sum + (row.itemCount ?? 0), 0), [rows]);
  const replacements = useMemo(() => rows.filter((row) => row.id !== deleting?.row.id), [rows, deleting]);

  function patchDraft(id: number | undefined, patch: Partial<{ name: string; usage: string; separateGroup: boolean; sortOrder: number }>) {
    if (typeof id !== "number") return;
    setDrafts((current) => ({ ...current, [id]: { ...current[id], ...patch } }));
  }

  async function saveRow(row: CategoryRow) {
    if (typeof row.id !== "number") return;
    const draft = drafts[row.id];
    if (!draft) return;
    setBusyId(row.id);
    setMessage(null);
    try {
      const response = await fetch(`/api/item-categories/${row.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: draft.name,
          usage: draft.usage,
          separateGroup: draft.separateGroup,
          sortOrder: draft.sortOrder,
        }),
      });
      const result = await response.json() as { ok: boolean; error?: string };
      if (!response.ok || !result.ok) throw new Error(result.error || "Không thể lưu phân loại.");
      setMessage({ type: "ok", text: `Đã lưu phân loại "${draft.name}".` });
      await load();
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Không thể lưu phân loại." });
    } finally {
      setBusyId(null);
    }
  }

  async function toggleActive(row: CategoryRow) {
    if (typeof row.id !== "number") return;
    setBusyId(row.id);
    setMessage(null);
    try {
      const response = await fetch(`/api/item-categories/${row.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !row.active }),
      });
      const result = await response.json() as { ok: boolean; error?: string };
      if (!response.ok || !result.ok) throw new Error(result.error || "Không thể đổi trạng thái.");
      setMessage({ type: "ok", text: row.active ? `Đã ngưng dùng "${row.name}".` : `Đã dùng lại "${row.name}".` });
      await load();
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Không thể đổi trạng thái." });
    } finally {
      setBusyId(null);
    }
  }

  async function confirmDelete(row: CategoryRow, moveTo?: string) {
    if (typeof row.id !== "number") return;
    setBusyId(row.id);
    setMessage(null);
    try {
      const query = moveTo ? `?moveTo=${encodeURIComponent(moveTo)}` : "";
      const response = await fetch(`/api/item-categories/${row.id}${query}`, { method: "DELETE" });
      const result = await response.json() as { ok: boolean; error?: string; movedItems?: number };
      if (!response.ok || !result.ok) throw new Error(result.error || "Không thể xoá phân loại.");
      setMessage({
        type: "ok",
        text: result.movedItems
          ? `Đã xoá "${row.name}" và chuyển ${result.movedItems} hàng hóa sang phân loại khác.`
          : `Đã xoá "${row.name}".`,
      });
      setDeleting(null);
      await load();
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Không thể xoá phân loại." });
    } finally {
      setBusyId(null);
    }
  }

  function startDelete(row: CategoryRow) {
    if ((row.itemCount ?? 0) > 0) {
      setDeleting({ row, moveTo: replacements[0]?.code ?? "" });
      return;
    }
    if (!window.confirm(`Xoá phân loại "${row.name}"?`)) return;
    void confirmDelete(row);
  }

  async function addCategory() {
    setAdding(true);
    setMessage(null);
    try {
      const response = await fetch("/api/item-categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName, usage: newUsage, separateGroup: newSeparate }),
      });
      const result = await response.json() as { ok: boolean; category?: { code: string }; error?: string };
      if (!response.ok || !result.ok) throw new Error(result.error || "Không thể thêm phân loại.");
      setMessage({ type: "ok", text: `Đã thêm phân loại "${newName}" (mã ${result.category?.code ?? ""}).` });
      setNewName("");
      setNewSeparate(false);
      setNewUsage("DETAIL");
      await load();
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Không thể thêm phân loại." });
    } finally {
      setAdding(false);
    }
  }

  return (
    <div className="space-y-4">
      <SettingsSectionHeader
        title="Phân loại hàng hóa"
        description="Áp cho tab A1 và form tạo đơn: phân loại quyết định hàng hóa nào dùng làm bộ cửa (dòng chính), hàng nào là dòng phụ kiện / chi tiết."
      />

      {message ? <SettingsNote tone={message.type === "ok" ? "success" : "danger"}>{message.text}</SettingsNote> : null}

      <SettingsCard
        title="Thêm phân loại"
        description="Mã được sinh tự động từ tên; đổi tên sau này không làm thay đổi hàng hóa đã gán."
        bodyClassName="p-3"
      >
        <div className="grid gap-2.5 md:grid-cols-2 xl:grid-cols-[1.6fr_1fr_1fr_auto]">
          <label className="block">
            <span className="erp-field-label">Tên phân loại</span>
            <input className="erp-input" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Ví dụ: Kính, Phụ phí vận chuyển..." />
          </label>
          <label className="block">
            <span className="erp-field-label">Dùng cho</span>
            <select className="erp-input" value={newUsage} onChange={(e) => setNewUsage(e.target.value)}>
              <option value="DETAIL">Dòng phụ kiện / chi tiết</option>
              <option value="MAIN">Dòng chính (bộ cửa)</option>
            </select>
          </label>
          <label className="flex items-end gap-2 pb-2">
            <input type="checkbox" className="h-4 w-4" checked={newSeparate} disabled={newUsage === "MAIN"} onChange={(e) => setNewSeparate(e.target.checked)} />
            <span className="text-[12px] text-slate-700">Nhóm riêng trong ô “Nhóm hàng”</span>
          </label>
          <div className="flex items-end">
            <button className="erp-button h-[38px] w-full whitespace-nowrap disabled:opacity-50" disabled={adding || !newName.trim()} onClick={() => void addCategory()}>
              {adding ? "Đang thêm..." : "+ Thêm phân loại"}
            </button>
          </div>
        </div>
      </SettingsCard>

      {deleting ? (
        <SettingsNote tone="warning" title={`Phân loại "${deleting.row.name}" còn ${deleting.row.itemCount ?? 0} hàng hóa`}>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <span>Chuyển số hàng hóa đó sang:</span>
            <select className="erp-input h-8 w-56" value={deleting.moveTo} onChange={(e) => setDeleting({ ...deleting, moveTo: e.target.value })}>
              {replacements.map((row) => <option key={row.code} value={row.code}>{row.name}</option>)}
            </select>
            <button className="erp-button h-8" disabled={!deleting.moveTo || busyId === deleting.row.id} onClick={() => void confirmDelete(deleting.row, deleting.moveTo)}>
              Chuyển hàng &amp; xoá phân loại
            </button>
            <button className="erp-button-secondary h-8" onClick={() => setDeleting(null)}>Huỷ</button>
          </div>
        </SettingsNote>
      ) : null}

      <section className="erp-card">
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-slate-50 px-3.5 py-2.5">
          <h3 className="erp-subsection-title">Danh mục phân loại</h3>
          <SettingsBadge tone="cyan">{rows.length} phân loại</SettingsBadge>
          <SettingsBadge>{totalItems} hàng hóa</SettingsBadge>
        </div>
        <SettingsTable>
          <thead>
            <tr>
              <th className="w-[6%]">STT</th>
              <th className="w-[13%]">Mã</th>
              <th className="w-[24%]">Tên phân loại</th>
              <th className="w-[18%]">Dùng cho</th>
              <th className="w-[14%]">Nhóm riêng</th>
              <th className="w-[7%] text-right">Thứ tự</th>
              <th className="w-[9%] text-center">Hàng hóa</th>
              <th className="w-[9%]">Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} className="px-3 py-8 text-center text-slate-500">Đang tải...</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={8} className="px-3 py-8 text-center text-slate-500">Chưa có phân loại nào.</td></tr>
            ) : rows.map((row, index) => {
              const draft = (typeof row.id === "number" ? drafts[row.id] : undefined) ?? { name: row.name, usage: row.usage, separateGroup: row.separateGroup, sortOrder: row.sortOrder };
              const saving = busyId === row.id;
              return (
                <tr key={row.code} className={row.active ? "bg-white" : "bg-slate-50 text-slate-500"}>
                  <td className="erp-td-num text-slate-500">{index + 1}</td>
                  <td className="font-mono text-[11.5px] text-slate-500">{row.code}</td>
                  <td>
                    <input className={cellInputClass} value={draft.name} onChange={(e) => patchDraft(row.id, { name: e.target.value })} />
                  </td>
                  <td>
                    <select className={cellInputClass} value={draft.usage} onChange={(e) => patchDraft(row.id, { usage: e.target.value, separateGroup: e.target.value === "MAIN" ? false : draft.separateGroup })}>
                      <option value="MAIN">Dòng chính (bộ cửa)</option>
                      <option value="DETAIL">Dòng phụ kiện / chi tiết</option>
                    </select>
                  </td>
                  <td className="text-center">
                    <label className="inline-flex items-center gap-1.5">
                      <input
                        type="checkbox"
                        className="h-4 w-4"
                        checked={draft.separateGroup}
                        disabled={draft.usage === "MAIN"}
                        onChange={(e) => patchDraft(row.id, { separateGroup: e.target.checked })}
                      />
                      <span className="text-[11.5px] text-slate-600">{draft.separateGroup ? "Có optgroup" : "Không"}</span>
                    </label>
                  </td>
                  <td className="erp-td-num">
                    <input className={`${cellInputClass} text-right`} type="number" value={draft.sortOrder} onChange={(e) => patchDraft(row.id, { sortOrder: Number(e.target.value) || 0 })} />
                  </td>
                  <td className="text-center">
                    <SettingsBadge tone={categoryToneAt(index)}>{row.itemCount ?? 0}</SettingsBadge>
                  </td>
                  <td>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <button className="font-semibold text-sky-700 hover:text-sky-900 disabled:opacity-50" disabled={saving} onClick={() => void saveRow(row)}>
                        {saving ? "Đang lưu..." : "Lưu"}
                      </button>
                      <button className="font-semibold text-slate-500 hover:text-slate-800 disabled:opacity-50" disabled={saving} onClick={() => void toggleActive(row)}>
                        {row.active ? "Ngưng dùng" : "Dùng lại"}
                      </button>
                      <button className="font-semibold text-red-600 hover:text-red-800 disabled:opacity-50" disabled={saving} onClick={() => startDelete(row)}>
                        Xoá
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </SettingsTable>
        <div className="border-t border-slate-200 bg-slate-50 px-3.5 py-2 text-[11.5px] leading-5 text-slate-600">
          Đổi <b>Tên</b> chỉ đổi cách hiển thị — hàng hóa đã gán vẫn giữ nguyên phân loại (hệ thống lưu theo mã).
          “Dòng chính” = hàng hóa xuất hiện ở ô <b>Nhóm cửa</b> khi lập đơn; “Dòng phụ kiện / chi tiết” = xuất hiện ở ô <b>Nhóm hàng</b>;
          bật <b>Nhóm riêng</b> thì các nhóm hàng đó nằm trong một optgroup riêng (như “Chi phí gia công” hiện nay).
          Ngưng dùng để ẩn khỏi danh sách chọn nhưng vẫn giữ phân loại cho hàng hóa cũ.
        </div>
      </section>
    </div>
  );
}
