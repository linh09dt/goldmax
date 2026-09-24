import { redirect } from "next/navigation";

// V76: tab Danh mục hàng hóa đã gộp vào tab CẤU HÌNH (/settings?tab=items).
export default function ItemsPage() {
  redirect("/settings?tab=items");
}
