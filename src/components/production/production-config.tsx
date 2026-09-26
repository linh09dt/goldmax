"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  REASON_GROUP_LABELS,
  STAGE_KIND_LABELS,
  WORK_CENTER_KIND_LABELS,
} from "@/lib/production/catalog";
import { WEEKDAY_LABELS, type ProductionConfig } from "@/lib/production/config";

/**
 * V136 — Cấu hình sản xuất: mọi con số lấy từ khảo sát đều SỬA ĐƯỢC ở đây, không hard-code.
 *
 * Tabs: Cấu hình chung · Tổ & năng lực · Công đoạn · Lý do · Chương trình máy cắt · Ngày nghỉ.
 */

export type WorkCenterRow = {
  id: number;
  code: string;
  name: string;
  kind: string;
  peopleCount: number | null;
  shiftsPerDay: number | null;
  hoursPerShift: number | null;
  capacityPerDay: number | null;
  capacityUnit: string;
  active: boolean;
  sortOrder: number;
  note: string | null;
};

export type StageRow = {
  id: number;
  code: string;
  name: string;
  kind: string;
  scopeMode: string;
  scopeParts: string | null;
  workCenterCode: string | null;
  seq: number;
  leadTimeDays: number | null;
  setupMinutes: number | null;
  capacityPerDay: number | null;
  batchKey: string | null;
  batchMinQty: number | null;
  changeoverMaxPerDay: number | null;
  isQcPoint: boolean;
  reworkToStage: string | null;
  skipCondition: string | null;
  requiresStage: string | null;
  active: boolean;
  note: string | null;
};

export type ReasonRow = { id: number; code: string; name: string; group: string; sortOrder: number; active: boolean };
export type ProgramRow = { id: number; model: string; fileName: string | null; version: number; machine: string | null; madeBy: string | null; durationMinutes: number | null; reusable: boolean; note: string | null };
export type HolidayRow = { id: number; date: string; isWorkingDay: boolean; note: string | null };

type FieldSpec = {
  key: string;
  label: string;
  /** Mặc định "text" nếu không khai. */
  type?: "text" | "number" | "checkbox" | "select";
  options?: Array<{ value: string; label: string }>;
  width?: string;
  placeholder?: string;
};

const TABS = [
  { key: "general", label: "Cấu hình chung" },
  { key: "centers", label: "Tổ & năng lực" },
  { key: "stages", label: "Công đoạn" },
  { key: "reasons", label: "Lý do" },
  { key: "programs", label: "Chương trình máy cắt" },
  { key: "holidays", label: "Ngày nghỉ" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

const STAGE_KIND_OPTIONS = Object.entries(STAGE_KIND_LABELS).map(([value, label]) => ({ value, label }));
const SCOPE_MODE_OPTIONS = [
  { value: "BO", label: "Cả bộ" },
  { value: "PARTS", label: "Tách khung/cánh/phào" },
  { value: "PART", label: "Một bộ phận" },
  { value: "MODEL", label: "Theo model (tái dùng)" },
];
const CENTER_KIND_OPTIONS = Object.entries(WORK_CENTER_KIND_LABELS).map(([value, label]) => ({ value, label }));
const REASON_GROUP_OPTIONS = Object.entries(REASON_GROUP_LABELS).map(([value, label]) => ({ value, label }));

async function post(body: Record<string, unknown>): Promise<{ ok?: boolean; error?: string }> {
  const response = await fetch("/api/production/catalog", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body),
  });
  const result = (await response.json()) as { ok?: boolean; error?: string };
  if (!response.ok || !result.ok) throw new Error(result.error || "Không lưu được.");
  return result;
}

async function remove(entity: string, id: number) {
  const response = await fetch(`/api/production/catalog?entity=${entity}&id=${id}`, { method: "DELETE" });
  const result = (await response.json()) as { ok?: boolean; error?: string };
  if (!response.ok || !result.ok) throw new Error(result.error || "Không xoá được.");
}

function toDraft(row: Record<string, unknown>, fields: FieldSpec[]): Record<string, string> {
  const draft: Record<string, string> = {};
  for (const field of fields) {
    const value = row[field.key];
    if (field.type === "checkbox") draft[field.key] = value ? "1" : "";
    else draft[field.key] = value === null || value === undefined ? "" : String(value);
  }
  return draft;
}

function toPayload(draft: Record<string, string>, fields: FieldSpec[]): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  for (const field of fields) {
    const raw = draft[field.key] ?? "";
    if (field.type === "checkbox") payload[field.key] = raw === "1";
    else if (field.type === "number") payload[field.key] = raw === "" ? null : Number(raw);
    else payload[field.key] = raw === "" ? null : raw;
  }
  return payload;
}

function RowForm({
  entity,
  fields,
  row,
  onDone,
}: {
  entity: string;
  fields: FieldSpec[];
  row: Record<string, unknown> | null;
  onDone: () => void;
}) {
  const [draft, setDraft] = useState<Record<string, string>>(() => toDraft(row ?? {}, fields));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const id = row ? Number(row.id) : null;

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      await post({ entity, id: id ?? undefined, ...toPayload(draft, fields) });
      onDone();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Không lưu được.");
    } finally {
      setBusy(false);
    }
  };

  const del = async () => {
    if (id === null) return;
    if (!window.confirm("Xoá mục này?")) return;
    setBusy(true);
    setError(null);
    try {
      await remove(entity, id);
      onDone();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Không xoá được.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <tr className="align-top">
      {fields.map((field) => (
        <td key={field.key} style={field.width ? { minWidth: field.width } : undefined}>
          {field.type === "checkbox" ? (
            <input
              type="checkbox"
              checked={(draft[field.key] ?? "") === "1"}
              onChange={(event) => setDraft((current) => ({ ...current, [field.key]: event.target.checked ? "1" : "" }))}
            />
          ) : field.type === "select" ? (
            <select
              className="erp-cell-input"
              value={draft[field.key] ?? ""}
              onChange={(event) => setDraft((current) => ({ ...current, [field.key]: event.target.value }))}
            >
              <option value="">—</option>
              {(field.options ?? []).map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          ) : (
            <input
              className="erp-cell-input"
              type={field.type === "number" ? "number" : "text"}
              placeholder={field.placeholder ?? ""}
              value={draft[field.key] ?? ""}
              onChange={(event) => setDraft((current) => ({ ...current, [field.key]: event.target.value }))}
            />
          )}
          {error ? <div className="mt-0.5 text-[10.5px] text-red-600">{error}</div> : null}
        </td>
      ))}
      <td className="whitespace-nowrap">
        <button className="erp-action-dark" type="button" disabled={busy} onClick={save}>
          {busy ? "…" : "Lưu"}
        </button>
        {id !== null ? (
          <button className="erp-action-danger ml-1" type="button" disabled={busy} onClick={del}>
            Xoá
          </button>
        ) : (
          <button className="erp-button-secondary ml-1" type="button" onClick={onDone}>
            Bỏ
          </button>
        )}
      </td>
    </tr>
  );
}

function CatalogTable({
  entity,
  fields,
  rows,
  title,
  hint,
  note,
}: {
  entity: string;
  fields: FieldSpec[];
  rows: Array<Record<string, unknown>>;
  title: string;
  hint: string;
  note?: string;
}) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const refresh = () => {
    setAdding(false);
    router.refresh();
  };

  return (
    <section className="erp-card overflow-hidden">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-slate-200 bg-slate-50 px-3 py-2">
        <div>
          <h2 className="text-[13px] font-semibold text-slate-900">{title}</h2>
          <p className="text-[11px] text-slate-500">{hint}</p>
        </div>
        <button className="erp-button-secondary" type="button" onClick={() => setAdding(true)}>
          + Thêm dòng
        </button>
      </div>
      {note ? <p className="border-b border-slate-100 bg-amber-50/60 px-3 py-1.5 text-[11.5px] text-amber-900">{note}</p> : null}
      <div className="erp-scrollbar overflow-x-auto">
        <table className="erp-table erp-table-full">
          <thead>
            <tr>
              {fields.map((field) => (
                <th key={field.key}>{field.label}</th>
              ))}
              <th>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {adding ? <RowForm entity={entity} fields={fields} row={null} onDone={refresh} /> : null}
            {rows.map((row) => (
              <RowForm key={Number(row.id)} entity={entity} fields={fields} row={row} onDone={refresh} />
            ))}
            {!rows.length && !adding ? (
              <tr>
                <td colSpan={fields.length + 1} className="py-6 text-center text-[12px] text-slate-500">
                  Chưa có dữ liệu.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}

const CENTER_FIELDS: FieldSpec[] = [
  { key: "code", label: "Mã", width: "110px" },
  { key: "name", label: "Tên tổ", width: "200px" },
  { key: "kind", label: "Loại", type: "select", options: CENTER_KIND_OPTIONS, width: "130px" },
  { key: "peopleCount", label: "Người", type: "number", width: "70px" },
  { key: "shiftsPerDay", label: "Ca/ngày", type: "number", width: "75px" },
  { key: "hoursPerShift", label: "Giờ/ca", type: "number", width: "70px" },
  { key: "capacityPerDay", label: "Năng lực/ngày", type: "number", width: "110px" },
  { key: "capacityUnit", label: "ĐV", width: "60px" },
  { key: "sortOrder", label: "Thứ tự", type: "number", width: "70px" },
  { key: "active", label: "Dùng", type: "checkbox", width: "50px" },
  { key: "note", label: "Ghi chú", width: "320px" },
];

const STAGE_FIELDS: FieldSpec[] = [
  { key: "seq", label: "Bước", type: "number", width: "60px" },
  { key: "code", label: "Mã", width: "120px" },
  { key: "name", label: "Tên công đoạn", width: "220px" },
  { key: "stageKind", label: "Loại", type: "select", options: STAGE_KIND_OPTIONS, width: "110px" },
  { key: "scopeMode", label: "Phạm vi", type: "select", options: SCOPE_MODE_OPTIONS, width: "120px" },
  { key: "scopeParts", label: "Bộ phận", placeholder: "KHUNG,CANH,PHAO", width: "140px" },
  { key: "workCenterCode", label: "Tổ", width: "100px" },
  { key: "leadTimeDays", label: "Số ngày", type: "number", width: "70px" },
  { key: "capacityPerDay", label: "Năng lực/ngày", type: "number", width: "105px" },
  { key: "capacityUnit", label: "ĐV", width: "60px" },
  { key: "setupMinutes", label: "Setup (phút)", type: "number", width: "90px" },
  { key: "batchKey", label: "Gom lô theo", placeholder: "MAU_SON", width: "105px" },
  { key: "batchMinQty", label: "Lô tối thiểu", type: "number", width: "90px" },
  { key: "changeoverMaxPerDay", label: "Đổi/ngày", type: "number", width: "80px" },
  { key: "isQcPoint", label: "QC", type: "checkbox", width: "45px" },
  { key: "reworkToStage", label: "Lỗi → quay lại", width: "100px" },
  { key: "skipCondition", label: "Bỏ qua khi", placeholder: "PAINT_COLOR:11,14", width: "150px" },
  { key: "requiresStage", label: "Cần xong trước", width: "100px" },
  { key: "active", label: "Dùng", type: "checkbox", width: "50px" },
  { key: "note", label: "Ghi chú", width: "340px" },
];

const REASON_FIELDS: FieldSpec[] = [
  { key: "code", label: "Mã", width: "150px" },
  { key: "name", label: "Tên lý do", width: "300px" },
  { key: "reasonGroup", label: "Nhóm", type: "select", options: REASON_GROUP_OPTIONS, width: "140px" },
  { key: "sortOrder", label: "Thứ tự", type: "number", width: "80px" },
  { key: "active", label: "Dùng", type: "checkbox", width: "60px" },
];

const PROGRAM_FIELDS: FieldSpec[] = [
  { key: "model", label: "Model nhôm", width: "170px" },
  { key: "fileName", label: "Tên file", width: "200px" },
  { key: "version", label: "Phiên bản", type: "number", width: "85px" },
  { key: "machine", label: "Máy", width: "140px" },
  { key: "madeBy", label: "Người làm", width: "140px" },
  { key: "durationMinutes", label: "Phút", type: "number", width: "70px" },
  { key: "reusable", label: "Tái dùng", type: "checkbox", width: "80px" },
  { key: "note", label: "Ghi chú", width: "280px" },
];

const HOLIDAY_FIELDS: FieldSpec[] = [
  { key: "date", label: "Ngày (YYYY-MM-DD)", width: "150px" },
  { key: "isWorkingDay", label: "Là ngày làm việc", type: "checkbox", width: "130px" },
  { key: "note", label: "Ghi chú", width: "300px" },
];

function GeneralConfig({ config }: { config: ProductionConfig }) {
  const router = useRouter();
  const [draft, setDraft] = useState({
    workingDays: config.workingDays,
    shiftsPerDay: String(config.shiftsPerDay),
    hoursPerShift: String(config.hoursPerShift),
    deliveryBufferDays: String(config.deliveryBufferDays),
    overlapDaysPerStep: String(config.overlapDaysPerStep),
    dailyWarnCanh: String(config.dailyWarnCanh),
    dailyMaxCanh: String(config.dailyMaxCanh),
    entryOrderTypes: config.entryOrderTypes,
    requireInfoBeforePlan: config.requireInfoBeforePlan,
    paintBatchMinCanh: String(config.paintBatchMinCanh),
    bendChangeoverMaxPerDay: String(config.bendChangeoverMaxPerDay),
    defaultTrimCuaDi: String(config.defaultTrimCuaDi),
    defaultTrimCuaSo: String(config.defaultTrimCuaSo),
    waitsEnabled: config.waitsEnabled,
    autoReschedule: config.autoReschedule,
    workOrderCodeTemplate: config.workOrderCodeTemplate,
  });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "err"; text: string } | null>(null);

  const toggle = <T,>(list: T[], value: T): T[] => (list.includes(value) ? list.filter((item) => item !== value) : [...list, value]);

  const save = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch("/api/production/catalog", {
        method: "PUT",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          config: {
            ...config,
            workingDays: draft.workingDays,
            shiftsPerDay: Number(draft.shiftsPerDay),
            hoursPerShift: Number(draft.hoursPerShift),
            deliveryBufferDays: Number(draft.deliveryBufferDays),
            overlapDaysPerStep: Number(draft.overlapDaysPerStep),
            dailyWarnCanh: Number(draft.dailyWarnCanh),
            dailyMaxCanh: Number(draft.dailyMaxCanh),
            entryOrderTypes: draft.entryOrderTypes,
            requireInfoBeforePlan: draft.requireInfoBeforePlan,
            paintBatchMinCanh: Number(draft.paintBatchMinCanh),
            bendChangeoverMaxPerDay: Number(draft.bendChangeoverMaxPerDay),
            defaultTrimCuaDi: Number(draft.defaultTrimCuaDi),
            defaultTrimCuaSo: Number(draft.defaultTrimCuaSo),
            waitsEnabled: draft.waitsEnabled,
            autoReschedule: draft.autoReschedule,
            workOrderCodeTemplate: draft.workOrderCodeTemplate,
          },
        }),
      });
      const result = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok || !result.ok) throw new Error(result.error || "Không lưu được cấu hình.");
      setMessage({ tone: "ok", text: "Đã lưu cấu hình sản xuất." });
      router.refresh();
    } catch (error) {
      setMessage({ tone: "err", text: error instanceof Error ? error.message : "Không lưu được cấu hình." });
    } finally {
      setBusy(false);
    }
  };

  const orderTypeLabels: Record<string, string> = { MAU: "Đơn hàng mẫu", SAN_XUAT: "Sản xuất", LAM_LAI: "Đơn làm lại" };
  const infoLabels: Record<string, string> = { heightMm: "Cao", widthMm: "Rộng", openingDirection: "Hướng mở", paintColor: "Màu sơn" };

  return (
    <section className="erp-card overflow-hidden">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-slate-200 bg-slate-50 px-3 py-2">
        <div>
          <h2 className="text-[13px] font-semibold text-slate-900">Cấu hình chung</h2>
          <p className="text-[11px] text-slate-500">Áp cho toàn bộ kế hoạch. Sửa xong bấm Lưu cấu hình.</p>
        </div>
        <button className="erp-button" type="button" disabled={busy} onClick={save}>
          {busy ? "Đang lưu…" : "Lưu cấu hình"}
        </button>
      </div>

      {message ? (
        <p className={`px-3 py-2 text-[12.5px] ${message.tone === "ok" ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700"}`}>
          {message.text}
        </p>
      ) : null}

      <div className="grid gap-4 px-3 py-4 md:grid-cols-2 xl:grid-cols-3">
        <div>
          <span className="erp-field-label">Ngày làm việc trong tuần</span>
          <div className="flex flex-wrap gap-1.5">
            {[1, 2, 3, 4, 5, 6, 0].map((day) => (
              <label key={day} className="flex items-center gap-1 rounded border border-slate-200 px-2 py-1 text-[12px]">
                <input type="checkbox" checked={draft.workingDays.includes(day)} onChange={() => setDraft((c) => ({ ...c, workingDays: toggle(c.workingDays, day) }))} />
                {WEEKDAY_LABELS[day]}
              </label>
            ))}
          </div>
          <p className="erp-hint mt-1">A2: không tính Chủ nhật và ngày lễ (ngày lễ khai ở tab Ngày nghỉ).</p>
        </div>

        <label className="block">
          <span className="erp-field-label">Ca mỗi ngày</span>
          <input className="erp-input" type="number" value={draft.shiftsPerDay} onChange={(e) => setDraft((c) => ({ ...c, shiftsPerDay: e.target.value }))} />
        </label>
        <label className="block">
          <span className="erp-field-label">Giờ mỗi ca</span>
          <input className="erp-input" type="number" value={draft.hoursPerShift} onChange={(e) => setDraft((c) => ({ ...c, hoursPerShift: e.target.value }))} />
        </label>

        <label className="block">
          <span className="erp-field-label">Đệm trước hạn giao (ngày làm việc)</span>
          <input className="erp-input" type="number" value={draft.deliveryBufferDays} onChange={(e) => setDraft((c) => ({ ...c, deliveryBufferDays: e.target.value }))} />
          <p className="erp-hint mt-1">Hạn giao là ngày giao TỚI KHÁCH (B6/GH2) → xưởng phải xong sớm hơn.</p>
        </label>
        <label className="block">
          <span className="erp-field-label">Gối công đoạn (ngày/bước)</span>
          <input className="erp-input" type="number" value={draft.overlapDaysPerStep} onChange={(e) => setDraft((c) => ({ ...c, overlapDaysPerStep: e.target.value }))} />
          <p className="erp-hint mt-1">C6: xưởng gối 1 ngày → đặt 1. Để 0 = cộng dồn (an toàn hơn).</p>
        </label>
        <label className="block">
          <span className="erp-field-label">Sơn: lô màu tối thiểu (cánh)</span>
          <input className="erp-input" type="number" value={draft.paintBatchMinCanh} onChange={(e) => setDraft((c) => ({ ...c, paintBatchMinCanh: e.target.value }))} />
        </label>

        <label className="block">
          <span className="erp-field-label">Ngưỡng vàng toàn xưởng (cánh/ngày)</span>
          <input className="erp-input" type="number" value={draft.dailyWarnCanh} onChange={(e) => setDraft((c) => ({ ...c, dailyWarnCanh: e.target.value }))} />
        </label>
        <label className="block">
          <span className="erp-field-label">Ngưỡng đỏ toàn xưởng (cánh/ngày)</span>
          <input className="erp-input" type="number" value={draft.dailyMaxCanh} onChange={(e) => setDraft((c) => ({ ...c, dailyMaxCanh: e.target.value }))} />
          <p className="erp-hint mt-1">KH6/KH7: quá 70 cánh/ngày là quá nhiều. Cảnh báo quá tải còn so với năng lực TỪNG TỔ.</p>
        </label>
        <label className="block">
          <span className="erp-field-label">Chấn: đổi khuôn tối đa mỗi ngày</span>
          <input className="erp-input" type="number" value={draft.bendChangeoverMaxPerDay} onChange={(e) => setDraft((c) => ({ ...c, bendChangeoverMaxPerDay: e.target.value }))} />
        </label>
        <label className="block">
          <span className="erp-field-label">Số phào rời mặc định — cửa ĐI</span>
          <input className="erp-input" type="number" value={draft.defaultTrimCuaDi} onChange={(e) => setDraft((c) => ({ ...c, defaultTrimCuaDi: e.target.value }))} />
          <p className="erp-hint mt-1">Số phào của một bộ = <strong>số cánh + số phào rời mặc định</strong> (đã chốt 26/09/2026).</p>
        </label>
        <label className="block">
          <span className="erp-field-label">Số phào rời mặc định — cửa SỔ</span>
          <input className="erp-input" type="number" value={draft.defaultTrimCuaSo} onChange={(e) => setDraft((c) => ({ ...c, defaultTrimCuaSo: e.target.value }))} />
          <p className="erp-hint mt-1">Tổng phào của bộ = (số cánh + mặc định theo loại cửa) × số bộ. Ví dụ cửa đi 1 cánh → 1 + 3 = 4.</p>
        </label>

        <div>
          <span className="erp-field-label">Loại đơn đưa vào kế hoạch</span>
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(orderTypeLabels).map(([value, label]) => (
              <label key={value} className="flex items-center gap-1 rounded border border-slate-200 px-2 py-1 text-[12px]">
                <input type="checkbox" checked={draft.entryOrderTypes.includes(value)} onChange={() => setDraft((c) => ({ ...c, entryOrderTypes: toggle(c.entryOrderTypes, value) }))} />
                {label}
              </label>
            ))}
          </div>
          <p className="erp-hint mt-1">Nhà máy đã chốt 26/09/2026: TẤT CẢ loại đơn đều vào kế hoạch.</p>
        </div>

        <div>
          <span className="erp-field-label">Thông tin bắt buộc trước khi xếp lịch</span>
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(infoLabels).map(([value, label]) => (
              <label key={value} className="flex items-center gap-1 rounded border border-slate-200 px-2 py-1 text-[12px]">
                <input
                  type="checkbox"
                  checked={draft.requireInfoBeforePlan.includes(value as ProductionConfig["requireInfoBeforePlan"][number])}
                  onChange={() =>
                    setDraft((c) => ({
                      ...c,
                      requireInfoBeforePlan: toggle(c.requireInfoBeforePlan, value as ProductionConfig["requireInfoBeforePlan"][number]),
                    }))
                  }
                />
                {label}
              </label>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <label className="flex items-center gap-2 text-[12.5px]">
            <input type="checkbox" checked={draft.waitsEnabled} onChange={(e) => setDraft((c) => ({ ...c, waitsEnabled: e.target.checked }))} />
            Tính các khoảng CHỜ vào thời lượng (chờ khô sau sơn, sau vân, sau Bồi Lares…)
          </label>
          <label className="flex items-center gap-2 text-[12.5px]">
            <input type="checkbox" checked={draft.autoReschedule} onChange={(e) => setDraft((c) => ({ ...c, autoReschedule: e.target.checked }))} />
            Tự đề xuất lại lịch khi trễ (J8: nhà máy chọn KHÔNG — chỉ báo đỏ)
          </label>
        </div>

        <div className="space-y-2 border-t border-slate-200 pt-3">
          <h3 className="text-[13px] font-semibold text-slate-700">Mã lệnh sản xuất (V142)</h3>
          <label className="flex flex-col gap-1 text-[12.5px]">
            <span>Mẫu mã lệnh — mỗi công đoạn của mỗi bộ có một lệnh riêng</span>
            <input
              className="erp-input max-w-[560px]"
              value={draft.workOrderCodeTemplate}
              onChange={(e) => setDraft((c) => ({ ...c, workOrderCodeTemplate: e.target.value }))}
            />
          </label>
          <p className="erp-hint">
            Token dùng được: <code>{"{orderCode}"}</code> <code>{"{setNo}"}</code> <code>{"{set}"}</code> (id bộ) <code>{"{seq}"}</code>{" "}
            <code>{"{seq:02}"}</code> (canh 0) <code>{"{scope}"}</code> <code>{"{scopeShort}"}</code> <code>{"{stage}"}</code> <code>{"{kind}"}</code>.
            Chữ phần: Cánh <strong>C</strong> · Khung <strong>K</strong> · Phào <strong>P</strong> · cả bộ <strong>B</strong>.
            <br />
            Mặc định <code>{"LSX-{orderCode}-{setNo}-{seq:02}{scopeShort}"}</code> → <code>LSX-26082201QN17DH01-1-40C</code>.
            Mẫu <strong>phải có {"{set}"} — hoặc có CẢ {"{orderCode}"} và {"{setNo}"}</strong>
            để mã lệnh không trùng giữa các bộ ({"{orderCode}"} một mình là không đủ: mọi bộ trong cùng một đơn sẽ ra cùng bộ mã).
          </p>
        </div>
      </div>
    </section>
  );
}

export function ProductionConfigScreen({
  config,
  workCenters,
  stages,
  reasons,
  programs,
  holidays,
}: {
  config: ProductionConfig;
  workCenters: WorkCenterRow[];
  stages: StageRow[];
  reasons: ReasonRow[];
  programs: ProgramRow[];
  holidays: HolidayRow[];
}) {
  const [tab, setTab] = useState<TabKey>("general");

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {TABS.map((item) => (
          <button
            key={item.key}
            type="button"
            className={tab === item.key ? "erp-button" : "erp-button-secondary"}
            onClick={() => setTab(item.key)}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === "general" ? <GeneralConfig config={config} /> : null}

      {tab === "centers" ? (
        <CatalogTable
          entity="workCenter"
          title="Tổ & năng lực"
          hint="Năng lực để trống = không cảnh báo quá tải cho tổ đó (tổ vân chưa có số — VAN12)."
          rows={workCenters as unknown as Array<Record<string, unknown>>}
          fields={CENTER_FIELDS}
        />
      ) : null}

      {tab === "stages" ? (
        <CatalogTable
          entity="stage"
          title="Công đoạn (routing)"
          hint="Thứ tự theo BƯỚC. Loại CHUẨN BỊ không nhân theo số bộ; CHỜ không chiếm năng lực tổ."
          note="Bỏ qua theo điều kiện, vd PAINT_COLOR:11,14 = màu sơn 11 và 14 không cần công đoạn này. requiresStage = bắt buộc công đoạn trước đã xong."
          rows={stages as unknown as Array<Record<string, unknown>>}
          fields={STAGE_FIELDS}
        />
      ) : null}

      {tab === "reasons" ? (
        <CatalogTable
          entity="reason"
          title="Lý do tạm dừng / trễ / máy dừng / lỗi"
          hint="Dùng ở ô “Lý do” khi tạm dừng và khi đánh dấu làm lại."
          rows={reasons as unknown as Array<Record<string, unknown>>}
          fields={REASON_FIELDS}
        />
      ) : null}

      {tab === "programs" ? (
        <CatalogTable
          entity="program"
          title="Thư viện chương trình máy cắt (Bồi Lares)"
          hint="Model đã có chương trình → công đoạn Bồi Lares của bộ đó tự động BỎ QUA (V121: tái dùng được)."
          rows={programs as unknown as Array<Record<string, unknown>>}
          fields={PROGRAM_FIELDS}
        />
      ) : null}

      {tab === "holidays" ? (
        <CatalogTable
          entity="holiday"
          title="Ngày nghỉ / ngày lễ"
          hint="A2: không tính Chủ nhật và ngày lễ khi tính ngày xong dự kiến."
          rows={holidays as unknown as Array<Record<string, unknown>>}
          fields={HOLIDAY_FIELDS}
        />
      ) : null}
    </div>
  );
}
