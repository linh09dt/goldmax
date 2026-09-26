/**
 * V136 — Sinh danh sách CÔNG ĐOẠN cho một BỘ CỬA (routing).
 *
 * Đầu vào: 1 bộ (`production_sets`) + danh mục công đoạn (`production_stages`) + cấu hình.
 * Đầu ra: danh sách dòng để ghi vào `production_tasks` (1 dòng = 1 bộ × 1 công đoạn).
 *
 * Hàm THUẦN — không truy vấn DB, dễ kiểm thử.
 */

import {
  canhEquivalentOf,
  DEFAULT_PARTS,
  isStageSkippedForSet,
  parseScopeParts,
  STAGE,
  type ProductionSetRow,
  type ProductionStageRow,
  type TaskScope,
  type TaskStatus,
} from "@/lib/production/catalog";
import type { ProductionConfig } from "@/lib/production/config";

export type TaskDraft = {
  stageCode: string;
  stageKind: string;
  scope: TaskScope;
  seq: number;
  workCenterCode: string | null;
  qtyExpected: number | null;
  status: TaskStatus;
};

/** Công đoạn được dùng: đang bật + (nếu tắt chờ thì bỏ công đoạn CHỜ), sắp theo `seq`. */
export function applicableStages(stages: ProductionStageRow[], config: ProductionConfig): ProductionStageRow[] {
  return stages
    .filter((stage) => stage.active)
    .filter((stage) => (config.waitsEnabled ? true : stage.kind !== "CHO"))
    .sort((a, b) => a.seq - b.seq || a.code.localeCompare(b.code));
}

function qtyForScope(set: ProductionSetRow, scope: TaskScope): number {
  const sets = Number.isFinite(Number(set.quantity)) && Number(set.quantity) > 0 ? Math.trunc(Number(set.quantity)) : 1;
  const leaves = Number.isFinite(Number(set.leavesPerSet)) && Number(set.leavesPerSet) > 0 ? Math.trunc(Number(set.leavesPerSet)) : 1;
  const trims = Number.isFinite(Number(set.trimBarsPerSet)) && Number(set.trimBarsPerSet) > 0 ? Math.trunc(Number(set.trimBarsPerSet)) : 1;
  switch (scope) {
    case "CANH":
      return leaves * sets;
    case "PHAO":
      return trims * sets;
    case "KHUNG":
    case "BO":
    default:
      return sets;
  }
}

/** Các bộ phận mà công đoạn này tác động tới. */
export function scopesOfStage(stage: ProductionStageRow): TaskScope[] {
  if (stage.scopeMode === "PARTS") {
    const parts = parseScopeParts(stage.scopeParts);
    return parts.length ? parts : DEFAULT_PARTS;
  }
  // BO và MODEL đều theo dõi ở mức cả bộ (MODEL chỉ nghĩa là thời lượng tái dùng theo model).
  return ["BO"];
}

export type BuildTaskDraftsOptions = {
  set: ProductionSetRow;
  stages: ProductionStageRow[];
  config: ProductionConfig;
  /**
   * Model đã có chương trình máy cắt (bảng `production_programs`) → công đoạn Bồi Lares
   * được đánh dấu BO_QUA thay vì bắt làm lại (V121: chương trình tái dùng được).
   */
  modelHasProgram?: boolean;
};

export function buildTaskDrafts({ set, stages, config, modelHasProgram = false }: BuildTaskDraftsOptions): TaskDraft[] {
  const drafts: TaskDraft[] = [];
  for (const stage of applicableStages(stages, config)) {
    const skippedByCondition = isStageSkippedForSet(stage, set);
    const reuseProgram = stage.code === STAGE.BOI_LARES && modelHasProgram;
    const status: TaskStatus = skippedByCondition || reuseProgram ? "BO_QUA" : "CHUA_LAM";
    for (const scope of scopesOfStage(stage)) {
      drafts.push({
        stageCode: stage.code,
        stageKind: stage.kind,
        scope,
        seq: stage.seq,
        workCenterCode: stage.workCenterCode,
        qtyExpected: qtyForScope(set, scope),
        status,
      });
    }
  }
  return drafts;
}

/**
 * Tổng thời lượng đường găng của một bộ (giờ) theo danh sách công đoạn áp dụng.
 * `overlapHoursPerStep` = gối công đoạn (C6 nói xưởng gối 1 ngày → đặt 24).
 */
export function totalLeadTimeHours(
  drafts: Array<Pick<TaskDraft, "stageCode" | "status">>,
  stages: ProductionStageRow[],
  config: ProductionConfig,
): number {
  const byCode = new Map(stages.map((stage) => [stage.code, stage]));
  const durations: number[] = [];
  const seen = new Set<string>();
  for (const draft of drafts) {
    if (draft.status === "BO_QUA") continue;
    // Một công đoạn tách 3 bộ phận (khung/cánh/phào) chạy SONG SONG → chỉ tính 1 lần.
    if (seen.has(draft.stageCode)) continue;
    seen.add(draft.stageCode);
    const stage = byCode.get(draft.stageCode);
    if (!stage) continue;
    durations.push(Math.max(0, Number(stage.leadTimeHours) || 0));
  }
  const total = durations.reduce((sum, value) => sum + value, 0);
  const overlap = Math.max(0, Number(config.overlapHoursPerStep) || 0);
  const overlapTotal = overlap * Math.max(0, durations.length - 1);
  return Math.max(0, total - overlapTotal);
}

/** Số cánh quy đổi của bộ — dùng để tính tải (V136 mục 4.2). */
export function canhOf(set: ProductionSetRow): number {
  const stored = Number(set.canhEquivalent);
  if (Number.isFinite(stored) && stored > 0) return Math.trunc(stored);
  return canhEquivalentOf(set);
}
