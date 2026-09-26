import { ErpNav } from "@/components/erp-nav";
import { GlobalSearch } from "@/components/global-search";

export function ErpShell({
  title,
  subtitle,
  actions,
  children,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <div className="min-h-screen lg:grid lg:grid-cols-[250px_1fr]">
        <aside className="border-r border-slate-800 bg-slate-950 text-slate-100">
          <div className="sticky top-0 flex min-h-screen flex-col px-4 py-5">
            <div className="border-b border-slate-800 pb-5">
              <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-cyan-400">ERP sản xuất</div>
              <div className="mt-1.5 text-lg font-bold leading-tight">Quản lý sản xuất cửa</div>
            </div>

            <ErpNav />

            <div className="mt-auto pt-6 text-[10px] leading-4 text-slate-600">
              Dữ liệu nền và quy tắc tính toán nằm chung trong mục “Cấu hình”.
            </div>

          </div>
        </aside>

        <main className="min-w-0">
          <header className="border-b border-slate-200 bg-white px-4 py-4 shadow-sm md:px-6 xl:px-8">
            <div className="mx-auto flex max-w-[1800px] flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="min-w-0">
                <h1 className="erp-page-title truncate">{title}</h1>
                {subtitle ? <p className="erp-hint mt-0.5">{subtitle}</p> : null}
              </div>
              <GlobalSearch />
              {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
            </div>
          </header>
          <div className="mx-auto max-w-[1800px] px-4 py-6 md:px-6 xl:px-8">{children}</div>
        </main>
      </div>
    </div>
  );
}
