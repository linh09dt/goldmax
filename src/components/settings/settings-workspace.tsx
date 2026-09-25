"use client";

import { useCallback, useMemo, useState } from "react";
import { ItemMaster } from "@/components/item-master";
import { MasterOptions } from "@/components/master-options";
import { CalculationConfigEditor } from "@/components/calculation-config";
import { SETTINGS_TAB_GROUPS, type SettingsTabKey } from "@/components/settings/settings-tabs";

export function SettingsWorkspace({ initialTab = "items" }: { initialTab?: SettingsTabKey }) {
  const [tab, setTab] = useState<SettingsTabKey>(initialTab);
  const [visited, setVisited] = useState<SettingsTabKey[]>([initialTab]);
  const [summaries, setSummaries] = useState<Partial<Record<SettingsTabKey, string>>>({});

  const selectTab = useCallback((next: SettingsTabKey) => {
    setTab(next);
    setVisited((current) => (current.includes(next) ? current : [...current, next]));
    if (typeof window !== "undefined") {
      window.history.replaceState(null, "", `${window.location.pathname}?tab=${next}`);
    }
  }, []);

  // Callback ổn định theo từng khu vực để không kích hoạt effect của component con mỗi lần re-render.
  const summaryHandlers = useMemo(() => ({
    items: (text: string) => setSummaries((current) => (current.items === text ? current : { ...current, items: text })),
    options: (text: string) => setSummaries((current) => (current.options === text ? current : { ...current, options: text })),
  }), []);

  const activeTab = SETTINGS_TAB_GROUPS.flatMap((group) => group.tabs).find((item) => item.key === tab);

  return (
    <div className="space-y-4">
      <SettingsQuickNav tab={tab} onSelect={selectTab} summaries={summaries} />

      <div className="grid gap-4 xl:grid-cols-[252px_minmax(0,1fr)]">
        <SettingsSideNav tab={tab} onSelect={selectTab} summaries={summaries} />

        <div className="min-w-0">
          {activeTab ? (
            <div className="mb-3">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                Cấu hình / {activeTab.code}
              </div>
              <h2 className="mt-1 text-[19px] font-semibold tracking-tight text-slate-950">{activeTab.title}</h2>
            </div>
          ) : null}

          {visited.includes("items") ? (
            <div className={tab === "items" ? "block" : "hidden"}>
              <ItemMaster onSummary={summaryHandlers.items} />
            </div>
          ) : null}
          {visited.includes("options") ? (
            <div className={tab === "options" ? "block" : "hidden"}>
              <MasterOptions onSummary={summaryHandlers.options} />
            </div>
          ) : null}
          {visited.includes("pricing") ? (
            <div className={tab === "pricing" ? "block" : "hidden"}>
              <CalculationConfigEditor />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function SettingsSideNav({
  tab,
  onSelect,
  summaries,
}: {
  tab: SettingsTabKey;
  onSelect: (key: SettingsTabKey) => void;
  summaries: Partial<Record<SettingsTabKey, string>>;
}) {
  return (
    <nav className="hidden self-start xl:sticky xl:top-4 xl:block">
      <div className="erp-card">
        <div className="border-b border-slate-200 bg-slate-50 px-3 py-2">
          <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Khu vực cấu hình</div>
        </div>
        <div className="space-y-3 p-2.5">
          {SETTINGS_TAB_GROUPS.map((group) => (
            <div key={group.label}>
              <div className="px-1.5 pb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">{group.label}</div>
              <div className="space-y-1">
                {group.tabs.map((item) => {
                  const active = item.key === tab;
                  return (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => onSelect(item.key)}
                      aria-current={active ? "page" : undefined}
                      className={`flex w-full items-start gap-2 rounded-lg px-2 py-2 text-left transition ${
                        active ? "bg-cyan-50 ring-1 ring-cyan-300" : "hover:bg-slate-50"
                      }`}
                    >
                      <span
                        className={`mt-0.5 inline-flex h-5 min-w-8 items-center justify-center rounded text-[10px] font-bold ${
                          active ? "bg-cyan-600 text-white" : "bg-slate-200 text-slate-600"
                        }`}
                      >
                        {item.code}
                      </span>
                      <span className="min-w-0">
                        <span className={`block text-[12.5px] font-semibold leading-5 ${active ? "text-cyan-900" : "text-slate-800"}`}>
                          {item.title}
                        </span>
                        {summaries[item.key] ? (
                          <span className="mt-0.5 block text-[10.5px] text-slate-500">{summaries[item.key]}</span>
                        ) : null}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
      <p className="mt-2 px-1 text-[10.5px] leading-4 text-slate-500">{SETTINGS_TAB_GROUPS.map((group) => group.hint).join(" · ")}</p>
    </nav>
  );
}

function SettingsQuickNav({
  tab,
  onSelect,
  summaries,
}: {
  tab: SettingsTabKey;
  onSelect: (key: SettingsTabKey) => void;
  summaries: Partial<Record<SettingsTabKey, string>>;
}) {
  return (
    <div className="erp-card xl:hidden">
      <div className="grid gap-2 p-2 sm:grid-cols-2 xl:grid-cols-3">
        {SETTINGS_TAB_GROUPS.flatMap((group) =>
          group.tabs.map((item) => {
            const active = item.key === tab;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => onSelect(item.key)}
                className={`rounded-lg border px-3 py-2 text-left transition ${
                  active ? "border-cyan-400 bg-cyan-50" : "border-slate-200 bg-white"
                }`}
              >
                <span className="flex items-center gap-2">
                  <span className={`inline-flex h-5 min-w-8 items-center justify-center rounded text-[10px] font-bold ${active ? "bg-cyan-600 text-white" : "bg-slate-200 text-slate-600"}`}>
                    {item.code}
                  </span>
                  <span className="text-[12.5px] font-semibold text-slate-800">{item.title}</span>
                </span>
                <span className="mt-1 block text-[10.5px] text-slate-500">{summaries[item.key] ?? group.label}</span>
              </button>
            );
          }),
        )}
      </div>
    </div>
  );
}
