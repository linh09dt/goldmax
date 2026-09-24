"use client";

import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  SettingsBadge,
  SettingsCard,
  SettingsNote,
  SettingsSectionHeader,
  SettingsTable,
} from "@/components/settings/settings-ui";

type Item = {
  id: number;
  code: string;
  name: string;
  productDescription: string | null;
  unit: string | null;
  dealerPrice: string | number | null;
  retailPrice: string | number | null;
  active: boolean;
  source: string;
  lastSourceFile: string | null;
  lastImportedAt: string | null;
};

type ImportLog = {
  id: number;
  fileName: string;
  totalRows: number;
  newCount: number;
  skippedCount: number;
  errorCount: number;
  importedAt: string;
};

type RebuildSummary = {
  fileName: string;
  sheetName: string;
  totalRows: number;
  importedCount: number;
  skippedCount: number;
  issueCount: number;
  sourceColumns: { nameCol: number; modelCol: number };
  issues: Array<{ type: string; model?: string; rows: number[]; message: string }>;
};


type ItemGroup = {
  key: string;
  name: string;
  items: Item[];
};

const cellInputClass = "w-full rounded-md border border-slate-300 px-2 py-1 text-[12.5px] outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-100";

/** V76: khối A1 của tab CẤU HÌNH — Danh mục hàng hóa (Master Data). */
export function ItemMaster({ onSummary }: { onSummary?: (text: string) => void } = {}) {
  const [items, setItems] = useState<Item[]>([]);
  const [imports, setImports] = useState<ImportLog[]>([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"all" | "active" | "inactive">("all");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "error"; text: string } | null>(null);
  const [summary, setSummary] = useState<RebuildSummary | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const [newName, setNewName] = useState("");
  const [newCode, setNewCode] = useState("");
  const [newProductDescription, setNewProductDescription] = useState("");
  const [newUnit, setNewUnit] = useState("");
  const [newDealerPrice, setNewDealerPrice] = useState("");
  const [newRetailPrice, setNewRetailPrice] = useState("");
  const [adding, setAdding] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [groupedView, setGroupedView] = useState(true);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editCode, setEditCode] = useState("");
  const [editProductDescription, setEditProductDescription] = useState("");
  const [editUnit, setEditUnit] = useState("");
  const [editDealerPrice, setEditDealerPrice] = useState("");
  const [editRetailPrice, setEditRetailPrice] = useState("");
  const [editActive, setEditActive] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: "3000" });
      if (status === "active") params.set("active", "true");
      if (status === "inactive") params.set("active", "false");
      if (search.trim()) params.set("q", search.trim());
      const response = await fetch(`/api/items?${params.toString()}`, { cache: "no-store" });
      const result = await response.json() as {
        ok: boolean;
        items?: Item[];
        imports?: ImportLog[];
        error?: string;
      };
      if (!response.ok || !result.ok) throw new Error(result.error || "Không thể tải Danh mục hàng hóa.");
      setItems(result.items ?? []);
      setImports(result.imports ?? []);
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Không thể tải dữ liệu." });
    } finally {
      setLoading(false);
    }
  }, [search, status]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 200);
    return () => window.clearTimeout(timer);
  }, [load]);

  useEffect(() => {
    onSummary?.(`${items.length} hàng hóa`);
  }, [items.length, onSummary]);

  const itemGroups = useMemo<ItemGroup[]>(() => {
    const map = new Map<string, ItemGroup>();
    for (const item of items) {
      const normalizedName = normalizeGroupKey(item.name);
      const existing = map.get(normalizedName);
      if (existing) {
        existing.items.push(item);
      } else {
        map.set(normalizedName, { key: normalizedName, name: item.name.trim() || "Chưa phân nhóm", items: [item] });
      }
    }

    return Array.from(map.values())
      .map((group) => ({ ...group, items: [...group.items].sort((a, b) => a.code.localeCompare(b.code, "vi")) }))
      .sort((a, b) => a.name.localeCompare(b.name, "vi"));
  }, [items]);

  const activeCount = useMemo(() => items.filter((item) => item.active).length, [items]);
  const isSearching = search.trim().length > 0;

  function isGroupExpanded(groupKey: string) {
    return isSearching || expandedGroups.has(groupKey);
  }

  function toggleGroup(groupKey: string) {
    setExpandedGroups((current) => {
      const next = new Set(current);
      if (next.has(groupKey)) next.delete(groupKey);
      else next.add(groupKey);
      return next;
    });
  }

  function expandAllGroups() {
    setExpandedGroups(new Set(itemGroups.map((group) => group.key)));
  }

  function collapseAllGroups() {
    setExpandedGroups(new Set());
  }

  async function rebuildMaster(file: File) {
    const accepted = window.confirm(
      `Tạo lại toàn bộ Danh mục hàng hóa từ file "${file.name}"?\n\n` +
      "Toàn bộ danh mục hàng hóa hiện tại sẽ bị xóa và thay bằng TENHANG + MODEL trong file. " +
      "ĐVT, Giá đại lý và Giá bán lẻ sẽ để trống để cấu hình lại. Đơn hàng hiện có không bị xóa.",
    );
    if (!accepted) return;

    setBusy(true);
    setMessage(null);
    setSummary(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const response = await fetch("/api/items/master/rebuild", { method: "POST", body: form });
      const result = await response.json() as { ok: boolean; summary?: RebuildSummary; error?: string };
      if (!response.ok || !result.ok || !result.summary) throw new Error(result.error || "Không thể tạo lại Master Data.");
      setSummary(result.summary);
      setMessage({ type: "ok", text: `Đã tạo lại ${result.summary.importedCount} hàng hóa. ĐVT, Giá đại lý và Giá bán lẻ đang để trống để cấu hình.` });
      await load();
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Không thể tạo lại Master Data." });
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function addItem() {
    setAdding(true);
    setMessage(null);
    try {
      const response = await fetch("/api/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newName,
          code: newCode,
          productDescription: newProductDescription,
          unit: newUnit,
          dealerPrice: newDealerPrice,
          retailPrice: newRetailPrice,
        }),
      });
      const result = await response.json() as { ok: boolean; error?: string };
      if (!response.ok || !result.ok) throw new Error(result.error || "Không thể thêm hàng hóa.");
      setNewName("");
      setNewCode("");
      setNewProductDescription("");
      setNewUnit("");
      setNewDealerPrice("");
      setNewRetailPrice("");
      setMessage({ type: "ok", text: "Đã thêm hàng hóa." });
      await load();
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Không thể thêm hàng hóa." });
    } finally {
      setAdding(false);
    }
  }

  function startEdit(item: Item) {
    setEditingId(item.id);
    setEditName(item.name);
    setEditCode(item.code);
    setEditProductDescription(item.productDescription ?? "");
    setEditUnit(item.unit ?? "");
    setEditDealerPrice(item.dealerPrice === null || item.dealerPrice === undefined ? "" : String(item.dealerPrice));
    setEditRetailPrice(item.retailPrice === null || item.retailPrice === undefined ? "" : String(item.retailPrice));
    setEditActive(item.active);
  }

  async function saveEdit(id: number) {
    setMessage(null);
    try {
      const response = await fetch(`/api/items/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editName,
          code: editCode,
          productDescription: editProductDescription,
          unit: editUnit,
          dealerPrice: editDealerPrice,
          retailPrice: editRetailPrice,
          active: editActive,
        }),
      });
      const result = await response.json() as { ok: boolean; error?: string };
      if (!response.ok || !result.ok) throw new Error(result.error || "Không thể cập nhật hàng hóa.");
      setEditingId(null);
      setMessage({ type: "ok", text: "Đã cập nhật hàng hóa." });
      await load();
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Không thể cập nhật hàng hóa." });
    }
  }

  async function deleteItem(item: Item) {
    const accepted = window.confirm(
      `Xóa hàng hóa này khỏi Master Data?\n\n` +
      `TENHANG: ${item.name}\n${item.productDescription ? `Diễn giải: ${item.productDescription}\n` : ""}MODEL: ${item.code}\n\n` +
      "Hàng hóa sẽ bị xóa khỏi Danh mục hàng hóa và không còn xuất hiện khi lập đơn mới. " +
      "Các đơn hàng đã lưu trước đây vẫn giữ nguyên dữ liệu của đơn.",
    );
    if (!accepted) return;

    setDeletingId(item.id);
    setMessage(null);
    try {
      const response = await fetch(`/api/items/${item.id}`, { method: "DELETE" });
      const result = await response.json() as { ok: boolean; error?: string };
      if (!response.ok || !result.ok) throw new Error(result.error || "Không thể xóa hàng hóa.");
      if (editingId === item.id) setEditingId(null);
      setMessage({ type: "ok", text: `Đã xóa hàng hóa ${item.code} - ${item.name}.` });
      await load();
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Không thể xóa hàng hóa." });
    } finally {
      setDeletingId(null);
    }
  }

  function renderItemRow(item: Item, index: number, grouped: boolean) {
    const editing = editingId === item.id;
    return (
      <tr key={item.id} className={item.active ? "bg-white" : "bg-slate-50 text-slate-500"}>
        <td className="erp-td-num w-14 text-slate-500">{index + 1}</td>
        <td className="min-w-56 font-medium text-slate-800">
          {editing ? <input className={cellInputClass} value={editName} onChange={(e) => setEditName(e.target.value)} /> : grouped ? <span className="text-slate-400">↳ {item.name}</span> : item.name}
        </td>
        <td className="min-w-80 max-w-xl text-slate-600">
          {editing ? <textarea className={`${cellInputClass} min-h-16`} value={editProductDescription} onChange={(e) => setEditProductDescription(e.target.value)} /> : item.productDescription || "—"}
        </td>
        <td className="min-w-52 font-semibold text-sky-900">
          {editing ? <input className={cellInputClass} value={editCode} onChange={(e) => setEditCode(e.target.value)} /> : item.code}
        </td>
        <td className="min-w-20 text-center">
          {editing ? <input className={cellInputClass} value={editUnit} onChange={(e) => setEditUnit(e.target.value)} /> : item.unit || "—"}
        </td>
        <td className="erp-td-num min-w-32">
          {editing ? <PriceInput value={editDealerPrice} onChange={setEditDealerPrice} compact /> : formatPrice(item.dealerPrice)}
        </td>
        <td className="erp-td-num min-w-32">
          {editing ? <PriceInput value={editRetailPrice} onChange={setEditRetailPrice} compact /> : formatPrice(item.retailPrice)}
        </td>
        <td className="w-32">
          {editing ? (
            <select className={cellInputClass} value={editActive ? "1" : "0"} onChange={(e) => setEditActive(e.target.value === "1")}>
              <option value="1">Đang sử dụng</option>
              <option value="0">Ngưng sử dụng</option>
            </select>
          ) : (
            <SettingsBadge tone={item.active ? "emerald" : "slate"}>{item.active ? "Đang sử dụng" : "Ngưng sử dụng"}</SettingsBadge>
          )}
        </td>
        <td className="w-28 text-slate-500">{item.source === "MASTER_FILE" ? "Master Excel" : "Thủ công"}</td>
        <td className="w-32 whitespace-nowrap">
          {editing ? (
            <div className="flex gap-2">
              <button className="font-semibold text-sky-700" onClick={() => void saveEdit(item.id)}>Lưu</button>
              <button className="text-slate-500" onClick={() => setEditingId(null)}>Hủy</button>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <button className="font-semibold text-sky-700 hover:text-sky-900" onClick={() => startEdit(item)}>Sửa</button>
              <button
                className="font-semibold text-red-600 hover:text-red-800 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={deletingId === item.id}
                onClick={() => void deleteItem(item)}
              >
                {deletingId === item.id ? "Đang xóa..." : "Xóa"}
              </button>
            </div>
          )}
        </td>
      </tr>
    );
  }

  return (
    <div className="space-y-4">
      <SettingsSectionHeader
        code="A1"
        title="Danh mục hàng hóa"
        description="Master Data dùng khi lập đơn: TENHANG là nhóm cửa, MODEL là mã hàng, kèm ĐVT và giá đại lý / giá bán lẻ."
        actions={
          <>
            <label className={`erp-button-secondary cursor-pointer ${busy ? "pointer-events-none opacity-60" : ""}`}>
              {busy ? "Đang tạo lại..." : "Tạo lại Master Data từ Excel"}
              <input
                ref={fileRef}
                type="file"
                accept=".xlsx"
                className="hidden"
                disabled={busy}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void rebuildMaster(file);
                }}
              />
            </label>
            <a href="/api/items/export" className="erp-button-secondary">Xuất Master Data</a>
          </>
        }
      />

      {message ? (
        <SettingsNote tone={message.type === "ok" ? "success" : "danger"}>{message.text}</SettingsNote>
      ) : null}

      {summary ? (
        <SettingsNote tone="warning" title={`Tạo lại từ ${summary.fileName}`}>
          Sheet: {summary.sheetName} · Đã nhập: <b>{summary.importedCount}</b> · Bỏ qua: {summary.skippedCount} · Lỗi/cảnh báo: {summary.issueCount}
          <div className="mt-1 text-[11.5px]">
            Nguồn cột đọc: TENHANG cột {columnLetter(summary.sourceColumns.nameCol)}, MODEL cột {columnLetter(summary.sourceColumns.modelCol)}.
          </div>
          {summary.issues.length ? (
            <div className="mt-1 max-h-32 overflow-auto text-[11.5px]">
              {summary.issues.map((issue, index) => <div key={`${issue.type}-${index}`}>• {issue.message}</div>)}
            </div>
          ) : null}
        </SettingsNote>
      ) : null}

      <SettingsCard
        title="Thêm hàng hóa thủ công"
        description="Dùng khi phát sinh MODEL mới chưa có trong file Master Data."
        bodyClassName="p-3"
      >
        <div className="grid gap-2.5 md:grid-cols-2 xl:grid-cols-[1.1fr_1.6fr_1fr_0.55fr_0.8fr_0.8fr_auto]">
          <label className="block">
            <span className="erp-field-label">TENHANG</span>
            <input className="erp-input" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Ví dụ: Cửa đi" />
          </label>
          <label className="block">
            <span className="erp-field-label">Tên sản phẩm diễn giải</span>
            <input className="erp-input" value={newProductDescription} onChange={(e) => setNewProductDescription(e.target.value)} placeholder="Diễn giải dùng khi in đơn" />
          </label>
          <label className="block">
            <span className="erp-field-label">MODEL</span>
            <input className="erp-input" value={newCode} onChange={(e) => setNewCode(e.target.value)} placeholder="Mã MODEL" />
          </label>
          <label className="block">
            <span className="erp-field-label">ĐVT</span>
            <input className="erp-input" value={newUnit} onChange={(e) => setNewUnit(e.target.value)} placeholder="bộ" />
          </label>
          <label className="block">
            <span className="erp-field-label">Giá đại lý</span>
            <PriceInput placeholder="0" value={newDealerPrice} onChange={setNewDealerPrice} />
          </label>
          <label className="block">
            <span className="erp-field-label">Giá bán lẻ</span>
            <PriceInput placeholder="0" value={newRetailPrice} onChange={setNewRetailPrice} />
          </label>
          <div className="flex items-end">
            <button className="erp-button h-[38px] w-full whitespace-nowrap disabled:opacity-50" disabled={adding || !newName.trim() || !newCode.trim()} onClick={() => void addItem()}>
              {adding ? "Đang thêm..." : "+ Thêm hàng hóa"}
            </button>
          </div>
        </div>
      </SettingsCard>

      <section className="erp-card">
        <div className="flex flex-col gap-2.5 border-b border-slate-200 bg-slate-50 px-3.5 py-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="erp-subsection-title">Danh sách hàng hóa</h3>
              <SettingsBadge tone="cyan">{items.length} MODEL</SettingsBadge>
              <SettingsBadge>{activeCount} đang sử dụng</SettingsBadge>
              {groupedView ? <SettingsBadge>{itemGroups.length} nhóm TENHANG</SettingsBadge> : null}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <input
                className="erp-input w-72 max-w-full"
                placeholder="Tìm TENHANG, diễn giải, MODEL hoặc ĐVT..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <select className="erp-input w-40" value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
                <option value="all">Tất cả trạng thái</option>
                <option value="active">Đang sử dụng</option>
                <option value="inactive">Ngưng sử dụng</option>
              </select>
              <button
                type="button"
                className={`rounded-lg border px-3 py-2 text-[13px] font-semibold ${groupedView ? "border-sky-300 bg-sky-50 text-sky-800" : "border-slate-300 bg-white text-slate-700"}`}
                onClick={() => setGroupedView((value) => !value)}
              >
                {groupedView ? "Đang nhóm theo TENHANG" : "Nhóm theo TENHANG"}
              </button>
              {groupedView ? (
                <>
                  <button type="button" className="erp-button-secondary" onClick={expandAllGroups}>Mở tất cả</button>
                  <button type="button" className="erp-button-secondary" onClick={collapseAllGroups}>Thu gọn</button>
                </>
              ) : null}
            </div>
          </div>
        </div>

        <SettingsTable minWidthClass="min-w-[1240px]">
          <thead>
            <tr>
              <th className="w-14">STT</th>
              <th>TENHANG</th>
              <th>Tên sản phẩm diễn giải</th>
              <th>MODEL</th>
              <th className="text-center">ĐVT</th>
              <th className="text-right">Giá đại lý</th>
              <th className="text-right">Giá bán lẻ</th>
              <th>Trạng thái</th>
              <th>Nguồn</th>
              <th>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={10} className="px-3 py-8 text-center text-slate-500">Đang tải...</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={10} className="px-3 py-8 text-center text-slate-500">Chưa có Master Data hàng hóa.</td></tr>
            ) : groupedView ? (
              itemGroups.flatMap((group) => {
                const expanded = isGroupExpanded(group.key);
                const groupActiveCount = group.items.filter((item) => item.active).length;
                const rows: ReactNode[] = [
                  <tr key={`group-${group.key}`} className="bg-slate-100 hover:bg-slate-100">
                    <td className="text-center">
                      <button
                        type="button"
                        className="inline-flex h-6 w-6 items-center justify-center rounded border border-slate-300 bg-white text-[13px] font-bold text-slate-700 hover:bg-slate-50"
                        onClick={() => toggleGroup(group.key)}
                        aria-label={expanded ? `Thu gọn ${group.name}` : `Mở nhóm ${group.name}`}
                      >
                        {expanded ? "−" : "+"}
                      </button>
                    </td>
                    <td colSpan={2}>
                      <div className="flex flex-wrap items-center gap-2">
                        <button type="button" className="font-bold text-slate-900 hover:text-sky-700" onClick={() => toggleGroup(group.key)}>{group.name}</button>
                        <SettingsBadge tone="cyan">{group.items.length} MODEL</SettingsBadge>
                        {groupActiveCount !== group.items.length ? <span className="text-[11.5px] text-slate-500">{groupActiveCount} đang sử dụng</span> : null}
                      </div>
                    </td>
                    <td colSpan={7} className="text-right text-[11px] uppercase tracking-wide text-slate-400">Nhóm TENHANG</td>
                  </tr>,
                ];

                if (expanded) {
                  group.items.forEach((item) => rows.push(renderItemRow(item, items.indexOf(item), true)));
                }
                return rows;
              })
            ) : (
              items.map((item, index) => renderItemRow(item, index, false))
            )}
          </tbody>
        </SettingsTable>
      </section>

      <SettingsCard
        title="Lịch sử tạo lại Master Data"
        description="10 lần gần nhất, dùng để đối chiếu khi danh mục thay đổi."
        bodyClassName="p-0"
      >
        <SettingsTable minWidthClass="min-w-[720px]">
          <thead>
            <tr>
              <th>Thời gian</th>
              <th>File</th>
              <th className="text-right">Số hàng</th>
              <th className="text-right">Bỏ qua</th>
            </tr>
          </thead>
          <tbody>
            {imports.length ? imports.map((log) => (
              <tr key={log.id}>
                <td>{formatDateTime(log.importedAt)}</td>
                <td className="erp-td-strong">{log.fileName}</td>
                <td className="erp-td-num">{log.newCount}</td>
                <td className="erp-td-num">{log.skippedCount}</td>
              </tr>
            )) : <tr><td colSpan={4} className="px-3 py-5 text-center text-slate-500">Chưa có lịch sử.</td></tr>}
          </tbody>
        </SettingsTable>
      </SettingsCard>
    </div>
  );
}


function PriceInput({ value, onChange, placeholder, compact }: { value: string; onChange: (value: string) => void; placeholder?: string; compact?: boolean }) {
  return (
    <input
      className={compact ? `${cellInputClass} text-right tabular-nums` : "erp-input text-right tabular-nums"}
      type="number"
      min="0"
      step="1"
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

function formatPrice(value: string | number | null) {
  if (value === null || value === undefined || value === "") return "—";
  const n = Number(value);
  return Number.isFinite(n) ? `${new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 0 }).format(n)} đ` : "—";
}

function columnLetter(col: number) {
  let n = col;
  let result = "";
  while (n > 0) {
    n -= 1;
    result = String.fromCharCode(65 + (n % 26)) + result;
    n = Math.floor(n / 26);
  }
  return result;
}

function formatDateTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short" }).format(date);
}

function normalizeGroupKey(value: string) {
  return value.trim().replace(/\s+/g, " ").toLocaleUpperCase("vi-VN");
}
