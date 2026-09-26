import Link from "next/link";
import { ErpShell } from "@/components/erp-shell";
import { GUIDE_STEPS } from "@/lib/guide-steps";

const primaryButton = "inline-flex items-center justify-center rounded-lg bg-cyan-600 px-3 py-2 text-sm font-semibold text-white hover:bg-cyan-500";
const secondaryButton = "inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50";

const TOC_ITEMS: Array<{ id: string; label: string }> = [
  { id: "quy-trinh", label: "Quy trình sử dụng nhanh" },
  { id: "tung-buoc", label: "Hướng dẫn từng bước (có ảnh)" },
  { id: "quy-tac", label: "Quy tắc nghiệp vụ" },
  { id: "gioi-han", label: "Giới hạn hiện tại" },
  { id: "ban-giao", label: "Bàn giao kỹ thuật" },
];

export default function GuidePage() {
  return (
    <ErpShell title="Hướng dẫn sử dụng">
      <div className="space-y-6">
        <nav className="erp-card p-4">
          <div className="text-sm font-bold text-slate-900">Mục lục</div>
          <div className="mt-2 flex flex-wrap gap-2 text-[12.5px]">
            {TOC_ITEMS.map((item) => (
              <a key={item.id} className={secondaryButton} href={`#${item.id}`}>{item.label}</a>
            ))}
          </div>
        </nav>
        <section id="quy-trinh" className="erp-card p-5">
          <h2 className="text-lg font-bold text-slate-950">Quy trình sử dụng nhanh</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            <Step no="1" title="Cấu hình dữ liệu" text="Vào tab Cấu hình: kiểm tra Danh mục hàng hóa, danh mục chọn và rule tính KH/Lượng." href="/settings" />
            <Step no="2" title="Tạo đơn hàng" text="Nhập thông tin khách hàng, bộ cửa, chi tiết và giá." href="/orders/new" />
            <Step no="3" title="Tính vận chuyển" text="Chọn đơn, vùng miền, quãng đường và áp dụng cước." href="/shipping" />
            <Step no="4" title="Quản lý đơn" text="Tra cứu, sửa, xuất PDF hoặc xóa đơn." href="/orders" />
            <Step no="5" title="Theo dõi doanh thu" text="Lọc doanh thu theo thời gian, đại lý và khách hàng." href="/revenue" />
          </div>
        </section>


        <section id="tung-buoc" className="space-y-4">
          <div className="erp-card p-5">
            <h2 className="text-lg font-bold text-slate-950">Hướng dẫn từng bước (ảnh chụp thật, có chú thích)</h2>
            <p className="mt-2 text-sm text-slate-600">
              Mỗi ảnh chụp từ chính hệ thống này. <b>Số tròn màu cam</b> trên ảnh được giải thích ở danh sách bên cạnh.
              Bấm ảnh để mở kích thước đầy đủ (hoặc tải bản PDF ở cuối trang).
            </p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {GUIDE_STEPS.map((step, index) => (
                <a key={step.code} className="rounded-full border border-slate-300 bg-white px-2.5 py-1 text-[12px] font-semibold text-slate-700 hover:bg-slate-50" href={`#buoc-${index + 1}`}>
                  {index + 1}. {step.title.split(" — ")[0]}
                </a>
              ))}
            </div>
          </div>
          {GUIDE_STEPS.map((step, index) => (
            <section key={step.code} id={`buoc-${index + 1}`} className="erp-card overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-5 py-3">
                <h3 className="text-[15px] font-bold text-slate-950">{step.code} — {step.title}</h3>
                <div className="flex flex-wrap items-center gap-2">
                  <a className={secondaryButton} href={step.image} target="_blank" rel="noreferrer">Xem ảnh lớn</a>
                  <Link className={primaryButton} href={step.href}>Mở màn hình</Link>
                </div>
              </div>
              <div className="grid gap-4 p-5 xl:grid-cols-[minmax(0,1fr)_360px]">
                <a href={step.image} target="_blank" rel="noreferrer" title="Bấm để xem ảnh lớn">
                  {/* ảnh chụp tĩnh đã tối ưu sẵn; dùng thẻ img để không cần cấu hình next/image */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={step.image} alt={`${step.code} — ${step.title}`} loading="lazy" className="w-full rounded-lg border border-slate-300" />
                </a>
                <ol className="space-y-2 text-[13px] leading-relaxed text-slate-700">
                  {step.points.map((point, pointIndex) => (
                    <li key={point} className="flex gap-2 rounded-lg border border-slate-200 bg-slate-50 p-2.5">
                      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#ce4404] text-[11px] font-bold text-white">{pointIndex + 1}</span>
                      <span>{point}</span>
                    </li>
                  ))}
                </ol>
              </div>
            </section>
          ))}
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
            Đơn hàng có <b>loại đơn</b> (chọn khi tạo đơn): <b>Đơn hàng mẫu</b>, <b>Sản xuất</b>, <b>Đơn làm lại</b> — và <b>trạng thái</b>: <b>Đơn nháp</b> / <b>Đã xác nhận</b>. Nhãn xanh lá = Đã xác nhận, nhãn vàng = Đơn nháp. Đơn cũ đã hủy vẫn hiển thị “Đã hủy”.
          </div>
        </GuideSection>

        <GuideSection title="3. Tạo / sửa đơn hàng" href="/orders/new" linkLabel="Mở Tạo đơn hàng">
          <ol className="grid gap-2 text-sm text-slate-700 md:grid-cols-2">
            <li className="rounded-lg border border-slate-200 bg-white p-3"><b>Bước 1.</b> Nhập đầy đủ toàn bộ trường trong Thông tin đơn hàng; tất cả các trường có dấu * đều bắt buộc.</li>
            <li className="rounded-lg border border-slate-200 bg-white p-3"><b>Bước 2.</b> Thêm bộ cửa, chọn Nhóm cửa + Model và nhập theo các card Sản phẩm / Kích thước & cấu hình / Số lượng & giá.</li>
            <li className="rounded-lg border border-slate-200 bg-white p-3"><b>Bước 3.</b> Nhập kích thước, số lượng và đơn giá. KH/Lượng sẽ tự tính nếu Model/Nhóm hàng đã được gán rule trong Cấu hình tính toán; nếu không thì nhập tay.</li>
            <li className="rounded-lg border border-slate-200 bg-white p-3"><b>Bước 4.</b> Thêm chi tiết / phụ kiện / phụ phí. Mỗi dòng là một mini-card; nhập trực tiếp các cột hiển thị, không cần cuộn ngang.</li>
            <li className="rounded-lg border border-slate-200 bg-white p-3"><b>Bước 5.</b> Dán ảnh (Ctrl+V hoặc nút <b>Dán ảnh</b> / <b>Tải ảnh</b> bên dưới ô ảnh), chỉnh kích thước nếu cần, sau đó kiểm tra tổng giá trị.</li>
            <li className="rounded-lg border border-slate-200 bg-white p-3"><b>Bước 6.</b> Bấm <b>Lưu nháp</b> để giữ đơn ở trạng thái <b>Đơn nháp</b> (chưa có Bộ số), hoặc <b>Lưu đơn hàng</b> để chuyển đơn sang <b>Đã xác nhận</b> và hệ thống cấp Bộ số. Cả hai cách đều mở trang chi tiết đơn sau khi lưu.</li>
          </ol>
          <ActionTable rows={[
            ["Nhập Excel mẫu đơn", "Đọc dữ liệu từ file Excel mẫu và đưa vào đơn đang nhập."],
            ["+ Bộ cửa", "Thêm một bộ cửa mới vào đơn."],
            ["Nhân bản bộ", "Sao chép bộ cửa hiện tại để nhập nhanh một bộ tương tự."],
            ["+ Thêm dòng", "Thêm một mini-card chi tiết / phụ kiện / phụ phí vào bộ cửa đang chọn."],
            ["Xóa bộ", "Xóa toàn bộ bộ cửa và các dòng chi tiết thuộc bộ đó."],
            ["Dán / Tải / Xóa ảnh", "Bấm nút Dán ảnh (đọc thẳng từ Clipboard) hoặc Đổi ảnh / Tải ảnh để chọn file — các nút này nằm ngoài ô ảnh. Bấm Xóa ảnh để bỏ ảnh của dòng. Ảnh được lưu trên Supabase Storage."],
            ["Kích thước ảnh", "Sau khi có ảnh, kéo ô vuông ở góc dưới-phải hoặc gõ số px vào ô Rộng / Cao. Mặc định lấy bằng bề rộng cột ẢNH SP khi xuất PDF; bấm Mặc định để quay lại cỡ đó."],
            ["Xóa", "Xóa một dòng chi tiết / phụ kiện / phụ phí."],
            ["Lưu nháp", "Lưu đơn ở trạng thái Đơn nháp (chưa cấp Bộ số), sau đó mở trang chi tiết đơn. Đơn đã xác nhận thì không bị hạ cấp về nháp."],
            ["Lưu đơn hàng", "Lưu đơn và chuyển sang trạng thái Đã xác nhận (hệ thống cấp Bộ số cho mọi loại đơn), sau đó mở trang chi tiết đơn."],
          ]} />
        </GuideSection>

        <GuideSection title="4. Thông tin khách hàng" href="/customers" linkLabel="Mở Thông tin khách hàng">
          <p className="text-sm text-slate-600">
            Danh bạ khách hàng được <b>tự động tổng hợp từ các đơn hàng đã lưu</b> — không phải nhập tay.
            Mỗi khách hàng gồm tên khách hàng, số điện thoại và địa chỉ nhận hàng, kèm số đơn và tổng tiền.
          </p>
          <ActionTable rows={[
            ["Tìm kiếm", "Tìm theo tên, số điện thoại, địa chỉ, mã đại lý hoặc mã đơn (không phân biệt dấu)."],
            ["Sắp xếp", "Đơn gần nhất / Nhiều đơn nhất / Doanh thu cao nhất."],
            ["Xem N đơn", "Mở danh sách đơn hàng của khách đó, bấm mã đơn để mở chi tiết đơn."],
            ["Xuất Excel", "Xuất danh sách khách hàng đang xem (theo từ khóa tìm kiếm) ra file Excel."],
          ]} />
          <GuideSubTitle code="GHI CHÚ" title="Nguồn dữ liệu" text="Khách hàng xuất hiện ngay sau khi lưu đơn hàng (Tên khách hàng + Số điện thoại + Địa chỉ nhận hàng trên đơn)." />
        </GuideSection>

        <GuideSection title="5. Theo dõi doanh thu" href="/revenue" linkLabel="Mở Theo dõi doanh thu">
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

        <GuideSection title="6. Cấu hình" href="/settings" linkLabel="Mở Cấu hình">
          <p className="text-sm text-slate-600">
            Tab <b>Cấu hình</b> gộp ba khu vực làm việc theo thứ tự nghiệp vụ: khai báo dữ liệu nền trước, rồi mới gán quy tắc tính toán.
            Dùng menu phụ bên trái (mã <b>A1</b>, <b>A2</b>, <b>B1</b>) để chuyển khu vực; trên màn hình nhỏ thì dùng dải nút phía trên.
          </p>

          <GuideSubTitle code="A1" title="Danh mục hàng hóa" text="Master Data dùng khi lập đơn: TENHANG, MODEL, ĐVT, giá đại lý và giá bán lẻ." />
          <ActionTable rows={[
            ["Phân loại", "Mỗi hàng hóa thuộc 1 phân loại (Cấp cửa / Phụ kiện / Chi phí gia công...). Danh mục chia khối theo cột này; đổi ô Phân loại ở từng dòng là lưu ngay. Danh sách phân loại tự thêm/đổi tên/xoá ở mục A3."],
            ["Tạo lại Master Data từ Excel", "Tạo lại danh mục từ file Excel nguồn. Đơn hàng đã có không bị xóa; phân loại đã đặt được giữ lại theo MODEL."],
            ["Xuất Master Data", "Xuất Danh mục hàng hóa hiện tại ra Excel."],
            ["+ Thêm hàng hóa", "Thêm thủ công một TENHANG / MODEL mới."],
            ["Tìm kiếm", "Tìm theo TENHANG, tên diễn giải, MODEL hoặc ĐVT."],
            ["Nhóm theo TENHANG", "Gom các MODEL cùng TENHANG để dễ theo dõi."],
            ["Mở tất cả / Thu gọn", "Mở hoặc thu gọn toàn bộ nhóm TENHANG."],
            ["Sửa", "Cho phép chỉnh TENHANG, tên diễn giải, MODEL, ĐVT, giá và trạng thái."],
            ["Lưu / Hủy", "Lưu chỉnh sửa hoặc bỏ chỉnh sửa đang thực hiện."],
            ["Xóa", "Xóa hàng hóa khỏi Master Data sau khi xác nhận."],
          ]} />

          <GuideSubTitle code="A3" title="Phân loại hàng hóa" text="Tự cấu hình danh sách phân loại dùng cho tab A1 và form tạo đơn." />
          <ActionTable rows={[
            ["+ Thêm phân loại", "Thêm phân loại mới. Mã sinh tự động từ tên; đổi tên sau đó không làm thay đổi hàng hóa đã gán."],
            ["Dùng cho", "“Dòng chính (bộ cửa)” = hàng hóa hiện ở ô Nhóm cửa khi lập đơn; “Dòng phụ kiện / chi tiết” = hiện ở ô Nhóm hàng."],
            ["Nhóm riêng", "Bật thì các nhóm hàng thuộc phân loại này nằm trong một optgroup riêng trong ô chọn nhóm hàng (như Chi phí gia công)."],
            ["Lưu", "Lưu tên, cách dùng, thứ tự của phân loại."],
            ["Ngưng dùng / Dùng lại", "Ẩn khỏi danh sách chọn nhưng giữ nguyên phân loại của hàng hóa cũ."],
            ["Xoá", "Nếu còn hàng hóa đang dùng, hệ thống yêu cầu chọn phân loại thay thế để chuyển trước khi xoá."],
          ]} />

          <GuideSubTitle code="A2" title="Danh mục cấu hình" text="Các giá trị chọn nhanh trong đơn: Mã Đại Lý, Màu sơn, Hướng mở, Hướng phào, Ô thoáng / Pano / Nan chớp." />
          <ActionTable rows={[
            ["Chọn nhóm cấu hình", "Bấm một thẻ nhóm ở trên để xem và sửa danh mục của nhóm đó."],
            ["+ Thêm giá trị", "Thêm một giá trị mới vào nhóm đang chọn."],
            ["Lưu", "Lưu Mã, Tên hiển thị hoặc Thứ tự sau khi chỉnh."],
            ["Ngưng dùng", "Ẩn giá trị khỏi danh sách chọn mới nhưng vẫn giữ dữ liệu cũ."],
            ["Kích hoạt", "Cho phép sử dụng lại giá trị đã ngưng."],
            ["Xóa Mã Đại Lý", "Xóa mã khỏi danh mục chọn mới; Mã Đại Lý đã lưu trong đơn hàng cũ vẫn được giữ nguyên."],
          ]} />

          <GuideSubTitle code="B1" title="Cấu hình tính toán" text="Gán cách tính KH/Lượng, nguồn đề xuất Cao/Rộng, đơn giá theo Khuôn và số bắt đầu Bộ số. Rule Model ưu tiên hơn rule Nhóm hàng." />
          <ActionTable rows={[
            ["Làm tròn KH/Lượng", "Chọn số chữ số thập phân dùng cho các giá trị KH/Lượng tự tính; mặc định 2."],
            ["Số bắt đầu áp dụng Bộ số", "Số nhỏ nhất dùng cho Bộ số. Bộ số chỉ được cấp khi bấm Lưu đơn hàng (đơn chuyển sang trạng thái Đã xác nhận) và giữ nguyên sau đó."],
            ["Đơn giá cửa theo Khuôn", "Giá gốc lấy từ Giá đại lý của Model. Khuôn được làm tròn theo nấc cấu hình (mặc định 10 mm) rồi cộng phụ thu."],
            ["Mốc Khuôn", "Mặc định ≤140 mm không phụ thu; 150–170 mm cộng 10.000đ/m² mỗi 10 mm; 180–250 mm cộng cố định 110.000đ/m²; trên 250 mm tiếp tục cộng 10.000đ/m² mỗi 10 mm."],
            ["Bộ cửa chính", "Dùng công thức Cao × Rộng / 1.000.000 hoặc chọn Nhập tay nếu cần."],
            ["Theo nhóm hàng", "Áp một công thức chung cho toàn bộ Model thuộc Nhóm hàng, ví dụ Phào / Ô thoáng / Khóa."],
            ["Theo Model / hàng hóa", "Gán rule riêng cho đúng Model. Có thể kế thừa công thức KH/Lượng từ Nhóm nhưng cấu hình Cao/Rộng riêng."],
            ["Công thức KH/Lượng", "Cột CÁCH TÍNH KH/LƯỢNG chọn 1 trong: Cao × Rộng / 1.000.000 · (Cao × 2 + Rộng) / 1.000 · (Cao × 2 + Rộng × 2) / 1.000 · Cao × 2 / 1.000 · Rộng / 1.000 · Nhập tay · Theo số TK ô thoáng (4TK → 4; 3TK → 3; 2TK → 2; 1TK → 1) · Theo SL bộ cửa cha."],
            ["Bộ cửa chính", "Cột BỘ CỬA CHÍNH giới hạn rule theo loại cửa cha, để cùng một phụ kiện dùng công thức khác nhau — ví dụ Phào rời của cửa sổ và Phào rời của cửa đi. Để trống = áp dụng cho mọi bộ cửa."],
            ["Đề xuất Cao / Rộng", "Chọn Cao cửa, Rộng cửa, Để trống hoặc Nhập tay / giữ nguyên. Đề xuất chỉ điền khi chọn hàng hóa và vẫn sửa tay được."],
            ["Tạo lại cấu hình gợi ý", "Quét Danh mục hàng hóa để tạo mẫu cho Phào, Ô thoáng, Khóa và các loại Phào rời / biệt thự."],
            ["Lưu cấu hình", "Áp dụng rule mới cho màn Tạo/Sửa đơn hàng. Không thay đổi dữ liệu đơn đã lưu."],
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


        <section id="quy-tac" className="erp-card p-5">
          <h2 className="text-lg font-bold text-slate-950">Quy tắc nghiệp vụ cần nhớ</h2>
          <div className="mt-3">
            <ActionTable rows={[
              ["Doanh thu", "Chỉ tính đơn có Loại đơn = Sản xuất VÀ Trạng thái = Đã xác nhận. Đơn Mẫu / Làm lại / Nháp không vào doanh thu."],
              ["Loại đơn", "Đơn hàng mẫu · Sản xuất · Đơn làm lại."],
              ["Trạng thái", "Đơn nháp → Đã xác nhận."],
              ["Bộ số", "Chỉ hiện khi đơn đã xác nhận; số bắt đầu cấu hình ở B1."],
              ["Cách tính tiền", "Số KH/Lượng × Đơn giá. Dòng không có KH/Lượng vẫn hiện đầy đủ nhưng thành tiền = 0."],
              ["Dòng hiện trong đơn & file xuất", "Dòng có dữ liệu thật (mã hàng, kích thước, số lượng, giá, ghi chú, ảnh…). Dòng mẫu rỗng (0 / - / —) tự ẩn; Bộ số tự sinh không tính là dữ liệu."],
              ["Giá & ĐVT", "Lấy từ Danh mục hàng hóa (A1) khi chọn Model — nên khai giá trong danh mục trước khi lập đơn."],
              ["Phân loại hàng hóa", "Là dữ liệu, quản lý ở Cấu hình A3. Quyết định hàng nào vào ô Nhóm cửa / Nhóm hàng / nhóm riêng."],
              ["Ảnh sản phẩm", "Nhiều ảnh cho mỗi bộ cửa (tối đa 6); cỡ ảnh theo px (24–800), để trống = mặc định 56 px; Excel/PDF/in xuất đúng cỡ."],
              ["Đơn vị tiền", "VNĐ, có phân cách nghìn."],
            ]} />
          </div>
        </section>

        <section id="gioi-han" className="erp-card p-5">
          <h2 className="text-lg font-bold text-slate-950">Những gì chưa có (giới hạn hiện tại)</h2>
          <ul className="mt-3 grid gap-2 text-sm text-slate-700 md:grid-cols-2">
            <li className="rounded-lg border border-slate-200 bg-slate-50 p-3"><b>Giá vốn &amp; lợi nhuận:</b> chưa có cột giá vốn nên chưa có báo cáo lãi gộp.</li>
            <li className="rounded-lg border border-slate-200 bg-slate-50 p-3"><b>Công nợ / phiếu thu:</b> đã có “còn phải thu” theo đơn, chưa có phiếu thu và đối chiếu công nợ.</li>
            <li className="rounded-lg border border-slate-200 bg-slate-50 p-3"><b>Phân quyền &amp; nhật ký thao tác:</b> chưa có đăng nhập/phân quyền trong app.</li>
            <li className="rounded-lg border border-slate-200 bg-slate-50 p-3"><b>Giao hàng / vận đơn, thông báo realtime, Báo giá – Thanh toán:</b> chưa xây.</li>
            <li className="rounded-lg border border-slate-200 bg-slate-50 p-3"><b>Tải sản xuất:</b> mới ở mức báo cáo theo KH/Lượng, chưa có lệnh sản xuất/tiến độ công đoạn.</li>
          </ul>
        </section>

        <section id="ban-giao" className="erp-card p-5">
          <h2 className="text-lg font-bold text-slate-950">Bàn giao kỹ thuật</h2>
          <p className="mt-2 text-sm text-slate-600">
            Bản đầy đủ (kèm 15 ảnh chú thích) có thể tải về để in/gửi nội bộ:
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <a className={primaryButton} href="/huong-dan/huong-dan-su-dung-goldmax.pdf" download>Tải hướng dẫn (PDF)</a>
            <a className={secondaryButton} href="/huong-dan/huong-dan-su-dung-goldmax.pdf" target="_blank" rel="noreferrer">Mở PDF trên tab mới</a>
          </div>
          <div className="mt-4 space-y-3">
            <details className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <summary className="cursor-pointer font-bold text-slate-900">Công nghệ &amp; bảng dữ liệu</summary>
              <div className="mt-3 text-sm text-slate-700">
                <p>Giao diện + API: <b>Next.js 16</b> (App Router) + <b>React 19</b> + TypeScript. Dữ liệu: <b>PostgreSQL</b> (Supabase) qua <b>Prisma 7</b>. Excel: <i>exceljs</i>. PDF V2: hàm Python <i>api/order_pdf_v2.py</i> + ReportLab. Ảnh: Supabase Storage (fallback thư mục <i>uploads/orders</i> khi chạy nội bộ).</p>
                <p className="mt-2">16 bảng: <i>sales_orders, sales_order_items, sales_order_item_details, sales_order_item_images, sales_order_requirements, order_imports, item_masters, item_categories, item_master_imports, item_attribute_imports, master_options, shipping_rates, shipping_model_mappings, shipping_calculations, system_settings, survey_answers</i>.</p>
              </div>
            </details>
            <details className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <summary className="cursor-pointer font-bold text-slate-900">Quy trình deploy (migration TRƯỚC — code SAU)</summary>
              <ol className="mt-3 space-y-2 text-sm text-slate-700">
                <li className="rounded-lg border border-slate-200 bg-white p-2.5"><b>1.</b> Chạy migration: <code>npx prisma migrate deploy</code> — hoặc mở Supabase → SQL Editor → dán nội dung file trong <code>prisma/migrations/&lt;tên&gt;/migration.sql</code>.</li>
                <li className="rounded-lg border border-slate-200 bg-white p-2.5"><b>2.</b> Deploy code bản mới lên Vercel.</li>
                <li className="rounded-lg border border-slate-200 bg-white p-2.5"><b>3.</b> Chạy checklist kiểm tra sau deploy (xem mục dưới).</li>
              </ol>
              <div className="mt-3">
                <ActionTable rows={[
                  ["20260926120000_report_indexes", "Index phục vụ báo cáo/dashboard."],
                  ["20260926180000_image_size", "Cột image_width / image_height (cỡ ảnh chỉnh tay)."],
                  ["20260926200000_item_images", "Bảng sales_order_item_images (nhiều ảnh/bộ cửa) + chuyển ảnh cũ thành ảnh số 1."],
                  ["20260926210000_item_category", "Cột item_masters.category + tự phân loại dữ liệu cũ."],
                  ["20260926220000_item_categories", "Bảng item_categories (phân loại tự cấu hình) + nạp 3 phân loại đang dùng."],
                ]} />
              </div>
            </details>
            <details className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <summary className="cursor-pointer font-bold text-slate-900">Biến môi trường &amp; checklist sau deploy</summary>
              <div className="mt-3 text-sm text-slate-700">
                <p><b>Biến môi trường:</b> <code>DATABASE_URL</code>, <code>DIRECT_URL</code>, <code>SUPABASE_URL</code>, <code>SUPABASE_SECRET_KEY</code> / <code>SUPABASE_SERVICE_ROLE_KEY</code>, <code>SUPABASE_ORDER_IMAGE_BUCKET</code>, <code>NEXT_PUBLIC_SUPABASE_URL</code>.</p>
                <ol className="mt-2 space-y-1">
                  <li>1. Mở <b>Tổng quan</b> — số liệu hiện, không lỗi.</li>
                  <li>2. Mở <b>Quản lý đơn hàng</b> — lọc và <b>Xuất Excel</b> ra file có dữ liệu.</li>
                  <li>3. Mở <b>Cấu hình A1</b> — đủ khối phân loại, đổi ô Phân loại được.</li>
                  <li>4. Mở <b>Cấu hình A3</b> — thêm/đổi tên phân loại thử rồi trả lại.</li>
                  <li>5. Tạo 1 đơn thử (bộ cửa + phụ kiện + ảnh) → lưu → xuất Excel và PDF, kiểm tra ảnh.</li>
                  <li>6. Mở <b>Doanh thu</b> — số liệu khớp đơn vừa xác nhận (nếu là đơn Sản xuất).</li>
                </ol>
              </div>
            </details>
            <details className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <summary className="cursor-pointer font-bold text-slate-900">Xử lý sự cố thường gặp</summary>
              <div className="mt-3">
                <ActionTable rows={[
                  ["Vừa deploy code là lỗi cột/bảng không tồn tại", "Chưa chạy migration → chạy migration rồi tải lại."],
                  ["Ô “Nhóm cửa” trống, không chọn được mã cửa", "Không còn phân loại nào ở nhóm “Dòng chính (bộ cửa)” → kiểm tra Cấu hình A3 và phân loại của hàng hóa ở A1."],
                  ["Dòng phụ kiện hiện nhưng thành tiền = 0", "Dòng chưa có Số KH/Lượng → nhập KH/Lượng hoặc gán rule ở B1."],
                  ["Dán ảnh mà ảnh không hiện", "Trình duyệt chặn clipboard → bấm vào ô ảnh rồi Ctrl+V, hoặc dùng nút Dán ảnh / Thêm ảnh."],
                  ["Đơn không vào doanh thu", "Sai Loại đơn hoặc Trạng thái → đơn phải là Sản xuất + Đã xác nhận."],
                  ["Xuất PDF báo lỗi", "Thử xuất PDF không kèm ảnh, hoặc giảm cỡ ảnh ở bước 6."],
                ]} />
              </div>
            </details>
          </div>
        </section>

        <section className="erp-card p-5">
          <h2 className="text-lg font-bold text-slate-950">Lưu ý khi thao tác</h2>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <Note title="Trước khi xóa" text="Kiểm tra đúng đơn hàng hoặc đúng Master Data. Các nút Xóa đều yêu cầu xác nhận." />
            <Note title="Sau khi sửa" text="Luôn bấm Lưu thay đổi / Lưu cấu hình / Lưu để dữ liệu được ghi lại." />
            <Note title="Xuất Excel" text="Nếu màn hình có bộ lọc, file xuất sẽ đi theo bộ lọc đang áp dụng." />
            <Note title="Ảnh sản phẩm" text="Mỗi bộ cửa dán được nhiều ảnh (tối đa 6). Bấm ô Hình ảnh SP rồi Ctrl+V để dán nối tiếp, hoặc dùng nút Dán ảnh / Thêm ảnh; mỗi ảnh có nút Xóa ảnh riêng. Gõ Rộng/Cao (px) cho từng ảnh — file Excel/PDF/in sẽ xuất đúng cỡ đó, ảnh để trống dùng cỡ mặc định bằng bề rộng cột ảnh khi xuất PDF. Ảnh lưu trên Supabase Storage." />
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
          {/* khoá theo chỉ số vì một số bảng có 2 dòng cùng nhãn (ví dụ “Bộ cửa chính”) */}
          {rows.map(([name, description], index) => (
            <tr key={`${name}-${index}`}>
              <td className="px-4 py-3 font-semibold text-slate-900">{name}</td>
              <td className="px-4 py-3 text-slate-600">{description}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function GuideSubTitle({ code, title, text }: { code: string; title: string; text: string }) {
  return (
    <div className="flex items-start gap-2 border-l-2 border-cyan-500 pl-3">
      <span className="mt-0.5 inline-flex h-5 min-w-8 items-center justify-center rounded bg-slate-900 px-1.5 text-[10px] font-bold text-cyan-300">{code}</span>
      <div>
        <div className="text-[13.5px] font-semibold text-slate-900">{title}</div>
        <div className="mt-0.5 text-[12px] text-slate-500">{text}</div>
      </div>
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
