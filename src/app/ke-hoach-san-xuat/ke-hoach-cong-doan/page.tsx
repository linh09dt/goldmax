import { redirect } from "next/navigation";

/**
 * V157 — Màn này đã ĐỔI TÊN thành **"Xếp lịch toàn xưởng"** (`/ke-hoach-san-xuat/xep-lich-toan-xuong`)
 * để không lẫn với màn "Xếp việc theo công đoạn". Giữ đường dẫn cũ chuyển hướng
 * cho bookmark / link cũ không bị chết.
 */
export default function Page() {
  redirect("/ke-hoach-san-xuat/xep-lich-toan-xuong");
}
