import Link from "next/link";
import { formatDate, formatNumber } from "@/components/order-list/format";
import type { SetTableRow } from "@/lib/production/scheduling";

/**
 * V159 — BẢNG BỘ CỬA DÙNG CHUNG cho “Bộ chờ xếp lịch” và “Đang sản xuất”.
 * Đủ 17 cột dữ liệu + cột “Cảnh báo” (chỉ hiện TÊN cảnh báo, diễn giải nằm ở tooltip).
 *
 * Component THUẦN hiển thị (server) — dữ liệu do `buildSetTableRows()` chuẩn bị sẵn.
 */
export function PlanSetTable({ rows, emptyText }: { rows: SetTableRow[]; emptyText: string }) {
  if (!rows.length) {
    return <p className="py-6 text-center text-[12px] text-slate-500">{emptyText}</p>;
  }

  return (
    <div className="erp-scrollbar overflow-x-auto">
      <table className="erp-table">
        <thead>
          <tr>
            <th>Mã đơn hàng</th>
            <th>Đại lý</th>
            <th>Ngày tháng</th>
            <th>Bộ số</th>
            <th>Model</th>
            <th>Ô thoáng</th>
            <th>Hướng mở</th>
            <th>Màu</th>
            <th className="text-right">
              Kích thước
              <span className="block font-normal">(cao × rộng × khuôn)</span>
            </th>
            <th className="text-right">Số thanh phào</th>
            <th>Loại khóa</th>
            <th>Loại PLX</th>
            <th className="text-right">Số cánh</th>
            <th>Ghi chú</th>
            <th className="text-right">
              Số ngày dự kiến giao
              <span className="block font-normal">(theo leadtime)</span>
            </th>
            <th>Ngày đặt</th>
            <th>Ngày giao</th>
            <th>Cảnh báo</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td>{row.orderCode || "—"}</td>
              <td className="max-w-[180px] truncate" title={row.dealer ?? ""}>{row.dealer || "—"}</td>
              <td className="whitespace-nowrap">{formatDate(row.updatedAt)}</td>
              <td className="erp-td-strong">
                <Link className="font-semibold text-cyan-700 hover:underline" href={`/ke-hoach-san-xuat/bo/${row.id}`}>
                  {row.setNo || `#${row.id}`}
                </Link>
              </td>
              <td className="max-w-[150px] truncate" title={row.model ?? ""}>{row.model || "—"}</td>
              <td className="max-w-[140px] truncate" title={row.panelInfo ?? ""}>{row.panelInfo || "—"}</td>
              <td className="whitespace-nowrap">{row.openingDirection || "—"}</td>
              <td>{row.paintColor || "—"}</td>
              <td className="erp-td-num whitespace-nowrap">{row.sizeText}</td>
              <td className="erp-td-num" title="Số cánh + số thanh phào mặc định theo loại cửa (cửa đi / cửa sổ)">{formatNumber(row.trimBars)}</td>
              <td className="max-w-[160px] truncate" title={row.lockType ?? ""}>{row.lockType || "—"}</td>
              <td className="max-w-[160px] truncate" title={row.plxType ?? ""}>{row.plxType || "—"}</td>
              <td className="erp-td-num">{formatNumber(row.canh)}</td>
              <td className="max-w-[220px] truncate" title={row.note ?? ""}>{row.note || "—"}</td>
              <td className="erp-td-num" title="Đường găng: tổng số ngày làm việc của các bước">{formatNumber(row.leadDays)}</td>
              <td className="whitespace-nowrap">{formatDate(row.orderDate)}</td>
              <td className="whitespace-nowrap">{formatDate(row.dueDate)}</td>
              <td>
                {row.warnings.length ? (
                  <div className="flex flex-wrap gap-1">
                    {row.warnings.map((warning) => (
                      <span
                        key={warning.code}
                        className={`whitespace-nowrap rounded px-1.5 py-0.5 text-[10.5px] font-semibold ${
                          warning.level === "bad" ? "bg-red-100 text-red-800" : "bg-amber-100 text-amber-900"
                        }`}
                        title={warning.detail}
                      >
                        {warning.label}
                      </span>
                    ))}
                  </div>
                ) : (
                  <span className="text-slate-300">—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
