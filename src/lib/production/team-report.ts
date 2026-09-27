/**
 * V156 — BÁO CÁO SẢN XUẤT THEO TỔ (màn hình xưởng cho CÔNG NHÂN).
 *
 * Mục tiêu lấy từ nhà máy (26/09/2026):
 *   • Mỗi TỔ một màn hình; trong tổ chia theo CÔNG ĐOẠN.
 *   • Trên dòng chỉ cần: STT · Khách hàng · Lô · Bộ số · SL kế hoạch.
 *   • Bên cạnh: 4 nút BẮT ĐẦU · HOÀN THÀNH · LỖI · TẠM DỪNG — **1 chạm là xong**, không form, không popup.
 *   • Nhìn vào là biết ngay hàng ĐANG LÀM / LỖI / TẠM DỪNG / HOÀN THÀNH (màu + nền dòng).
 *   • Hiện THỰC TẾ HOÀN / KẾ HOẠCH và CẢNH BÁO nếu không kịp kế hoạch trong ngày.
 *
 * Module THUẦN — không truy vấn DB, test được, dùng lại được ở server lẫn UI.
 */

import { formatDateVn } from "@/lib/production/calendar";

// ---------------------------------------------------------------------------
// 1) BỐN HÀNH ĐỘNG CỦA CÔNG NHÂN (mỗi hành động = MỘT trạng thái công đoạn)
// ---------------------------------------------------------------------------

export type TaskAction = "BAT_DAU" | "HOAN_THANH" | "LOI" | "TAM_DUNG" | "HOAN_TAC";

export const TASK_ACTION_LABELS: Record<TaskAction, string> = {
  BAT_DAU: "Bắt đầu",
  HOAN_THANH: "Hoàn thành",
  LOI: "Lỗi",
  TAM_DUNG: "Tạm dừng",
  HOAN_TAC: "Hoàn tác",
};

/**
 * Trạng thái công đoạn sau khi bấm. `LOI` là trạng thái MỚI (V156) — trước đây chỉ có
 * cách ghi "lý do" nên công nhân ngại nhập; giờ bấm một nút là thành hàng LỖI và cả tổ nhìn thấy.
 * Hàng LỖI **không** được coi là xong ⇒ vẫn chặn công đoạn sau (đúng: lỗi thì phải làm lại).
 */
export function statusOfAction(action: Exclude<TaskAction, "HOAN_TAC">): string {
  return action === "BAT_DAU" ? "DANG_LAM" : action === "HOAN_THANH" ? "XONG" : action === "LOI" ? "LOI" : "TAM_DUNG";
}

/** Hành động có được phép với trạng thái hiện tại không (chặn bấm nhầm vô nghĩa). */
export function actionAllowed(action: TaskAction, currentStatus: string): boolean {
  if (currentStatus === "BO_QUA") return false;
  if (action === "HOAN_TAC") return currentStatus !== "CHUA_LAM";
  if (action === "BAT_DAU") return currentStatus !== "DANG_LAM";
  if (action === "HOAN_THANH") return currentStatus !== "XONG";
  if (action === "LOI") return currentStatus !== "LOI";
  return currentStatus !== "TAM_DUNG";
}

// ---------------------------------------------------------------------------
// 2) MÀU TRỰC QUAN — nhìn vào là biết, không cần đọc chữ
// ---------------------------------------------------------------------------

export type StatusHighlight = {
  /** Nhãn ngắn hiện trên chip. */
  label: string;
  /** Icon để nhận ra từ xa. */
  icon: string;
  /** Nền cả DÒNG trong bảng. */
  row: string;
  /** Chip trạng thái. */
  chip: string;
  /** Vạch màu bên trái dòng (đậm). */
  bar: string;
};

export const STATUS_HIGHLIGHTS: Record<string, StatusHighlight> = {
  CHUA_LAM: {
    label: "Chưa làm",
    icon: "○",
    row: "bg-white",
    chip: "bg-slate-100 text-slate-600 border-slate-300",
    bar: "bg-slate-300",
  },
  DANG_LAM: {
    label: "ĐANG LÀM",
    icon: "▶",
    row: "bg-amber-50",
    chip: "bg-amber-200 text-amber-900 border-amber-400",
    bar: "bg-amber-500",
  },
  XONG: {
    label: "HOÀN THÀNH",
    icon: "✔",
    row: "bg-emerald-50",
    chip: "bg-emerald-200 text-emerald-900 border-emerald-400",
    bar: "bg-emerald-500",
  },
  LOI: {
    label: "LỖI",
    icon: "⚠",
    row: "bg-red-50",
    chip: "bg-red-200 text-red-900 border-red-400",
    bar: "bg-red-500",
  },
  TAM_DUNG: {
    label: "TẠM DỪNG",
    icon: "⏸",
    row: "bg-slate-100",
    chip: "bg-slate-300 text-slate-800 border-slate-400",
    bar: "bg-slate-500",
  },
  BO_QUA: {
    label: "Bỏ qua",
    icon: "–",
    row: "bg-white opacity-60",
    chip: "bg-slate-100 text-slate-400 border-slate-200",
    bar: "bg-slate-200",
  },
};

export function highlightOf(status: string): StatusHighlight {
  return STATUS_HIGHLIGHTS[status] ?? STATUS_HIGHLIGHTS.CHUA_LAM;
}

/** Nhóm trạng thái để lọc nhanh trên màn hình ("Hàng đang làm", "Hàng lỗi"…). */
export type StatusFilter = "TAT_CA" | "CHUA_XONG" | "DANG_LAM" | "LOI" | "TAM_DUNG" | "XONG";

export const STATUS_FILTER_LABELS: Record<StatusFilter, string> = {
  TAT_CA: "Tất cả",
  CHUA_XONG: "Chưa xong",
  DANG_LAM: "Đang làm",
  LOI: "Lỗi",
  TAM_DUNG: "Tạm dừng",
  XONG: "Hoàn thành",
};

export function matchesFilter(status: string, filter: StatusFilter): boolean {
  if (filter === "TAT_CA") return true;
  if (filter === "CHUA_XONG") return status !== "XONG" && status !== "BO_QUA";
  return status === filter;
}

// ---------------------------------------------------------------------------
// 3) THỰC TẾ / KẾ HOẠCH TRONG NGÀY + CẢNH BÁO KHÔNG KỊP
// ---------------------------------------------------------------------------

/** Ca làm việc suy từ tổ: `shifts_per_day × hours_per_shift`, bắt đầu 08:00 giờ VN. */
export function shiftWindow(team: { shiftsPerDay?: number | null; hoursPerShift?: number | null }): {
  startMinutes: number;
  endMinutes: number;
} {
  const shifts = Math.max(1, Number(team.shiftsPerDay) || 1);
  const hours = Math.max(1, Number(team.hoursPerShift) || 8);
  const startMinutes = 8 * 60;
  return { startMinutes, endMinutes: Math.min(23 * 60 + 59, startMinutes + shifts * hours * 60) };
}

/** Phút trong ngày theo GIỜ VIỆT NAM (server Vercel chạy UTC — bài học V77). */
export function vietnamMinutesNow(now: Date = new Date()): number {
  const text = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Ho_Chi_Minh",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(now);
  const [hour, minute] = text.split(":").map((part) => Number(part));
  return (Number.isFinite(hour) ? hour : 0) * 60 + (Number.isFinite(minute) ? minute : 0);
}

export type DayProgress = {
  tone: "good" | "ok" | "warn" | "bad";
  /** Câu ngắn hiện to trên đầu công đoạn. */
  headline: string;
  /** Câu giải thích nhỏ bên dưới. */
  detail: string;
  planQty: number;
  doneQty: number;
  doingQty: number;
  errorQty: number;
  pauseQty: number;
  remaining: number;
  /** % hoàn thành so với kế hoạch (0…100+). */
  percent: number;
  /** Cần làm bao nhiêu mỗi giờ trong thời gian còn lại để kịp. */
  neededPerHour: number | null;
  /** Đang làm được bao nhiêu mỗi giờ (tính từ đầu ca). */
  actualPerHour: number | null;
};

/**
 * Đánh giá "hôm nay công đoạn này có kịp kế hoạch không".
 *
 * Nguyên tắc: so **thực tế đã hoàn** với **nhịp cần** ở thời điểm hiện tại —
 * không phải chỉ so tổng, vì 10 giờ sáng còn thiếu 50% là bình thường, nhưng 4 giờ chiều
 * còn thiếu 50% là không kịp.
 */
export function evaluateDayProgress(args: {
  planQty: number;
  doneQty: number;
  doingQty?: number;
  errorQty?: number;
  pauseQty?: number;
  /** Phút hiện tại trong ngày (giờ VN). */
  nowMinutes: number;
  startMinutes: number;
  endMinutes: number;
}): DayProgress {
  const planQty = Math.max(0, Number(args.planQty) || 0);
  const doneQty = Math.max(0, Number(args.doneQty) || 0);
  const doingQty = Math.max(0, Number(args.doingQty) || 0);
  const errorQty = Math.max(0, Number(args.errorQty) || 0);
  const pauseQty = Math.max(0, Number(args.pauseQty) || 0);
  const remaining = Math.max(0, planQty - doneQty);
  const percent = planQty > 0 ? Math.round((doneQty / planQty) * 100) : 0;

  const base: Omit<DayProgress, "tone" | "headline" | "detail" | "neededPerHour" | "actualPerHour"> = {
    planQty,
    doneQty,
    doingQty,
    errorQty,
    pauseQty,
    remaining,
    percent,
  };

  if (planQty <= 0) {
    return { ...base, tone: "ok", headline: "Không có việc hôm nay", detail: "Tổ chưa được xếp việc cho công đoạn này.", neededPerHour: null, actualPerHour: null };
  }
  if (remaining <= 0) {
    return {
      ...base,
      tone: "good",
      headline: "ĐẠT KẾ HOẠCH",
      detail: `Đã hoàn ${doneQty}/${planQty} (${percent}%)${errorQty > 0 ? ` · còn ${errorQty} hàng lỗi` : ""}.`,
      neededPerHour: 0,
      actualPerHour: null,
    };
  }

  const total = Math.max(1, args.endMinutes - args.startMinutes);
  const elapsed = Math.min(total, Math.max(0, args.nowMinutes - args.startMinutes));
  const left = Math.max(0, args.endMinutes - args.nowMinutes);
  const hoursLeft = left / 60;
  const hoursElapsed = elapsed / 60;
  const needRate = hoursLeft > 0 ? remaining / hoursLeft : null;
  const actualRate = hoursElapsed > 0 ? doneQty / hoursElapsed : null;
  const expectedByNow = (planQty * elapsed) / total;
  const canFinishWithWip = doneQty + doingQty >= planQty;

  if (args.nowMinutes >= args.endMinutes) {
    return {
      ...base,
      tone: "bad",
      headline: `HẾT GIỜ CA — CÒN THIẾU ${remaining}`,
      detail: `Đã hoàn ${doneQty}/${planQty} (${percent}%). Cần báo quản đốc để xử lý.`,
      neededPerHour: null,
      actualPerHour: actualRate,
    };
  }
  if (args.nowMinutes < args.startMinutes) {
    return {
      ...base,
      tone: "ok",
      headline: `Chưa vào ca — kế hoạch ${planQty}`,
      detail: `Ca làm ${timeLabel(args.startMinutes)}–${timeLabel(args.endMinutes)}.`,
      neededPerHour: null,
      actualPerHour: null,
    };
  }
  if (doneQty >= expectedByNow) {
    return {
      ...base,
      tone: "good",
      headline: `ĐÚNG TIẾN ĐỘ · ${percent}%`,
      detail: `Đã hoàn ${doneQty}/${planQty} · đang làm ${doingQty} · cần ${round1(needRate ?? 0)}/giờ trong ${round1(hoursLeft)} giờ còn lại.`,
      neededPerHour: needRate,
      actualPerHour: actualRate,
    };
  }
  if (canFinishWithWip) {
    return {
      ...base,
      tone: "warn",
      headline: `CHẬM — CÒN KỊP NẾU XONG HẾT HÀNG ĐANG LÀM`,
      detail: `Đã hoàn ${doneQty}/${planQty} · đang làm ${doingQty} · cần ${round1(needRate ?? 0)}/giờ, đang đạt ${round1(actualRate ?? 0)}/giờ.`,
      neededPerHour: needRate,
      actualPerHour: actualRate,
    };
  }
  const shortfall = Math.max(0, planQty - doneQty - doingQty);
  return {
    ...base,
    tone: "bad",
    headline: `⚠ KHÔNG KỊP KẾ HOẠCH — CÒN THIẾU ${shortfall}`,
    detail: `Đã hoàn ${doneQty}/${planQty} · đang làm ${doingQty} · còn ${round1(hoursLeft)} giờ mà phải làm ${round1(needRate ?? 0)}/giờ (đang đạt ${round1(actualRate ?? 0)}/giờ).`,
    neededPerHour: needRate,
    actualPerHour: actualRate,
  };
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function timeLabel(minutes: number): string {
  const pad = (value: number) => String(Math.max(0, Math.floor(value))).padStart(2, "0");
  return `${pad(minutes / 60)}:${pad(minutes % 60)}`;
}

// ---------------------------------------------------------------------------
// 4) CỘT "LÔ" — gom bộ thành LÔ để tổ gọi nhau cho dễ
// ---------------------------------------------------------------------------

/**
 * LÔ của một bộ trên báo cáo tổ.
 *
 * Thứ tự ưu tiên (có gì dùng nấy — xưởng chỉ cần một cái tên chung để gọi việc):
 *   1. **Lô sơn** (nhóm màu chính + chế độ nung) — khi công đoạn đang gom lô theo nhóm màu.
 *   2. **Mã lệnh sản xuất (LSX)** của bộ — `production_work_orders` kind = `BO`.
 *   3. **Lô giao** = `hạn giao` — nhóm các bộ giao cùng ngày (luôn có sẵn).
 *
 * `unit` = đơn vị tải của công đoạn, dùng để hiện SL kế hoạch cho đúng (cánh hay bộ).
 */
export function lotLabelOf(args: {
  /** Khoá nhóm lô sơn (từ `groupKeyOf`) hoặc null. */
  paintGroupKey?: string | null;
  /** Nhãn gọn của nhóm màu, vd "Đỏ 176°/20′". */
  paintGroupLabel?: string | null;
  /** Mã lệnh sản xuất của bộ (kind = BO). */
  workOrderCode?: string | null;
  dueDate?: Date | null;
}): { text: string; source: "LO_SON" | "LENH_SX" | "LO_GIAO" | "KHONG" } {
  if (args.paintGroupKey && args.paintGroupLabel) return { text: `Lô sơn ${args.paintGroupLabel}`, source: "LO_SON" };
  const code = String(args.workOrderCode ?? "").trim();
  if (code) return { text: code, source: "LENH_SX" };
  if (args.dueDate) return { text: `Lô giao ${formatDateVn(args.dueDate)}`, source: "LO_GIAO" };
  return { text: "—", source: "KHONG" };
}

// ---------------------------------------------------------------------------
// 5) CỘT "CÔNG ĐOẠN TRƯỚC" — công nhân nhìn là biết mình đã được phép làm chưa
// ---------------------------------------------------------------------------

/** Trạng thái gộp của (các) công đoạn trước. `KHONG_CO` = công đoạn này không chờ ai. */
export type PrevStatus = "KHONG_CO" | "CHUA_LAM" | "DANG_LAM" | "XONG" | "LOI" | "TAM_DUNG";

/**
 * Gộp trạng thái NHIỀU công đoạn trước thành 1 dòng hiện trên báo cáo.
 *
 * Thứ tự ưu tiên khi trộn: **Tạm dừng / Lỗi** (đang có vấn đề, cần biết ngay) → **Xong hết** (được phép làm)
 * → **Đang làm** (sắp xong) → **Chưa làm**.
 */
export function mergePrevStatus(rows: Array<{ status: string }>): PrevStatus {
  const counted = rows.filter((row) => row.status !== "BO_QUA");
  if (!counted.length) return "KHONG_CO";
  if (counted.some((row) => row.status === "TAM_DUNG")) return "TAM_DUNG";
  if (counted.some((row) => row.status === "LOI")) return "LOI";
  if (counted.every((row) => row.status === "XONG")) return "XONG";
  if (counted.some((row) => row.status === "DANG_LAM")) return "DANG_LAM";
  return "CHUA_LAM";
}

/**
 * Câu hiện ở cột "Công đoạn trước":
 *   • Xong  → **giờ hoàn thành** (kèm ngày nếu khác hôm nay, vd "Xong 26/09 14:32")
 *   • Đang làm → "Đang làm"
 *   • các trường hợp khác → nhãn trạng thái
 */
export function predecessorText(status: PrevStatus, doneAtIso: string | null, options: { now?: Date } = {}): string {
  switch (status) {
    case "KHONG_CO":
      return "—";
    case "XONG": {
      const label = vietnamDateTimeLabel(doneAtIso, options.now);
      return label ? `Xong ${label}` : "Đã xong";
    }
    case "DANG_LAM":
      return "Đang làm";
    case "TAM_DUNG":
      return "Tạm dừng";
    case "LOI":
      return "Lỗi";
    default:
      return "Chưa làm";
  }
}

/** Giờ theo GIỜ VIỆT NAM (server chạy UTC — không được dùng giờ máy). */
export function vietnamTimeLabel(iso: string | null | undefined): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Ho_Chi_Minh",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

/** `dd/mm HH:MM` giờ VN; nếu cùng ngày hôm nay thì chỉ hiện `HH:MM` cho gọn. */
export function vietnamDateTimeLabel(iso: string | null | undefined, now: Date = new Date()): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const time = vietnamTimeLabel(iso);
  const dayOf = (value: Date) =>
    new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit" }).format(value);
  if (dayOf(date) === dayOf(now)) return time;
  const day = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Ho_Chi_Minh", day: "2-digit", month: "2-digit" }).format(date);
  return `${day} ${time}`;
}
