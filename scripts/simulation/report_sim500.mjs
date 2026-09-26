#!/usr/bin/env node
/**
 * SIM-500 — Báo cáo BỘ DỮ LIỆU ĐỂ LẬP KẾ HOẠCH (backlog sạch).
 *
 * Chạy:  node scripts/simulation/report_sim500.mjs
 * Ghi:   sim-500/BAO_CAO_CONG_DOAN.md
 *
 * Dựng schema thật (prisma migrations) + danh mục V139 + nạp 10 file don-*.sql (chỉ để đọc số),
 * nên KHÔNG cần DB thật. Bộ dữ liệu 100% là BACKLOG → báo cáo xoay quanh HẠN GIAO và KHỐI LƯỢNG
 * để bạn biết tuần/ngày nào căng mà xếp lịch.
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
for (const f of readdirSync(path.join(ROOT, "sim-500")).filter((x) => /^don-\d+-\d+\.sql$/.test(x)).sort())
  await db.exec(readFileSync(path.join(ROOT, "sim-500", f), "utf8"));

const one = async (sql) => (await db.query(sql)).rows[0];
const all = async (sql) => (await db.query(sql)).rows;

const tong = await one(`SELECT
  (SELECT count(*)::int FROM sales_orders) don,
  (SELECT count(*)::int FROM sales_order_items) dong,
  (SELECT count(*)::int FROM production_sets) bo,
  (SELECT coalesce(sum(quantity),0)::int FROM production_sets) tong_bo_theo_sl,
  (SELECT coalesce(sum(canh_equivalent),0)::int FROM production_sets) canh,
  (SELECT count(*)::int FROM production_component_orders) lenh_con,
  (SELECT count(*)::int FROM production_tasks) cong_doan,
  (SELECT count(*)::int FROM production_sets WHERE status='CHO_XEP_LICH') backlog,
  (SELECT count(*)::int FROM production_sets WHERE planned_start IS NOT NULL) co_ngay,
  (SELECT count(*)::int FROM production_tasks WHERE status<>'CHUA_LAM') khac_chua,
  (SELECT min(order_date)::text FROM sales_orders) d1, (SELECT max(order_date)::text FROM sales_orders) d2,
  (SELECT min(required_delivery_date)::text FROM sales_orders) g1, (SELECT max(required_delivery_date)::text FROM sales_orders) g2`);

const byMonth = await all(`SELECT to_char(due_date,'MM/YYYY') thang, count(*)::int so_bo,
    sum(canh_equivalent)::int canh FROM production_sets GROUP BY 1 ORDER BY 1`);
const byWeek = await all(`SELECT to_char(date_trunc('week', due_date),'DD/MM') tuan_tu, count(*)::int so_bo,
    sum(canh_equivalent)::int canh, count(*) FILTER (WHERE quantity > 1)::int bo_nhieu
  FROM production_sets GROUP BY 1 ORDER BY 1`);
const topDays = await all(`SELECT due_date::text ngay, count(*)::int so_bo, sum(canh_equivalent)::int canh
  FROM production_sets GROUP BY 1 ORDER BY 2 DESC, 1 LIMIT 10`);
const byModel = await all(`SELECT coalesce(model,'(không rõ)') model, count(*)::int so_bo, sum(canh_equivalent)::int canh
  FROM production_sets GROUP BY 1 ORDER BY 2 DESC LIMIT 12`);
const byTeam = await all(`SELECT coalesce(work_center_code,'(chưa gán)') to_code, count(*)::int so_viec,
    count(DISTINCT t.set_id)::int so_bo FROM production_tasks t GROUP BY 1 ORDER BY 2 DESC`);
const byOrderType = await all(`SELECT order_type, count(*)::int n FROM sales_orders GROUP BY 1 ORDER BY 2 DESC`);
const ordersPerDay = await all(`SELECT to_char(order_date,'MM/YYYY') thang, count(*)::int don
  FROM sales_orders GROUP BY 1 ORDER BY 1`);

const f = (n) => Number(n).toLocaleString("vi-VN");
let md = `# SIM-500 — BÁO CÁO BỘ DỮ LIỆU ĐỂ LẬP KẾ HOẠCH (BACKLOG SẠCH)

Sinh tự động từ 10 file \`sim-500/don-*.sql\` (500 đơn). Danh mục công đoạn V139 (tách phần).
**Điểm xuất phát: ${f(tong.bo)}/${f(tong.bo)} bộ ở trạng thái CHỜ XẾP LỊCH — chưa gán ngày, chưa sản xuất**
(bộ có ngày kế hoạch: ${f(tong.co_ngay)} · công đoạn không phải "Chưa làm": ${f(tong.khac_chua)}).

## 1. Tổng quan

| Hạng mục | Số lượng |
|---|---:|
| Đơn hàng | **${f(tong.don)}** (10 file × 50 đơn) |
| Dòng bộ cửa (= số bộ trong kế hoạch) | **${f(tong.dong)}** |
| Bộ theo số lượng (cộng \`quantity\`) | ${f(tong.tong_bo_theo_sl)} |
| **Tổng cánh quy đổi** (dùng tính tải) | **${f(tong.canh)}** |
| Lệnh con Cánh/Khung/Phào | ${f(tong.lenh_con)} (3/bộ) |
| Công đoạn phải làm | **${f(tong.cong_doan)}** (24/bộ) |
| Ngày đặt | ${tong.d1} → ${tong.d2} |
| Ngày giao khách | ${tong.g1} → ${tong.g2} |

Loại đơn: ${byOrderType.map((r) => `${r.order_type} ${f(r.n)}`).join(" · ")}.
Đơn vào kế hoạch theo tháng: ${ordersPerDay.map((r) => `${r.thang}: ${f(r.don)} đơn`).join(" · ")}.

## 2. Hạn giao theo THÁNG — biết tháng nào phải làm

| Tháng giao | Số bộ | Cánh quy đổi |
|---|---:|---:|
${byMonth.map((r) => `| ${r.thang} | ${f(r.so_bo)} | ${f(r.canh)} |`).join("\n")}

## 3. Hạn giao theo TUẦN (tuần bắt đầu từ Thứ 2) — tuần nào CĂNG nhất

| Tuần (từ ngày) | Số bộ | Cánh quy đổi | Bộ có >1 bộ/lượt |
|---|---:|---:|---:|
${byWeek.map((r) => `| ${r.tuan_tu} | ${f(r.so_bo)} | ${f(r.canh)} | ${f(r.bo_nhieu)} |`).join("\n")}

> Cột **cánh quy đổi** so với năng lực ngày của xưởng (Cấu hình sản xuất → ngưỡng vàng/đỏ, mặc định 70/80 cánh/ngày)
> để thấy tuần nào cần dàn đều. Bảng *Tải theo tổ và ngày* trong app sẽ hiện ô vàng/đỏ khi bạn gán ngày.

## 4. 10 NGÀY GIAO nhiều bộ nhất — ngày nào dễ vỡ kế hoạch

| Ngày giao | Số bộ | Cánh quy đổi |
|---|---:|---:|
${topDays.map((r) => `| ${r.ngay} | ${f(r.so_bo)} | ${f(r.canh)} |`).join("\n")}

## 5. Chủng loại (theo model) — 12 model nhiều nhất

| Model | Số bộ | Cánh quy đổi |
|---|---:|---:|
${byModel.map((r) => `| ${r.model} | ${f(r.so_bo)} | ${f(r.canh)} |`).join("\n")}

## 6. Khối lượng công đoạn theo TỔ — làm hết thì mỗi tổ bao nhiêu việc

| Tổ | Số việc (công đoạn) | Số bộ liên quan |
|---|---:|---:|
${byTeam.map((r) => `| ${r.to_code} | ${f(r.so_viec)} | ${f(r.so_bo)} |`).join("\n")}

## 7. Cách dùng bộ dữ liệu này

1. Nạp 10 file \`sim-500/don-*.sql\` (đúng thứ tự) — hoặc chạy \`migrate-production-v142-lenh-cong-doan.sql\`
   sau khi nạp để sinh **lệnh sản xuất** cho từng công đoạn (V142).
2. Vào **Kế hoạch sản xuất** → danh sách *Bộ chờ xếp lịch* (đủ ${f(tong.backlog)} bộ).
3. Mở từng bộ → gán **Ngày KH** cho các công đoạn (xếp tay — V141), ưu tiên theo cột **Ngày giao** ở mục 3–4.
4. Xem **Tải theo tổ và ngày** để biết ngày nào quá tải, và **In phiếu lệnh SX / Danh sách việc theo ngày** để phát xưởng.

> Ghi chú: bộ dữ liệu này **cố ý KHÔNG có** bộ đang sản xuất / đã giao / làm lại — để bạn tập làm kế hoạch từ đầu.
> Muốn bộ dữ liệu có WIP–đã giao–trễ như bản trước thì đặt lại \`SCEN_TARGET\` trong \`scripts/simulation/gen_sim500.py\`.
`;

writeFileSync(path.join(ROOT, "sim-500/BAO_CAO_CONG_DOAN.md"), md, "utf8");
console.log("✔ sim-500/BAO_CAO_CONG_DOAN.md");
console.log(`  ${f(tong.don)} đơn · ${f(tong.bo)} bộ (${f(tong.backlog)} chờ xếp lịch) · ${f(tong.canh)} cánh quy đổi · ${f(tong.cong_doan)} công đoạn`);
