"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { SearchGroups, SearchResult } from "@/lib/search";

/**
 * V130 — Ô tìm kiếm toàn cục với phím tắt Ctrl+K (⌘K trên macOS).
 * Tìm mã đơn / khách hàng / hàng hóa / mã đại lý qua /api/search, bấm để mở thẳng kết quả.
 */

export function GlobalSearch() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchGroups | null>(null);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen(true);
        setTimeout(() => inputRef.current?.focus(), 0);
      } else if (event.key === "Escape") {
        setOpen(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  useEffect(() => {
    function onClick(event: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(event.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  function handleChange(value: string) {
    setQuery(value);
    if (timerRef.current) clearTimeout(timerRef.current);
    const text = value.trim();
    if (text.length < 2) {
      setResults(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    timerRef.current = setTimeout(async () => {
      try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(text)}`);
        const data = (await response.json()) as { ok?: boolean } & SearchGroups;
        setResults(data.ok ? data : null);
      } catch {
        setResults(null);
      } finally {
        setLoading(false);
      }
    }, 200);
  }

  function goto(result: SearchResult) {
    setOpen(false);
    setQuery("");
    setResults(null);
    router.push(result.href);
  }

  const groups: Array<{ label: string; items: SearchResult[] }> = results
    ? [
        { label: "Đơn hàng", items: results.orders },
        { label: "Khách hàng", items: results.customers },
        { label: "Hàng hóa", items: results.items },
        { label: "Mã đại lý", items: results.dealers },
      ].filter((group) => group.items.length > 0)
    : [];

  return (
    <div ref={boxRef} className="relative w-full min-w-0 md:w-[340px]">
      <input
        ref={inputRef}
        type="search"
        value={query}
        onChange={(event) => handleChange(event.target.value)}
        onFocus={() => setOpen(true)}
        placeholder="Tìm mã đơn, khách hàng, hàng hóa…"
        className="erp-input h-9 w-full pr-14"
        aria-label="Tìm kiếm toàn cục"
      />
      <kbd className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 rounded border border-slate-300 bg-slate-50 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500">
        Ctrl K
      </kbd>

      {open ? (
        <div className="absolute left-0 right-0 top-11 z-50 max-h-[70vh] overflow-auto rounded-lg border border-slate-200 bg-white p-2 shadow-xl">
          {query.trim().length < 2 ? (
            <p className="px-2 py-3 text-[11.5px] text-slate-500">Gõ ít nhất 2 ký tự: mã đơn, tên/SĐT khách hàng, MODEL hoặc mã đại lý.</p>
          ) : loading && !results ? (
            <p className="px-2 py-3 text-[11.5px] text-slate-500">Đang tìm…</p>
          ) : groups.length === 0 ? (
            <p className="px-2 py-3 text-[11.5px] text-slate-500">Không tìm thấy kết quả cho “{query.trim()}”.</p>
          ) : (
            <div className="space-y-2">
              {groups.map((group) => (
                <div key={group.label}>
                  <div className="px-2 pb-1 text-[10px] font-bold uppercase tracking-wide text-slate-400">{group.label}</div>
                  <ul className="space-y-0.5">
                    {group.items.map((item) => (
                      <li key={`${item.type}-${item.href}-${item.title}`}>
                        <button
                          type="button"
                          onClick={() => goto(item)}
                          className="flex w-full flex-col rounded-md px-2 py-1.5 text-left transition hover:bg-cyan-50"
                        >
                          <span className="text-[12px] font-semibold text-slate-800">{item.title}</span>
                          <span className="truncate text-[10.5px] text-slate-500">{item.subtitle}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
