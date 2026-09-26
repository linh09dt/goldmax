#!/usr/bin/env node
/**
 * verify_sim500.mjs — kiểm chứng bộ sim-500 bằng PGlite (PostgreSQL chạy trong WASM).
 *
 * Chạy từ thư mục gốc dự án:   node scripts/simulation/verify_sim500.mjs
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
  const perSet = (await db.query(`
    select count(*)::int c from production_stages ps
    cross join lateral unnest(case ps.scope_mode
        when 'PARTS' then string_to_array(ps.scope_parts, ',')
        when 'PART' then array[ps.scope_parts] else array['BO'] end) s(scope)
    where ps.active`)).rows[0].c;

  for (const f of files) await db.exec(readFileSync(join(ROOT, 'sim-500', f), 'utf8'));
  const one = async (sql) => (await db.query(sql)).rows[0];
  const checks = {};
  const chk = (name, ok) => { checks[name] = !!ok; };

  const c = await one(`select
    (select count(*) from sales_orders)::int don,
    (select count(*) from sales_order_items)::int dong,
    (select count(*) from sales_orders where status='NHAP')::int nhap,
    (select count(*) from sales_order_items i join sales_orders o on o.id=i.order_id where o.status='DA_XAC_NHAN')::int dong_xn,
    (select count(*) from production_sets)::int bo,
    (select count(*) from production_component_orders)::int lenh_con,
    (select count(*) from production_tasks)::int cong_doan`);

  chk('mỗi đơn ≤ 5 dòng bộ cửa',
    (await one('select count(*)::int n from (select order_id from sales_order_items group by 1 having count(*)>5) x')).n === 0);
  chk('mỗi dòng quantity ≤ 10',
    (await one('select count(*)::int n from sales_order_items where coalesce(quantity,0)>10')).n === 0);
  chk('required_delivery − order_date ≥ 15',
    (await one('select count(*)::int n from sales_orders where required_delivery_date - order_date < 15')).n === 0);
  chk('đơn nháp KHÔNG có bộ',
    (await one("select count(*)::int n from production_sets s join sales_orders o on o.id=s.order_id where o.status='NHAP'")).n === 0);
  chk('đơn nháp KHÔNG có Bộ số',
    (await one("select count(*)::int n from sales_order_items i join sales_orders o on o.id=i.order_id where o.status='NHAP' and i.set_no is not null")).n === 0);
  chk('số bộ = số dòng đơn đã xác nhận', c.bo === c.dong_xn);
  chk('mỗi bộ đúng 3 lệnh con',
    (await one('select count(*)::int n from (select set_id from production_component_orders group by 1 having count(*)<>3) x')).n === 0);
  const st = await db.query('select status, count(*)::int c from production_tasks group by 1 order by 1');
  chk('đủ 4 trạng thái task',
    ['CHUA_LAM', 'DANG_LAM', 'TAM_DUNG', 'XONG'].every((s) => st.rows.some((x) => x.status === s)));
  chk('task TAM_DUNG có reason_code',
    (await one("select count(*)::int n from production_tasks where status='TAM_DUNG' and reason_code is null")).n === 0);
  chk('reason_code đều có trong danh mục',
    (await one(`select count(*)::int n from production_tasks t where t.reason_code is not null
      and not exists (select 1 from production_reasons r where r.code = t.reason_code)`)).n === 0);
  chk('reason TAM_DUNG thuộc nhóm tạm dừng/máy dừng',
    (await one(`select count(*)::int n from production_tasks t join production_reasons r on r.code=t.reason_code
      where t.status='TAM_DUNG' and r.group not in ('TAM_DUNG','MAY_DUNG')`)).n === 0);
  chk('reason làm lại thuộc nhóm LOI',
    (await one(`select count(*)::int n from production_tasks t join production_reasons r on r.code=t.reason_code
      where t.is_rework and r.group <> 'LOI'`)).n === 0);
  chk('mỗi bộ gắn đúng 1 dòng bộ cửa (order_item_id)',
    (await one('select count(*)::int n from production_sets where order_item_id is null')).n === 0);
  chk('bộ TAM_DUNG có task tạm dừng + lý do',
    (await one(`select count(*)::int n from production_sets s where s.status='TAM_DUNG'
      and not exists (select 1 from production_tasks t where t.set_id=s.id and t.status='TAM_DUNG' and t.reason_code is not null)`)).n === 0);
  const q10 = await one(`select count(*)::int total, count(distinct set_no)::int distinct_no,
      min(set_no::bigint)::int mn, max(set_no::bigint)::int mx from sales_order_items where set_no is not null`);
  chk('set_no không trùng', q10.total === q10.distinct_no);
  chk('set_no liên tục', q10.mx - q10.mn + 1 === q10.distinct_no);
  chk('set_no bắt đầu từ 1 (file đầu) / nối tiếp', q10.mn === 1);
  chk('mọi bộ đều có set_no', (await one('select count(*)::int n from production_sets where set_no is null')).n === 0);
  chk(`mỗi bộ đúng ${perSet} công đoạn`,
    (await one(`select count(*)::int n from (select set_id from production_tasks group by 1 having count(*) <> ${perSet}) x`)).n === 0);
  chk('ngày kế hoạch task không rơi Chủ nhật',
    (await one('select count(*)::int n from production_tasks where planned_start is not null and extract(dow from planned_start)=0')).n === 0);
  chk('planned_end = planned_start mỗi task',
    (await one("select count(*)::int n from production_tasks where planned_end is distinct from planned_start")).n === 0);
  chk('percent_done đúng công thức app',
    (await one(`select count(*)::int n from production_sets s where s.percent_done is distinct from coalesce(
       (select round(100.0*count(*) filter (where t.status='XONG' and t.stage_kind<>'CHO')
                / nullif(count(*) filter (where t.status<>'BO_QUA' and t.stage_kind<>'CHO'),0))::int
          from production_tasks t where t.set_id=s.id),0)`)).n === 0);
  chk('qty_expected lệnh con đúng',
    (await one(`select count(*)::int n from production_component_orders c join production_sets s on s.id=c.set_id
      where c.qty_expected is distinct from case c.kind
        when 'CANH' then s.leaves_per_set*s.quantity when 'KHUNG' then s.quantity
        when 'PHAO' then s.trim_bars_per_set*s.quantity end`)).n === 0);
  chk('qty_expected task đúng theo scope',
    (await one(`select count(*)::int n from production_tasks t join production_sets s on s.id=t.set_id
      where t.qty_expected is distinct from case t.scope
        when 'CANH' then s.leaves_per_set*s.quantity when 'KHUNG' then s.quantity
        when 'PHAO' then s.trim_bars_per_set*s.quantity else s.quantity end`)).n === 0);
  chk('actual_start giờ hành chính 7–17h',
    (await one('select count(*)::int n from production_tasks where actual_start is not null and (extract(hour from actual_start)<7 or extract(hour from actual_start)>17)')).n === 0);
  chk('actual_end giờ hành chính 7–17h',
    (await one('select count(*)::int n from production_tasks where actual_end is not null and (extract(hour from actual_end)<7 or extract(hour from actual_end)>17)')).n === 0);
  chk("updated_by = 'Mô phỏng'",
    (await one("select count(*)::int n from production_tasks where updated_by<>'Mô phỏng'")).n === 0);
  chk('đơn nháp ~4% (20/500 nếu nạp đủ)',
    files.length < FILES.length ? true : Math.abs(c.nhap - 20) === 0);

  const byStatus = (await db.query(`select status, count(*)::int c,
      round(100.0*count(*)/sum(count(*)) over (),1) pct from production_sets group by 1 order by 2 desc`)).rows;
  const taskStatus = (await db.query('select status, count(*)::int c from production_tasks group by 1 order by 2 desc')).rows;
  const otd = await one(`select count(*) filter (where actual_delivered_at::date <= due_date)::int ontime,
      count(*)::int total from production_sets where status='DA_GIAO'`);
  const rw = await one(`select count(*) filter (where is_rework)::int rw,
      count(*) filter (where status='XONG')::int done from production_tasks`);
  const lines = (await db.query(`select n, count(*)::int c from (select order_id, count(*)::int n from sales_order_items group by 1) x group by 1 order by 1`)).rows;
  const qtys = (await db.query('select quantity, count(*)::int c from sales_order_items group by 1 order by 1')).rows;

  await db.exec(readFileSync(join(ROOT, 'sim-500', 'sim-500-CLEANUP.sql'), 'utf8'));
  const after = await one(`select (select count(*) from sales_orders)::int don,
      (select count(*) from production_sets)::int bo,
      (select count(*) from production_tasks)::int cd,
      (select count(*) from production_component_orders)::int lc`);
  chk('CLEANUP xoá sạch đơn/bộ/công đoạn đã nạp',
    after.don === 0 && after.bo === 0 && after.cd === 0 && after.lc === 0);

  await db.close();
  const r = { 'đơn hàng': c.don, 'dòng bộ cửa (items)': c.dong, 'đơn nháp (NHAP)': c.nhap,
              'bộ trong kế hoạch': c.bo, 'lệnh con (Cánh/Khung/Phào)': c.lenh_con, 'công đoạn (tasks)': c.cong_doan };
  return { label, stages: stages.c, distinctSeq: stages.d, perSet, seedNote, r, checks, byStatus, taskStatus, otd, rw, lines, qtys, after };
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
  const rows = ['đơn hàng', 'dòng bộ cửa (items)', 'đơn nháp (NHAP)', 'bộ trong kế hoạch', 'lệnh con (Cánh/Khung/Phào)', 'công đoạn (tasks)'];
  console.log('  ' + 'Hạng mục'.padEnd(30) + labels.map(col).join(''));
  for (const k of rows) console.log('  ' + k.padEnd(30) + scen.map((s) => col(s.r[k])).join(''));

  console.log('\nRàng buộc:');
  const allChecks = [...new Set(scen.flatMap((s) => Object.keys(s.checks)))];
  console.log('  ' + 'Kiểm tra'.padEnd(44) + labels.map(col).join(''));
  for (const k of allChecks) {
    console.log('  ' + k.padEnd(44) + scen.map((s) => col(k in s.checks ? (s.checks[k] ? 'PASS' : 'FAIL') : '—')).join(''));
  }

  for (const s of scen) {
    console.log(`\nPhân bố — ${s.label}:`);
    console.log('  Trạng thái BỘ: ' + s.byStatus.map((x) => `${x.status}=${x.c}(${x.pct}%)`).join(' · '));
    console.log('  Trạng thái TASK: ' + s.taskStatus.map((x) => `${x.status}=${x.c}`).join(' · '));
    console.log(`  Số dòng/đơn: ` + s.lines.map((x) => `${x.n}→${x.c}`).join(' · '));
    console.log(`  Số lượng/dòng: ` + s.qtys.map((x) => `${x.quantity}→${x.c}`).join(' · '));
    console.log(`  OTD (DA_GIAO đúng hạn): ${s.otd.ontime}/${s.otd.total} = ${(s.otd.ontime / Math.max(1, s.otd.total) * 100).toFixed(1)}%`);
    console.log(`  Làm lại: ${s.rw.rw}/${s.rw.done} task XONG = ${(s.rw.rw / Math.max(1, s.rw.done) * 100).toFixed(2)}%`);
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
