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
  COMPONENT_KINDS,
  componentQuantities,
  DEFAULT_PARTS,
  isStageSkippedForSet,
  parseScopeParts,
  STAGE,
  type ComponentKind,
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

/**
 * Số lượng của một công đoạn theo phạm vi (V136.1 — nhà máy chốt 26/09/2026):
 *   - CÁNH = số cánh × số bộ
 *   - KHUNG = số bộ
 *   - PHÀO  = (phào rời + phào biệt thự) × số bộ
 *   - CẢ BỘ = số bộ
 */
function qtyForScope(set: ProductionSetRow, scope: TaskScope, config: ProductionConfig): number {
  const sets = Number.isFinite(Number(set.quantity)) && Number(set.quantity) > 0 ? Math.trunc(Number(set.quantity)) : 1;
  const quantities = componentQuantities(set, { cuaDi: config.defaultTrimCuaDi, cuaSo: config.defaultTrimCuaSo });
  switch (scope) {
    case "CANH":
      return quantities.CANH;
    case "PHAO":
      return quantities.PHAO;
    case "KHUNG":
      return quantities.KHUNG;
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
  // V139: công đoạn CỐ ĐỊNH một bộ phận (vd CAT_CANH chỉ làm cho cánh).
  if (stage.scopeMode === "PART") {
    const parts = parseScopeParts(stage.scopeParts);
    return [parts[0] ?? "CANH"];
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
        qtyExpected: qtyForScope(set, scope, config),
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
  drafts: Array<Pick<TaskDraft, "stageCode" | "seq" | "status">>,
  stages: ProductionStageRow[],
  config: ProductionConfig,
): number {
  const byCode = new Map(stages.map((stage) => [stage.code, stage]));
  const durations: number[] = [];
  // V139: các công đoạn CÙNG BƯỚC (cùng `seq`) chạy SONG SONG → chỉ tính 1 lần.
  const seen = new Set<number>();
  for (const draft of drafts) {
    if (draft.status === "BO_QUA") continue;
    if (seen.has(draft.seq)) continue;
    seen.add(draft.seq);
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

// ---------------------------------------------------------------------------
// LỆNH SẢN XUẤT CON (V136.1): mỗi bộ cửa tách thành ĐÚNG 3 lệnh con.
// ---------------------------------------------------------------------------

export type ComponentOrderDraft = { kind: ComponentKind; qtyExpected: number };

/**
 * Ba lệnh con của một bộ cửa + số lượng:
 *   CÁNH = số cánh × số bộ · KHUNG = số bộ · PHÀO = (phào rời + phào biệt thự) × số bộ.
 */
export function buildComponentOrderDrafts(set: ProductionSetRow, config: ProductionConfig): ComponentOrderDraft[] {
  const quantities = componentQuantities(set, { cuaDi: config.defaultTrimCuaDi, cuaSo: config.defaultTrimCuaSo });
  return COMPONENT_KINDS.map((kind) => ({ kind, qtyExpected: quantities[kind] }));
}
