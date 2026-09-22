import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ERP Sản xuất cửa",
  description: "Hệ thống quản lý đơn hàng và sản xuất cửa",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  );
}
