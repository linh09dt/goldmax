import { dateKeyUtc } from "@/lib/production/calendar";
import { formatNumber } from "@/components/order-list/format";
import { toneForWorkCenter } from "@/lib/production/work-center-colors";
import type { StagePlanGrid } from "@/lib/production/scheduling";

/**
 * V159 — BẢNG KẾ HOẠCH THEO NGÀY.
 * Hàng = tất cả công đoạn · cột = mọi ngày trong tháng đang xem.
 * Mỗi ô 2 số: **KH** = số lượng kế hoạch · **TT** = số lượng thực tế.
 *
 * V159c: cột “Công đoạn” thu hẹp (còn ~40% — cột ngày rộng ra), lưới kẻ nét hơn,
 * **tô màu nhạt theo TỔ** để phân biệt tổ (kèm chú thích màu tổ trên đầu bảng).
 *
 * Component THUẦN hiển thị (server) — dữ liệu do `buildStagePlanGrid()` chuẩn bị sẵn.
 */
const WEEKDAY_LABELS = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];

/** Bề rộng cột “Công đoạn” (px) — trước đây để tự động ~240px, nay bóp còn ~40%. */
const STAGE_COLUMN_PX = 104;
/** Bề rộng cột “Tổng tháng” (px). */
const TOTAL_COLUMN_PX = 58;

export function StagePlanGridTable({
  grid,
  workingDays,
  todayKey,
  centerNames = {},
}: {
  grid: StagePlanGrid;
  /** Cùng thứ tự với `grid.days`: ngày đó có phải ngày làm việc không. */
  workingDays: boolean[];
  /** Khóa ngày hôm nay (`dateKeyUtc`) để tô nổi cột hôm nay. */
  todayKey: string;
  /** Mã tổ → tên tổ (để hiện chú thích màu và nhãn tổ trong cột công đoạn). */
  centerNames?: Record<string, string>;
}) {
  // Các tổ xuất hiện trong bảng, theo thứ tự công đoạn.
  const centerOrder: string[] = [];
  for (const row of grid.rows) {
    const code = row.workCenterCode;
    if (code && !centerOrder.includes(code)) centerOrder.push(code);
  }

  return (
    <div>
      {centerOrder.length ? (
        <div className="mb-1.5 flex flex-wrap items-center gap-1.5 text-[11px]">
          <span className="font-semibold text-slate-500">Tổ:</span>
          {centerOrder.map((code) => {
            const tone = toneForWorkCenter(code);
            return (
              <span key={code} className="inline-flex items-center gap-1 rounded border border-slate-200 bg-white px-1.5 py-0.5 text-slate-700">
                <span className={`inline-block h-2.5 w-2.5 rounded-sm border border-slate-300 ${tone.swatch}`} />
                {centerNames[code] ?? code}
              </span>
            );
          })}
        </div>
      ) : null}
      <div className="erp-scrollbar overflow-x-auto">
        <table className="daygrid">
          <colgroup>
            <col style={{ width: `${STAGE_COLUMN_PX}px` }} />
            {grid.days.map((day) => (
              <col key={dateKeyUtc(day)} />
            ))}
            <col style={{ width: `${TOTAL_COLUMN_PX}px` }} />
          </colgroup>
          <thead>
            <tr>
              <th className="daygrid-sticky bg-slate-800 text-slate-100">Công đoạn</th>
              {grid.days.map((day, index) => {
                const key = dateKeyUtc(day);
                const isToday = key === todayKey;
                const isOff = !workingDays[index];
                const tone = isToday
                  ? "bg-amber-300 text-amber-900"
                  : isOff
                    ? "bg-slate-300 text-slate-500"
                    : "bg-slate-800 text-slate-100";
                return (
                  <th key={key} className={tone} title={key}>
                    <span className="block font-bold">{day.getUTCDate()}</span>
                    <span className="block text-[9px] font-normal">{WEEKDAY_LABELS[day.getUTCDay()]}</span>
                  </th>
                );
              })}
              <th className="bg-slate-800 text-slate-100">Tổng tháng</th>
            </tr>
          </thead>
          <tbody>
            {grid.rows.map((row) => {
              const tone = toneForWorkCenter(row.workCenterCode);
              const centerName = row.workCenterCode ? centerNames[row.workCenterCode] ?? row.workCenterCode : "—";
              return (
                <tr key={row.stageCode}>
                  <td className={`daygrid-sticky ${tone.bg}`} title={`${row.seq} · ${row.stageName} · ${centerName}`}>
                    <span className="block truncate font-medium text-slate-800">
                      <span className="mr-1 text-slate-400">{row.seq}</span>
                      {row.stageName}
                    </span>
                    <span className="block truncate text-[9.5px] text-slate-500">{centerName}</span>
                  </td>
                  {row.cells.map((cell) => {
                    const key = dateKeyUtc(cell.day);
                    const isToday = key === todayKey;
                    const empty = cell.planned === 0 && cell.actual === 0;
                    return (
                      <td
                        key={key}
                        className={`text-center ${tone.bg} ${isToday ? "bg-amber-50" : ""}`}
                      >
                        {empty ? (
                          <span className="text-slate-300">·</span>
                        ) : (
                          <span className="inline-block leading-tight">
                            <span className="block font-semibold text-blue-700" title="Số lượng kế hoạch">
                              {formatNumber(cell.planned)}
                            </span>
                            <span className="block text-emerald-700" title="Số lượng thực tế">
                              {formatNumber(cell.actual)}
                            </span>
                          </span>
                        )}
                      </td>
                    );
                  })}
                  <td className={`text-right ${tone.bg}`}>
                    <span className="block font-semibold text-blue-700">{formatNumber(row.plannedTotal)}</span>
                    <span className="block text-emerald-700">{formatNumber(row.actualTotal)}</span>
                  </td>
                </tr>
              );
            })}
            <tr className="bg-slate-100 font-semibold">
              <td className="daygrid-sticky bg-slate-100 text-slate-800">Tổng ngày</td>
              {grid.dailyTotals.map((total, index) => (
                <td key={dateKeyUtc(grid.days[index])} className="text-center">
                  {total.planned === 0 && total.actual === 0 ? (
                    <span className="text-slate-300">·</span>
                  ) : (
                    <span className="inline-block leading-tight">
                      <span className="block text-blue-700">{formatNumber(total.planned)}</span>
                      <span className="block text-emerald-700">{formatNumber(total.actual)}</span>
                    </span>
                  )}
                </td>
              ))}
              <td className="text-right">
                <span className="block text-blue-700">{formatNumber(grid.plannedTotal)}</span>
                <span className="block text-emerald-700">{formatNumber(grid.actualTotal)}</span>
              </td>
            </tr>
            {/* V159b — dòng LŨY KẾ: cộng dồn từ đầu tháng tới từng ngày. */}
            <tr className="bg-slate-200 font-semibold">
              <td className="daygrid-sticky bg-slate-200 text-slate-800">Lũy kế tới ngày</td>
              {grid.cumulative.map((total, index) => (
                <td key={dateKeyUtc(grid.days[index])} className="text-center">
                  {total.planned === 0 && total.actual === 0 ? (
                    <span className="text-slate-400">·</span>
                  ) : (
                    <span className="inline-block leading-tight">
                      <span className="block text-blue-800">{formatNumber(total.planned)}</span>
                      <span className="block text-emerald-800">{formatNumber(total.actual)}</span>
                    </span>
                  )}
                </td>
              ))}
              <td className="text-right">
                <span className="block text-blue-800">{formatNumber(grid.plannedTotal)}</span>
                <span className="block text-emerald-800">{formatNumber(grid.actualTotal)}</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <p className="erp-hint mt-2">
        Mỗi ô 2 số: <span className="font-semibold text-blue-700">xanh đậm = số lượng kế hoạch</span> ·{" "}
        <span className="text-emerald-700">xanh lá = số lượng thực tế</span>. Mỗi hàng tô nền nhạt theo{" "}
        <b>tổ phụ trách</b> (xem chú thích màu ở trên). Hàng <b>Tổng ngày</b> = tổng trong ngày · hàng{" "}
        <b>Lũy kế tới ngày</b> = cộng dồn từ đầu tháng tới ngày đó. Đơn vị theo công đoạn (cánh hoặc bộ). Cột nền vàng =
        hôm nay, nền xám = ngày nghỉ.
      </p>
    </div>
  );
}
