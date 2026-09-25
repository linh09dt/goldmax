"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type NavItem = {
  href: string;
  label: string;
  icon: React.ReactNode;
  isActive: (pathname: string) => boolean;
};

/**
 * V76: menu điều hướng ERP chia theo nhóm nghiệp vụ, có trạng thái đang mở.
 * Ba tab Danh mục hàng hóa / Danh mục cấu hình / Cấu hình tính toán được gộp
 * thành một mục "Cấu hình" duy nhất.
 */
const NAV_GROUPS: Array<{ label: string; items: NavItem[] }> = [
  {
    label: "Điều hành",
    items: [
      {
        href: "/",
        label: "Tổng quan",
        icon: <IconDashboard />,
        isActive: (pathname) => pathname === "/",
      },
      {
        href: "/orders",
        label: "Quản lý đơn hàng",
        icon: <IconOrder />,
        isActive: (pathname) => pathname.startsWith("/orders"),
      },
      {
        href: "/customers",
        label: "Thông tin khách hàng",
        icon: <IconUsers />,
        isActive: (pathname) => pathname.startsWith("/customers"),
      },
      {
        href: "/revenue",
        label: "Theo dõi doanh thu",
        icon: <IconChart />,
        isActive: (pathname) => pathname.startsWith("/revenue"),
      },
    ],
  },
  {
    label: "Danh mục & cấu hình",
    items: [
      {
        href: "/settings",
        label: "Cấu hình",
        icon: <IconSettings />,
        isActive: (pathname) =>
          pathname.startsWith("/settings") ||
          pathname.startsWith("/items") ||
          pathname.startsWith("/master-options") ||
          pathname.startsWith("/calculation-config"),
      },
    ],
  },
  {
    label: "Công cụ",
    items: [
      {
        href: "/khao-sat",
        label: "Khảo sát nhà máy",
        icon: <IconSurvey />,
        isActive: (pathname) => pathname.startsWith("/khao-sat"),
      },
      {
        href: "/cong-cu-anh",
        label: "Chuẩn hóa ảnh SP",
        icon: <IconImage />,
        isActive: (pathname) => pathname.startsWith("/cong-cu-anh"),
      },
      {
        href: "/shipping",
        label: "Tính cước vận chuyển",
        icon: <IconTruck />,
        isActive: (pathname) => pathname.startsWith("/shipping"),
      },
      {
        href: "/guide",
        label: "Hướng dẫn sử dụng",
        icon: <IconBook />,
        isActive: (pathname) => pathname.startsWith("/guide"),
      },
    ],
  },
];

export function ErpNav() {
  const pathname = usePathname() ?? "/";

  return (
    <nav className="mt-5 space-y-5">
      {NAV_GROUPS.map((group) => (
        <div key={group.label}>
          <div className="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            {group.label}
          </div>
          <div className="space-y-1">
            {group.items.map((item) => {
              const active = item.isActive(pathname);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`group flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-[13px] transition ${
                    active
                      ? "bg-cyan-500/15 text-white ring-1 ring-cyan-400/40"
                      : "text-slate-300 hover:bg-slate-800 hover:text-white"
                  }`}
                >
                  <span className={`shrink-0 ${active ? "text-cyan-300" : "text-slate-500 group-hover:text-slate-300"}`}>
                    {item.icon}
                  </span>
                  {/* V86: bỏ chú thích dưới từng mục menu — chỉ còn tên mục. */}
                  <span className="min-w-0 truncate font-medium leading-5">{item.label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}

function IconSurvey() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 3h6a1 1 0 0 1 1 1v1h2a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h2V4a1 1 0 0 1 1-1Z" />
      <path d="M8 11l2 2 4-4" />
    </svg>
  );
}

function IconDashboard() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="3" width="7" height="9" rx="1.5" />
      <rect x="14" y="3" width="7" height="5" rx="1.5" />
      <rect x="14" y="12" width="7" height="9" rx="1.5" />
      <rect x="3" y="16" width="7" height="5" rx="1.5" />
    </svg>
  );
}

function IconOrder() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M7 3h7l5 5v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" />
      <path d="M14 3v5h5" />
      <path d="M9 13h6M9 17h4" />
    </svg>
  );
}

function IconChart() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 20V6M4 20h16" />
      <path d="M8 20v-6M12 20v-9M16 20v-4M20 20v-8" />
    </svg>
  );
}

function IconSettings() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1Z" />
    </svg>
  );
}

function IconImage() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <circle cx="8.5" cy="9.5" r="1.6" />
      <path d="M4 17l4.5-4.5 3.5 3.5 3-3L20 17" />
    </svg>
  );
}

function IconTruck() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 7h10v9H3zM13 10h4l3 3v3h-7z" />
      <circle cx="7" cy="18" r="1.8" />
      <circle cx="17" cy="18" r="1.8" />
    </svg>
  );
}

function IconUsers() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3.5 20c0-3.1 2.5-5.3 5.5-5.3s5.5 2.2 5.5 5.3" />
      <path d="M16 5.5a3 3 0 0 1 0 5.6M17.5 14.9c1.9.6 3.2 2.3 3.2 4.4" />
    </svg>
  );
}

function IconBook() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H19v15H6.5A2.5 2.5 0 0 0 4 20.5z" />
      <path d="M19 18v3H6.5A2.5 2.5 0 0 1 4 18.5" />
    </svg>
  );
}
