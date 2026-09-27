// Kiểm chứng V156 — logic báo cáo sản xuất theo tổ (thuần, không cần DB).
import {
  actionAllowed,
  mergePrevStatus,
  predecessorText,
  vietnamDateTimeLabel,
  vietnamTimeLabel,
  evaluateDayProgress,
  highlightOf,
  lotLabelOf,
  matchesFilter,
  shiftWindow,
  statusOfAction,
  vietnamMinutesNow,
} from '@/lib/production/team-report';

let fails = 0;
const ok = (c: boolean, label: string, extra = '') => { console.log(`${c ? '✅' : '❌'} ${label}${extra ? ` — ${extra}` : ''}`); if (!c) fails += 1; };
const D = (s: string) => new Date(s);

// ---- 1. Bốn nút → bốn trạng thái ----
ok(statusOfAction('BAT_DAU') === 'DANG_LAM', 'Bắt đầu → ĐANG LÀM');
ok(statusOfAction('HOAN_THANH') === 'XONG', 'Hoàn thành → XONG');
ok(statusOfAction('LOI') === 'LOI', 'Lỗi → LOI (trạng thái MỚI, không tính là xong)');
ok(statusOfAction('TAM_DUNG') === 'TAM_DUNG', 'Tạm dừng → TAM_DUNG');
ok(!actionAllowed('BAT_DAU', 'DANG_LAM') && actionAllowed('HOAN_THANH', 'DANG_LAM'), 'đang làm thì không bấm Bắt đầu lại, nhưng bấm Hoàn thành được');
ok(!actionAllowed('HOAN_THANH', 'XONG') && actionAllowed('BAT_DAU', 'XONG'), 'đã xong thì không bấm Hoàn thành lại');
ok(!actionAllowed('BAT_DAU', 'BO_QUA') && !actionAllowed('LOI', 'BO_QUA'), 'bỏ qua thì không báo được gì');

// ---- 2. Màu trực quan: mỗi trạng thái một nền riêng ----
{
  const rows = ['CHUA_LAM', 'DANG_LAM', 'XONG', 'LOI', 'TAM_DUNG'].map((s) => highlightOf(s).row);
  ok(new Set(rows).size === 5, '5 trạng thái có 5 nền dòng KHÁC NHAU (nhìn là phân biệt được)', rows.join(' | '));
  ok(highlightOf('DANG_LAM').label === 'ĐANG LÀM' && highlightOf('LOI').label === 'LỖI', 'nhãn viết HOA để đọc từ xa');
  ok(highlightOf('KHONG_CO').row === highlightOf('CHUA_LAM').row, 'trạng thái lạ → mặc định như "Chưa làm" (không vỡ màn hình)');
}
ok(matchesFilter('LOI', 'CHUA_XONG') && matchesFilter('DANG_LAM', 'CHUA_XONG') && !matchesFilter('XONG', 'CHUA_XONG'), 'lọc "Chưa xong" gồm Lỗi + Đang làm + Chưa làm');
ok(matchesFilter('XONG', 'TAT_CA') && !matchesFilter('DANG_LAM', 'XONG'), 'lọc "Tất cả" / "Hoàn thành"');

// ---- 3. Ca làm + giờ Việt Nam ----
{
  const shift = shiftWindow({ shiftsPerDay: 1, hoursPerShift: 8 });
  ok(shift.startMinutes === 480 && shift.endMinutes === 960, '1 ca × 8 giờ → 08:00–16:00', `${shift.startMinutes}–${shift.endMinutes}`);
  const shift2 = shiftWindow({ shiftsPerDay: 2, hoursPerShift: 8 });
  ok(shift2.endMinutes === 1440 - 1, '2 ca × 8 giờ → tới 23:59 (không tràn ngày)', String(shift2.endMinutes));
  ok(vietnamMinutesNow(D('2026-10-05T03:30:00Z')) === 630, '03:30 UTC = 10:30 giờ VN → 630 phút', String(vietnamMinutesNow(D('2026-10-05T03:30:00Z'))));
}

// ---- 4. Thực tế / kế hoạch + cảnh báo không kịp ----
const shift = { startMinutes: 480, endMinutes: 1020 }; // 08:00–17:00
const run = (p: Partial<Parameters<typeof evaluateDayProgress>[0]>) =>
  evaluateDayProgress({ planQty: 100, doneQty: 0, nowMinutes: 900, ...shift, ...p } as never);

{
  const r = run({ doneQty: 20, doingQty: 0, nowMinutes: 1010 }); // 16:50, còn 10 phút
  ok(r.tone === 'bad' && r.headline.includes('KHÔNG KỊP'), 'gần hết ca mà mới 20/100, không có hàng đang làm → BÁO ĐỎ không kịp', r.headline);
}
{
  const r = run({ doneQty: 60, doingQty: 40, nowMinutes: 900 }); // 15:00, kịp nếu xong hàng đang làm
  ok(r.tone === 'warn' && r.headline.includes('CÒN KỊP'), 'chậm hơn nhịp nhưng hàng đang làm đủ bù → VÀNG', r.headline);
}
{
  const r = run({ doneQty: 90, nowMinutes: 900 });
  ok(r.tone === 'good' && r.headline.includes('ĐÚNG TIẾN ĐỘ'), 'vượt nhịp cần → XANH "đúng tiến độ"', r.headline);
}
{
  const r = run({ doneQty: 100 });
  ok(r.tone === 'good' && r.headline === 'ĐẠT KẾ HOẠCH', 'hoàn đủ → "ĐẠT KẾ HOẠCH"', r.headline);
}
{
  const r = run({ doneQty: 30, nowMinutes: 1020 });
  ok(r.tone === 'bad' && r.headline.includes('HẾT GIỜ CA'), 'qua giờ tan ca vẫn thiếu → "HẾT GIỜ CA"', r.headline);
}
{
  const r = run({ planQty: 0 });
  ok(r.tone === 'ok' && r.headline.includes('Không có việc'), 'không có việc → không cảnh báo', r.headline);
}
{
  const r = run({ doneQty: 0, nowMinutes: 420 });
  ok(r.tone === 'ok' && r.headline.includes('Chưa vào ca'), 'trước giờ vào ca → không dọa công nhân', r.headline);
}
{
  const r = run({ doneQty: 50, doingQty: 10, errorQty: 8, nowMinutes: 900 });
  ok(r.percent === 50 && r.remaining === 50 && r.errorQty === 8, 'số liệu thực tế/kế hoạch/còn lại/lỗi tính đúng');
  ok(r.neededPerHour !== null && r.actualPerHour !== null, 'có nhịp cần/giờ và nhịp đang đạt/giờ', `${r.neededPerHour} vs ${r.actualPerHour}`);
}

// ---- 5. Cột LÔ ----
{
  const lot1 = lotLabelOf({ paintGroupKey: 'DO|176|20', paintGroupLabel: 'Đỏ 176°/ 20′' });
  ok(lot1.source === 'LO_SON' && lot1.text.includes('Đỏ'), 'công đoạn gom lô màu → Lô sơn theo nhóm màu', lot1.text);
  const lot2 = lotLabelOf({ workOrderCode: 'LSX-26091802L03DH01-12064-00B' });
  ok(lot2.source === 'LENH_SX', 'không gom lô nhưng có lệnh SX → hiện mã lệnh', lot2.text);
  const lot3 = lotLabelOf({ dueDate: D('2026-11-08T00:00:00.000Z') });
  ok(lot3.source === 'LO_GIAO' && lot3.text === 'Lô giao 08/11/2026', 'không có gì khác → Lô giao theo hạn giao', lot3.text);
  ok(lotLabelOf({}).text === '—', 'không có dữ liệu → "—"');
}

// ---- 6. Cột "CÔNG ĐOẠN TRƯỚC" ----
{
  ok(mergePrevStatus([]) === 'KHONG_CO', 'không chờ ai (vd Thiết kế) → KHONG_CO');
  ok(mergePrevStatus([{ status: 'XONG' }, { status: 'XONG' }]) === 'XONG', 'tất cả công đoạn trước đã xong → XONG');
  ok(mergePrevStatus([{ status: 'XONG' }, { status: 'DANG_LAM' }]) === 'DANG_LAM', '1 xong + 1 đang làm → ĐANG LÀM');
  ok(mergePrevStatus([{ status: 'CHUA_LAM' }, { status: 'XONG' }]) === 'CHUA_LAM', '1 xong + 1 chưa làm → CHƯA LÀM');
  ok(mergePrevStatus([{ status: 'DANG_LAM' }, { status: 'TAM_DUNG' }]) === 'TAM_DUNG', 'có tạm dừng → ưu tiên báo TẠM DỪNG');
  ok(mergePrevStatus([{ status: 'LOI' }, { status: 'XONG' }]) === 'LOI', 'có lỗi → ưu tiên báo LỖI');
  ok(mergePrevStatus([{ status: 'BO_QUA' }, { status: 'BO_QUA' }]) === 'KHONG_CO', 'bỏ qua hết → coi như không chờ ai');
}
{
  const now = D('2026-09-28T09:00:00Z'); // 16:00 giờ VN
  ok(predecessorText('XONG', '2026-09-28T07:32:00Z', { now }) === 'Xong 14:32', 'công đoạn trước xong HÔM NAY → hiện GIỜ xong', predecessorText('XONG', '2026-09-28T07:32:00Z', { now }));
  ok(predecessorText('XONG', '2026-09-26T07:32:00Z', { now }) === 'Xong 26/09 14:32', 'xong NGÀY KHÁC → hiện thêm ngày', predecessorText('XONG', '2026-09-26T07:32:00Z', { now }));
  ok(predecessorText('XONG', null, { now }) === 'Đã xong', 'xong nhưng không có mốc giờ → "Đã xong" (không vỡ)');
  ok(predecessorText('DANG_LAM', null) === 'Đang làm', 'công đoạn trước đang làm → "Đang làm"');
  ok(predecessorText('CHUA_LAM', null) === 'Chưa làm' && predecessorText('KHONG_CO', null) === '—', 'chưa làm / không chờ ai');
  ok(predecessorText('LOI', null) === 'Lỗi' && predecessorText('TAM_DUNG', null) === 'Tạm dừng', 'lỗi / tạm dừng');
}
{
  ok(vietnamTimeLabel('2026-09-27T01:00:33Z') === '08:00', 'mốc UTC 01:00 → hiện 08:00 giờ VN (không dùng giờ máy)', vietnamTimeLabel('2026-09-27T01:00:33Z'));
  ok(vietnamTimeLabel(null) === '' && vietnamTimeLabel('rác') === '', 'mốc rỗng/sai → rỗng, không vỡ màn hình');
  ok(vietnamDateTimeLabel('2026-09-27T01:00:33Z', D('2026-09-27T05:00:00Z')) === '08:00', 'xong trong ngày → chỉ hiện giờ');
}

console.log(fails === 0 ? '\n🎉 TẤT CẢ TEST ĐẠT' : `\n💥 ${fails} TEST HỎNG`);
process.exit(fails === 0 ? 0 : 1);
