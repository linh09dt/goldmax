"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SURVEY_ITEMS, SURVEY_SECTIONS, SURVEY_TOTAL } from "@/lib/survey-questions";

/**
 * V127 — Phiếu khảo sát nhà máy (bộ câu hỏi V125) điền ngay trên app.
 * Bố cục: LIỆT KÊ TẤT CẢ câu hỏi, mỗi câu 1 dòng — câu hỏi bên trái, ô trả lời bên phải.
 * - Tự động lưu vào DB (bảng survey_answers) sau khi ngừng gõ.
 * - Xuất Excel / .md để gửi đi; mỗi câu có mức P1 (bắt buộc) / P2.
 */

type SavedAnswer = {
  answer: string | null;
  choice: string | null;
  updatedBy: string | null;
  updatedAt: string;
};

type Draft = { answer: string; choice: string };

const FILTERS = [
  { id: "all", label: "Tất cả" },
  { id: "p1", label: "Chỉ câu P1" },
  { id: "todo", label: "Chưa trả lời" },
] as const;

export function SurveyForm() {
  const [answers, setAnswers] = useState<Record<string, SavedAnswer>>({});
  const [draft, setDraft] = useState<Record<string, Draft>>({});
  const [respondent, setRespondent] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["id"]>("all");
  const [search, setSearch] = useState("");
  const dirty = useRef<Set<string>>(new Set());
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Bản nháp mới nhất — giữ trong ref để hàm lưu không đọc phải giá trị cũ (stale closure). */
  const draftRef = useRef<Record<string, Draft>>({});

  useEffect(() => {
    void (async () => {
      const stored = window.localStorage.getItem("khao-sat-nguoi-tra-loi");
      if (stored) setRespondent(stored);
      try {
        const res = await fetch("/api/survey");
        const data = (await res.json()) as { answers?: Record<string, SavedAnswer> };
        if (data.answers) setAnswers(data.answers);
      } catch {
        setError("Không tải được câu trả lời đã lưu.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  /** Giá trị để HIỂN THỊ — chỉ đọc state (không đọc ref trong lúc render). */
  const valueOf = useCallback(
    (code: string): Draft => {
      const current = draft[code];
      if (current) return current;
      const saved = answers[code];
      return { answer: saved?.answer ?? "", choice: saved?.choice ?? "" };
    },
    [answers, draft],
  );

  /** Giá trị để LƯU — đọc ref (luôn mới nhất), chỉ gọi trong sự kiện/timer. */
  const valueForSave = useCallback(
    (code: string): Draft => draftRef.current[code] ?? valueOf(code),
    [valueOf],
  );

  const save = useCallback(async () => {
    const codes = Array.from(dirty.current);
    if (codes.length === 0) return;
    dirty.current = new Set();
    setSaving(true);
    setError(null);
    try {
      const payload = {
        respondent: respondent || null,
        answers: codes.map((code) => {
          const v = valueForSave(code);
          return { code, answer: v.answer, choice: v.choice };
        }),
      };
      const res = await fetch("/api/survey", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json()) as { ok?: boolean; saved?: number; error?: string };
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Lỗi lưu");
      setSavedAt(new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }));
      setAnswers((prev) => {
        const next = { ...prev };
        for (const code of codes) {
          const v = valueForSave(code);
          if (!v.answer && !v.choice) continue;
          next[code] = {
            answer: v.answer || null,
            choice: v.choice || null,
            updatedBy: respondent || prev[code]?.updatedBy || null,
            updatedAt: new Date().toISOString(),
          };
        }
        return next;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không lưu được, thử lại giúp mình.");
      for (const code of codes) dirty.current.add(code);
    } finally {
      setSaving(false);
    }
  }, [respondent, valueForSave]);

  const queue = useCallback(
    (code: string, patch: Partial<Draft>) => {
      const base = draftRef.current[code] ?? valueOf(code);
      const next = { ...base, ...patch };
      draftRef.current = { ...draftRef.current, [code]: next };
      setDraft((prev) => ({ ...prev, [code]: next }));
      dirty.current.add(code);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => void save(), 1200);
    },
    [save, valueOf],
  );

  useEffect(() => {
    const onLeave = () => {
      if (dirty.current.size === 0) return;
      const payload = JSON.stringify({
        respondent: respondent || null,
        answers: Array.from(dirty.current).map((code) => {
          const v = valueForSave(code);
          return { code, answer: v.answer, choice: v.choice };
        }),
      });
      void fetch("/api/survey", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: payload,
        keepalive: true,
      });
    };
    window.addEventListener("beforeunload", onLeave);
    return () => window.removeEventListener("beforeunload", onLeave);
  }, [respondent, valueForSave]);

  const stats = useMemo(() => {
    let answered = 0;
    let p1Total = 0;
    let p1Answered = 0;
    for (const item of SURVEY_ITEMS) {
      const v = valueOf(item.code);
      const done = Boolean(v.answer || v.choice);
      if (done) answered += 1;
      if (item.level === "P1") {
        p1Total += 1;
        if (done) p1Answered += 1;
      }
    }
    return { answered, p1Total, p1Answered, p1Missing: p1Total - p1Answered };
  }, [valueOf]);

  const keyword = search.trim().toLowerCase();
  const visible = useCallback(
    (code: string, level: string | undefined, text: string) => {
      const v = valueOf(code);
      const done = Boolean(v.answer || v.choice);
      if (filter === "p1" && level !== "P1") return false;
      if (filter === "todo" && done) return false;
      if (keyword && !`${code} ${text}`.toLowerCase().includes(keyword)) return false;
      return true;
    },
    [filter, keyword, valueOf],
  );

  return (
    <div className="space-y-3">
      {/* ===== Thanh trên: người trả lời + tiến độ + xuất file ===== */}
      <div className="erp-card space-y-3">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[220px] flex-1">
            <div className="erp-field-label">Người trả lời (tên + tổ)</div>
            <input
              className="erp-input"
              placeholder="Ví dụ: Anh Hùng — tổ Sơn"
              value={respondent}
              onChange={(event) => {
                setRespondent(event.target.value);
                window.localStorage.setItem("khao-sat-nguoi-tra-loi", event.target.value);
              }}
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {respondent.trim() ? null : (
              <span className="rounded-md bg-amber-50 px-2 py-1 text-[11.5px] font-medium text-amber-700 ring-1 ring-amber-200">
                Chưa ghi tên người trả lời — ghi vào để biết ai điền câu nào
              </span>
            )}
            <a className="erp-button" href="/api/survey/export?format=xlsx">
              Xuất Excel
            </a>
            <a className="erp-button-secondary" href="/api/survey/export?format=md">
              Xuất file gửi Zentor (.md)
            </a>
            <button className="erp-button-secondary" type="button" onClick={() => window.print()}>
              In / Lưu PDF
            </button>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
            <div className="text-[11px] uppercase tracking-wide text-slate-500">Đã trả lời</div>
            <div className="text-lg font-semibold text-slate-800">
              {stats.answered}/{SURVEY_TOTAL}
            </div>
            <div className="mt-1 h-1.5 w-full rounded bg-slate-200">
              <div
                className="h-1.5 rounded bg-cyan-500"
                style={{ width: `${Math.round((stats.answered / SURVEY_TOTAL) * 100)}%` }}
              />
            </div>
          </div>
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
            <div className="text-[11px] uppercase tracking-wide text-amber-700">Câu P1 còn thiếu</div>
            <div className="text-lg font-semibold text-amber-800">{stats.p1Missing}</div>
            <div className="text-[11px] text-amber-700">
              {stats.p1Answered}/{stats.p1Total} câu bắt buộc đã xong
            </div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
            <div className="text-[11px] uppercase tracking-wide text-slate-500">Tình trạng lưu</div>
            <div className="text-sm font-semibold text-slate-800">
              {saving ? "Đang lưu…" : savedAt ? `Đã lưu lúc ${savedAt}` : "Chưa có thay đổi"}
            </div>
            <button
              className="mt-1 text-[12px] font-medium text-cyan-700 underline"
              type="button"
              onClick={() => void save()}
            >
              Lưu ngay
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {FILTERS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={filter === item.id ? "erp-button" : "erp-button-secondary"}
              onClick={() => setFilter(item.id)}
            >
              {item.label}
            </button>
          ))}
          <input
            className="erp-input max-w-[260px]"
            placeholder="Tìm trong câu hỏi…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          {error ? <span className="erp-hint text-red-600">{error}</span> : null}
          {loading ? <span className="erp-hint">Đang tải…</span> : null}
        </div>

        <div className="flex flex-wrap gap-1.5">
          {SURVEY_SECTIONS.map((section) => {
            const total = section.groups.reduce((sum, g) => sum + g.items.length, 0);
            const done = section.groups.reduce(
              (sum, g) =>
                sum +
                g.items.filter((i) => {
                  const v = valueOf(i.code);
                  return Boolean(v.answer || v.choice);
                }).length,
              0,
            );
            return (
              <a
                key={section.id}
                href={`#sec-${section.id}`}
                title={`${section.title} — ${section.team}`}
                className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[12px] font-medium text-slate-600 hover:border-cyan-400 hover:text-cyan-700"
              >
                {section.id} · {done}/{total}
              </a>
            );
          })}
        </div>
      </div>

      {/* ===== Toàn bộ câu hỏi: mỗi câu 1 dòng, câu hỏi trái — trả lời phải ===== */}
      {SURVEY_SECTIONS.map((section) => {
        const rows = section.groups.flatMap((group) =>
          group.items.map((item) => ({ item, group: group.title })),
        );
        const shown = rows.filter(({ item }) => visible(item.code, item.level, item.text));
        if (shown.length === 0) return null;
        return (
          <div key={section.id} id={`sec-${section.id}`} className="erp-card">
            <div className="mb-2 flex flex-wrap items-baseline gap-2 border-b border-slate-200 pb-2">
              <span className="erp-section-title">
                PHẦN {section.id}. {section.title}
              </span>
              <span className="erp-hint">Người trả lời: {section.team}</span>
            </div>

            <div className="divide-y divide-slate-100">
              {shown.map(({ item, group }) => {
                const v = valueOf(item.code);
                const saved = answers[item.code];
                const done = Boolean(v.answer || v.choice);
                const tooltip = [
                  item.why ? `Vì sao hỏi: ${item.why}` : "",
                  saved?.updatedBy ? `Đã trả lời: ${saved.updatedBy}` : "",
                  saved?.updatedAt ? `Lúc ${new Date(saved.updatedAt).toLocaleString("vi-VN")}` : "",
                ]
                  .filter(Boolean)
                  .join(" · ");

                return (
                  <div
                    key={item.code}
                    className="flex flex-wrap items-start gap-x-3 gap-y-1 py-1.5 hover:bg-slate-50/70"
                  >
                    {/* cột trái: mã + mức + câu hỏi (1 dòng) */}
                    <div className="flex min-w-0 flex-1 items-baseline gap-2">
                      <span className="shrink-0 rounded bg-slate-800 px-1.5 py-0.5 text-[10.5px] font-bold text-white">
                        {item.code}
                      </span>
                      <span
                        className={`shrink-0 rounded px-1.5 py-0.5 text-[9.5px] font-bold ${
                          item.level === "P1"
                            ? "bg-red-100 text-red-700"
                            : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        {item.level ?? "—"}
                      </span>
                      <span
                        className="truncate text-[12.5px] text-slate-800"
                        title={`${item.text}${tooltip ? `\n(${tooltip})` : ""}`}
                      >
                        {item.text}
                      </span>
                      {section.groups.length > 1 ? (
                        <span className="hidden shrink-0 text-[10.5px] text-slate-400 xl:inline">
                          {group.replace(/^[A-Z]\.\d+\.\s*/, "")}
                        </span>
                      ) : null}
                      {done ? (
                        <span
                          className="shrink-0 text-[10px] font-bold text-emerald-600"
                          title={tooltip}
                        >
                          ✓
                        </span>
                      ) : null}
                    </div>

                    {/* cột phải: ô trả lời */}
                    <div className="w-full shrink-0 sm:w-[380px]">
                      {item.kind === "choice" ? (
                        <div className="flex items-center gap-2">
                          {(item.options ?? []).map((option) => (
                            <label
                              key={option}
                              className="flex shrink-0 items-center gap-1 whitespace-nowrap text-[12px] text-slate-700"
                            >
                              <input
                                type="radio"
                                name={item.code}
                                checked={v.choice === option}
                                onChange={() => queue(item.code, { choice: option })}
                              />
                              {option}
                            </label>
                          ))}
                          {item.note ? (
                            <input
                              className="erp-input h-7 min-w-0 flex-1 text-[12px]"
                              placeholder="Ghi chú"
                              value={v.answer}
                              onChange={(event) => queue(item.code, { answer: event.target.value })}
                            />
                          ) : null}
                        </div>
                      ) : (
                        <input
                          className="erp-input h-7 w-full text-[12.5px]"
                          placeholder={item.hint ?? "Trả lời…"}
                          value={v.answer}
                          title={item.hint ?? ""}
                          onChange={(event) => queue(item.code, { answer: event.target.value })}
                        />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      <div className="erp-card">
        <div className="erp-hint">
          Trả lời xong (hoặc xong một phần) thì bấm <b>Xuất file gửi Zentor (.md)</b> hoặc{" "}
          <b>Xuất Excel</b> rồi gửi lại — Zentor đọc file đó, đối chiếu với bảng mặc định và lên phương án
          thiết kế module. Câu nào chưa rõ thì ghi “chưa rõ”, không cần bỏ trống.
        </div>
      </div>
    </div>
  );
}
