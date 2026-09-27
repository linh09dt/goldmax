/**
 * V152 — ĐIỀU ĐỘ THỦ CÔNG THEO CÔNG ĐOẠN (logic thuần, không truy vấn DB).
 *
 * Nhà máy chốt 26/09/2026:
 *   • Người dùng được **tự tay thêm/bớt bộ** vào từng ngày của từng công đoạn (không chỉ xếp tự động).
 *   • **Danh sách đợi** của một công đoạn chỉ hiện những bộ đã **ĐỦ ĐIỀU KIỆN**:
 *     công đoạn trước **đã được lên kế hoạch** (có ngày kế hoạch) **hoặc đã báo hoàn thành thủ công**.
 *   • Thêm/bớt ở một công đoạn ⇒ **mọi công đoạn PHÍA SAU bị xoá khỏi kế hoạch ngay lập tức**
 *     (vì ngày của chúng đã dựa trên công đoạn vừa đổi).
 *
 * Module THUẦN để test được và dùng chung server/UI.
 */

import type { ProductionStageRow, ProductionTaskRow } from "@/lib/production/catalog";

export type TaskPlanRow = Pick<
  ProductionTaskRow,
  "id" | "setId" | "stageCode" | "seq" | "scope" | "status" | "plannedStart" | "plannedEnd" | "stageKind"
>;

/** Trạng thái coi như đã xong (không cần lên kế hoạch nữa). */
export function isTaskClosed(status: string): boolean {
  return status === "XONG" || status === "BO_QUA";
}

/** Task đã được lên kế hoạch (có ngày kế hoạch). */
export function isTaskPlanned(task: Pick<TaskPlanRow, "plannedStart">): boolean {
  return Boolean(task.plannedStart);
}

// ---------------------------------------------------------------------------
// 1) DANH SÁCH ĐỢI — điều kiện để một bộ vào danh sách đợi của công đoạn
// ---------------------------------------------------------------------------

export type WaitState = {
  /** Được phép lên kế hoạch ở công đoạn này. */
  waiting: boolean;
  /** Đang chờ những công đoạn nào (rỗng = đủ điều kiện). */
  waitingFor: string[];
};

/**
 * Điều kiện vào **danh sách đợi** của một công đoạn:
 *   task đó CHƯA được lên kế hoạch, CHƯA xong/bỏ qua, VÀ mọi công đoạn trong `requires_stage`
 *   đã **có ngày kế hoạch** HOẶC **đã được báo hoàn thành** (XONG/BO_QUA).
 *
 * Cùng quy tắc phạm vi như `taskUnlockState`: nếu công đoạn đang xét thuộc một phần
 * (CÁNH/KHUNG/PHAO) và công đoạn bắt buộc cũng có phần đó → chỉ cần phần đó.
 * Công đoạn bắt buộc không tồn tại trong bộ → coi như đã mở.
 */
export function waitStateOfTask(args: {
  task: Pick<TaskPlanRow, "id" | "stageCode" | "scope" | "status" | "plannedStart">;
  setTasks: Array<Pick<TaskPlanRow, "stageCode" | "scope" | "status" | "plannedStart">>;
  stageByCode: Map<string, Pick<ProductionStageRow, "code" | "requiresStage">>;
}): WaitState {
  const { task, setTasks, stageByCode } = args;
  if (isTaskClosed(task.status) || isTaskPlanned(task)) return { waiting: false, waitingFor: [] };

  const required = String(stageByCode.get(task.stageCode)?.requiresStage ?? "")
    .split(",")
    .map((code) => code.trim())
    .filter(Boolean);
  if (!required.length) return { waiting: true, waitingFor: [] };

  const waitingFor: string[] = [];
  for (const code of required) {
    const sameScope = setTasks.filter((row) => row.stageCode === code && row.scope === task.scope);
    const candidates = sameScope.length ? sameScope : setTasks.filter((row) => row.stageCode === code);
    if (!candidates.length) continue; // công đoạn bắt buộc không có trong bộ → coi như đã mở
    const satisfied = candidates.some((row) => isTaskClosed(row.status) || isTaskPlanned(row));
    if (!satisfied) waitingFor.push(code);
  }
  return { waiting: waitingFor.length === 0, waitingFor };
}

// ---------------------------------------------------------------------------
// 2) LAN TRUYỀN — thêm/bớt ở công đoạn này thì xoá kế hoạch các công đoạn PHÍA SAU
// ---------------------------------------------------------------------------

/**
 * Danh sách task của CÙNG BỘ cần **xoá khỏi kế hoạch** khi công đoạn `changedSeq` thay đổi:
 * mọi task ở **bước sau** (`seq` lớn hơn) đang **có ngày kế hoạch** và **chưa xong**.
 *
 * Vì sao xoá cả khi THÊM: ngày của công đoạn sau được tính từ công đoạn trước, nên vừa đổi
 * công đoạn trước là kế hoạch phía sau không còn đúng — phải để người dùng xếp lại.
 * KHÔNG xoá task đã `XONG` (đó là lịch sử thật, không phải kế hoạch).
 */
export function downstreamTasksToClear(
  setTasks: Array<Pick<TaskPlanRow, "id" | "seq" | "status" | "plannedStart">>,
  changedSeq: number,
  options: { excludeTaskId?: number } = {},
): number[] {
  return setTasks
    .filter((task) => task.id !== options.excludeTaskId)
    .filter((task) => task.seq > changedSeq)
    .filter((task) => task.status !== "XONG")
    .filter((task) => isTaskPlanned(task))
    .map((task) => task.id);
}

// ---------------------------------------------------------------------------
// 3) TỔNG HỢP NGÀY KẾ HOẠCH CỦA CẢ BỘ (min → max, chỉ tính task còn hiệu lực)
// ---------------------------------------------------------------------------

export function setPlanRange(
  setTasks: Array<Pick<TaskPlanRow, "status" | "plannedStart" | "plannedEnd" | "stageKind">>,
): { start: Date | null; end: Date | null } {
  let start: Date | null = null;
  let end: Date | null = null;
  for (const task of setTasks) {
    if (isTaskClosed(task.status) || task.stageKind === "CHO") continue;
    if (!task.plannedStart) continue;
    const from = task.plannedStart;
    const to = task.plannedEnd ?? task.plannedStart;
    if (!start || from.getTime() < start.getTime()) start = from;
    if (!end || to.getTime() > end.getTime()) end = to;
  }
  return { start, end };
}
