import { NextResponse } from "next/server";
import { markSetDelivered, parseIsoDateStrict, rebuildTasksForSet, startProductionForSet, updateSetProgress, type ComponentPatch, type TaskPatch } from "@/lib/production/service";
import { TASK_STATUS_OPTIONS, type TaskStatus } from "@/lib/production/catalog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_STATUS = new Set<string>(TASK_STATUS_OPTIONS);

function text(value: unknown, max = 2000): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, max) : null;
}

/** V137: số lượng lệnh con do người dùng sửa tay. Cho phép null = để trống. */
function normalizeComponentPatches(value: unknown): ComponentPatch[] {
  if (!Array.isArray(value)) return [];
  const patches: ComponentPatch[] = [];
  for (const raw of value) {
    if (!raw || typeof raw !== "object") continue;
    const row = raw as Record<string, unknown>;
    const id = Number(row.id);
    if (!Number.isInteger(id) || id <= 0) continue;
    const qty = row.qtyExpected === null || row.qtyExpected === "" || row.qtyExpected === undefined ? null : Number(row.qtyExpected);
    patches.push({ id, qtyExpected: qty !== null && Number.isFinite(qty) && qty >= 0 ? qty : null });
  }
  return patches;
}

function normalizeTaskPatches(value: unknown): TaskPatch[] {
  if (!Array.isArray(value)) return [];
  const patches: TaskPatch[] = [];
  for (const raw of value) {
    if (!raw || typeof raw !== "object") continue;
    const row = raw as Record<string, unknown>;
    const id = Number(row.id);
    if (!Number.isInteger(id) || id <= 0) continue;
    const status = typeof row.status === "string" && VALID_STATUS.has(row.status) ? (row.status as TaskStatus) : undefined;
    patches.push({
      id,
      status,
      actualStart: text(row.actualStart, 40),
      actualEnd: text(row.actualEnd, 40),
      // V141 — xếp lịch bằng tay: gán ngày kế hoạch cho công đoạn (undefined = không đổi, null = xoá).
      plannedStart: row.plannedStart === undefined ? undefined : text(row.plannedStart, 40),
      note: text(row.note),
      reasonCode: text(row.reasonCode, 40),
      assignee: text(row.assignee, 120),
      isRework: row.isRework === true ? true : undefined,
    });
  }
  return patches;
}

/**
 * V136 — Cập nhật tiến độ một bộ cửa.
 *
 * Body:
 *   { action: "update", tasks: [{ id, status, note, reasonCode, assignee, isRework }],
 *     components: [{ id, qtyExpected }],   ← V137: sửa tay số lượng lệnh con (cánh/khung/phào)
 *     plannedStart, plannedEnd, note, planId, materialReady, programReady, byName }
 *   { action: "delivered", deliveredDate, byName }
 *   { action: "rebuild" }   ← sinh lại công đoạn theo danh mục mới nhất
 *
 * Ghi gộp: toàn bộ công đoạn trong MỘT lượt ghi (bài học V111).
 */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const setId = Number(id);
    if (!Number.isInteger(setId) || setId <= 0) {
      return NextResponse.json({ ok: false, error: "ID bộ cửa không hợp lệ." }, { status: 400 });
    }

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const action = String(body.action ?? "update");

    if (action === "rebuild") {
      const result = await rebuildTasksForSet(setId);
      return NextResponse.json({ ok: true, ...result });
    }

    if (action === "delivered") {
      const byName = text(body.byName, 120);
      await markSetDelivered(setId, text(body.deliveredDate, 40), byName);
      return NextResponse.json({ ok: true });
    }

    // V144 — ĐƯA VÀO SẢN XUẤT: 1 mốc ngày bắt đầu → tự suy target cho mọi công đoạn.
    if (action === "start") {
      const startDate = parseIsoDateStrict(text(body.startDate, 40));
      if (!startDate) {
        return NextResponse.json(
          { ok: false, error: "Ngày bắt đầu sản xuất không hợp lệ (cần dạng YYYY-MM-DD và phải có thật trong lịch)." },
          { status: 400 },
        );
      }
      try {
        const result = await startProductionForSet(setId, startDate, text(body.byName, 120));
        return NextResponse.json({
          ok: true,
          start: result.start.toISOString().slice(0, 10),
          end: result.end.toISOString().slice(0, 10),
          totalDays: result.totalDays,
          tasks: result.tasks,
          startedSeq: result.startedSeq,
        });
      } catch (error) {
        return NextResponse.json(
          { ok: false, error: error instanceof Error ? error.message : "Không đưa được bộ vào sản xuất." },
          { status: 400 },
        );
      }
    }

    if (action !== "update") {
      return NextResponse.json({ ok: false, error: "Hành động không hợp lệ." }, { status: 400 });
    }

    const result = await updateSetProgress(setId, {
      tasks: normalizeTaskPatches(body.tasks),
      components: normalizeComponentPatches(body.components),
      plannedStart: body.plannedStart === undefined ? undefined : text(body.plannedStart, 40),
      plannedEnd: body.plannedEnd === undefined ? undefined : text(body.plannedEnd, 40),
      note: body.note === undefined ? undefined : text(body.note),
      planId: body.planId === undefined ? undefined : Number.isInteger(Number(body.planId)) ? Number(body.planId) : null,
      materialReady: typeof body.materialReady === "boolean" ? body.materialReady : undefined,
      programReady: typeof body.programReady === "boolean" ? body.programReady : undefined,
      byName: text(body.byName, 120),
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("Update production set failed:", error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Không thể cập nhật tiến độ." },
      { status: 400 },
    );
  }
}
