import { redirect } from "next/navigation";

// V76: tab Danh mục cấu hình đã gộp vào tab CẤU HÌNH (/settings?tab=options).
export default function MasterOptionsPage() {
  redirect("/settings?tab=options");
}
