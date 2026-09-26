import { formatDate } from "@/components/order-list/format";
import { SET_STATUS_LABELS, TASK_STATUS_LABELS } from "@/lib/production/catalog";
import type { PrintSet, PrintTaskLine } from "@/lib/production/print";

/**
 * V137 — Thành phần TRÌNH BÀY cho mẫu in (thuần hiển thị, không truy vấn DB).
 * Một `.prod-print-sheet` = một trang A4 dọc khi in.
 */

function stamp(): string {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
}

function Head({ title, subtitle, badge }: { title: string; subtitle?: string; badge: string }) {
  return (
    <div className="prod-print-head">
      <div className="prod-print-company">
        <strong>CÔNG TY GOLDMAX</strong>
        <br />
        Sản xuất cửa nhôm kính
      </div>
      <div className="prod-print-title">
        <h1>{title}</h1>
        {subtitle ? <p>{subtitle}</p> : null}
      </div>
      <div className="prod-print-badge">
        {badge}
        <br />
        <span style={{ fontWeight: 400, fontSize: 9 }}>{stamp()}</span>
      </div>
    </div>
  );
}

function Signatures({ extraRole }: { extraRole?: string }) {
  const roles = extraRole ? ["Người lập phiếu", "Tổ trưởng", extraRole] : ["Người lập phiếu", "Tổ trưởng", "Quản đốc"];
  return (
    <div className="prod-print-sign">
      {roles.map((role) => (
        <div key={role}>
          <div className="role">{role}</div>
          <div className="space" />
          <div>……………………………………</div>
        </div>
      ))}
    </div>
  );
}

/** PHIẾU LỆNH SẢN XUẤT — một bộ cửa (lệnh cha + 3 lệnh con). */
export function ProductionOrderSheet({ set, teamLabel }: { set: PrintSet; teamLabel?: string | null }) {
  return (
    <section className="prod-print-sheet">
      <Head
        title="PHIẾU LỆNH SẢN XUẤT"
        subtitle={teamLabel ? `Bộ phận: ${teamLabel}` : "Lệnh cha (bộ cửa) + 3 lệnh con (cánh · khung · phào)"}
        badge={`BỘ SỐ\n${set.setNo ?? "—"}`}
      />

      <div className="prod-print-meta">
        <div><strong>Mã đơn:</strong> {set.orderCode ?? "—"}</div>
        <div><strong>Khách hàng:</strong> {set.customerName ?? "—"}</div>
        <div><strong>Sản phẩm:</strong> {set.productName ?? "—"}</div>
        <div><strong>Model:</strong> {set.model ?? "—"}</div>
        <div><strong>Hướng mở:</strong> {set.openingDirection ?? "—"}</div>
        <div><strong>Màu sơn:</strong> {set.paintColor ?? "—"}</div>
        <div><strong>Mã vân:</strong> {set.veneerCode ?? "—"}</div>
        <div><strong>Kích thước:</strong> {set.sizeText}</div>
        <div><strong>Số cánh / bộ:</strong> {set.leavesPerSet ?? "—"}</div>
        <div><strong>Số bộ:</strong> {set.quantity ?? 1}</div>
        <div><strong>Hạn giao khách:</strong> {formatDate(set.dueDate)}</div>
        <div><strong>Xưởng phải xong:</strong> {formatDate(set.workShopDue)}</div>
        <div><strong>Xếp lịch:</strong> {set.plannedStart ? `${formatDate(set.plannedStart)} → ${formatDate(set.plannedEnd)}` : "chưa gán"}</div>
        <div><strong>Trạng thái:</strong> {SET_STATUS_LABELS[set.status] ?? set.status} · {set.percentDone}%</div>
      </div>

      <table className="prod-print-table" style={{ marginBottom: 8 }}>
        <thead>
          <tr>
            <th style={{ width: "10%" }}>Lệnh con</th>
            <th style={{ width: "12%" }}>Số lượng</th>
            <th style={{ width: "14%" }}>Tiến độ</th>
            <th>Các việc</th>
          </tr>
        </thead>
        <tbody>
          {set.components.map((component) => (
            <tr key={component.kindLabel}>
              <td className="c"><strong>{component.kindLabel}</strong></td>
              <td className="c">{component.qtyExpected ?? "—"}</td>
              <td className="c">{component.percent}% ({component.done}/{component.total})</td>
              <td>{component.workSummary}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <table className="prod-print-table">
        <thead>
          <tr>
            <th style={{ width: "6%" }}>Bước</th>
            <th style={{ width: "30%" }}>Công đoạn</th>
            <th style={{ width: "13%" }}>Bộ phận</th>
            <th style={{ width: "16%" }}>Tổ</th>
            <th style={{ width: "9%" }}>SL</th>
            <th style={{ width: "12%" }}>Ngày KH</th>
            <th style={{ width: "14%" }}>Xong (tích)</th>
          </tr>
        </thead>
        <tbody>
          {set.tasks.map((task: PrintTaskLine) => (
            <tr key={task.id}>
              <td className="c">{task.seq}</td>
              <td>
                {task.stageName}
                {task.isRework ? " (LÀM LẠI)" : ""}
              </td>
              <td className="c">{task.scopeLabel}</td>
              <td>{task.workCenterName}</td>
              <td className="n">{task.qtyExpected ?? "—"}</td>
              <td className="c">{task.plannedStart ? formatDate(task.plannedStart) : "—"}</td>
              <td className="c">
                <span className="prod-print-box" /> {formatDate(task.actualEnd)}
                {task.statusLabel !== TASK_STATUS_LABELS.CHUA_LAM ? ` · ${task.statusLabel}` : ""}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="prod-print-note">
        <strong>Ghi chú:</strong>
        <br />
        · Báo hoàn thành công đoạn TRƯỚC mới chuyển công đoạn sau. <strong>Test cơ khí</strong> chỉ làm khi cả 3 phần (cánh + khung + phào) đã hàn xong.
        <br />
        · <strong>Lắp kính + Vệ sinh/Đóng gói</strong> chỉ làm khi cả 3 phần đã vân xong. Sơn làm cho cả bộ một lượt.
        <br />
        · Màu sơn 11 và 14 <strong>không cần vân</strong>. Sai kích thước/có lỗi: ghi vào phần ghi chú và báo văn phòng xưởng.
      </div>

      <Signatures />
    </section>
  );
}

/** DANH SÁCH VIỆC THEO NGÀY — một trang cho một tổ, dán ở xưởng. */
export function DailyWorkSheet({
  workCenterName,
  day,
  rows,
}: {
  workCenterName: string;
  day: Date;
  rows: Array<{ setId: number; setNo: string | null; orderCode: string | null; customerName: string | null; model: string | null; paintColor: string | null; stageName: string; scopeLabel: string; qtyExpected: number | null; dueDate: Date | null; taskId: number }>;
}) {
  return (
    <section className="prod-print-sheet">
      <Head title="DANH SÁCH VIỆC THEO NGÀY" subtitle={`${workCenterName} · ngày ${formatDate(day)}`} badge={`${rows.length} việc`} />

      {rows.length === 0 ? (
        <p style={{ marginTop: 14, fontSize: 12 }}>Ngày này tổ không có việc nào được xếp lịch.</p>
      ) : (
        <table className="prod-print-table" style={{ marginTop: 10 }}>
          <thead>
            <tr>
              <th style={{ width: "5%" }}>TT</th>
              <th style={{ width: "11%" }}>Bộ số</th>
              <th style={{ width: "13%" }}>Mã đơn</th>
              <th style={{ width: "16%" }}>Khách hàng</th>
              <th style={{ width: "15%" }}>Model</th>
              <th style={{ width: "8%" }}>Màu</th>
              <th style={{ width: "18%" }}>Công đoạn</th>
              <th style={{ width: "7%" }}>SL</th>
              <th style={{ width: "11%" }}>Hạn giao</th>
              <th style={{ width: "11%" }}>Xong (tích)</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={`${row.setId}-${row.taskId}`}>
                <td className="c">{index + 1}</td>
                <td className="c"><strong>{row.setNo ?? "—"}</strong></td>
                <td>{row.orderCode ?? "—"}</td>
                <td>{row.customerName ?? "—"}</td>
                <td>{row.model ?? "—"}</td>
                <td className="c">{row.paintColor ?? "—"}</td>
                <td>
                  {row.stageName} <span style={{ color: "#555" }}>({row.scopeLabel})</span>
                </td>
                <td className="n">{row.qtyExpected ?? "—"}</td>
                <td className="c">{formatDate(row.dueDate)}</td>
                <td className="c"><span className="prod-print-box" /> ……</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div className="prod-print-note prod-print-legend">
        Tổ trưởng ghi ngày hoàn thành vào ô “Xong (tích)”, cuối ngày nộp lại văn phòng xưởng để cập nhật tiến độ trên phần mềm.
      </div>

      <Signatures extraRole="Xác nhận văn phòng xưởng" />
    </section>
  );
}
