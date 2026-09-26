/**
 * V135.1 — Dữ liệu các bước hướng dẫn có ảnh chú thích cho tab Hướng dẫn sử dụng.
 * Ảnh nằm trong public/huong-dan/ (chụp thật từ hệ thống, có khung cam đánh số + bảng chú thích).
 */

export type GuideStep = {
  code: string;
  title: string;
  image: string;
  /** Ảnh phụ (nếu có) — ví dụ trang in của cùng đơn. */
  extraImage?: string;
  extraImageCaption?: string;
  href: string;
  points: string[];
};

export const GUIDE_STEPS: GuideStep[] = [
  {
    code: "Bước 1",
    title: "Tổng quan (dashboard)",
    image: "/huong-dan/01-tong-quan.png",
    href: "/",
    points: [
      "Menu trái: Tổng quan, Quản lý đơn hàng, Tính cước vận chuyển, Báo cáo, Doanh thu, Cấu hình.",
      "Nút “+ Tạo đơn hàng” để lập đơn mới (cũng có ở mọi trang danh sách).",
      "Thẻ KPI theo kỳ đang lọc: doanh thu (chỉ đơn Sản xuất đã xác nhận), số đơn đã xác nhận, đơn nháp…",
      "Bộ lọc nhanh của Tổng quan: đại lý, loại đơn, trạng thái, khoảng ngày → bấm “Lọc”.",
      "Bảng “Đơn cần chú ý”: đơn sắp tới hạn giao / chưa xác nhận (bấm mã đơn để mở).",
      "“Mở trong Quản lý đơn hàng” để xem danh sách đầy đủ theo đúng điều kiện lọc.",
    ],
  },
  {
    code: "Bước 2",
    title: "Quản lý đơn hàng: lọc, xem nhanh, xuất file",
    image: "/huong-dan/02-quan-ly-don-hang.png",
    href: "/orders",
    points: [
      "Danh sách đơn hàng: lọc theo mã đơn, khách hàng, NVKD, loại đơn, trạng thái, ngày… trên MỘT dòng.",
      "Nút “Lọc” áp điều kiện; “Xoá lọc” trả về mặc định.",
      "“Xuất Excel” / “Xuất PDF”: xuất đúng dữ liệu đang lọc.",
      "Bấm vào một đơn để mở bảng chi tiết bên phải (xem nhanh, sửa, in…).",
      "“Xem đầy đủ 23 cột” hiện toàn bộ cột của dòng hàng, gồm cả cột Ảnh SP.",
    ],
  },
  {
    code: "Bước 3",
    title: "Tạo đơn — thông tin đơn hàng",
    image: "/huong-dan/03-tao-don-thong-tin.png",
    href: "/orders/new",
    points: [
      "Khai thông tin đơn: mã đơn, loại đơn (Mẫu / Sản xuất / Làm lại), trạng thái, ngày, khách hàng, người nhận.",
      "Tiêu đề trang cho biết đang tạo đơn loại gì; đổi “Loại đơn” ở khối thông tin.",
      "Có sẵn file Excel để lập đơn? Mở khối này để nhập từ mẫu (thay thế dòng hàng hiện có).",
      "“Lưu nháp” giữ đơn ở trạng thái nháp; “Lưu đơn hàng” xác nhận đơn (sinh Bộ số, bắt đầu tính doanh thu).",
    ],
  },
  {
    code: "Bước 4",
    title: "Tạo đơn — nhập bộ cửa",
    image: "/huong-dan/04-tao-don-bo-cua.png",
    href: "/orders/new",
    points: [
      "Mỗi thẻ là MỘT BỘ CỬA. Bấm tiêu đề để thu gọn/mở rộng; “Nhân bản bộ” để tạo bộ giống hệt.",
      "Ô “Nhóm cửa” chỉ liệt kê hàng hóa thuộc phân loại DÒNG CHÍNH (Cấp cửa) — cấu hình ở Cấu hình → A3.",
      "Sau khi chọn Model, hệ thống tự lấy tên diễn giải, ĐVT, đơn giá đại lý và tự tính KH/Lượng theo rule ở B1.",
      "“+ Thêm phụ kiện” để nhập khóa, phào, ô thoáng, chi phí gia công… cho bộ cửa này.",
      "“+ Thêm bộ cửa” khi đơn có nhiều bộ khác nhau.",
    ],
  },
  {
    code: "Bước 5",
    title: "Tạo đơn — phụ kiện / chi tiết của bộ cửa",
    image: "/huong-dan/05-phu-kien-chi-tiet.png",
    href: "/orders/new",
    points: [
      "Khối phụ kiện / chi tiết nằm ngay dưới bộ cửa: khóa, phào, ô thoáng, kính, chi phí gia công…",
      "Ô “Nhóm hàng” liệt kê hàng hóa thuộc phân loại DÒNG PHỤ KIỆN / CHI TIẾT. Nhóm hàng của phân loại có bật “Nhóm riêng” (ví dụ CHI PHÍ GIA CÔNG) nằm trong một nhóm riêng trong danh sách này.",
      "“+ Thêm phụ kiện” để thêm dòng chi tiết mới cho bộ cửa.",
    ],
  },
  {
    code: "Bước 6",
    title: "Tạo đơn — ảnh sản phẩm (nhiều ảnh, Ctrl+V)",
    image: "/huong-dan/06-anh-san-pham.png",
    href: "/orders/new",
    points: [
      "Ô ẢNH của cả bộ cửa: dán được NHIỀU ẢNH (tối đa 6). Bấm vào ô rồi nhấn Ctrl+V, hoặc dùng nút “Dán ảnh” / “Thêm ảnh”.",
      "Mỗi ảnh có ô Rộng/Cao (px) và nút Mặc định / Nhỏ / Vừa / Lớn; để trống = cỡ mặc định bằng bề rộng cột ảnh khi xuất PDF.",
      "Nút “Xóa ảnh” xoá từng ảnh. Ảnh dán trùng trong 1,5 giây sẽ tự bỏ qua (không bị nhân đôi).",
      "File Excel / PDF / bản in xuất đúng cỡ từng ảnh và xếp các ảnh theo thứ tự.",
    ],
  },
  {
    code: "Bước 7",
    title: "Xem lại đơn sau khi lưu",
    image: "/huong-dan/07-chi-tiet-don.png",
    href: "/orders",
    points: [
      "Chi tiết từng bộ cửa: dòng chính + các dòng phụ kiện/chi tiết ngay bên dưới, kèm ảnh SP.",
      "Cột “BỘ SỐ” chỉ hiện khi đơn đã xác nhận.",
      "“Tổng hợp giá trị”: cước, chiết khấu, đặt cọc, trừ kho, còn phải thu.",
      "“Xuất Excel” / “Xuất PDF” để gửi khách hoặc in; “Sửa đơn” mở lại form nhập.",
    ],
  },
  {
    code: "Bước 8",
    title: "File PDF V2 xuất từ đơn (và trang in)",
    image: "/huong-dan/08-pdf-v2.png",
    extraImage: "/huong-dan/08-ban-in-pdf.png",
    extraImageCaption: "Ảnh phụ: trang IN của cùng đơn (Ctrl+P) — cùng bố cục với file PDF, dùng khi cần in trực tiếp.",
    href: "/orders",
    points: [
      "Đây là ẢNH CHỤP TỪ CHÍNH FILE PDF xuất ra (nút “Xuất PDF”), không phải trang in hay bảng Excel.",
      "Cột Hình ảnh SP trong file PDF có đủ các ảnh của bộ cửa, xếp dọc theo thứ tự đã dán và đúng cỡ đã đặt (ảnh số 1 trong ví dụ đặt 320×426 px nên cột ảnh tự nới rộng).",
      "Phần trên trang 1: tiêu đề đơn, mã đại lý / khách hàng, bảng hàng hóa gồm dòng chính (bộ cửa) và dòng phụ kiện / chi tiết.",
      "File PDF khổ A4 ngang; đơn trong ví dụ xuất ra 3 trang (trang 1 là bảng hàng hóa, trang 2–3 là phần còn lại và phần tổng hợp giá trị).",
      "Nếu ảnh tải không kịp, hộp thoại xuất PDF sẽ báo rõ thiếu bao nhiêu ảnh để bạn bấm xuất lại.",
      "Cần bản không kèm ảnh (file nhẹ hơn): dùng tùy chọn xuất PDF không ảnh — cột Hình ảnh SP vẫn còn nhưng để trống.",
    ],
  },
  {
    code: "Bước 9",
    title: "Cấu hình A1 — Danh mục hàng hóa",
    image: "/huong-dan/09-cau-hinh-a1.png",
    href: "/settings?tab=items",
    points: [
      "A1 — Danh mục hàng hóa: toàn bộ TENHANG/MODEL dùng khi lập đơn, kèm ĐVT và giá đại lý.",
      "Danh mục chia khối theo CỘT PHÂN LOẠI: CẤP CỬA (dòng chính/bộ cửa), PHỤ KIỆN, CHI PHÍ GIA CÔNG.",
      "Đổi phân loại của một dòng ngay ở cột “Phân loại” — lưu liền, dòng tự nhảy sang khối mới.",
      "Số khối và tên khối do bạn cấu hình ở A3 (không cố định trong code).",
      "“Tạo lại Master Data từ Excel” để nạp lại danh mục; phân loại đã đặt được giữ theo MODEL.",
    ],
  },
  {
    code: "Bước 10",
    title: "Cấu hình A3 — Phân loại hàng hóa",
    image: "/huong-dan/10-cau-hinh-a3.png",
    href: "/settings?tab=categories",
    points: [
      "A3 — Phân loại hàng hóa: tự quản lý danh sách phân loại (không còn cố định trong code).",
      "“+ Thêm phân loại”: nhập tên, chọn “Dùng cho” (Dòng chính bộ cửa / Dòng phụ kiện-chi tiết), bật “Nhóm riêng” nếu muốn tách nhóm khi chọn hàng.",
      "Bảng phân loại: sửa Tên, Dùng cho, Nhóm riêng, Thứ tự; số hàng đang dùng hiện ở cột “Hàng hóa”.",
      "“Lưu” ghi thay đổi. Đổi TÊN không làm thay đổi hàng hóa đã gán (hệ thống lưu theo mã phân loại).",
      "“Ngưng dùng” ẩn khỏi danh sách chọn nhưng giữ phân loại cũ; “Xoá” nếu còn hàng hóa thì phải chọn phân loại thay thế để chuyển hàng trước.",
    ],
  },
  {
    code: "Bước 11",
    title: "Cấu hình B1 — Quy tắc tính toán",
    image: "/huong-dan/11-cau-hinh-b1.png",
    href: "/settings?tab=pricing",
    points: [
      "B1 — Cấu hình tính toán: các quy tắc tự động khi lập đơn.",
      "Làm tròn KH/Lượng và số bắt đầu Bộ số.",
      "Rule KH/Lượng & đề xuất Cao/Rộng: áp theo Nhóm hàng / Model / Bộ cửa chính.",
      "“Lưu cấu hình” áp cho các đơn tạo/sửa sau đó.",
    ],
  },
  {
    code: "Bước 12",
    title: "Báo cáo Đơn hàng",
    image: "/huong-dan/12-bao-cao-don-hang.png",
    href: "/reports/orders",
    points: [
      "Báo cáo Đơn hàng: bộ lọc giống danh sách đơn nhưng dùng cho biểu đồ và bảng tổng hợp.",
      "Biểu đồ: đơn theo tháng, cơ cấu loại đơn, trạng thái, doanh thu theo vùng miền.",
      "Bảng danh sách đơn hàng khớp với biểu đồ bên trên (cùng điều kiện lọc).",
      "“Mở Quản lý đơn hàng” để thao tác trên đơn. Nút “Xuất Excel” ở thanh lọc để tải báo cáo.",
    ],
  },
  {
    code: "Bước 13",
    title: "Theo dõi doanh thu",
    image: "/huong-dan/13-doanh-thu.png",
    href: "/revenue",
    points: [
      "Doanh thu: chỉ tính đơn loại SẢN XUẤT ở trạng thái ĐÃ XÁC NHẬN (không tính đơn mẫu/làm lại).",
      "Bảng theo đơn: tổng tiền, chiết khấu, đặt cọc, còn lại.",
      "Bảng theo sản phẩm: sản phẩm phát sinh doanh thu, dùng để đối chiếu sản lượng.",
    ],
  },
  {
    code: "Bước 14",
    title: "Tính cước vận chuyển",
    image: "/huong-dan/14-van-chuyen.png",
    href: "/shipping",
    points: [
      "Tính cước vận chuyển: chọn đơn → hệ thống tra bảng cước theo TENHANG/Model, số bộ và vùng miền.",
      "“Tính cước theo đơn hàng”: chạy tính cho đơn đang chọn.",
      "“Bảng tiêu chuẩn cước”: bảng giá cước và mức nhà máy hỗ trợ.",
      "“Áp dụng cước vào đơn hàng” để ghi cước vào đơn (nếu bạn dùng).",
    ],
  },
  {
    code: "Bước 15",
    title: "Tìm kiếm nhanh (Ctrl+K)",
    image: "/huong-dan/15-tim-kiem.png",
    href: "/",
    points: [
      "Nhấn Ctrl+K ở bất kỳ trang nào để tìm nhanh: nhập mã đơn, tên khách hàng hoặc hàng hóa.",
      "Kết quả gồm đơn hàng và hàng hóa; bấm để mở thẳng.",
    ],
  },
];
