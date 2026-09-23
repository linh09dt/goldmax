import Link from "next/link";

export function ErpShell({
  title,
  actions,
  children,
}: {
  title: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <div className="min-h-screen lg:grid lg:grid-cols-[250px_1fr]">
        <aside className="border-r border-slate-800 bg-slate-950 text-slate-100">
          <div className="sticky top-0 flex min-h-screen flex-col px-4 py-5">
            <div className="border-b border-slate-800 pb-5">
              <div className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-400">ERP sản xuất</div>
              <div className="mt-2 text-xl font-bold">Quản lý sản xuất cửa</div>
            </div>

            <nav className="mt-5 space-y-1 text-sm">
              <Nav href="/" label="Tổng quan" />
              <Nav href="/orders" label="Quản lý đơn hàng" />
              <Nav href="/revenue" label="Theo dõi doanh thu" />
              <Nav href="/items" label="Danh mục hàng hóa" />
              <Nav href="/master-options" label="Danh mục cấu hình" />
              <Nav href="/shipping" label="Tính cước vận chuyển" />
              <Nav href="/guide" label="Hướng dẫn sử dụng" />
            </nav>

          </div>
        </aside>

        <main className="min-w-0">
          <header className="border-b border-slate-200 bg-white px-4 py-5 shadow-sm md:px-6 xl:px-8">
            <div className="mx-auto flex max-w-[1800px] flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-slate-950 md:text-3xl">{title}</h1>
              </div>
              {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
            </div>
          </header>
          <div className="mx-auto max-w-[1800px] px-4 py-6 md:px-6 xl:px-8">{children}</div>
        </main>
      </div>
    </div>
  );
}

function Nav({ href, label }: { href: string; label: string }) {
  return (
    <Link className="block rounded-lg px-3 py-2.5 text-slate-300 transition hover:bg-slate-800 hover:text-white" href={href}>
      {label}
    </Link>
  );
}
