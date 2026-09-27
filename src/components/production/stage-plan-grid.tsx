import { dateKeyUtc } from "@/lib/production/calendar";
import { formatNumber } from "@/components/order-list/format";
import type { StagePlanGrid } from "@/lib/production/scheduling";

/**
 * V159 — BẢNG KẾ HOẠCH THEO NGÀY.
 * Hàng = tất cả công đoạn · cột = mọi ngày trong tháng đang xem.
 * Mỗi ô 2 số: **KH** = số lượng kế hoạch · **TT** = số lượng thực tế.
 *
 * Component THUẦN hiển thị (server) — dữ liệu do `buildStagePlanGrid()` chuẩn bị sẵn.
 */
const WEEKDAY_LABELS = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];

export function StagePlanGridTable({
  grid,
  workingDays,
  todayKey,
}: {
  grid: StagePlanGrid;
  /** Cùng thứ tự với `grid.days`: ngày đó có phải ngày làm việc không. */
  workingDays: boolean[];
  /** Khóa ngày hôm nay (`dateKeyUtc`) để tô nổi cột hôm nay. */
  todayKey: string;
}) {
  return (
    <div className="erp-scrollbar overflow-x-auto">
      <table className="erp-table text-[11px]">
        <thead>
          <tr>
            <th className="sticky left-0 z-10 bg-slate-100 text-left">Công đoạn</th>
            {grid.days.map((day, index) => {
              const key = dateKeyUtc(day);
              const isToday = key === todayKey;
              const isOff = !workingDays[index];
              return (
                <th
                  key={key}
                  className={`px-1 text-center ${isToday ? "bg-amber-200 text-amber-900" : isOff ? "bg-slate-200 text-slate-400" : ""}`}
                  title={key}
                >
                  <span className="block font-bold">{day.getUTCDate()}</span>
                  <span className="block text-[9.5px] font-normal">{WEEKDAY_LABELS[day.getUTCDay()]}</span>
                </th>
              );
            })}
            <th className="text-right">Tổng tháng</th>
          </tr>
        </thead>
        <tbody>
          {grid.rows.map((row) => (
            <tr key={row.stageCode}>
              <td className="sticky left-0 z-10 max-w-[240px] truncate bg-white" title={`${row.seq} · ${row.stageName}`}>
                <span className="mr-1 text-slate-400">{row.seq}</span>
                {row.stageName}
              </td>
              {row.cells.map((cell) => {
                const key = dateKeyUtc(cell.day);
                const isToday = key === todayKey;
                const empty = cell.planned === 0 && cell.actual === 0;
                return (
                  <td
                    key={key}
                    className={`px-0.5 py-0.5 text-center align-top tabular-nums ${isToday ? "bg-amber-50" : ""}`}
                  >
                    {empty ? (
                      <span className="text-slate-200">·</span>
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
              <td className="whitespace-nowrap text-right">
                <span className="block font-semibold text-blue-700">{formatNumber(row.plannedTotal)}</span>
                <span className="block text-emerald-700">{formatNumber(row.actualTotal)}</span>
              </td>
            </tr>
          ))}
          <tr className="bg-slate-50 font-semibold">
            <td className="sticky left-0 z-10 bg-slate-50">Tổng ngày</td>
            {grid.dailyTotals.map((total, index) => (
              <td key={dateKeyUtc(grid.days[index])} className="px-0.5 py-0.5 text-center align-top tabular-nums">
                {total.planned === 0 && total.actual === 0 ? (
                  <span className="text-slate-200">·</span>
                ) : (
                  <span className="inline-block leading-tight">
                    <span className="block text-blue-700">{formatNumber(total.planned)}</span>
                    <span className="block text-emerald-700">{formatNumber(total.actual)}</span>
                  </span>
                )}
              </td>
            ))}
            <td className="whitespace-nowrap text-right">
              <span className="block text-blue-700">{formatNumber(grid.plannedTotal)}</span>
              <span className="block text-emerald-700">{formatNumber(grid.actualTotal)}</span>
            </td>
          </tr>
          {/* V159b — dòng LŨY KẾ: cộng dồn từ đầu tháng tới từng ngày. */}
          <tr className="bg-slate-100 font-semibold">
            <td className="sticky left-0 z-10 bg-slate-100">Lũy kế tới ngày</td>
            {grid.cumulative.map((total, index) => (
              <td key={dateKeyUtc(grid.days[index])} className="px-0.5 py-0.5 text-center align-top tabular-nums">
                {total.planned === 0 && total.actual === 0 ? (
                  <span className="text-slate-300">·</span>
                ) : (
                  <span className="inline-block leading-tight">
                    <span className="block text-blue-800">{formatNumber(total.planned)}</span>
                    <span className="block text-emerald-800">{formatNumber(total.actual)}</span>
                  </span>
                )}
              </td>
            ))}
            <td className="whitespace-nowrap text-right">
              <span className="block text-blue-800">{formatNumber(grid.plannedTotal)}</span>
              <span className="block text-emerald-800">{formatNumber(grid.actualTotal)}</span>
            </td>
          </tr>
        </tbody>
      </table>
      <p className="erp-hint mt-2">
        Mỗi ô 2 số: <span className="font-semibold text-blue-700">xanh đậm = số lượng kế hoạch</span> ·{" "}
        <span className="text-emerald-700">xanh lá = số lượng thực tế</span>. Hàng <b>Tổng ngày</b> = tổng trong ngày ·{" "}
        hàng <b>Lũy kế tới ngày</b> = cộng dồn từ đầu tháng tới ngày đó. Đơn vị theo công đoạn (cánh hoặc bộ). Cột nền vàng =
        hôm nay, nền xám = ngày nghỉ.
      </p>
    </div>
  );
}
