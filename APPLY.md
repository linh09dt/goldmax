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

## Cách áp

```
unzip -o door-production-changes-v80.zip -d <thư-mục-project>
npm run db:generate
npm run build
npm run dev
```

Không cần `npm run db:migrate` (không đổi schema Prisma).

## File mới cần lưu ý
- `src/app/customers/page.tsx`, `src/app/api/customers/route.ts`, `src/app/api/customers/export/route.ts`,
  `src/lib/customers.ts`, `src/components/customer-directory.tsx` — tab Thông tin khách hàng.
- `python/reportlab_order_v2.py`, `python/reportlab_order_preview.py` — nếu deploy Vercel có Python function thì nhớ deploy lại 2 file này để header PDF hiện Website.
