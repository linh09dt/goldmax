import Link from "next/link";
import { ErpShell } from "@/components/erp-shell";

const primaryButton = "inline-flex items-center justify-center rounded-lg bg-cyan-600 px-3 py-2 text-sm font-semibold text-white hover:bg-cyan-500";
const secondaryButton = "inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50";

export default function GuidePage() {
  return (
    <ErpShell title="Hướng dẫn sử dụng">
      <div className="space-y-6">
        <section className="erp-card p-5">
          <h2 className="text-lg font-bold text-slate-950">Quy trình sử dụng nhanh</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            <Step no="1" title="Cấu hình dữ liệu" text="Kiểm tra Danh mục hàng hóa, giá và các danh mục chọn." href="/items" />
            <Step no="2" title="Tạo đơn hàng" text="Nhập thông tin khách hàng, bộ cửa, chi tiết và giá." href="/orders/new" />
            <Step no="3" title="Tính vận chuyển" text="Chọn đơn, vùng miền, quãng đường và áp dụng cước." href="/shipping" />
            <Step no="4" title="Quản lý đơn" text="Tra cứu, sửa, xuất PDF hoặc xóa đơn." href="/orders" />
            <Step no="5" title="Theo dõi doanh thu" text="Lọc doanh thu theo thời gian, đại lý và khách hàng." href="/revenue" />
          </div>
        </section>

        <GuideSection title="1. Tổng quan" href="/" linkLabel="Mở Tổng quan">
          <ActionTable rows={[
            ["Tạo đơn hàng", "Mở màn hình tạo đơn hàng mới."],
            ["Danh sách đơn hàng", "Mở tab Quản lý đơn hàng để tra cứu các đơn đã lưu."],
          ]} />
        </GuideSection>

        <GuideSection title="2. Quản lý đơn hàng" href="/orders" linkLabel="Mở Quản lý đơn hàng">
          <p className="text-sm text-slate-600">Dùng bộ lọc phía trên để tìm đơn theo ngày, tháng, năm, khoảng ngày, đại lý hoặc khách hàng.</p>
          <ActionTable rows={[
            ["+ Tạo đơn hàng", "Tạo một đơn hàng mới."],
            ["Lọc", "Áp dụng các điều kiện lọc đã chọn."],
            ["Xóa lọc", "Bỏ toàn bộ điều kiện lọc và hiển thị lại danh sách."],
            ["Xuất Excel danh sách", "Xuất danh sách đơn theo bộ lọc hiện tại, gồm toàn bộ hàng hóa theo từng đơn."],
            ["Sửa", "Mở đơn để chỉnh sửa thông tin và hàng hóa."],
            ["Xóa đơn", "Xóa đơn hàng sau khi xác nhận."],
            ["Xuất Excel", "Xuất Excel V2 của đơn hàng. Nút được hiển thị với tên Xuất Excel; các nút Excel/PDF cũ vẫn tạm ẩn."],
            ["Xuất PDF", "Xuất PDF V2 của đơn hàng. Các nút PDF cũ vẫn tạm ẩn."],
            ["Số đơn hàng", "Bấm vào số đơn để xem chi tiết đơn hàng."],
          ]} />
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
            Badge trạng thái cho biết đơn đang ở trạng thái Nháp, Chờ xác nhận, Đã xác nhận, Đã chuyển sản xuất hoặc Đã hủy.
          </div>
        </GuideSection>

        <GuideSection title="3. Tạo / sửa đơn hàng" href="/orders/new" linkLabel="Mở Tạo đơn hàng">
          <ol className="grid gap-2 text-sm text-slate-700 md:grid-cols-2">
            <li className="rounded-lg border border-slate-200 bg-white p-3"><b>Bước 1.</b> Nhập đầy đủ toàn bộ trường trong Thông tin đơn hàng; tất cả các trường có dấu * đều bắt buộc.</li>
            <li className="rounded-lg border border-slate-200 bg-white p-3"><b>Bước 2.</b> Thêm bộ cửa và chọn hàng hóa từ Danh mục hàng hóa.</li>
            <li className="rounded-lg border border-slate-200 bg-white p-3"><b>Bước 3.</b> Nhập kích thước, số lượng, KH/Lượng, đơn giá và ghi chú.</li>
            <li className="rounded-lg border border-slate-200 bg-white p-3"><b>Bước 4.</b> Thêm chi tiết / phụ kiện / phụ phí nếu bộ cửa có phát sinh.</li>
            <li className="rounded-lg border border-slate-200 bg-white p-3"><b>Bước 5.</b> Dán ảnh bằng Ctrl+V hoặc tải ảnh sản phẩm nếu cần, sau đó kiểm tra tổng giá trị.</li>
            <li className="rounded-lg border border-slate-200 bg-white p-3"><b>Bước 6.</b> Bấm Lưu đơn hàng hoặc Lưu thay đổi.</li>
          </ol>
          <ActionTable rows={[
            ["Nhập Excel mẫu đơn", "Đọc dữ liệu từ file Excel mẫu và đưa vào đơn đang nhập."],
            ["+ Bộ cửa", "Thêm một bộ cửa mới vào đơn."],
            ["Nhân bản bộ", "Sao chép bộ cửa hiện tại để nhập nhanh một bộ tương tự."],
            ["+ Chi tiết / phụ kiện / phụ phí của bộ cửa", "Thêm dòng hàng phụ thuộc vào bộ cửa đang chọn."],
            ["Xóa bộ", "Xóa toàn bộ bộ cửa và các dòng chi tiết thuộc bộ đó."],
            ["Đại lý / Bán lẻ", "Chọn nhanh mức giá đã cấu hình trong Danh mục hàng hóa."],
            ["Dán / Tải ảnh", "Bấm vào ô Hình ảnh SP rồi nhấn Ctrl+V để dán ảnh từ Clipboard, hoặc tải file ảnh như trước. Ảnh được lưu trên Supabase Storage."],
            ["Xóa", "Xóa một dòng chi tiết / phụ kiện / phụ phí."],
            ["Lưu đơn hàng", "Lưu đơn mới khi toàn bộ Thông tin đơn hàng đã nhập đầy đủ."],
            ["Lưu thay đổi", "Ghi lại chỉnh sửa khi toàn bộ Thông tin đơn hàng đã nhập đầy đủ."],
          ]} />
        </GuideSection>

        <GuideSection title="4. Theo dõi doanh thu" href="/revenue" linkLabel="Mở Theo dõi doanh thu">
          <p className="text-sm text-slate-600">Dùng bộ lọc để xem doanh thu theo ngày, tháng, năm, khoảng ngày, đại lý hoặc khách hàng.</p>
          <ActionTable rows={[
            ["Lọc", "Tính và hiển thị doanh thu theo điều kiện đã chọn."],
            ["Xóa lọc", "Bỏ điều kiện lọc."],
            ["Xuất Excel", "Xuất báo cáo doanh thu theo bộ lọc hiện tại, gồm doanh thu đơn hàng, hàng hóa theo đơn và doanh thu sản phẩm."],
            ["Số ĐH", "Bấm số đơn để mở chi tiết đơn hàng."],
          ]} />
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            {[
              "Tổng tiền đơn hàng",
              "Tổng tiền chiết khấu",
              "Tổng tiền sau CK",
              "Tổng đặt cọc",
              "Tổng còn lại",
            ].map((label) => <div key={label} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700">{label}</div>)}
          </div>
        </GuideSection>

        <GuideSection title="5. Danh mục hàng hóa" href="/items" linkLabel="Mở Danh mục hàng hóa">
          <p className="text-sm text-slate-600">Đây là Master Data dùng để chọn TENHANG, MODEL, ĐVT và giá khi lập đơn.</p>
          <ActionTable rows={[
            ["Tạo lại Master Data từ Excel", "Tạo lại danh mục từ file Excel nguồn. Đơn hàng đã có không bị xóa."],
            ["Xuất Master Data", "Xuất Danh mục hàng hóa hiện tại ra Excel."],
            ["+ Thêm hàng hóa", "Thêm thủ công một TENHANG / MODEL mới."],
            ["Tìm kiếm", "Tìm theo TENHANG, tên diễn giải, MODEL hoặc ĐVT."],
            ["Nhóm theo TENHANG", "Gom các MODEL cùng TENHANG để dễ theo dõi."],
            ["Mở tất cả / Thu gọn", "Mở hoặc thu gọn toàn bộ nhóm TENHANG."],
            ["Sửa", "Cho phép chỉnh TENHANG, tên diễn giải, MODEL, ĐVT, giá và trạng thái."],
            ["Lưu / Hủy", "Lưu chỉnh sửa hoặc bỏ chỉnh sửa đang thực hiện."],
            ["Xóa", "Xóa hàng hóa khỏi Master Data sau khi xác nhận."],
          ]} />
        </GuideSection>

        <GuideSection title="6. Danh mục cấu hình" href="/master-options" linkLabel="Mở Danh mục cấu hình">
          <p className="text-sm text-slate-600">Quản lý các giá trị chọn dùng trong đơn hàng: Mã Đại Lý, Màu sơn, Hướng mở, Hướng phào, Ô thoáng / Pano / Nan chớp.</p>
          <ActionTable rows={[
            ["+ Thêm", "Thêm một giá trị mới vào nhóm cấu hình đang chọn."],
            ["Lưu", "Lưu Mã, Tên hiển thị hoặc Thứ tự sau khi chỉnh."],
            ["Ngưng dùng", "Ẩn giá trị khỏi danh sách chọn mới nhưng vẫn giữ dữ liệu cũ."],
            ["Kích hoạt", "Cho phép sử dụng lại giá trị đã ngưng."],
            ["Xóa Mã Đại Lý", "Xóa mã khỏi danh mục chọn mới; Mã Đại Lý đã lưu trong đơn hàng cũ vẫn được giữ nguyên."],
          ]} />
        </GuideSection>

        <GuideSection title="7. Tính cước vận chuyển" href="/shipping" linkLabel="Mở Tính cước vận chuyển">
          <div className="grid gap-4 xl:grid-cols-3">
            <MiniCard title="Tính cước theo đơn hàng" items={[
              "Chọn đơn hàng.",
              "Chọn vùng miền và nhập quãng đường.",
              "Đánh dấu Huyện miền núi nếu áp dụng.",
              "Kiểm tra từng TENHANG / Model và tổng cước.",
              "Bấm Áp dụng cước vào đơn hàng.",
            ]} />
            <MiniCard title="Cấu hình vận chuyển" items={[
              "Chọn TENHANG từ Danh mục hàng hóa.",
              "Gán Model tính cước tương ứng.",
              "Bấm + Thêm cấu hình nếu cần dòng mới.",
              "Bấm Lưu cấu hình để ghi lại.",
            ]} />
            <MiniCard title="Bảng tiêu chuẩn cước" items={[
              "Cập nhật giá theo Model, số lượng và vùng miền.",
              "Khôi phục giá mẫu để nạp lại bảng mẫu.",
              "Bấm Lưu thay đổi để lưu bảng giá hiện tại.",
            ]} />
          </div>
          <ActionTable rows={[
            ["Áp dụng cước vào đơn hàng", "Ghi số cước vừa tính vào đơn hàng đã chọn."],
            ["+ Thêm cấu hình", "Thêm mapping TENHANG → Model tính cước."],
            ["Lưu cấu hình", "Lưu cấu hình vận chuyển."],
            ["Xóa", "Xóa dòng cấu hình đang chọn."],
            ["Khôi phục giá mẫu", "Nạp lại bảng giá mẫu lên màn hình."],
            ["Lưu thay đổi", "Lưu bảng tiêu chuẩn cước đang hiển thị."],
          ]} />
        </GuideSection>

        <section className="erp-card p-5">
          <h2 className="text-lg font-bold text-slate-950">Lưu ý khi thao tác</h2>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <Note title="Trước khi xóa" text="Kiểm tra đúng đơn hàng hoặc đúng Master Data. Các nút Xóa đều yêu cầu xác nhận." />
            <Note title="Sau khi sửa" text="Luôn bấm Lưu thay đổi / Lưu cấu hình / Lưu để dữ liệu được ghi lại." />
            <Note title="Xuất Excel" text="Nếu màn hình có bộ lọc, file xuất sẽ đi theo bộ lọc đang áp dụng." />
            <Note title="Ảnh sản phẩm" text="Có thể bấm ô Hình ảnh SP rồi Ctrl+V để dán ảnh trực tiếp. Tải ảnh vẫn được giữ làm phương án dự phòng; ảnh được lưu trên Supabase Storage." />
          </div>
        </section>
      </div>
    </ErpShell>
  );
}

function GuideSection({
  title,
  href,
  linkLabel,
  children,
}: {
  title: string;
  href: string;
  linkLabel: string;
  children: React.ReactNode;
}) {
  return (
    <section className="erp-card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-5 py-4">
        <h2 className="text-lg font-bold text-slate-950">{title}</h2>
        <Link className={secondaryButton} href={href}>{linkLabel}</Link>
      </div>
      <div className="space-y-4 p-5">{children}</div>
    </section>
  );
}

function Step({ no, title, text, href }: { no: string; title: string; text: string; href: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white">{no}</span>
        <h3 className="font-bold text-slate-950">{title}</h3>
      </div>
      <p className="mt-3 min-h-12 text-sm text-slate-600">{text}</p>
      <Link className={`${primaryButton} mt-3`} href={href}>Mở</Link>
    </div>
  );
}

function ActionTable({ rows }: { rows: Array<[string, string]> }) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200">
      <table className="w-full text-sm">
        <thead className="bg-slate-900 text-left text-xs uppercase tracking-wide text-white">
          <tr>
            <th className="w-[230px] px-4 py-3">Nút / chức năng</th>
            <th className="px-4 py-3">Cách dùng</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200 bg-white">
          {rows.map(([name, description]) => (
            <tr key={name}>
              <td className="px-4 py-3 font-semibold text-slate-900">{name}</td>
              <td className="px-4 py-3 text-slate-600">{description}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MiniCard({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <h3 className="font-bold text-slate-950">{title}</h3>
      <ol className="mt-3 space-y-2 text-sm text-slate-600">
        {items.map((item, index) => <li key={item}><b>{index + 1}.</b> {item}</li>)}
      </ol>
    </div>
  );
}

function Note({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
      <div className="font-bold text-slate-900">{title}</div>
      <div className="mt-1 text-sm text-slate-600">{text}</div>
    </div>
  );
}
