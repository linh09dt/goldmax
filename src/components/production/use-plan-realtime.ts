"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

/**
 * V152 — REALTIME cho mọi màn liên quan kế hoạch sản xuất.
 *
 * Cách làm: client hỏi **token phiên bản** (`/api/production/plan-version`) mỗi vài giây — câu này
 * rất nhẹ (1 SQL đếm + max(updated_at)). Khi token ĐỔI (ai đó thêm/bớt bộ, báo xong, nhập đơn mới…)
 * thì tải lại ngay. ⇒ **Không cần F5**, không cần bấm nút xong rồi refresh trang.
 *
 * Vì sao dùng polling chứ không phải websocket: chạy được trên Vercel serverless, không cần thêm
 * dịch vụ/thư viện, không phải mở quyền Supabase Realtime. Muốn "đẩy" thật (0 độ trễ) thì sau này
 * chỉ cần đổi ruột hàm này sang Supabase Realtime — không phải sửa các màn.
 */

export const PLAN_POLL_MS = 5000;

/** Theo dõi token phiên bản; token đổi thì gọi `onChange`. */
export function usePlanVersion(
  onChange: () => void,
  options: { intervalMs?: number; enabled?: boolean } = {},
) {
  const handler = useRef(onChange);
  useEffect(() => {
    handler.current = onChange;
  }, [onChange]);

  const intervalMs = options.intervalMs ?? PLAN_POLL_MS;
  const enabled = options.enabled !== false;

  useEffect(() => {
    if (!enabled) return;
    let stopped = false;
    let last: string | null = null;

    const tick = async () => {
      try {
        const response = await fetch("/api/production/plan-version", { cache: "no-store" });
        if (!response.ok) return;
        const payload = (await response.json()) as { version?: string };
        if (stopped || !payload.version) return;
        if (last !== null && payload.version !== last) handler.current();
        last = payload.version;
      } catch {
        // Mất mạng tạm thời → bỏ qua lượt này, lượt sau thử lại.
      }
    };

    void tick();
    const timer = setInterval(tick, intervalMs);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [enabled, intervalMs]);
}

/** Dùng trong TRANG SERVER: có thay đổi thì `router.refresh()` — nội dung tự cập nhật, không cần F5. */
export function usePlanAutoRefresh(options: { intervalMs?: number } = {}) {
  const router = useRouter();
  usePlanVersion(() => router.refresh(), options);
}
