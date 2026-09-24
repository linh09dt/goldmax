import { redirect } from "next/navigation";

// V76: tab Cấu hình tính toán đã gộp vào tab CẤU HÌNH (/settings?tab=pricing).
export default function CalculationConfigPage() {
  redirect("/settings?tab=pricing");
}
