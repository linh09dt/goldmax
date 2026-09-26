/**
 * V142 — LỆNH SẢN XUẤT (mã lệnh) cho từng công đoạn.
 *
 * Mỗi bộ cửa phát ra: 1 lệnh CHA (bộ) + 3 lệnh CON (cánh · khung · phào) + 1 lệnh cho MỖI công đoạn.
 * Mã lệnh sinh theo **mẫu trong Cấu hình sản xuất** (`workOrderCodeTemplate`) để đổi được mà không sửa code.
 *
 * Module này THUẦN (không truy vấn DB) để test được và để SQL backfill chép lại đúng công thức.
 */

export type WorkOrderKind = "BO" | "CANH" | "KHUNG" | "PHAO" | "CONG_DOAN";

export const WORK_ORDER_KINDS: WorkOrderKind[] = ["BO", "CANH", "KHUNG", "PHAO", "CONG_DOAN"];

export const WORK_ORDER_KIND_LABELS: Record<WorkOrderKind, string> = {
  BO: "Lệnh cha (bộ cửa)",
  CANH: "Lệnh con · Cánh",
  KHUNG: "Lệnh con · Khung",
  PHAO: "Lệnh con · Phào",
  CONG_DOAN: "Lệnh công đoạn",
};

/** 3 lệnh con cố định của mỗi bộ (khớp `production_component_orders.kind`). */
export const COMPONENT_WORK_ORDER_KINDS: WorkOrderKind[] = ["CANH", "KHUNG", "PHAO"];

/**
 * Mẫu mặc định: `LSX-<mã đơn>-<bộ số>-<bước><phần>` — vd `LSX-26082201QN17DH01-1-40C`.
 *
 * Token dùng được: `{orderCode}` `{setNo}` `{set}`(id bộ) `{seq}` `{scope}` `{scopeShort}` `{stage}` `{kind}`.
 * `{seq:02}` = canh số 0 cho đủ 2 chữ số.
 *
 * ⚠️ Mã lệnh phải DUY NHẤT giữa mọi bộ, nên mẫu buộc phải có `{set}` — hoặc có CẢ `{orderCode}` và `{setNo}`
 * (vì `{orderCode}` một mình là giống nhau cho mọi bộ trong cùng một đơn). Xem `templateGuaranteesUniqueCodes`.
 */
export const DEFAULT_WORK_ORDER_CODE_TEMPLATE = "LSX-{orderCode}-{setNo}-{seq:02}{scopeShort}";

/** Cột `production_work_orders.code` là VARCHAR(220) — cắt mã dài hơn ở CẢ TS lẫn SQL cho khớp nhau. */
export const WORK_ORDER_CODE_MAX = 220;

export const WORK_ORDER_CODE_TOKENS = [
  "orderCode",
  "setNo",
  "set",
  "seq",
  "scope",
  "scopeShort",
  "stage",
  "kind",
] as const;

/** Chữ cái tắt của phần: Cánh = C · Khung = K · Phào = P · cả bộ = B. */
const SCOPE_SHORT: Record<string, string> = { CANH: "C", KHUNG: "K", PHAO: "P", BO: "B" };

export function scopeShortOf(scope: string | null | undefined, kind: WorkOrderKind = "CONG_DOAN"): string {
  const key = String(scope ?? "").trim().toUpperCase();
  if (key && SCOPE_SHORT[key]) return SCOPE_SHORT[key];
  // Lệnh cha / lệnh con lấy theo kind, để `{scopeShort}` luôn ra ký tự phân biệt được.
  return SCOPE_SHORT[kind] ?? "X";
}

export type WorkOrderCodeInput = {
  kind: WorkOrderKind;
  /** `production_sets.id` — dùng cho token `{set}` và làm dự phòng khi thiếu bộ số. */
  setId: number;
  orderCode?: string | null;
  setNo?: string | null;
  seq?: number | null;
  scope?: string | null;
  stageCode?: string | null;
};

/**
 * Sinh một mã lệnh theo mẫu. Không đảm bảo duy nhất một mình —
 * dùng `assignWorkOrderCodes` khi sinh cả loạt.
 */
export function renderWorkOrderCode(input: WorkOrderCodeInput, template: string = DEFAULT_WORK_ORDER_CODE_TEMPLATE): string {
  const pattern = String(template ?? "").trim() || DEFAULT_WORK_ORDER_CODE_TEMPLATE;
  const setNo = String(input.setNo ?? "").trim() || String(input.setId);
  const kind: WorkOrderKind = input.kind;
  const values: Record<string, string> = {
    orderCode: String(input.orderCode ?? "").trim(),
    setNo,
    set: String(input.setId),
    seq: String(kind === "CONG_DOAN" ? Math.max(0, Math.trunc(Number(input.seq ?? 0))) : 0),
    scope: String(input.scope ?? "").trim().toUpperCase() || (kind === "CONG_DOAN" ? "" : kind),
    scopeShort: scopeShortOf(input.scope, kind),
    stage: String(input.stageCode ?? "").trim().toUpperCase(),
    kind,
  };

  const rendered = pattern
    .replace(/\{(\w+)(?::(\d+))?\}/g, (_match, token: string, pad: string | undefined) => {
      const value = values[token];
      if (value === undefined) return "";
      if (pad) {
        const width = Math.max(1, Math.min(10, Number(pad)));
        const numeric = value.replace(/[^0-9]/g, "");
        return numeric ? numeric.padStart(width, "0") : value;
      }
      return value;
    })
    .toUpperCase()
    .replace(/\s+/g, "")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "")
    // Bỏ ký tự lạ (giữ A-Z, 0-9, -, _, ., /) để mã in ra không lỗi font/dễ đọc sai.
    .replace(/[^A-Z0-9\-_./]/g, "");

  const safe = rendered.replace(/-{2,}/g, "-").replace(/^-+|-+$/g, "");
  return (safe || `LSX-${kind}`).slice(0, WORK_ORDER_CODE_MAX);
}

/** Bộ không gắn mã đơn (nhập bộ đang dở) → dùng mã bộ nội bộ để mã lệnh vẫn duy nhất. */
export const FALLBACK_WORK_ORDER_CODE_TEMPLATE = "LSX-{set}-{seq:02}{scopeShort}";

/**
 * Chọn mẫu thật sự dùng cho một bộ:
 *   - mẫu không bảo đảm duy nhất → quay về mẫu theo MÃ BỘ (id bộ, luôn duy nhất);
 *   - mẫu cần `{orderCode}` mà bộ không có mã đơn (nhập bộ đang dở) → cũng quay về mẫu theo mã bộ.
 */
export function resolveWorkOrderTemplate(orderCode: string | null | undefined, template: string): string {
  const text = String(template ?? "").trim() || DEFAULT_WORK_ORDER_CODE_TEMPLATE;
  if (!templateGuaranteesUniqueCodes(text)) return FALLBACK_WORK_ORDER_CODE_TEMPLATE;
  if (/\{orderCode\}/.test(text) && !String(orderCode ?? "").trim()) return FALLBACK_WORK_ORDER_CODE_TEMPLATE;
  return text;
}

/**
 * Sinh mã cho CẢ LOẠT lệnh của một bộ: giữ đúng thứ tự đầu vào, tự thêm hậu tố `-2`, `-3`… nếu trùng
 * (mẫu rút gọn có thể làm 2 công đoạn ra cùng mã). Trả về mã đã duy nhất trong lô.
 */
export function assignWorkOrderCodes(inputs: WorkOrderCodeInput[], template: string = DEFAULT_WORK_ORDER_CODE_TEMPLATE): string[] {
  const used = new Set<string>();
  return inputs.map((input) => {
    const base = renderWorkOrderCode(input, template);
    let code = base;
    let counter = 2;
    while (used.has(code)) {
      const suffix = `-${counter}`;
      code = `${base.slice(0, WORK_ORDER_CODE_MAX - suffix.length)}${suffix}`;
      counter += 1;
    }
    used.add(code);
    return code;
  });
}

/** Danh sách lệnh cần có của một bộ, theo đúng thứ tự sinh: cha → 3 con → các công đoạn. */
export function workOrderCodeInputsForSet(args: {
  setId: number;
  orderCode?: string | null;
  setNo?: string | null;
  tasks: Array<{ seq?: number | null; scope?: string | null; stageCode?: string | null }>;
}): WorkOrderCodeInput[] {
  const shared = { setId: args.setId, orderCode: args.orderCode ?? null, setNo: args.setNo ?? null };
  return [
    { ...shared, kind: "BO" },
    ...COMPONENT_WORK_ORDER_KINDS.map((kind) => ({ ...shared, kind })),
    ...args.tasks.map((task) => ({
      ...shared,
      kind: "CONG_DOAN" as WorkOrderKind,
      seq: task.seq ?? null,
      scope: task.scope ?? null,
      stageCode: task.stageCode ?? null,
    })),
  ];
}

/**
 * Mẫu có bảo đảm duy nhất giữa các BỘ không?
 *   - có `{set}` (id bộ) → luôn duy nhất;
 *   - hoặc có CẢ `{orderCode}` và `{setNo}` → duy nhất, vì mã đơn là duy nhất và bộ số là duy nhất trong một đơn
 *     (app chặn 2 bộ cùng số trong một đơn khi đưa vào kế hoạch);
 *   - `{orderCode}` một mình thì KHÔNG: mọi bộ của cùng một đơn sẽ ra cùng bộ mã.
 */
export function templateGuaranteesUniqueCodes(template: string): boolean {
  const text = String(template ?? "");
  if (/\{set\}/.test(text)) return true;
  return /\{orderCode\}/.test(text) && /\{setNo\}/.test(text);
}

/** Cảnh báo (nếu có) khi người dùng lưu mẫu mã lệnh trong Cấu hình. Trả `null` = hợp lệ. */
export function validateWorkOrderCodeTemplate(template: string): string | null {
  const text = String(template ?? "").trim();
  if (!text) return "Mẫu mã lệnh không được để trống.";
  if (text.length > 120) return "Mẫu mã lệnh quá dài (tối đa 120 ký tự).";
  const tokens = Array.from(text.matchAll(/\{(\w+)(?::\d+)?\}/g)).map((match) => match[1]);
  if (!tokens.length) return "Mẫu mã lệnh phải có ít nhất một token, ví dụ {orderCode} hoặc {setNo}.";
  const unknown = tokens.filter((token) => !(WORK_ORDER_CODE_TOKENS as readonly string[]).includes(token));
  if (unknown.length) return `Token không hợp lệ: ${unknown.map((token) => `{${token}}`).join(", ")}.`;
  if (!templateGuaranteesUniqueCodes(text)) {
    return "Mẫu phải có {set} — hoặc có CẢ {orderCode} và {setNo} — để mã lệnh không trùng giữa các bộ.";
  }
  return null;
}
