# BẢN ZIP THAY ĐỔI — áp cho project door-production

Chỉ chứa **file đã thay đổi/mới**, giữ nguyên đường dẫn trong project.
Không có `node_modules`, `.next`, `src/generated`, `.env`, `next-env.d.ts`, `__pycache__`, dữ liệu database.

Gồm toàn bộ thay đổi kể từ file zip gốc:

- **V75** — Bộ số tự động (tạo khi đơn Đã xác nhận; cấu hình số bắt đầu)
- **V76** — Gộp 3 tab Danh mục hàng hóa / Danh mục cấu hình / Cấu hình tính toán thành tab **CẤU HÌNH**
- **V77** — Sửa UI view Tạo đơn hàng (thông tin đơn 2 hàng, thu gọn bộ cửa, bỏ cuộn ngang, thanh lưu có tổng tiền, nút Xóa an toàn, ngày theo giờ máy)
- **V78** — UI giống mockup: khung nhãn trải đúng bằng khung input, ô nhập 11.5px
- **V79** — Bộ cửa về **17 ô / 1 hàng**; **Email → Website: goldmaxdoor.vn** trong Excel V2 + PDF V2 + PDF preview;
  **tab mới “Thông tin khách hàng”** (`/customers`) tự động tổng hợp tên KH / SĐT / địa chỉ từ đơn hàng, có tìm kiếm, sắp xếp và **Xuất Excel**
- **V80** — Hàng Bộ cửa: **Model rộng 175px hiện đủ "MODEL · tên diễn giải"**, thu nhỏ Ô thoáng/Hướng mở/SL bộ;
  **Thông tin đơn hàng gộp 13 ô lên 1 hàng**; nhãn 2 dòng (line-clamp) không bị cắt chữ.
- **V81** — Quy hoạch kích thước ô nhập theo **1 mốc chuẩn 1920px: 1fr = 1px** (đổi số fr = số px mong muốn ở màn 1920), các khổ màn khác co giãn theo %.
  Xem `ORDER_FIELD_SIZE_BASELINE_V81.md`.
- **V82** — Chỉnh kích thước ô nhập theo **bảng % người dùng gửi** (mốc 1920). Xem `ORDER_FIELD_SIZE_TUNING_V82.md`.
- **V83** — Chỉnh tiếp 8 ô theo % người dùng gửi (Trạng thái, Mã Đại Lý, Bộ số, TT Cao, TT Rộng, SL bộ, ĐVT, Đơn giá). Xem `ORDER_FIELD_SIZE_TUNING_V83.md`.
- **V84** — Khối **A1 — Danh mục hàng hóa**: **bỏ kiểu nhóm theo TENHANG**, liệt kê chi tiết từng MODEL thành một dòng riêng
  (kể cả 18 dòng khóa, trước đây bị gộp thành 1 nhóm “Khóa 18 MODEL”), chỉ chia **2 khối CỬA (52 MODEL) / PHỤ KIỆN (40 MODEL)**.
  Mặc định mở cả 2 khối; tìm kiếm tự mở khối có kết quả. Xem `ITEM_LIST_FLAT_V84.md`.
- **V85** — **Full view toàn bộ tab CẤU HÌNH**: hết cuộn ngang ở A1 / A2 / B1.
  Bảng dùng `table-layout: fixed` + chia % cột; bỏ mọi `min-width` cứng (bảng rule B1 từ **1560px → vừa khung**, trước đây kể cả màn 1920 vẫn tràn 864px);
  dải 5 nút chọn nhóm ở A2 và thanh chọn A1/A2/B1 chuyển từ cuộn ngang sang lưới xuống dòng;
  đơn vị “đ” ở A1 đưa lên tiêu đề cột; ghi chú B1 thành textarea; thêm tooltip cho select.
  Xem `SETTINGS_FULLVIEW_V85.md`.

## Cách áp

```
unzip -o door-production-changes-v85.zip -d <thư-mục-project>
npm run db:generate
npm run build
npm run dev
```

Không cần `npm run db:migrate` (không đổi schema Prisma, không đổi dữ liệu).

## File mới cần lưu ý

- `src/app/customers/page.tsx`, `src/app/api/customers/route.ts`, `src/app/api/customers/export/route.ts`,
  `src/lib/customers.ts`, `src/components/customer-directory.tsx` — tab Thông tin khách hàng (từ V79).
- `python/reportlab_order_v2.py`, `python/reportlab_order_preview.py` — nếu deploy Vercel có Python function thì nhớ deploy lại 2 file này để header PDF hiện Website (từ V79).
- **V85 chỉ sửa giao diện tab CẤU HÌNH (6 file)**: `globals.css`, `settings-ui.tsx`, `settings-workspace.tsx`, `item-master.tsx`, `master-options.tsx`, `calculation-config.tsx`.
  Không cần migrate, không cần đổi cấu hình.
