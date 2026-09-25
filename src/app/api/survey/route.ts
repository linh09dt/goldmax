import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { SURVEY_ITEM_MAP } from "@/lib/survey-questions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_ANSWER = 4000;
const MAX_CHOICE = 40;
const CHUNK = 200;

type IncomingAnswer = { code?: unknown; answer?: unknown; choice?: unknown };

function clean(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, max);
}

/** GET /api/survey — trả về toàn bộ câu trả lời đã lưu (1 truy vấn). */
export async function GET() {
  const rows = await prisma.surveyAnswer.findMany({ orderBy: { code: "asc" } });
  const answers: Record<
    string,
    { answer: string | null; choice: string | null; updatedBy: string | null; updatedAt: string }
  > = {};
  for (const row of rows) {
    answers[row.code] = {
      answer: row.answer,
      choice: row.choice,
      updatedBy: row.updatedBy,
      updatedAt: row.updatedAt.toISOString(),
    };
  }
  return Response.json({ ok: true, answers });
}

/**
 * POST /api/survey — lưu câu trả lời (chỉ lưu các câu có thay đổi).
 * V126: gom MỘT lượt ghi cho cả bảng bằng INSERT ... ON CONFLICT (bài học V111: DB remote
 * mỗi lượt ~50-100 ms nên không được ghi từng dòng).
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as
    | { respondent?: unknown; answers?: unknown }
    | null;

  const respondent = clean(body?.respondent, 120);
  const incoming = Array.isArray(body?.answers) ? (body?.answers as IncomingAnswer[]) : [];
  if (incoming.length === 0) {
    return Response.json({ ok: true, saved: 0 });
  }

  const rows: { code: string; answer: string | null; choice: string | null }[] = [];
  const seen = new Set<string>();
  for (const item of incoming) {
    const code = typeof item.code === "string" ? item.code.trim() : "";
    if (!code || seen.has(code) || !SURVEY_ITEM_MAP[code]) continue;
    const definition = SURVEY_ITEM_MAP[code];
    const answer = clean(item.answer, MAX_ANSWER);
    const choice = definition.kind === "choice" ? clean(item.choice, MAX_CHOICE) : null;
    if (answer === null && choice === null) continue;
    seen.add(code);
    rows.push({ code, answer, choice });
  }

  if (rows.length === 0) {
    return Response.json({ ok: true, saved: 0 });
  }

  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    await prisma.$executeRaw`
      INSERT INTO "survey_answers" ("code", "answer", "choice", "updated_by", "created_at", "updated_at")
      VALUES ${Prisma.join(
        chunk.map(
          (row) =>
            Prisma.sql`(${row.code}, ${row.answer}, ${row.choice}, ${respondent}, NOW(), NOW())`,
        ),
      )}
      ON CONFLICT ("code") DO UPDATE SET
        "answer" = EXCLUDED."answer",
        "choice" = EXCLUDED."choice",
        "updated_by" = COALESCE(EXCLUDED."updated_by", "survey_answers"."updated_by"),
        "updated_at" = NOW()
    `;
  }

  return Response.json({ ok: true, saved: rows.length });
}
