"use client";

import { usePlanAutoRefresh } from "@/components/production/use-plan-realtime";

/**
 * V152 — Gắn vào một TRANG SERVER là trang đó tự cập nhật khi dữ liệu kế hoạch đổi.
 * Không render gì. Dùng: `<PlanAutoRefresh />` trong JSX của page.
 */
export function PlanAutoRefresh({ intervalMs }: { intervalMs?: number }) {
  usePlanAutoRefresh(intervalMs ? { intervalMs } : {});
  return null;
}
