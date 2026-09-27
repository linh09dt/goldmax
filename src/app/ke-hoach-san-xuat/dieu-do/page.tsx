import { redirect } from "next/navigation";

/**
 * V157 — Màn này đã ĐỔI TÊN thành **"Xếp việc theo công đoạn"** (`/ke-hoach-san-xuat/xep-viec-theo-cong-doan`)
 * để không lẫn với màn "Xếp lịch toàn xưởng". Giữ đường dẫn cũ chuyển hướng cho link cũ.
 */
export default function Page() {
  redirect("/ke-hoach-san-xuat/xep-viec-theo-cong-doan");
}
