import Link from "next/link";
import { formatDate, formatNumber } from "@/components/order-list/format";
import type { SetTableRow } from "@/lib/production/scheduling";

/**
 * V159 — BẢNG BỘ CỬA DÙNG CHUNG cho “Bộ chờ xếp lịch” và “Đang sản xuất”.
 * 17 cột dữ liệu + cột “Cảnh báo” (đặt NGAY SAU “Bộ số”).
 *
 * V159b: **full view — không kéo ngang** (table-layout fixed, cột theo %) và mỗi DÒNG chỉ 1 hàng
 * (nowrap + cắt “…”, rê chuột xem đầy đủ). Component THUẦN hiển thị (server).
 */

/** Bề rộng cột (%) — tổng = 100. */
const COLUMN_WIDTHS = [7, 4, 7, 7, 5, 6, 5, 4, 4, 7, 5, 7, 7, 4, 7, 4, 5, 5];

export function PlanSetTable({ rows, emptyText }: { rows: SetTableRow[]; emptyText: string }) {
  if (!rows.length) {
    return <p className="py-6 text-center text-[12px] text-slate-500">{emptyText}</p>;
  }

  return (
    <table className="plan-table">
      <colgroup>
        {COLUMN_WIDTHS.map((width, index) => (
          <col key={index} style={{ width: `${width}%` }} />
        ))}
      </colgroup>
      <thead>
        <tr>
          <th>Mã đơn hàng</th>
          <th>Bộ số</th>
          <th>Cảnh báo</th>
          <th>Đại lý</th>
          <th>Ngày tháng</th>
          <th>Model</th>
          <th>Ô thoáng</th>
          <th>Hướng mở</th>
          <th>Màu</th>
          <th className="plan-td-num">
            Kích thước
            <span className="block font-normal normal-case">(cao × rộng × khuôn)</span>
          </th>
          <th className="plan-td-num">Số thanh phào</th>
          <th>Loại khóa</th>
          <th>Loại PLX</th>
          <th className="plan-td-num">Số cánh</th>
          <th>Ghi chú</th>
          <th className="plan-td-num">
            Số ngày dự kiến giao
            <span className="block font-normal normal-case">(theo leadtime)</span>
          </th>
          <th>Ngày đặt</th>
          <th>Ngày giao</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.id}>
            <td title={row.orderCode ?? ""}>{row.orderCode || "—"}</td>
            <td className="plan-td-strong">
              <Link className="plan-link" href={`/ke-hoach-san-xuat/bo/${row.id}`}>
                {row.setNo || `#${row.id}`}
              </Link>
            </td>
            <td>
              {row.warnings.length ? (
                <span className="plan-warn-list" title={row.warnings.map((warning) => warning.detail).join(" · ")}>
                  {row.warnings.map((warning) => (
                    <span key={warning.code} className={`plan-warn ${warning.level === "bad" ? "plan-warn-bad" : "plan-warn-warn"}`}>
                      {warning.label}
                    </span>
                  ))}
                </span>
              ) : (
                <span className="text-slate-300">—</span>
              )}
            </td>
            <td title={row.dealer ?? ""}>{row.dealer || "—"}</td>
            <td>{formatDate(row.updatedAt)}</td>
            <td title={row.model ?? ""}>{row.model || "—"}</td>
            <td title={row.panelInfo ?? ""}>{row.panelInfo || "—"}</td>
            <td>{row.openingDirection || "—"}</td>
            <td>{row.paintColor || "—"}</td>
            <td className="plan-td-num">{row.sizeText}</td>
            <td className="plan-td-num" title="Số cánh + số thanh phào mặc định theo loại cửa (cửa đi / cửa sổ)">{formatNumber(row.trimBars)}</td>
            <td title={row.lockType ?? ""}>{row.lockType || "—"}</td>
            <td title={row.plxType ?? ""}>{row.plxType || "—"}</td>
            <td className="plan-td-num" title={`${formatNumber(row.canh)} cánh`}>{formatNumber(row.canh)}</td>
            <td title={row.note ?? ""}>{row.note || "—"}</td>
            <td className="plan-td-num" title="Đường găng: tổng số ngày làm việc của các bước">{formatNumber(row.leadDays)}</td>
            <td>{formatDate(row.orderDate)}</td>
            <td>{formatDate(row.dueDate)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
