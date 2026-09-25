/** V100: định dạng dùng chung cho 2 cột màn Quản lý đơn hàng. */

/**
 * Ngày đơn/hạn giao lưu ở dạng DATE (không có giờ). Luôn định dạng theo UTC để không bị lệch
 * 1 ngày khi máy chủ ở múi giờ âm (ví dụ 22/09 00:00 UTC → 21/09 nếu format theo giờ địa phương).
 */
export function formatDate(value: Date | null | undefined) {
  return value ? new Intl.DateTimeFormat("vi-VN", { timeZone: "UTC" }).format(value) : "—";
}

export function formatNumber(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 3 }).format(value);
}

export function formatDecimal(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value) || value <= 0) return "—";
  return new Intl.NumberFormat("vi-VN", { minimumFractionDigits: 0, maximumFractionDigits: 4 }).format(value);
}

export function formatMoney(value: unknown) {
  if (value === null || value === undefined || value === "") return "—";
  const number = Number(String(value));
  return Number.isFinite(number)
    ? `${new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 0 }).format(number)} đ`
    : "—";
}

/** Rút gọn tiền cho thẻ KPI: 1,28 tỷ · 48,2 triệu · 320 nghìn. */
export function formatMoneyShort(value: unknown) {
  if (value === null || value === undefined || value === "") return "—";
  const number = Number(String(value));
  if (!Number.isFinite(number)) return "—";
  const abs = Math.abs(number);
  if (abs >= 1_000_000_000) return `${new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 2 }).format(number / 1_000_000_000)} tỷ`;
  if (abs >= 1_000_000) return `${new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 1 }).format(number / 1_000_000)} triệu`;
  if (abs >= 1_000) return `${new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 0 }).format(number / 1_000)} nghìn`;
  return formatMoney(number);
}

export function textOrDash(value: unknown) {
  const text = value === null || value === undefined ? "" : String(value).trim();
  return text || "—";
}

/** Đếm ngược tới hạn giao để cảnh báo trên danh sách. */
export function deliveryHint(requiredDeliveryDate: Date | null | undefined, today = new Date()) {
  if (!requiredDeliveryDate) return { text: "Chưa đặt hạn", tone: "muted" as const };
  // So sánh theo ngày (UTC) để không lệch ngày do múi giờ.
  const due = new Date(requiredDeliveryDate);
  const startOfToday = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  const startOfDue = Date.UTC(due.getUTCFullYear(), due.getUTCMonth(), due.getUTCDate());
  const days = Math.round((startOfDue - startOfToday) / 86_400_000);
  if (days < 0) return { text: `Trễ ${Math.abs(days)} ngày`, tone: "late" as const };
  if (days === 0) return { text: "Giao hôm nay", tone: "soon" as const };
  if (days <= 3) return { text: `Còn ${days} ngày`, tone: "soon" as const };
  return { text: `Giao ${formatDate(due)}`, tone: "normal" as const };
}
