#!/usr/bin/env node
/**
 * SIM-500 — Báo cáo công đoạn: đếm công đoạn theo trạng thái để thấy WIP / ĐANG DỞ / BACKLOG.
 *
 * Chạy:  node scripts/simulation/report_sim500.mjs
 * Ghi:   sim-500/BAO_CAO_CONG_DOAN.md
 *
 * Dựng schema thật (prisma migrations) + danh mục V139 + nạp 10 file don-*.sql (chỉ để đọc số),
 * nên KHÔNG cần DB thật.
 */
import { PGlite } from "@electric-sql/pglite";
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const db = new PGlite();
const mig = path.join(ROOT, "prisma/migrations");
for (const d of readdirSync(mig).filter((x) => statSync(path.join(mig, x)).isDirectory()).sort())
  await db.exec(readFileSync(path.join(mig, d, "migration.sql"), "utf8"));
await db.exec(readFileSync(path.join(ROOT, "migrate-production-v139-split-parts.sql"), "utf8"));
for (const f of readdirSync(path.join(ROOT, "sim-500")).filter((x) => x.startsWith("don-") && x.endsWith(".sql")).sort())
  await db.exec(readFileSync(path.join(ROOT, "sim-500", f), "utf8"));

const byStatus = (await db.query(`select status, count(*)::int n from production_sets group by 1 order by 2 desc`)).rows;
const totalSets = byStatus.reduce((a, r) => a + r.n, 0);
const taskStatus = (await db.query(`select status, count(*)::int n from production_tasks group by 1 order by 2 desc`)).rows;
const byStage = (await db.query(`
  select t.stage_code, t.seq, min(ps.name) stage_name, min(t.work_center_code) to_code,
         count(*)::int tong,
         count(*) filter (where t.status='CHUA_LAM')::int chua,
         count(*) filter (where t.status='DANG_LAM')::int dang,
         count(*) filter (where t.status='XONG')::int xong,
         count(*) filter (where t.status='TAM_DUNG')::int tam,
         count(*) filter (where t.is_rework)::int lai,
         round(avg(extract(epoch from (t.actual_end - t.actual_start))/3600)::numeric, 2) gio_tb
    from production_tasks t join production_stages ps on ps.code=t.stage_code
   group by t.stage_code, t.seq order by t.seq, t.stage_code`)).rows;
const dates = (await db.query(`select min(planned_start)::text a, max(planned_end)::text b,
   count(*) filter (where planned_end > due_date)::int qua_han from production_sets where planned_end is not null`)).rows[0];
const otd = (await db.query(`select count(*)::int n, count(*) filter (where actual_delivered_at::date <= due_date)::int ok
                             from production_sets where status='DA_GIAO'`)).rows[0];
const wipByStage = await db.query(`select t.stage_code, min(ps.name) name, count(*)::int n
   from production_tasks t join production_stages ps on ps.code=t.stage_code
  where t.status in ('DANG_LAM','TAM_DUNG') group by 1 order by 2`);

const f = (n) => n.toLocaleString("vi-VN");
const pct = (a, b) => `${((a / b) * 100).toFixed(1)}%`;
const STATUS_LABEL = { CHO_XEP_LICH: "Chờ xếp lịch (BACKLOG)", DA_XEP_LICH: "Đã xếp lịch", DANG_SX: "Đang sản xuất (WIP)",
  TAM_DUNG: "Tạm dừng", HOAN_THANH: "Hoàn thành (chưa giao)", DA_GIAO: "Đã giao", HUY: "Đã huỷ" };
const TASK_LABEL = { CHUA_LAM: "Chưa làm", DANG_LAM: "Đang làm", XONG: "Xong", TAM_DUNG: "Tạm dừng", BO_QUA: "Bỏ qua" };

let md = `# SIM-500 — BÁO CÁO CÔNG ĐOẠN (WIP · ĐANG DỞ · BACKLOG)

Sinh tự động từ 10 file \`sim-500/don-*.sql\` (500 đơn). Danh mục công đoạn V139 (12 công đoạn tách phần).
Mốc tham chiếu "hôm nay": **26/09/2026**.

## 1. Bộ cửa theo trạng thái — thấy BACKLOG / WIP / ĐANG DỞ

| Trạng thái bộ | Số bộ | Tỷ lệ | Ý nghĩa khi xem |
|---|---:|---:|---|
${byStatus.map((r) => `| ${STATUS_LABEL[r.status] ?? r.status} | ${f(r.n)} | ${pct(r.n, totalSets)} | ${r.status === "CHO_XEP_LICH" ? "**BACKLOG** — có lệnh, chưa xếp lịch" : r.status === "DANG_SX" ? "**WIP / ĐANG DỞ** — đang ở các công đoạn khác nhau" : r.status === "DA_XEP_LICH" ? "Đã có ngày kế hoạch, chưa làm" : ""} |`).join("\n")}
| **Tổng** | **${f(totalSets)}** | 100% | |

## 2. Công đoạn theo trạng thái — WIP nằm ở công đoạn nào

| Bước | Công đoạn | Tổ | Tổng việc | Chưa làm | Đang làm | Xong | Tạm dừng | Làm lại | Giờ TB/thực tế |
|---:|---|---|---:|---:|---:|---:|---:|---:|---:|
${byStage.map((r) => `| ${r.seq} | ${r.stage_name} | ${r.to_code ?? "—"} | ${f(r.tong)} | ${f(r.chua)} | ${f(r.dang)} | ${f(r.xong)} | ${f(r.tam)} | ${f(r.lai)} | ${r.gio_tb ?? "—"} |`).join("\n")}

## 3. Trạng thái công đoạn (toàn bộ)

| Trạng thái | Số công đoạn |
|---|---:|
${taskStatus.map((r) => `| ${TASK_LABEL[r.status] ?? r.status} | ${f(r.n)} |`).join("\n")}

## 4. Đang dở nằm ở công đoạn nào (DANG_LAM + TAM_DUNG)

${wipByStage.rows.length ? `| Công đoạn | Số việc đang dở |\n|---|---:|\n${wipByStage.rows.map((r) => `| ${r.name} | ${f(r.n)} |`).join("\n")}` : "Không có việc đang dở."}

## 5. Mốc thời gian

- Ngày kế hoạch: **${dates.a} → ${dates.b}**
- Bộ có **kế hoạch xong MUỘN hơn hạn giao**: **${f(dates.qua_han)} / ${f(totalSets)}** (${pct(dates.qua_han, totalSets)}) → xưởng đang **quá tải**, app sẽ báo cảnh báo đỏ.
- **OTD (giao đúng hạn)**: ${otd.ok}/${otd.n} = **${pct(otd.ok, otd.n)}** (khớp thực trạng nhà máy trễ nhiều).

> Xem trên app: **Kế hoạch sản xuất** (bảng tải theo tổ + dòng con theo công đoạn, cảnh báo quá tải),
> **Báo cáo → Sản xuất (OTD)** (OTD · năng suất tổ · thời gian từng công đoạn · làm lại · lý do trễ · tồn kho).
`;
writeFileSync(path.join(ROOT, "sim-500/BAO_CAO_CONG_DOAN.md"), md);
console.log(md);
await db.close();
process.exit(0);
