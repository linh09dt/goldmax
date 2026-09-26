"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  PRIORITY_CRITERIA,
  type CriterionConfig,
  type PriorityConfig,
  type PriorityCriterionCode,
} from "@/lib/production/priority";

/**
 * V149 — Màn cấu hình THỨ TỰ ƯU TIÊN xếp kế hoạch, theo TỪNG CÔNG ĐOẠN.
 *
 * Mỗi công đoạn có thể có bộ quy tắc riêng; không khai thì dùng bộ MẶC ĐỊNH.
 * Điểm ưu tiên = Σ (trọng số × hệ số 0…1). Điểm cao = làm trước.
 */

type StageOption = { code: string; name: string; seq: number; active: boolean };

const DEFAULT_KEY = "__MAC_DINH__";

function emptyDraft(config: PriorityConfig): PriorityConfig {
  return JSON.parse(JSON.stringify(config)) as PriorityConfig;
}

function RuleEditor({
  criteria,
  stages,
  onChange,
}: {
  criteria: CriterionConfig[];
  stages: StageOption[];
  onChange: (next: CriterionConfig[]) => void;
}) {
  const withOptions = useMemo(() => stages.filter((stage) => stage.active).map((stage) => stage.code), [stages]);

  const update = (index: number, patch: Partial<CriterionConfig>) => {
    onChange(criteria.map((item, position) => (position === index ? { ...item, ...patch } : item)));
  };

  const add = () => {
    const used = new Set(criteria.map((item) => item.code));
    const next = PRIORITY_CRITERIA.find((item) => !used.has(item.code));
    if (!next) return;
    onChange([...criteria, { code: next.code, weight: next.defaultWeight || 10 }]);
  };

  return (
    <div className="space-y-2">
      <div className="overflow-x-auto">
        <table className="erp-table w-full text-[12.5px]">
          <thead>
            <tr className="bg-slate-50 text-slate-600">
              <th className="px-2 py-1 text-left">Chỉ tiêu</th>
              <th className="px-2 py-1 text-left">Nguồn (cột thật)</th>
              <th className="px-2 py-1 text-left w-[120px]">Trọng số</th>
              <th className="px-2 py-1 text-left w-[150px]">Tham số</th>
              <th className="px-2 py-1 w-[60px]"></th>
            </tr>
          </thead>
          <tbody>
            {criteria.map((item, index) => {
              const meta = PRIORITY_CRITERIA.find((entry) => entry.code === item.code);
              return (
                <tr key={`${item.code}-${index}`} className="align-top">
                  <td className="px-2 py-1">
                    <select
                      className="erp-input"
                      value={item.code}
                      onChange={(event) => update(index, { code: event.target.value as PriorityCriterionCode })}
                    >
                      {PRIORITY_CRITERIA.map((entry) => (
                        <option key={entry.code} value={entry.code}>
                          {entry.label}
                        </option>
                      ))}
                    </select>
                    {meta?.kind === "NHOM" ? (
                      <span className="ml-1 rounded bg-violet-100 px-1.5 py-0.5 text-[11px] font-semibold text-violet-800">GOM NHÓM</span>
                    ) : null}
                    {meta ? <p className="erp-hint mt-1">{meta.meaning}</p> : null}
                  </td>
                  <td className="px-2 py-1 text-slate-600">{meta?.source ?? "—"}</td>
                  <td className="px-2 py-1">
                    <input
                      className="erp-input w-[90px]"
                      type="number"
                      min={0}
                      value={item.weight}
                      onChange={(event) => update(index, { weight: Number(event.target.value) || 0 })}
                    />
                    {meta?.kind === "NHOM" ? <p className="erp-hint mt-1">dung sai điểm</p> : null}
                  </td>
                  <td className="px-2 py-1">
                    {item.code === "FIFO" ? (
                      <select
                        className="erp-input"
                        value={item.anchor ?? "TRONG_LUOT"}
                        onChange={(event) => update(index, { anchor: event.target.value as CriterionConfig["anchor"] })}
                      >
                        <option value="TRONG_LUOT">Trong lượt xếp (plan trước → sau ưu tiên trước)</option>
                        <option value="VAO_KE_HOACH">Vào kế hoạch (created_at)</option>
                        <option value="DA_VAO_SAN_XUAT">Đã vào sản xuất (started_at)</option>
                        <option value="NGAY_DAT_DON">Ngày đặt đơn (order_date)</option>
                      </select>
                    ) : null}
                    {item.code === "SO_CANH" ? (
                      <select
                        className="erp-input"
                        value={item.direction ?? "NHO_TRUOC"}
                        onChange={(event) => update(index, { direction: event.target.value as CriterionConfig["direction"] })}
                      >
                        <option value="NHO_TRUOC">Bộ nhỏ trước</option>
                        <option value="LON_TRUOC">Bộ lớn trước</option>
                      </select>
                    ) : null}
                    {meta?.kind === "NHOM" ? (
                      <select
                        className="erp-input"
                        value={item.direction ?? "TANG"}
                        onChange={(event) => update(index, { direction: event.target.value as CriterionConfig["direction"] })}
                      >
                        <option value="TANG">Nhóm nhỏ trước (tăng dần)</option>
                        <option value="GIAM">Nhóm lớn trước (giảm dần)</option>
                      </select>
                    ) : null}
                    {item.code !== "FIFO" && item.code !== "SO_CANH" && meta?.kind !== "NHOM" ? (
                      <span className="text-slate-400">—</span>
                    ) : null}
                  </td>
                  <td className="px-2 py-1 text-center">
                    <button
                      type="button"
                      className="text-red-600 hover:underline"
                      onClick={() => onChange(criteria.filter((_, position) => position !== index))}
                    >
                      Xoá
                    </button>
                  </td>
                </tr>
              );
            })}
            {!criteria.length ? (
              <tr>
                <td className="px-2 py-3 text-slate-500" colSpan={5}>
                  Chưa có chỉ tiêu nào — thêm ít nhất một chỉ tiêu.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className="erp-button-secondary" onClick={add} disabled={criteria.length >= PRIORITY_CRITERIA.length}>
          + Thêm chỉ tiêu
        </button>
        <span className="erp-hint">
          Tổng trọng số: <strong>{criteria.reduce((sum, item) => sum + (Number(item.weight) || 0), 0)}</strong> (chỉ để so tỉ lệ —
          không cần bằng 100). {withOptions.length} công đoạn đang bật.
        </span>
      </div>
    </div>
  );
}

export function PriorityConfigEditor({ priority, stages }: { priority: PriorityConfig; stages: StageOption[] }) {
  const router = useRouter();
  const [draft, setDraft] = useState<PriorityConfig>(() => emptyDraft(priority));
  const [editing, setEditing] = useState<string>(DEFAULT_KEY);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "err"; text: string } | null>(null);

  const activeStages = useMemo(() => stages.filter((stage) => stage.active).sort((a, b) => a.seq - b.seq), [stages]);

  const currentCriteria =
    editing === DEFAULT_KEY ? draft.defaultRule.criteria : draft.stageRules[editing]?.criteria ?? draft.defaultRule.criteria;

  const setCriteria = (next: CriterionConfig[]) => {
    if (editing === DEFAULT_KEY) {
      setDraft((value) => ({ ...value, defaultRule: { criteria: next } }));
      return;
    }
    setDraft((value) => ({ ...value, stageRules: { ...value.stageRules, [editing]: { criteria: next } } }));
  };

  const save = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch("/api/production/catalog", {
        method: "PUT",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ priority: draft }),
      });
      const payload = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok || !payload.ok) throw new Error(payload.error || "Không lưu được thứ tự ưu tiên.");
      setMessage({ tone: "ok", text: "Đã lưu thứ tự ưu tiên. Lần Xem trước kế hoạch tiếp theo sẽ dùng cấu hình này." });
      router.refresh();
    } catch (error) {
      setMessage({ tone: "err", text: error instanceof Error ? error.message : "Lỗi không rõ." });
    } finally {
      setBusy(false);
    }
  };

  const overrides = Object.keys(draft.stageRules);

  return (
    <section className="erp-card overflow-hidden">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-slate-200 bg-slate-50 px-3 py-2">
        <div>
          <h2 className="text-[13px] font-semibold text-slate-900">Thứ tự ưu tiên khi xếp kế hoạch</h2>
          <p className="text-[11px] text-slate-500">
            Điểm ưu tiên = Σ (trọng số × hệ số 0…1) — điểm cao làm trước. Mỗi công đoạn có thể có quy tắc riêng.
          </p>
        </div>
        <button className="erp-button" type="button" disabled={busy} onClick={save}>
          {busy ? "Đang lưu…" : "Lưu thứ tự ưu tiên"}
        </button>
      </div>

      {message ? (
        <p className={`px-3 py-2 text-[12.5px] ${message.tone === "ok" ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700"}`}>
          {message.text}
        </p>
      ) : null}

      <div className="space-y-4 px-3 py-4">
        <div>
          <span className="erp-field-label">Áp dụng cho</span>
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              className={editing === DEFAULT_KEY ? "erp-button" : "erp-button-secondary"}
              onClick={() => setEditing(DEFAULT_KEY)}
            >
              MẶC ĐỊNH (mọi công đoạn)
            </button>
            {activeStages.map((stage) => (
              <button
                key={stage.code}
                type="button"
                className={editing === stage.code ? "erp-button" : "erp-button-secondary"}
                onClick={() => setEditing(stage.code)}
              >
                {stage.name}
                {draft.stageRules[stage.code] ? " ✱" : ""}
              </button>
            ))}
          </div>
          <p className="erp-hint mt-1">
            ✱ = công đoạn có quy tắc RIÊNG (đang ghi đè mặc định). {overrides.length} công đoạn có quy tắc riêng.
          </p>
        </div>

        {editing !== DEFAULT_KEY && currentCriteria === draft.defaultRule.criteria ? (
          <p className="rounded border border-amber-200 bg-amber-50 px-2 py-1 text-[12px] text-amber-900">
            Công đoạn này <strong>chưa có quy tắc riêng</strong> — đang hiện bộ mặc định. Bấm “Tạo quy tắc riêng” để sửa (không ảnh hưởng
            công đoạn khác).
            <button
              type="button"
              className="erp-button ml-2"
              onClick={() =>
                setDraft((value) => ({
                  ...value,
                  stageRules: { ...value.stageRules, [editing]: { criteria: value.defaultRule.criteria.map((item) => ({ ...item })) } },
                }))
              }
            >
              Tạo quy tắc riêng
            </button>
          </p>
        ) : null}

        <RuleEditor criteria={currentCriteria} stages={stages} onChange={setCriteria} />

        {editing !== DEFAULT_KEY && draft.stageRules[editing] ? (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="erp-button-secondary"
              onClick={() =>
                setDraft((value) => {
                  const next = { ...value.stageRules };
                  delete next[editing];
                  return { ...value, stageRules: next };
                })
              }
            >
              Xoá quy tắc riêng của công đoạn này (quay về mặc định)
            </button>
          </div>
        ) : null}

        <div className="grid gap-3 border-t border-slate-200 pt-3 md:grid-cols-3">
          <label className="block">
            <span className="erp-field-label">Horizon hạn giao (ngày làm việc)</span>
            <input
              className="erp-input"
              type="number"
              value={draft.dueHorizonDays}
              onChange={(event) => setDraft((value) => ({ ...value, dueHorizonDays: Number(event.target.value) || 1 }))}
            />
            <p className="erp-hint mt-1">Còn ≤ số ngày này thì HEN_GIAO được coi là gấp dần.</p>
          </label>
          <label className="block">
            <span className="erp-field-label">Horizon FIFO (ngày làm việc)</span>
            <input
              className="erp-input"
              type="number"
              value={draft.fifoHorizonDays}
              onChange={(event) => setDraft((value) => ({ ...value, fifoHorizonDays: Number(event.target.value) || 1 }))}
            />
            <p className="erp-hint mt-1">Càng cũ (quá số ngày này) càng được điểm tối đa.</p>
          </label>
          <label className="block">
            <span className="erp-field-label">Số cánh coi là “bộ lớn”</span>
            <input
              className="erp-input"
              type="number"
              value={draft.maxCanh}
              onChange={(event) => setDraft((value) => ({ ...value, maxCanh: Number(event.target.value) || 1 }))}
            />
          </label>
          <label className="block">
            <span className="erp-field-label">Giá trị đơn coi là “lớn” (đồng)</span>
            <input
              className="erp-input"
              type="number"
              value={draft.maxOrderValue}
              onChange={(event) => setDraft((value) => ({ ...value, maxOrderValue: Number(event.target.value) || 1 }))}
            />
          </label>
          <label className="block">
            <span className="erp-field-label">Km coi là “xa”</span>
            <input
              className="erp-input"
              type="number"
              value={draft.maxKm}
              onChange={(event) => setDraft((value) => ({ ...value, maxKm: Number(event.target.value) || 1 }))}
            />
          </label>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <label className="block">
            <span className="erp-field-label">Khách ưu tiên (mã khách, cách nhau dấu phẩy)</span>
            <textarea
              className="erp-input h-[72px]"
              value={draft.favoriteCustomers.join(", ")}
              onChange={(event) =>
                setDraft((value) => ({
                  ...value,
                  favoriteCustomers: event.target.value
                    .split(/[,\n]/)
                    .map((item) => item.trim().toUpperCase())
                    .filter(Boolean),
                }))
              }
            />
          </label>
          <label className="block">
            <span className="erp-field-label">Nhân viên KD ưu tiên (mã/tên, cách nhau dấu phẩy)</span>
            <textarea
              className="erp-input h-[72px]"
              value={draft.favoriteEmployees.join(", ")}
              onChange={(event) =>
                setDraft((value) => ({
                  ...value,
                  favoriteEmployees: event.target.value
                    .split(/[,\n]/)
                    .map((item) => item.trim().toUpperCase())
                    .filter(Boolean),
                }))
              }
            />
          </label>
        </div>

        <p className="erp-hint">
          <strong>Chỉ tiêu GOM NHÓM</strong> (Mã đơn hàng · Màu sơn · <strong>Nhóm màu chính</strong> · Model) không cộng điểm. Nó giữ các bộ{" "}
          <strong>cùng đơn / cùng màu / cùng model nằm gần nhau</strong>: sau khi sắp theo điểm, hệ thống luôn ưu tiên chọn tiếp một bộ cùng
          nhóm nếu điểm của nó không thấp hơn điểm cao nhất đang chờ quá <em>“mức gom”</em>. Để <strong>0</strong> = không gom; tăng lên
          (vd 20–40) để siết nhóm. Ví dụ ở <strong>Sơn</strong>: bật <em>Nhóm màu chính</em> (Đỏ / Vàng / Cát chay — khai ở tab <strong>Màu sơn</strong>) để nhiều mã màu sơn chung lô, thay vì <em>Màu sơn</em> chính xác chỉ gom được 1 mã; ở <strong>Chấn</strong>: bật{" "}
          <em>Model</em> để đỡ đổi khuôn; bật <em>Mã đơn hàng</em> để đơn không bị xé lẻ.
        </p>
        <p className="erp-hint">
          <strong>FIFO</strong> mặc định <em>“Trong lượt xếp”</em>: bộ nào đã được xếp ở công đoạn trước thì công đoạn sau được ưu tiên
          trước — đúng nghĩa “plan trước thì công đoạn sau ưu tiên trước”. Sau khi lưu, mở <strong>Kế hoạch theo công đoạn</strong> và
          bấm <em>Xem trước</em> để thấy thứ tự mới.
        </p>
      </div>
    </section>
  );
}
