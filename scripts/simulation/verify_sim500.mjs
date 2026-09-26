#!/usr/bin/env node
/**
 * verify_sim500.mjs — kiểm chứng bộ sim-500 bằng PGlite (PostgreSQL chạy trong WASM).
 *
 * Chạy từ thư mục gốc dự án:   node scripts/simulation/verify_sim500.mjs
 *
 * Bộ dữ liệu hiện tại là BACKLOG SẠCH (500 đơn, mọi bộ CHỜ XẾP LỊCH, chưa sản xuất)
 * ⇒ verifier chỉ kiểm các bất biến của backlog (xem sim-500/README.md).
 *
 * Kịch bản:
 *   (1) CŨ (PARTS)        : 18 migration Prisma + nạp đủ 10 file  → danh mục CAT/CHAN/HAN/VAN
 *   (2) MỚI (V139 PART)   : thêm migrate-production-v139*.sql + nạp đủ 10 file
 *   (3) 1 FILE LẺ         : DB mới + CHỈ nạp don-201-250.sql → chứng minh file tự chứa
 *
 * LƯU Ý: 2 migration Prisma 20260926233000_production_planning và
 * 20260926234500_production_component_orders CÓ NỘI DUNG Y HỆT
 * migrate-production-v136.sql / migrate-production-v136-1.sql → danh mục CŨ đã được seed sẵn.
 */
import { PGlite } from '@electric-sql/pglite';
import { readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const FILES = readdirSync(join(ROOT, 'sim-500'))
  .filter((f) => /^don-\d+-\d+\.sql$/.test(f))
  .sort();

/** Số liệu ĐÚNG của bộ BACKLOG SẠCH (500 đơn) — chỉ áp dụng khi nạp đủ 10 file. */
const EXPECT = { don: 500, dong: 1056, bo: 1056, lenh_con: 3168, cong_doan: 25344 };
// Ngày đặt muộn nhất của bộ dữ liệu (giữ khớp gen_sim500.py DATE_TO).

/** Kiểm tra TỰ CHỨA: trong sim-500/don-*.sql KHÔNG còn `TEMP` và KHÔNG còn `_sim_` (phải = 0). */
function checkSelfContained() {
  const rows = FILES.map((f) => {
    const txt = readFileSync(join(ROOT, 'sim-500', f), 'utf8');
    return {
      file: f,
      temp: (txt.match(/TEMP/g) || []).length,
      sim: (txt.match(/_sim_/g) || []).length,
    };
  });
  return { rows, temp: rows.reduce((a, r) => a + r.temp, 0), sim: rows.reduce((a, r) => a + r.sim, 0) };
}

async function loadCatalog(db, withV139) {
  for (const d of readdirSync(join(ROOT, 'prisma', 'migrations')).filter((x) => !x.endsWith('.toml')).sort()) {
    await db.exec(readFileSync(join(ROOT, 'prisma', 'migrations', d, 'migration.sql'), 'utf8'));
  }
  let seedNote = 'danh mục CŨ seed bởi migration Prisma (v136 + v136-1)';
  if ((await db.query('select count(*)::int c from production_stages')).rows[0].c === 0) {
    for (const f of ['migrate-production-v136.sql', 'migrate-production-v136-1.sql']) {
      await db.exec(readFileSync(join(ROOT, f), 'utf8'));
    }
    seedNote = 'danh mục CŨ seed bằng migrate-production-v136.sql + v136-1';
  }
  if (withV139) {
    for (const f of ['migrate-production-v139-split-parts.sql', 'migrate-production-v139-1-nang-luc-cong-doan.sql']) {
      await db.exec(readFileSync(join(ROOT, f), 'utf8'));
    }
  }
  return seedNote;
}

async function runScenario(label, files, withV139) {
  const db = new PGlite();
  const seedNote = await loadCatalog(db, withV139);
  const stages = (await db.query(
    'select count(*)::int c, count(distinct seq)::int d from production_stages where active')).rows[0];
  // Số công đoạn/bộ suy từ chính danh mục DB đích (không hard-code) — tách theo phần vs cả bộ.
  const stageSplit = (await db.query(`
    select count(*)::int c, count(*) filter (where s.scope='BO')::int whole
    from production_stages ps
    cross join lateral unnest(case ps.scope_mode
        when 'PARTS' then string_to_array(ps.scope_parts, ',')
        when 'PART' then array[ps.scope_parts] else array['BO'] end) s(scope)
    where ps.active`)).rows[0];
  const perSet = stageSplit.c;
  const perWhole = stageSplit.whole;
  const perPart = perSet - perWhole;

  for (const f of files) await db.exec(readFileSync(join(ROOT, 'sim-500', f), 'utf8'));
  const full = files.length === FILES.length;
  const one = async (sql) => (await db.query(sql)).rows[0];
  const checks = {};
  const chk = (name, ok) => { checks[name] = !!ok; };

  const c = await one(`select
    (select count(*) from sales_orders)::int don,
    (select count(*) from sales_order_items)::int dong,
    (select count(*) from sales_orders where status='NHAP')::int nhap,
    (select count(*) from sales_orders where status='DA_XAC_NHAN')::int xn,
    (select count(*) from sales_order_items i join sales_orders o on o.id=i.order_id where o.status='DA_XAC_NHAN')::int dong_xn,
    (select count(*) from production_sets)::int bo,
    (select count(*) from production_sets where status='CHO_XEP_LICH')::int bo_cho,
    (select count(*) from production_component_orders)::int lenh_con,
    (select count(*) from production_tasks)::int cong_doan,
    (select count(*) from production_tasks where status='CHUA_LAM')::int cd_chua`);

  // ---- ĐƠN HÀNG ----
  chk('tất cả đơn DA_XAC_NHAN',
    (await one("select count(*)::int n from sales_orders where status<>'DA_XAC_NHAN'")).n === 0);
  chk('0 đơn nháp (NHAP)', c.nhap === 0);
  chk(`đủ ${EXPECT.don} đơn khi nạp đủ 10 file`, !full || c.don === EXPECT.don);
  chk('ngày đặt trong tháng 10–11/2026 (01/10→10/11)',
    (await one("select count(*)::int n from sales_orders where order_date < DATE '2026-10-01' or order_date > DATE '2026-11-10'")).n === 0);
  chk('ngày giao trong tháng 10–11/2026 (01/10→30/11)',
    (await one("select count(*)::int n from sales_orders where required_delivery_date < DATE '2026-10-01' or required_delivery_date > DATE '2026-11-30'")).n === 0);
  chk('required_delivery − order_date ≥ 15',
    (await one('select count(*)::int n from sales_orders where required_delivery_date - order_date < 15')).n === 0);
  chk('mỗi đơn ≤ 5 dòng bộ cửa',
    (await one('select count(*)::int n from (select order_id from sales_order_items group by 1 having count(*)>5) x')).n === 0);
  chk('mỗi dòng quantity ≤ 10',
    (await one('select count(*)::int n from sales_order_items where coalesce(quantity,0)>10')).n === 0);
  chk(`${EXPECT.dong} dòng bộ cửa khi nạp đủ 10 file`, !full || c.dong === EXPECT.dong);

  // ---- BỘ (production_sets) — BACKLOG SẠCH ----
  chk('mọi bộ CHO_XEP_LICH',
    (await one("select count(*)::int n from production_sets where status<>'CHO_XEP_LICH'")).n === 0);
  chk('mọi bộ percent_done = 0',
    (await one('select count(*)::int n from production_sets where percent_done <> 0')).n === 0);
  chk('0 bộ có ngày kế hoạch (planned_start/planned_end)',
    (await one('select count(*)::int n from production_sets where planned_start is not null or planned_end is not null')).n === 0);
  chk('0 bộ có ngày thực tế / đã giao',
    (await one('select count(*)::int n from production_sets where actual_completed_at is not null or actual_delivered_at is not null')).n === 0);
  chk('0 bộ có cờ chương trình/vật tư/đóng gói',
    (await one('select count(*)::int n from production_sets where program_ready or material_ready or pack_count is not null')).n === 0);
  chk(`${EXPECT.bo} bộ khi nạp đủ 10 file`, !full || c.bo === EXPECT.bo);
  chk('số bộ = số dòng đơn đã xác nhận', c.bo === c.dong_xn);
  chk('mỗi dòng hàng đã xác nhận đúng 1 bộ',
    (await one(`select count(*)::int n from sales_order_items i join sales_orders o on o.id=i.order_id
      where o.status='DA_XAC_NHAN'
      and not exists (select 1 from production_sets s where s.order_item_id=i.id)`)).n === 0);
  chk('mỗi bộ gắn đúng 1 dòng bộ cửa (order_item_id)',
    (await one('select count(*)::int n from production_sets where order_item_id is null')).n === 0);
  const q10 = await one(`select count(*)::int total, count(distinct set_no)::int distinct_no,
      min(set_no::bigint)::int mn, max(set_no::bigint)::int mx from sales_order_items where set_no is not null`);
  chk('set_no không trùng', q10.total === q10.distinct_no);
  chk('set_no liên tục', q10.mx - q10.mn + 1 === q10.distinct_no);
  chk('set_no bắt đầu từ 1 (file đầu) / nối tiếp', q10.mn === 1);
  chk('mọi bộ đều có set_no', (await one('select count(*)::int n from production_sets where set_no is null')).n === 0);

  // ---- LỆNH CON (production_component_orders) ----
  chk(`${EXPECT.lenh_con} lệnh con khi nạp đủ 10 file`, !full || c.lenh_con === EXPECT.lenh_con);
  chk('mỗi bộ đúng 3 lệnh con (CÁNH/KHUNG/PHAO)',
    (await one('select count(*)::int n from (select set_id from production_component_orders group by 1 having count(*)<>3) x')).n === 0);
  chk('qty_expected lệnh con đúng',
    (await one(`select count(*)::int n from production_component_orders c join production_sets s on s.id=c.set_id
      where c.qty_expected is distinct from case c.kind
        when 'CANH' then s.leaves_per_set*s.quantity when 'KHUNG' then s.quantity
        when 'PHAO' then s.trim_bars_per_set*s.quantity end`)).n === 0);

  // ---- CÔNG ĐOẠN (production_tasks) — CHƯA LÀM HẾT ----
  chk('mọi công đoạn CHUA_LAM', c.cong_doan === c.cd_chua && c.cong_doan > 0);
  chk('0 công đoạn có sản lượng (qty_done)',
    (await one('select count(*)::int n from production_tasks where qty_done is not null')).n === 0);
  chk('0 công đoạn có ngày kế hoạch',
    (await one('select count(*)::int n from production_tasks where planned_start is not null or planned_end is not null')).n === 0);
  chk('0 công đoạn có ngày thực tế',
    (await one('select count(*)::int n from production_tasks where actual_start is not null or actual_end is not null')).n === 0);
  chk('0 công đoạn có người làm (assignee)',
    (await one('select count(*)::int n from production_tasks where assignee is not null')).n === 0);
  chk('0 công đoạn làm lại (is_rework)',
    (await one('select count(*)::int n from production_tasks where is_rework')).n === 0);
  chk('0 công đoạn có reason_code',
    (await one('select count(*)::int n from production_tasks where reason_code is not null')).n === 0);
  chk(`${EXPECT.cong_doan} công đoạn khi nạp đủ 10 file`, !full || c.cong_doan === EXPECT.cong_doan);
  chk(`mỗi bộ đúng ${perSet} công đoạn`,
    (await one(`select count(*)::int n from (select set_id from production_tasks group by 1 having count(*) <> ${perSet}) x`)).n === 0);
  chk(`mỗi bộ ${perPart} công đoạn theo phần + ${perWhole} công đoạn cả bộ`,
    (await one(`select count(*)::int n from (
        select set_id from production_tasks group by 1
        having count(*) filter (where scope <> 'BO') <> ${perPart}
            or count(*) filter (where scope = 'BO') <> ${perWhole}) x`)).n === 0);
  chk('percent_done đúng công thức app',
    (await one(`select count(*)::int n from production_sets s where s.percent_done is distinct from coalesce(
       (select round(100.0*count(*) filter (where t.status='XONG' and t.stage_kind<>'CHO')
                / nullif(count(*) filter (where t.status<>'BO_QUA' and t.stage_kind<>'CHO'),0))::int
          from production_tasks t where t.set_id=s.id),0)`)).n === 0);
  chk('qty_expected task đúng theo scope',
    (await one(`select count(*)::int n from production_tasks t join production_sets s on s.id=t.set_id
      where t.qty_expected is distinct from case t.scope
        when 'CANH' then s.leaves_per_set*s.quantity when 'KHUNG' then s.quantity
        when 'PHAO' then s.trim_bars_per_set*s.quantity else s.quantity end`)).n === 0);
  chk("updated_by = 'Mô phỏng'",
    (await one("select count(*)::int n from production_tasks where updated_by<>'Mô phỏng'")).n === 0);

  // ---- PHÂN BỐ / TỔNG KẾT ----
  const byStatus = (await db.query(`select status, count(*)::int c,
      round(100.0*count(*)/sum(count(*)) over (),1) pct from production_sets group by 1 order by 2 desc`)).rows;
  const taskStatus = (await db.query('select status, count(*)::int c from production_tasks group by 1 order by 2 desc')).rows;
  const delivered = await one(`select count(*) filter (where actual_delivered_at is not null)::int delivered,
      count(*) filter (where planned_start is not null)::int planned,
      count(*) filter (where status='CHO_XEP_LICH')::int backlog, count(*)::int total from production_sets`);
  const dates = await one(`select min(order_date)::text d1, max(order_date)::text d2,
      min(required_delivery_date)::text g1, max(required_delivery_date)::text g2 from sales_orders`);
  const lines = (await db.query(`select n, count(*)::int c from (select order_id, count(*)::int n from sales_order_items group by 1) x group by 1 order by 1`)).rows;
  const qtys = (await db.query('select quantity, count(*)::int c from sales_order_items group by 1 order by 1')).rows;

  // ---- CLEANUP ----
  await db.exec(readFileSync(join(ROOT, 'sim-500', 'sim-500-CLEANUP.sql'), 'utf8'));
  const after = await one(`select (select count(*) from sales_orders)::int don,
      (select count(*) from production_sets)::int bo,
      (select count(*) from production_tasks)::int cd,
      (select count(*) from production_component_orders)::int lc`);
  chk('CLEANUP xoá sạch đơn/bộ/công đoạn đã nạp',
    after.don === 0 && after.bo === 0 && after.cd === 0 && after.lc === 0);

  await db.close();
  const r = { 'đơn hàng': c.don, 'dòng bộ cửa (items)': c.dong, 'đơn nháp (NHAP)': c.nhap,
              'bộ trong kế hoạch': c.bo, 'bộ chờ xếp lịch': c.bo_cho,
              'lệnh con (Cánh/Khung/Phào)': c.lenh_con, 'công đoạn (tasks)': c.cong_doan,
              'công đoạn CHUA_LAM': c.cd_chua };
  return { label, stages: stages.c, distinctSeq: stages.d, perSet, seedNote, r, checks, byStatus, taskStatus, delivered, dates, lines, qtys, after };
}

async function main() {
  const scen = [];
  scen.push(await runScenario('CŨ (PARTS)', FILES, false));
  scen.push(await runScenario('MỚI (V139 PART)', FILES, true));
  scen.push(await runScenario('CŨ – 1 file lẻ', [FILES[4]], false));
  const sc = checkSelfContained();

  const labels = scen.map((s) => s.label);
  const col = (v) => String(v).padStart(17);
  console.log('\n=================== KẾT QUẢ KIỂM CHỨNG SIM-500 ===================\n');
  console.log('Danh mục công đoạn DB đích:');
  for (const s of scen) {
    console.log(`  ${s.label.padEnd(18)} stages=${String(s.stages).padStart(2)}  distinct seq=${s.distinctSeq}  tasks/bộ=${s.perSet}  (${s.seedNote})`);
  }
  console.log('\nSố lượng:');
  const rows = ['đơn hàng', 'dòng bộ cửa (items)', 'đơn nháp (NHAP)', 'bộ trong kế hoạch',
                'bộ chờ xếp lịch', 'lệnh con (Cánh/Khung/Phào)', 'công đoạn (tasks)', 'công đoạn CHUA_LAM'];
  console.log('  ' + 'Hạng mục'.padEnd(30) + labels.map(col).join(''));
  for (const k of rows) console.log('  ' + k.padEnd(30) + scen.map((s) => col(s.r[k])).join(''));

  console.log('\nRàng buộc:');
  const allChecks = [...new Set(scen.flatMap((s) => Object.keys(s.checks)))];
  console.log('  ' + 'Kiểm tra'.padEnd(56) + labels.map(col).join(''));
  for (const k of allChecks) {
    console.log('  ' + k.padEnd(56) + scen.map((s) => col(k in s.checks ? (s.checks[k] ? 'PASS' : 'FAIL') : '—')).join(''));
  }

  for (const s of scen) {
    console.log(`\nPhân bố — ${s.label}:`);
    console.log('  Trạng thái BỘ: ' + s.byStatus.map((x) => `${x.status}=${x.c}(${x.pct}%)`).join(' · '));
    console.log('  Trạng thái TASK: ' + s.taskStatus.map((x) => `${x.status}=${x.c}`).join(' · '));
    console.log(`  Ngày đặt: ${s.dates.d1} → ${s.dates.d2} · Ngày giao: ${s.dates.g1} → ${s.dates.g2}`);
    console.log(`  Số dòng/đơn: ` + s.lines.map((x) => `${x.n}→${x.c}`).join(' · '));
    console.log(`  Số lượng/dòng: ` + s.qtys.map((x) => `${x.quantity}→${x.c}`).join(' · '));
    console.log(`  Bộ đã giao/hoàn thành: ${s.delivered.delivered}/${s.delivered.total} · bộ có ngày kế hoạch: ${s.delivered.planned}/${s.delivered.total} · bộ chờ xếp lịch: ${s.delivered.backlog}/${s.delivered.total}`);
    console.log(`  Sau CLEANUP: đơn=${s.after.don} bộ=${s.after.bo} công đoạn=${s.after.cd} lệnh_con=${s.after.lc}`);
  }

  console.log('\nTự chứa (không bảng tạm / không session state):');
  console.log(`  grep "TEMP"  trong sim-500/don-*.sql : ${sc.temp} dòng khớp  ${sc.temp === 0 ? 'PASS' : 'FAIL'}`);
  console.log(`  grep "_sim_" trong sim-500/don-*.sql : ${sc.sim} dòng khớp  ${sc.sim === 0 ? 'PASS' : 'FAIL'}`);
  if (sc.temp || sc.sim) {
    for (const r of sc.rows) if (r.temp || r.sim) console.log(`    ${r.file}: TEMP=${r.temp} _sim_=${r.sim}`);
  }

  const allPass = sc.temp === 0 && sc.sim === 0
    && scen.every((s) => Object.values(s.checks).every(Boolean));
  console.log(`\n========== ${allPass ? 'TẤT CẢ RÀNG BUỘC PASS ✔' : 'CÓ RÀNG BUỘC FAIL ✘'} ==========\n`);
  process.exit(allPass ? 0 : 1);
}

main().catch((e) => { console.error('LỖI:', e.stack || e.message); process.exit(1); });
