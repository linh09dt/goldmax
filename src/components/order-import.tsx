"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

type ImportResult = {
  ok: boolean;
  action?: "CREATED" | "UPDATED" | "REBUILT_DETAILS" | "SKIPPED_DUPLICATE";
  orderCode?: string;
  importedItems?: number;
  message?: string;
  error?: string;
};

export function OrderImport() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<Array<{ fileName: string; result: ImportResult }>>([]);

  async function handleFiles(files: FileList | null) {
    if (!files?.length || busy) return;
    const selected = Array.from(files);
    setBusy(true);
    setResults([]);
    const nextResults: Array<{ fileName: string; result: ImportResult }> = [];

    for (const file of selected) {
      const formData = new FormData();
      formData.append("file", file);
      try {
        const response = await fetch("/api/orders/import", { method: "POST", body: formData });
        const result = (await response.json()) as ImportResult;
        nextResults.push({ fileName: file.name, result });
      } catch {
        nextResults.push({ fileName: file.name, result: { ok: false, error: "Không thể kết nối tới API nhập Excel." } });
      }
      setResults([...nextResults]);
    }

    setBusy(false);
    if (inputRef.current) inputRef.current.value = "";
    router.refresh();
  }

  return (
    <section className="erp-card">
      <button className="flex w-full items-center justify-between gap-3 p-5 text-left" type="button" onClick={() => setOpen((value) => !value)}>
        <div>
          <h2 className="font-bold">Nhập đơn hàng từ Excel</h2>
        </div>
        <span className="text-sm font-semibold text-cyan-700">{open ? "Thu gọn" : "Mở nhập Excel"}</span>
      </button>
      {open ? (
        <div className="border-t border-slate-200 p-5">
          <div className="flex justify-end">
            <label className="erp-button inline-flex cursor-pointer items-center justify-center">
              {busy ? "Đang nhập..." : "Chọn file Excel"}
              <input ref={inputRef} className="hidden" type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" multiple disabled={busy} onChange={(event) => void handleFiles(event.target.files)} />
            </label>
          </div>
          {results.length > 0 ? <div className="mt-4 space-y-2">{results.map(({ fileName, result }, index) => <div key={`${fileName}-${index}`} className={`rounded-lg border px-4 py-3 text-sm ${result.ok ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-red-200 bg-red-50 text-red-800"}`}><strong>{fileName}</strong>{result.ok ? ` — ${actionLabel(result.action)} ${result.orderCode ?? ""}${typeof result.importedItems === "number" ? ` — ${result.importedItems} bộ cửa` : ""}${result.message ? ` — ${result.message}` : ""}` : ` — ${result.error ?? "Nhập thất bại"}`}</div>)}</div> : null}
        </div>
      ) : null}
    </section>
  );
}

function actionLabel(action: ImportResult["action"]) { if (action === "CREATED") return "Đã tạo"; if (action === "UPDATED") return "Đã cập nhật"; if (action === "REBUILT_DETAILS") return "Đã khôi phục dòng chi tiết"; if (action === "SKIPPED_DUPLICATE") return "Bỏ qua file trùng"; return "Đã xử lý"; }
