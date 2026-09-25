"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SURVEY_ITEMS, SURVEY_SECTIONS, SURVEY_TOTAL } from "@/lib/survey-questions";

/**
 * V126 — Phiếu khảo sát nhà máy (bộ câu hỏi V125) điền ngay trên app.
 * - Trả lời được lưu vào DB (bảng survey_answers), tự động lưu sau khi ngừng gõ.
 * - Xuất Excel hoặc file .md để gửi Zentor đọc và lên phương án.
 * - Xuống tới từng tổ/công đoạn; mỗi câu có mức P1 (bắt buộc) / P2.
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
  const [sectionId, setSectionId] = useState<string>(SURVEY_SECTIONS[0]?.id ?? "A");
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
      const now = new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
      setSavedAt(now);
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
  const sections = SURVEY_SECTIONS.filter((s) => s.id === sectionId);

  return (
    <div className="space-y-4">
      <div className="erp-card space-y-4">
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

        {error ? <div className="erp-hint text-red-600">{error}</div> : null}
        {loading ? <div className="erp-hint">Đang tải câu trả lời…</div> : null}

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
        </div>

        <div className="flex flex-wrap gap-1.5">
          {SURVEY_SECTIONS.map((section) => {
            const total = section.groups.reduce((sum, g) => sum + g.items.length, 0);
            const done = section.groups.reduce(
              (sum, g) => sum + g.items.filter((i) => {
                const v = valueOf(i.code);
                return Boolean(v.answer || v.choice);
              }).length,
              0,
            );
            const active = sectionId === section.id;
            return (
              <button
                key={section.id}
                type="button"
                onClick={() => setSectionId(section.id)}
                className={`rounded-full border px-3 py-1 text-[12px] font-medium transition ${
                  active
                    ? "border-cyan-500 bg-cyan-50 text-cyan-800"
                    : "border-slate-200 bg-white text-slate-600 hover:border-cyan-300"
                }`}
                title={section.team}
              >
                {section.id} · {done}/{total}
              </button>
            );
          })}
        </div>
      </div>

      {sections.map((section) => (
        <div key={section.id} className="erp-card space-y-3">
          <div>
            <div className="erp-section-title">
              PHẦN {section.id}. {section.title}
            </div>
            <div className="erp-hint">Người trả lời: {section.team}</div>
          </div>

          {section.groups.map((group) => {
            const items = group.items.filter((item) => {
              if (filter === "p1" && item.level !== "P1") return false;
              if (filter === "todo") {
                const v = valueOf(item.code);
                if (v.answer || v.choice) return false;
              }
              if (keyword && !`${item.code} ${item.text}`.toLowerCase().includes(keyword)) return false;
              return true;
            });
            if (items.length === 0) return null;
            return (
              <div key={`${section.id}-${group.title}`} className="space-y-2">
                {section.groups.length > 1 ? (
                  <div className="erp-subsection-title">{group.title}</div>
                ) : null}
                {items.map((item) => {
                  const v = valueOf(item.code);
                  return (
                    <div
                      key={item.code}
                      className="rounded-lg border border-slate-200 bg-white px-3 py-2.5"
                    >
                      <div className="flex flex-wrap items-baseline gap-2">
                        <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[11px] font-bold text-white">
                          {item.code}
                        </span>
                        {item.level ? (
                          <span
                            className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                              item.level === "P1"
                                ? "bg-red-100 text-red-700"
                                : "bg-slate-100 text-slate-600"
                            }`}
                          >
                            {item.level}
                          </span>
                        ) : null}
                        <span className="text-[13px] font-semibold text-slate-800">{item.text}</span>
                      </div>
                      {item.why ? <div className="erp-hint mt-1">{item.why}</div> : null}

                      {item.kind === "choice" ? (
                        <div className="mt-2 flex flex-wrap items-center gap-3">
                          {(item.options ?? []).map((option) => (
                            <label key={option} className="flex items-center gap-1.5 text-[13px]">
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
                              className="erp-input max-w-[320px]"
                              placeholder="Ghi chú thêm (nếu có)"
                              value={v.answer}
                              onChange={(event) => queue(item.code, { answer: event.target.value })}
                            />
                          ) : null}
                        </div>
                      ) : (
                        <textarea
                          className="erp-input mt-2 min-h-[62px] w-full"
                          placeholder={item.hint ?? "Trả lời…"}
                          value={v.answer}
                          onChange={(event) => queue(item.code, { answer: event.target.value })}
                        />
                      )}

                      {answers[item.code]?.updatedBy || answers[item.code]?.updatedAt ? (
                        <div className="mt-1 text-[11px] text-slate-400">
                          {answers[item.code]?.updatedBy ? `Đã trả lời: ${answers[item.code].updatedBy}` : "Đã lưu"}
                          {answers[item.code]?.updatedAt
                            ? ` · ${new Date(answers[item.code].updatedAt).toLocaleString("vi-VN")}`
                            : ""}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            );
          })}

          {section.groups.every((group) =>
            group.items.every((item) => {
              if (filter === "p1" && item.level !== "P1") return true;
              const v = valueOf(item.code);
              if (filter === "todo" && (v.answer || v.choice)) return true;
              if (keyword && !`${item.code} ${item.text}`.toLowerCase().includes(keyword)) return true;
              return false;
            }),
          ) ? (
            <div className="erp-hint">Không có câu nào khớp bộ lọc hiện tại.</div>
          ) : null}
        </div>
      ))}

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
