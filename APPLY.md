# BẢN ZIP THAY ĐỔI — áp cho project door-production

Chỉ chứa **file đã thay đổi/mới**, giữ nguyên đường dẫn trong project.
Không có `node_modules`, `.next`, `src/generated`, `.env`, `next-env.d.ts`, dữ liệu database.

Gói này gồm toàn bộ thay đổi kể từ file zip gốc:
- **V75** — Bộ số tự động (tạo khi đơn Đã xác nhận, số bắt đầu cấu hình được)
- **V76** — Gộp 3 tab Danh mục hàng hóa / Danh mục cấu hình / Cấu hình tính toán thành tab **CẤU HÌNH**
- **V77** — Sửa UI view Tạo đơn hàng (thông tin 2 hàng, thu gọn bộ cửa, bỏ cuộn ngang dòng phụ kiện, thanh lưu có tổng tiền, nút Xóa an toàn, ngày theo giờ máy)
- **V78** — UI view Tạo đơn hàng giống mockup: bộ cửa tách 2 nhóm có tiêu đề, **khung nhãn trải đúng bằng khung input**, ô nhập đồng bộ 11.5px

Đã áp V76/V77 trước đó thì lần này chỉ cần: `src/components/order-form.tsx`.

## Cách áp

```
unzip -o door-production-changes-v78.zip -d <thư-mục-project>
npm run db:generate
npm run build
npm run dev
```

Không cần `npm run db:migrate` (không đổi schema Prisma).
