import ExcelJS from "exceljs";
import { prisma } from "@/lib/prisma";
import { SURVEY_SECTIONS } from "@/lib/survey-questions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type AnswerRow = {
  answer: string | null;
  choice: string | null;
  updatedBy: string | null;
  updatedAt: string;
};

function stamp(): string {
  const now = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}${p(now.getMonth() + 1)}${p(now.getDate())}-${p(now.getHours())}${p(now.getMinutes())}`;
}

function flatRows(answers: Record<string, AnswerRow>) {
  const rows: Array<{
    section: string;
    group: string;
    code: string;
    level: string;
    question: string;
    why: string;
    kind: string;
    answer: string;
    by: string;
    at: string;
  }> = [];
  for (const section of SURVEY_SECTIONS) {
    for (const group of section.groups) {
      for (const item of group.items) {
        const saved = answers[item.code];
        const value = [saved?.choice, saved?.answer].filter(Boolean).join(" — ");
        rows.push({
          section: section.title,
          group: group.title,
          code: item.code,
          level: item.level ?? "",
          question: item.text,
          why: item.why ?? "",
          kind: item.kind === "choice" ? `Lựa chọn: ${(item.options ?? []).join(" / ")}` : "Trả lời tự do",
          answer: value,
          by: saved?.updatedBy ?? "",
          at: saved?.updatedAt ? new Date(saved.updatedAt).toLocaleString("vi-VN") : "",
        });
      }
    }
  }
  return rows;
}

/** GET /api/survey/export?format=xlsx|md — xuất kết quả khảo sát để gửi đi. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const format = (url.searchParams.get("format") ?? "xlsx").toLowerCase();

  const saved = await prisma.surveyAnswer.findMany();
  const answers: Record<string, AnswerRow> = {};
  for (const row of saved) {
    answers[row.code] = {
      answer: row.answer,
      choice: row.choice,
      updatedBy: row.updatedBy,
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  const rows = flatRows(answers);
  const answered = rows.filter((r) => r.answer).length;
  const p1Missing = rows.filter((r) => r.level === "P1" && !r.answer);

  if (format === "md") {
    const lines: string[] = [];
    lines.push("# KẾT QUẢ KHẢO SÁT NHÀ MÁY — module Lên kế hoạch sản xuất");
    lines.push("");
    lines.push(`- Xuất lúc: ${new Date().toLocaleString("vi-VN")}`);
    lines.push(`- Đã trả lời: ${answered}/${rows.length} câu`);
    lines.push(`- Câu P1 còn thiếu: ${p1Missing.length}`);
    lines.push("");
    for (const section of SURVEY_SECTIONS) {
      const sectionRows = rows.filter((r) => r.section === section.title);
      if (!sectionRows.length) continue;
      lines.push(`## ${section.id}. ${section.title}  (${section.team})`);
      lines.push("");
      for (const group of section.groups) {
        const groupRows = sectionRows.filter((r) => r.group === group.title);
        if (!groupRows.length) continue;
        if (section.groups.length > 1) lines.push(`### ${group.title}`);
        for (const row of groupRows) {
          lines.push(`**${row.code}**${row.level ? ` (${row.level})` : ""} ${row.question}`);
          lines.push(`> Trả lời: ${row.answer || "— (chưa trả lời)"}${row.by ? `  ·  ${row.by}` : ""}`);
          lines.push("");
        }
      }
    }
    if (p1Missing.length) {
      lines.push("## CÂU P1 CÒN THIẾU");
      lines.push("");
      for (const row of p1Missing) lines.push(`- **${row.code}** ${row.question}`);
    }
    return new Response(lines.join("\n"), {
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Content-Disposition": `attachment; filename="khao-sat-ke-hoach-san-xuat-${stamp()}.md"`,
      },
    });
  }

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "GOLDMAX ERP";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet("Tổng hợp");
  sheet.columns = [
    { header: "Mã", key: "code", width: 8 },
    { header: "Mức", key: "level", width: 6 },
    { header: "Phần", key: "section", width: 34 },
    { header: "Nhóm", key: "group", width: 30 },
    { header: "Câu hỏi", key: "question", width: 70 },
    { header: "Kiểu trả lời", key: "kind", width: 26 },
    { header: "Trả lời", key: "answer", width: 60 },
    { header: "Ai trả lời", key: "by", width: 18 },
    { header: "Lúc", key: "at", width: 18 },
  ];
  sheet.getRow(1).font = { bold: true };
  sheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE8F4F8" } };
  for (const row of rows) {
    const added = sheet.addRow(row);
    if (!row.answer) added.getCell("answer").font = { color: { argb: "FFB91C1C" }, italic: true };
    added.getCell("answer").value = row.answer || "(chưa trả lời)";
  }
  sheet.views = [{ state: "frozen", ySplit: 1 }];
  sheet.autoFilter = { from: "A1", to: "I1" };

  const missing = workbook.addWorksheet("P1 còn thiếu");
  missing.columns = [
    { header: "Mã", key: "code", width: 8 },
    { header: "Phần", key: "section", width: 34 },
    { header: "Câu hỏi", key: "question", width: 90 },
  ];
  missing.getRow(1).font = { bold: true };
  for (const row of p1Missing) missing.addRow({ code: row.code, section: row.section, question: row.question });

  const progress = workbook.addWorksheet("Tiến độ");
  progress.columns = [
    { header: "Phần", key: "section", width: 40 },
    { header: "Ai trả lời", key: "team", width: 24 },
    { header: "Tổng câu", key: "total", width: 10 },
    { header: "Đã trả lời", key: "done", width: 12 },
    { header: "P1 còn thiếu", key: "missing", width: 14 },
  ];
  progress.getRow(1).font = { bold: true };
  for (const section of SURVEY_SECTIONS) {
    const sectionRows = rows.filter((r) => r.section === section.title);
    progress.addRow({
      section: `${section.id}. ${section.title}`,
      team: section.team,
      total: sectionRows.length,
      done: sectionRows.filter((r) => r.answer).length,
      missing: sectionRows.filter((r) => r.level === "P1" && !r.answer).length,
    });
  }
  progress.addRow({ section: "TỔNG", total: rows.length, done: answered, missing: p1Missing.length }).font = {
    bold: true,
  };

  const buffer = await workbook.xlsx.writeBuffer();
  return new Response(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="khao-sat-ke-hoach-san-xuat-${stamp()}.xlsx"`,
    },
  });
}
